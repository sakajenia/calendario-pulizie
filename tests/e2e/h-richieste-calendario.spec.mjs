/*
 * Controlli di interfaccia su modulo richiesta (2a/2b/2c/2e/2f/2g/2h),
 * schede (3), pagina Richieste (4) e Calendario (5), a piu' larghezze:
 * manager a 360, 768 e 1280 px, ditta (Angela) a 390 px.
 */
import {
  ADMIN, ANGELA, accedi, aspettaScambio, ok, preparaArchivio, sezione, stato,
} from './lib.mjs'

const nelloSchermo = async (p, loc) => {
  const bb = await loc.boundingBox()
  const vh = p.viewportSize().height
  return !!bb && bb.y >= 0 && bb.y + bb.height <= vh
}

/** Nuovo dispositivo, accesso e primo scambio con l'archivio. */
async function apri(t, chi, width, height, nome) {
  const dispositivo = await t.telefono({ width, height, mobile: width < 900 })
  await accedi(dispositivo.page, chi)
  await aspettaScambio(dispositivo.page, nome)
  return dispositivo
}

const soloPageerror = (errori) => errori.filter((e) => e.startsWith('pageerror'))

export default async function (t) {
  await preparaArchivio(t)

  /* ------------------------------------------------ manager, telefono 360 */
  await sezione(t, 'manager 360', async () => {
    const { page: M, errori } = await apri(t, ADMIN, 360, 740, 'manager 360')
    await M.goto('/calendario?nuova=1', { waitUntil: 'domcontentloaded' })
    await M.waitForTimeout(900)
    const dlg = M.getByRole('dialog')
    const letti = () => dlg.locator('p:has-text("Scelta letti da rifare") + div').getByRole('checkbox')
    const s0 = await stato(M)
    const conLetti = s0.apartments.filter((a) => a.beds.length >= 2)
    const sel = dlg.locator('select').filter({ has: M.locator(`option[value="${conLetti[0].id}"]`) })
    const casaIniz = await sel.inputValue()
    const nIniz = s0.apartments.find((a) => a.id === casaIniz)?.beds.length ?? 0
    const checked = async () => (await letti().evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked') ?? String(e.checked))))
    let c = await checked()
    await ok(t, '2c nuova: tutti i letti della casa preselezionati', c.length === nIniz && nIniz > 0 && c.every((v) => v === 'true'), `${c.join(',')} / ${nIniz}`)
    const altra = conLetti.find((a) => a.id !== casaIniz)
    await sel.selectOption(altra.id)
    await M.waitForTimeout(300)
    c = await checked()
    await ok(t, '2c cambio casa: letti della nuova casa preselezionati', c.length === altra.beds.length && c.every((v) => v === 'true'), `${c.join(',')} / ${altra.beds.length}`)
    await ok(t, '2e niente "Rendi pulizia ricorrente"', !(await dlg.innerText()).includes('ricorrente'))
    const toggle = dlg.getByRole('button', { name: /Altre opzioni/ })
    await ok(t, '2h "Altre opzioni" chiuse su una nuova', (await toggle.getAttribute('aria-expanded')) === 'false' && !(await dlg.getByText('Stato richiesta').count()))
    await ok(t, '2g testo del check-in chiarito', (await dlg.innerText()).includes('Il check-in lo fa la ditta di pulizie') || (await dlg.innerText()).includes('Di serie per questa casa'))
    /* 2a: il modulo non si svuota mentre lo si compila (giro di sincronizzazione) */
    await dlg.getByLabel('Ospiti in arrivo').fill('5')
    await toggle.click()
    await dlg.getByLabel('Note').fill('prova-non-svuotare')
    await M.waitForTimeout(12000)
    await ok(t, '2a dopo 12s di sincronizzazione il modulo resta compilato',
      (await dlg.getByLabel('Ospiti in arrivo').inputValue()) === '5' && (await dlg.getByLabel('Note').inputValue()) === 'prova-non-svuotare')
    /* 2b: errore accanto al pulsante, visibile */
    const cbP = dlg.getByRole('checkbox', { name: 'Pulizia', exact: true })
    const cbC = dlg.getByRole('checkbox', { name: 'Check-in', exact: true })
    if ((await cbP.getAttribute('aria-checked')) === 'true') await cbP.click()
    if ((await cbC.getAttribute('aria-checked')) === 'true') await cbC.click()
    await M.getByRole('button', { name: /^Crea/ }).click()
    await M.waitForTimeout(400)
    const alert = dlg.getByRole('alert')
    await ok(t, '2b errore visibile nello schermo del telefono', (await alert.count()) === 1 && await nelloSchermo(M, alert), await alert.innerText().catch(() => ''))
    const stessoContenitore = await alert.evaluate((el) => !!el.parentElement?.querySelector('button') && [...el.parentElement.querySelectorAll('button')].some((x) => /^Crea/.test(x.textContent.trim())))
    await ok(t, '2b errore accanto al pulsante Crea (pie\' del dialog)', stessoContenitore)
    /* 2f: notifica dopo la creazione */
    await cbP.click()
    await M.waitForTimeout(200)
    const prima = (await stato(M)).requests.length
    await M.getByRole('button', { name: /^Crea/ }).click()
    await M.waitForTimeout(700)
    await ok(t, '2f creata la richiesta', (await stato(M)).requests.length === prima + 1)
    await ok(t, '2f notifica "Pulizia creata"', (await M.getByText('Pulizia creata', { exact: true }).count()) >= 1)
    /* 5b: niente pulsante aggiorna sul telefono, spazio in fondo */
    await M.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await M.waitForTimeout(900)
    await ok(t, '5b niente pulsante "Aggiorna la vista" visibile sul telefono', !(await M.getByRole('button', { name: 'Aggiorna la vista' }).isVisible().catch(() => false)))
    const pb = await M.evaluate(() => { const g = [...document.querySelectorAll('div')].find((d) => d.className.includes('pb-[calc(7rem')); return g ? parseFloat(getComputedStyle(g).paddingBottom) : 0 })
    await ok(t, '5b area scorrevole con spazio per il "+" (>=112px)', pb >= 112, pb)
    const fs = await M.evaluate(() => [...document.querySelectorAll('div')].filter((d) => /^(lun|mar|mer|gio|ven|sab|dom)$/i.test(d.textContent.trim()) && d.children.length === 0).map((d) => getComputedStyle(d).fontSize))
    await ok(t, '5c intestazione giorni a 12px', fs.length >= 7 && fs.every((f) => f === '12px'), fs.slice(0, 7).join(','))
    /* 4: Richieste a 360 - pillole e sottotitolo */
    await M.goto('/richieste', { waitUntil: 'domcontentloaded' })
    await M.waitForTimeout(900)
    const hChip = await M.getByRole('button', { name: /^Tutte/ }).first().boundingBox()
    await ok(t, '4 pillole di stato alte almeno 40px', hChip && hChip.height >= 40, hChip?.height)
    const head = await M.locator('main h1').locator('..').innerText()
    await ok(t, '4 nessuna barra "|" nel sottotitolo', !head.includes('|'), head.replace(/\n/g, ' / '))
    const js = soloPageerror(errori)
    await ok(t, 'manager nessun errore JS', js.length === 0, js[0] ?? '')
  })

  /* ------------------------------------------------ manager, tablet 768 */
  await sezione(t, 'manager 768', async () => {
    const { page: T } = await apri(t, ADMIN, 768, 1024, 'manager 768')
    await T.goto('/richieste', { waitUntil: 'domcontentloaded' })
    await T.waitForTimeout(900)
    await ok(t, '4 a 768px schede, non tabella', !(await T.locator('table').isVisible().catch(() => false)) && (await T.locator('main [role="button"]').count()) > 0)
    await ok(t, '4 a 768px niente scorrimento laterale', !(await T.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)))
  })

  /* ------------------------------------------------ manager, desktop 1280x720 */
  await sezione(t, 'manager 1280', async () => {
    const { page: D } = await apri(t, ADMIN, 1280, 720, 'manager 1280')
    await D.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await D.waitForTimeout(900)
    const altezze = await D.evaluate(() => [...document.querySelectorAll('button[aria-pressed][aria-label*="richiest"]')].map((x) => x.getBoundingClientRect().height))
    await ok(t, '5a celle del mese alte almeno 52px su desktop', altezze.length >= 35 && Math.min(...altezze) >= 51.5, Math.min(...altezze))
    const legenda = await D.evaluate(() => {
      const s = [...document.querySelectorAll('span')].find((x) => x.textContent.trim() === 'Check-in' && x.querySelector('.bg-checkin'))
      if (!s) return null
      const r = s.getBoundingClientRect(); const card = s.closest('.rounded-xl, [class*="card"]') ?? s.parentElement.parentElement
      const cr = card.getBoundingClientRect(); const pr = s.parentElement.getBoundingClientRect()
      return { dentro: r.right <= pr.right + 0.5 && r.right <= cr.right + 0.5 && r.bottom <= cr.bottom + 0.5 }
    })
    await ok(t, '5a legenda: "Check-in" non tagliato', legenda?.dentro === true, JSON.stringify(legenda))
    await D.goto('/richieste', { waitUntil: 'domcontentloaded' })
    await D.waitForTimeout(900)
    await ok(t, '4 a 1280px tabella visibile', await D.locator('table').isVisible())
  })

  /* ------------------------------------------------ ditta (Angela), telefono 390 */
  await sezione(t, 'ditta 390', async () => {
    const { page: A, errori } = await apri(t, ANGELA, 390, 844, 'Angela 390')
    await A.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await A.waitForTimeout(1200)
    const inAttesa = (await stato(A)).requests.filter((r) => r.status === 'in_attesa').length
    const link = A.getByRole('link', { name: /Da accettare \(\d+\)/ })
    await ok(t, '5d scorciatoia "Da accettare (N)" visibile', await link.isVisible(), (await link.innerText().catch(() => '')) + ` / ${inAttesa} in attesa nei dati`)
    await link.click()
    await A.waitForURL('**/richieste**')
    await A.waitForTimeout(900)
    const attiva = await A.getByRole('button', { name: /^In Attesa/ }).first().getAttribute('class')
    const schede = await A.locator('main [role="button"]').count()
    await ok(t, '5d porta a Richieste filtrate su "In Attesa"', /bg-primary\/10/.test(attiva ?? '') && schede === Math.min(25, inAttesa), `${schede} schede`)
    await ok(t, '5d parametro consumato dall\'URL', !A.url().includes('stato='), A.url())
    const acc = A.locator('button[aria-label^="Accetta la pulizia"]').first()
    const hAcc = await acc.boundingBox()
    await ok(t, '3 Accetta alto almeno 44px sul telefono', hAcc && hAcc.height >= 44, hAcc?.height)
    const indirizzo = await A.locator('main [role="button"] .line-clamp-2').first().count()
    await ok(t, '3 indirizzo su due righe (line-clamp-2)', indirizzo === 1)
    const dateUnaRiga = await A.locator('main [role="button"] dd').first().evaluate((e) => getComputedStyle(e).whiteSpace)
    await ok(t, '3 date su una riga', dateUnaRiga === 'nowrap', dateUnaRiga)
    /* il dettaglio: Accetta/Rifiuta alti 44px */
    await A.locator('main [role="button"]').first().click()
    await A.waitForTimeout(500)
    const hDet = await A.getByRole('dialog').getByRole('button', { name: /Accetta/ }).boundingBox()
    await ok(t, '3 Accetta nel dettaglio alto almeno 44px', hDet && hDet.height >= 44, hDet?.height)
    const js = soloPageerror(errori)
    await ok(t, 'ditta nessun errore JS', js.length === 0, js[0] ?? '')
  })
}
