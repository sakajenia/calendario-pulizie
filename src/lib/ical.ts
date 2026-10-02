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
  const [, a, me, g] = m
  /* Le date di Airbnb sono giorni interi: si tiene solo il giorno. */
  return new Date(Number(a), Number(me) - 1, Number(g))
}

/** Date bloccate a mano, non prenotazioni: niente pulizia. */
const BLOCCO = /not available|closed|blocked|non disponibile|unavailable/i

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
    if (!c) {
      /* Se a mano c'e' gia' una pulizia per quella casa in quel giorno, non
         se ne aggiunge un'altra. */
      const doppia = esistenti.some((r) => r.apartmentId === casa.id && r.status !== 'cancellata'
        && giorno(new Date(r.checkOutAt)) === giorno(p.fine))
      if (doppia) return
      esito.nuove.push({
        id, apartmentId: casa.id, hostId: casa.ownerId, status: 'in_attesa',
        createdAt: now.toISOString(), checkOutAt, checkInAt,
        checkInPeople: posti(casa),
        beds: casa.beds.map((b) => ({ bedId: b.id, type: b.type, extras: [] })),
        perPersonExtras: [], apartmentExtras: [],
        notes: '', internalNotes: 'Creata dal calendario delle prenotazioni.',
        prenotazione: p.uid,
      })
    } else if (c.status === 'in_attesa' && (c.checkInAt !== checkInAt || c.checkOutAt !== checkOutAt)) {
      esito.aggiornate.push({ ...c, checkOutAt, checkInAt, updatedAt: now.toISOString() })
    }
  })

  /* Prenotazione sparita: si annulla la pulizia solo se nessuno l'ha presa. */
  for (const [id, c] of mie) {
    if (attese.has(id) || c.status !== 'in_attesa') continue
    if (new Date(c.checkOutAt) < oggi) continue
    esito.annullate.push({ ...c, status: 'cancellata', updatedAt: now.toISOString() })
  }
  return esito
}
