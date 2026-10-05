/*
 * Scheda di lavoro della nuova richiesta: Pulizia, Check-in o tutti e due.
 * Il solo check-in si salva senza pulizia e con check-out = check-in; la
 * ditta lo vede come "Solo check-in" nelle richieste e col pallino blu nel
 * calendario.
 */
import {
  ADMIN, ANGELA, accedi, aspetta, aspettaScambio, assert, preparaArchivio, stato,
} from './lib.mjs'

const CASA = 'ap-marsi' // KlaFrà, affidata ad Angela

async function apriNuova(page) {
  await page.goto('/calendario?nuova=1')
  const dialogo = page.getByRole('dialog')
  await dialogo.getByRole('checkbox', { name: 'Pulizia', exact: true }).waitFor({ timeout: 15_000 })
  /* La casa: la prima tendina del modulo, quella con le case. */
  await dialogo.locator(`select:has(option[value="${CASA}"])`).first().selectOption(CASA)
  return dialogo
}

/** Porta la riga-casella allo stato voluto. */
async function imposta(dialogo, nome, acceso) {
  const casella = dialogo.getByRole('checkbox', { name: nome, exact: true })
  if ((await casella.getAttribute('aria-checked')) !== String(acceso)) await casella.click()
  const ora = await casella.getAttribute('aria-checked')
  assert(ora === String(acceso), `${nome}: aria-checked=${ora}, atteso ${acceso}`)
}

async function salvaENuova(page, dialogo) {
  const prima = new Set((await stato(page)).requests.map((r) => r.id))
  await dialogo.getByRole('button', { name: 'Crea richiesta' }).click()
  return aspetta(async () => (await stato(page)).requests.find((r) => !prima.has(r.id)),
    'la nuova richiesta non compare nello stato', 5_000)
}

export default async function (t) {
  await preparaArchivio(t)
  const manager = await t.telefono()
  await accedi(manager.page, ADMIN)
  const { page } = manager

  let soloCheckIn = null

  await t.check('la scheda di lavoro ha le righe "Pulizia" e "Check-in" (role checkbox)', async () => {
    const dialogo = await apriNuova(page)
    assert(await dialogo.getByRole('checkbox', { name: 'Pulizia', exact: true }).count() === 1, 'manca "Pulizia"')
    assert(await dialogo.getByRole('checkbox', { name: 'Check-in', exact: true }).count() === 1, 'manca "Check-in"')
  })

  await t.check('"Tipo di pulizia" non propone "Pulizia Rapida"', async () => {
    const dialogo = page.getByRole('dialog')
    await imposta(dialogo, 'Pulizia', true)
    const voci = await dialogo.getByLabel('Tipo di pulizia', { exact: true }).locator('option').allInnerTexts()
    assert(voci.length > 0, 'tendina vuota')
    assert(!voci.some((v) => /Pulizia Rapida/i.test(v)), `voci: ${voci.join(', ')}`)
  })

  await t.check('senza Pulizia ne\' Check-in: errore "Scegli cosa c..."', async () => {
    const dialogo = page.getByRole('dialog')
    await imposta(dialogo, 'Pulizia', false)
    await imposta(dialogo, 'Check-in', false)
    await dialogo.getByRole('button', { name: 'Crea richiesta' }).click()
    const avviso = await dialogo.getByRole('alert').innerText()
    assert(/Scegli cosa c/.test(avviso), `avviso: ${avviso}`)
  })

  await t.check('solo Check-in: salvata con senzaPulizia e check-out = check-in', async () => {
    const dialogo = page.getByRole('dialog')
    await imposta(dialogo, 'Check-in', true)
    soloCheckIn = await salvaENuova(page, dialogo)
    assert(soloCheckIn.apartmentId === CASA, `casa: ${soloCheckIn.apartmentId}`)
    assert(soloCheckIn.senzaPulizia === true, `senzaPulizia: ${soloCheckIn.senzaPulizia}`)
    assert(soloCheckIn.checkOutAt === soloCheckIn.checkInAt, `${soloCheckIn.checkOutAt} != ${soloCheckIn.checkInAt}`)
    assert(soloCheckIn.checkIn === true, `checkIn: ${soloCheckIn.checkIn}`)
    t.log(`solo check-in: ${soloCheckIn.id}`)
  })

  await t.check('Pulizia + Check-in: salvata con pulizia e check-in', async () => {
    const dialogo = await apriNuova(page)
    await imposta(dialogo, 'Pulizia', true)
    await imposta(dialogo, 'Check-in', true)
    await dialogo.getByRole('checkbox', { name: /^(Letto|Divano)/ }).first().click()
    const r = await salvaENuova(page, dialogo)
    assert(!r.senzaPulizia, `senzaPulizia: ${r.senzaPulizia}`)
    assert(r.checkIn === true, `checkIn: ${r.checkIn}`)
    assert(r.beds.length > 0, 'nessun letto')
  })

  if (!soloCheckIn) return

  const angela = await t.telefono()
  await accedi(angela.page, ANGELA)
  await aspettaScambio(angela.page, 'Angela')

  await t.check('Angela riceve la richiesta di solo check-in', async () => {
    await aspetta(async () => (await stato(angela.page)).requests.some((r) => r.id === soloCheckIn.id),
      'la richiesta non arriva sul telefono di Angela')
  })

  await t.check('Angela vede "Solo check-in" in /richieste (sfogliando le pagine)', async () => {
    const p = angela.page
    await p.goto('/richieste')
    await p.locator('[role="button"]:visible').first().waitFor({ timeout: 15_000 })
    for (let pagina = 1; pagina <= 40; pagina++) {
      if (await p.getByText('Solo check-in', { exact: true }).filter({ visible: true }).count()) return
      const avanti = p.getByRole('button', { name: 'Pagina successiva' })
      if (!(await avanti.count()) || await avanti.isDisabled()) break
      await avanti.click()
    }
    throw new Error('"Solo check-in" non compare in nessuna pagina')
  })

  await t.check('Angela vede il pallino blu "Con check-in" nel calendario', async () => {
    await angela.page.goto('/calendario')
    await angela.page.locator('span.bg-checkin[aria-label="Con check-in"]').filter({ visible: true }).first().waitFor({ timeout: 15_000 })
  })

  await t.check('nessun errore nelle pagine', async () => {
    const errori = [...manager.errori, ...angela.errori]
    assert(errori.length === 0, errori.join('\n'))
  })
}
