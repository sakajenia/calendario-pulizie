/* Modello di dominio ricostruito dalla recon di ComfyHost (vedi docs/RECON-COMFYHOST.md). */

export type UserRole = 'admin' | 'host' | 'operator'

export interface User {
  id: string
  name: string
  email: string
  phone?: string
  role: UserRole
  active: boolean
  /** Host di riferimento per operatori e collaboratori. */
  refHostId?: string
  createdAt: string
}

export type BedType =
  | 'Letto Matrimoniale'
  | 'Letto Singolo'
  | 'Divano letto Matrimoniale'
  | 'Divano letto Singolo'
  | 'Letto a Castello'
  | 'Culla'

export interface Bed {
  id: string
  type: BedType
  label?: string
}

export type ApartmentVisibility = 'official' | 'temporary' | 'spot'
export type ListingProvider = 'none' | 'guesty' | 'hostaway'

export interface ApartmentPrices {
  base: number
  min: number
  max: number
  special?: number
  /** Prezzo per numero di ospiti: chiave = numero ospiti. */
  perGuest?: Record<number, number>
}

export interface Apartment {
  id: string
  name: string
  address: string
  district: string
  city: string
  ownerId: string
  beds: Bed[]
  notes?: string
  visibility: ApartmentVisibility
  provider: ListingProvider
  providerListingId?: string
  providerNotes?: string
  prices: ApartmentPrices
  cleaningFrequencyDays?: number
  createdAt: string
}

export const REQUEST_STATUSES = [
  'in_attesa',
  'accettata',
  'in_corso',
  'da_verificare',
  'completata',
  'cancellata',
  'cancellata_guesty',
] as const
export type RequestStatus = (typeof REQUEST_STATUSES)[number]

export interface ExtraLine {
  /** Nome dell'extra, es. "Lenzuola matrimoniali". */
  name: string
  qty: number
}

export interface RequestBed {
  /** Riferimento al letto dell'appartamento. */
  bedId: string
  type: BedType
  extras: ExtraLine[]
}

export interface Recurrence {
  enabled: boolean
  /** Ogni quanti giorni si ripete. */
  everyDays: number
  until?: string
}

export interface CleaningRequest {
  id: string
  apartmentId: string
  hostId: string
  status: RequestStatus
  createdAt: string
  /** ISO datetime. */
  checkOutAt: string
  checkInAt: string
  checkOutPeople?: number
  checkInPeople: number
  /** Letti da rifare per questa richiesta. */
  beds: RequestBed[]
  /** Extra a persona (asciugamani, cortesie). */
  perPersonExtras: ExtraLine[]
  /** Extra a livello di appartamento. */
  apartmentExtras: ExtraLine[]
  notes?: string
  internalNotes?: string
  workSheetId?: string
  assigneeId?: string
  recurrence?: Recurrence
  spotApartmentName?: string
}

export interface TaskCatalogItem {
  id: string
  name: string
  description?: string
  /** Minuti stimati. */
  estimateMin?: number
}

export interface WorkSheet {
  id: string
  name: string
  description?: string
  taskIds: string[]
}

export type ExtraScope = 'apartment' | 'bed' | 'person'

export interface ExtraCatalogItem {
  id: string
  name: string
  scope: ExtraScope
  /** Per gli extra di tipo `bed`: a quali tipologie si applica. */
  bedTypes?: BedType[]
  unitCost?: number
  warehouseId?: string
}

export interface Warehouse {
  id: string
  name: string
  address?: string
  code?: string
  notes?: string
}

export type NotificationKind = 'cleaningCreated' | 'cleaningChanged' | 'cleaningCancelled' | 'system'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  createdAt: string
  read: boolean
  requestId?: string
}

/* ---- helper di presentazione ---- */

export interface StatusMeta {
  value: RequestStatus
  label: string
  /** Classe Tailwind per il pallino/chip. */
  dot: string
  chip: string
}

export const STATUS_META: Record<RequestStatus, StatusMeta> = {
  in_attesa: {
    value: 'in_attesa', label: 'In Attesa',
    dot: 'bg-status-pending',
    chip: 'bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/25',
  },
  accettata: {
    value: 'accettata', label: 'Accettata',
    dot: 'bg-status-accepted',
    chip: 'bg-status-accepted/12 text-status-accepted ring-1 ring-inset ring-status-accepted/25',
  },
  in_corso: {
    value: 'in_corso', label: 'In Corso',
    dot: 'bg-status-progress',
    chip: 'bg-status-progress/12 text-status-progress ring-1 ring-inset ring-status-progress/25',
  },
  da_verificare: {
    value: 'da_verificare', label: 'Da Verificare',
    dot: 'bg-status-verify',
    chip: 'bg-status-verify/12 text-status-verify ring-1 ring-inset ring-status-verify/25',
  },
  completata: {
    value: 'completata', label: 'Completata',
    dot: 'bg-status-done',
    chip: 'bg-status-done/12 text-status-done ring-1 ring-inset ring-status-done/25',
  },
  cancellata: {
    value: 'cancellata', label: 'Cancellata',
    dot: 'bg-status-cancelled',
    chip: 'bg-status-cancelled/12 text-status-cancelled ring-1 ring-inset ring-status-cancelled/25',
  },
  cancellata_guesty: {
    value: 'cancellata_guesty', label: 'Cancellata Guesty',
    dot: 'bg-status-cancelled',
    chip: 'bg-status-cancelled/12 text-status-cancelled ring-1 ring-inset ring-status-cancelled/25',
  },
}
