import * as React from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, ClipboardList, Clock, Copy, Download, ListChecks,
  MoreVertical, Pencil, Plus, Search, ShieldAlert, Trash2, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { HelpTip } from '@/components/HelpTip'
import {
  Badge, Button, Dialog, Dropdown,
  DropdownItem, DropdownSeparator, EmptyState, Field, Input, Select, Textarea,
} from '@/components/ui'
import { scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { asDate, downloadFile, fmtDate, fmtNum, norm, plural, toCsv } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TaskCatalogItem, WorkSheet } from '@/types'

const PAGE_SUBTITLE = 'Crea modelli di fogli di lavoro predefiniti da assegnare agli interventi'

type SortKey = 'name' | 'tasks' | 'duration' | 'usage'
type UsageFilter = 'all' | 'used' | 'unused'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nome',
  tasks: 'Numero di task',
  duration: 'Durata stimata',
  usage: 'Utilizzo nelle richieste',
}

/** 105 -> "1h 45m", 45 -> "45m", 120 -> "2h". */
function fmtDuration(minutes: number): string {
  if (minutes <= 0) return '0m'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

const uid = () => `ws-${Math.random().toString(36).slice(2, 10)}`

/** Foglio + i dati derivati che servono a card, filtri, ordinamento ed export. */
interface Row {
  sheet: WorkSheet
  tasks: TaskCatalogItem[]
  /** Task referenziati dal foglio ma non piu' presenti in catalogo. */
  missing: number
  minutes: number
  usage: number
  lastUsedAt: string | null
}

/* -------------------------------------------------------------------- form */

interface Draft {
  name: string
  description: string
  taskIds: string[]
}

const emptyDraft: Draft = { name: '', description: '', taskIds: [] }

function WorkSheetForm({
  open, onClose, initial, catalog, sheets,
}: {
  open: boolean
  onClose: () => void
  initial: WorkSheet | null
  catalog: TaskCatalogItem[]
  sheets: WorkSheet[]
}) {
  const upsertWorkSheet = useStore((s) => s.upsertWorkSheet)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [errors, setErrors] = React.useState<{ name?: string; tasks?: string }>({})
  const [search, setSearch] = React.useState('')

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setSearch('')
    setDraft(
      initial
        ? {
            name: initial.name,
            description: initial.description ?? '',
            // Un task rimosso dal catalogo non deve rientrare nel foglio salvandolo.
            taskIds: initial.taskIds.filter((id) => catalog.some((t) => t.id === id)),
          }
        : emptyDraft,
    )
  }, [open, initial, catalog])

  const byId = React.useMemo(() => new Map(catalog.map((t) => [t.id, t])), [catalog])

  const selected = React.useMemo(
    () => draft.taskIds.map((id) => byId.get(id)).filter((t): t is TaskCatalogItem => t !== undefined),
    [draft.taskIds, byId],
  )

  const available = React.useMemo(
    () => catalog.filter((t) => !draft.taskIds.includes(t.id)),
    [catalog, draft.taskIds],
  )

  const availableFiltered = React.useMemo(() => {
    const q = norm(search.trim())
    if (!q) return available
    return available.filter((t) => norm(`${t.name} ${t.description ?? ''}`).includes(q))
  }, [available, search])

  const totalMinutes = selected.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0)

  const addTask = (id: string) => {
    setErrors((e) => ({ ...e, tasks: undefined }))
    setDraft((d) => (d.taskIds.includes(id) ? d : { ...d, taskIds: [...d.taskIds, id] }))
  }

  const removeTask = (id: string) =>
    setDraft((d) => ({ ...d, taskIds: d.taskIds.filter((x) => x !== id) }))

  const move = (index: number, dir: -1 | 1) =>
    setDraft((d) => {
      const target = index + dir
      if (target < 0 || target >= d.taskIds.length) return d
      const next = d.taskIds.slice()
      const tmp = next[index]
      next[index] = next[target]
      next[target] = tmp
      return { ...d, taskIds: next }
    })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    const next: { name?: string; tasks?: string } = {}

    if (!name) next.name = 'Inserisci un nome'
    else if (sheets.some((w) => w.id !== initial?.id && norm(w.name) === norm(name))) {
      next.name = 'Esiste già un foglio con questo nome'
    }
    if (draft.taskIds.length === 0) next.tasks = 'Aggiungi almeno un task al foglio'

    setErrors(next)
    if (next.name || next.tasks) return

    upsertWorkSheet({
      id: initial?.id ?? uid(),
      name,
      description: draft.description.trim() || undefined,
      taskIds: draft.taskIds,
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Modifica foglio di lavoro' : 'Nuovo foglio di lavoro'}
      description={
        initial
          ? 'Le modifiche valgono per le richieste a cui assegnerai il foglio da adesso in poi.'
          : PAGE_SUBTITLE
      }
      footer={
        <>
          <span className="mr-auto text-xs tabular-nums text-muted-foreground">
            {plural(draft.taskIds.length, 'task incluso', 'task inclusi')} · durata stimata{' '}
            {fmtDuration(totalMinutes)}
          </span>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="worksheet-form">
            {initial ? 'Salva modifiche' : 'Crea foglio'}
          </Button>
        </>
      }
    >
      <form id="worksheet-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome foglio (es. Pulizia Standard)" error={errors.name}>
          <Input
            value={draft.name}
            placeholder="Pulizia Standard"
            onChange={(e) => {
              const name = e.target.value
              setDraft((d) => ({ ...d, name }))
              setErrors((x) => ({ ...x, name: undefined }))
            }}
          />
        </Field>

        <Field label="Descrizione" hint="Spiega quando va usato questo foglio: la vede chi assegna la richiesta.">
          <Textarea
            value={draft.description}
            rows={2}
            placeholder="Turnover ordinario fra due soggiorni."
            onChange={(e) => {
              const description = e.target.value
              setDraft((d) => ({ ...d, description }))
            }}
          />
        </Field>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Task inclusi</h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fmtNum(selected.length)} · {fmtDuration(totalMinutes)}
              </span>
            </div>

            {selected.length === 0 ? (
              <div
                className={cn(
                  'grid min-h-[9rem] place-items-center rounded-lg border border-dashed px-4 py-6 text-center text-xs',
                  errors.tasks ? 'border-destructive/60 text-destructive' : 'border-border text-muted-foreground',
                )}
              >
                Nessun task nel foglio: aggiungili dal catalogo qui a fianco.
              </div>
            ) : (
              <ol className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {selected.map((task, i) => (
                  <li
                    key={task.id}
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-2.5 py-2"
                  >
                    <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary/10 text-[11px] font-semibold tabular-nums text-brand">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{task.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {task.estimateMin ? fmtDuration(task.estimateMin) : 'Durata non stimata'}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={i === 0}
                        aria-label={`Sposta ${task.name} su`}
                        onClick={() => move(i, -1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={i === selected.length - 1}
                        aria-label={`Sposta ${task.name} giù`}
                        onClick={() => move(i, 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7 text-destructive hover:bg-destructive/10"
                        aria-label={`Rimuovi ${task.name}`}
                        onClick={() => removeTask(task.id)}
                      >
                        <X />
                      </Button>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {errors.tasks && <p className="text-xs text-destructive">{errors.tasks}</p>}
          </section>

          <section className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Aggiungi Task dal catalogo</h3>
              <span className="text-xs tabular-nums text-muted-foreground">
                {fmtNum(available.length)} disponibili
              </span>
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cerca un task"
                aria-label="Cerca un task nel catalogo"
                className="h-9 pl-9"
                disabled={available.length === 0}
              />
            </div>

            {catalog.length === 0 ? (
              <div className="grid min-h-[9rem] place-items-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Il catalogo task è vuoto: creane almeno uno per poter comporre un foglio.
              </div>
            ) : available.length === 0 ? (
              <div className="grid min-h-[9rem] place-items-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Tutti i task disponibili sono già presenti
              </div>
            ) : availableFiltered.length === 0 ? (
              <div className="grid min-h-[9rem] place-items-center rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
                Nessun task del catalogo corrisponde a “{search.trim()}”.
              </div>
            ) : (
              <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {availableFiltered.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => addTask(task.id)}
                      className="flex w-full items-center gap-2 rounded-lg border border-border px-2.5 py-2 text-left transition-colors focus-ring hover:border-primary/40 hover:bg-muted"
                    >
                      <Plus className="size-4 shrink-0 text-brand" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{task.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {task.description ?? 'Nessuna descrizione'}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {task.estimateMin ? fmtDuration(task.estimateMin) : '—'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </form>
    </Dialog>
  )
}

/* -------------------------------------------------------------------- card */

function SheetCard({
  row, onEdit, onDuplicate, onDelete,
}: {
  row: Row
  onEdit: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  const preview = row.tasks.slice(0, 5)
  const rest = row.tasks.length - preview.length

  return (
    <article className="group grid gap-4 px-5 py-5 transition-colors duration-200 ease-out-expo hover:bg-muted/40 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-8">
      <div className="flex items-start justify-between gap-3 lg:hidden">
        <div className="min-w-0 space-y-1">
          <h3 className="font-display text-base font-bold tracking-tight">{row.sheet.name}</h3>
          <p className="text-sm text-muted-foreground">
            {row.sheet.description ?? 'Nessuna descrizione'}
          </p>
        </div>
        <Dropdown
          trigger={
            <Button variant="ghost" size="icon" aria-label={`Azioni per ${row.sheet.name}`}>
              <MoreVertical />
            </Button>
          }
        >
          <DropdownItem onClick={onEdit}><Pencil /> Modifica</DropdownItem>
          <DropdownItem onClick={onDuplicate}><Copy /> Duplica</DropdownItem>
          <DropdownSeparator />
          <DropdownItem danger onClick={onDelete}><Trash2 /> Elimina</DropdownItem>
        </Dropdown>
      </div>

      <div className="min-w-0 space-y-3">
        <div className="hidden min-w-0 space-y-1 lg:block">
          <h3 className="font-display text-base font-bold tracking-tight">{row.sheet.name}</h3>
          <p className="max-w-[65ch] text-sm text-muted-foreground">
            {row.sheet.description ?? 'Nessuna descrizione'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge className="bg-muted text-muted-foreground">
            <ListChecks className="size-3.5" />
            {plural(row.tasks.length, 'task', 'task')}
          </Badge>
          <Badge className="bg-primary/10 text-brand">
            <Clock className="size-3.5" />
            {fmtDuration(row.minutes)}
          </Badge>
          {row.missing > 0 && (
            <Badge className="bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/25">
              <AlertTriangle className="size-3.5" />
              {plural(row.missing, 'task rimosso dal catalogo', 'task rimossi dal catalogo')}
            </Badge>
          )}
        </div>

        {preview.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Nessun task valido in questo foglio: modificalo per ricomporlo.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {preview.map((task, i) => (
              <li
                key={task.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
              >
                <span className="font-semibold tabular-nums text-foreground/70">{i + 1}</span>
                <span className="truncate">{task.name}</span>
              </li>
            ))}
            {rest > 0 && (
              <li className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                +{fmtNum(rest)}
              </li>
            )}
          </ul>
        )}
      </div>

      <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-end lg:justify-start lg:gap-1.5 lg:text-right">
        <div className="hidden lg:block">
          <Dropdown
            trigger={
              <Button variant="ghost" size="icon" aria-label={`Azioni per ${row.sheet.name}`}>
                <MoreVertical />
              </Button>
            }
          >
            <DropdownItem onClick={onEdit}><Pencil /> Modifica</DropdownItem>
            <DropdownItem onClick={onDuplicate}><Copy /> Duplica</DropdownItem>
            <DropdownSeparator />
            <DropdownItem danger onClick={onDelete}><Trash2 /> Elimina</DropdownItem>
          </Dropdown>
        </div>
        <span className="text-xs text-muted-foreground">
          {row.usage === 0 ? (
            'Nessuna richiesta usa questo foglio'
          ) : (
            <>
              Usata da{' '}
              <span className="font-medium text-foreground">
                {plural(row.usage, 'richiesta', 'richieste')}
              </span>
            </>
          )}
        </span>
        {row.lastUsedAt && (
          <span className="text-xs tabular-nums text-muted-foreground">
            ultima il {fmtDate(row.lastUsedAt)}
          </span>
        )}
      </div>
    </article>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function FogliDiLavoro() {
  const currentUser = useCurrentUser()
  const workSheets = useStore((s) => s.workSheets)
  const taskCatalog = useStore((s) => s.taskCatalog)
  const requests = useStore((s) => s.requests)
  const upsertWorkSheet = useStore((s) => s.upsertWorkSheet)
  const deleteWorkSheet = useStore((s) => s.deleteWorkSheet)
  const upsertRequest = useStore((s) => s.upsertRequest)

  const [text, setText] = React.useState('')
  const [taskFilter, setTaskFilter] = React.useState<string>('all')
  const [usageFilter, setUsageFilter] = React.useState<UsageFilter>('all')
  const [sortKey, setSortKey] = React.useState<SortKey>('name')

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  const rows = React.useMemo<Row[]>(() => {
    const byId = new Map(taskCatalog.map((t) => [t.id, t]))
    const usage = new Map<string, { count: number; last: string | null }>()

    for (const r of scopeRequests(requests, currentUser)) {
      if (!r.workSheetId) continue
      const cur = usage.get(r.workSheetId) ?? { count: 0, last: null }
      cur.count += 1
      if (!cur.last || asDate(r.createdAt).getTime() > asDate(cur.last).getTime()) cur.last = r.createdAt
      usage.set(r.workSheetId, cur)
    }

    return workSheets.map((sheet) => {
      const tasks = sheet.taskIds
        .map((id) => byId.get(id))
        .filter((t): t is TaskCatalogItem => t !== undefined)
      const u = usage.get(sheet.id)
      return {
        sheet,
        tasks,
        missing: sheet.taskIds.length - tasks.length,
        minutes: tasks.reduce((sum, t) => sum + (t.estimateMin ?? 0), 0),
        usage: u?.count ?? 0,
        lastUsedAt: u?.last ?? null,
      }
    })
  }, [workSheets, taskCatalog, requests, currentUser])

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    const list = rows.filter((row) => {
      if (taskFilter !== 'all' && !row.sheet.taskIds.includes(taskFilter)) return false
      if (usageFilter === 'used' && row.usage === 0) return false
      if (usageFilter === 'unused' && row.usage > 0) return false
      if (q) {
        const haystack = `${row.sheet.name} ${row.sheet.description ?? ''} ${row.tasks.map((t) => t.name).join(' ')}`
        if (!norm(haystack).includes(q)) return false
      }
      return true
    })

    return list.sort((a, b) => {
      switch (sortKey) {
        case 'tasks': return b.tasks.length - a.tasks.length || a.sheet.name.localeCompare(b.sheet.name, 'it')
        case 'duration': return b.minutes - a.minutes || a.sheet.name.localeCompare(b.sheet.name, 'it')
        case 'usage': return b.usage - a.usage || a.sheet.name.localeCompare(b.sheet.name, 'it')
        default: return a.sheet.name.localeCompare(b.sheet.name, 'it')
      }
    })
  }, [rows, text, taskFilter, usageFilter, sortKey])

  const hasFilters = text.trim() !== '' || taskFilter !== 'all' || usageFilter !== 'all'
  const linkedTotal = rows.reduce((sum, r) => sum + r.usage, 0)
  const editing = editingId ? workSheets.find((w) => w.id === editingId) ?? null : null
  const pendingDelete = pendingDeleteId ? rows.find((r) => r.sheet.id === pendingDeleteId) ?? null : null

  const clearFilters = () => {
    setText('')
    setTaskFilter('all')
    setUsageFilter('all')
  }

  const openNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (sheet: WorkSheet) => {
    setEditingId(sheet.id)
    setFormOpen(true)
  }

  const duplicate = (sheet: WorkSheet) => {
    const base = `${sheet.name} (copia)`
    let name = base
    let i = 2
    while (workSheets.some((w) => norm(w.name) === norm(name))) {
      name = `${base} ${i}`
      i += 1
    }
    upsertWorkSheet({ id: uid(), name, description: sheet.description, taskIds: [...sheet.taskIds] })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const id = pendingDelete.sheet.id
    // Le richieste non devono restare con il riferimento a un foglio inesistente.
    for (const r of requests) {
      if (r.workSheetId === id) upsertRequest({ ...r, workSheetId: undefined })
    }
    deleteWorkSheet(id)
    setPendingDeleteId(null)
  }

  const exportCsv = () => {
    const data = filtered.map((row) => ({
      Nome: row.sheet.name,
      Descrizione: row.sheet.description ?? '',
      'Numero task': row.tasks.length,
      Task: row.tasks.map((t) => t.name).join(' | '),
      'Durata stimata': fmtDuration(row.minutes),
      'Minuti stimati': row.minutes,
      'Richieste collegate': row.usage,
      'Ultimo utilizzo': row.lastUsedAt ? fmtDate(row.lastUsedAt) : '',
    }))
    downloadFile(`fogli-di-lavoro-${fmtDate(new Date())}.csv`, toCsv(data))
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Fogli di Lavoro" />
        <EmptyState
          icon={ShieldAlert}
          title="Area riservata agli amministratori"
          description="I modelli di foglio di lavoro sono gestiti solo dagli account con ruolo Amministratore."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">Fogli di Lavoro<HelpTip term="foglio di lavoro" /></span>}
        subtitle={
          <span className="block space-y-0.5">
            <span className="block">{PAGE_SUBTITLE}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span>{plural(workSheets.length, 'foglio', 'fogli')}</span>
              <span aria-hidden className="text-border">|</span>
              <span>{plural(taskCatalog.length, 'task in catalogo', 'task in catalogo')}</span>
              <span aria-hidden className="text-border">|</span>
              <span>{plural(linkedTotal, 'richiesta collegata', 'richieste collegate')}</span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download />
              <span className="hidden sm:inline">Esporta CSV</span>
            </Button>
            <Button onClick={openNew}>
              <Plus />
              Nuovo <span className="hidden sm:inline">foglio di lavoro</span>
            </Button>
          </>
        }
      />

      {workSheets.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtra per nome, descrizione o task"
              aria-label="Filtra per nome, descrizione o task"
              className="h-9 pl-9"
            />
          </div>

          <div className="w-full sm:w-60">
            <Select
              value={taskFilter}
              onChange={(e) => setTaskFilter(e.target.value)}
              aria-label="Filtra per task incluso"
              className="h-9"
              options={[
                { value: 'all', label: 'Tutti i task' },
                ...taskCatalog.map((t) => ({ value: t.id, label: `Contiene: ${t.name}` })),
              ]}
            />
          </div>

          <div className="w-full sm:w-44">
            <Select
              value={usageFilter}
              onChange={(e) => setUsageFilter(e.target.value as UsageFilter)}
              aria-label="Filtra per utilizzo"
              className="h-9"
              options={[
                { value: 'all', label: 'Tutti gli utilizzi' },
                { value: 'used', label: 'In uso' },
                { value: 'unused', label: 'Mai utilizzati' },
              ]}
            />
          </div>

          <div className="w-full sm:w-52">
            <Select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              aria-label="Ordina i fogli"
              className="h-9"
              options={(Object.keys(SORT_LABEL) as SortKey[]).map((k) => ({
                value: k,
                label: `Ordina per ${SORT_LABEL[k].toLowerCase()}`,
              }))}
            />
          </div>

          {hasFilters && (
            <Button variant="link" size="sm" className="ml-auto" onClick={clearFilters}>
              Cancella filtri
            </Button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-5">
        {workSheets.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="Nessun foglio di lavoro"
            description="Crea modelli di fogli di lavoro predefiniti: un elenco ordinato di task da assegnare agli interventi in un clic."
            action={
              <Button onClick={openNew}>
                <Plus />
                Nuovo foglio di lavoro
              </Button>
            }
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nessun foglio corrisponde ai filtri"
            description="Cambia il testo di ricerca, il task richiesto o il filtro di utilizzo per vedere altri modelli."
            action={<Button variant="outline" onClick={clearFilters}>Cancella filtri</Button>}
          />
        ) : (
          <div className="stagger divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {filtered.map((row) => (
              <SheetCard
                key={row.sheet.id}
                row={row}
                onEdit={() => openEdit(row.sheet)}
                onDuplicate={() => duplicate(row.sheet)}
                onDelete={() => setPendingDeleteId(row.sheet.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">
          Ordinati per <span className="font-medium text-foreground">{SORT_LABEL[sortKey].toLowerCase()}</span>
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          (Fogli totali: {fmtNum(workSheets.length)} | Visualizzati: {fmtNum(filtered.length)} | Task in catalogo:{' '}
          {fmtNum(taskCatalog.length)})
        </span>
      </div>

      <WorkSheetForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        catalog={taskCatalog}
        sheets={workSheets}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDeleteId(null)}
        title="Elimina foglio di lavoro"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
          </>
        }
      >
        {pendingDelete && (
          <div className="space-y-3 text-sm">
            <p>
              Stai per eliminare <span className="font-medium">{pendingDelete.sheet.name}</span> con i suoi{' '}
              {plural(pendingDelete.tasks.length, 'task', 'task')} ({fmtDuration(pendingDelete.minutes)}).
              L'operazione non è reversibile.
            </p>
            {pendingDelete.usage > 0 && (
              <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                {plural(pendingDelete.usage, 'richiesta collegata resterà', 'richieste collegate resteranno')} senza
                foglio di lavoro: i task già svolti non vengono modificati, ma dovrai riassegnare un modello.
              </p>
            )}
          </div>
        )}
      </Dialog>
    </div>
  )
}
