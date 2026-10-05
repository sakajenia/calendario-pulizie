/*
 * Pagine di gestione: Utenti (modifica del telefono di Angela), Impostazioni
 * (dati e archiviazione, manager e ditta), Catalogo Task (periodo iniziale),
 * Notifiche (altezza delle schede) e Accessi (copia del codice porta).
 */
import {
  ADMIN, ANGELA, accedi, aspettaScambio, ok, preparaArchivio, sezione, stato,
} from './lib.mjs'

const tabsDi = (p) => p.getByRole('group', { name: 'Periodo delle task' }).locator('button').evaluateAll((els) =>
  els.map((e) => ({ t: e.textContent.trim(), on: e.getAttribute('aria-pressed') === 'true' })))
const n = (t) => Number((t.match(/(\d+)$/) ?? [0, 0])[1])

export default async function (t) {
  await preparaArchivio(t)

  /* ---- admin ---- */
  await sezione(t, 'admin', async () => {
    const { page: p } = await t.telefono({ width: 1280, height: 900, mobile: false })
    await accedi(p, ADMIN)
    await aspettaScambio(p, 'admin')

    // Fix 1: modifica del telefono di Angela
    await p.goto('/utenti', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(800)
    const prima = (await stato(p)).users.find((u) => u.username === 'Angela' || /angela/i.test(u.name))
    await ok(t, 'Angela presente nello store', !!prima, JSON.stringify(prima && { id: prima.id, companyId: prima.companyId, username: prima.username }))
    await p.getByPlaceholder('Filtra per nome o email').fill('angela')
    await p.waitForTimeout(300)
    await p.locator('tbody tr').first().click()
    const tel = '+39 333 1234567'
    await p.getByPlaceholder('+39 340 000 0000').fill(tel)
    await p.getByRole('button', { name: 'Salva modifiche' }).click()
    await p.waitForTimeout(800)
    const dopo = (await stato(p)).users.find((u) => u.id === prima.id)
    await ok(t, 'telefono aggiornato', dopo?.phone === tel, String(dopo?.phone))
    await ok(t, 'companyId conservato', !!prima.companyId && dopo?.companyId === prima.companyId, `${prima.companyId} -> ${dopo?.companyId}`)
    await ok(t, 'username conservato', !!prima.username && dopo?.username === prima.username, `${prima.username} -> ${dopo?.username}`)

    // Fix 3: admin vede dati e archiviazione derivata
    await p.goto('/impostazioni', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1200)
    await ok(t, 'admin vede Esporta i dati', await p.getByRole('button', { name: /Esporta i dati/ }).count() === 1)
    await ok(t, 'admin vede Importa i dati', await p.getByRole('button', { name: /Importa i dati/ }).count() === 1)
    const arch = await p.locator('main').innerText()
    await ok(t, 'Archiviazione non piu\' "Locale al browser"', !/Locale al browser/.test(arch), (arch.match(/Archiviazione\s*\n?\s*([^\n]+)/) ?? [])[1])
    await p.locator('input[type=file]').setInputFiles({ name: 'vecchio.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ app: 'x', exportedAt: '2020-01-01T00:00:00Z', data: { users: [] } })) })
    await p.waitForTimeout(400)
    await ok(t, 'import chiede conferma', await p.getByText('Importare i dati dal file?').count() === 1)
    await p.getByRole('button', { name: 'Annulla' }).last().click()

    // Fix 6: CatalogoTask
    await p.goto('/catalogo-task', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1000)
    const tabs = await tabsDi(p)
    const prime = tabs.slice(0, 3)
    const atteso = (prime.find((x) => n(x.t) > 0) ?? prime[0]).t
    await ok(t, 'Catalogo Task apre sul primo periodo non vuoto', tabs.find((x) => x.on)?.t === atteso, JSON.stringify(tabs))

    // Caso con "Oggi" vuoto: sposta tutti i controlli a domani e ricarica
    await p.evaluate(() => {
      const s = JSON.parse(localStorage.getItem('propromanager-state'))
      const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(10, 0, 0, 0)
      s.state.inspections = s.state.inspections.map((i) => ({ ...i, scheduledAt: d.toISOString() }))
      localStorage.setItem('propromanager-state', JSON.stringify(s))
    })
    await p.reload({ waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1200)
    const tabs2 = await tabsDi(p)
    t.log('tab dopo spostamento a domani:', JSON.stringify(tabs2))
    await ok(t, 'Catalogo Task: Oggi vuoto -> si apre su Domani', n(tabs2[0].t) === 0 && tabs2[1].on, JSON.stringify(tabs2))

    // Notifiche: altezza tab
    await p.goto('/notifiche', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(800)
    const h = await p.locator('button[aria-pressed]').first().evaluate((e) => e.getBoundingClientRect().height)
    await ok(t, 'Notifiche tab >= 40px', h >= 40, String(h))
  })

  /* ---- Angela (ditta) ---- */
  await sezione(t, 'Angela', async () => {
    const { context, page: p } = await t.telefono({ width: 390, height: 844, mobile: false })
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    await accedi(p, ANGELA)
    await aspettaScambio(p, 'Angela')
    await p.goto('/impostazioni', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1200)
    const testo = await p.locator('main').innerText()
    await ok(t, 'ditta: nessun Esporta/Importa', !/Esporta i dati|Importa i dati/.test(testo))
    await ok(t, 'ditta: nessun blocco dati dimostrativi', !/Dati dimostrativi|record nel dataset/.test(testo))
    await ok(t, 'ditta: Archiviazione coerente', !/Locale al browser/.test(testo))

    // Fix 7: Accessi
    await p.goto('/accessi', { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(1200)
    const btn = p.locator('button[aria-label^="Copia"]').first()
    if (await btn.count()) {
      const box = await btn.boundingBox()
      await ok(t, 'codice porta >= 40px', box.height >= 39.5, String(box.height))
      const op = await btn.locator('svg').first().evaluate((e) => getComputedStyle(e).opacity)
      await ok(t, 'icona copia sempre visibile', op === '1', op)
      await btn.click()
      await p.waitForTimeout(400)
      await ok(t, 'toast "Codice copiato"', await p.getByText('Codice copiato').count() > 0)
    } else {
      await ok(t, 'Accessi ha pulsanti codice', false, 'nessun pulsante Copia')
    }
  })
}
