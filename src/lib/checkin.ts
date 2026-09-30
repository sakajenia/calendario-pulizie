/*
 * Le voci "Check-in" del calendario Task Operative.
 *
 * Non si scrivono a mano: nascono dal check-in scelto sulla pulizia (nuova
 * richiesta o modifica) oppure dall'opzione della casa, che vale per tutte le
 * sue pulizie. C'e' una voce il giorno e all'ora di arrivo degli ospiti,
 * intestata a chi e' incaricato. Cosi' chi
 * apre il calendario con il proprio nome trova il check-in del giorno.
 *
 * La voce segue la pulizia: se cambia l'orario di arrivo o l'incaricato si
 * sposta, se la pulizia viene annullata o eliminata, o l'opzione spenta,
 * sparisce. Quello che si spunta sulla voce resta.
 *
 * L'identificativo e' fisso (check-in + id della pulizia): due telefoni che
 * la generano insieme producono la stessa riga, non un doppione.
 */
import { startOfDay } from 'date-fns'
import type { Apartment, CleaningRequest, Inspection, InspectorId } from '@/types'
import { asDate } from '@/lib/format'

export const idCheckIn = (requestId: string) => `checkin-${requestId}`

interface Esito {
  inspections: Inspection[]
  /** Voci da togliere anche dagli altri dispositivi. */
  tolte: string[]
  /** Voci ricreate: non sono piu' "eliminate". */
  rinate: string[]
}

export function allineaCheckIn(
  inspections: Inspection[], apartments: Apartment[], requests: CleaningRequest[],
  now: Date = new Date(),
): Esito | null {
  const case_ = new Map(apartments.map((a) => [a.id, a]))
  const oggi = startOfDay(now).getTime()

  /* Quello che dovrebbe esserci adesso, pulizia per pulizia. */
  const attese = new Map<string, { r: CleaningRequest; a: Apartment; chi: InspectorId }>()
  for (const r of requests) {
    if (r.status === 'cancellata') continue
    const a = case_.get(r.apartmentId)
    if (!a) continue
    /* Prima la scelta fatta sulla pulizia, poi l'opzione della casa. */
    const chi = r.checkIn ?? (a.checkIn?.attivo ? a.checkIn.incaricatoId : undefined)
    if (!chi) continue
    if (Number.isNaN(asDate(r.checkInAt).getTime())) continue
    attese.set(idCheckIn(r.id), { r, a, chi })
  }

  let cambiato = false
  const tolte: string[] = []
  const rinate: string[] = []
  const presenti = new Set<string>()
  const prossime: Inspection[] = []

  for (const i of inspections) {
    if (!i.checkInDi) { prossime.push(i); continue }
    const atteso = attese.get(i.id)
    if (!atteso) { tolte.push(i.id); cambiato = true; continue }
    presenti.add(i.id)
    const { r, a, chi: incaricato } = atteso
    const titolo = `Check-in · ${a.name}`
    if (i.scheduledAt !== r.checkInAt || i.inspectorId !== incaricato || i.apartmentId !== a.id || i.title !== titolo) {
      prossime.push({ ...i, scheduledAt: r.checkInAt, inspectorId: incaricato, apartmentId: a.id, title: titolo })
      cambiato = true
    } else {
      prossime.push(i)
    }
  }

  /* Le nuove solo da oggi in avanti: i check-in gia' passati non sono lavoro
     da fare, e riempirebbero il calendario di voci aperte nel passato. */
  for (const [id, { r, a, chi }] of attese) {
    if (presenti.has(id)) continue
    if (asDate(r.checkInAt).getTime() < oggi) continue
    const ospiti = r.checkInPeople > 0 ? ` (${r.checkInPeople} ${r.checkInPeople === 1 ? 'ospite' : 'ospiti'})` : ''
    prossime.push({
      id,
      kind: 'task_operativa',
      apartmentId: a.id,
      title: `Check-in · ${a.name}`,
      inspectorId: chi,
      scheduledAt: r.checkInAt,
      tasks: [{ id: `${id}-accoglienza`, name: `Accogliere gli ospiti${ospiti}`, done: false }],
      checkInDi: r.id,
      createdAt: now.toISOString(),
    })
    rinate.push(id)
    cambiato = true
  }

  return cambiato ? { inspections: prossime, tolte, rinate } : null
}
