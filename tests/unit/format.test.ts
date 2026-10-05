/* Formattazione di date e numeri: una data sbagliata da' un trattino, mai un errore. */
import { describe, expect, it } from 'vitest'
import {
  fmtDate, fmtDateTime, fmtDayLong, fmtEur, fmtMonthYear, fmtNum, fmtRelative, fmtTime, norm, plural,
  sameDay, toCsv,
} from '@/lib/format'

const formattatori = { fmtDate, fmtDateTime, fmtTime, fmtDayLong, fmtMonthYear, fmtRelative }
const sbagliate: unknown[] = ['', 'non una data', '2026-13-45', '2026-02-30T99:99', null, undefined, new Date(NaN)]

describe('date non valide', () => {
  for (const [nome, f] of Object.entries(formattatori)) {
    it(`${nome} restituisce '—' e non lancia`, () => {
      for (const v of sbagliate) {
        expect(() => f(v as string)).not.toThrow()
        expect(f(v as string)).toBe('—')
      }
    })
  }

  it('sameDay con una data non valida e\' falso, senza errori', () => {
    expect(sameDay('boh', '2026-11-01T10:00:00')).toBe(false)
    expect(sameDay(null, undefined)).toBe(false)
  })
})

describe('date valide', () => {
  it('formato dell\'app: dd-MM-yyyy HH:mm', () => {
    expect(fmtDateTime('2026-08-31T10:05:00')).toBe('31-08-2026 10:05')
    expect(fmtDate(new Date(2026, 7, 31))).toBe('31-08-2026')
    expect(fmtTime('2026-08-31T07:30:00')).toBe('07:30')
  })

  it('giorno e mese in italiano', () => {
    expect(fmtDayLong('2026-08-31T10:00:00')).toBe('lunedì 31 agosto 2026')
    expect(fmtMonthYear('2026-08-31T10:00:00')).toBe('agosto 2026')
  })

  it('fmtRelative parla italiano', () => {
    expect(fmtRelative(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000))).toMatch(/fa$/)
  })

  it('sameDay confronta il giorno locale', () => {
    expect(sameDay('2026-11-01T08:00:00', '2026-11-01T22:00:00')).toBe(true)
    expect(sameDay('2026-11-01T08:00:00', '2026-11-02T08:00:00')).toBe(false)
  })
})

describe('numeri e testo', () => {
  it('euro e numeri in formato italiano', () => {
    /* In italiano le migliaia si separano da 10.000 in su. */
    expect(fmtEur(12345.5).replace(/\s/g, ' ')).toBe('12.345,50 €')
    expect(fmtNum(1234567)).toBe('1.234.567')
  })

  it('plural', () => {
    expect(plural(1, 'richiesta', 'richieste')).toBe('1 richiesta')
    expect(plural(3, 'richiesta', 'richieste')).toBe('3 richieste')
    expect(plural(0, 'richiesta', 'richieste')).toBe('0 richieste')
  })

  it('norm toglie maiuscole e accenti', () => {
    expect(norm('KlaFrà Città')).toBe('klafra citta')
  })

  it('toCsv usa il punto e virgola e mette tra virgolette i valori speciali', () => {
    expect(toCsv([])).toBe('')
    expect(toCsv([{ a: 'x;y', b: 'di "lui"', c: null }])).toBe('a;b;c\n"x;y";"di ""lui""";')
  })
})
