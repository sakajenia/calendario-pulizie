/*
 * Pulizie dal calendario delle prenotazioni: lettura del file iCal e calcolo
 * delle pulizie da creare, spostare, annullare o riattivare.
 */
import { describe, expect, it } from 'vitest'
import { idDaCalendario, leggiCalendario, pulizieDaCalendario, type Prenotazione } from '@/lib/ical'
import { alleLocale, casa, pulizia } from './fixtures'

/** Un VEVENT con date a giorno intero, come li esporta Airbnb. */
const evento = (uid: string, inizio: string, fine: string, titolo: string, extra = '') =>
  [
    'BEGIN:VEVENT',
    `DTSTART;VALUE=DATE:${inizio}`,
    `DTEND;VALUE=DATE:${fine}`,
    `UID:${uid}`,
    `SUMMARY:${titolo}`,
    ...(extra ? [extra] : []),
    'END:VEVENT',
  ].join('\r\n')

const calendario = (...eventi: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Airbnb Inc//Hosting Calendar//EN', ...eventi, 'END:VCALENDAR'].join('\r\n')

/* "Oggi" fisso per tutti i calcoli: 1 novembre 2026 a mezzogiorno. */
const ADESSO = new Date(2026, 10, 1, 12, 0, 0)

const pren = (uid: string, inizio: [number, number, number], fine: [number, number, number]): Prenotazione => ({
  uid,
  inizio: new Date(inizio[0], inizio[1] - 1, inizio[2]),
  fine: new Date(fine[0], fine[1] - 1, fine[2]),
  titolo: 'Reserved',
  descrizione: '',
})

describe('leggiCalendario', () => {
  it('legge una prenotazione Airbnb "Reserved" e scarta il blocco "Airbnb (Not available)"', () => {
    const testo = calendario(
      evento('a1@airbnb.com', '20261110', '20261114', 'Reserved',
        'DESCRIPTION:Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM123\\nPhone Number (Last 4 Digits): 1234'),
      evento('b1@airbnb.com', '20261120', '20261125', 'Airbnb (Not available)'),
    )
    const lette = leggiCalendario(testo)
    expect(lette).toHaveLength(1)
    expect(lette[0].uid).toBe('a1@airbnb.com')
    expect(lette[0].titolo).toBe('Reserved')
    expect(lette[0].inizio).toEqual(new Date(2026, 10, 10))
    expect(lette[0].fine).toEqual(new Date(2026, 10, 14))
    expect(lette[0].descrizione).toContain('\nPhone Number')
  })

  it('conta le prenotazioni Booking "CLOSED - Not available"', () => {
    const testo = calendario(evento('bk1@booking.com', '20261201', '20261203', 'CLOSED - Not available'))
    const lette = leggiCalendario(testo)
    expect(lette).toHaveLength(1)
    expect(lette[0].titolo).toBe('CLOSED - Not available')
  })

  it('scarta i blocchi "Not available", "Blocked" e "Non disponibile"', () => {
    const testo = calendario(
      evento('x1', '20261201', '20261202', 'Not available'),
      evento('x2', '20261203', '20261204', 'Blocked'),
      evento('x3', '20261205', '20261206', ' non disponibile '),
    )
    expect(leggiCalendario(testo)).toEqual([])
  })

  it('unisce le righe spezzate, accetta \\n semplici e ordina per data di arrivo', () => {
    const testo = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT', 'DTSTART;VALUE=DATE:20261220', 'DTEND;VALUE=DATE:20261222', 'UID:dopo', 'SUMMARY:Reserved', 'END:VEVENT',
      'BEGIN:VEVENT', 'DTSTART:20261210T140000Z', 'DTEND:20261212T100000Z',
      'UID:prima-con-un-uid-', ' molto-lungo', 'SUMMARY:Reserved', 'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const lette = leggiCalendario(testo)
    expect(lette.map((p) => p.uid)).toEqual(['prima-con-un-uid-molto-lungo', 'dopo'])
    /* Con l'ora si tiene solo il giorno. */
    expect(lette[0].inizio).toEqual(new Date(2026, 11, 10))
  })

  it('ignora eventi senza date valide e testo che non e\' un calendario', () => {
    expect(leggiCalendario('ciao')).toEqual([])
    expect(leggiCalendario(calendario('BEGIN:VEVENT\r\nUID:x\r\nSUMMARY:Reserved\r\nDTSTART:boh\r\nEND:VEVENT'))).toEqual([])
  })
})

describe('pulizieDaCalendario', () => {
  const ap = casa()

  it('crea una pulizia per ogni partenza: check-out alle 10, check-in alle 15 della prenotazione dopo', () => {
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 16], [2026, 11, 20])]
    const esito = pulizieDaCalendario(ap, p, [], ADESSO)
    expect(esito.aggiornate).toEqual([])
    expect(esito.annullate).toEqual([])
    expect(esito.nuove).toHaveLength(2)

    const [prima, seconda] = esito.nuove
    expect(prima.id).toBe(idDaCalendario('ap-prova', new Date(2026, 10, 14)))
    expect(prima.id).toBe('req-ical-ap-prova-20261114')
    expect(prima.checkOutAt).toBe(alleLocale(2026, 11, 14, 10))
    expect(prima.checkInAt).toBe(alleLocale(2026, 11, 16, 15))
    expect(prima.status).toBe('in_attesa')
    expect(prima.prenotazione).toBe('A')
    expect(prima.orariCalendario).toEqual({ checkOutAt: prima.checkOutAt, checkInAt: prima.checkInAt })
    expect(prima.hostId).toBe('u-admin')
    /* Il calendario non dice quanti ospiti arrivano: se ne stimano 2 (non
       piu' dei posti della casa), segnati come stima. */
    expect(prima.checkInPeople).toBe(2)
    expect(prima.ospitiStimati).toBe(true)
    expect(prima.beds.map((b) => b.bedId)).toEqual(['b1', 'b2'])

    /* Nessuna prenotazione dopo: il check-in e' lo stesso giorno alle 15. */
    expect(seconda.checkOutAt).toBe(alleLocale(2026, 11, 20, 10))
    expect(seconda.checkInAt).toBe(alleLocale(2026, 11, 20, 15))
  })

  it('ignora le prenotazioni gia\' finite', () => {
    const esito = pulizieDaCalendario(ap, [pren('V', [2026, 10, 20], [2026, 10, 25])], [], ADESSO)
    expect(esito.nuove).toEqual([])
  })

  it('riscaricare lo stesso calendario non crea doppioni ne\' modifiche', () => {
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 16], [2026, 11, 20])]
    const prima = pulizieDaCalendario(ap, p, [], ADESSO)
    const dopo = pulizieDaCalendario(ap, p, prima.nuove, ADESSO)
    expect(dopo).toEqual({ nuove: [], aggiornate: [], annullate: [] })
  })

  it('non aggiunge una pulizia se a mano ce n\'e\' gia\' una quel giorno in quella casa', () => {
    const manuale = pulizia({ id: 'req-manuale', checkOutAt: alleLocale(2026, 11, 14, 11), checkInAt: alleLocale(2026, 11, 14, 16) })
    const esito = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [manuale], ADESSO)
    expect(esito.nuove).toEqual([])
  })

  it('una pulizia manuale annullata, o in un\'altra casa, non blocca quella del calendario', () => {
    const annullata = pulizia({ id: 'req-a', status: 'cancellata', checkOutAt: alleLocale(2026, 11, 14, 11) })
    const altraCasa = pulizia({ id: 'req-b', apartmentId: 'ap-altra', checkOutAt: alleLocale(2026, 11, 14, 11) })
    const esito = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [annullata, altraCasa], ADESSO)
    expect(esito.nuove).toHaveLength(1)
  })

  it('prenotazione sparita: annulla solo la pulizia in attesa, col segno annullataDaCalendario', () => {
    const p = [
      pren('A', [2026, 11, 10], [2026, 11, 14]),
      pren('B', [2026, 11, 16], [2026, 11, 20]),
      pren('C', [2026, 11, 22], [2026, 11, 24]),
    ]
    const [a, b, c] = pulizieDaCalendario(ap, p, [], ADESSO).nuove
    const accettata = { ...b, status: 'accettata' as const }
    /* Restano solo le date di A: B e C sono state cancellate dagli ospiti. */
    const esito = pulizieDaCalendario(ap, [p[0]], [a, accettata, c], ADESSO)
    expect(esito.nuove).toEqual([])
    expect(esito.annullate.map((r) => r.id)).toEqual([c.id])
    expect(esito.annullate[0].status).toBe('cancellata')
    expect(esito.annullate[0].annullataDaCalendario).toBe(true)
    expect(esito.annullate[0].updatedAt).toBe(ADESSO.toISOString())
  })

  it('non annulla le pulizie gia\' passate ne\' quelle create a mano', () => {
    const passata = pulizia({
      id: idDaCalendario('ap-prova', new Date(2026, 9, 20)), prenotazione: 'V',
      checkOutAt: alleLocale(2026, 10, 20, 10), checkInAt: alleLocale(2026, 10, 20, 15),
    })
    const manuale = pulizia({ id: 'req-manuale', checkOutAt: alleLocale(2026, 11, 30, 10) })
    const esito = pulizieDaCalendario(ap, [], [passata, manuale], ADESSO)
    expect(esito.annullate).toEqual([])
  })

  it('la prenotazione torna: si riattiva la pulizia annullata dal calendario', () => {
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14])]
    const [a] = pulizieDaCalendario(ap, p, [], ADESSO).nuove
    const [annullata] = pulizieDaCalendario(ap, [], [a], ADESSO).annullate
    const esito = pulizieDaCalendario(ap, p, [annullata], ADESSO)
    expect(esito.nuove).toEqual([])
    expect(esito.aggiornate).toHaveLength(1)
    expect(esito.aggiornate[0].id).toBe(a.id)
    expect(esito.aggiornate[0].status).toBe('in_attesa')
    expect('annullataDaCalendario' in esito.aggiornate[0]).toBe(false)
  })

  it('una pulizia rifiutata dalla ditta (senza segno) non si riattiva', () => {
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14])]
    const [a] = pulizieDaCalendario(ap, p, [], ADESSO).nuove
    const rifiutata = { ...a, status: 'cancellata' as const }
    expect(pulizieDaCalendario(ap, p, [rifiutata], ADESSO)).toEqual({ nuove: [], aggiornate: [], annullate: [] })
  })

  it('sposta gli orari se cambiano le prenotazioni e nessuno li ha toccati a mano', () => {
    const [a] = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [], ADESSO).nuove
    /* Arriva una prenotazione subito dopo: il check-in passa al 15. */
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 15], [2026, 11, 18])]
    const esito = pulizieDaCalendario(ap, p, [a], ADESSO)
    expect(esito.aggiornate).toHaveLength(1)
    expect(esito.aggiornate[0].checkInAt).toBe(alleLocale(2026, 11, 15, 15))
    expect(esito.aggiornate[0].orariCalendario?.checkInAt).toBe(alleLocale(2026, 11, 15, 15))
  })

  it('gli orari cambiati a mano restano (orariCalendario diverso da quelli della pulizia)', () => {
    const [a] = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [], ADESSO).nuove
    const aMano = { ...a, checkOutAt: alleLocale(2026, 11, 14, 12) }
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 15], [2026, 11, 18])]
    const esito = pulizieDaCalendario(ap, p, [aMano], ADESSO)
    expect(esito.aggiornate.find((r) => r.id === a.id)).toBeUndefined()
  })

  it('una riga vecchia senza orariCalendario conta come non toccata', () => {
    const [a] = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [], ADESSO).nuove
    const { orariCalendario: _, ...vecchia } = a
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 15], [2026, 11, 18])]
    const esito = pulizieDaCalendario(ap, p, [vecchia], ADESSO)
    expect(esito.aggiornate.map((r) => r.id)).toContain(a.id)
  })

  it('non sposta gli orari di una pulizia gia\' accettata', () => {
    const [a] = pulizieDaCalendario(ap, [pren('A', [2026, 11, 10], [2026, 11, 14])], [], ADESSO).nuove
    const accettata = { ...a, status: 'accettata' as const }
    const p = [pren('A', [2026, 11, 10], [2026, 11, 14]), pren('B', [2026, 11, 15], [2026, 11, 18])]
    const esito = pulizieDaCalendario(ap, p, [accettata], ADESSO)
    expect(esito.aggiornate.find((r) => r.id === a.id)).toBeUndefined()
  })

  it('dal testo iCal alle pulizie: il blocco Airbnb non genera niente', () => {
    const testo = calendario(
      evento('r1', '20261210', '20261212', 'Reserved'),
      evento('blk', '20261213', '20261215', 'Airbnb (Not available)'),
      evento('r2', '20261216', '20261218', 'CLOSED - Not available'),
    )
    const esito = pulizieDaCalendario(ap, leggiCalendario(testo), [], ADESSO)
    expect(esito.nuove.map((r) => r.id)).toEqual(['req-ical-ap-prova-20261212', 'req-ical-ap-prova-20261218'])
    /* Il blocco non conta come "prenotazione dopo": il check-in e' quello di r2. */
    expect(esito.nuove[0].checkInAt).toBe(alleLocale(2026, 12, 16, 15))
  })
})
