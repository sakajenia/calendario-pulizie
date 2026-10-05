/*
 * L'"Annulla" della ditta arriva all'archivio. Prima il rifiuto annullato
 * (cancellata -> in attesa) e la chiusura annullata di una pulizia in corso
 * (completata -> in corso) erano passaggi che il Worker scartava in silenzio:
 * il telefono di Angela mostrava la pulizia riaperta, l'archivio no, e
 * nessun giro di scambio li rimetteva d'accordo.
 *
 * Ogni gesto aspetta che l'archivio abbia il primo passaggio (rifiutata,
 * completata) prima di premere "Annulla": altrimenti partirebbe solo la
 * differenza netta e il passaggio da controllare non si vedrebbe mai.
 */
import {
  ADMIN, ANGELA, CASE_ANGELA, accedi, aspetta, aspettaScambio, aspettaStato, assert, gettoneApi, leggiArchivio,
  pausa, preparaArchivio, richiestaLocale, stato,
} from './lib.mjs'

/** La copia dell'archivio di una pulizia, letta con il gettone del manager. */
async function sulServer(t, gettone, id) {
  return (await leggiArchivio(t.base, gettone)).find((r) => r.tipo === 'requests' && r.id === id)?.dati ?? null
}

/** Un giro di scambio subito, senza aspettare il battito (vedi `useArchivioCondiviso`). */
const giro = (page) => page.evaluate(() => window.dispatchEvent(new Event('online')))

/** Aspetta che l'archivio abbia la pulizia nello stato voluto, spingendo i giri. */
async function aspettaSulServer(t, page, gettone, id, status, cosa, timeout = 6_000) {
  return aspetta(async () => {
    await giro(page)
    return (await sulServer(t, gettone, id))?.status === status
  }, `${cosa}: sull'archivio la pulizia ${id} non e' "${status}"`, timeout, 300)
}

/** Il pulsante "Annulla" del riscontro appena comparso. */
const annulla = (page) => page.locator('button', { hasText: /^\s*Annulla\s*$/ }).last()

/** Due giri completi di scambio, poi telefono e archivio devono dire la stessa cosa. */
async function dopoDueGiri(t, page, gettone, id, status, cosa) {
  await pausa(16_000)
  const qui = await richiestaLocale(page, id)
  const la = await sulServer(t, gettone, id)
  assert(qui?.status === status, `${cosa}: sul telefono e' "${qui?.status}", atteso "${status}"`)
  assert(la?.status === status, `${cosa}: sull'archivio e' "${la?.status}", atteso "${status}"`)
  return { qui, la }
}

export default async function (t) {
  await preparaArchivio(t)
  const gAdmin = await gettoneApi(t.base, ADMIN)
  const angela = await t.telefono()
  const P = angela.page
  await accedi(P, ANGELA)
  await aspettaScambio(P, 'Angela')

  /* ------------------------------------------------ Rifiuta -> Annulla */
  let rifiutata = null
  await t.check('Angela rifiuta una pulizia e l\'archivio la vede cancellata', async () => {
    await P.goto('/richieste')
    const bottone = P.locator('[aria-label^="Rifiuta la pulizia"]:visible').first()
    await bottone.waitFor({ timeout: 20_000 })
    const prima = new Map((await stato(P)).requests.map((r) => [r.id, r.status]))
    await bottone.click()
    rifiutata = await aspetta(async () => (await stato(P)).requests
      .find((r) => r.status === 'cancellata' && prima.get(r.id) === 'in_attesa')?.id, 'nessuna pulizia rifiutata', 5_000)
    await aspettaSulServer(t, P, gAdmin, rifiutata, 'cancellata', 'rifiuto')
    t.log(`pulizia rifiutata: ${rifiutata}`)
  })

  if (rifiutata) {
    await t.check('"Annulla" del rifiuto: dopo due giri telefono e archivio dicono "in attesa"', async () => {
      await annulla(P).click()
      await aspettaStato(P, rifiutata, 'in_attesa', 'telefono dopo Annulla')
      await dopoDueGiri(t, P, gAdmin, rifiutata, 'in_attesa', 'rifiuto annullato')
    })
  }

  /* ------------------------------------- Completa (in corso) -> Annulla */
  let inCorso = null
  await t.check('il manager mette in corso una pulizia di Angela e il telefono la riceve', async () => {
    const libere = (await leggiArchivio(t.base, gAdmin))
      .filter((r) => r.tipo === 'requests' && !r.eliminato && CASE_ANGELA.includes(r.dati?.apartmentId)
        && r.dati?.status === 'in_attesa' && r.id !== rifiutata)
    assert(libere.length > 0, 'nessuna pulizia in attesa nelle case di Angela')
    const scelta = libere[0].dati
    inCorso = scelta.id
    const risposta = await fetch(`${t.base}/api/dati`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${gAdmin}` },
      body: JSON.stringify({ record: [{ tipo: 'requests', id: inCorso, dati: {
        ...scelta, status: 'in_corso', assigneeId: ANGELA.userId, updatedAt: new Date().toISOString(), updatedById: ADMIN.userId,
      } }] }),
    })
    assert(risposta.ok, `scrittura del manager: ${risposta.status}`)
    await aspettaStato(P, inCorso, 'in_corso', 'Angela')
    t.log(`pulizia in corso: ${inCorso}`)
  })

  if (inCorso) {
    let completata = null
    await t.check('Angela la segna completata dal dettaglio e l\'archivio la vede completata', async () => {
      await P.goto('/richieste?stato=in_corso')
      const scheda = P.locator('[role="button"]:visible').filter({ hasText: /In corso/i }).first()
      await scheda.waitFor({ timeout: 20_000 })
      const prima = new Map((await stato(P)).requests.map((r) => [r.id, r.status]))
      await scheda.click()
      await P.getByRole('button', { name: /Segna come completata/ }).filter({ visible: true }).first().click()
      completata = await aspetta(async () => (await stato(P)).requests
        .find((r) => r.status === 'completata' && prima.get(r.id) === 'in_corso')?.id, 'nessuna pulizia completata', 5_000)
      await aspettaSulServer(t, P, gAdmin, completata, 'completata', 'completamento')
    })

    if (completata) {
      await t.check('"Annulla" della chiusura: dopo due giri telefono e archivio dicono "in corso", senza data di chiusura', async () => {
        await annulla(P).click()
        await aspettaStato(P, completata, 'in_corso', 'telefono dopo Annulla')
        const { qui, la } = await dopoDueGiri(t, P, gAdmin, completata, 'in_corso', 'chiusura annullata')
        assert(!la.completedAt && !la.completedById, `sull'archivio resta la chiusura: ${la.completedAt} ${la.completedById}`)
        assert(!qui.completedAt, `sul telefono resta la chiusura: ${qui.completedAt}`)
      })
    }
  }

  await t.check('nessun errore nelle pagine', async () => {
    assert(angela.errori.length === 0, angela.errori.join('\n'))
  })
}
