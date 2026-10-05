/*
 * Sicurezza dell'archivio, direttamente contro il Worker (senza browser):
 * niente password nel codice servito, ruoli rispettati, gettoni falsi
 * rifiutati, calendario solo per i manager e solo https.
 */
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ADMIN, ANGELA, assert, gettoneApi, leggiArchivio, preparaArchivio } from './lib.mjs'

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

const conGettone = (gettone, extra = {}) => ({
  ...extra,
  headers: { 'content-type': 'application/json', authorization: `Bearer ${gettone}`, ...(extra.headers ?? {}) },
})

/** Gettone "utente.scadenza.firma" firmato con una chiave a scelta (come fa il Worker). */
function gettoneFirmato(utenteId, chiave) {
  const corpo = `${utenteId}.${Date.now() + 24 * 60 * 60 * 1000}`
  const firma = crypto.createHmac('sha256', chiave).update(corpo).digest('hex')
  return `${corpo}.${firma}`
}

export default async function (t) {
  const { base } = t

  await t.check('il JavaScript servito (dist/assets) non contiene password in chiaro', async () => {
    const cartella = path.join(RADICE, 'dist', 'assets')
    const file = fs.readdirSync(cartella).filter((f) => f.endsWith('.js'))
    assert(file.length > 0, 'nessun file .js in dist/assets')
    for (const f of file) {
      const testo = fs.readFileSync(path.join(cartella, f), 'utf8')
      assert(!testo.includes(ANGELA.password), `${f}: contiene la password di Angela`)
      /* "propromanager" compare legittimamente in chiavi e nomi
         (propromanager-state, logo-propromanager.png): la password e' la
         parola da sola fra virgolette. */
      assert(!/["'`]propromanager["'`]/.test(testo), `${f}: contiene la password del manager fra virgolette`)
      const conPassword = testo.match(/password\s*:\s*["'`][^"'`]+["'`]/g) ?? []
      assert(conPassword.length === 0, `${f}: password scritte nel codice: ${conPassword.slice(0, 3).join(', ')}`)
    }
  })

  await preparaArchivio(t)
  const admin = await gettoneApi(base, ADMIN)
  const angela = await gettoneApi(base, ANGELA)

  await t.check('il gettone di Angela non puo\' scrivere una scheda utente (scritti 0)', async () => {
    const r = await fetch(`${base}/api/dati`, conGettone(angela, {
      method: 'POST',
      body: JSON.stringify({
        record: [{
          tipo: 'users', id: ANGELA.userId,
          dati: { id: ANGELA.userId, name: 'Angela', email: 'angela@propromanager.it', role: 'admin', active: true, createdAt: new Date().toISOString() },
        }],
      }),
    }))
    const corpo = await r.json()
    assert(r.status === 200, `stato ${r.status}`)
    assert(corpo.scritti === 0, `scritti: ${corpo.scritti}`)
    const riga = (await leggiArchivio(base, admin)).find((x) => x.tipo === 'users' && x.id === ANGELA.userId)
    assert(riga?.dati?.role !== 'admin', 'nell\'archivio Angela e\' diventata admin')
  })

  await t.check('il gettone di Angela non puo\' creare pulizie nuove (scritti 0)', async () => {
    const r = await fetch(`${base}/api/dati`, conGettone(angela, {
      method: 'POST',
      body: JSON.stringify({ record: [{ tipo: 'requests', id: 'req-e2e-intrusa', dati: { id: 'req-e2e-intrusa', apartmentId: 'ap-marsi', status: 'in_attesa' } }] }),
    }))
    assert((await r.json()).scritti === 0, 'pulizia nuova scritta da una ditta')
  })

  await t.check('un gettone firmato con la vecchia chiave "propromanager-archivio" e\' rifiutato (401)', async () => {
    for (const utente of ['u-admin', ANGELA.userId]) {
      const r = await fetch(`${base}/api/dati?da=0`, conGettone(gettoneFirmato(utente, 'propromanager-archivio')))
      assert(r.status === 401, `${utente}: stato ${r.status}`)
    }
  })

  await t.check('gettone mancante o malformato: 401', async () => {
    const senza = await fetch(`${base}/api/dati?da=0`)
    assert(senza.status === 401, `senza gettone: ${senza.status}`)
    const rotto = await fetch(`${base}/api/dati?da=0`, conGettone(`${admin.slice(0, -4)}0000`))
    assert(rotto.status === 401, `firma alterata: ${rotto.status}`)
  })

  await t.check('/api/calendario col gettone di Angela: 403', async () => {
    const url = encodeURIComponent('https://www.airbnb.it/calendar/ical/1.ics')
    const r = await fetch(`${base}/api/calendario?url=${url}`, conGettone(angela))
    assert(r.status === 403, `stato ${r.status}`)
  })

  await t.check('/api/calendario con un link http:// (manager): rifiutato 400', async () => {
    const url = encodeURIComponent('http://www.airbnb.it/calendar/ical/1.ics')
    const r = await fetch(`${base}/api/calendario?url=${url}`, conGettone(admin))
    const corpo = await r.json()
    assert(r.status === 400, `stato ${r.status}`)
    assert(/https/.test(corpo.errore ?? ''), `errore: ${corpo.errore}`)
  })

  await t.check('accesso con password sbagliata: 401', async () => {
    const r = await fetch(`${base}/api/accesso`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ identificativo: ANGELA.id, password: 'sbagliata' }),
    })
    assert(r.status === 401, `stato ${r.status}`)
  })

  await t.check('le schede utente lette dall\'archivio non hanno password', async () => {
    const utenti = (await leggiArchivio(base, angela)).filter((x) => x.tipo === 'users')
    assert(utenti.length > 0, 'nessuna scheda utente nell\'archivio')
    const conPassword = utenti.filter((u) => u.dati && 'password' in u.dati)
    assert(conPassword.length === 0, `con password: ${conPassword.map((u) => u.id).join(', ')}`)
  })
}
