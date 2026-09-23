/*
 * Il lato server di ProProManager: l'archivio condiviso.
 *
 * Fino a ieri ogni dispositivo teneva i dati per conto suo, e quello che il
 * manager scriveva dal computer non arrivava agli operatori. Qui c'e' il punto
 * di incontro: una tabella di righe con l'orario dell'ultima modifica. Ogni
 * dispositivo manda quello che ha cambiato e chiede cos'e' cambiato dopo
 * l'ultima volta che si e' fatto vivo.
 *
 * Tutto il resto del traffico - la pagina, gli script, le immagini - continua
 * a essere servito dagli asset statici.
 */

interface Env {
  DB?: D1Database
  ASSETS: Fetcher
  /** Firma dei gettoni di accesso. Si imposta con `wrangler secret put SYNC_SECRET`. */
  SYNC_SECRET?: string
}

/** Quanto dura un accesso prima di richiedere di nuovo la password. */
const DURATA_GETTONE = 30 * 24 * 60 * 60 * 1000

/** Aggiunto alla password prima di calcolarne l'impronta. */
const SALE = 'ppm-2026'

const TIPI = [
  'users', 'apartments', 'requests', 'inspections', 'interventions', 'adminExpenses',
] as const
type Tipo = (typeof TIPI)[number]

const json = (dati: unknown, status = 200) =>
  new Response(JSON.stringify(dati), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })

const bytes = (s: string) => new TextEncoder().encode(s)

async function impronta(testo: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', bytes(testo))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function chiave(segreto: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', bytes(segreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Gettone = "utente.scadenza.firma": senza la firma non si puo' fabbricare. */
async function creaGettone(utenteId: string, segreto: string): Promise<string> {
  const corpo = `${utenteId}.${Date.now() + DURATA_GETTONE}`
  const firma = await crypto.subtle.sign('HMAC', await chiave(segreto), bytes(corpo))
  const esa = [...new Uint8Array(firma)].map((b) => b.toString(16).padStart(2, '0')).join('')
  return `${corpo}.${esa}`
}

async function leggiGettone(gettone: string | null, segreto: string): Promise<string | null> {
  if (!gettone) return null
  const pezzi = gettone.split('.')
  if (pezzi.length !== 3) return null
  const [utenteId, scadenza, esa] = pezzi
  if (!/^\d+$/.test(scadenza) || Number(scadenza) < Date.now()) return null
  const firma = Uint8Array.from(esa.match(/.{1,2}/g) ?? [], (h) => parseInt(h, 16))
  const valida = await crypto.subtle.verify('HMAC', await chiave(segreto), firma, bytes(`${utenteId}.${scadenza}`))
  return valida ? utenteId : null
}

const gettoneDallaRichiesta = (req: Request) =>
  req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null

/* ------------------------------------------------------------- accesso ---- */

async function accesso(req: Request, env: Env, segreto: string): Promise<Response> {
  const corpo = await req.json<{ identificativo?: string; password?: string }>()
    .catch(() => ({} as { identificativo?: string; password?: string }))
  const id = (corpo.identificativo ?? '').trim().toLowerCase()
  const password = corpo.password ?? ''
  if (!id || !password) return json({ errore: 'Servono nome utente e password' }, 400)

  const riga = await env.DB!
    .prepare('SELECT id, email, username, password_hash, ruolo, nome FROM utente WHERE lower(email) = ?1 OR lower(username) = ?1')
    .bind(id)
    .first<{ id: string; email: string; username: string | null; password_hash: string; ruolo: string; nome: string }>()

  if (!riga) return json({ errore: 'Nessun utente trovato per questa email o nome utente' }, 401)
  if (await impronta(SALE + password) !== riga.password_hash) {
    return json({ errore: 'Password errata fornita per questo utente' }, 401)
  }

  return json({
    gettone: await creaGettone(riga.id, segreto),
    utente: { id: riga.id, nome: riga.nome, email: riga.email, username: riga.username, ruolo: riga.ruolo },
  })
}

/* ---------------------------------------------------------------- dati ---- */

interface RigaSync {
  tipo: string
  id: string
  dati?: unknown
  eliminato?: boolean
}

async function leggiDati(req: Request, env: Env): Promise<Response> {
  const da = Number(new URL(req.url).searchParams.get('da') ?? 0)
  const esito = await env.DB!
    .prepare('SELECT tipo, id, dati, eliminato, aggiornato FROM record WHERE aggiornato > ?1 ORDER BY aggiornato ASC LIMIT 5000')
    .bind(Number.isFinite(da) ? da : 0)
    .all<{ tipo: string; id: string; dati: string | null; eliminato: number; aggiornato: number }>()

  const record = (esito.results ?? []).map((r) => ({
    tipo: r.tipo,
    id: r.id,
    eliminato: r.eliminato === 1,
    aggiornato: r.aggiornato,
    dati: r.dati ? JSON.parse(r.dati) : null,
  }))
  /* L'orologio e' quello del server: se ogni dispositivo usasse il proprio,
     bastarebbero pochi secondi di sfasamento per perdere delle modifiche. */
  const adesso = record.length ? record[record.length - 1].aggiornato : Date.now()
  return json({ record, adesso })
}

async function scriviDati(req: Request, env: Env): Promise<Response> {
  const corpo = await req.json<{ record?: RigaSync[] }>()
    .catch(() => ({} as { record?: RigaSync[] }))
  const righe = (corpo.record ?? []).filter((r) => r && TIPI.includes(r.tipo as Tipo) && typeof r.id === 'string')
  if (righe.length === 0) return json({ scritti: 0, adesso: Date.now() })
  if (righe.length > 2000) return json({ errore: 'Troppe righe in una volta sola' }, 413)

  const adesso = Date.now()
  const stmt = env.DB!.prepare(
    `INSERT INTO record (tipo, id, dati, eliminato, aggiornato) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (tipo, id) DO UPDATE SET dati = ?3, eliminato = ?4, aggiornato = ?5`,
  )
  await env.DB!.batch(
    righe.map((r) => stmt.bind(r.tipo, r.id, r.eliminato ? null : JSON.stringify(r.dati), r.eliminato ? 1 : 0, adesso)),
  )
  return json({ scritti: righe.length, adesso })
}

/* -------------------------------------------------- preparazione ---- */

/**
 * Le impronte delle password degli accessi di partenza. Sono gia' quelle in
 * uso nell'app - "propromanager" per il manager, le password lunghe per le
 * ditte - salvate come impronta, mai in chiaro.
 */
const ACCESSI_INIZIALI: [string, string, string | null, string, string, string][] = [
  ['u-admin', 'm2ab.srl@gmail.com', null,
    'f0ef41d929da406ca215396b37ac6998c4a5c209ce37c2275c773795b3b6824e', 'admin', 'ProProManager'],
  ['u-pulizie-angela', 'angela@propromanager.it', 'Angela',
    '0d4caf2c36bd87799d0e49b82f2efc5a9e45cbcccb941e02df51f5e9aad146fc', 'operator', 'Angela'],
]

/*
 * Accessi revocati. Toglierli dall'elenco qui sopra non basta: nell'archivio
 * la riga resterebbe e quella persona continuerebbe a entrare. Vanno tolti
 * per davvero, a ogni avvio, cosi' la revoca vale su tutti i dispositivi.
 * Si cancella solo la riga dell'accesso: le case, le pulizie e tutto il
 * resto restano dove sono.
 */
const ACCESSI_REVOCATI = ['u-pulizie-comfy']

/* Fatto una volta per ogni istanza del Worker: non si ripete a ogni richiesta. */
let tabellePronte = false

/**
 * Crea le tabelle e gli accessi se non ci sono gia'. Cosi' basta collegare il
 * database: l'archivio si prepara da solo alla prima richiesta, senza dover
 * incollare comandi a mano. Le istruzioni sono tutte "se non esiste", quindi
 * rifarle non cancella niente.
 */
async function preparaArchivio(db: D1Database): Promise<void> {
  if (tabellePronte) return
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS utente (
      id TEXT PRIMARY KEY, email TEXT NOT NULL, username TEXT,
      password_hash TEXT NOT NULL, ruolo TEXT NOT NULL, nome TEXT NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS record (
      tipo TEXT NOT NULL, id TEXT NOT NULL, dati TEXT,
      eliminato INTEGER NOT NULL DEFAULT 0, aggiornato INTEGER NOT NULL,
      PRIMARY KEY (tipo, id))`),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_record_aggiornato ON record (aggiornato)'),
    ...ACCESSI_INIZIALI.map((r) =>
      db.prepare(`INSERT OR IGNORE INTO utente
        (id, email, username, password_hash, ruolo, nome) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`).bind(...r)),
    ...ACCESSI_REVOCATI.map((id) => db.prepare('DELETE FROM utente WHERE id = ?1').bind(id)),
  ])
  tabellePronte = true
}

/* --------------------------------------------------------------- avvio ---- */

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url)
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req)

    if (!env.DB) {
      /* Il database non e' ancora collegato: l'app continua a funzionare in
         locale, e lo dice invece di fingere che sia tutto a posto. */
      return json({ errore: 'Archivio condiviso non collegato' }, 503)
    }
    const segreto = env.SYNC_SECRET ?? 'propromanager-archivio'

    try {
      /* L'archivio si prepara da solo: chi collega il database non deve poi
         creare tabelle e accessi a mano. */
      await preparaArchivio(env.DB)
      if (url.pathname === '/api/stato') return json({ ok: true })
      if (url.pathname === '/api/accesso' && req.method === 'POST') return accesso(req, env, segreto)

      const utenteId = await leggiGettone(gettoneDallaRichiesta(req), segreto)
      if (!utenteId) return json({ errore: 'Accesso scaduto: rientra con la password' }, 401)

      if (url.pathname === '/api/dati' && req.method === 'GET') return leggiDati(req, env)
      if (url.pathname === '/api/dati' && req.method === 'POST') return scriviDati(req, env)
      return json({ errore: 'Non trovato' }, 404)
    } catch (e) {
      return json({ errore: `Archivio non raggiungibile: ${String(e).slice(0, 200)}` }, 500)
    }
  },
}
