/* Check-in degli ospiti a carico della ditta: scelta sulla pulizia o sulla casa. */
import { describe, expect, it } from 'vitest'
import { richiedeCheckIn, vociCheckInDaTogliere } from '@/lib/checkin'
import type { CleaningRequest, Inspection } from '@/types'
import { casa, pulizia } from './fixtures'

describe('richiedeCheckIn', () => {
  const conCheckIn = casa({ checkIn: { attivo: true } })
  const senza = casa()

  it('la scelta sulla pulizia vince su quella della casa', () => {
    expect(richiedeCheckIn(pulizia({ checkIn: true }), [senza])).toBe(true)
    expect(richiedeCheckIn(pulizia({ checkIn: false }), [conCheckIn])).toBe(false)
  })

  it('senza scelta sulla pulizia vale l\'opzione della casa', () => {
    expect(richiedeCheckIn(pulizia(), [conCheckIn])).toBe(true)
    expect(richiedeCheckIn(pulizia(), [senza])).toBe(false)
    expect(richiedeCheckIn(pulizia(), [casa({ checkIn: { attivo: false } })])).toBe(false)
  })

  it('casa sconosciuta: niente check-in', () => {
    expect(richiedeCheckIn(pulizia({ apartmentId: 'ap-sparita' }), [conCheckIn])).toBe(false)
    expect(richiedeCheckIn(pulizia(), [])).toBe(false)
  })

  it('il vecchio formato (nome di chi lo fa) conta come acceso', () => {
    const vecchia = { ...pulizia(), checkIn: 'manuel' } as unknown as CleaningRequest
    expect(richiedeCheckIn(vecchia, [senza])).toBe(true)
  })
})

describe('vociCheckInDaTogliere', () => {
  it('toglie solo le voci nate da un check-in', () => {
    const voce = (id: string, checkInDi?: string) => ({
      id, kind: 'task_operativa', inspectorId: 'manuel', scheduledAt: '2026-11-01T10:00:00.000Z',
      tasks: [], createdAt: '2026-11-01T00:00:00.000Z', ...(checkInDi ? { checkInDi } : {}),
    }) as Inspection
    expect(vociCheckInDaTogliere([voce('a'), voce('b', 'req-1'), voce('c')])).toEqual(['b'])
  })
})
