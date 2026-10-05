#!/usr/bin/env node
/*
 * Test end-to-end di ProProManager nel browser vero, contro il Worker vero.
 *
 * Cosa fa, in ordine:
 *   1. `npm run build` (la pagina servita e' quella di dist/);
 *   2. avvia `wrangler dev --local` su una porta libera (PORT, di serie 4250)
 *      con un archivio D1 nuovo in una cartella temporanea: ogni giro parte
 *      da zero e non sporca .wrangler/ del progetto;
 *   3. aspetta che /login risponda 200;
 *   4. esegue in fila ogni tests/e2e/*.spec.mjs;
 *   5. ferma wrangler (solo il processo avviato qui, col suo gruppo) e
 *      cancella la cartella temporanea.
 *
 * Convenzione delle spec: ognuna esporta
 *     export default async function (t) { ... }
 * dove `t` (vedi `contesto` sotto) offre:
 *     t.base                 indirizzo del Worker (es. http://localhost:4250)
 *     t.telefono(opz)        contesto browser nuovo (390x844 mobile di serie)
 *                            -> { context, page, errori }
 *     t.check(nome, fn)      esegue fn; stampa PASS/FAIL e va avanti
 *     t.log(...)             nota libera nel resoconto
 * I contesti aperti con t.telefono si chiudono da soli a fine spec.
 *
 * Variabili d'ambiente:
 *   PORT            porta del Worker (4250)
 *   CHROMIUM_PATH   eseguibile di Chromium (/opt/pw-browsers/chromium-1194/chrome-linux/chrome)
 *   E2E_BASE_URL    usa un Worker gia' acceso: niente build ne' wrangler
 *   E2E_SKIP_BUILD  =1 per non rifare la build
 *   E2E_HEADED      =1 per vedere il browser
 * Argomenti: parti del nome delle spec da eseguire (es. `node scripts/e2e.mjs sicurezza`).
 */
import { spawn, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from 'playwright-core'

const RADICE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARTELLA_SPEC = path.join(RADICE, 'tests', 'e2e')
const PORTA = Number(process.env.PORT || 4250)
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const filtri = process.argv.slice(2)

let wrangler = null
let cartellaArchivio = null
let browser = null
const risultati = []

/* ------------------------------------------------------------ Worker ---- */

function costruisci() {
  console.log('> npm run build')
  const esito = spawnSync('npm', ['run', 'build'], { cwd: RADICE, stdio: 'inherit' })
  if (esito.status !== 0) throw new Error('build fallita')
}

async function avviaWorker() {
  cartellaArchivio = fs.mkdtempSync(path.join(os.tmpdir(), 'ppm-e2e-'))
  console.log(`> wrangler dev --local --port ${PORTA} --persist-to ${cartellaArchivio}`)
  const registro = fs.createWriteStream(path.join(cartellaArchivio, 'wrangler.log'))
  /* `detached` mette wrangler in un gruppo di processi suo: alla fine si
     ferma tutto il gruppo (wrangler + workerd) e nient'altro. Mai
     `pkill -f "wrangler dev"`: colpirebbe anche la shell che ci ha lanciati. */
  wrangler = spawn('npx', ['wrangler', 'dev', '--local', '--port', String(PORTA), '--persist-to', cartellaArchivio], {
    cwd: RADICE,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, CI: '1', WRANGLER_SEND_METRICS: 'false', NO_COLOR: '1' },
  })
  wrangler.stdout.pipe(registro)
  wrangler.stderr.pipe(registro)
  let uscito = null
  wrangler.on('exit', (code) => { uscito = code ?? -1 })

  const base = `http://localhost:${PORTA}`
  const limite = Date.now() + 90_000
  while (Date.now() < limite) {
    if (uscito !== null) break
    try {
      const r = await fetch(`${base}/login`)
      if (r.status === 200) return base
    } catch { /* non ancora pronto */ }
    await new Promise((ok) => setTimeout(ok, 500))
  }
  const coda = fs.existsSync(path.join(cartellaArchivio, 'wrangler.log'))
    ? fs.readFileSync(path.join(cartellaArchivio, 'wrangler.log'), 'utf8').slice(-2000) : ''
  throw new Error(`wrangler non risponde su ${base}/login\n${coda}`)
}

async function fermaWorker() {
  if (!wrangler || wrangler.exitCode !== null) return
  const pid = wrangler.pid
  const segnala = (sig) => { try { process.kill(-pid, sig) } catch { /* gia' fermo */ } }
  segnala('SIGTERM')
  const fermo = await Promise.race([
    new Promise((ok) => wrangler.once('exit', () => ok(true))),
    new Promise((ok) => setTimeout(() => ok(false), 5000)),
  ])
  if (!fermo) segnala('SIGKILL')
}

async function pulisci() {
  await browser?.close().catch(() => {})
  await fermaWorker()
  if (cartellaArchivio && !process.env.E2E_KEEP) fs.rmSync(cartellaArchivio, { recursive: true, force: true })
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    await pulisci()
    process.exit(130)
  })
}

/* ------------------------------------------------------------- spec ---- */

function contesto(base, nomeSpec) {
  const aperti = []
  return {
    base,
    browser,
    aperti,
    log: (...x) => console.log(`      ${x.join(' ')}`),
    /* Un dispositivo nuovo: localStorage vuoto, nessun accesso. */
    async telefono({ width = 390, height = 844, mobile = true } = {}) {
      const context = await browser.newContext({
        viewport: { width, height },
        isMobile: mobile,
        hasTouch: mobile,
        deviceScaleFactor: mobile ? 2 : 1,
        locale: 'it-IT',
        timezoneId: 'Europe/Rome',
        baseURL: base,
      })
      aperti.push(context)
      /* Niente rete esterna: le richieste fuori dal Worker (i Google Fonts)
         ricevono una risposta vuota. I test non dipendono da internet e un
         proxy o un certificato non riconosciuto non sporcano la console. */
      const origine = new URL(base).origin
      await context.route((u) => u.origin !== origine, (r) =>
        r.fulfill({ status: 200, contentType: 'text/css', body: '' }))
      const page = await context.newPage()
      page.setDefaultTimeout(15_000)
      const errori = []
      page.on('pageerror', (e) => errori.push(`pageerror: ${String(e).slice(0, 300)}`))
      page.on('console', (m) => { if (m.type() === 'error') errori.push(`console: ${m.text().slice(0, 300)}`) })
      return { context, page, errori }
    },
    async check(nome, fn) {
      const etichetta = `${nomeSpec} > ${nome}`
      try {
        await fn()
        risultati.push({ nome: etichetta, ok: true })
        console.log(`PASS ${etichetta}`)
      } catch (e) {
        risultati.push({ nome: etichetta, ok: false })
        console.log(`FAIL ${etichetta}\n      ${String(e?.message ?? e).split('\n').slice(0, 6).join('\n      ')}`)
      }
    },
  }
}

async function eseguiSpec(base, file) {
  const nome = path.basename(file).replace(/\.spec\.mjs$/, '')
  console.log(`\n=== ${nome}`)
  const t = contesto(base, nome)
  const inizio = Date.now()
  try {
    const mod = await import(pathToFileURL(file).href)
    await mod.default(t)
  } catch (e) {
    risultati.push({ nome: `${nome} > (errore imprevisto)`, ok: false })
    console.log(`FAIL ${nome} > errore imprevisto: ${String(e?.stack ?? e).split('\n').slice(0, 8).join('\n      ')}`)
  } finally {
    for (const c of t.aperti) await c.close().catch(() => {})
  }
  console.log(`    (${((Date.now() - inizio) / 1000).toFixed(1)} s)`)
}

/* ------------------------------------------------------------ avvio ---- */

let codice = 1
try {
  const spec = fs.readdirSync(CARTELLA_SPEC)
    .filter((f) => f.endsWith('.spec.mjs'))
    .filter((f) => filtri.length === 0 || filtri.some((x) => f.includes(x)))
    .sort()
    .map((f) => path.join(CARTELLA_SPEC, f))
  if (spec.length === 0) throw new Error('nessuna spec trovata')

  let base = process.env.E2E_BASE_URL
  if (!base) {
    if (!process.env.E2E_SKIP_BUILD) costruisci()
    base = await avviaWorker()
  }
  process.env.E2E_BASE_URL_EFFETTIVO = base
  console.log(`> Worker pronto su ${base}`)

  browser = await chromium.launch({
    executablePath: CHROMIUM,
    headless: !process.env.E2E_HEADED,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  })

  for (const file of spec) await eseguiSpec(base, file)

  const falliti = risultati.filter((r) => !r.ok)
  console.log(`\nTotale: ${risultati.length} controlli, ${risultati.length - falliti.length} PASS, ${falliti.length} FAIL`)
  for (const f of falliti) console.log(`  FAIL ${f.nome}`)
  codice = falliti.length === 0 && risultati.length > 0 ? 0 : 1
} catch (e) {
  console.error(`Errore: ${e?.stack ?? e}`)
  codice = 1
} finally {
  await pulisci()
}
process.exit(codice)
