/*
 * Dati di prova minimi per i test unitari: una casa, un utente, una pulizia.
 * Solo i campi che servono ai moduli sotto test; il resto ha valori neutri.
 */
import type { Apartment, CleaningRequest, User } from '@/types'

export function casa(over: Partial<Apartment> = {}): Apartment {
  return {
    id: 'ap-prova',
    name: 'Casa di prova',
    address: 'Via Roma 1',
    district: 'Centro',
    city: 'Roma',
    ownerId: 'u-admin',
    companyId: 'angela',
    beds: [
      { id: 'b1', type: 'Letto Matrimoniale' },
      { id: 'b2', type: 'Letto Singolo' },
    ],
    visibility: 'official',
    provider: 'none',
    prices: { base: 50, min: 40, max: 80 } as Apartment['prices'],
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

export function pulizia(over: Partial<CleaningRequest> = {}): CleaningRequest {
  return {
    id: 'req-prova',
    apartmentId: 'ap-prova',
    hostId: 'u-admin',
    status: 'in_attesa',
    createdAt: '2026-01-01T00:00:00.000Z',
    checkOutAt: '2026-11-14T09:00:00.000Z',
    checkInAt: '2026-11-14T14:00:00.000Z',
    checkInPeople: 2,
    beds: [],
    perPersonExtras: [],
    apartmentExtras: [],
    ...over,
  }
}

export function utente(over: Partial<User> = {}): User {
  return {
    id: 'u-admin',
    name: 'Manager',
    email: 'manager@example.it',
    role: 'admin',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  }
}

/** Orario locale in ISO, come lo calcola ical.ts (giorno locale + ora piena). */
export const alleLocale = (anno: number, mese: number, giorno: number, ora: number) =>
  new Date(anno, mese - 1, giorno, ora, 0, 0, 0).toISOString()
