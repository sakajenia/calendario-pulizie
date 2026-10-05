/*
 * Lo scambio con l'archivio condiviso, visto dallo store: un archivio finto
 * al posto del Worker (stesse regole per le ditte) e lo store vero.
 *
 * Ogni test ricarica i moduli: le impronte e le copie della ditta vivono nel
 * modulo dello store, e devono ripartire pulite.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CleaningRequest, User } from '@/types'
import * as seed from '@/data/seed'
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
const CAMPI_SVUOTABILI: readonly string[] = ['operatorNotes', 'assigneeId', 'completedAt', 'completedById']
const PASSAGGI_OPERATORE: Record<string, readonly string[]> = {
  in_attesa: ['accettata', 'cancellata'],
  accettata: ['in_corso', 'completata', 'in_attesa'],
  in_corso: ['completata', 'accettata'],
  completata: ['accettata', 'in_corso'],
  cancellata: ['in_attesa'],
}
const CAMPI_RICHIESTI: readonly string[] = ['apartmentId', 'checkOutAt', 'checkInAt']

interface Riga { tipo: string; id: string; dati: Record<string, unknown> | null; eliminato: boolean; aggiornato: number }
interface Account { id: string; email: string; nome: string; ruolo: string; company: string | null }

const admin = utente()
const ditta = utente({ id: 'u-pulizie-angela', name: 'Angela', email: 'angela@example.it', role: 'operator', companyId: 'angela' })

class ArchivioFinto {
  righe = new Map<string, Riga>()
  orologio = 1_000
  spinte: { chi: string; record: { tipo: string; id: string; dati?: Record<string, unknown>; eliminato?: boolean }[] }[] = []
  letture: number[] = []
  /** Come un Worker di prima: niente `rifiutate` nella risposta. */
  senzaRifiutate = false
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
          || (r.tipo === 'apartments' && case_.has(r.id))
          || (r.tipo === 'users' && r.id === chi.id))
        .map((r) => ({ ...r, dati: r.dati ? JSON.parse(JSON.stringify(r.dati)) : null }))
      return json({ record, adesso: this.orologio })
    }
    if (u.pathname === '/api/dati' && metodo === 'POST') {
      const { record } = JSON.parse(String(init?.body)) as ArchivioFinto['spinte'][number]
      this.spinte.push({ chi: chi.id, record })
      this.orologio += 10
      /* Come `rifiutate` nel Worker: le righe saltate (o scritte diverse da
         come sono arrivate) tornano con la copia del server. */
      const rifiutate: Riga[] = []
      const copia = (r: Riga) => ({ ...r, dati: r.dati ? JSON.parse(JSON.stringify(r.dati)) : null })
      for (const r of record) {
        const chiave = `${r.tipo}:${r.id}`
        const salvata = this.righe.get(chiave)
        if (chi.ruolo === 'admin' || chi.ruolo === 'host') {
          /* Come righeDelManager: una pulizia a pezzi si unisce alla copia
             del server invece di prenderne il posto. */
          const aPezzi = r.tipo === 'requests' && !r.eliminato && !!r.dati
            && (typeof r.dati.apartmentId !== 'string' || typeof r.dati.checkOutAt !== 'string')
          if (aPezzi) {
            if (!salvata) continue
            if (!salvata.dati) { rifiutate.push(copia(salvata)); continue }
            const unita = { ...salvata.dati }
            for (const [campo, valore] of Object.entries(r.dati!)) {
              if (campo === 'id') continue
              if (valore === null) { if (!CAMPI_RICHIESTI.includes(campo) && campo !== 'status') delete unita[campo] }
              else unita[campo] = valore
            }
            const scritta = { ...salvata, dati: unita, aggiornato: this.orologio }
            this.righe.set(chiave, scritta)
            rifiutate.push(copia(scritta))
            continue
          }
          this.righe.set(chiave, { tipo: r.tipo, id: r.id, dati: r.dati ?? null, eliminato: !!r.eliminato, aggiornato: this.orologio })
          continue
        }
        /* Come righeDellaDitta nel Worker: solo pulizie gia' nell'archivio,
           solo i campi della ditta, copiati sulla versione del server (che
           tiene il suo ordine dei campi). Campo assente = invariato, null =
           tolto (solo quelli svuotabili). Un cambio di stato non permesso
           fa tornare indietro la riga. */
        if (r.tipo !== 'requests' || r.eliminato || !salvata?.dati) continue
        const nuovo = r.dati?.status
        const prima = salvata.dati.status as string
        if (nuovo !== undefined && nuovo !== null && nuovo !== prima) {
          const permesso = (PASSAGGI_OPERATORE[prima] ?? []).includes(nuovo as string)
            && !(prima === 'cancellata' && salvata.dati.annullataDaCalendario)
          if (!permesso) { rifiutate.push(copia(salvata)); continue }
        }
        const unita = { ...salvata.dati }
        for (const campo of CAMPI_OPERATORE) {
          if (!r.dati || !Object.prototype.hasOwnProperty.call(r.dati, campo)) continue
          if (r.dati[campo] === null) { if (CAMPI_SVUOTABILI.includes(campo)) delete unita[campo] }
          else unita[campo] = r.dati[campo]
        }
        this.righe.set(chiave, { ...salvata, dati: unita, aggiornato: this.orologio })
      }
      return json({ scritti: record.length, adesso: this.orologio, ...(this.senzaRifiutate ? {} : { rifiutate }) })
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

describe('righe rimandate indietro dall\'archivio (rifiutate)', () => {
  /* L'"Annulla" del rifiuto, quando nel frattempo la prenotazione e' sparita
     e il calendario ha annullato la pulizia: la ditta non la puo' riaprire.
     Prima il telefono segnava come mandata la sua versione (in attesa) e
     restava diverso dall'archivio per sempre. */
  it('un passaggio rifiutato: il telefono prende la copia del server e non la rimanda', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    const prima = useStore.getState().requests[0]
    useStore.getState().respondToRequest('req-1', 'rifiuta')
    await useStore.getState().sincronizza()
    expect(archivio.pulizia('req-1')?.status).toBe('cancellata')

    archivio.metti('requests', { ...archivio.pulizia('req-1')!, id: 'req-1', annullataDaCalendario: true })
    await useStore.getState().sincronizza()
    useStore.getState().upsertRequest(prima)
    expect(useStore.getState().requests[0].status).toBe('in_attesa')

    archivio.spinte = []
    for (let i = 0; i < 3; i++) await useStore.getState().sincronizza()
    expect(archivio.invii('req-1')).toHaveLength(1)
    expect(archivio.pulizia('req-1')).toMatchObject({ status: 'cancellata', annullataDaCalendario: true })
    expect(useStore.getState().requests[0]).toMatchObject({ status: 'cancellata', annullataDaCalendario: true })
    /* Anche la base dei campi della ditta e' quella del server. */
    const copie = JSON.parse(memoria.getItem('ppm-copie-ditta')!) as Record<string, { status?: string }>
    expect(copie['req-1'].status).toBe('cancellata')
  })

  it('l\'"Annulla" del rifiuto e della chiusura arrivano all\'archivio', async () => {
    archivio.metti('requests', { ...pulizia({ id: 'req-1', status: 'in_corso', assigneeId: ditta.id }) })
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    expect(useStore.getState().requests[0].status).toBe('in_corso')

    const inCorso = useStore.getState().requests[0]
    useStore.getState().completeRequest('req-1')
    await useStore.getState().sincronizza()
    expect(archivio.pulizia('req-1')).toMatchObject({ status: 'completata', completedById: ditta.id })
    useStore.getState().upsertRequest(inCorso)
    for (let i = 0; i < 2; i++) await useStore.getState().sincronizza()
    expect(archivio.pulizia('req-1')?.status).toBe('in_corso')
    expect(archivio.pulizia('req-1')).not.toHaveProperty('completedAt')
    expect(archivio.pulizia('req-1')).not.toHaveProperty('completedById')
    expect(useStore.getState().requests[0].status).toBe('in_corso')
  })

  it('un Worker di prima (senza `rifiutate`): il telefono fa come prima', async () => {
    archivio.senzaRifiutate = true
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    const prima = useStore.getState().requests[0]
    useStore.getState().respondToRequest('req-1', 'rifiuta')
    await useStore.getState().sincronizza()
    archivio.metti('requests', { ...archivio.pulizia('req-1')!, id: 'req-1', annullataDaCalendario: true })
    await useStore.getState().sincronizza()
    useStore.getState().upsertRequest(prima)
    archivio.spinte = []
    for (let i = 0; i < 3; i++) await useStore.getState().sincronizza()
    expect(useStore.getState().archivio.stato).toBe('collegato')
    expect(archivio.invii('req-1')).toHaveLength(1)
  })
})

describe('account promosso sul server, telefono rimasto da ditta', () => {
  /* Il telefono manda la pulizia a pezzi (crede di essere una ditta), il
     gettone pero' e' ormai da manager: la riga si unisce a quella del
     server invece di prenderne il posto. */
  it('la pulizia a pezzi non cancella casa, orari e il resto', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    archivio.account.find((a) => a.id === ditta.id)!.ruolo = 'admin'
    useStore.getState().respondToRequest('req-1', 'accetta')
    archivio.spinte = []
    await useStore.getState().sincronizza()

    const [inviata] = archivio.invii('req-1')
    expect(inviata.dati).not.toHaveProperty('apartmentId')
    expect(archivio.pulizia('req-1')).toMatchObject({
      status: 'accettata', assigneeId: ditta.id, apartmentId: 'ap-prova',
      checkOutAt: pulizia().checkOutAt, checkInAt: pulizia().checkInAt,
    })
    await useStore.getState().sincronizza()
    expect(useStore.getState().requests[0]).toMatchObject({ status: 'accettata', apartmentId: 'ap-prova' })
  })
})

describe('la ditta dell\'account cambia sul server', () => {
  it('lo scambio riparte da zero, come su un telefono nuovo', async () => {
    const { useStore } = await caricaStore(ditta)
    await useStore.getState().sincronizza()
    await useStore.getState().sincronizza()
    expect(useStore.getState().sincronizzatoFino).toBeGreaterThan(0)

    archivio.account.find((a) => a.id === ditta.id)!.company = 'altra'
    archivio.metti('users', { ...ditta, companyId: 'altra' })
    await useStore.getState().sincronizza()
    expect(useStore.getState().users.find((u) => u.id === ditta.id)?.companyId).toBe('altra')
    expect(useStore.getState().sincronizzatoFino).toBe(0)
    expect(memoria.getItem('ppm-impronte')).toBeNull()

    archivio.letture = []
    await useStore.getState().sincronizza()
    expect(archivio.letture[0]).toBe(0)
  })
})

describe('correzione di settembre (versione 16)', () => {
  const rif = seed.requests.find((r) => r.status === 'in_attesa' && !r.updatedAt && !r.updatedById && !r.completedAt)!
  const unMeseDopo = (iso: string) => {
    const d = new Date(iso)
    d.setMonth(d.getMonth() + 1)
    return d.toISOString()
  }
  const ottobre = { ...rif, checkOutAt: unMeseDopo(rif.checkOutAt), checkInAt: unMeseDopo(rif.checkInAt) }

  /** Un telefono rimasto alla versione 15 con la pulizia del seme finita a ottobre. */
  async function apriVersione15(impronte: Record<string, string> | null) {
    memoria.setItem('propromanager-state', JSON.stringify({
      version: 15,
      state: {
        currentUserId: admin.id, accessoId: admin.id,
        users: seed.users, apartments: seed.apartments,
        requests: [ottobre, ...seed.requests.filter((r) => r.id !== rif.id)],
        inspections: [], interventions: [], adminExpenses: [],
        removedIds: [], seedIds: seed.SEED_IDS, sincronizzatoFino: impronte ? 5_000 : 0,
      },
    }))
    if (impronte) memoria.setItem('ppm-impronte', JSON.stringify(impronte))
    vi.resetModules()
    return import('@/data/store')
  }

  it('una riga mai scambiata con l\'archivio torna a settembre', async () => {
    const { useStore } = await apriVersione15(null)
    expect(seed.nelMeseDelPiano(ottobre.checkOutAt)).toBe(false)
    expect(useStore.getState().requests.find((r) => r.id === rif.id)?.checkOutAt).toBe(rif.checkOutAt)
  })

  /* Gia' scambiata: e' la copia dell'archivio (magari spostata dal manager)
     o una copia indietro che il prossimo giro aggiorna. Correggerla la
     faceva ripartire sopra il lavoro degli altri. */
  it('una riga gia\' scambiata resta com\'e\', anche all\'allineamento di avvio', async () => {
    const { useStore } = await apriVersione15({ [`requests:${rif.id}`]: 'impronta-di-prima' })
    expect(useStore.getState().requests.find((r) => r.id === rif.id)?.checkOutAt).toBe(ottobre.checkOutAt)
    useStore.getState().ensureRecurringInspections()
    expect(useStore.getState().requests.find((r) => r.id === rif.id)?.checkOutAt).toBe(ottobre.checkOutAt)
  })
})
