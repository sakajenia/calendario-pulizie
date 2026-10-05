/*
 * Il Worker vero (worker/index.ts) contro un archivio D1 finto, fatto con il
 * SQLite di Node: stesse istruzioni SQL (json_extract, json_each), nessun
 * wrangler. Serve alle regole di scrittura: i passaggi di stato della ditta,
 * le righe rimandate indietro (`rifiutate`), le pulizie a pezzi scritte con
 * un gettone da manager e le case che cambiano ditta.
 *
 * Ogni test ricarica il modulo: il Worker si ricorda di aver gia' preparato
 * le tabelle, e ogni test ha un database nuovo.
 */
import { DatabaseSync } from 'node:sqlite'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/* ------------------------------------------------------ D1 finto ---- */

class Istruzione {
  constructor(private db: DatabaseSync, private sql: string, private valori: unknown[] = []) {}
  bind(...valori: unknown[]) { return new Istruzione(this.db, this.sql, valori) }
  esegui() { return this.db.prepare(this.sql).run(...(this.valori as never[])) }
  async first<T>() { return (this.db.prepare(this.sql).get(...(this.valori as never[])) ?? null) as T | null }
  async all<T>() { return { results: this.db.prepare(this.sql).all(...(this.valori as never[])) as T[] } }
  async run() { this.esegui(); return { success: true } }
}

class D1Finto {
  db = new DatabaseSync(':memory:')
  prepare(sql: string) { return new Istruzione(this.db, sql) }
  /* Come D1: tutto il blocco passa, o niente. */
  async batch(istruzioni: Istruzione[]) {
    this.db.exec('BEGIN')
    try {
      for (const i of istruzioni) i.esegui()
      this.db.exec('COMMIT')
    } catch (e) {
      this.db.exec('ROLLBACK')
      throw e
    }
    return []
  }
}

/* ------------------------------------------------------- strumenti ---- */

const ADMIN = { identificativo: 'm2ab.srl@gmail.com', password: 'propromanager' }
const ANGELA = { identificativo: 'angela@propromanager.it', password: 'SHyA9onz$uM@i5cL' }

type Riga = { tipo: string; id: string; dati: Record<string, unknown> | null; eliminato: boolean; aggiornato: number }
interface Risposta { status: number; corpo: Record<string, unknown> }

let worker: { fetch: (req: Request, env: unknown) => Promise<Response> }
let env: { DB: D1Finto; SYNC_SECRET: string; ASSETS: unknown }
let orologio: number

async function chiama(percorso: string, opz: { gettone?: string; corpo?: unknown } = {}): Promise<Risposta> {
  const risposta = await worker.fetch(new Request(`http://archivio.prova${percorso}`, {
    method: opz.corpo === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...(opz.gettone ? { authorization: `Bearer ${opz.gettone}` } : {}) },
    body: opz.corpo === undefined ? undefined : JSON.stringify(opz.corpo),
  }), env)
  return { status: risposta.status, corpo: await risposta.json() as Record<string, unknown> }
}

async function gettone(chi: typeof ADMIN) {
  const r = await chiama('/api/accesso', { corpo: chi })
  expect(r.status).toBe(200)
  return r.corpo.gettone as string
}

/** Scrive e fa avanzare l'orologio: ogni scrittura ha il suo istante. */
async function scrivi(g: string, record: unknown[]) {
  const r = await chiama('/api/dati', { gettone: g, corpo: { record } })
  expect(r.status).toBe(200)
  avanza(60_000)
  return r.corpo as { scritti: number; adesso: number; rifiutate?: Riga[] }
}

async function leggi(g: string, da = 0) {
  const r = await chiama(`/api/dati?da=${da}`, { gettone: g })
  expect(r.status).toBe(200)
  return r.corpo as { record: Riga[]; adesso: number }
}

const avanza = (ms: number) => { orologio += ms; vi.setSystemTime(orologio) }

const sulServer = (tipo: string, id: string) => {
  const r = env.DB.db.prepare('SELECT dati, aggiornato FROM record WHERE tipo = ? AND id = ?').get(tipo, id) as
    { dati: string | null; aggiornato: number } | undefined
  return r ? { dati: r.dati ? JSON.parse(r.dati) as Record<string, unknown> : null, aggiornato: r.aggiornato } : undefined
}

const casa = (id: string, companyId?: string) => ({ id, name: id, ...(companyId ? { companyId } : {}) })
const pulizia = (id: string, over: Record<string, unknown> = {}) => ({
  id, apartmentId: 'ap-a', hostId: 'u-admin', status: 'in_attesa', createdAt: '2026-01-01T00:00:00.000Z',
  checkOutAt: '2026-11-14T09:00:00.000Z', checkInAt: '2026-11-14T14:00:00.000Z', checkInPeople: 2,
  beds: [], perPersonExtras: [], apartmentExtras: [], ...over,
})

let admin: string
let angela: string

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  orologio = Date.UTC(2026, 9, 5, 12)
  vi.setSystemTime(orologio)
  vi.resetModules()
  worker = (await import('../../worker/index')).default as typeof worker
  env = { DB: new D1Finto(), SYNC_SECRET: 'segreto-di-prova', ASSETS: {} }
  admin = await gettone(ADMIN)
  angela = await gettone(ANGELA)
  await scrivi(admin, [
    { tipo: 'apartments', id: 'ap-a', dati: casa('ap-a', 'angela') },
    { tipo: 'requests', id: 'r1', dati: pulizia('r1') },
  ])
})

afterEach(() => { vi.useRealTimers() })

/* ------------------------------------------------------------ test ---- */

describe('ditta: i gesti di "Annulla"', () => {
  it('rifiuto annullato: cancellata -> in attesa', async () => {
    expect((await scrivi(angela, [{ tipo: 'requests', id: 'r1', dati: { id: 'r1', status: 'cancellata' } }])).rifiutate).toEqual([])
    expect(sulServer('requests', 'r1')?.dati?.status).toBe('cancellata')
    const esito = await scrivi(angela, [{ tipo: 'requests', id: 'r1', dati: { id: 'r1', status: 'in_attesa' } }])
    expect(esito.rifiutate).toEqual([])
    expect(sulServer('requests', 'r1')?.dati?.status).toBe('in_attesa')
  })

  it('chiusura annullata di una pulizia in corso: completata -> in corso, data e autore tolti', async () => {
    await scrivi(admin, [{ tipo: 'requests', id: 'r1', dati: pulizia('r1', { status: 'in_corso', assigneeId: 'u-pulizie-angela' }) }])
    await scrivi(angela, [{ tipo: 'requests', id: 'r1', dati: {
      id: 'r1', status: 'completata', completedAt: '2026-10-05T12:00:00.000Z', completedById: 'u-pulizie-angela',
    } }])
    expect(sulServer('requests', 'r1')?.dati).toMatchObject({ status: 'completata', completedById: 'u-pulizie-angela' })
    const esito = await scrivi(angela, [{ tipo: 'requests', id: 'r1', dati: {
      id: 'r1', status: 'in_corso', completedAt: null, completedById: null,
    } }])
    expect(esito.rifiutate).toEqual([])
    const dati = sulServer('requests', 'r1')?.dati
    expect(dati).toMatchObject({ status: 'in_corso', assigneeId: 'u-pulizie-angela', apartmentId: 'ap-a' })
    expect(dati).not.toHaveProperty('completedAt')
    expect(dati).not.toHaveProperty('completedById')
  })

  it('una pulizia annullata dal calendario non la riapre la ditta: torna indietro con la copia del server', async () => {
    await scrivi(admin, [{ tipo: 'requests', id: 'r1', dati: pulizia('r1', { status: 'cancellata', annullataDaCalendario: true }) }])
    const prima = sulServer('requests', 'r1')!
    const esito = await scrivi(angela, [{ tipo: 'requests', id: 'r1', dati: { id: 'r1', status: 'in_attesa' } }])
    expect(esito.scritti).toBe(0)
    expect(esito.rifiutate).toHaveLength(1)
    expect(esito.rifiutate![0]).toMatchObject({
      tipo: 'requests', id: 'r1', eliminato: false, aggiornato: prima.aggiornato,
      dati: { status: 'cancellata', annullataDaCalendario: true, apartmentId: 'ap-a' },
    })
    expect(sulServer('requests', 'r1')).toEqual(prima)
  })

  it('le pulizie di altre ditte non tornano indietro (la ditta non le deve vedere)', async () => {
    await scrivi(admin, [
      { tipo: 'apartments', id: 'ap-b', dati: casa('ap-b', 'altra') },
      { tipo: 'requests', id: 'r2', dati: pulizia('r2', { apartmentId: 'ap-b' }) },
    ])
    const esito = await scrivi(angela, [{ tipo: 'requests', id: 'r2', dati: { id: 'r2', status: 'accettata' } }])
    expect(esito.rifiutate).toEqual([])
    expect(sulServer('requests', 'r2')?.dati?.status).toBe('in_attesa')
  })
})

describe('manager: pulizie a pezzi e pulizie incomplete', () => {
  /* Un account appena promosso il cui telefono crede ancora di essere una
     ditta manda solo i campi cambiati: si uniscono alla copia del server. */
  it('una pulizia a pezzi si unisce a quella del server e torna indietro scritta', async () => {
    const esito = await scrivi(admin, [{ tipo: 'requests', id: 'r1', dati: {
      id: 'r1', status: 'accettata', assigneeId: 'u-pulizie-angela', operatorNotes: null,
    } }])
    const dati = sulServer('requests', 'r1')?.dati
    expect(dati).toMatchObject({
      status: 'accettata', assigneeId: 'u-pulizie-angela', apartmentId: 'ap-a',
      checkOutAt: '2026-11-14T09:00:00.000Z', checkInAt: '2026-11-14T14:00:00.000Z', checkInPeople: 2,
    })
    expect(esito.rifiutate).toHaveLength(1)
    expect(esito.rifiutate![0].dati).toEqual(dati)
  })

  it('un null su casa, orari o stato non li toglie', async () => {
    await scrivi(admin, [{ tipo: 'requests', id: 'r1', dati: { id: 'r1', status: null, checkInAt: null, notes: 'x' } }])
    expect(sulServer('requests', 'r1')?.dati).toMatchObject({ status: 'in_attesa', checkInAt: '2026-11-14T14:00:00.000Z', notes: 'x' })
  })

  it('una pulizia a pezzi che l\'archivio non ha non si scrive', async () => {
    const esito = await scrivi(admin, [{ tipo: 'requests', id: 'nuova', dati: { id: 'nuova', status: 'accettata' } }])
    expect(esito.scritti).toBe(0)
    expect(sulServer('requests', 'nuova')).toBeUndefined()
  })

  it('una pulizia intera senza check-in o con stato sconosciuto si salta e torna indietro', async () => {
    const { checkInAt: _senza, ...senzaCheckIn } = pulizia('r1', { notes: 'rotta' })
    const prima = sulServer('requests', 'r1')!
    const esito = await scrivi(admin, [
      { tipo: 'requests', id: 'r1', dati: senzaCheckIn },
      { tipo: 'requests', id: 'r3', dati: pulizia('r3', { status: 'boh' }) },
    ])
    expect(esito.scritti).toBe(0)
    expect(sulServer('requests', 'r1')).toEqual(prima)
    expect(sulServer('requests', 'r3')).toBeUndefined()
    expect(esito.rifiutate?.map((r) => r.id)).toEqual(['r1'])
  })
})

describe('una casa passa a un\'altra ditta', () => {
  it('le sue pulizie prendono l\'orario dello spostamento e arrivano alla ditta nuova', async () => {
    await scrivi(admin, [
      { tipo: 'apartments', id: 'ap-c', dati: casa('ap-c') },
      { tipo: 'requests', id: 'r4', dati: pulizia('r4', { apartmentId: 'ap-c' }) },
    ])
    const { adesso: segnalibro, record } = await leggi(angela)
    expect(record.some((r) => r.id === 'r4')).toBe(false)

    const esito = await scrivi(admin, [{ tipo: 'apartments', id: 'ap-c', dati: casa('ap-c', 'angela') }])
    expect(sulServer('requests', 'r4')?.aggiornato).toBe(esito.adesso)
    /* La pulizia della casa rimasta ferma non si tocca. */
    expect(sulServer('requests', 'r1')!.aggiornato).toBeLessThan(esito.adesso)

    const dopo = await leggi(angela, segnalibro)
    expect(dopo.record.map((r) => r.id).sort()).toEqual(['ap-c', 'r4'])
  })
})
