/*
 * Accende l'archivio condiviso, in un comando solo.
 *
 * Fa i passaggi che altrimenti andrebbero fatti a mano, nell'ordine giusto:
 * crea il database su Cloudflare, scrive da solo l'identificativo in
 * wrangler.toml - il punto in cui ci si blocca piu' spesso, perche' va
 * copiato a mano da una risposta lunga - e crea le tabelle con gli accessi.
 *
 *   npm run archivio:accendi
 *
 * Si puo' rilanciare quante volte si vuole: se il database c'e' gia' non lo
 * rifa', e le tabelle si creano solo se mancano.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const radice = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG = path.join(radice, 'wrangler.toml')
const NOME_DB = 'propromanager'

const scrivi = (s) => process.stdout.write(`${s}\n`)
const titolo = (s) => scrivi(`\n\x1b[1m${s}\x1b[0m`)
const ok = (s) => scrivi(`  \x1b[32m✓\x1b[0m ${s}`)
const info = (s) => scrivi(`  · ${s}`)

function wrangler(argomenti, { silenzioso = false } = {}) {
  return execFileSync('npx', ['wrangler', ...argomenti], {
    cwd: radice,
    encoding: 'utf8',
    stdio: silenzioso ? ['ignore', 'pipe', 'pipe'] : ['inherit', 'pipe', 'inherit'],
  })
}

/** L'identificativo del database, cercato fra quelli gia' esistenti. */
function cercaDatabase() {
  try {
    const elenco = JSON.parse(wrangler(['d1', 'list', '--json'], { silenzioso: true }))
    return elenco.find((d) => d.name === NOME_DB)?.uuid ?? null
  } catch {
    return null
  }
}

function creaDatabase() {
  const uscita = wrangler(['d1', 'create', NOME_DB], { silenzioso: true })
  /* La risposta contiene l'identificativo in mezzo al blocco di esempio. */
  const trovato = uscita.match(/database_id\s*=\s*"([0-9a-f-]{36})"/i)
  if (!trovato) throw new Error(`Non riesco a leggere l'identificativo:\n${uscita}`)
  return trovato[1]
}

function scriviIdentificativo(id) {
  const prima = readFileSync(CONFIG, 'utf8')
  const dopo = prima.replace(/^database_id\s*=\s*".*"$/m, `database_id = "${id}"`)
  if (dopo === prima) throw new Error('In wrangler.toml manca la riga database_id')
  writeFileSync(CONFIG, dopo)
}

const identificativoInConfig = () =>
  readFileSync(CONFIG, 'utf8').match(/^database_id\s*=\s*"(.*)"$/m)?.[1] ?? ''

try {
  titolo('Archivio condiviso di ProProManager')

  let id = identificativoInConfig()
  const daCompilare = !/^[0-9a-f-]{36}$/i.test(id)

  if (daCompilare) {
    info('Cerco il database su Cloudflare…')
    id = cercaDatabase()
    if (id) {
      ok(`Database "${NOME_DB}" già presente`)
    } else {
      info('Non c\'è ancora: lo creo…')
      id = creaDatabase()
      ok(`Database "${NOME_DB}" creato`)
    }
    scriviIdentificativo(id)
    ok('Identificativo scritto in wrangler.toml')
  } else {
    ok('Database già collegato in wrangler.toml')
  }

  info('Creo le tabelle e gli accessi…')
  wrangler(['d1', 'execute', NOME_DB, '--remote', '--yes', '--file=worker/schema.sql'], { silenzioso: true })
  ok('Tabelle e accessi pronti')

  titolo('Restano due cose, da fare a mano')
  scrivi('  1. La firma degli accessi (una frase a piacere, tienila per te):')
  scrivi('     \x1b[1mnpx wrangler secret put SYNC_SECRET\x1b[0m')
  scrivi('  2. Pubblicare l\'app:')
  scrivi('     \x1b[1mnpm run deploy\x1b[0m')
  scrivi('\n  Poi apri l\'app: in Impostazioni → Dati deve dire "Archivio condiviso: collegato".')
  scrivi('  Se in cima alla pagina c\'è ancora l\'avviso giallo, qualcosa non è andato.\n')
} catch (errore) {
  scrivi('')
  scrivi(`\x1b[31mNon sono riuscito ad accendere l'archivio.\x1b[0m`)
  scrivi(String(errore.message ?? errore).trim())
  scrivi('\nSe dice che non sei collegato a Cloudflare, prima esegui:  npx wrangler login')
  scrivi('I passaggi a mano sono scritti in docs/ARCHIVIO-CONDIVISO.md\n')
  process.exit(1)
}
