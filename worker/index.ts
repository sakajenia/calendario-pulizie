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

/**
 * Le schede utente viaggiano tra i telefoni, la password no: nell'archivio
 * dati la leggerebbe chiunque abbia accesso, ditte comprese. Le password vere
 * stanno solo nella tabella utente, come impronta.
 */
function senzaPassword(tipo: string, dati: unknown): unknown {
  if (tipo !== 'users' || !dati || typeof dati !== 'object') return dati
  const { password: _tolta, ...resto } = dati as Record<string, unknown>
  return resto
}

/** Righe al massimo per ogni richiesta di lettura. */
const LIMITE_LETTURA = 5000

/**
 * Margine di sicurezza sul segnalibro. Due scritture partite quasi insieme
 * possono finire nell'archivio in ordine diverso da quello del loro orario:
 * quella con l'orario piu' vecchio arriva per ultima. Se il segnalibro
 * corresse fino all'ultimo istante, quella riga resterebbe indietro per
 * sempre. Restando qualche secondo indietro la si rilegge al giro dopo:
 * una riga arrivata due volte non fa danni, una riga persa si'.
 */
const MARGINE_LETTURA = 5000

type RigaArchivio = { tipo: string; id: string; dati: string | null; eliminato: number; aggiornato: number }

async function leggiDati(req: Request, env: Env): Promise<Response> {
  const richiesto = Number(new URL(req.url).searchParams.get('da') ?? 0)
  const da = Number.isFinite(richiesto) ? richiesto : 0
  const esito = await env.DB!
    .prepare('SELECT tipo, id, dati, eliminato, aggiornato FROM record WHERE aggiornato > ?1 ORDER BY aggiornato ASC LIMIT ?2')
    .bind(da, LIMITE_LETTURA)
    .all<RigaArchivio>()
  let righe = esito.results ?? []

  /* Se il limite taglia a meta' un gruppo di righe scritte nello stesso
     istante, la parte rimasta fuori non arriverebbe mai: il giro dopo chiede
     solo cio' che e' "dopo" quell'istante. Quindi l'ultimo gruppo, se
     incompleto, si lascia tutto per il giro successivo. */
  if (righe.length >= LIMITE_LETTURA) {
    const ultimo = righe[righe.length - 1].aggiornato
    const complete = righe.filter((r) => r.aggiornato < ultimo)
    if (complete.length > 0) {
      righe = complete
    } else {
      /* Tutta la pagina ha lo stesso orario: non si puo' lasciarla indietro
         o non si andrebbe mai avanti. Si prende quel gruppo intero. */
      const gruppo = await env.DB!
        .prepare('SELECT tipo, id, dati, eliminato, aggiornato FROM record WHERE aggiornato = ?1')
        .bind(ultimo)
        .all<RigaArchivio>()
      righe = gruppo.results ?? []
    }
  }

  const record = righe.map((r) => ({
    tipo: r.tipo,
    id: r.id,
    eliminato: r.eliminato === 1,
    aggiornato: r.aggiornato,
    dati: r.dati ? senzaPassword(r.tipo, JSON.parse(r.dati)) : null,
  }))
  /* L'orologio e' quello del server: se ogni dispositivo usasse il proprio,
     bastarebbero pochi secondi di sfasamento per perdere delle modifiche.
     Il segnalibro non va mai oltre l'ultima riga letta davvero (se non e'
     arrivato niente resta dov'era) ne' oltre "adesso meno il margine". */
  const letto = record.length ? record[record.length - 1].aggiornato : da
  const adesso = Math.min(letto, Date.now() - MARGINE_LETTURA)
  return json({ record, adesso })
}

/**
 * I soli campi di una pulizia che una ditta puo' cambiare: lo stato, a chi e'
 * assegnata, le sue note e chi l'ha chiusa. Il resto (casa, date, prezzi...)
 * lo decide il manager.
 */
const CAMPI_OPERATORE = [
  'status', 'assigneeId', 'operatorNotes', 'completedAt', 'completedById', 'updatedAt', 'updatedById',
] as const

/**
 * Le pulizie che una ditta puo' toccare: solo quelle che esistono gia'
 * nell'archivio, e di ognuna solo i campi qui sopra, copiati sulla versione
 * del server. Il resto si scarta in silenzio: un telefono con dati vecchi non
 * deve far fallire l'intero invio.
 */
async function righeDellaDitta(env: Env, righe: RigaSync[]): Promise<RigaSync[]> {
  const pulizie = righe.filter((r) => r.tipo === 'requests' && !r.eliminato && r.dati && typeof r.dati === 'object')
  if (pulizie.length === 0) return []
  const esito = await env.DB!
    .prepare(`SELECT id, dati FROM record WHERE tipo = 'requests' AND eliminato = 0 AND dati IS NOT NULL
      AND id IN (SELECT value FROM json_each(?1))`)
    .bind(JSON.stringify(pulizie.map((r) => r.id)))
    .all<{ id: string; dati: string }>()
  const sulServer = new Map((esito.results ?? []).map((r) => [r.id, r.dati]))

  const pronte: RigaSync[] = []
  for (const r of pulizie) {
    const salvata = sulServer.get(r.id)
    if (!salvata) continue // pulizia nuova o cancellata: non tocca alla ditta
    const unita = JSON.parse(salvata) as Record<string, unknown>
    const arrivati = r.dati as Record<string, unknown>
    for (const campo of CAMPI_OPERATORE) {
      if (Object.prototype.hasOwnProperty.call(arrivati, campo)) unita[campo] = arrivati[campo]
    }
    pronte.push({ tipo: r.tipo, id: r.id, dati: unita, eliminato: false })
  }
  return pronte
}

async function scriviDati(req: Request, env: Env, ruolo: string): Promise<Response> {
  const corpo = await req.json<{ record?: RigaSync[] }>()
    .catch(() => ({} as { record?: RigaSync[] }))
  const valide = (corpo.record ?? []).filter((r) => r && TIPI.includes(r.tipo as Tipo) && typeof r.id === 'string')
  if (valide.length > 2000) return json({ errore: 'Troppe righe in una volta sola' }, 413)

  /* Chi puo' scrivere cosa. L'amministratore tutto. Il manager tutto tranne
     le schede utente, altrimenti potrebbe cambiarsi il ruolo da solo. Le ditte
     (e ogni ruolo sconosciuto) solo le pulizie gia' esistenti, e solo i loro
     campi. Le righe non permesse si saltano senza bloccare le altre. */
  const righe = ruolo === 'admin' ? valide
    : ruolo === 'host' ? valide.filter((r) => r.tipo !== 'users')
    : await righeDellaDitta(env, valide)
  if (righe.length === 0) return json({ scritti: 0, adesso: Date.now() })

  const adesso = Date.now()
  const stmt = env.DB!.prepare(
    `INSERT INTO record (tipo, id, dati, eliminato, aggiornato) VALUES (?1, ?2, ?3, ?4, ?5)
     ON CONFLICT (tipo, id) DO UPDATE SET dati = ?3, eliminato = ?4, aggiornato = ?5`,
  )
  await env.DB!.batch(
    righe.map((r) => stmt.bind(
      r.tipo, r.id, r.eliminato ? null : JSON.stringify(senzaPassword(r.tipo, r.dati)), r.eliminato ? 1 : 0, adesso,
    )),
  )
  return json({ scritti: righe.length, adesso })
}

/* --------------------------------------------- calendari prenotazioni ---- */

/**
 * Scarica il calendario iCal di una casa (Airbnb, Booking, Vrbo...). Il
 * browser non puo' farlo da solo: quei siti non lo permettono da un'altra
 * pagina. Solo i manager, solo https, e solo file di calendario.
 */
async function scaricaCalendario(req: Request, ruolo: string): Promise<Response> {
  if (ruolo !== 'admin' && ruolo !== 'host') return json({ errore: 'Solo i manager' }, 403)

  let indirizzo: URL
  try {
    indirizzo = new URL(new URL(req.url).searchParams.get('url') ?? '')
  } catch {
    return json({ errore: 'Link del calendario non valido' }, 400)
  }
  if (indirizzo.protocol !== 'https:') return json({ errore: 'Il link deve iniziare con https://' }, 400)

  const risposta = await fetch(indirizzo.toString(), {
    headers: { accept: 'text/calendar, text/plain;q=0.8' },
    redirect: 'follow',
  }).catch(() => null)
  if (!risposta?.ok) return json({ errore: `Calendario non raggiungibile (${risposta?.status ?? 'rete'})` }, 502)
  const testo = (await risposta.text()).slice(0, 2_000_000)
  if (!testo.includes('BEGIN:VCALENDAR')) return json({ errore: 'Il link non e\' un calendario iCal' }, 422)
  return json({ ics: testo })
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
let segretoArchivio: string | null = null

const casuale = () => [...crypto.getRandomValues(new Uint8Array(32))]
  .map((b) => b.toString(16).padStart(2, '0')).join('')

/**
 * La chiave che firma gli accessi. Prima, senza SYNC_SECRET, si usava una
 * frase scritta nel codice: chi la leggeva poteva fabbricarsi un accesso.
 * Ora o la si imposta su Cloudflare, o vale quella casuale del database,
 * che non esce mai da li'.
 */
async function segretoDi(env: Env): Promise<string> {
  if (env.SYNC_SECRET) return env.SYNC_SECRET
  if (segretoArchivio) return segretoArchivio
  const riga = await env.DB!.prepare("SELECT valore FROM config WHERE chiave = 'segreto'").first<{ valore: string }>()
  if (!riga?.valore) throw new Error('chiave di firma mancante')
  segretoArchivio = riga.valore
  return segretoArchivio
}

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
    db.prepare('CREATE TABLE IF NOT EXISTS config (chiave TEXT PRIMARY KEY, valore TEXT NOT NULL)'),
    /* Una chiave casuale creata la prima volta e tenuta nel database: vale
       quando su Cloudflare non e' impostato SYNC_SECRET. */
    db.prepare("INSERT OR IGNORE INTO config (chiave, valore) VALUES ('segreto', ?1)").bind(casuale()),
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
    try {
      /* L'archivio si prepara da solo: chi collega il database non deve poi
         creare tabelle e accessi a mano. */
      await preparaArchivio(env.DB)
      const segreto = await segretoDi(env)
      if (url.pathname === '/api/stato') return json({ ok: true })
      if (url.pathname === '/api/accesso' && req.method === 'POST') return accesso(req, env, segreto)

      const utenteId = await leggiGettone(gettoneDallaRichiesta(req), segreto)
      if (!utenteId) return json({ errore: 'Accesso scaduto: rientra con la password' }, 401)

      /* Il gettone resta valido per un mese anche se nel frattempo l'accesso
         e' stato revocato: per questo a ogni richiesta si controlla che la
         persona ci sia ancora, e con quale ruolo. */
      const chi = await env.DB.prepare('SELECT ruolo FROM utente WHERE id = ?1').bind(utenteId).first<{ ruolo: string }>()
      if (!chi) return json({ errore: 'Accesso revocato: chiedi al manager' }, 401)

      if (url.pathname === '/api/dati' && req.method === 'GET') return leggiDati(req, env)
      if (url.pathname === '/api/dati' && req.method === 'POST') return scriviDati(req, env, chi.ruolo)
      if (url.pathname === '/api/calendario' && req.method === 'GET') return scaricaCalendario(req, chi.ruolo)
      return json({ errore: 'Non trovato' }, 404)
    } catch (e) {
      return json({ errore: `Archivio non raggiungibile: ${String(e).slice(0, 200)}` }, 500)
    }
  },
}
