/*
 * Schermi bassi e larghezze intermedie: calendario sul telefono in
 * orizzontale (844x390), finestre di dialogo che stanno nello schermo, elenco
 * Richieste a 1024x1366 (schede) e 1280x800 (tabella che sta nel contenitore,
 * Accetta/Rifiuta raggiungibili dalla ditta).
 */
import {
  ADMIN, ANGELA, accedi, aspettaScambio, ok, preparaArchivio, sezione,
} from './lib.mjs'

/** Nuovo dispositivo, accesso e primo scambio con l'archivio. */
async function apri(t, chi, width, height, nome, mobile = width < 900) {
  const dispositivo = await t.telefono({ width, height, mobile })
  await accedi(dispositivo.page, chi)
  await aspettaScambio(dispositivo.page, nome)
  return dispositivo
}

export default async function (t) {
  await preparaArchivio(t)

  /* ---- 1. Calendario sul telefono in orizzontale (844x390) ---- */
  await sezione(t, 'calendario 844x390', async () => {
    const { page: P } = await apri(t, ADMIN, 844, 390, 'manager 844x390')
    await P.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await P.waitForTimeout(1200)

    /* Il contenitore che scorre e' uno solo, quello esterno: la griglia dei
       giorni non ha un suo scorrimento e non resta in 128px. */
    const misure = await P.evaluate(() => {
      const cella = document.querySelector('button[aria-pressed][aria-label*="richiest"]')
      const griglia = cella.parentElement
      let scroller = null
      for (let e = griglia.parentElement; e; e = e.parentElement) {
        const o = getComputedStyle(e).overflowY
        if ((o === 'auto' || o === 'scroll') && e.scrollHeight > e.clientHeight + 1) { scroller = e; break }
      }
      const celle = [...document.querySelectorAll('button[aria-pressed][aria-label*="richiest"]')]
      return {
        scorreEsterno: !!scroller,
        scrollerH: scroller?.clientHeight ?? 0,
        scrollerContieneTesta: !!scroller && scroller.contains(document.querySelector('h1')),
        celle: celle.length,
      }
    })
    await ok(t, '844x390: scorre il contenitore esterno', misure.scorreEsterno, JSON.stringify(misure))
    await ok(t, '844x390: la testata scorre insieme al calendario', misure.scrollerContieneTesta)
    await ok(t, '844x390: tutte le celle del mese sono nel DOM', misure.celle >= 35, String(misure.celle))

    /* L'ultima cella (domenica) si raggiunge in fondo allo scorrimento e il
       "+" non la copre. */
    const fab = P.locator('button[aria-label="Nuova richiesta"]')
    await ok(t, '844x390: pulsante "+" presente', await fab.isVisible())
    const fine = await P.evaluate(() => {
      const celle = [...document.querySelectorAll('button[aria-pressed][aria-label*="richiest"]')]
      const ultima = celle[celle.length - 1]
      let e = ultima.parentElement
      while (e && !((getComputedStyle(e).overflowY === 'auto') && e.scrollHeight > e.clientHeight + 1)) e = e.parentElement
      e.scrollTop = e.scrollHeight
      return true
    })
    await P.waitForTimeout(200)
    const sov = await P.evaluate(() => {
      const celle = [...document.querySelectorAll('button[aria-pressed][aria-label*="richiest"]')]
      const f = document.querySelector('button[aria-label="Nuova richiesta"]').getBoundingClientRect()
      const ultima = celle[celle.length - 1].getBoundingClientRect()
      const sopra = celle.filter((c) => {
        const r = c.getBoundingClientRect()
        return r.left < f.right && r.right > f.left && r.top < f.bottom && r.bottom > f.top
      }).length
      return { sopra, ultimaBottom: ultima.bottom, fabTop: f.top }
    })
    await ok(t, '844x390: il "+" non copre nessuna cella a fine scorrimento', fine && sov.sopra === 0, JSON.stringify(sov))

    /* Il "+" apre il modulo sul giorno scelto: si tocca il 20 del mese. */
    await P.evaluate(() => {
      const celle = [...document.querySelectorAll('button[aria-pressed][aria-label*="richiest"]')]
      const c = celle.find((x) => x.textContent.trim().startsWith('20') && !x.className.includes('opacity-45'))
      c.scrollIntoView({ block: 'center' })
    })
    const venti = P.locator('button[aria-pressed][aria-label*="richiest"]:not(.opacity-45)').filter({ hasText: /^20/ }).first()
    await venti.click()
    const giorno = P.getByRole('dialog')
    await ok(t, '844x390: il tocco su un giorno apre il riepilogo', await giorno.isVisible())
    const panel = await giorno.boundingBox()
    await ok(t, '844x390: il riepilogo sta nello schermo (altezza <= 390)', panel && panel.y >= 0 && panel.y + panel.height <= 390.5, JSON.stringify(panel))
    await P.keyboard.press('Escape')
    await P.waitForTimeout(250)
    await fab.click()
    const modulo = P.getByRole('dialog')
    await modulo.waitFor()
    await P.waitForTimeout(400)
    const attesa = await P.evaluate(() => {
      const d = new Date()
      const p = (n) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-20`
    })
    const valore = await modulo.locator('input[type="datetime-local"]').first().inputValue()
    await ok(t, '844x390: il "+" apre il modulo sul giorno selezionato', valore.startsWith(attesa), `${valore} vs ${attesa}`)

    /* ---- 3. Dialog in orizzontale: il pannello sta nello schermo ---- */
    const pm = await modulo.boundingBox()
    await ok(t, '844x390: modulo con pannello alto al massimo 390', pm && pm.y >= -0.5 && pm.y + pm.height <= 390.5, JSON.stringify(pm))
    const primario = modulo.getByRole('button', { name: 'Crea richiesta' })
    const bp = await primario.boundingBox()
    await ok(t, '844x390: "Crea richiesta" visibile senza scorrere', bp && bp.y >= 0 && bp.y + bp.height <= 390.5, JSON.stringify(bp))
    const scrolls = await P.evaluate(() => {
      const d = document.querySelector('[role="dialog"]')
      const corpo = [...d.querySelectorAll('div')].filter((e) => getComputedStyle(e).overflowY === 'auto' && e.scrollHeight > e.clientHeight + 1)
      const ext = d.parentElement
      return { corpo: corpo.length, esterno: ext.scrollHeight > ext.clientHeight + 1 }
    })
    await ok(t, '844x390: un solo scorrimento (il corpo), non annidato', scrolls.corpo <= 1 && !scrolls.esterno, JSON.stringify(scrolls))
    await P.keyboard.press('Escape')

    /* Area di tocco: interruttori e comandi del calendario ad almeno 40px */
    const piccoli = await P.evaluate(() => {
      const nomi = ['Oggi', 'In data odierna', 'Mese', 'Settimana', 'Tutte le richieste', 'Seleziona']
      return [...document.querySelectorAll('main button')]
        .filter((b) => nomi.includes(b.textContent.trim()) && b.offsetParent)
        .map((b) => [b.textContent.trim(), Math.round(b.getBoundingClientRect().height)])
        .filter(([, h]) => h < 39.5)
    })
    await ok(t, '844x390: comandi del calendario alti almeno 40px', piccoli.length === 0, JSON.stringify(piccoli))
  })

  /* ---- 1b. Calendario a 1440x900 con la guida estesa ---- */
  await sezione(t, 'calendario 1440x900', async () => {
    const { page: D } = await apri(t, ADMIN, 1440, 900, 'manager 1440x900', false)
    await D.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await D.waitForTimeout(1200)
    await ok(t, '1440x900: guida estesa visibile', await D.locator('#guida-dettagli').isVisible())
    /* Si sceglie un giorno vuoto: nella colonna destra compare "Nuova richiesta". */
    await D.evaluate(() => {
      const celle = [...document.querySelectorAll('button[aria-pressed][aria-label*="0 richieste"]')]
      celle[celle.length - 1]?.click()
    })
    await D.waitForTimeout(300)
    const bottone = D.locator('main').getByRole('button', { name: 'Nuova richiesta' }).last()
    await bottone.scrollIntoViewIfNeeded()
    const visibile = await bottone.evaluate((el) => {
      const r = el.getBoundingClientRect()
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)
      return { dentro: r.top >= 0 && r.bottom <= window.innerHeight, cima: el.contains(top) }
    })
    await ok(t, '1440x900: "Nuova richiesta" nella colonna destra non e\' tagliato', visibile.dentro && visibile.cima, JSON.stringify(visibile))
  })

  /* ---- 4/5. Telefono 360: aree di tocco e testo non tagliato ---- */
  await sezione(t, 'telefono 360', async () => {
    const { page: S } = await apri(t, ADMIN, 360, 740, 'manager 360')
    await S.goto('/calendario', { waitUntil: 'domcontentloaded' })
    await S.waitForTimeout(1200)
    const alti = async (selettore) => S.evaluate((sel) =>
      [...document.querySelectorAll(sel)].filter((e) => e.offsetParent).map((e) => Math.round(e.getBoundingClientRect().height)), selettore)
    const guida = await S.evaluate(() => ['Nascondi la guida'].map((n) => {
      const b = document.querySelector(`button[aria-label="${n}"]`).getBoundingClientRect()
      return [Math.round(b.width), Math.round(b.height)]
    }).concat([...document.querySelectorAll('#guida-dettagli ~ *, section button[aria-controls="guida-dettagli"]')].map(() => null).filter(Boolean)))
    await ok(t, '360: "Nascondi la guida" almeno 40x40', guida[0][0] >= 40 && guida[0][1] >= 40, JSON.stringify(guida))
    const mostra = await S.locator('button[aria-controls="guida-dettagli"]').boundingBox()
    await ok(t, '360: "Mostra" della guida almeno 40x40', mostra && mostra.width >= 40 && mostra.height >= 40, JSON.stringify(mostra))
    const chips = await alti('button[aria-pressed]:has(.tabular-nums)')
    await ok(t, '360: pillole della legenda alte almeno 40px', chips.length >= 5 && Math.min(...chips) >= 39.5, JSON.stringify(chips))
    const interruttore = await alti('[role="group"][aria-label="Calendario da visualizzare"] button')
    await ok(t, '360: interruttore Pulizie/Task Operative alto 40px', interruttore.length === 2 && Math.min(...interruttore) >= 39.5, JSON.stringify(interruttore))

    await S.goto('/catalogo-task', { waitUntil: 'domcontentloaded' })
    await S.waitForTimeout(1200)
    const tab = await S.evaluate(() => {
      const g = document.querySelector('[role="group"][aria-label="Periodo delle task"]')
      const r = g.getBoundingClientRect()
      return { scorre: g.scrollWidth > g.clientWidth + 1, fuori: [...g.querySelectorAll('button')].some((b) => b.getBoundingClientRect().right > window.innerWidth) , r: Math.round(r.right) }
    })
    await ok(t, '360: schede del Catalogo Task tutte visibili (a capo, senza scorrimento)', !tab.scorre && !tab.fuori, JSON.stringify(tab))
    const persone = await alti('button[aria-pressed]:has(.tabular-nums), button:has(> .tabular-nums)')
    await ok(t, '360: pillole delle persone alte almeno 40px', persone.length >= 4 && Math.min(...persone) >= 39.5, JSON.stringify(persone))

    await S.goto('/accessi', { waitUntil: 'domcontentloaded' })
    await S.waitForTimeout(1200)
    const ph = await S.evaluate(() => {
      const i = document.querySelector('input[placeholder]')
      const c = document.createElement('canvas').getContext('2d')
      const cs = getComputedStyle(i)
      c.font = `${cs.fontSize} ${cs.fontFamily}`
      return { testo: i.placeholder, larghezza: Math.round(c.measureText(i.placeholder).width), utile: Math.round(i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) }
    })
    await ok(t, '360: segnaposto della ricerca Accessi non tagliato', ph.larghezza <= ph.utile, JSON.stringify(ph))
    const matita = await alti('button[aria-label^="Modifica gli accessi di"]')
    await ok(t, '360: matita Accessi alta almeno 40px', matita.length > 0 && Math.min(...matita) >= 39.5, JSON.stringify(matita))
  })

  /* ---- 2. Elenco Richieste: 1024x1366 schede, 1280x800 tabella ---- */
  /* ---- 2b. Monitor largo: la tabella con tutte le colonne sta ancora ---- */
  await sezione(t, 'richieste 1536x864 admin', async () => {
    const { page: W } = await apri(t, ADMIN, 1536, 864, 'admin 1536x864', false)
    await W.goto('/richieste', { waitUntil: 'domcontentloaded' })
    await W.waitForTimeout(1200)
    const w = await W.evaluate(() => {
      const tab = document.querySelector('table')
      const sc = tab.parentElement
      return { scorrimento: sc.scrollWidth - sc.clientWidth, th: [...tab.querySelectorAll('thead th')].filter((x) => x.offsetParent).map((x) => x.textContent.trim()) }
    })
    await ok(t, '1536x864: tabella con CAP e Citta\' senza scorrimento laterale', w.scorrimento <= 1 && w.th.some((x) => /^cap/i.test(x)) && w.th.some((x) => /^citt/i.test(x)), JSON.stringify(w))
  })

  for (const [nome, chi] of [['admin', ADMIN], ['Angela', ANGELA]]) {
    await sezione(t, `richieste 1024x1366 ${nome}`, async () => {
      const { page: T } = await apri(t, chi, 1024, 1366, `${nome} 1024x1366`, false)
      await T.goto('/richieste', { waitUntil: 'domcontentloaded' })
      await T.waitForTimeout(1200)
      await ok(t, `1024x1366 ${nome}: schede, non tabella`, !(await T.locator('table').isVisible().catch(() => false)) && (await T.locator('main [role="button"]').count()) > 0)
      await ok(t, `1024x1366 ${nome}: niente scorrimento laterale`, !(await T.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)))
      if (chi === ANGELA) {
        await ok(t, '1024x1366 Angela: Accetta e Rifiuta nelle schede', (await T.locator('button[aria-label^="Accetta la pulizia"]').count()) > 0 && (await T.locator('button[aria-label^="Rifiuta la pulizia"]').count()) > 0)
      }
    })

    await sezione(t, `richieste 1280x800 ${nome}`, async () => {
      const { page: D } = await apri(t, chi, 1280, 800, `${nome} 1280x800`, false)
      await D.goto('/richieste', { waitUntil: 'domcontentloaded' })
      await D.waitForTimeout(1200)
      await ok(t, `1280x800 ${nome}: tabella visibile`, await D.locator('table').isVisible())
      const m = await D.evaluate(() => {
        const tab = document.querySelector('table')
        const scroller = tab.parentElement
        const th = [...tab.querySelectorAll('thead th')].filter((x) => x.offsetParent).map((x) => x.textContent.trim())
        const chip = [...tab.querySelectorAll('tbody tr:first-child td span')].find((s) => /Attesa|Accettata|Completata|Cancellata|Corso|Verific/.test(s.textContent) && s.className.includes('rounded'))
        const cr = chip?.getBoundingClientRect()
        return {
          tabella: Math.round(tab.getBoundingClientRect().width), contenitore: scroller.clientWidth,
          scorrimento: scroller.scrollWidth - scroller.clientWidth,
          larghezze: [...tab.querySelectorAll('thead th')].filter((x) => x.offsetParent).map((x) => Math.round(x.getBoundingClientRect().width)),
          th, chipH: cr ? Math.round(cr.height) : null, nowrap: chip ? getComputedStyle(chip).whiteSpace : null,
          scrollPagina: document.documentElement.scrollWidth - window.innerWidth,
        }
      })
      await ok(t, `1280x800 ${nome}: la tabella sta nel contenitore (niente scorrimento laterale)`, m.scorrimento <= 1, JSON.stringify(m))
      await ok(t, `1280x800 ${nome}: CAP/Quartiere e Città nascosti sotto 2xl`, !m.th.some((x) => /^cap/i.test(x)) && !m.th.some((x) => /^citt/i.test(x)), m.th.join('|'))
      const iOut = m.th.findIndex((x) => /^check-out/i.test(x))
      const iCre = m.th.findIndex((x) => /^creazione/i.test(x))
      await ok(t, `1280x800 ${nome}: Check-out prima di Creazione`, iOut > 0 && iCre > iOut, m.th.join('|'))
      await ok(t, `1280x800 ${nome}: lo stato non va a capo`, m.nowrap === 'nowrap' && m.chipH !== null && m.chipH < 28, JSON.stringify({ n: m.nowrap, h: m.chipH }))
      const ultima = D.locator('table thead th:visible').last()
      const bb = await ultima.boundingBox()
      await ok(t, `1280x800 ${nome}: ultima colonna dentro lo schermo`, bb && bb.x + bb.width <= 1280.5, JSON.stringify(bb))
      if (chi === ANGELA) {
        const acc = D.locator('table button[aria-label^="Accetta la pulizia"]').first()
        const rif = D.locator('table button[aria-label^="Rifiuta la pulizia"]').first()
        const ba = await acc.boundingBox()
        const br = await rif.boundingBox()
        await ok(t, '1280x800 Angela: Accetta e Rifiuta raggiungibili nella tabella',
          ba && br && ba.x >= 0 && br.x + br.width <= 1280 && ba.width >= 30, JSON.stringify({ ba, br }))
        const prima = await D.locator('table tbody tr').count()
        await acc.click()
        await D.waitForTimeout(500)
        await ok(t, '1280x800 Angela: Accetta dalla tabella risponde (toast)', await D.getByText('Pulizia accettata').first().isVisible())
        void prima
      }
    })
  }
}
