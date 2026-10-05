import { ROLE_META, type AccountKind, type Apartment, type CleaningRequest, type User } from '@/types'

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

/**
 * L'addetto segna come completata una pulizia assegnata a lui, oppure una
 * qualsiasi pulizia di una casa della sua ditta: un turno accettato dal
 * manager senza assegnatario restava altrimenti impossibile da chiudere.
 *
 * Per riconoscere le case della ditta servono gli appartamenti: chi non li
 * passa (le chiamate di prima) ha il controllo di sempre, sull'assegnatario.
 */
export function canCompleteRequest(
  user: User | null | undefined, request: CleaningRequest | null | undefined, apartments?: Apartment[],
): boolean {
  if (!user || !request) return false
  if (canManageRequest(user, request)) return true
  if (!isOperator(user)) return false
  if (request.assigneeId === user.id) return true
  if (!user.companyId || !apartments) return false
  return apartments.some((a) => a.id === request.apartmentId && a.companyId === user.companyId)
}

/** Le note dell'addetto seguono le stesse regole del completamento. */
export const canAnnotateRequest = canCompleteRequest

/**
 * Accettare o rifiutare la pulizia spetta alla ditta, finche' e' in attesa.
 * Chi vede la richiesta la vede gia' filtrata per ditta (vedi scopeRequests),
 * quindi non serve ricontrollare a quale casa appartenga.
 */
export function canRespondToRequest(
  user: User | null | undefined, request: CleaningRequest | null | undefined,
): boolean {
  return Boolean(user && request && isOperator(user) && request.status === 'in_attesa')
}
