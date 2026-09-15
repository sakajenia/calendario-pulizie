/*
 * Le notifiche non sono un archivio di eventi: si deducono dai dati, ogni
 * volta, e valgono solo finche' c'e' davvero qualcosa da fare.
 *
 * Chi vede cosa:
 * - area manager: le richieste non ancora accettate quando l'intervento e'
 *   entro due giorni, quelle appena accettate, e le task o i controlli
 *   aggiunti al calendario;
 * - account pulizie: solo le richieste delle proprie case che non hanno
 *   ancora accettato a due giorni dall'intervento.
 *
 * Le nuove richieste, da sole, non avvisano nessuno: ne arrivano a decine e
 * non chiedono niente. Diventano una notifica quando restano ferme.
 */
import {
  ACCEPT_DEADLINE_DAYS, INSPECTION_KIND_META, INSPECTOR_META,
  type AppNotification, type Apartment, type CleaningRequest, type Inspection,
  type User,
} from '@/types'
import { asDate, fmtDateTime } from '@/lib/format'
import { isManager } from '@/lib/permissions'

const DAY_MS = 24 * 60 * 60 * 1000

/** Quanto indietro si guarda per le cose gia' successe (accettazioni, aggiunte). */
const LOOKBACK_DAYS = 7

const ms = (v: string) => asDate(v).getTime()

/** Nome della casa: senza, la notifica direbbe solo un identificativo. */
const houseName = (apartments: Apartment[], id: string | undefined) =>
  apartments.find((a) => a.id === id)?.name ?? 'Appartamento non disponibile'

/**
 * Da quando una richiesta non accettata diventa un problema: due giorni prima
 * del check-out. E' anche il momento a cui si data la notifica, cosi' in
 * elenco finisce nel giorno giusto invece che sempre in testa.
 */
const deadlineOf = (r: CleaningRequest) => ms(r.checkOutAt) - ACCEPT_DEADLINE_DAYS * DAY_MS

export interface NotificationInput {
  requests: CleaningRequest[]
  apartments: Apartment[]
  inspections: Inspection[]
  user: User | null
  /** Identificativi gia' letti. */
  read: string[]
  /** Momento di riferimento: iniettabile per i test. */
  now?: Date
}

export function buildNotifications({
  requests, apartments, inspections, user, read, now = new Date(),
}: NotificationInput): AppNotification[] {
  if (!user) return []
  const readSet = new Set(read)
  const t = now.getTime()
  const since = t - LOOKBACK_DAYS * DAY_MS
  const manager = isManager(user)
  const out: AppNotification[] = []

  /* ---- 1. richieste ferme a ridosso dell'intervento (tutti) ---- */
  for (const r of requests) {
    if (r.status !== 'in_attesa') continue
    const deadline = deadlineOf(r)
    if (deadline > t) continue
    const casa = houseName(apartments, r.apartmentId)
    const tardi = ms(r.checkOutAt) < t
    out.push({
      id: `da-accettare:${r.id}`,
      kind: 'daAccettare',
      title: tardi ? `Non accettata: ${casa}` : `Da accettare: ${casa}`,
      body: tardi
        ? `Check-out del ${fmtDateTime(r.checkOutAt)} già passato e la pulizia non è mai stata accettata.`
        : `Check-out ${fmtDateTime(r.checkOutAt)}: mancano meno di ${ACCEPT_DEADLINE_DAYS} giorni e nessuno ha ancora accettato.`,
      createdAt: new Date(deadline).toISOString(),
      read: readSet.has(`da-accettare:${r.id}`),
      requestId: r.id,
    })
  }

  /* Le pulizie si fermano qui: del resto non devono sapere niente. */
  if (!manager) return sortNewestFirst(out)

  /* ---- 2. richieste accettate di recente ---- */
  for (const r of requests) {
    if (r.status !== 'accettata') continue
    const at = ms(r.updatedAt ?? r.createdAt)
    if (at < since || at > t) continue
    out.push({
      id: `accettata:${r.id}`,
      kind: 'accettata',
      title: `Accettata: ${houseName(apartments, r.apartmentId)}`,
      body: `Pulizia presa in carico per il check-out del ${fmtDateTime(r.checkOutAt)}.`,
      createdAt: new Date(at).toISOString(),
      read: readSet.has(`accettata:${r.id}`),
      requestId: r.id,
    })
  }

  /* ---- 3. task e controlli messi in calendario ---- */
  for (const i of inspections) {
    /* Le scadenze fisse tornano ogni mese da sole: non sono una novita'. */
    if (i.recurring) continue
    const chi = INSPECTOR_META[i.inspectorId].label
    const tipo = INSPECTION_KIND_META[i.kind].label
    const dove = i.apartmentId ? houseName(apartments, i.apartmentId) : (i.title ?? tipo)
    const nata = ms(i.createdAt)

    if (nata >= since && nata <= t) {
      out.push({
        id: `voce-nuova:${i.id}`,
        kind: 'taskAggiunta',
        title: `${tipo} in calendario: ${dove}`,
        body: `${chi} · ${fmtDateTime(i.scheduledAt)} · ${i.tasks.length} verifiche.`,
        createdAt: i.createdAt,
        read: readSet.has(`voce-nuova:${i.id}`),
      })
      continue
    }

    /* Verifiche aggiunte dopo: una notifica per ognuna, cosi' si vede cosa e'
       cambiato su una voce gia' in calendario. */
    for (const task of i.tasks) {
      if (!task.createdAt) continue
      const quando = ms(task.createdAt)
      if (quando < since || quando > t || quando <= nata) continue
      out.push({
        id: `task-nuova:${i.id}:${task.id}`,
        kind: 'taskAggiunta',
        title: `Nuova task: ${dove}`,
        body: `${task.name} · ${chi} · ${fmtDateTime(i.scheduledAt)}`,
        createdAt: task.createdAt,
        read: readSet.has(`task-nuova:${i.id}:${task.id}`),
      })
    }
  }

  return sortNewestFirst(out)
}

const sortNewestFirst = (list: AppNotification[]) =>
  list.sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
