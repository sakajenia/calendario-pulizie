import { ROLE_META, type AccountKind, type CleaningRequest, type User } from '@/types'

/** Tipologia di account: "manager" fa tutto, "pulizie" completa e annota. */
export const accountKind = (user: User | null | undefined): AccountKind | null =>
  user ? ROLE_META[user.role].kind : null

export const isManager = (user: User | null | undefined) => accountKind(user) === 'manager'
export const isOperator = (user: User | null | undefined) => accountKind(user) === 'pulizie'

/** Un manager amministratore governa tutto; un manager host solo le proprie richieste. */
export function canManageRequest(user: User | null | undefined, request?: CleaningRequest | null): boolean {
  if (!isManager(user) || !user) return false
  if (user.role === 'admin') return true
  return !request || request.hostId === user.id
}

/** Modifica di data, note e ogni altro campo della pulizia. */
export const canEditRequest = canManageRequest
/** Eliminazione della pulizia. */
export const canDeleteRequest = canManageRequest
/** Cambio libero di stato (compresi annullamenti e ritorni indietro). */
export const canChangeStatus = canManageRequest
/** Creazione di nuove richieste di pulizia. */
export const canCreateRequest = (user: User | null | undefined) => isManager(user)

/** L'addetto segna come completata solo le pulizie che gli sono assegnate. */
export function canCompleteRequest(user: User | null | undefined, request: CleaningRequest | null | undefined): boolean {
  if (!user || !request) return false
  if (canManageRequest(user, request)) return true
  return isOperator(user) && request.assigneeId === user.id
}

/** Le note dell'addetto seguono le stesse regole del completamento. */
export const canAnnotateRequest = canCompleteRequest
