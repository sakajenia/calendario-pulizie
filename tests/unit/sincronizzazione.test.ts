/*
 * Lo scambio con l'archivio condiviso, visto dallo store: un archivio finto
 * al posto del Worker (stesse regole per le ditte) e lo store vero.
 *
 * Ogni test ricarica i moduli: le impronte e le copie della ditta vivono nel
 * modulo dello store, e devono ripartire pulite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CleaningRequest, User } from '@/types'
import { casa, pulizia, utente } from './fixtures'

/* ------------------------------------------------ localStorage finto ---- */

class MemoriaFinta {
  private dati = new Map<string, string>()
  getItem(k: string) { return this.dati.has(k) ? this.dati.get(k)! : null }
  setItem(k: string, v: string) { this.dati.set(k, String(v)) }
  removeItem(k: string) { this.dati.delete(k) }
  clear() { this.dati.clear() }
  key(i: number) { return [...this.dati.keys()][i] ?? null }
  get length() { return this.dati.size }
}

/* ------------------------------------------------- archivio finto ---- */

const CAMPI_OPERATORE = [
  'status', 'assigneeId', 'operatorNotes', 'completedAt', 'completedById', 'updatedAt', 'updatedById',
] as const

interface Riga { tipo: string; id: string; dati: Record<string, unknown> | null; eliminato: boolean; aggiornato: number }
interface Account { id: string; email: string; nome: string; ruolo: string; company: string | null }

const admin = utente()
const ditta = utente({ id: 'u-pulizie-angela', name: 'Angela', email: 'angela@example.it', role: 'operator', companyId: 'angela' })

class ArchivioFinto {
  righe = new Map<string, Riga>()
  orologio = 1_000
  spinte: { chi: string; record: { tipo: string; id: string; dati?: Record<string, unknown>; eliminato?: boolean }[] }[] = []
  letture: number[] = []
  account: Account[] = [
    { id: admin.id, email: admin.email, nome: admin.name, ruolo: 'admin', company: null },
    { id: ditta.id, email: ditta.email, nome: ditta.name, ruolo: 'operator', company: 'angela' },
  ]

  metti(tipo: string, dati: Record<string, unknown> & { id: string }) {
    this.orologio += 10
    this.righe.set(`${tipo}:${dati.id}`, { tipo, id: dati.id, dati, eliminato: false, aggiornato: this.orologio })
  }

  pulizia(id: string) { return this.righe.get(`requests:${id}`)?.dati as Partial<CleaningRequest> | undefined }

  private chi(init?: RequestInit): Account | undefined {
    const auth = new Headers(init?.headers).get('authorization') ?? ''
    const id = auth.replace(/^Bearer /, '').split('.').slice(0, -2).join('.')
    return this.account.find((a) => a.id === id)
  }

  private caseDitta(company: string | null) {
    return new Set([...this.righe.values()]
      .filter((r) => r.tipo === 'apartments' && r.dati?.companyId === company)
      .map((r) => r.id))
  }

  fetch = async (url: string, init?: RequestInit): Promise<Response> => {
    const u = new URL(url, 'http://archivio.prova')
    const metodo = init?.method ?? 'GET'
    const json = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), { status })
    if (u.pathname === '/api/stato') return json({ ok: true })
    if (u.pathname === '/api/accesso') {
      const { identificativo } = JSON.parse(String(init?.body)) as { identificativo: string }
      const a = this.account.find((x) => x.email === identificativo || x.id === identificativo)
      if (!a) return json({ errore: 'Utente inesistente' }, 401)
      return json({
        gettone: `${a.id}.9999999999999.abcdef0123456789`,
        utente: { id: a.id, nome: a.nome, email: a.email, username: null, ruolo: a.ruolo },
      })
    }
    const chi = this.chi(init)
    if (!chi) return json({ errore: 'Accesso scaduto' }, 401)
    if (u.pathname === '/api/dati' && metodo === 'GET') {
      const da = Number(u.searchParams.get('da') ?? 0)
      this.letture.push(da)
      const case_ = this.caseDitta(chi.company)
      const record = [...this.righe.values()]
        .filter((r) => r.aggiornato > da)
        .filter((r) => chi.ruolo === 'admin' || chi.ruolo === 'host'
          || (r.tipo === 'requests' && case_.has(String(r.dati?.apartmentId)))
          || (r.tipo === 'apartments' && case_.has(r.id)))
        .map((r) => ({ ...r, dati: r.dati ? JSON.parse(JSON.stringify(r.dati)) : null }))
      return json({ record, adesso: this.orologio })
    }
    if (u.pathname === '/api/dati' && metodo === 'POST') {
      const { record } = JSON.parse(String(init?.body)) as ArchivioFinto['spinte'][number]
      this.spinte.push({ chi: chi.id, record })
      this.orologio += 10
      for (const r of record) {
        const chiave = `${r.tipo}:${r.id}`
        if (chi.ruolo === 'admin' || chi.ruolo === 'host') {
          this.righe.set(chiave, { tipo: r.tipo, id: r.id, dati: r.dati ?? null, eliminato: !!r.eliminato, aggiornato: this.orologio })
          continue
        }
        /* Come righeDellaDitta nel Worker: solo pulizie gia' nell'archivio,
           solo i campi della ditta, copiati sulla versione del server (che
           tiene il suo ordine dei campi). Campo assente = invariato, null =
           tolto. */
        const salvata = this.righe.get(chiave)
        if (r.tipo !== 'requests' || r.eliminato || !salvata?.dati) continue
        const unita = { ...salvata.dati }
        for (const campo of CAMPI_OPERATORE) {
          if (!r.dati || !Object.prototype.hasOwnProperty.call(r.dati, campo)) continue
          if (r.dati[campo] === null) delete unita[campo]
          else unita[campo] = r.dati[campo]
        }
        this.righe.set(chiave, { ...salvata, dati: unita, aggiornato: this.orologio })
      }
      return json({ scritti: record.length, adesso: this.orologio })
    }
    return json({ errore: 'Non trovato' }, 404)
  }

  /** Quante volte la pulizia e' partita verso l'archivio. */
  invii(id: string) {
    return this.spinte.flatMap((s) => s.record).filter((r) => r.tipo === 'requests' && r.id === id)
  }
}

/** La stessa riga con i campi in ordine inverso: stesso contenuto, altra impronta. */
const alRovescio = <T extends object>(x: T): T =>
  Object.fromEntries(Object.entries(x).reverse()) as T

let archivio: ArchivioFinto
let memoria: MemoriaFinta

async function caricaStore(chi: User | null, gettone = true) {
  vi.resetModules()
  if (chi && gettone) memoria.setItem('ppm-gettone', `${chi.id}.9999999999999.abcdef0123456789`)
  const modulo = await import('@/data/store')
  modulo.useStore.setState({
    users: [admin, ditta],
    apartments: [casa()],
    requests: [pulizia({ id: 'req-1' })],
    inspections: [], interventions: [], adminExpenses: [],
    removedIds: [],
    currentUserId: chi?.id ?? null,
    accessoId: chi?.id ?? null,
    sincronizzatoFino: 0,
  })
  return modulo
}

beforeEach(() => {
  memoria = new MemoriaFinta()
  archivio = new ArchivioFinto()
  vi.stubGlobal('localStorage', memoria)
  /* zustand persist legge `window.localStorage`. */
  vi.stubGlobal('window', { localStorage: memoria })
  vi.stubGlobal('fetch', archivio.fetch)
  archivio.metti('apartments', { ...casa() })
  /* Nell'archivio la pulizia ha i campi in un altro ordine: e' quello che
     succede quando il Worker copia sulla sua versione i campi della ditta. */
  archivio.metti('requests', alRovescio({ ...pulizia({ id: 'req-1' }) }) as unknown as CleaningRequest & Record<string, unknown>)
})

describe('scambio con l\'archivio', () => {
  it('una riga uguale ma con i campi in altro ordine non riparte a ogni giro', async () => {
    const { useStore } = await caricaStore(ditta)
    for (let i = 0; i < 4; i++) await useStore.getState().sincronizza()
    expect(useStore.getState().archivio.stato).toBe('collegato')
    expect(archivio.invii('req-1')).toHaveLength(0)
  })

  it('anche dopo una modifica: parte una volta e poi si ferma', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    useStore.getState().respondToRequest('req-1', 'accetta')
    for (let i = 0; i < 4; i++) await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')).toHaveLength(1)
    expect(archivio.pulizia('req-1')?.status).toBe('accettata')
    expect(useStore.getState().requests[0].status).toBe('accettata')
  })

  /* Sul telefono del manager la riga presa non deve ripartire subito: prima
     l'impronta annotata era quella della riga arrivata, non di quella tenuta. */
  it('il manager: stessa cosa con le righe intere', async () => {
    const { useStore } = await caricaStore(admin)
    for (let i = 0; i < 3; i++) await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')).toHaveLength(0)
  })
})

describe('telefono della ditta: partono solo i campi cambiati', () => {
  it('una nota non rimette lo stato che il manager ha cambiato nel frattempo', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    useStore.getState().respondToRequest('req-1', 'accetta')
    await useStore.getState().sincronizza()

    /* Il manager annulla la pulizia dal computer; il telefono non l'ha
       ancora saputo e la ditta scrive una nota. */
    const sulServer = archivio.pulizia('req-1')!
    archivio.metti('requests', { ...sulServer, id: 'req-1', status: 'cancellata', assigneeId: 'u-altro' })
    useStore.getState().setOperatorNotes('req-1', 'Chiavi nella cassetta')
    archivio.spinte = []
    await useStore.getState().sincronizza()

    const [inviata] = archivio.invii('req-1')
    expect(inviata.dati).toMatchObject({ id: 'req-1', operatorNotes: 'Chiavi nella cassetta' })
    expect(inviata.dati).not.toHaveProperty('status')
    expect(inviata.dati).not.toHaveProperty('assigneeId')
    expect(archivio.pulizia('req-1')).toMatchObject({ status: 'cancellata', assigneeId: 'u-altro', operatorNotes: 'Chiavi nella cassetta' })
    /* E al giro dopo il telefono prende lo stato del manager. */
    await useStore.getState().sincronizza()
    expect(useStore.getState().requests[0]).toMatchObject({ status: 'cancellata', assigneeId: 'u-altro' })
  })

  it('telefono che aveva gia\' scambiato senza copie: le copie si ricostruiscono', async () => {
    const primo = await caricaStore(ditta)
    await primo.useStore.getState().sincronizza()
    primo.useStore.getState().respondToRequest('req-1', 'accetta')
    await primo.useStore.getState().sincronizza()

    /* Come un telefono della versione di prima: impronte salvate, copie no. */
    memoria.removeItem('ppm-copie-ditta')
    vi.resetModules()
    const { useStore } = await import('@/data/store')
    expect(useStore.getState().requests[0].status).toBe('accettata')
    await useStore.getState().sincronizza()

    const sulServer = archivio.pulizia('req-1')!
    archivio.metti('requests', { ...sulServer, id: 'req-1', status: 'cancellata' })
    useStore.getState().setOperatorNotes('req-1', 'Nota')
    archivio.spinte = []
    await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')[0].dati).not.toHaveProperty('status')
    expect(archivio.pulizia('req-1')).toMatchObject({ status: 'cancellata', operatorNotes: 'Nota' })
  })

  it('un campo svuotato viaggia come null', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    useStore.getState().respondToRequest('req-1', 'accetta')
    useStore.getState().setOperatorNotes('req-1', 'Nota')
    await useStore.getState().sincronizza()
    expect(archivio.pulizia('req-1')?.operatorNotes).toBe('Nota')

    useStore.getState().setOperatorNotes('req-1', '')
    archivio.spinte = []
    await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')[0].dati).toMatchObject({ operatorNotes: null })
    expect(archivio.pulizia('req-1')).not.toHaveProperty('operatorNotes')
  })

  it('modificheDitta: senza copia partono i campi pieni, senza null', async () => {
    const { modificheDitta } = await caricaStore(null)
    const riga = { ...pulizia({ id: 'r', status: 'accettata', assigneeId: 'x' }) } as unknown as { id: string } & Record<string, unknown>
    expect(modificheDitta(riga, undefined)).toEqual({ id: 'r', status: 'accettata', assigneeId: 'x' })
    expect(modificheDitta(riga, { status: 'accettata', assigneeId: 'x' })).toBeNull()
    expect(modificheDitta(riga, { status: 'in_attesa', assigneeId: 'x', operatorNotes: 'n' }))
      .toEqual({ id: 'r', status: 'accettata', operatorNotes: null })
  })
})

describe('cambio di account sullo stesso telefono', () => {
  it('un altro account riparte da zero; lo stesso account che rientra no', async () => {
    const { useStore } = await caricaStore(null, false)
    expect((await useStore.getState().loginArchivio(ditta.email, 'password')).ok).toBe(true)
    await useStore.getState().sincronizza()
    const fino = useStore.getState().sincronizzatoFino
    expect(fino).toBeGreaterThan(0)
    expect(memoria.getItem('ppm-impronte')).not.toBeNull()
    expect(memoria.getItem('ppm-ultimo-account')).toBe(ditta.id)

    /* Stesso account (es. sessione scaduta): impronte e segnalibro restano. */
    useStore.getState().sessioneScaduta()
    expect((await useStore.getState().loginArchivio(ditta.email, 'password')).ok).toBe(true)
    expect(useStore.getState().sincronizzatoFino).toBe(fino)
    expect(memoria.getItem('ppm-impronte')).not.toBeNull()

    /* Un altro account: lo scambio riparte come su un telefono nuovo. */
    useStore.getState().logout()
    expect((await useStore.getState().loginArchivio(admin.email, 'password')).ok).toBe(true)
    expect(useStore.getState().sincronizzatoFino).toBe(0)
    expect(memoria.getItem('ppm-impronte')).toBeNull()
    expect(memoria.getItem('ppm-copie-ditta')).toBeNull()
    expect(memoria.getItem('ppm-ultimo-account')).toBe(admin.id)
    archivio.letture = []
    await useStore.getState().sincronizza()
    expect(archivio.letture[0]).toBe(0)
  })
})

describe('cambio di profilo dell\'amministratore', () => {
  it('passa a una ditta e torna indietro; la ditta non cambia profilo', async () => {
    const { useStore, accessoReale } = await caricaStore(admin)
    useStore.getState().switchUser(ditta.id)
    expect(useStore.getState().currentUserId).toBe(ditta.id)
    expect(accessoReale(useStore.getState())).toBe(admin.id)
    useStore.getState().switchUser(admin.id)
    expect(useStore.getState().currentUserId).toBe(admin.id)

    useStore.setState({ currentUserId: ditta.id, accessoId: ditta.id })
    useStore.getState().switchUser(admin.id)
    expect(useStore.getState().currentUserId).toBe(ditta.id)
  })

  it('nei panni di una ditta l\'amministratore manda righe intere', async () => {
    const { useStore } = await caricaStore(admin)
    await useStore.getState().sincronizza()
    useStore.getState().switchUser(ditta.id)
    useStore.getState().upsertRequest({ ...useStore.getState().requests[0], notes: 'dal manager' })
    archivio.spinte = []
    await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')[0].dati).toMatchObject({ apartmentId: 'ap-prova', notes: 'dal manager' })
  })
})
