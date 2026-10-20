/*
 * Link fissi di Accessi: "Viale Quattro Venti" (casa creata in app) e
 * "Stazione Centrale Roma" mostrano i link nuovi su telefono e computer, per
 * il manager e per la ditta; le altre case hanno gli stessi link di prima.
 */
import {
  ADMIN, ANGELA, accedi, aspetta, aspettaScambio, gettoneApi, ok, preparaArchivio, sezione,
} from './lib.mjs'

const QV = { comeLasciare: 'https://tools.affittibreviaroma.com/quattro-venti', infoAccessi: 'https://drive.google.com/drive/folders/1w6zCU-WDmRGQPbnm0cv-hOMjNBVlK8b1?usp=sharing' }
const LABICANA = { comeLasciare: 'https://tools.affittibreviaroma.com/check-llabicana-19', infoAccessi: 'https://drive.google.com/drive/folders/1nfdd2tdzYd_5TanFMHZ2yPAqCbiNWbkp?usp=drive_link' }
/* Case di Angela gia' con link: devono restare come prima. */
const ALTRE = {
  'KlaFrà': { comeLasciare: 'https://tools.affittibreviaroma.com/check-marsi-1', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1b0mqlTynQWiww8yRbqKvu-fb8DSxQ522' },
  Consoli: { comeLasciare: 'https://tools.affittibreviaroma.com/check-consoli-5', infoAccessi: 'https://drive.google.com/drive/u/2/folders/1qfSnM4Qw8NfQjsDNsMkMJu7FzmH2-d8A' },
  'Villa di Prestigio': { comeLasciare: null, infoAccessi: 'https://drive.google.com/drive/folders/1L1pMBkaNfM5knj-qqvVyNZgSLu7LBnaF?usp=drive_link' },
}
const ID_QV = 'ap-e2e-quattro-venti'

/** I due link della scheda di una casa nella pagina Accessi (null se manca). */
async function linkScheda(page, nome) {
  const scheda = page.locator('div.flex-col.overflow-hidden').filter({ has: page.getByRole('heading', { name: nome, exact: true }) }).last()
  await scheda.waitFor({ timeout: 20_000 })
  const href = async (label) => {
    const a = scheda.locator('a', { hasText: label })
    return (await a.count()) ? a.first().getAttribute('href') : null
  }
  return { comeLasciare: await href('Come lasciare la casa'), infoAccessi: await href('Info accessi e materiali') }
}

export default async function (t) {
  await preparaArchivio(t)

  /* La casa come la crea un manager dall'app: nessun link salvato. */
  const gAdmin = await gettoneApi(t.base, ADMIN)
  const r = await fetch(`${t.base}/api/dati`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${gAdmin}` },
    body: JSON.stringify({ record: [{ tipo: 'apartments', id: ID_QV, dati: {
      id: ID_QV, name: 'Viale Quattro Venti', address: 'Viale dei Quattro Venti 87', district: 'Monteverde', city: 'Roma',
      ownerId: ADMIN.userId, companyId: 'angela', beds: [{ id: 'b-qv-1', type: 'matrimoniale' }],
      visibility: 'official', provider: 'none', prices: { base: 50, min: 50, max: 50 },
      access: { entries: [], notes: '' }, createdAt: new Date().toISOString(),
    } }] }),
  })
  await ok(t, 'il manager salva la casa Viale Quattro Venti', r.ok, String(r.status))

  const dispositivi = [
    { chi: ADMIN, nome: 'manager da computer', schermo: { width: 1280, height: 800, mobile: false } },
    { chi: ADMIN, nome: 'manager da telefono', schermo: { width: 390, height: 844, mobile: true } },
    { chi: ANGELA, nome: 'Angela da telefono', schermo: { width: 390, height: 844, mobile: true } },
    { chi: ANGELA, nome: 'Angela da computer', schermo: { width: 1280, height: 800, mobile: false } },
  ]
  for (const d of dispositivi) {
    await sezione(t, d.nome, async () => {
      const { page } = await t.telefono(d.schermo)
      await accedi(page, d.chi)
      await aspettaScambio(page, d.nome)
      await page.goto('/accessi', { waitUntil: 'domcontentloaded' })
      await aspetta(async () => (await page.locator('h2', { hasText: 'Viale Quattro Venti' }).count()) > 0,
        `${d.nome}: la scheda Viale Quattro Venti non compare`)

      const qv = await linkScheda(page, 'Viale Quattro Venti')
      await ok(t, `${d.nome}: Viale Quattro Venti ha i due link`, qv.comeLasciare === QV.comeLasciare && qv.infoAccessi === QV.infoAccessi, JSON.stringify(qv))
      const lab = await linkScheda(page, 'Stazione Centrale Roma')
      await ok(t, `${d.nome}: Stazione Centrale Roma ha "come lasciare la casa"`, lab.comeLasciare === LABICANA.comeLasciare && lab.infoAccessi === LABICANA.infoAccessi, JSON.stringify(lab))
      for (const [nome, atteso] of Object.entries(ALTRE)) {
        const l = await linkScheda(page, nome)
        await ok(t, `${d.nome}: ${nome} ha gli stessi link di prima`, l.comeLasciare === atteso.comeLasciare && l.infoAccessi === atteso.infoAccessi, JSON.stringify(l))
      }
    })
  }
}
