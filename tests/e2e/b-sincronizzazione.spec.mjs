/*
 * Sincronizzazione fra dispositivi: la ditta accetta una pulizia dal telefono
 * e il manager la vede accettata, anche dopo aver ricaricato l'app e anche da
 * un terzo dispositivo che entra per la prima volta.
 */
import {
  ADMIN, ANGELA, accedi, aspetta, aspettaScambio, aspettaStato, assert, pausa, preparaArchivio, richiestaLocale, stato,
} from './lib.mjs'

export default async function (t) {
  await preparaArchivio(t)

  const manager = await t.telefono()
  const angela = await t.telefono()
  await accedi(manager.page, ADMIN)
  await accedi(angela.page, ANGELA)
  await aspettaScambio(angela.page, 'Angela')

  let id = null

  await t.check('Angela accetta una pulizia da /richieste', async () => {
    await angela.page.goto('/richieste')
    const bottone = angela.page.locator('[aria-label^="Accetta la pulizia"]:visible').first()
    await bottone.waitFor({ timeout: 20_000 })
    const prima = new Map((await stato(angela.page)).requests.map((r) => [r.id, r.status]))
    await bottone.click()
    id = await aspetta(async () => (await stato(angela.page)).requests
      .find((r) => r.status === 'accettata' && prima.get(r.id) === 'in_attesa')?.id, 'nessuna pulizia passata ad accettata', 5_000)
    t.log(`pulizia accettata: ${id}`)
  })
  assert(id, 'senza pulizia accettata il resto non ha senso')

  await t.check('il telefono del manager la vede accettata', async () => {
    await aspettaStato(manager.page, id, 'accettata', 'manager')
  })

  await t.check('dopo aver ricaricato l\'app il manager la vede ancora accettata', async () => {
    await manager.page.reload()
    await manager.page.waitForURL(/\/calendario/)
    /* Almeno un giro di scambio completo dopo il riavvio. */
    await pausa(9_000)
    const r = await richiestaLocale(manager.page, id)
    assert(r?.status === 'accettata', `dopo il riavvio lo stato e' ${r?.status}`)
  })

  await t.check('un terzo dispositivo nuovo la vede accettata', async () => {
    const terzo = await t.telefono()
    await accedi(terzo.page, ADMIN)
    await aspettaStato(terzo.page, id, 'accettata', 'terzo dispositivo')
  })

  await t.check('nessun errore nelle pagine', async () => {
    const errori = [...manager.errori, ...angela.errori]
    assert(errori.length === 0, errori.join('\n'))
  })
}
