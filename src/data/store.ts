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
  /**
   * Identificativi di quello che e' stato eliminato dall'app. Serve
   * all'allineamento di avvio: senza, una casa o una pulizia cancellata
   * tornerebbe indietro alla riapertura, perche' nei dati di riferimento c'e'
   * ancora.
   */
  removedIds: string[]
  /**
   * Identificativi che sono arrivati dai dati di riferimento. Confrontandoli
   * con quelli attuali si capisce cosa e' un residuo di una versione passata e
   * va tolto, e cosa invece e' stato creato qui dentro e resta.
   */
  seedIds: string[]
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
   * Allinea i dati all'avvio: rimette le scadenze fisse dei prossimi mesi e
   * porta dentro quello che e' stato aggiunto qui - case, account, controlli,
   * pulizie, interventi, spese. Aggiunge e basta: quello che c'e' non si tocca
   * e quello che e' stato eliminato non torna, cosi' il lavoro fatto dentro
   * l'app resta com'e'.
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
  /**
   * Porta dentro i dati esportati da un altro dispositivo. Quello che arriva
   * vince su quello che c'e' - e' la copia piu' recente di chi la esporta - e
   * quello che qui c'e' in piu' resta. Risponde alla domanda "sul telefono non
   * vedo quello che ho messo dal computer": i dati vivono nel browser, non su
   * un server, quindi il passaggio va fatto a mano.
   */
  importData: (payload: unknown) => { ok: boolean; error?: string; conteggio?: number }
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
  removedIds: [] as string[],
  seedIds: seed.SEED_IDS,
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

/** Quello che finisce davvero in memoria (vedi `partialize`). */
type Salvato = Partial<Pick<
  State,
  'currentUserId' | 'users' | 'apartments' | 'requests' | 'taskCatalog' | 'workSheets'
  | 'extraCatalog' | 'warehouses' | 'readNotifications' | 'inspections' | 'interventions'
  | 'adminExpenses' | 'removedIds' | 'seedIds'
>>

/**
 * Unisce per identificativo: quello che c'e' in memoria resta com'e', dal seme
 * arriva solo cio' che manca. E' il modo di far arrivare le novita' senza
 * toccare il lavoro di chi usa l'app.
 */
/**
 * Com'erano fatti gli identificativi dei dati di riferimento nelle versioni
 * precedenti. Serve una volta sola: su un dispositivo che aveva gia' l'app
 * aperta non c'e' l'elenco `seedIds`, e senza questo i vecchi calendari
 * resterebbero accanto a quelli nuovi.
 */
const RESIDUO_DI_SEME = [
  /^req-\d+-\d+$/, /^req-ferma-\d+$/, /^req-ap-[a-z]+-\d+$/,
  /^insp-\d+$/, /^insp-ap-[a-z]+-\d+$/,
  /^ric-[a-z0-9-]+-\d{6}$/, /^task-[a-z]+-\d+$/,
  /^int-\d+$/, /^spe-\d+$/,
]

/**
 * Se l'identificativo e' nato dai dati di riferimento. Quelli creati dentro
 * l'app portano l'orario di creazione - tredici cifre - e non lo sono mai.
 */
function veniveDalSeme(id: string, storici: Set<string>): boolean {
  if (/\d{13}/.test(id)) return false
  if (storici.size > 0) return storici.has(id)
  return RESIDUO_DI_SEME.some((re) => re.test(id))
}

/**
 * Allinea una raccolta ai dati di riferimento.
 *
 * Resta quello che c'e' ancora nel seme e tutto quello che e' stato creato
 * dentro l'app; se ne va solo cio' che veniva dal seme e dal seme e' sparito.
 * Arriva quello che manca, salvo sia stato eliminato apposta.
 */
function riallinea<T extends { id: string }>(
  salvati: T[] | undefined, dalSeme: T[], rimossi: Set<string>, storici: Set<string>,
): T[] {
  if (!Array.isArray(salvati)) return dalSeme
  const nelSeme = new Set(dalSeme.map((x) => x.id))
  const tenuti = salvati.filter((x) => nelSeme.has(x.id) || !veniveDalSeme(x.id, storici))
  const presenti = new Set(tenuti.map((x) => x.id))
  const nuovi = dalSeme.filter((x) => !presenti.has(x.id) && !rimossi.has(x.id))
  return nuovi.length || tenuti.length !== salvati.length ? [...nuovi, ...tenuti] : salvati
}

/** Segna come eliminato, senza ripetizioni. */
const segnaRimossi = (correnti: string[], ids: string[]) => [...new Set([...correnti, ...ids])]

/**
 * Passaggio a una versione nuova dei dati. Non si riparte da zero: si tiene
 * quello che c'e', si aggiunge quello che manca e si riallineano le poche cose
 * di cui la fonte siamo noi - gli account (nomi utente e password) e la
 * composizione dei letti, che descrive la casa e non e' una preferenza.
 */
function migrateState(persisted: unknown): ReturnType<typeof baseData> & { currentUserId: string | null; filters: RequestFilters } {
  const base = baseData()
  const salvato = persisted as Salvato | undefined
  const vuoto = !salvato || !Array.isArray(salvato.apartments) || salvato.apartments.length === 0
  if (vuoto) return { ...base, filters: emptyFilters, currentUserId: null }


  const rimossi = new Set(salvato.removedIds ?? [])
  const storici = new Set(salvato.seedIds ?? [])

  const apartments = [
    ...salvato.apartments!.map((a) => {
      const rif = base.apartments.find((b) => b.id === a.id)
      return rif ? { ...a, beds: rif.beds } : a
    }),
    ...base.apartments.filter(
      (b) => !salvato.apartments!.some((a) => a.id === b.id) && !rimossi.has(b.id),
    ),
  ].filter((a) => base.apartments.some((b) => b.id === a.id) || !veniveDalSeme(a.id, storici))

  /* Gli account di servizio li decidiamo noi: chi e' stato aggiunto dentro
     l'app resta com'e'. */
  const suoi = (salvato.users ?? []).filter((u) => !base.users.some((b) => b.id === u.id))

  return {
    currentUserId: salvato.currentUserId ?? null,
    users: [...base.users, ...suoi],
    apartments,
    requests: riallinea(salvato.requests, base.requests, rimossi, storici),
    taskCatalog: riallinea(salvato.taskCatalog, base.taskCatalog, rimossi, storici),
    workSheets: riallinea(salvato.workSheets, base.workSheets, rimossi, storici),
    extraCatalog: riallinea(salvato.extraCatalog, base.extraCatalog, rimossi, storici),
    warehouses: riallinea(salvato.warehouses, base.warehouses, rimossi, storici),
    readNotifications: salvato.readNotifications ?? [],
    removedIds: salvato.removedIds ?? [],
    seedIds: seed.SEED_IDS,
    inspections: riallinea(salvato.inspections, base.inspections, rimossi, storici),
    interventions: riallinea(salvato.interventions, base.interventions, rimossi, storici),
    adminExpenses: riallinea(salvato.adminExpenses, base.adminExpenses, rimossi, storici),
    filters: emptyFilters,
  }
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
      deleteRequests: (ids) =>
        set((s) => ({
          requests: s.requests.filter((r) => !ids.includes(r.id)),
          removedIds: segnaRimossi(s.removedIds, ids),
        })),
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
      /* Togliendo la casa se ne vanno anche le sue pulizie, i controlli e le
         spese: lasciarli faceva comparire in calendario righe intestate a
         "Appartamento non disponibile", che non si possono ne' aprire ne'
         assegnare a nessuno. */
      deleteApartment: (id) =>
        set((s) => ({
          apartments: s.apartments.filter((a) => a.id !== id),
          requests: s.requests.filter((r) => r.apartmentId !== id),
          inspections: s.inspections.filter((i) => i.apartmentId !== id),
          interventions: s.interventions.filter((i) => i.apartmentId !== id),
          adminExpenses: s.adminExpenses.filter((e) => e.apartmentId !== id),
          removedIds: segnaRimossi(s.removedIds, [
            id,
            ...s.requests.filter((r) => r.apartmentId === id).map((r) => r.id),
            ...s.inspections.filter((i) => i.apartmentId === id).map((i) => i.id),
            ...s.interventions.filter((i) => i.apartmentId === id).map((i) => i.id),
            ...s.adminExpenses.filter((e) => e.apartmentId === id).map((e) => e.id),
          ]),
        })),

      upsertUser: (u) => set((s) => ({ users: upsertBy(s.users, u) })),
      deleteUser: (id) =>
        set((s) => ({
          users: s.users.filter((u) => u.id !== id),
          removedIds: segnaRimossi(s.removedIds, [id]),
        })),
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
          const base = baseData()
          const rimossi = new Set(s.removedIds)
          const storici = new Set(s.seedIds ?? [])
          /* Le scadenze dei mesi avanti non stanno nel seme di partenza: si
             generano qui, e non vanno confuse con i residui da togliere. */
          const ricorrenti = seed.recurringInspections(new Date())
          /* Un confronto solo, contro tutto il riferimento: passando prima per
             i controlli e poi per le scadenze, il secondo giro scambiava i
             controlli per residui e li cancellava. */
          const riferimento = [
            ...base.inspections,
            ...ricorrenti.filter((r) => !base.inspections.some((b) => b.id === r.id)),
          ]
          const inspections = riallinea(s.inspections, riferimento, rimossi, storici)
          const next = {
            users: riallinea(s.users, base.users, rimossi, storici),
            apartments: riallinea(s.apartments, base.apartments, rimossi, storici),
            requests: riallinea(s.requests, base.requests, rimossi, storici),
            inspections,
            interventions: riallinea(s.interventions, base.interventions, rimossi, storici),
            adminExpenses: riallinea(s.adminExpenses, base.adminExpenses, rimossi, storici),
            seedIds: [...seed.SEED_IDS, ...ricorrenti.map((i) => i.id)],
          }
          /* Senza novita' non si riscrive niente: un `set` a vuoto farebbe
             ridisegnare mezza app a ogni apertura. */
          const cambiato = (Object.keys(next) as (keyof typeof next)[])
            .filter((k) => k !== 'seedIds')
            .some((k) => next[k] !== s[k]) || (s.seedIds ?? []).length === 0
          return cambiato ? next : {}
        }),

      upsertInspection: (i) =>
        set((s) => ({
          inspections: upsertBy(s.inspections, {
            ...i, updatedAt: nowIso(), updatedById: s.currentUserId ?? undefined,
          }),
        })),
      deleteInspections: (ids) =>
        set((s) => ({
          inspections: s.inspections.filter((i) => !ids.includes(i.id)),
          removedIds: segnaRimossi(s.removedIds, ids),
        })),
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
        set((s) => ({
          interventions: s.interventions.filter((i) => i.id !== id),
          removedIds: segnaRimossi(s.removedIds, [id]),
        })),

      upsertAdminExpense: (e) =>
        set((s) => ({
          adminExpenses: upsertBy(s.adminExpenses, {
            ...e, createdById: e.createdById ?? s.currentUserId ?? undefined,
          }),
        })),
      deleteAdminExpense: (id) =>
        set((s) => ({
          adminExpenses: s.adminExpenses.filter((e) => e.id !== id),
          removedIds: segnaRimossi(s.removedIds, [id]),
        })),

      markNotification: (id, read) =>
        set((s) => ({
          readNotifications: read
            ? [...s.readNotifications.filter((x) => x !== id), id]
            : s.readNotifications.filter((x) => x !== id),
        })),
      markAllNotificationsRead: (ids) =>
        set((s) => ({ readNotifications: [...new Set([...s.readNotifications, ...ids])] })),

      resetData: () => set({ ...baseData(), filters: emptyFilters }),

      importData: (payload) => {
        const dati = (payload as { data?: Record<string, unknown> } | undefined)?.data
        if (!dati || typeof dati !== 'object') {
          return { ok: false, error: 'File non riconosciuto: manca la sezione dati.' }
        }
        const lista = <T,>(k: string): T[] | undefined =>
          Array.isArray(dati[k]) ? (dati[k] as T[]) : undefined

        let conteggio = 0
        /* Chi arriva vince, chi c'e' in piu' resta: sovrascrivere e basta
           cancellerebbe quello che e' stato fatto su questo dispositivo. */
        const unisci = <T extends { id: string }>(correnti: T[], arrivati: T[] | undefined): T[] => {
          if (!arrivati?.length) return correnti
          conteggio += arrivati.length
          const nuovi = new Map(arrivati.map((x) => [x.id, x]))
          return [
            ...arrivati,
            ...correnti.filter((x) => !nuovi.has(x.id)),
          ]
        }

        set((s) => {
          const arrivatiIds = new Set<string>()
          for (const k of ['users', 'apartments', 'requests', 'inspections', 'interventions', 'adminExpenses']) {
            for (const x of (lista<{ id: string }>(k) ?? [])) arrivatiIds.add(x.id)
          }
          return {
            users: unisci(s.users, lista<User>('users')),
            apartments: unisci(s.apartments, lista<Apartment>('apartments')),
            requests: unisci(s.requests, lista<CleaningRequest>('requests')),
            taskCatalog: unisci(s.taskCatalog, lista<TaskCatalogItem>('taskCatalog')),
            workSheets: unisci(s.workSheets, lista<WorkSheet>('workSheets')),
            extraCatalog: unisci(s.extraCatalog, lista<ExtraCatalogItem>('extraCatalog')),
            warehouses: unisci(s.warehouses, lista<Warehouse>('warehouses')),
            inspections: unisci(s.inspections, lista<Inspection>('inspections')),
            interventions: unisci(s.interventions, lista<Intervention>('interventions')),
            adminExpenses: unisci(s.adminExpenses, lista<AdminExpense>('adminExpenses')),
            /* Quello che arriva non e' piu' "eliminato": altrimenti sparirebbe
               al primo allineamento. */
            removedIds: s.removedIds.filter((id) => !arrivatiIds.has(id)),
          }
        })
        return conteggio > 0
          ? { ok: true, conteggio }
          : { ok: false, error: 'Il file non contiene dati da importare.' }
      },
    }),
    {
      name: 'propromanager-state',
      /*
       * La versione resta ferma: quello che arriva di nuovo lo porta `syncSeed`,
       * che aggiunge senza cancellare (vedi sotto). Prima si buttava via tutto a
       * ogni cambiamento, e con l'app ormai in uso quel gesto cancellerebbe le
       * task e le pulizie inserite a mano.
       */
      version: 12,
      migrate: (persisted) => migrateState(persisted),
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
        removedIds: s.removedIds,
        seedIds: s.seedIds,
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
