import { useSearchParams } from 'react-router-dom'
import * as React from 'react'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  getMonth, getYear, isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns'
import { it } from 'date-fns/locale'
import {
  BedDouble, CalendarCheck, CalendarDays, CheckSquare, ChevronDown, ChevronLeft,
  ChevronRight, Plus, RotateCw, Search, SearchX, Trash2, Users, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { FirstRunGuide } from '@/components/FirstRunGuide'
import {
  Button, Card, Checkbox, Dialog, Dropdown, DropdownItem, EmptyState, Input, Select, Tabs,
} from '@/components/ui'
import { StatusDot } from '@/components/StatusChip'
import { RequestCard, RequestDetail } from '@/components/requests/RequestDetail'
import { RequestForm } from '@/components/requests/RequestForm'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { scopeApartments, scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { canCreateRequest, canEditRequest, isManager } from '@/lib/permissions'
import { useToast } from '@/components/feedback/Toast'
import { TODAY } from '@/data/seed'
import { asDate, fmtDayLong, fmtMonthYear, fmtTime, norm, plural } from '@/lib/format'
import { REQUEST_STATUSES, STATUS_META, type CleaningRequest, type RequestStatus } from '@/types'
import { cn } from '@/lib/utils'

type CalView = 'mese' | 'settimana'
type SortKey = 'checkout-asc' | 'checkout-desc' | 'created-desc' | 'status'

/** La settimana lavorativa italiana parte da lunedì. */
const WEEK = { weekStartsOn: 1 } as const

const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  format(addDays(startOfWeek(new Date(2024, 0, 1), WEEK), i), 'EEE', { locale: it }),
)
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), 'LLL', { locale: it }))

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'checkout-asc', label: 'Check-out crescente' },
  { value: 'checkout-desc', label: 'Check-out decrescente' },
  { value: 'created-desc', label: 'Creazione più recente' },
  { value: 'status', label: 'Stato richiesta' },
]

const dayKey = (v: string | Date) => format(asDate(v), 'yyyy-MM-dd')
const ms = (v: string) => asDate(v).getTime()

function sortRequests(list: CleaningRequest[], key: SortKey): CleaningRequest[] {
  const out = list.slice()
  switch (key) {
    case 'checkout-desc':
      return out.sort((a, b) => ms(b.checkOutAt) - ms(a.checkOutAt))
    case 'created-desc':
      return out.sort((a, b) => ms(b.createdAt) - ms(a.createdAt))
    case 'status':
      return out.sort(
        (a, b) =>
          REQUEST_STATUSES.indexOf(a.status) - REQUEST_STATUSES.indexOf(b.status) ||
          ms(a.checkOutAt) - ms(b.checkOutAt),
      )
    default:
      return out.sort((a, b) => ms(a.checkOutAt) - ms(b.checkOutAt))
  }
}

/* --------------------------------------------------------- selettore mese */

function MonthPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = React.useState(false)
  const [year, setYear] = React.useState(() => getYear(value))
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) setYear(getYear(value))
  }, [open, value])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted focus-ring"
      >
        <span className="font-display text-base font-bold capitalize tracking-tight">{fmtMonthYear(value)}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-border bg-popover p-3 shadow-raised animate-scale-in">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente">
              <ChevronLeft />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo">
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, i) => {
              const current = i === getMonth(value) && year === getYear(value)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange(new Date(year, i, 1))
                    setOpen(false)
                  }}
                  className={cn(
                    'rounded-md py-2 text-xs font-medium capitalize transition-colors focus-ring',
                    current ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              onChange(TODAY)
              setOpen(false)
            }}
          >
            <CalendarCheck /> Mese corrente
          </Button>
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Calendario() {
  const user = useCurrentUser()
  const allRequests = useStore((s) => s.requests)
  const allApartments = useStore((s) => s.apartments)
  const setRequestStatus = useStore((s) => s.setRequestStatus)
  const deleteRequests = useStore((s) => s.deleteRequests)
  const upsertRequest = useStore((s) => s.upsertRequest)
  const toast = useToast()

  /* Un account pulizie non crea richieste e non agisce sull'insieme. */
  const mayCreate = canCreateRequest(user)
  const mayBulk = isManager(user)

  const [view, setView] = React.useState<CalView>('mese')
  const [cursor, setCursor] = React.useState<Date>(TODAY)
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(TODAY)
  const [text, setText] = React.useState('')
  const [statuses, setStatuses] = React.useState<RequestStatus[]>([])
  const [sort, setSort] = React.useState<SortKey>('checkout-asc')

  const [selectionMode, setSelectionMode] = React.useState(false)
  const [checkedIds, setCheckedIds] = React.useState<string[]>([])
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<CleaningRequest | null>(null)
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false)

  const [detail, setDetail] = React.useState<CleaningRequest | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [searchParams, setSearchParams] = useSearchParams()
  const isDesktop = useIsDesktop()

  /* La palette comandi apre il modulo passando da qui: consumiamo il parametro
     subito, cosi' un ricaricamento non riapre il modulo a sorpresa. */
  React.useEffect(() => {
    if (searchParams.get('nuova') !== '1') return
    if (mayCreate) setFormOpen(true)
    const next = new URLSearchParams(searchParams)
    next.delete('nuova')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams, mayCreate])
  const [editing, setEditing] = React.useState<CleaningRequest | null>(null)
  const [reloading, setReloading] = React.useState(false)
  const reloadTimer = React.useRef<number>()

  React.useEffect(() => () => window.clearTimeout(reloadTimer.current), [])

  const apartments = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])
  const apartmentById = React.useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments])

  const labelOf = React.useCallback(
    (r: CleaningRequest) => {
      const ap = apartmentById.get(r.apartmentId)
      return ap?.name ?? r.spotApartmentName ?? 'Appartamento non disponibile'
    },
    [apartmentById],
  )

  const scoped = React.useMemo(() => scopeRequests(allRequests, user), [allRequests, user])

  /* Il testo filtra sia la lista sia i pallini del calendario: la vista resta coerente. */
  const searched = React.useMemo(() => {
    const q = norm(text.trim())
    if (!q) return scoped
    return scoped.filter((r) => {
      const ap = apartmentById.get(r.apartmentId)
      const hay = norm(
        [ap?.name ?? '', ap?.address ?? '', ap?.district ?? '', ap?.city ?? '', r.spotApartmentName ?? ''].join(' '),
      )
      return hay.includes(q)
    })
  }, [scoped, text, apartmentById])

  const base = React.useMemo(
    () => (statuses.length ? searched.filter((r) => statuses.includes(r.status)) : searched),
    [searched, statuses],
  )

  const byDay = React.useMemo(() => {
    const m = new Map<string, CleaningRequest[]>()
    for (const r of base) {
      const k = dayKey(r.checkOutAt)
      const list = m.get(k)
      if (list) list.push(r)
      else m.set(k, [r])
    }
    for (const list of m.values()) list.sort((a, b) => ms(a.checkOutAt) - ms(b.checkOutAt))
    return m
  }, [base])

  const gridDays = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), WEEK)
    return eachDayOfInterval({ start, end: addDays(start, 41) })
  }, [cursor])

  const weekDays = React.useMemo(
    () => eachDayOfInterval({ start: startOfWeek(cursor, WEEK), end: endOfWeek(cursor, WEEK) }),
    [cursor],
  )

  const [periodStart, periodEnd] = React.useMemo(
    () =>
      view === 'mese'
        ? ([startOfMonth(cursor), endOfMonth(cursor)] as const)
        : ([startOfWeek(cursor, WEEK), endOfWeek(cursor, WEEK)] as const),
    [view, cursor],
  )

  const inPeriod = React.useCallback(
    (r: CleaningRequest) => {
      const t = ms(r.checkOutAt)
      return t >= periodStart.getTime() && t <= periodEnd.getTime()
    },
    [periodStart, periodEnd],
  )

  const periodSearched = React.useMemo(() => searched.filter(inPeriod), [searched, inPeriod])
  const periodRequests = React.useMemo(() => base.filter(inPeriod), [base, inPeriod])

  const countByStatus = React.useMemo(() => {
    const acc = {} as Record<RequestStatus, number>
    for (const s of REQUEST_STATUSES) acc[s] = 0
    for (const r of periodSearched) acc[r.status] += 1
    return acc
  }, [periodSearched])

  const visible = React.useMemo(() => {
    const list = selectedDay ? (byDay.get(dayKey(selectedDay)) ?? []) : periodRequests
    return sortRequests(list, sort)
  }, [selectedDay, byDay, periodRequests, sort])

  const checked = React.useMemo(
    () => visible.filter((r) => checkedIds.includes(r.id)),
    [visible, checkedIds],
  )

  const allChecked = visible.length > 0 && checked.length === visible.length
  const toggleAll = () => setCheckedIds(allChecked ? [] : visible.map((r) => r.id))

  const totalBeds = visible.reduce((n, r) => n + r.beds.length, 0)
  const totalGuests = visible.reduce((n, r) => n + r.checkInPeople, 0)
  const todayCount = byDay.get(dayKey(TODAY))?.length ?? 0
  const filtersOn = text.trim().length > 0 || statuses.length > 0

  /* ---- azioni ---- */

  const move = (dir: -1 | 1) => {
    setCursor((c) => (view === 'mese' ? addMonths(c, dir) : addWeeks(c, dir)))
    setSelectedDay(null)
    setCheckedIds([])
  }

  const goToday = () => {
    setCursor(TODAY)
    setSelectedDay(TODAY)
    setCheckedIds([])
  }

  const changeView = (v: CalView) => {
    setView(v)
    if (selectedDay) setCursor(selectedDay)
    setCheckedIds([])
  }

  /* Nella vista mese il tocco su un giorno apre il riepilogo in una finestra:
     sotto `lg` la lista sottostante e' fuori schermo. Da `lg` in su la colonna
     laterale e' gia' visibile, quindi la finestra duplicherebbe il contenuto e
     ruberebbe il focus a ogni clic: resta il comportamento a interruttore,
     come nella vista settimana. */
  const pickDay = (d: Date) => {
    setCheckedIds([])
    if (!isSameMonth(d, cursor)) setCursor(d)
    if (view === 'mese' && !isDesktop) {
      setSelectedDay(d)
      setDayDialogOpen(true)
      return
    }
    setSelectedDay((cur) => (cur && isSameDay(cur, d) ? null : d))
  }

  const toggleStatus = (s: RequestStatus) => {
    setStatuses((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]))
    setCheckedIds([])
  }

  const openDetail = (r: CleaningRequest) => setDetail(r)

  /* I dialog non si sovrappongono: chiudiamo il riepilogo del giorno prima di
     aprire il dettaglio o il modulo. */
  const openDetailFromDay = (r: CleaningRequest) => {
    setDayDialogOpen(false)
    setDetail(r)
  }

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (r: CleaningRequest) => {
    if (!canEditRequest(user, r)) return
    setDetail(null)
    setEditing(r)
    setFormOpen(true)
  }

  /* L'eliminazione dal dettaglio passa dalla stessa conferma delle altre pagine,
     con la notifica che permette di rimettere la richiesta come era. */
  const confirmDeleteOne = () => {
    const r = pendingDelete
    if (!r) return
    deleteRequests([r.id])
    setPendingDelete(null)
    setDetail(null)
    toast({
      title: 'Richiesta eliminata',
      description: 'Puoi rimetterla come era finche’ questa notifica resta a schermo.',
      action: { label: 'Annulla', onClick: () => upsertRequest(r) },
    })
  }

  /* Il refresh riallinea solo la vista: il ripristino del dataset vive in Impostazioni,
     dietro conferma, e qui cancellerebbe senza preavviso le richieste create dall'utente. */
  const reload = () => {
    setCheckedIds([])
    setSelectionMode(false)
    setReloading(true)
    window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => setReloading(false), 600)
  }

  const applyBulkStatus = (s: RequestStatus) => {
    setRequestStatus(checked.map((r) => r.id), s)
    setCheckedIds([])
  }

  const confirmDelete = () => {
    deleteRequests(checked.map((r) => r.id))
    setCheckedIds([])
    setConfirmOpen(false)
  }

  /* ---- etichette ---- */

  const periodLabel = view === 'mese' ? 'del mese' : 'della settimana'
  const periodTitle =
    view === 'mese'
      ? `Tutte le richieste di ${fmtMonthYear(cursor)}`
      : `Settimana ${format(periodStart, 'd MMM', { locale: it })} – ${format(periodEnd, 'd MMM yyyy', { locale: it })}`

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Calendario"
        subtitle={
          <span>
            <span className="capitalize">{fmtMonthYear(cursor)}</span> ·{' '}
            {plural(periodRequests.length, 'richiesta', 'richieste')} nel periodo · {todayCount} in data odierna
          </span>
        }
      />

      <FirstRunGuide />

      <div className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto p-4 pb-24 lg:grid-cols-[minmax(0,55fr)_minmax(0,45fr)] lg:content-stretch lg:overflow-hidden lg:pb-4">
        {/* ---------------------------------------------------- calendario */}
        <Card className="flex min-w-0 flex-col lg:min-h-0 lg:overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-0.5">
              <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Periodo precedente">
                <ChevronLeft />
              </Button>
              <MonthPicker
                value={cursor}
                onChange={(d) => {
                  setCursor(d)
                  setSelectedDay(null)
                  setCheckedIds([])
                }}
              />
              <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Periodo successivo">
                <ChevronRight />
              </Button>
            </div>

            <div className="ml-auto flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToday}>
                <CalendarCheck /> In data odierna
              </Button>
              <Tabs
                value={view}
                onChange={changeView}
                items={[
                  { value: 'mese', label: 'Mese' },
                  { value: 'settimana', label: 'Settimana' },
                ]}
              />
            </div>
          </div>

          {view === 'mese' ? (
            <div className="flex flex-col p-2 lg:min-h-0 lg:flex-1">
              <div className="grid grid-cols-7 pb-1">
                {WEEKDAYS.map((w) => (
                  <div key={w} className="py-1 text-center text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {w}
                  </div>
                ))}
              </div>

              <div className="grid auto-rows-[minmax(58px,auto)] grid-cols-7 gap-1 lg:min-h-0 lg:flex-1 lg:auto-rows-fr">
                {gridDays.map((d) => {
                  const list = byDay.get(dayKey(d)) ?? []
                  const outside = !isSameMonth(d, cursor)
                  const isToday = isSameDay(d, TODAY)
                  const isSelected = selectedDay !== null && isSameDay(d, selectedDay)
                  const weekend = d.getDay() === 0 || d.getDay() === 6
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => pickDay(d)}
                      aria-pressed={isSelected}
                      aria-haspopup="dialog"
                      aria-label={`${fmtDayLong(d)} · ${plural(list.length, 'richiesta', 'richieste')}`}
                      className={cn(
                        'flex min-h-[52px] flex-col items-start gap-1.5 rounded-lg border border-transparent p-1.5 text-left transition-colors focus-ring',
                        weekend && !outside && 'bg-muted/40',
                        outside && 'opacity-45',
                        !isSelected && 'hover:border-border hover:bg-muted',
                        isSelected && 'border-primary bg-primary/5 ring-1 ring-primary',
                      )}
                    >
                      <span
                        className={cn(
                          'grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold tabular-nums',
                          isToday && 'bg-primary text-primary-foreground shadow-brand',
                          !isToday && outside && 'text-muted-foreground',
                        )}
                      >
                        {d.getDate()}
                      </span>

                      {list.length > 0 && (
                        <span className="flex w-full flex-wrap items-center gap-1">
                          {list.slice(0, 4).map((r) => (
                            <StatusDot key={r.id} status={r.status} className="size-2" />
                          ))}
                          {list.length > 4 && (
                            <span className="text-[10px] font-semibold leading-none text-muted-foreground">
                              +{list.length - 4}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <div className="grid min-w-[820px] grid-cols-7 gap-2">
                {weekDays.map((d) => {
                  const list = byDay.get(dayKey(d)) ?? []
                  const isToday = isSameDay(d, TODAY)
                  const isSelected = selectedDay !== null && isSameDay(d, selectedDay)
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        'flex min-h-[240px] min-w-0 flex-col rounded-lg border p-1.5',
                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'border-border bg-muted/30',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => pickDay(d)}
                        className="mb-2 flex items-center gap-2 rounded-md px-1 py-1 text-left transition-colors hover:bg-muted focus-ring"
                      >
                        <span
                          className={cn(
                            'grid size-7 place-items-center rounded-full text-sm font-bold tabular-nums',
                            isToday && 'bg-primary text-primary-foreground',
                          )}
                        >
                          {d.getDate()}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                          {format(d, 'EEE', { locale: it })}
                        </span>
                        <span className="ml-auto text-[11px] font-medium tabular-nums text-muted-foreground">
                          {list.length}
                        </span>
                      </button>

                      <div className="min-w-0 space-y-1.5">
                        {list.map((r) => (
                          <button
                            key={r.id}
                            type="button"
                            onClick={() => openDetail(r)}
                            title={`${labelOf(r)} · ${STATUS_META[r.status].label}`}
                            aria-label={`${labelOf(r)} · ${fmtTime(r.checkOutAt)} · ${STATUS_META[r.status].label}`}
                            className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border border-border bg-card p-2 text-left shadow-card transition-shadow hover:shadow-raised focus-ring"
                          >
                            {/* Nelle celle strette lo stato e' solo un pallino: l'etichetta testuale
                                sbordava dalla card. Il testo completo resta in title/aria-label. */}
                            <span className="flex w-full min-w-0 items-center gap-1.5">
                              <StatusDot status={r.status} className="size-2 shrink-0" />
                              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tabular-nums">
                                {fmtTime(r.checkOutAt)}
                              </span>
                            </span>
                            <span className="block w-full min-w-0 truncate text-xs font-medium">{labelOf(r)}</span>
                            <span className="block w-full min-w-0 truncate text-[11px] text-muted-foreground">
                              Da rifare: {r.beds.length} · Ospiti: {r.checkInPeople}
                            </span>
                          </button>
                        ))}
                        {list.length === 0 && (
                          <p className="py-6 text-center text-[11px] text-muted-foreground">Nessuna richiesta</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* legenda-filtro per stato, con i conteggi del periodo visualizzato */}
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-border px-2.5 py-2">
            <button
              type="button"
              onClick={() => setStatuses([])}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-ring',
                statuses.length === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              Tutti
              <span className="tabular-nums">{periodSearched.length}</span>
            </button>
            {REQUEST_STATUSES.map((s) => {
              const on = statuses.includes(s)
              const n = countByStatus[s]
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleStatus(s)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-ring',
                    on ? 'bg-muted text-foreground ring-1 ring-inset ring-border' : 'text-muted-foreground hover:bg-muted',
                    !on && n === 0 && 'opacity-45',
                  )}
                >
                  <StatusDot status={s} className="size-2" />
                  {STATUS_META[s].label}
                  <span className="tabular-nums">{n}</span>
                </button>
              )
            })}
          </div>
        </Card>

        {/* --------------------------------------------------------- lista */}
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="shrink-0 space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => {
                  setText(e.target.value)
                  setCheckedIds([])
                }}
                placeholder="Filtra per nome o indirizzo"
                className="pl-9 pr-9"
                aria-label="Filtra per nome o indirizzo"
              />
              {text && (
                <button
                  type="button"
                  onClick={() => setText('')}
                  aria-label="Azzera la ricerca"
                  className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-sm font-bold leading-snug">
                  {selectedDay ? fmtDayLong(selectedDay) : periodTitle}
                  <span className="font-normal text-muted-foreground">
                    {' · '}
                    {plural(visible.length, 'richiesta', 'richieste')}
                  </span>
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble className="size-3.5" /> {totalBeds} letti da rifare
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="size-3.5" /> {totalGuests} ospiti in arrivo
                  </span>
                </p>
              </div>

              {selectedDay && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedDay(null)}>
                  <X /> Tutte le richieste
                </Button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Select
                className="h-8 w-auto text-xs"
                aria-label="Ordinamento"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                options={SORT_OPTIONS}
              />
              {mayBulk && (
                <Button
                  variant={selectionMode ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setSelectionMode((v) => !v)
                    setCheckedIds([])
                  }}
                >
                  <CheckSquare /> {selectionMode ? 'Chiudi selezione' : 'Seleziona'}
                </Button>
              )}

              {mayBulk && selectionMode && visible.length > 0 && (
                <span className="ml-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allChecked}
                    indeterminate={checked.length > 0 && !allChecked}
                    onChange={toggleAll}
                    label="Seleziona tutte le richieste elencate"
                  />
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="rounded transition-colors hover:text-foreground focus-ring"
                  >
                    Seleziona tutte
                  </button>
                </span>
              )}

              {filtersOn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => {
                    setText('')
                    setStatuses([])
                  }}
                >
                  Cancella filtri
                </Button>
              )}
            </div>

            {mayBulk && selectionMode && checked.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted px-3 py-2">
                <span className="text-xs font-semibold">
                  {plural(checked.length, 'richiesta selezionata', 'richieste selezionate')}
                </span>
                <div className="ml-auto flex items-center gap-2">
                  <Dropdown
                    trigger={
                      <Button variant="outline" size="sm">
                        Cambia stato <ChevronDown />
                      </Button>
                    }
                  >
                    {REQUEST_STATUSES.map((s) => (
                      <DropdownItem key={s} onClick={() => applyBulkStatus(s)}>
                        <StatusDot status={s} className="size-2" />
                        {STATUS_META[s].label}
                      </DropdownItem>
                    ))}
                  </Dropdown>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
                    <Trash2 /> Elimina
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setCheckedIds([])}>
                    Annulla
                  </Button>
                </div>
              </div>
            )}
          </Card>

          {/* Sotto lg scorre solo il contenitore esterno: qui niente altezza ne'
              overflow, altrimenti si annidano due aree di scorrimento. */}
          <div className="stagger space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-24 lg:pr-1">
            {visible.length === 0 ? (
              <Card>
                {filtersOn ? (
                  <EmptyState
                    icon={SearchX}
                    title="Nessuna richiesta trovata"
                    description="Nessun risultato per i filtri attivi. Prova a modificare la ricerca o lo stato selezionato."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setText('')
                          setStatuses([])
                        }}
                      >
                        Cancella filtri
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title={selectedDay ? 'Nessuna richiesta in questa data' : `Nessuna richiesta ${periodLabel}`}
                    description={
                      selectedDay
                        ? `Non ci sono pulizie programmate per ${fmtDayLong(selectedDay)}.`
                        : mayCreate
                          ? 'Naviga fra i periodi oppure crea una nuova richiesta di pulizia.'
                          : 'Naviga fra i periodi per vedere le pulizie assegnate.'
                    }
                    action={mayCreate ? (
                      <Button onClick={openNew}>
                        <Plus /> Nuova richiesta
                      </Button>
                    ) : undefined}
                  />
                )}
              </Card>
            ) : (
              visible.map((r) =>
                mayBulk && selectionMode ? (
                  <div key={r.id} className="flex items-start gap-2">
                    <span className="pt-5">
                      <Checkbox
                        checked={checkedIds.includes(r.id)}
                        onChange={(v) =>
                          setCheckedIds((cur) => (v ? [...cur, r.id] : cur.filter((id) => id !== r.id)))
                        }
                        label={`Seleziona la richiesta di ${labelOf(r)}`}
                      />
                    </span>
                    <div className="min-w-0 flex-1">
                      <RequestCard request={r} active={checkedIds.includes(r.id)} onClick={() => openDetail(r)} />
                    </div>
                  </div>
                ) : (
                  <RequestCard key={r.id} request={r} onClick={() => openDetail(r)} />
                ),
              )
            )}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------------------- FAB */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={reload}
          title="Aggiorna la vista"
          aria-label="Aggiorna la vista"
          className="h-12 w-12 rounded-full bg-card shadow-raised"
        >
          <RotateCw className={cn(reloading && 'animate-spin')} />
        </Button>
        {mayCreate && (
          <Button
            size="icon"
            onClick={openNew}
            title="Nuova richiesta"
            aria-label="Nuova richiesta"
            className="h-14 w-14 rounded-full"
          >
            <Plus className="size-5" />
          </Button>
        )}
      </div>

      <Dialog
        open={dayDialogOpen && selectedDay !== null && !isDesktop}
        onClose={() => setDayDialogOpen(false)}
        title={selectedDay ? fmtDayLong(selectedDay) : ''}
        description={plural(visible.length, 'richiesta', 'richieste')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setDayDialogOpen(false)}>
              Chiudi
            </Button>
            {mayCreate && (
              <Button
                onClick={() => {
                  setDayDialogOpen(false)
                  openNew()
                }}
              >
                <Plus /> Nuova richiesta
              </Button>
            )}
          </>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nessuna richiesta in questa data"
            description={selectedDay ? `Non ci sono pulizie programmate per ${fmtDayLong(selectedDay)}.` : ''}
          />
        ) : (
          <div className="space-y-3">
            {visible.map((r) => (
              <RequestCard key={r.id} request={r} onClick={() => openDetailFromDay(r)} />
            ))}
          </div>
        )}
      </Dialog>

      <RequestDetail
        request={detail}
        open={detail !== null}
        onClose={() => setDetail(null)}
        onEdit={openEdit}
        onDelete={(r) => setPendingDelete(r)}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Elimina richiesta"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDeleteOne}>
              <Trash2 /> Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Stai per eliminare la richiesta di {pendingDelete ? labelOf(pendingDelete) : ''}.
          L’operazione non è reversibile.
        </p>
      </Dialog>

      <RequestForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditing(null)
        }}
        initial={editing}
        defaultDate={selectedDay ?? undefined}
      />

      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Elimina richieste"
        description={`Stai per eliminare ${plural(checked.length, 'richiesta', 'richieste')}. L'operazione non è reversibile.`}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annulla
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 /> Elimina
            </Button>
          </>
        }
      >
        <ul className="space-y-1.5 text-sm">
          {checked.map((r) => (
            <li key={r.id} className="flex items-center gap-2 border-b border-border/60 pb-1.5 last:border-0">
              <StatusDot status={r.status} className="size-2" />
              <span className="min-w-0 flex-1 truncate">{labelOf(r)}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtTime(r.checkOutAt)}</span>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}
