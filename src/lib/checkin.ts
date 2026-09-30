/*
 * Il check-in degli ospiti, quando lo fa la ditta di pulizie.
 *
 * Il manager lo accende sulla richiesta di pulizia, oppure sulla casa per
 * tutte le sue pulizie. La ditta lo trova nelle sue richieste e nel
 * calendario la pulizia ha il pallino blu, cosi' si riconosce a colpo d'occhio.
 */
import type { Apartment, CleaningRequest, Inspection } from '@/types'

/** La scelta sulla pulizia vince; se non c'e', vale l'opzione della casa. */
export function richiedeCheckIn(r: CleaningRequest, apartments: Apartment[]): boolean {
  if (typeof r.checkIn === 'boolean') return r.checkIn
  /* Una versione di prova salvava il nome di chi lo faceva: conta come acceso. */
  if (r.checkIn) return true
  return Boolean(apartments.find((a) => a.id === r.apartmentId)?.checkIn?.attivo)
}

/**
 * Per qualche ora il check-in e' finito nel calendario Task Operative della
 * squadra. Non e' li' che serve: quelle voci si tolgono, il resto no.
 */
export function vociCheckInDaTogliere(inspections: Inspection[]): string[] {
  return inspections.filter((i) => i.checkInDi).map((i) => i.id)
}
