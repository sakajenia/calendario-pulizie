import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  Apartment, AppNotification, CleaningRequest, ExtraCatalogItem, RequestStatus,
  TaskCatalogItem, User, Warehouse, WorkSheet,
} from '@/types'
import * as seed from './seed'

export interface RequestFilters {
  text: string
  status: RequestStatus | 'all'
  dateField: 'checkOutAt' | 'checkInAt' | 'createdAt'
  from: string | null
  to: string | null
  apartmentId: string | 'all'
  hostId: string | 'all'
}

export const emptyFilters: RequestFilters = {
  text: '', status: 'all', dateField: 'checkOutAt', from: null, to: null,
  apartmentId: 'all', hostId: 'all',
}

interface State {
  currentUserId: string | null
  users: User[]
  apartments: Apartment[]
  requests: CleaningRequest[]
  taskCatalog: TaskCatalogItem[]
  workSheets: WorkSheet[]
  extraCatalog: ExtraCatalogItem[]
  warehouses: Warehouse[]
  notifications: AppNotification[]
  filters: RequestFilters

  login: (email: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  switchUser: (id: string) => void

  setFilters: (f: Partial<RequestFilters>) => void
  resetFilters: () => void

  upsertRequest: (r: CleaningRequest) => void
  setRequestStatus: (ids: string[], status: RequestStatus) => void
  deleteRequests: (ids: string[]) => void
  /** L'addetto (o un manager) segna la pulizia come completata. */
  completeRequest: (id: string) => void
  /** Note lasciate sul posto dall'addetto alle pulizie. */
  setOperatorNotes: (id: string, notes: string) => void

  upsertApartment: (a: Apartment) => void
  deleteApartment: (id: string) => void

  upsertUser: (u: User) => void
  deleteUser: (id: string) => void
  setUsersActive: (ids: string[], active: boolean) => void

  upsertTask: (t: TaskCatalogItem) => void
  deleteTask: (id: string) => void
  upsertWorkSheet: (w: WorkSheet) => void
  deleteWorkSheet: (id: string) => void
  upsertExtra: (e: ExtraCatalogItem) => void
  deleteExtra: (id: string) => void
  upsertWarehouse: (w: Warehouse) => void
  deleteWarehouse: (id: string) => void

  markNotification: (id: string, read: boolean) => void
  markAllNotificationsRead: () => void

  resetData: () => void
}

const baseData = () => ({
  users: seed.users,
  apartments: seed.apartments,
  requests: seed.requests,
  taskCatalog: seed.taskCatalog,
  workSheets: seed.workSheets,
  extraCatalog: seed.extraCatalog,
  warehouses: seed.warehouses,
  notifications: seed.notifications,
})

const nowIso = () => new Date().toISOString()

/** Traccia chi e quando ha chiuso la pulizia; tornando indietro la traccia si azzera. */
const statusStamp = (status: RequestStatus, userId: string | null) =>
  status === 'completata'
    ? { completedAt: nowIso(), completedById: userId ?? undefined, updatedAt: nowIso(), updatedById: userId ?? undefined }
    : { completedAt: undefined, completedById: undefined, updatedAt: nowIso(), updatedById: userId ?? undefined }

const upsertBy = <T extends { id: string }>(list: T[], item: T): T[] => {
  const i = list.findIndex((x) => x.id === item.id)
  if (i === -1) return [item, ...list]
  const next = list.slice()
  next[i] = item
  return next
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      currentUserId: null,
      ...baseData(),
      filters: emptyFilters,

      login: (email, password) => {
        const user = get().users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase())
        if (!user) return { ok: false, error: 'Nessun utente trovato per questa email' }
        if (!user.active) return { ok: false, error: 'Utente non attivo' }
        if (password.length < 6) return { ok: false, error: 'Password errata fornita per questo utente' }
        set({ currentUserId: user.id })
        return { ok: true }
      },
      logout: () => set({ currentUserId: null, filters: emptyFilters }),
      switchUser: (id) => set({ currentUserId: id, filters: emptyFilters }),

      setFilters: (f) => set((s) => ({ filters: { ...s.filters, ...f } })),
      resetFilters: () => set({ filters: emptyFilters }),

      upsertRequest: (r) =>
        set((s) => ({
          requests: upsertBy(s.requests, { ...r, updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined }),
        })),
      setRequestStatus: (ids, status) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            ids.includes(r.id) ? { ...r, status, ...statusStamp(status, s.currentUserId) } : r,
          ),
        })),
      deleteRequests: (ids) => set((s) => ({ requests: s.requests.filter((r) => !ids.includes(r.id)) })),
      completeRequest: (id) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id ? { ...r, status: 'completata', ...statusStamp('completata', s.currentUserId) } : r,
          ),
        })),
      setOperatorNotes: (id, notes) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? { ...r, operatorNotes: notes.trim() ? notes : undefined, updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined }
              : r,
          ),
        })),

      upsertApartment: (a) => set((s) => ({ apartments: upsertBy(s.apartments, a) })),
      deleteApartment: (id) => set((s) => ({ apartments: s.apartments.filter((a) => a.id !== id) })),

      upsertUser: (u) => set((s) => ({ users: upsertBy(s.users, u) })),
      deleteUser: (id) => set((s) => ({ users: s.users.filter((u) => u.id !== id) })),
      setUsersActive: (ids, active) =>
        set((s) => ({ users: s.users.map((u) => (ids.includes(u.id) ? { ...u, active } : u)) })),

      upsertTask: (t) => set((s) => ({ taskCatalog: upsertBy(s.taskCatalog, t) })),
      deleteTask: (id) => set((s) => ({ taskCatalog: s.taskCatalog.filter((t) => t.id !== id) })),
      upsertWorkSheet: (w) => set((s) => ({ workSheets: upsertBy(s.workSheets, w) })),
      deleteWorkSheet: (id) => set((s) => ({ workSheets: s.workSheets.filter((w) => w.id !== id) })),
      upsertExtra: (e) => set((s) => ({ extraCatalog: upsertBy(s.extraCatalog, e) })),
      deleteExtra: (id) => set((s) => ({ extraCatalog: s.extraCatalog.filter((e) => e.id !== id) })),
      upsertWarehouse: (w) => set((s) => ({ warehouses: upsertBy(s.warehouses, w) })),
      deleteWarehouse: (id) => set((s) => ({ warehouses: s.warehouses.filter((w) => w.id !== id) })),

      markNotification: (id, read) =>
        set((s) => ({ notifications: s.notifications.map((n) => (n.id === id ? { ...n, read } : n)) })),
      markAllNotificationsRead: () =>
        set((s) => ({ notifications: s.notifications.map((n) => ({ ...n, read: true })) })),

      resetData: () => set({ ...baseData(), filters: emptyFilters }),
    }),
    {
      name: 'propromanager-state',
      /** Alzata quando cambiano forma dei dati o assegnazioni del seed: i dati locali ripartono puliti. */
      version: 2,
      migrate: () => ({ ...baseData(), filters: emptyFilters, currentUserId: null }),
      partialize: (s) => ({
        currentUserId: s.currentUserId,
        users: s.users,
        apartments: s.apartments,
        requests: s.requests,
        taskCatalog: s.taskCatalog,
        workSheets: s.workSheets,
        extraCatalog: s.extraCatalog,
        warehouses: s.warehouses,
        notifications: s.notifications,
      }),
    },
  ),
)

/* ---- selettori ---- */

export const useCurrentUser = (): User | null => {
  const id = useStore((s) => s.currentUserId)
  const users = useStore((s) => s.users)
  return users.find((u) => u.id === id) ?? null
}

export const useIsAdmin = () => useCurrentUser()?.role === 'admin'

/** Un host vede solo i propri appartamenti; l'admin li vede tutti. */
export function scopeApartments(apartments: Apartment[], user: User | null): Apartment[] {
  if (!user || user.role === 'admin') return apartments
  if (user.role === 'host') return apartments.filter((a) => a.ownerId === user.id)
  return apartments
}

export function scopeRequests(requests: CleaningRequest[], user: User | null): CleaningRequest[] {
  if (!user || user.role === 'admin') return requests
  if (user.role === 'host') return requests.filter((r) => r.hostId === user.id)
  return requests.filter((r) => r.assigneeId === user.id)
}
