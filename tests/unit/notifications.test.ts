/* Notifiche dedotte dai dati: chi vede cosa e quando. */
import { describe, expect, it } from 'vitest'
import { buildNotifications } from '@/lib/notifications'
import type { Inspection } from '@/types'
import { casa, pulizia, utente } from './fixtures'

const ORA = new Date('2026-11-10T12:00:00.000Z')
const ore = (h: number) => new Date(ORA.getTime() + h * 3600_000).toISOString()

const manager = utente()
const ditta = utente({ id: 'u-pulizie-angela', role: 'operator', companyId: 'angela' })
const apartments = [casa({ name: 'KlaFrà' })]

const voce = (over: Partial<Inspection> = {}): Inspection => ({
  id: 'insp-1', apartmentId: 'ap-prova', kind: 'controllo', inspectorId: 'manuel',
  scheduledAt: ore(24), tasks: [{ id: 't1', name: 'Formiche', done: false }], createdAt: ore(-2), ...over,
})

const costruisci = (over: Partial<Parameters<typeof buildNotifications>[0]> = {}) =>
  buildNotifications({ requests: [], apartments, inspections: [], user: manager, read: [], now: ORA, ...over })

describe('buildNotifications', () => {
  it('senza utente non c\'e\' niente', () => {
    expect(costruisci({ user: null, requests: [pulizia({ checkOutAt: ore(10) })] })).toEqual([])
  })

  it('pulizia non accettata a meno di due giorni: avvisa manager e ditta', () => {
    const r = pulizia({ id: 'r1', checkOutAt: ore(30) })
    for (const user of [manager, ditta]) {
      const n = costruisci({ user, requests: [r] })
      expect(n).toHaveLength(1)
      expect(n[0].id).toBe('da-accettare:r1')
      expect(n[0].kind).toBe('daAccettare')
      expect(n[0].title).toBe('Da accettare: KlaFrà')
      expect(n[0].requestId).toBe('r1')
    }
  })

  it('una nuova richiesta lontana non avvisa nessuno', () => {
    expect(costruisci({ requests: [pulizia({ checkOutAt: ore(24 * 5) })] })).toEqual([])
  })

  it('check-out gia\' passato: "Non accettata"', () => {
    const n = costruisci({ requests: [pulizia({ checkOutAt: ore(-3) })] })
    expect(n[0].title).toBe('Non accettata: KlaFrà')
  })

  it('casa sparita: nome di ripiego', () => {
    const n = costruisci({ requests: [pulizia({ apartmentId: 'ap-x', checkOutAt: ore(5) })] })
    expect(n[0].title).toBe('Da accettare: Appartamento non disponibile')
  })

  it('accettata di recente: solo il manager lo sa', () => {
    const r = pulizia({ id: 'r2', status: 'accettata', checkOutAt: ore(48), updatedAt: ore(-1) })
    expect(costruisci({ requests: [r] }).map((n) => n.id)).toEqual(['accettata:r2'])
    expect(costruisci({ user: ditta, requests: [r] })).toEqual([])
    /* Accettata piu' di sette giorni fa: non e' piu' una novita'. */
    const vecchia = { ...r, updatedAt: ore(-24 * 8) }
    expect(costruisci({ requests: [vecchia] })).toEqual([])
  })

  it('voci del calendario aggiunte: si, tranne scadenze fisse e check-in', () => {
    const n = costruisci({ inspections: [voce(), voce({ id: 'i2', recurring: true }), voce({ id: 'i3', checkInDi: 'r1' })] })
    expect(n.map((x) => x.id)).toEqual(['voce-nuova:insp-1'])
    expect(n[0].title).toBe('Controllo in calendario: KlaFrà')
    expect(costruisci({ user: ditta, inspections: [voce()] })).toEqual([])
  })

  it('task aggiunta dopo su una voce vecchia: una notifica per la task', () => {
    const vecchia = voce({
      createdAt: ore(-24 * 30),
      tasks: [{ id: 't9', name: 'Lampadina', done: false, createdAt: ore(-1) }, { id: 't0', name: 'Vecchia', done: false }],
    })
    expect(costruisci({ inspections: [vecchia] }).map((n) => n.id)).toEqual(['task-nuova:insp-1:t9'])
  })

  it('segna come lette quelle in elenco e ordina dalla piu\' recente', () => {
    const n = costruisci({
      requests: [
        pulizia({ id: 'vicina', checkOutAt: ore(2) }),
        pulizia({ id: 'lontana', checkOutAt: ore(40) }),
      ],
      read: ['da-accettare:vicina'],
    })
    expect(n.map((x) => x.id)).toEqual(['da-accettare:lontana', 'da-accettare:vicina'])
    expect(n.find((x) => x.id === 'da-accettare:vicina')?.read).toBe(true)
    expect(n.find((x) => x.id === 'da-accettare:lontana')?.read).toBe(false)
  })

  /*
   * BUG APP (src/lib/notifications.ts:76): con un checkOutAt non valido la
   * scadenza e' NaN, `deadline > t` e' falso e `new Date(NaN).toISOString()`
   * lancia "Invalid time value". Il controllo resta: va corretta l'app.
   */
  it('[BUG APP] una data scritta male non fa cadere niente', () => {
    expect(() => costruisci({ requests: [pulizia({ checkOutAt: 'boh' })] })).not.toThrow()
  })
})
