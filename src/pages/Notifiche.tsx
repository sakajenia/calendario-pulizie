import * as React from 'react'
import {
  AlertCircle, Bell, CheckCheck, ChevronRight, Eye, Filter, Info, Mail, MailOpen,
  MoreVertical, Pencil, Plus, Search, X, type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Button, Checkbox, Dialog, Dropdown, DropdownItem, DropdownSeparator, EmptyState,
  Input, Select, Tabs, Tooltip,
} from '@/components/ui'
import { StatusChip } from '@/components/StatusChip'
import { RequestDetail } from '@/components/requests/RequestDetail'
import { scopeRequests, useCurrentUser, useStore } from '@/data/store'
import {
  asDate, fmtDate, fmtDateTime, fmtDayLong, fmtNum, fmtRelative, norm, plural, sameDay,
} from '@/lib/format'
import type { AppNotification, CleaningRequest, NotificationKind } from '@/types'
import { cn } from '@/lib/utils'

type TabKey = 'all' | 'unread' | 'read'
type KindFilter = NotificationKind | 'all'
type SortDir = 'desc' | 'asc'

interface KindMeta {
  label: string
  icon: LucideIcon
  /** Cerchio dell'icona: colore dello stato corrispondente all'evento. */
  circle: string
}

const KIND_META: Record<NotificationKind, KindMeta> = {
  cleaningCreated: {
    label: 'Nuova richiesta',
    icon: Plus,
    circle: 'bg-status-accepted/12 text-status-accepted ring-1 ring-inset ring-status-accepted/25',
  },
  cleaningChanged: {
    label: 'Aggiornamento',
    icon: Pencil,
    circle: 'bg-status-progress/12 text-status-progress ring-1 ring-inset ring-status-progress/25',
  },
  cleaningCancelled: {
    label: 'Cancellazione',
    icon: X,
    circle: 'bg-status-cancelled/12 text-status-cancelled ring-1 ring-inset ring-status-cancelled/25',
  },
  system: {
    label: 'Sistema',
    icon: Info,
    circle: 'bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/25',
  },
}

const KIND_ORDER: NotificationKind[] = ['cleaningCreated', 'cleaningChanged', 'cleaningCancelled', 'system']

const dayLabel = (v: string) => {
  const now = new Date()
  if (sameDay(v, now)) return 'Oggi'
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (sameDay(v, yesterday)) return 'Ieri'
  return fmtDayLong(v)
}

/* ------------------------------------------------------------------- riga */

function NotificationRow({
  notification, request, selected, onSelect, onOpen, onToggleRead,
}: {
  notification: AppNotification
  request?: CleaningRequest
  selected: boolean
  onSelect: (v: boolean) => void
  onOpen: () => void
  onToggleRead: (read: boolean) => void
}) {
  const meta = KIND_META[notification.kind]
  const Icon = meta.icon
  const unread = !notification.read

  return (
    <li
      className={cn(
        'relative flex items-start gap-2 py-2.5 pl-6 pr-2 transition-colors hover:bg-muted/50',
        unread ? 'bg-primary/5' : 'bg-card',
      )}
    >
      {unread && (
        <span aria-hidden className="absolute left-2.5 top-1/2 size-2 -translate-y-1/2 rounded-full bg-primary" />
      )}

      <Checkbox
        className="mt-3.5"
        checked={selected}
        onChange={onSelect}
        label={`Seleziona la notifica "${notification.title}"`}
      />

      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg p-1 text-left focus-ring"
      >
        <span className={cn('grid size-9 shrink-0 place-items-center rounded-full', meta.circle)}>
          <Icon className="size-4" />
        </span>

        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn('text-sm', unread ? 'font-semibold' : 'font-medium')}>{notification.title}</span>
            <span className="rounded-full border border-border px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {meta.label}
            </span>
            {request && <StatusChip status={request.status} size="sm" />}
          </span>

          <span className="block text-sm text-muted-foreground">{notification.body}</span>

          <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <Tooltip label={fmtDateTime(notification.createdAt)}>
              <span className="cursor-help">{fmtRelative(notification.createdAt)}</span>
            </Tooltip>
            <span aria-hidden className="text-border">|</span>
            {request ? (
              <span className="inline-flex items-center gap-0.5 font-medium text-primary">
                Apri richiesta
                <ChevronRight className="size-3" />
              </span>
            ) : (
              <span>{notification.requestId ? 'Richiesta non disponibile' : 'Nessuna richiesta collegata'}</span>
            )}
            {unread && (
              <>
                <span aria-hidden className="text-border">|</span>
                <span className="font-medium text-primary">Da leggere</span>
              </>
            )}
          </span>
        </span>
      </button>

      <Dropdown
        align="end"
        className="w-[220px]"
        trigger={
          <Button
            variant="ghost"
            size="icon"
            className="mt-1.5 size-8"
            aria-label={`Azioni per la notifica "${notification.title}"`}
          >
            <MoreVertical />
          </Button>
        }
      >
        <DropdownItem onClick={onOpen}>
          <Eye />
          {request ? 'Apri richiesta' : 'Apri notifica'}
        </DropdownItem>
        <DropdownSeparator />
        <DropdownItem onClick={() => onToggleRead(!notification.read)}>
          {notification.read ? (
            <>
              <Mail />
              Segna come non letta
            </>
          ) : (
            <>
              <MailOpen />
              Segna come letta
            </>
          )}
        </DropdownItem>
      </Dropdown>
    </li>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Notifiche() {
  const notifications = useStore((s) => s.notifications)
  const requests = useStore((s) => s.requests)
  const markNotification = useStore((s) => s.markNotification)
  const markAllNotificationsRead = useStore((s) => s.markAllNotificationsRead)
  const user = useCurrentUser()

  const [tab, setTab] = React.useState<TabKey>('all')
  const [kind, setKind] = React.useState<KindFilter>('all')
  const [text, setText] = React.useState('')
  const [dir, setDir] = React.useState<SortDir>('desc')
  const [selected, setSelected] = React.useState<string[]>([])
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [orphan, setOrphan] = React.useState<AppNotification | null>(null)

  /* Una notifica puo' puntare a una richiesta fuori dal perimetro del ruolo:
     in quel caso vale come richiesta non piu' disponibile. */
  const requestById = React.useMemo(() => {
    const map = new Map<string, CleaningRequest>()
    for (const r of scopeRequests(requests, user)) map.set(r.id, r)
    return map
  }, [requests, user])

  const byText = React.useMemo(() => {
    const q = norm(text.trim())
    if (!q) return notifications
    return notifications.filter((n) => norm(`${n.title} ${n.body}`).includes(q))
  }, [notifications, text])

  const matchesTab = React.useCallback(
    (n: AppNotification) => (tab === 'all' ? true : tab === 'unread' ? !n.read : n.read),
    [tab],
  )

  const tabCounts = React.useMemo(() => {
    const base = kind === 'all' ? byText : byText.filter((n) => n.kind === kind)
    return {
      all: base.length,
      unread: base.filter((n) => !n.read).length,
      read: base.filter((n) => n.read).length,
    }
  }, [byText, kind])

  const kindCounts = React.useMemo(() => {
    const base = byText.filter(matchesTab)
    const acc = { cleaningCreated: 0, cleaningChanged: 0, cleaningCancelled: 0, system: 0 }
    for (const n of base) acc[n.kind] += 1
    return { all: base.length, ...acc }
  }, [byText, matchesTab])

  const rows = React.useMemo(() => {
    const list = byText.filter((n) => matchesTab(n) && (kind === 'all' || n.kind === kind))
    return list.slice().sort((a, b) => {
      const delta = asDate(a.createdAt).getTime() - asDate(b.createdAt).getTime()
      return dir === 'asc' ? delta : -delta
    })
  }, [byText, matchesTab, kind, dir])

  /* Le righe restano raggruppate per giorno: e' l'ordine in cui si leggono. */
  const groups = React.useMemo(() => {
    const out: { key: string; label: string; items: AppNotification[] }[] = []
    for (const n of rows) {
      const key = fmtDate(n.createdAt)
      const last = out[out.length - 1]
      if (last && last.key === key) last.items.push(n)
      else out.push({ key, label: dayLabel(n.createdAt), items: [n] })
    }
    return out
  }, [rows])

  const rowIds = React.useMemo(() => new Set(rows.map((n) => n.id)), [rows])
  const selectedIds = React.useMemo(() => selected.filter((id) => rowIds.has(id)), [selected, rowIds])

  const unreadTotal = React.useMemo(() => notifications.filter((n) => !n.read).length, [notifications])
  const latest = React.useMemo(() => {
    let best: string | null = null
    for (const n of notifications) {
      if (!best || asDate(n.createdAt).getTime() > asDate(best).getTime()) best = n.createdAt
    }
    return best
  }, [notifications])

  const allChecked = rows.length > 0 && selectedIds.length === rows.length
  const someChecked = selectedIds.length > 0 && !allChecked
  const hasFilters = tab !== 'all' || kind !== 'all' || text.trim() !== ''

  const toggleOne = (id: string, v: boolean) =>
    setSelected((prev) => (v ? [...prev.filter((x) => x !== id), id] : prev.filter((x) => x !== id)))

  const toggleAll = () => setSelected(allChecked ? [] : rows.map((n) => n.id))

  const bulkRead = (read: boolean) => {
    for (const id of selectedIds) markNotification(id, read)
    setSelected([])
  }

  const clearFilters = () => {
    setTab('all')
    setKind('all')
    setText('')
  }

  const openNotification = (n: AppNotification) => {
    if (!n.read) markNotification(n.id, true)
    const req = n.requestId ? requestById.get(n.requestId) : undefined
    if (req) setDetailId(req.id)
    else setOrphan(n)
  }

  const detail = detailId ? requestById.get(detailId) ?? null : null

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Notifiche"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>
              {unreadTotal === 0
                ? 'Nessuna notifica da leggere'
                : plural(unreadTotal, 'notifica da leggere', 'notifiche da leggere')}
            </span>
            <span aria-hidden className="text-border">|</span>
            <span>{fmtNum(notifications.length)} in archivio</span>
          </span>
        }
        actions={
          <Button onClick={markAllNotificationsRead} disabled={unreadTotal === 0}>
            <CheckCheck />
            Segna tutte come lette
          </Button>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'all', label: 'Tutte', count: tabCounts.all },
            { value: 'unread', label: 'Da leggere', count: tabCounts.unread },
            { value: 'read', label: 'Lette', count: tabCounts.read },
          ]}
        />

        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Cerca per titolo o contenuto"
            aria-label="Cerca fra le notifiche"
            className="h-9 pl-9 pr-9"
          />
          {text && (
            <button
              type="button"
              onClick={() => setText('')}
              aria-label="Cancella la ricerca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded text-muted-foreground transition-colors focus-ring hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="w-[210px]">
          <Select
            value={kind}
            onChange={(e) => setKind(e.target.value as KindFilter)}
            aria-label="Filtra per tipo di notifica"
            className="h-9"
            options={[
              { value: 'all', label: `Tutti i tipi (${kindCounts.all})` },
              ...KIND_ORDER.map((k) => ({ value: k, label: `${KIND_META[k].label} (${kindCounts[k]})` })),
            ]}
          />
        </div>

        <div className="w-[200px]">
          <Select
            value={dir}
            onChange={(e) => setDir(e.target.value as SortDir)}
            aria-label="Ordina le notifiche"
            className="h-9"
            options={[
              { value: 'desc', label: 'Più recenti prima' },
              { value: 'asc', label: 'Meno recenti prima' },
            ]}
          />
        </div>
      </div>

      <div
        className={cn(
          'flex shrink-0 flex-wrap items-center gap-3 border-b border-border px-5 py-2',
          selectedIds.length > 0 ? 'bg-primary/5' : 'bg-muted/40',
        )}
      >
        <Checkbox
          checked={allChecked}
          indeterminate={someChecked}
          onChange={toggleAll}
          disabled={rows.length === 0}
          label="Seleziona tutte le notifiche elencate"
        />
        <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          {rows.length === 0 ? 'Nessun risultato' : plural(rows.length, 'notifica', 'notifiche')}
        </span>

        {selectedIds.length > 0 && (
          <>
            <span className="text-sm font-medium">
              {plural(selectedIds.length, 'selezionata', 'selezionate')}
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => bulkRead(true)}>
                <MailOpen />
                Segna come lette
              </Button>
              <Button size="sm" variant="outline" onClick={() => bulkRead(false)}>
                <Mail />
                Segna come non lette
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected([])}>
                Annulla
              </Button>
            </div>
          </>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Non hai ancora nessuna notifica."
            description="Qui compaiono le nuove richieste di pulizia, le modifiche, le cancellazioni e gli avvisi di sistema."
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Filter}
            title="Nessuna notifica corrisponde ai filtri."
            description="Prova a cambiare tipo, testo cercato o stato di lettura."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Cancella filtri
              </Button>
            }
          />
        ) : (
          groups.map((g) => (
            <section key={g.key}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-muted/70 px-5 py-1.5 backdrop-blur">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                  {g.label}
                </span>
                <span className="text-[11px] tabular-nums text-muted-foreground">{fmtNum(g.items.length)}</span>
              </div>
              <ul className="divide-y divide-border">
                {g.items.map((n) => (
                  <NotificationRow
                    key={n.id}
                    notification={n}
                    request={n.requestId ? requestById.get(n.requestId) : undefined}
                    selected={selectedIds.includes(n.id)}
                    onSelect={(v) => toggleOne(n.id, v)}
                    onOpen={() => openNotification(n)}
                    onToggleRead={(read) => markNotification(n.id, read)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-border bg-card px-5 py-2.5 text-xs text-muted-foreground">
        <span>
          Notifiche elencate: {fmtNum(rows.length)} di {fmtNum(notifications.length)} — (Da leggere:{' '}
          {fmtNum(unreadTotal)} | Selezionate: {fmtNum(selectedIds.length)})
          {hasFilters && ' — filtri attivi'}
        </span>
        <span>Ultima notifica: {latest ? fmtDateTime(latest) : '—'}</span>
      </div>

      <RequestDetail request={detail} open={detail !== null} onClose={() => setDetailId(null)} />

      <Dialog
        open={orphan !== null}
        onClose={() => setOrphan(null)}
        title={orphan?.title ?? 'Notifica'}
        size="sm"
        footer={
          <Button variant="outline" onClick={() => setOrphan(null)}>
            Chiudi
          </Button>
        }
      >
        {orphan && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{orphan.body}</p>
            <div className="flex items-start gap-2.5 rounded-lg bg-muted px-3 py-2.5 text-sm">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>
                {orphan.requestId
                  ? 'La richiesta di pulizia collegata non è più disponibile.'
                  : 'Nessuna richiesta di pulizia associata a questa notifica.'}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">Ricevuta il {fmtDateTime(orphan.createdAt)}</p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
