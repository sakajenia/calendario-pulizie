/*
 * Tutte le pagine, per il manager e per la ditta, a tre larghezze (telefono,
 * tablet, computer): la pagina si apre (niente schermata "Questa pagina non
 * si e' aperta"), non scorre di lato e non lascia errori in console.
 */
import { ADMIN, ANGELA, accedi, assert, pausa, preparaArchivio } from './lib.mjs'

const PAGINE = [
  { percorso: '/calendario' },
  { percorso: '/calendario?vista=controlli', soloAdmin: true },
  { percorso: '/richieste' },
  { percorso: '/accessi' },
  { percorso: '/appartamenti', soloAdmin: true },
  { percorso: '/dashboard' },
  { percorso: '/utenti' },
  { percorso: '/spese-amministrative' },
  { percorso: '/catalogo-task' },
  { percorso: '/compensi', soloAdmin: true },
  { percorso: '/notifiche' },
  { percorso: '/impostazioni' },
]

const LARGHEZZE = [
  { width: 390, height: 844, mobile: true },
  { width: 768, height: 1024, mobile: false },
  { width: 1280, height: 800, mobile: false },
]

const UTENTI = [
  { nome: 'admin', chi: ADMIN, admin: true },
  { nome: 'Angela', chi: ANGELA, admin: false },
]

export default async function (t) {
  await preparaArchivio(t)

  for (const utente of UTENTI) {
    for (const misura of LARGHEZZE) {
      const { page, errori, context } = await t.telefono(misura)
      await accedi(page, utente.chi)

      for (const { percorso, soloAdmin } of PAGINE) {
        if (soloAdmin && !utente.admin) continue
        await t.check(`${utente.nome} ${misura.width}px ${percorso}`, async () => {
          const prima = errori.length
          await page.goto(percorso)
          const main = page.locator('main')
          await main.waitFor()
          /* La pagina ha finito di disegnarsi quando dentro <main> c'e' testo. */
          await page.waitForFunction(() => (document.querySelector('main')?.innerText ?? '').trim().length > 20)
          await pausa(600)
          const testo = await main.innerText()
          assert(!testo.includes('Questa pagina non si'), `schermata di errore: ${testo.slice(0, 200)}`)
          const { scroll, larga } = await page.evaluate(() => ({
            scroll: document.documentElement.scrollWidth, larga: window.innerWidth,
          }))
          assert(scroll <= larga + 1, `scorre di lato: scrollWidth ${scroll} > innerWidth ${larga}`)
          const nuovi = errori.slice(prima)
          assert(nuovi.length === 0, nuovi.join('\n'))
        })
      }
      await context.close()
    }
  }
}
