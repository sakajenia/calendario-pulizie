/*
 * Strumenti comuni alle spec end-to-end. Non e' una spec (non finisce in
 * .spec.mjs): scripts/e2e.mjs non la esegue.
 */

export const ADMIN = { id: 'm2ab.srl@gmail.com', password: 'propromanager', userId: 'u-admin' }
export const ANGELA = { id: 'Angela', password: 'SHyA9onz$uM@i5cL', userId: 'u-pulizie-angela' }
/** Le quattro case affidate ad Angela. */
export const CASE_ANGELA = ['ap-marsi', 'ap-consoli', 'ap-labicana', 'ap-appia']
export const NOMI_CASE_ANGELA = ['KlaFrà', 'Consoli', 'Stazione Centrale Roma', 'Villa di Prestigio']

/** Il giro di scambio con l'archivio parte ogni ~7 s: si aspetta con margine. */
export const ATTESA_SYNC = 45_000

export function assert(cond, messaggio) {
  if (!cond) throw new Error(messaggio)
}

export const pausa = (ms) => new Promise((ok) => setTimeout(ok, ms))

/** Ripete `fn` finche' restituisce un valore vero; altrimenti errore con `messaggio`. */
export async function aspetta(fn, messaggio, timeout = ATTESA_SYNC, intervallo = 500) {
  const limite = Date.now() + timeout
  let ultimo
  for (;;) {
    try {
      ultimo = await fn()
      if (ultimo) return ultimo
    } catch (e) {
      ultimo = e
    }
    if (Date.now() > limite) {
      throw new Error(`${messaggio} (dopo ${Math.round(timeout / 1000)} s; ultimo valore: ${String(ultimo?.message ?? JSON.stringify(ultimo)).slice(0, 200)})`)
    }
    await pausa(intervallo)
  }
}

/** Accesso dalla schermata di login; aspetta l'arrivo sul calendario. */
export async function accedi(page, chi, { attendiCalendario = true } = {}) {
  if (!/\/login/.test(page.url())) await page.goto('/login')
  await page.locator('#login-email').fill(chi.id)
  await page.locator('#login-password').fill(chi.password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  if (attendiCalendario) await page.waitForURL(/\/calendario/, { timeout: 20_000 })
}

/**
 * Aspetta il primo giro di scambio del dispositivo (archivio gia' pieno):
 * prima di allora i dati sul telefono sono quelli di partenza, non quelli
 * condivisi.
 */
export async function aspettaScambio(page, cosa = 'dispositivo') {
  await aspetta(async () => (await stato(page))?.sincronizzatoFino > 0, `${cosa}: primo scambio con l'archivio mai finito`)
}

/** Lo stato salvato dall'app (zustand persist) in localStorage. */
export async function stato(page) {
  return page.evaluate(() => {
    const grezzo = localStorage.getItem('propromanager-state')
    return grezzo ? JSON.parse(grezzo).state : null
  })
}

export async function richiestaLocale(page, id) {
  const s = await stato(page)
  return s?.requests?.find((r) => r.id === id) ?? null
}

/** Aspetta che sul dispositivo la pulizia `id` abbia lo stato `status`. */
export async function aspettaStato(page, id, status, cosa) {
  return aspetta(async () => (await richiestaLocale(page, id))?.status === status,
    `${cosa}: la pulizia ${id} non e' "${status}"`)
}

/* ---------------------------------------------------- API del Worker ---- */

export async function gettoneApi(base, chi) {
  const r = await fetch(`${base}/api/accesso`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identificativo: chi.id, password: chi.password }),
  })
  const corpo = await r.json()
  assert(r.ok && corpo.gettone, `accesso API di ${chi.id} fallito: ${r.status} ${JSON.stringify(corpo)}`)
  return corpo.gettone
}

export async function leggiArchivio(base, gettone) {
  const r = await fetch(`${base}/api/dati?da=0`, { headers: { authorization: `Bearer ${gettone}` } })
  assert(r.ok, `lettura archivio: ${r.status}`)
  return (await r.json()).record
}

/**
 * L'archivio di un Worker nuovo e' vuoto: lo riempie il primo manager che
 * entra (manda i dati di partenza). Le ditte possono solo aggiornare pulizie
 * gia' presenti, quindi ogni spec che le usa passa prima di qui.
 */
export async function preparaArchivio(t) {
  const gettone = await gettoneApi(t.base, ADMIN)
  const pieno = async () => (await leggiArchivio(t.base, gettone)).some((r) => r.tipo === 'requests' && CASE_ANGELA.includes(r.dati?.apartmentId))
  if (await pieno()) return
  const { page } = await t.telefono()
  await accedi(page, ADMIN)
  await aspetta(pieno, 'il manager non ha riempito l\'archivio')
}

/** Una pulizia futura in attesa su una casa di Angela, scelta dallo stato del telefono. */
export async function pulizieInAttesaAngela(page, escludi = []) {
  const s = await stato(page)
  /* Le pulizie di partenza sono fisse a settembre 2026: non si chiede che
     siano nel futuro, basta che siano ancora in attesa. */
  return (s?.requests ?? [])
    .filter((r) => CASE_ANGELA.includes(r.apartmentId) && r.status === 'in_attesa'
      && !escludi.includes(r.id))
    .sort((a, b) => a.checkOutAt.localeCompare(b.checkOutAt))
}
