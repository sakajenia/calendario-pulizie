/*
 * Sessione scaduta: il gettone di Angela non vale piu' mentre sul telefono
 * c'e' lavoro non ancora mandato (una pulizia accettata). L'app deve tornare
 * all'accesso con l'avviso, e dopo il nuovo accesso il lavoro deve partire e
 * arrivare al manager, non andare perso.
 */
import {
  ADMIN, ANGELA, accedi, aspettaScambio, aspettaStato, assert, pausa, preparaArchivio, pulizieInAttesaAngela,
  richiestaLocale,
} from './lib.mjs'

export default async function (t) {
  await preparaArchivio(t)

  const manager = await t.telefono()
  const angela = await t.telefono()
  await accedi(manager.page, ADMIN)
  await accedi(angela.page, ANGELA)
  await aspettaScambio(angela.page, 'Angela')

  const [scelta] = await pulizieInAttesaAngela(angela.page)
  assert(scelta, 'nessuna pulizia in attesa per Angela')
  const id = scelta.id
  t.log(`pulizia: ${id}`)

  await t.check('gettone rovinato + pulizia accettata sul telefono -> /login con "Sessione scaduta"', async () => {
    /* Tutto in un solo passaggio sincrono, ricarica compresa: l'app non ha il
       tempo di riscrivere localStorage fra la modifica e il riavvio. */
    await angela.page.evaluate(({ id, utente }) => {
      const grezzo = JSON.parse(localStorage.getItem('propromanager-state'))
      const adesso = new Date().toISOString()
      grezzo.state.requests = grezzo.state.requests.map((r) => (r.id === id
        ? { ...r, status: 'accettata', assigneeId: utente, updatedAt: adesso, updatedById: utente }
        : r))
      localStorage.setItem('propromanager-state', JSON.stringify(grezzo))
      const gettone = localStorage.getItem('ppm-gettone')
      /* La firma (esadecimale in coda) cambia: il gettone non e' piu' valido. */
      const rovinato = gettone.replace(/[0-9a-f]{16}$/, (h) => h.split('').reverse().map((c) => (c === '0' ? '1' : '0')).join(''))
      if (rovinato === gettone) throw new Error('gettone senza firma esadecimale')
      localStorage.setItem('ppm-gettone', rovinato)
      location.reload()
    }, { id, utente: ANGELA.userId })
    await angela.page.waitForURL(/\/login/, { timeout: 30_000 })
    await angela.page.getByText('Sessione scaduta').first().waitFor({ timeout: 10_000 })
  })

  await t.check('il lavoro fatto sul telefono non si perde col ritorno all\'accesso', async () => {
    const r = await richiestaLocale(angela.page, id)
    assert(r?.status === 'accettata', `sul telefono la pulizia e' ${r?.status}`)
  })

  await t.check('dopo il nuovo accesso la pulizia resta accettata', async () => {
    await accedi(angela.page, ANGELA)
    await pausa(9_000)
    const r = await richiestaLocale(angela.page, id)
    assert(r?.status === 'accettata', `dopo l'accesso la pulizia e' ${r?.status}`)
  })

  await t.check('il manager la vede accettata', async () => {
    await aspettaStato(manager.page, id, 'accettata', 'manager')
  })

  await t.check('nessun errore di pagina', async () => {
    /* Le chiamate rifiutate (401) compaiono come "Failed to load resource":
       sono attese qui, gli errori di JavaScript no. */
    const errori = [...manager.errori, ...angela.errori].filter((e) => !/status of 401/.test(e))
    assert(errori.length === 0, errori.join('\n'))
  })
}
