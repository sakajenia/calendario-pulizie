/*
 * Calendario controlli: le verifiche interne fatte sugli appartamenti dopo le
 * pulizie. Vive nella stessa voce di menu del calendario pulizie e ne riusa
 * struttura e gesti (mese/settimana, clic sul giorno, elenco a lato), ma i
 * pallini sono colorati per persona invece che per stato, e diventano un cuore
 * quando tutte le verifiche del controllo sono spuntate.
 *
 * E' riservato all'area manager: l'account pulizie non ci arriva nemmeno
 * scrivendo l'indirizzo a mano (vedi il wrapper in Calendario.tsx).
 */
import * as React from 'react'
import {
  addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek,
} from 'date-fns'
import { it } from 'date-fns/locale'
import {
  CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Heart, MapPin, Pencil,
  Plus, Search, SearchX, ShieldCheck, Trash2, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, Checkbox, Dialog, Dropdown, DropdownItem, EmptyState, Field,
  Input, Select, Tabs, Textarea,
} from '@/components/ui'
import {
  MonthPicker, WEEK, WEEKDAYS, dayKey, ms, type CalView,
} from '@/components/calendar/MonthPicker'
import { useIsDesktop } from '@/hooks/useMediaQuery'
import { scopeApartments, useCurrentUser, useStore } from '@/data/store'
import { useToast } from '@/components/feedback/Toast'
import { TODAY } from '@/data/seed'
import { fmtDayLong, fmtMonthYear, fmtTime, norm, plural } from '@/lib/format'
import {
  INSPECTION_STATUS_META, INSPECTORS, INSPECTOR_META, inspectionStatus,
  type Apartment, type Inspection, type InspectorId,
} from '@/types'
import { cn } from '@/lib/utils'

/** Un controllo chiuso si annuncia col cuore, uno aperto col pallino. */
function InspectionMark({ inspection, className }: { inspection: Inspection; className?: string }) {
  const meta = INSPECTOR_META[inspection.inspectorId]
  if (inspectionStatus(inspection) === 'completata') {
    return <Heart className={cn('size-2.5 shrink-0 fill-current', meta.text, className)} aria-hidden />
  }
  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', meta.dot, className)} />
}

function InspectorBadge({ id, className }: { id: InspectorId; className?: string }) {
  const meta = INSPECTOR_META[id]
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]', className)}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function InspectionStatusBadge({ inspection }: { inspection: Inspection }) {
  const status = inspectionStatus(inspection)
  const meta = INSPECTION_STATUS_META[status]
  const done = inspection.tasks.filter((t) => t.done).length
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>
      {meta.label}
      <span className="tabular-nums opacity-80">
        {done}/{inspection.tasks.length}
      </span>
    </Badge>
  )
}

/* ------------------------------------------------- scheda di un controllo */

/**
 * Un controllo del giorno: intestazione con casa, zona e persona, poi le
 * verifiche da spuntare. Le task si aggiungono qui, sul controllo del giorno,
 * non su un catalogo: ogni casa ha i suoi accertamenti in quella data.
 */
function InspectionCard({
  inspection, apartment, onEdit, onDelete,
}: {
  inspection: Inspection
  apartment: Apartment | undefined
  onEdit: (i: Inspection) => void
  onDelete: (i: Inspection) => void
}) {
  const setTaskDone = useStore((s) => s.setInspectionTaskDone)
  const addTask = useStore((s) => s.addInspectionTask)
  const removeTask = useStore((s) => s.removeInspectionTask)
  const meta = INSPECTOR_META[inspection.inspectorId]
  const completed = inspectionStatus(inspection) === 'completata'
  const [draft, setDraft] = React.useState('')
  const inputId = React.useId()

  const submitTask = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    addTask(inspection.id, draft)
    setDraft('')
  }

  /* Il nome e' commerciale ("Stazione Centrale Roma"): chi va sul posto cerca
     la via, quindi indirizzo e zona stanno sotto al nome. */
  const zone = [apartment?.address, apartment?.district, apartment?.city].filter(Boolean).join(' · ')

  return (
    <Card className={cn('overflow-hidden ring-1 ring-inset', meta.ring)}>
      <div className="flex flex-wrap items-start gap-3 border-b border-border p-4">
        <span
          className={cn(
            'grid size-9 shrink-0 place-items-center rounded-lg',
            completed ? 'bg-transparent' : 'bg-muted',
          )}
        >
          {completed
            ? <Heart className={cn('size-5 fill-current', meta.text)} aria-hidden />
            : <ShieldCheck className={cn('size-5', meta.text)} aria-hidden />}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-sm font-bold leading-snug">
            {apartment?.name ?? 'Appartamento non disponibile'}
          </h3>
          {zone && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="size-3.5 shrink-0" /> {zone}
            </p>
          )}
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <InspectorBadge id={inspection.inspectorId} />
            <InspectionStatusBadge inspection={inspection} />
            <span className="text-[11px] tabular-nums text-muted-foreground">{fmtTime(inspection.scheduledAt)}</span>
          </p>
        </div>

        <Dropdown
          align="end"
          className="w-[200px]"
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 shrink-0"
              aria-label={`Azioni sul controllo di ${apartment?.name ?? 'appartamento'}`}
            >
              <Pencil className="size-4" />
            </Button>
          }
        >
          <DropdownItem onClick={() => onEdit(inspection)}>
            <Pencil /> Modifica controllo
          </DropdownItem>
          <DropdownItem danger onClick={() => onDelete(inspection)}>
            <Trash2 /> Elimina controllo
          </DropdownItem>
        </Dropdown>
      </div>

      <div className="space-y-1 p-3">
        {inspection.tasks.length === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            Nessuna verifica inserita: aggiungi cosa va controllato in questa casa.
          </p>
        ) : (
          inspection.tasks.map((t) => (
            <div
              key={t.id}
              className="group flex items-start gap-2 rounded-md px-1 py-1.5 transition-colors hover:bg-muted/60"
            >
              <span className="grid size-6 shrink-0 place-items-center">
                <Checkbox
                  checked={t.done}
                  onChange={(v) => setTaskDone(inspection.id, t.id, v)}
                  label={`${t.name} — ${apartment?.name ?? ''}`}
                />
              </span>
              <span
                className={cn(
                  'min-w-0 flex-1 text-sm leading-snug',
                  t.done && 'text-muted-foreground line-through',
                )}
              >
                {t.name}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                aria-label={`Togli la verifica “${t.name}”`}
                onClick={() => removeTask(inspection.id, t.id)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))
        )}

        <form onSubmit={submitTask} className="flex items-center gap-2 pt-1.5">
          <Input
            id={inputId}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nuova verifica…"
            aria-label={`Aggiungi una verifica al controllo di ${apartment?.name ?? 'appartamento'}`}
            className="h-9 text-sm"
          />
          <Button type="submit" variant="outline" size="sm" className="shrink-0" disabled={!draft.trim()}>
            <Plus /> Aggiungi
          </Button>
        </form>
      </div>

      {inspection.notes && (
        <p className="border-t border-border bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          {inspection.notes}
        </p>
      )}
    </Card>
  )
}

/* ---------------------------------------------------- modulo del controllo */

const toLocalInput = (iso: string) => format(new Date(iso), "yyyy-MM-dd'T'HH:mm")

function InspectionForm({
  open, onClose, initial, apartments, defaultDate,
}: {
  open: boolean
  onClose: () => void
  initial: Inspection | null
  apartments: Apartment[]
  defaultDate?: Date
}) {
  const upsert = useStore((s) => s.upsertInspection)
  const toast = useToast()

  const blank = React.useCallback(() => {
    const at = defaultDate ? new Date(defaultDate) : new Date(TODAY)
    if (defaultDate) at.setHours(10, 0, 0, 0)
    return {
      apartmentId: apartments[0]?.id ?? '',
      inspectorId: 'manuel' as InspectorId,
      scheduledAt: format(at, "yyyy-MM-dd'T'HH:mm"),
      notes: '',
    }
  }, [apartments, defaultDate])

  const [draft, setDraft] = React.useState(blank)
  const [error, setError] = React.useState<string>()

  /* Il modulo si ricompone a ogni apertura: riaprirlo su un altro controllo
     non deve mostrare i valori del precedente. */
  React.useEffect(() => {
    if (!open) return
    setError(undefined)
    setDraft(
      initial
        ? {
            apartmentId: initial.apartmentId,
            inspectorId: initial.inspectorId,
            scheduledAt: toLocalInput(initial.scheduledAt),
            notes: initial.notes ?? '',
          }
        : blank(),
    )
  }, [open, initial, blank])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.apartmentId) return setError('Scegli l’appartamento da controllare')
    const at = new Date(draft.scheduledAt)
    if (Number.isNaN(at.getTime())) return setError('Inserisci una data valida')

    const now = new Date().toISOString()
    upsert({
      id: initial?.id ?? `insp-${Date.now()}`,
      apartmentId: draft.apartmentId,
      inspectorId: draft.inspectorId,
      scheduledAt: at.toISOString(),
      tasks: initial?.tasks ?? [],
      notes: draft.notes.trim() || undefined,
      createdAt: initial?.createdAt ?? now,
    })
    onClose()
    toast({
      title: initial ? 'Controllo aggiornato' : 'Controllo creato',
      description: initial ? undefined : 'Aggiungi le verifiche dalla scheda del controllo.',
    })
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica controllo' : 'Nuovo controllo'}
      description="Chi controlla quale casa, e in che giorno."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button form="form-controllo" type="submit">
            {initial ? 'Salva' : 'Crea controllo'}
          </Button>
        </>
      }
    >
      <form id="form-controllo" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Appartamento" htmlFor="controllo-appartamento">
          <Select
            id="controllo-appartamento"
            value={draft.apartmentId}
            onChange={(e) => setDraft((d) => ({ ...d, apartmentId: e.target.value }))}
            options={apartments.map((a) => ({
              value: a.id,
              label: [a.name, a.district].filter(Boolean).join(' · '),
            }))}
          />
        </Field>

        <Field label="Chi esegue il controllo" htmlFor="controllo-persona">
          <Select
            id="controllo-persona"
            value={draft.inspectorId}
            onChange={(e) => setDraft((d) => ({ ...d, inspectorId: e.target.value as InspectorId }))}
            options={INSPECTORS.map((i) => ({ value: i, label: INSPECTOR_META[i].label }))}
          />
        </Field>

        <Field label="Data e ora" htmlFor="controllo-data">
          <Input
            id="controllo-data"
            type="datetime-local"
            value={draft.scheduledAt}
            onChange={(e) => setDraft((d) => ({ ...d, scheduledAt: e.target.value }))}
          />
        </Field>

        <Field label="Note interne" htmlFor="controllo-note" hint="Facoltative: contesto per chi va sul posto.">
          <Textarea
            id="controllo-note"
            rows={3}
            value={draft.notes}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </Field>

        {error && (
          <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-status-cancelled">{error}</p>
        )}
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function CalendarioControlli({ modeSwitch }: { modeSwitch: React.ReactNode }) {
  const user = useCurrentUser()
  const allApartments = useStore((s) => s.apartments)
  const allInspections = useStore((s) => s.inspections)
  const deleteInspections = useStore((s) => s.deleteInspections)
  const upsertInspection = useStore((s) => s.upsertInspection)
  const toast = useToast()
  const isDesktop = useIsDesktop()

  const [view, setView] = React.useState<CalView>('mese')
  const [cursor, setCursor] = React.useState<Date>(TODAY)
  const [selectedDay, setSelectedDay] = React.useState<Date | null>(TODAY)
  const [text, setText] = React.useState('')
  const [people, setPeople] = React.useState<InspectorId[]>([])
  const [dayDialogOpen, setDayDialogOpen] = React.useState(false)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Inspection | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Inspection | null>(null)

  const apartments = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])
  const apartmentById = React.useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments])

  /* Il testo filtra sia l'elenco sia i segni sul calendario: la vista resta coerente. */
  const searched = React.useMemo(() => {
    const q = norm(text.trim())
    if (!q) return allInspections
    return allInspections.filter((i) => {
      const ap = apartmentById.get(i.apartmentId)
      const hay = norm(
        [
          ap?.name ?? '', ap?.address ?? '', ap?.district ?? '', ap?.city ?? '',
          INSPECTOR_META[i.inspectorId].label,
          i.tasks.map((t) => t.name).join(' '),
        ].join(' '),
      )
      return hay.includes(q)
    })
  }, [allInspections, text, apartmentById])

  const base = React.useMemo(
    () => (people.length ? searched.filter((i) => people.includes(i.inspectorId)) : searched),
    [searched, people],
  )

  const byDay = React.useMemo(() => {
    const m = new Map<string, Inspection[]>()
    for (const i of base) {
      const k = dayKey(i.scheduledAt)
      const list = m.get(k)
      if (list) list.push(i)
      else m.set(k, [i])
    }
    for (const list of m.values()) list.sort((a, b) => ms(a.scheduledAt) - ms(b.scheduledAt))
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
    (i: Inspection) => {
      const t = ms(i.scheduledAt)
      return t >= periodStart.getTime() && t <= periodEnd.getTime()
    },
    [periodStart, periodEnd],
  )

  const periodSearched = React.useMemo(() => searched.filter(inPeriod), [searched, inPeriod])
  const periodInspections = React.useMemo(() => base.filter(inPeriod), [base, inPeriod])

  const countByPerson = React.useMemo(() => {
    /* Le chiavi si costruiscono dall'elenco: fissarle a mano lasciava a
       undefined chi veniva aggiunto dopo, e il contatore diventava NaN. */
    const acc = Object.fromEntries(INSPECTORS.map((p) => [p, 0])) as Record<InspectorId, number>
    for (const i of periodSearched) acc[i.inspectorId] += 1
    return acc
  }, [periodSearched])

  const visible = React.useMemo(() => {
    const list = selectedDay ? (byDay.get(dayKey(selectedDay)) ?? []) : periodInspections
    return list.slice().sort((a, b) => ms(a.scheduledAt) - ms(b.scheduledAt))
  }, [selectedDay, byDay, periodInspections])

  const doneCount = visible.filter((i) => inspectionStatus(i) === 'completata').length
  const todayCount = byDay.get(dayKey(TODAY))?.length ?? 0
  const filtersOn = text.trim().length > 0 || people.length > 0

  /* ---- azioni ---- */

  const move = (dir: -1 | 1) => {
    setCursor((c) => (view === 'mese' ? addMonths(c, dir) : addWeeks(c, dir)))
    setSelectedDay(null)
  }

  const goToday = () => {
    setCursor(TODAY)
    setSelectedDay(TODAY)
  }

  const changeView = (v: CalView) => {
    setView(v)
    if (selectedDay) setCursor(selectedDay)
  }

  /* Come nel calendario pulizie: sotto lg il giorno apre una finestra, perche'
     l'elenco sta fuori schermo; da lg in su e' gia' nella colonna a lato. */
  const pickDay = (d: Date) => {
    if (!isSameMonth(d, cursor)) setCursor(d)
    if (view === 'mese' && !isDesktop) {
      setSelectedDay(d)
      setDayDialogOpen(true)
      return
    }
    setSelectedDay((cur) => (cur && isSameDay(cur, d) ? null : d))
  }

  const togglePerson = (p: InspectorId) =>
    setPeople((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  const closeForm = React.useCallback(() => { setFormOpen(false); setEditing(null) }, [])
  const closeDayDialog = React.useCallback(() => setDayDialogOpen(false), [])
  const closePendingDelete = React.useCallback(() => setPendingDelete(null), [])

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = React.useCallback((i: Inspection) => {
    setDayDialogOpen(false)
    setEditing(i)
    setFormOpen(true)
  }, [])

  const confirmDelete = () => {
    const removed = pendingDelete
    if (!removed) return
    deleteInspections([removed.id])
    setPendingDelete(null)
    toast({
      title: 'Controllo eliminato',
      description: 'Puoi rimetterlo come era finché questa notifica resta a schermo.',
      action: { label: 'Annulla', onClick: () => upsertInspection(removed) },
    })
  }

  const periodTitle =
    view === 'mese'
      ? `Tutti i controlli di ${fmtMonthYear(cursor)}`
      : `Settimana ${format(periodStart, 'd MMM', { locale: it })} – ${format(periodEnd, 'd MMM yyyy', { locale: it })}`

  const cards = (list: Inspection[]) =>
    list.map((i) => (
      <InspectionCard
        key={i.id}
        inspection={i}
        apartment={apartmentById.get(i.apartmentId)}
        onEdit={openEdit}
        onDelete={setPendingDelete}
      />
    ))

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="Calendario Controlli"
        subtitle={
          <span>
            <span className="capitalize">{fmtMonthYear(cursor)}</span> ·{' '}
            {plural(periodInspections.length, 'controllo', 'controlli')} nel periodo · {todayCount} in data odierna
          </span>
        }
        aside={modeSwitch}
        actions={
          <div className="hidden items-center gap-2 lg:flex">
            <Button onClick={openNew}>
              <Plus /> Nuovo controllo
            </Button>
          </div>
        }
      />

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
                aria-label="Vista del calendario"
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
                  const closed = list.filter((i) => inspectionStatus(i) === 'completata').length
                  return (
                    <button
                      key={d.toISOString()}
                      type="button"
                      onClick={() => pickDay(d)}
                      aria-pressed={isSelected}
                      aria-haspopup={isDesktop ? undefined : 'dialog'}
                      aria-label={`${fmtDayLong(d)} · ${plural(list.length, 'controllo', 'controlli')}${
                        closed ? `, ${closed} completati` : ''
                      }`}
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
                          {list.slice(0, 4).map((i) => (
                            <InspectionMark key={i.id} inspection={i} />
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
                        {list.map((i) => {
                          const ap = apartmentById.get(i.apartmentId)
                          const done = i.tasks.filter((t) => t.done).length
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => openEdit(i)}
                              title={`${ap?.name ?? ''} · ${INSPECTOR_META[i.inspectorId].label}`}
                              aria-label={`${ap?.name ?? 'Appartamento'} · ${fmtTime(i.scheduledAt)} · ${INSPECTOR_META[i.inspectorId].label} · ${done} di ${i.tasks.length} verifiche`}
                              className="flex w-full min-w-0 flex-col gap-0.5 overflow-hidden rounded-md border border-border bg-card p-2 text-left shadow-card transition-shadow hover:shadow-raised focus-ring"
                            >
                              <span className="flex w-full min-w-0 items-center gap-1.5">
                                <InspectionMark inspection={i} />
                                <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tabular-nums">
                                  {fmtTime(i.scheduledAt)}
                                </span>
                              </span>
                              <span className="block w-full min-w-0 truncate text-xs font-medium">
                                {ap?.name ?? 'Appartamento non disponibile'}
                              </span>
                              <span className="block w-full min-w-0 truncate text-[11px] text-muted-foreground">
                                {INSPECTOR_META[i.inspectorId].label} · {done}/{i.tasks.length} verifiche
                              </span>
                            </button>
                          )
                        })}
                        {list.length === 0 && (
                          <p className="py-6 text-center text-[11px] text-muted-foreground">Nessun controllo</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* legenda-filtro per persona, coi conteggi del periodo */}
          <div className="no-scrollbar flex items-center gap-1 overflow-x-auto border-t border-border px-2.5 py-2">
            <button
              type="button"
              onClick={() => setPeople([])}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-ring',
                people.length === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              Tutti
              <span className="tabular-nums">{periodSearched.length}</span>
            </button>
            {INSPECTORS.map((p) => {
              const on = people.includes(p)
              const n = countByPerson[p]
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => togglePerson(p)}
                  aria-pressed={on}
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-medium transition-colors focus-ring',
                    on ? 'bg-muted text-foreground ring-1 ring-inset ring-border' : 'text-muted-foreground hover:bg-muted',
                    !on && n === 0 && 'opacity-45',
                  )}
                >
                  <span className={cn('inline-block size-2 rounded-full', INSPECTOR_META[p].dot)} />
                  {INSPECTOR_META[p].label}
                  <span className="tabular-nums">{n}</span>
                </button>
              )
            })}
            <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2 text-[11px] text-muted-foreground">
              <Heart className="size-3 fill-current" aria-hidden /> controllo completato
            </span>
          </div>
        </Card>

        {/* --------------------------------------------------------- elenco */}
        <div className="flex min-h-0 flex-col gap-3">
          <Card className="shrink-0 space-y-3 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Filtra per casa, persona o verifica"
                className="pl-9 pr-9"
                aria-label="Filtra per casa, persona o verifica"
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
                    {plural(visible.length, 'controllo', 'controlli')}
                  </span>
                </h2>
                <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Heart className="size-3.5" /> {doneCount} completati
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="size-3.5" /> {visible.length - doneCount} ancora in corso
                  </span>
                </p>
              </div>

              {selectedDay && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => setSelectedDay(null)}>
                  <X /> Tutti i controlli
                </Button>
              )}
            </div>

            {filtersOn && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setText('')
                  setPeople([])
                }}
              >
                Cancella filtri
              </Button>
            )}
          </Card>

          <div className="stagger space-y-3 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pb-4 lg:pr-1">
            {visible.length === 0 ? (
              <Card>
                {filtersOn ? (
                  <EmptyState
                    icon={SearchX}
                    title="Nessun controllo trovato"
                    description="Nessun risultato per i filtri attivi. Prova a cambiare la ricerca o la persona selezionata."
                    action={
                      <Button
                        variant="outline"
                        onClick={() => {
                          setText('')
                          setPeople([])
                        }}
                      >
                        Cancella filtri
                      </Button>
                    }
                  />
                ) : (
                  <EmptyState
                    icon={CalendarDays}
                    title={selectedDay ? 'Nessun controllo in questa data' : 'Nessun controllo nel periodo'}
                    description={
                      selectedDay
                        ? `Non ci sono controlli programmati per ${fmtDayLong(selectedDay)}.`
                        : 'Naviga fra i periodi oppure programma un nuovo controllo.'
                    }
                    action={
                      <Button onClick={openNew}>
                        <Plus /> Nuovo controllo
                      </Button>
                    }
                  />
                )}
              </Card>
            ) : (
              cards(visible)
            )}
          </div>
        </div>
      </div>

      {/* ----------------------------------------------- FAB, solo sotto lg */}
      <div className="fixed bottom-6 right-6 z-30 flex flex-col items-end gap-3 lg:hidden">
        <Button
          size="icon"
          onClick={openNew}
          title="Nuovo controllo"
          aria-label="Nuovo controllo"
          className="h-14 w-14 rounded-full"
        >
          <Plus className="size-5" />
        </Button>
      </div>

      <Dialog
        open={dayDialogOpen && selectedDay !== null && !isDesktop}
        onClose={closeDayDialog}
        title={selectedDay ? fmtDayLong(selectedDay) : ''}
        description={plural(visible.length, 'controllo', 'controlli')}
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={closeDayDialog}>Chiudi</Button>
            <Button
              onClick={() => {
                setDayDialogOpen(false)
                openNew()
              }}
            >
              <Plus /> Nuovo controllo
            </Button>
          </>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="Nessun controllo in questa data"
            description={selectedDay ? `Non ci sono controlli programmati per ${fmtDayLong(selectedDay)}.` : ''}
          />
        ) : (
          <div className="space-y-3">{cards(visible)}</div>
        )}
      </Dialog>

      <InspectionForm
        open={formOpen}
        onClose={closeForm}
        initial={editing}
        apartments={apartments}
        defaultDate={selectedDay ?? undefined}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={closePendingDelete}
        title="Elimina controllo"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={closePendingDelete}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}>
              <Trash2 /> Elimina
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Stai per eliminare il controllo di{' '}
          {pendingDelete ? (apartmentById.get(pendingDelete.apartmentId)?.name ?? 'questo appartamento') : ''}
          {pendingDelete ? ` del ${fmtDayLong(pendingDelete.scheduledAt)}` : ''}.
          Potrai annullare dalla notifica per qualche secondo.
        </p>
      </Dialog>
    </div>
  )
}
