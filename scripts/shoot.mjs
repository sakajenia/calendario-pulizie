/* Avvia il dev server, fa login e cattura ogni schermata. */
import { chromium } from 'playwright'
import fs from 'node:fs'

const OUT = process.env.SHOT_DIR || '/tmp/ppm-shots'
const BASE = process.env.BASE_URL || 'http://localhost:5173'
fs.mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'],
})
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, locale: 'it-IT' })
const page = await ctx.newPage()

const errors = []
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)) })
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + String(e).slice(0, 300)))

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/00-login.png` })

await page.getByRole('button', { name: 'Accedi' }).click()
await page.waitForTimeout(2500)

const PAGES = [
  ['01-calendario', '/calendario'],
  ['02-richieste', '/richieste'],
  ['03-appartamenti', '/appartamenti'],
  ['04-dashboard', '/dashboard'],
  ['05-utenti', '/utenti'],
  ['06-fogli-di-lavoro', '/fogli-di-lavoro'],
  ['07-catalogo-task', '/catalogo-task'],
  ['08-extra', '/extra'],
  ['09-magazzini', '/magazzini'],
  ['10-notifiche', '/notifiche'],
  ['11-impostazioni', '/impostazioni'],
]

for (const [name, path] of PAGES) {
  const before = errors.length
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1800)
  await page.screenshot({ path: `${OUT}/${name}.png` })
  const fresh = errors.slice(before)
  console.log(`${name.padEnd(22)} ${fresh.length ? 'ERRORS: ' + fresh.join(' | ').slice(0, 400) : 'ok'}`)
}

// Tema scuro sulla dashboard, per verificare i token in dark mode.
await page.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle' }).catch(() => {})
await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('ppm-theme', 'dark') })
await page.waitForTimeout(1200)
await page.screenshot({ path: `${OUT}/12-dashboard-dark.png` })

console.log(`\nTOTAL CONSOLE ERRORS: ${errors.length}`)
if (errors.length) console.log(errors.slice(0, 12).join('\n'))
await browser.close()
