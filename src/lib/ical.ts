/*
 * Pulizie dal calendario delle prenotazioni (Airbnb, Booking, Vrbo).
 *
 * Ogni casa puo' avere il link iCal del suo annuncio. Ogni prenotazione che
 * finisce e' una pulizia da fare il giorno della partenza; l'arrivo e' quello
 * della prenotazione successiva. Le pulizie nate cosi' hanno un identificativo
 * fisso per casa e giorno: riscaricare il calendario non crea doppioni, e due
 * telefoni che lo fanno insieme scrivono la stessa riga.
 *
 * Non si tocca quello che la ditta ha gia' preso in carico: se una
 * prenotazione sparisce (cancellata dall'ospite) si annulla solo la pulizia
 * ancora in attesa.
 */
import type { Apartment, CleaningRequest } from '@/types'

export interface Prenotazione {
  uid: string
  inizio: Date
  fine: Date
  titolo: string
  descrizione: string
}

/** Le righe lunghe dei file iCal continuano a capo con uno spazio davanti. */
const righe = (testo: string) => testo.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)

function data(valore: string): Date | null {
  const m = valore.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/)
  if (!m) return null
  const [, a, me, g, h, mi, se, utc] = m
  /* Un orario con la Z finale e' in UTC: il giorno giusto e' quello dell'ora
     locale (Roma), non quello scritto. Le 23:00Z del 30 settembre sono gia'
     l'1 ottobre: prima la Z si perdeva e la pulizia finiva il giorno prima. */
  if (utc && h !== undefined) {
    const locale = new Date(Date.UTC(Number(a), Number(me) - 1, Number(g), Number(h), Number(mi), Number(se)))
    if (Number.isNaN(locale.getTime())) return null
    return new Date(locale.getFullYear(), locale.getMonth(), locale.getDate())
  }
  /* Le date di Airbnb sono giorni interi, e gli orari senza Z sono gia' in
     ora locale: si tiene solo il giorno. */
  const giornoIntero = new Date(Number(a), Number(me) - 1, Number(g))
  return Number.isNaN(giornoIntero.getTime()) ? null : giornoIntero
}

/**
 * Date bloccate a mano, non prenotazioni: niente pulizia. Attenzione: Booking
 * esporta ogni prenotazione vera come "CLOSED - Not available", quindi si
 * scartano solo i blocchi stile Airbnb ("Airbnb (Not available)") e i titoli
 * che sono soltanto "Not available"/"Blocked"/"Non disponibile".
 */
const BLOCCO = /^\s*(airbnb\s*\(not available\)|not available|blocked|non disponibile)\s*$/i

export function leggiCalendario(testo: string): Prenotazione[] {
  const out: Prenotazione[] = []
  let cur: Partial<Prenotazione> | null = null
  for (const riga of righe(testo)) {
    if (riga === 'BEGIN:VEVENT') { cur = {}; continue }
    if (riga === 'END:VEVENT') {
      if (cur?.inizio && cur.fine && !BLOCCO.test(cur.titolo ?? '')) {
        out.push({
          uid: cur.uid ?? `${cur.inizio.getTime()}`, inizio: cur.inizio, fine: cur.fine,
          titolo: cur.titolo ?? '', descrizione: cur.descrizione ?? '',
        })
      }
      cur = null
      continue
    }
    if (!cur) continue
    const i = riga.indexOf(':')
    if (i < 0) continue
    const nome = riga.slice(0, i).split(';')[0].toUpperCase()
    const valore = riga.slice(i + 1)
    if (nome === 'UID') cur.uid = valore
    else if (nome === 'DTSTART') cur.inizio = data(valore) ?? undefined
    else if (nome === 'DTEND') cur.fine = data(valore) ?? undefined
    else if (nome === 'SUMMARY') cur.titolo = valore
    else if (nome === 'DESCRIPTION') cur.descrizione = valore.replace(/\\n/g, '\n').replace(/\\,/g, ',')
  }
  return out.sort((a, b) => a.inizio.getTime() - b.inizio.getTime())
}

const giorno = (d: Date) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
const alle = (d: Date, h: number) => { const x = new Date(d); x.setHours(h, 0, 0, 0); return x.toISOString() }

export const idDaCalendario = (apartmentId: string, partenza: Date) => `req-ical-${apartmentId}-${giorno(partenza)}`

/** Posti letto della casa: in un calendario iCal il numero di ospiti non c'e'. */
const posti = (a: Apartment) => Math.max(1, a.beds.reduce((n, b) => n + (/singol/i.test(b.type) ? 1 : 2), 0))

/**
 * Ospiti da mettere su una pulizia nata dal calendario. Prima si metteva la
 * capienza piena della casa, e i compensi pagavano la tariffa massima (otto
 * persone alla villa) anche per una coppia. Ora un numero neutro, due, mai
 * oltre i posti della casa; la pulizia porta il segno `ospitiStimati`.
 */
export const OSPITI_STIMATI = 2
const ospitiStimati = (a: Apartment) => Math.min(OSPITI_STIMATI, posti(a))

export interface Esito {
  nuove: CleaningRequest[]
  aggiornate: CleaningRequest[]
  annullate: CleaningRequest[]
}

export function pulizieDaCalendario(
  casa: Apartment, prenotazioni: Prenotazione[], esistenti: CleaningRequest[], now = new Date(),
): Esito {
  const oggi = new Date(now); oggi.setHours(0, 0, 0, 0)
  const mie = new Map(esistenti.filter((r) => r.apartmentId === casa.id && r.prenotazione).map((r) => [r.id, r]))
  const attese = new Set<string>()
  const esito: Esito = { nuove: [], aggiornate: [], annullate: [] }

  prenotazioni.forEach((p, i) => {
    if (p.fine < oggi) return
    const id = idDaCalendario(casa.id, p.fine)
    attese.add(id)
    const dopo = prenotazioni.slice(i + 1).find((q) => q.inizio >= p.fine)
    const checkOutAt = alle(p.fine, 10)
    const checkInAt = alle(dopo?.inizio ?? p.fine, 15)
    const c = mie.get(id)
    /* Se a mano c'e' gia' una pulizia per quella casa in quel giorno, non
       se ne aggiunge un'altra. */
    const doppia = esistenti.some((r) => r.id !== id && r.apartmentId === casa.id && r.status !== 'cancellata'
      && giorno(new Date(r.checkOutAt)) === giorno(p.fine))
    if (!c) {
      if (doppia) return
      esito.nuove.push({
        id, apartmentId: casa.id, hostId: casa.ownerId, status: 'in_attesa',
        createdAt: now.toISOString(), checkOutAt, checkInAt,
        checkInPeople: ospitiStimati(casa), ospitiStimati: true,
        beds: casa.beds.map((b) => ({ bedId: b.id, type: b.type, extras: [] })),
        perPersonExtras: [], apartmentExtras: [],
        notes: '', internalNotes: 'Creata dal calendario delle prenotazioni.',
        prenotazione: p.uid, orariCalendario: { checkOutAt, checkInAt },
      })
    } else if (c.status === 'cancellata' && c.annullataDaCalendario) {
      /* La prenotazione e' tornata: si riattiva la pulizia annullata dal
         calendario. Quelle rifiutate dalla ditta (senza segno) restano cosi'. */
      if (doppia) return
      const { annullataDaCalendario: _, ...resto } = c
      esito.aggiornate.push({
        ...resto, status: 'in_attesa', checkOutAt, checkInAt, prenotazione: p.uid,
        orariCalendario: { checkOutAt, checkInAt }, updatedAt: now.toISOString(),
      })
    } else if (c.status === 'in_attesa' && (c.checkInAt !== checkInAt || c.checkOutAt !== checkOutAt)) {
      /* Si spostano gli orari solo se sono ancora quelli messi dal calendario:
         se qualcuno li ha cambiati a mano, restano i suoi. Le righe vecchie
         senza `orariCalendario` contano come non toccate. */
      const prima = c.orariCalendario ?? { checkOutAt: c.checkOutAt, checkInAt: c.checkInAt }
      if (c.checkOutAt !== prima.checkOutAt || c.checkInAt !== prima.checkInAt) return
      esito.aggiornate.push({
        ...c, checkOutAt, checkInAt, prenotazione: p.uid,
        orariCalendario: { checkOutAt, checkInAt }, updatedAt: now.toISOString(),
      })
    }
  })

  /* Prenotazione sparita: si annulla la pulizia solo se nessuno l'ha presa. */
  for (const [id, c] of mie) {
    if (attese.has(id) || c.status !== 'in_attesa') continue
    if (new Date(c.checkOutAt) < oggi) continue
    /* Il segno distingue questo annullamento dal rifiuto della ditta. */
    esito.annullate.push({ ...c, status: 'cancellata', annullataDaCalendario: true, updatedAt: now.toISOString() })
  }
  return esito
}
