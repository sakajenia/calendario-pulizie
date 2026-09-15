import * as React from 'react'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AdminExpense, Apartment, CleaningRequest, ExtraCatalogItem, Inspection,
  InspectionTask, Intervention, RequestStatus, TaskCatalogItem, User, Warehouse, WorkSheet,
} from '@/types'
import * as seed from './seed'
import { buildNotifications } from '@/lib/notifications'
import type { AppNotification } from '@/types'

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
  /**
   * Le notifiche non si salvano: si deducono dai dati (vedi lib/notifications).
   * Di ognuna resta solo se e' stata letta, per identificativo.
   */
  readNotifications: string[]
  /** Controlli interni sugli appartamenti: li vede solo l'area manager. */
  inspections: Inspection[]
  /** Problemi risolti in casa: alimentano il report mensile ai proprietari. */
  interventions: Intervention[]
  /** Spese anticipate dall'amministrazione, divise fra Aircover e spese extra. */
  adminExpenses: AdminExpense[]
  filters: RequestFilters

  /** L'identificativo e' l'email oppure il nome utente. */
  login: (identifier: string, password: string) => { ok: boolean; error?: string }
  logout: () => void
  switchUser: (id: string) => void

  setFilters: (f: Partial<RequestFilters>) => void
  resetFilters: () => void

  upsertRequest: (r: CleaningRequest) => void
  setRequestStatus: (ids: string[], status: RequestStatus) => void
  deleteRequests: (ids: string[]) => void
  /** L'addetto (o un manager) segna la pulizia come completata. */
  completeRequest: (id: string) => void
  /**
   * La ditta risponde a una pulizia in attesa. Accettandola se la prende in
   * carico; rifiutandola la richiesta sparisce dal calendario (resta fra le
   * richieste, dove il manager la vede cancellata).
   */
  respondToRequest: (id: string, risposta: 'accetta' | 'rifiuta') => void
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

  upsertInspection: (i: Inspection) => void
  /**
   * Rimette in calendario le scadenze fisse mancanti dei prossimi mesi. Si
   * chiama all'avvio: sono voci che devono esserci sempre, quindi tornano
   * anche se qualcuno le cancella.
   */
  ensureRecurringInspections: () => void
  deleteInspections: (ids: string[]) => void
  /** Spunta o rimette in sospeso una singola verifica del controllo. */
  setInspectionTaskDone: (inspectionId: string, taskId: string, done: boolean) => void
  addInspectionTask: (inspectionId: string, name: string) => void
  removeInspectionTask: (inspectionId: string, taskId: string) => void

  upsertIntervention: (i: Intervention) => void
  deleteIntervention: (id: string) => void

  upsertAdminExpense: (e: AdminExpense) => void
  deleteAdminExpense: (id: string) => void

  markNotification: (id: string, read: boolean) => void
  /** Le notifiche sono dedotte: gli identificativi da segnare arrivano da fuori. */
  markAllNotificationsRead: (ids: string[]) => void

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
  readNotifications: [] as string[],
  inspections: seed.inspections,
  interventions: seed.interventions,
  adminExpenses: seed.adminExpenses,
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

      login: (identifier, password) => {
        /* Si entra con l'email o col nome utente: le ditte di pulizie usano il
           nome, che e' quello che ricordano. */
        const chiave = identifier.trim().toLowerCase()
        const user = get().users.find(
          (u) => u.email.toLowerCase() === chiave || u.username?.toLowerCase() === chiave,
        )
        if (!user) return { ok: false, error: 'Nessun utente trovato per questa email o nome utente' }
        if (!user.active) return { ok: false, error: 'Utente non attivo' }
        /* Dove la password e' impostata vale quella; gli altri account
           accettano ancora una password qualsiasi di almeno 6 caratteri. */
        const wrong = user.password ? password !== user.password : password.length < 6
        if (wrong) return { ok: false, error: 'Password errata fornita per questo utente' }
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
      respondToRequest: (id, risposta) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: risposta === 'accetta' ? 'accettata' : 'cancellata',
                  /* Accettando, il turno diventa suo: e' quello che poi gli
                     permette di segnarlo completato. */
                  assigneeId: risposta === 'accetta' ? (s.currentUserId ?? r.assigneeId) : undefined,
                  updatedAt: nowIso(),
                  updatedById: s.currentUserId ?? undefined,
                }
              : r,
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

      ensureRecurringInspections: () =>
        set((s) => {
          const have = new Set(s.inspections.map((i) => i.id))
          const missing = seed.recurringInspections(new Date()).filter((i) => !have.has(i.id))
          return missing.length ? { inspections: [...missing, ...s.inspections] } : {}
        }),

      upsertInspection: (i) =>
        set((s) => ({
          inspections: upsertBy(s.inspections, {
            ...i, updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined,
          }),
        })),
      deleteInspections: (ids) =>
        set((s) => ({ inspections: s.inspections.filter((i) => !ids.includes(i.id)) })),
      setInspectionTaskDone: (inspectionId, taskId, done) =>
        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? {
                  ...i,
                  tasks: i.tasks.map((t) =>
                    t.id === taskId ? { ...t, done, doneAt: done ? nowIso() : undefined } : t,
                  ),
                  updatedAt: nowIso(),
                  updatedById: s.currentUserId ?? undefined,
                }
              : i,
          ),
        })),
      addInspectionTask: (inspectionId, name) =>
        set((s) => {
          const trimmed = name.trim()
          if (!trimmed) return {}
          const task: InspectionTask = {
            id: `it-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            name: trimmed,
            done: false,
            createdAt: nowIso(),
          }
          return {
            inspections: s.inspections.map((i) =>
              i.id === inspectionId
                ? { ...i, tasks: [...i.tasks, task], updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined }
                : i,
            ),
          }
        }),
      removeInspectionTask: (inspectionId, taskId) =>
        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? { ...i, tasks: i.tasks.filter((t) => t.id !== taskId), updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined }
              : i,
          ),
        })),

      upsertIntervention: (i) =>
        set((s) => ({
          interventions: upsertBy(s.interventions, {
            ...i, createdById: i.createdById ?? s.currentUserId ?? undefined,
          }),
        })),
      deleteIntervention: (id) =>
        set((s) => ({ interventions: s.interventions.filter((i) => i.id !== id) })),

      upsertAdminExpense: (e) =>
        set((s) => ({
          adminExpenses: upsertBy(s.adminExpenses, {
            ...e, createdById: e.createdById ?? s.currentUserId ?? undefined,
          }),
        })),
      deleteAdminExpense: (id) =>
        set((s) => ({ adminExpenses: s.adminExpenses.filter((e) => e.id !== id) })),

      markNotification: (id, read) =>
        set((s) => ({
          readNotifications: read
            ? [...s.readNotifications.filter((x) => x !== id), id]
            : s.readNotifications.filter((x) => x !== id),
        })),
      markAllNotificationsRead: (ids) =>
        set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])] })),

      resetData: () => set({ ...baseData(), filters: emptyFilters }),
    }),
    {
      name: 'propromanager-state',
      /*
       * La versione non si alza piu' a mano: e' l'impronta dei dati seme (vedi
       * SEED_STAMP). Dimenticarsi di alzarla lasciava in memoria i dati vecchi,
       * e chi rientrava continuava a vedere il calendario di prima anche con
       * l'app aggiornata. Adesso basta cambiare i dati perche' riparta pulito.
       */
      version: seed.SEED_STAMP,
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
        readNotifications: s.readNotifications,
        inspections: s.inspections,
        interventions: s.interventions,
        adminExpenses: s.adminExpenses,
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

/**
 * L'admin vede tutto; un host solo i propri appartamenti; un account pulizie
 * legato a una ditta solo le case affidate a quella ditta.
 */
export function scopeApartments(apartments: Apartment[], user: User | null): Apartment[] {
  if (!user || user.role === 'admin') return apartments
  if (user.role === 'host') return apartments.filter((a) => a.ownerId === user.id)
  if (user.companyId) return apartments.filter((a) => a.companyId === user.companyId)
  return apartments
}

/**
 * Le pulizie di una ditta comprendono anche i turni non ancora presi in
 * carico, percio' servono gli appartamenti: il filtro passa dalla casa, non
 * dall'assegnatario. Senza l'elenco un account di ditta non vede nulla -
 * errore evidente, invece di mostrargli le case di un'altra ditta.
 */
export function scopeRequests(
  requests: CleaningRequest[], user: User | null, apartments: Apartment[] = [],
): CleaningRequest[] {
  if (!user || user.role === 'admin') return requests
  if (user.role === 'host') return requests.filter((r) => r.hostId === user.id)
  if (user.companyId) {
    const mine = new Set(
      apartments.filter((a) => a.companyId === user.companyId).map((a) => a.id),
    )
    return requests.filter((r) => mine.has(r.apartmentId))
  }
  return requests.filter((r) => r.assigneeId === user.id)
}

/**
 * Le notifiche del momento per chi e' collegato. Si ricalcolano dai dati: non
 * esiste un elenco salvato, solo il segno di quali sono gia' state lette.
 */
export function useNotifications(): AppNotification[] {
  const requests = useStore((s) => s.requests)
  const apartments = useStore((s) => s.apartments)
  const inspections = useStore((s) => s.inspections)
  const read = useStore((s) => s.readNotifications)
  const user = useCurrentUser()

  return React.useMemo(
    () =>
      buildNotifications({
        /* L'account di una ditta vede solo le richieste delle proprie case. */
        requests: scopeRequests(requests, user, apartments),
        apartments,
        inspections,
        user,
        read,
      }),
    [requests, apartments, inspections, user, read],
  )
}
