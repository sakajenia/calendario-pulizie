/*
 * Guscio dell'app: menu avatar e palette dei comandi (manager e ditta),
 * barra in alto e menu a cassetto sul telefono a 360 px, dialog e badge
 * della campanella, guida del primo accesso, area di tocco delle caselle.
 */
import {
  ADMIN, ANGELA, accedi, ok, preparaArchivio, sezione,
} from './lib.mjs'

export default async function (t) {
  await preparaArchivio(t)

  /* ---- Desktop: menu avatar e palette (manager e ditta) ---- */
  for (const [nome, chi, atteso] of [['admin', ADMIN, true], ['Angela', ANGELA, false]]) {
    await sezione(t, `desktop ${nome}`, async () => {
      const { page: p } = await t.telefono({ width: 1280, height: nome === 'admin' ? 800 : 900, mobile: false })
      await accedi(p, chi)
      await p.waitForTimeout(500)
      await p.locator('header button[aria-haspopup="menu"]').click()
      await p.waitForTimeout(300)
      const menu = await p.locator('[role="menu"]').innerText()
      await ok(t, `${nome}: menu avatar ${atteso ? 'ha' : 'NON ha'} "Cambia profilo"`, /cambia profilo/i.test(menu) === atteso)
      await ok(t, `${nome}: menu avatar ha Logout`, menu.includes('Logout'))
      await p.keyboard.press('Escape')
      await p.keyboard.press('Control+k')
      await p.waitForTimeout(300)
      const pal = await p.locator('[role="dialog"], [role="listbox"]').allInnerTexts()
      const tutto = pal.join('\n')
      await ok(t, `${nome}: palette aperta`, tutto.includes('Vai a') || tutto.includes('Calendario'))
      await ok(t, `${nome}: palette ${atteso ? 'ha' : 'NON ha'} "Cambia profilo"`, /cambia profilo/i.test(tutto) === atteso)
      await p.keyboard.press('Escape')
      await p.waitForTimeout(300)

      /* ---- FirstRunGuide (stesso dispositivo: l'accesso e' gia' fatto) ---- */
      if (nome === 'admin') {
        await ok(t, 'guida: compatta a 1280x800 (passi nascosti)', !(await p.locator('#guida-dettagli').isVisible()) && await p.locator('#guida-titolo').isVisible())
        await p.setViewportSize({ width: 1440, height: 950 })
        await p.waitForTimeout(300)
        await ok(t, 'guida: estesa a 1440x950', await p.locator('#guida-dettagli').isVisible())
        const k = await p.evaluate(() => { document.querySelector('button[aria-label="Nascondi la guida"]').click(); return Object.keys(localStorage).filter((x) => x.startsWith('ppm-guide')) })
        await ok(t, 'guida: chiave per utente', k.length === 1 && k[0].startsWith('ppm-guide-dismissed:'), k.join())
      } else {
        await p.setViewportSize({ width: 1440, height: 950 })
        await p.waitForTimeout(300)
        await ok(t, 'guida: assente per ditta di pulizie', (await p.locator('#guida-titolo').count()) === 0)
      }
    })
  }

  /* ---- Mobile 360: barra in alto e menu a cassetto (ditta) ---- */
  await sezione(t, 'mobile 360 Angela', async () => {
    const { page: p } = await t.telefono({ width: 360, height: 740 })
    await accedi(p, ANGELA)
    await p.waitForTimeout(500)
    const menuBtn = p.getByRole('button', { name: 'Menu', exact: true })
    for (const nm of ['Menu', 'Cambia tema', 'Notifiche']) {
      const bb = await p.locator(`header button[aria-label="${nm}"]`).boundingBox()
      await ok(t, `header ${nm} >= 40x40`, bb.width >= 40 && bb.height >= 40, `${bb.width}x${bb.height}`)
    }
    // Drawer: Escape
    await menuBtn.click()
    const dlg = p.getByRole('dialog', { name: 'Menu' })
    await ok(t, 'drawer aperto con role=dialog aria-modal', await dlg.isVisible() && (await dlg.getAttribute('aria-modal')) === 'true')
    await ok(t, 'focus sul pulsante chiudi', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Chiudi il menu')
    await p.keyboard.press('Escape')
    await p.waitForTimeout(200)
    await ok(t, 'Escape chiude il drawer', !(await dlg.isVisible().catch(() => false)))
    await ok(t, 'focus torna al pulsante Menu', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Menu')
    // Drawer: X
    await menuBtn.click()
    await p.getByRole('button', { name: 'Chiudi il menu' }).click()
    await p.waitForTimeout(200)
    await ok(t, 'la X chiude il drawer', !(await dlg.isVisible().catch(() => false)))
    await ok(t, 'focus torna al pulsante Menu (X)', await p.evaluate(() => document.activeElement?.getAttribute('aria-label')) === 'Menu')
    // Backdrop
    await menuBtn.click()
    await p.mouse.click(340, 400)
    await p.waitForTimeout(200)
    await ok(t, 'click sullo sfondo chiude', !(await dlg.isVisible().catch(() => false)))
  })

  /* ---- Mobile 360 manager: guida, dialog, campanella; poi area di tocco ---- */
  await sezione(t, 'mobile 360 admin', async () => {
    const { page: p } = await t.telefono({ width: 360, height: 740 })
    await accedi(p, ADMIN)
    await p.waitForTimeout(500)
    // FirstRunGuide a 360: il titolo non e' troncato
    const h = await p.locator('#guida-titolo').boundingBox()
    const sc = await p.evaluate(() => { const e = document.querySelector('#guida-titolo'); return e.scrollWidth <= e.clientWidth })
    await ok(t, 'guida 360: titolo non troncato', sc, JSON.stringify(h))

    // Dialog 360
    await p.goto('/utenti')
    await p.waitForTimeout(600)
    // apre un dialog qualunque: "Nuovo utente" o simile
    const aprire = p.getByRole('button', { name: /nuov/i }).first()
    await aprire.click().catch(() => {})
    await p.waitForTimeout(500)
    const chiudi = p.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).first()
    if (await chiudi.count()) {
      const bb = await chiudi.boundingBox()
      await ok(t, 'dialog: Chiudi >= 40 di larghezza a 360', bb.width >= 40 && bb.height >= 40, `${bb.width}x${bb.height}`)
    } else {
      await ok(t, 'dialog aperto', false, 'nessun dialog trovato')
    }
    await p.keyboard.press('Escape')
    // Campanella: forza un badge se non c'e'
    const badge = p.locator('header button[aria-label="Notifiche"] span')
    const n = await badge.count()
    if (!n) {
      await p.evaluate(() => {
        const bt = document.querySelector('header button[aria-label="Notifiche"]')
        const s = document.createElement('span')
        s.className = 'absolute -right-1.5 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold leading-none text-primary-foreground'
        s.id = 'badge-finto'; s.textContent = '99+'; bt.appendChild(s)
      })
    }
    const bd = p.locator('header button[aria-label="Notifiche"] span').first()
    const bbBadge = await bd.boundingBox()
    const bbIcon = await p.locator('header button[aria-label="Notifiche"] svg').boundingBox()
    const inter = !(bbBadge.x + bbBadge.width <= bbIcon.x || bbIcon.x + bbIcon.width <= bbBadge.x || bbBadge.y + bbBadge.height <= bbIcon.y || bbIcon.y + bbIcon.height <= bbBadge.y)
    await ok(t, `campanella: badge${n ? '' : ' (simulato 99+)'} non copre l'icona`, !inter, JSON.stringify({ bbBadge, bbIcon }))
    const fs = await bd.evaluate((e) => getComputedStyle(e).fontSize)
    await ok(t, 'badge testo >= 11px', parseFloat(fs) >= 11, fs)

    // Hit area (pointer coarse): stesso dispositivo a tocco, schermo largo 1280x900
    await p.setViewportSize({ width: 1280, height: 900 })
    await p.goto('/richieste')
    await p.waitForTimeout(800)
    const r = await p.evaluate(() => {
      const cb = [...document.querySelectorAll('[role="checkbox"]')].find((e) => e.getBoundingClientRect().width > 0)
      if (!cb) return null
      const st = getComputedStyle(cb, '::before')
      return { pos: st.position, w: st.width, h: st.height, box: cb.getBoundingClientRect().width }
    })
    await ok(t, 'checkbox: 16px visivi, hit area 40 su touch', r && r.box === 16 && parseFloat(r.w) >= 40 && parseFloat(r.h) >= 40, JSON.stringify(r))
  })
}
