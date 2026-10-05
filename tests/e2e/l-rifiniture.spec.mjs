/*
 * Rifiniture del terzo giro: il check-in segue il check-out nel modulo,
 * Accessi e Compensi nella ricerca rapida, "Segna come completata" grande
 * abbastanza al tocco, menu laterale intero con il telefono in orizzontale.
 */
import { ADMIN, accedi, assert, preparaArchivio } from './lib.mjs'

const toLocal = (d) => {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export default async function (t) {
  await preparaArchivio(t)

  const { page } = await t.telefono()
  await accedi(page, ADMIN)

  await t.check('modulo: spostando il check-out dopo il check-in, il check-in lo segue', async () => {
    await page.goto('/calendario?nuova=1')
    const dlg = page.getByRole('dialog')
    await dlg.waitFor()
    const campi = dlg.locator('input[type="datetime-local"]')
    const domani = new Date(); domani.setDate(domani.getDate() + 3); domani.setHours(10, 0, 0, 0)
    await campi.nth(0).fill(toLocal(domani))
    const uscita = new Date(await campi.nth(0).inputValue())
    const arrivo = new Date(await campi.nth(1).inputValue())
    assert(arrivo >= uscita, `check-in ${arrivo.toISOString()} prima del check-out ${uscita.toISOString()}`)
    assert(arrivo.toDateString() === uscita.toDateString(), 'il check-in non e\' passato allo stesso giorno')
    await page.keyboard.press('Escape')
  })

  await t.check('ricerca rapida: ci sono Accessi e Compensi (admin)', async () => {
    await page.goto('/calendario')
    await page.evaluate(() => document.dispatchEvent(new CustomEvent('ppm:command-palette')))
    const voci = await page.getByRole('dialog').innerText()
    assert(/Accessi/.test(voci) && /Compensi/.test(voci), voci.slice(0, 200))
    await page.keyboard.press('Escape')
  })

  const { page: lato } = await t.telefono({ width: 844, height: 390 })
  await t.check('telefono in orizzontale: nel menu laterale si vede Compensi senza scorrere', async () => {
    await accedi(lato, ADMIN)
    await lato.getByRole('button', { name: 'Menu' }).first().click()
    const menu = lato.getByRole('dialog', { name: 'Menu' })
    await menu.waitFor()
    const voce = menu.getByRole('link', { name: 'Compensi' })
    const box = await voce.boundingBox()
    assert(box && box.y + box.height <= 390, `Compensi a y=${box?.y}`)
  })
}
