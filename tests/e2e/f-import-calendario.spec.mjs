/*
 * Pulizie dal calendario Airbnb/Booking, dall'interfaccia: link iCal sulla
 * casa, "Aggiorna da Airbnb", niente doppioni, annullamento quando la
 * prenotazione sparisce e arrivo delle pulizie alla ditta.
 *
 * Il Worker scaricherebbe il calendario da internet: qui la chiamata
 * /api/calendario viene intercettata nel browser e riceve un file iCal finto.
 * Le date stanno a 40+ giorni da oggi, lontane dalle pulizie di partenza
 * (che sono tutte nel mese corrente).
 */
import {
  ADMIN, ANGELA, accedi, aspetta, aspettaScambio, assert, pausa, preparaArchivio, stato,
} from './lib.mjs'

const CASA = 'ap-marsi'
const NOME = 'KlaFrà'
const LINK = 'https://www.airbnb.it/calendar/ical/12345678.ics?s=prova-e2e'

/** Giorno a `n` giorni da oggi come YYYYMMDD (calendario, senza fuso). */
function giorno(n) {
  const d = new Date()
  const u = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate() + n))
  return u.toISOString().slice(0, 10).replace(/-/g, '')
}

const A = { uid: 'e2e-a@airbnb.com', da: giorno(40), a: giorno(43), titolo: 'Reserved' }
const BLOCCO = { uid: 'e2e-blocco@airbnb.com', da: giorno(44), a: giorno(46), titolo: 'Airbnb (Not available)' }
const B = { uid: 'e2e-b@booking.com', da: giorno(47), a: giorno(50), titolo: 'CLOSED - Not available' }

const ics = (...eventi) => [
  'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Airbnb Inc//Hosting Calendar 1.0//EN',
  ...eventi.flatMap((e) => [
    'BEGIN:VEVENT', `DTSTART;VALUE=DATE:${e.da}`, `DTEND;VALUE=DATE:${e.a}`, `UID:${e.uid}`, `SUMMARY:${e.titolo}`, 'END:VEVENT',
  ]),
  'END:VCALENDAR',
].join('\r\n')

const idDi = (e) => `req-ical-${CASA}-${e.a}`

export default async function (t) {
  await preparaArchivio(t)
  const manager = await t.telefono()
  const { page } = manager

  let calendario = ics(A, BLOCCO, B)
  const linkChiesti = []
  await page.route('**/api/calendario**', async (r) => {
    linkChiesti.push(new URL(r.request().url()).searchParams.get('url'))
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ics: calendario }) })
  })

  await accedi(page, ADMIN)
  await aspettaScambio(page, 'manager')

  const pulizieCasaIcal = async () => (await stato(page)).requests.filter((r) => r.id.startsWith(`req-ical-${CASA}-`))
  const aggiorna = async () => {
    const n = linkChiesti.length
    await page.getByRole('button', { name: 'Aggiorna da Airbnb' }).click()
    await aspetta(() => linkChiesti.length > n, 'il calendario non e\' stato scaricato', 10_000)
    /* Il pulsante torna attivo quando l'import e' finito. */
    await aspetta(async () => !(await page.getByRole('button', { name: 'Aggiorna da Airbnb' }).isDisabled()), 'import mai finito', 10_000)
  }

  await t.check(`link iCal impostato su ${NOME} da Appartamenti`, async () => {
    await page.goto('/appartamenti')
    const menu = page.locator(`[aria-label="Azioni su ${NOME}"]:visible, [aria-label="Azioni ${NOME}"]:visible`).first()
    await menu.waitFor({ timeout: 15_000 })
    /* Il menu si chiude a ogni scorrimento della pagina: prima si porta la
       riga in vista e si lascia finire lo scorrimento, poi si tocca. */
    await menu.scrollIntoViewIfNeeded()
    await pausa(600)
    await menu.click()
    await page.getByRole('menuitem', { name: /Modifica/ }).first().click()
    const campo = page.getByPlaceholder('https://www.airbnb.it/calendar/ical/…')
    await campo.fill(LINK)
    await page.getByRole('dialog').getByRole('button', { name: /Salva/ }).click()
    await aspetta(async () => (await stato(page)).apartments.find((a) => a.id === CASA)?.icalUrl === LINK,
      'il link non e\' stato salvato sulla casa', 5_000)
  })

  await t.check('"Aggiorna da Airbnb" crea 2 pulizie (prenotazione Airbnb + Booking) e ignora il blocco', async () => {
    await aspetta(async () => (await page.getByRole('button', { name: 'Aggiorna da Airbnb' }).count()) > 0,
      'pulsante "Aggiorna da Airbnb" assente', 10_000)
    await aggiorna()
    assert(linkChiesti.every((l) => l === LINK), `link chiesti: ${linkChiesti.join(', ')}`)
    const create = await pulizieCasaIcal()
    const ids = create.map((r) => r.id).sort()
    assert(JSON.stringify(ids) === JSON.stringify([idDi(A), idDi(B)].sort()), `pulizie dal calendario: ${ids.join(', ')}`)
    assert(!create.some((r) => r.id === idDi(BLOCCO)), 'il blocco ha generato una pulizia')
    const a = create.find((r) => r.id === idDi(A))
    assert(a.status === 'in_attesa', `stato: ${a.status}`)
    /* Check-out alle 10 del giorno di partenza (ora di Roma). */
    const orario = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
    assert(orario.format(new Date(a.checkOutAt)) === '10:00', `check-out ${a.checkOutAt}`)
    assert(orario.format(new Date(a.checkInAt)) === '15:00', `check-in ${a.checkInAt}`)
  })

  await t.check('riscaricare il calendario non crea doppioni', async () => {
    await aggiorna()
    await aggiorna()
    const create = await pulizieCasaIcal()
    assert(create.length === 2, `pulizie dal calendario: ${create.length}`)
    const s = await stato(page)
    const stessoGiorno = s.requests.filter((r) => r.apartmentId === CASA && r.status !== 'cancellata'
      && [A.a, B.a].some((g) => r.id.endsWith(g) || r.checkOutAt.slice(0, 10).replace(/-/g, '') === g))
    assert(stessoGiorno.length === 2, `pulizie nei giorni di partenza: ${stessoGiorno.map((r) => r.id).join(', ')}`)
  })

  await t.check('prenotazione sparita: la pulizia in attesa si annulla (annullataDaCalendario)', async () => {
    calendario = ics(A, BLOCCO)
    await aggiorna()
    const create = await pulizieCasaIcal()
    const b = create.find((r) => r.id === idDi(B))
    assert(b?.status === 'cancellata', `stato: ${b?.status}`)
    assert(b.annullataDaCalendario === true, `annullataDaCalendario: ${b.annullataDaCalendario}`)
    assert(create.find((r) => r.id === idDi(A))?.status === 'in_attesa', 'la pulizia di A non e\' piu\' in attesa')
  })

  const angela = await t.telefono()
  await accedi(angela.page, ANGELA)

  await t.check('Angela riceve le pulizie del calendario (una attiva, una annullata)', async () => {
    await aspetta(async () => {
      const s = await stato(angela.page)
      const a = s?.requests.find((r) => r.id === idDi(A))
      const b = s?.requests.find((r) => r.id === idDi(B))
      return a?.status === 'in_attesa' && b?.status === 'cancellata'
    }, 'le pulizie del calendario non arrivano ad Angela')
  })

  await t.check('la prenotazione torna: la pulizia si riattiva e Angela la riceve', async () => {
    calendario = ics(A, BLOCCO, B)
    await aggiorna()
    const b = (await pulizieCasaIcal()).find((r) => r.id === idDi(B))
    assert(b?.status === 'in_attesa', `stato dopo il ritorno: ${b?.status}`)
    assert(!b.annullataDaCalendario, 'segno annullataDaCalendario rimasto')
    await aspetta(async () => (await stato(angela.page))?.requests.find((r) => r.id === idDi(B))?.status === 'in_attesa',
      'Angela non vede la pulizia riattivata')
  })

  await t.check('nessun errore nelle pagine', async () => {
    const errori = [...manager.errori, ...angela.errori]
    assert(errori.length === 0, errori.join('\n'))
  })
}
