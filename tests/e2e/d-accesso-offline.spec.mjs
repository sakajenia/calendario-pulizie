/*
 * Accesso senza rete. Su un telefono che non e' mai entrato con la rete non
 * si entra con nessuna password; dopo un accesso con la rete, senza rete vale
 * solo la password giusta.
 */
import { ADMIN, accedi, assert } from './lib.mjs'

/** Tutte le chiamate all'archivio cadono, come col telefono senza rete. */
const staccaRete = (page) => page.route('**/api/**', (r) => r.abort('internetdisconnected'))
const riattaccaRete = (page) => page.unroute('**/api/**')

async function provaAccesso(page, password) {
  await page.goto('/login')
  await page.locator('#login-email').fill(ADMIN.id)
  await page.locator('#login-password').fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  /* O si entra (calendario) o compare un errore. */
  const esito = await Promise.race([
    page.waitForURL(/\/calendario/, { timeout: 15_000 }).then(() => 'dentro'),
    page.getByRole('alert').first().waitFor({ timeout: 15_000 }).then(() => 'errore'),
  ])
  const testo = esito === 'errore' ? await page.getByRole('alert').first().innerText() : ''
  return { esito, testo }
}

async function esci(page) {
  /* Il menu utente in alto a destra, voce "Logout". */
  await page.getByRole('button', { name: 'Notifiche' }).locator('xpath=following-sibling::*[1]//button | following-sibling::button[1]').first().click()
  await page.getByRole('menuitem', { name: 'Logout' }).click()
  await page.waitForURL(/\/login/)
}

export default async function (t) {
  const { page } = await t.telefono()

  await t.check('dispositivo nuovo senza rete: rifiutata la password giusta ("Serve la connessione")', async () => {
    await staccaRete(page)
    const { esito, testo } = await provaAccesso(page, ADMIN.password)
    assert(esito === 'errore', `esito: ${esito}`)
    assert(/Serve la connessione/.test(testo), `messaggio: ${testo}`)
  })

  await t.check('dispositivo nuovo senza rete: rifiutata anche una password qualsiasi', async () => {
    const { esito, testo } = await provaAccesso(page, 'qualsiasi-cosa-123')
    assert(esito === 'errore' && /Serve la connessione/.test(testo), `esito: ${esito} ${testo}`)
  })

  await t.check('con la rete l\'accesso riesce', async () => {
    await riattaccaRete(page)
    await accedi(page, ADMIN)
    await esci(page)
  })

  await t.check('poi senza rete: password sbagliata rifiutata', async () => {
    await staccaRete(page)
    const { esito, testo } = await provaAccesso(page, 'propromanagerX')
    assert(esito === 'errore', `esito: ${esito}`)
    assert(/Password errata/i.test(testo), `messaggio: ${testo}`)
  })

  await t.check('poi senza rete: password giusta accettata', async () => {
    const { esito, testo } = await provaAccesso(page, ADMIN.password)
    assert(esito === 'dentro', `esito: ${esito} ${testo}`)
  })
}
