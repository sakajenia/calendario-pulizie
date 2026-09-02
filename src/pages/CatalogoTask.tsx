import * as React from 'react'
import {
  AlertTriangle, ChevronDown, ChevronUp, ChevronsUpDown, ClipboardList, Copy, ListChecks,
  MoreVertical, Pencil, Plus, Search, ShieldAlert, Timer, Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { HelpTip } from '@/components/HelpTip'
import {
  Badge, Button, Checkbox, Dialog, Dropdown, DropdownItem, DropdownSeparator, EmptyState,
  Field, Input, MobileRecord, Select, Table, TableScroller, Td, Textarea, Th,
} from '@/components/ui'
import { useToast } from '@/components/feedback/Toast'
import { useIsAdmin, useStore } from '@/data/store'
import { fmtNum, norm, plural } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { TaskCatalogItem, WorkSheet } from '@/types'

type SortKey = 'name' | 'estimate' | 'usage'
type SortDir = 'asc' | 'desc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nome',
  estimate: 'Stima',
  usage: 'Fogli di lavoro',
}

/** Task del catalogo + i fogli di lavoro che lo includono. */
interface Row {
  task: TaskCatalogItem
  sheets: WorkSheet[]
}

const uid = () => `tk-${Math.random().toString(36).slice(2, 10)}`

/** Le stime del catalogo sono sempre in minuti: "25 min". */
const fmtMin = (n: number) => `${fmtNum(n)} min`

/** Per i totali i soli minuti diventano illeggibili: "2 h 45 min". */
function fmtDuration(total: number): string {
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return fmtMin(m)
  return m === 0 ? `${fmtNum(h)} h` : `${fmtNum(h)} h ${m} min`
}

/** Il nome è la chiave logica del task: la copia deve nascere già univoca. */
function duplicateName(base: string, tasks: TaskCatalogItem[]): string {
  const taken = new Set(tasks.map((t) => norm(t.name)))
  let candidate = `${base} (copia)`
  for (let i = 2; taken.has(norm(candidate)); i += 1) candidate = `${base} (copia ${i})`
  return candidate
}

/* ------------------------------------------------------------------- pezzi */

function SortHeader({
  label, sortKey, current, dir, onSort, className,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = current === sortKey
  return (
    <Th className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordina per ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded uppercase tracking-wide transition-colors focus-ring hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
          : <ChevronsUpDown className="size-3.5 opacity-40" />}
      </button>
    </Th>
  )
}

function SummaryTile({
  icon: Icon, label, value, hint, tone = 'brand',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: React.ReactNode
  tone?: 'brand' | 'warn'
}) {
  /* Stessa banda di metriche di Magazzini: etichetta, cifra, nota. Niente
     icona in un quadratino colorato (DESIGN.md, sezione 4). */
  return (
    <div className="min-w-0 bg-card px-5 py-3.5">
      <p className="eyebrow flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', tone === 'warn' ? 'text-status-pending' : 'text-brand')} />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 font-display text-xl font-bold leading-none tabular-nums">{value}</p>
      {hint && <div className="mt-1.5 text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

/** Le stesse tre azioni della riga, sia in tabella sia nella scheda su telefono. */
function RowMenu({
  name, onEdit, onDuplicate, onDelete,
}: { name: string; onEdit: () => void; onDuplicate: () => void; onDelete: () => void }) {
  return (
    <Dropdown
      align="end"
      className="w-[200px]"
      trigger={
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Azioni ${name}`}>
          <MoreVertical />
        </Button>
      }
    >
      <DropdownItem onClick={onEdit}><Pencil /> Modifica</DropdownItem>
      <DropdownItem onClick={onDuplicate}><Copy /> Duplica</DropdownItem>
      <DropdownSeparator />
      <DropdownItem danger onClick={onDelete}><Trash2 /> Elimina</DropdownItem>
    </Dropdown>
  )
}

function SheetChips({
  sheets, onPick, max = 3,
}: { sheets: WorkSheet[]; onPick?: (id: string) => void; max?: number }) {
  if (sheets.length === 0) {
    return <Badge className="bg-muted text-muted-foreground ring-1 ring-inset ring-border">Nessun foglio</Badge>
  }
  const shown = sheets.slice(0, max)
  const rest = sheets.slice(max)
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {shown.map((w) =>
        onPick ? (
          <button
            key={w.id}
            type="button"
            title={`Mostra solo i task del foglio ${w.name}`}
            onClick={(e) => { e.stopPropagation(); onPick(w.id) }}
            className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-brand ring-1 ring-inset ring-primary/25 transition-colors focus-ring hover:bg-primary/20"
          >
            {w.name}
          </button>
        ) : (
          <Badge key={w.id} className="bg-primary/10 text-brand ring-1 ring-inset ring-primary/25">
            {w.name}
          </Badge>
        ),
      )}
      {rest.length > 0 && (
        <Badge
          className="bg-muted text-muted-foreground ring-1 ring-inset ring-border"
          title={rest.map((w) => w.name).join(', ')}
        >
          +{fmtNum(rest.length)}
        </Badge>
      )}
    </div>
  )
}

/* -------------------------------------------------------------------- form */

interface Draft {
  name: string
  description: string
  estimate: string
}

const emptyDraft: Draft = { name: '', description: '', estimate: '' }

function TaskForm({
  open, onClose, initial, tasks, sheets, onSaved,
}: {
  open: boolean
  onClose: () => void
  initial: TaskCatalogItem | null
  tasks: TaskCatalogItem[]
  sheets: WorkSheet[]
  onSaved: (task: TaskCatalogItem, created: boolean) => void
}) {
  const upsertTask = useStore((s) => s.upsertTask)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [errors, setErrors] = React.useState<{ name?: string; description?: string; estimate?: string }>({})

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setDraft(
      initial
        ? {
            name: initial.name,
            description: initial.description ?? '',
            estimate: initial.estimateMin === undefined ? '' : String(initial.estimateMin),
          }
        : emptyDraft,
    )
  }, [open, initial])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    const description = draft.description.trim()
    const estimate = draft.estimate.trim()
    const minutes = estimate === '' ? undefined : Number(estimate)
    const next: { name?: string; description?: string; estimate?: string } = {}

    if (!name) next.name = 'Inserisci un nome'
    else if (tasks.some((t) => t.id !== initial?.id && norm(t.name) === norm(name))) {
      next.name = 'Esiste già un task con questo nome'
    }
    if (!description) next.description = 'Inserisci una descrizione'
    if (minutes !== undefined && (!Number.isFinite(minutes) || minutes <= 0)) {
      next.estimate = 'Inserisci una stima in minuti maggiore di zero'
    }

    setErrors(next)
    if (next.name || next.description || next.estimate) return

    const task: TaskCatalogItem = {
      id: initial?.id ?? uid(),
      name,
      description,
      estimateMin: minutes === undefined ? undefined : Math.round(minutes),
    }
    upsertTask(task)
    onSaved(task, !initial)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica task' : 'Nuovo task'}
      description={
        initial
          ? 'Le modifiche si riflettono su tutti i fogli di lavoro che includono questo task.'
          : 'Il task diventa disponibile per la composizione dei fogli di lavoro.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="task-form">{initial ? 'Salva modifiche' : 'Crea task'}</Button>
        </>
      }
    >
      <form id="task-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome task" error={errors.name}>
          <Input
            value={draft.name}
            placeholder="Es. Pulizia bagno completa"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <Field
          label="Descrizione"
          error={errors.description}
          hint="Le istruzioni che l'operatore legge sul campo: sii specifico su cosa controllare."
        >
          <Textarea
            value={draft.description}
            rows={4}
            placeholder="Sanitari, doccia, specchi, pavimento. Attenzione a calcare e muffa nella doccia."
            onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
          />
        </Field>

        <Field
          label="Stima in minuti"
          error={errors.estimate}
          hint="Lascia vuoto se il tempo dipende troppo dall'appartamento."
          className="sm:max-w-[220px]"
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={draft.estimate}
            placeholder="25"
            onChange={(e) => setDraft((d) => ({ ...d, estimate: e.target.value }))}
          />
        </Field>

        {initial && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {sheets.length === 0
                ? 'Non usato in nessun foglio di lavoro'
                : `Usato in ${plural(sheets.length, 'foglio di lavoro', 'fogli di lavoro')}`}
            </p>
            <SheetChips sheets={sheets} max={6} />
          </div>
        )}
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function CatalogoTask() {
  const isAdmin = useIsAdmin()
  const tasks = useStore((s) => s.taskCatalog)
  const workSheets = useStore((s) => s.workSheets)
  const deleteTask = useStore((s) => s.deleteTask)
  const upsertTask = useStore((s) => s.upsertTask)
  const upsertWorkSheet = useStore((s) => s.upsertWorkSheet)
  const toast = useToast()

  const [text, setText] = React.useState('')
  const [usage, setUsage] = React.useState('all')
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null)

  const rows = React.useMemo<Row[]>(() => {
    const byTask = new Map<string, WorkSheet[]>()
    for (const w of workSheets) {
      for (const id of new Set(w.taskIds)) {
        const list = byTask.get(id)
        if (list) list.push(w)
        else byTask.set(id, [w])
      }
    }
    return tasks.map((task) => ({ task, sheets: byTask.get(task.id) ?? [] }))
  }, [tasks, workSheets])

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    const sheetId = usage.startsWith('ws:') ? usage.slice(3) : null

    const list = rows.filter((r) => {
      if (usage === 'used' && r.sheets.length === 0) return false
      if (usage === 'unused' && r.sheets.length > 0) return false
      if (sheetId && !r.sheets.some((w) => w.id === sheetId)) return false
      if (q && !norm(`${r.task.name} ${r.task.description ?? ''}`).includes(q)) return false
      return true
    })

    const primary = (a: Row, b: Row): number => {
      switch (sortKey) {
        case 'estimate': return (a.task.estimateMin ?? 0) - (b.task.estimateMin ?? 0)
        case 'usage': return a.sheets.length - b.sheets.length
        default: return a.task.name.localeCompare(b.task.name, 'it')
      }
    }

    return list.sort((a, b) => {
      /* Un task senza stima non e' "il piu' breve": va in coda in entrambe le direzioni. */
      if (sortKey === 'estimate') {
        const missA = a.task.estimateMin === undefined
        const missB = b.task.estimateMin === undefined
        if (missA !== missB) return missA ? 1 : -1
      }
      const r = primary(a, b)
      if (r !== 0) return sortDir === 'asc' ? r : -r
      return a.task.name.localeCompare(b.task.name, 'it')
    })
  }, [rows, text, usage, sortKey, sortDir])

  const visibleIds = filtered.map((r) => r.task.id)
  const selectedRows = React.useMemo(
    () => filtered.filter((r) => selected.has(r.task.id)),
    [filtered, selected],
  )
  const selectedIds = selectedRows.map((r) => r.task.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id))
  const selectedMinutes = selectedRows.reduce((sum, r) => sum + (r.task.estimateMin ?? 0), 0)

  const withEstimate = rows.filter((r) => r.task.estimateMin !== undefined)
  const totalMinutes = withEstimate.reduce((sum, r) => sum + (r.task.estimateMin ?? 0), 0)
  const avgMinutes = withEstimate.length === 0 ? 0 : Math.round(totalMinutes / withEstimate.length)
  const unusedCount = rows.filter((r) => r.sheets.length === 0).length

  const hasFilters = text.trim() !== '' || usage !== 'all'
  const editing = editingId ? tasks.find((t) => t.id === editingId) ?? null : null
  const editingSheets = editingId ? rows.find((r) => r.task.id === editingId)?.sheets ?? [] : []

  const pendingRows = React.useMemo(() => {
    if (!pendingDelete) return []
    const ids = new Set(pendingDelete)
    return rows.filter((r) => ids.has(r.task.id))
  }, [pendingDelete, rows])

  const pendingSheets = React.useMemo(() => {
    if (!pendingDelete) return []
    const ids = new Set(pendingDelete)
    return workSheets
      .map((w) => ({ sheet: w, hits: w.taskIds.filter((id) => ids.has(id)).length }))
      .filter((x) => x.hits > 0)
  }, [pendingDelete, workSheets])

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of visibleIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'name' ? 'asc' : 'desc')
    }
  }

  const clearFilters = () => {
    setText('')
    setUsage('all')
  }

  const openNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  /** La copia viene creata subito e aperta in modifica: il nome va quasi sempre ritoccato. */
  const duplicate = (task: TaskCatalogItem) => {
    const id = uid()
    const copy: TaskCatalogItem = {
      id,
      name: duplicateName(task.name, tasks),
      description: task.description,
      estimateMin: task.estimateMin,
    }
    upsertTask(copy)
    setEditingId(id)
    setFormOpen(true)
    toast({
      title: 'Task duplicato',
      description: `${copy.name} è nel catalogo: modifica il nome se serve.`,
      action: { label: 'Annulla', onClick: () => { deleteTask(id); setFormOpen(false); setEditingId(null) } },
    })
  }

  const onSaved = (task: TaskCatalogItem, created: boolean) => {
    toast({ title: created ? 'Task creato' : 'Task aggiornato', description: task.name })
  }

  /** Eliminare un task lo sfila anche dai fogli che lo includono, per non lasciare riferimenti morti. */
  const confirmDelete = () => {
    if (!pendingDelete) return
    const ids = new Set(pendingDelete)
    /* Stato precedente messo da parte: la notifica permette di rimettere tutto com'era. */
    const removed = tasks.filter((t) => ids.has(t.id))
    const touched = workSheets.filter((w) => w.taskIds.some((id) => ids.has(id)))
    for (const w of touched) {
      upsertWorkSheet({ ...w, taskIds: w.taskIds.filter((id) => !ids.has(id)) })
    }
    for (const id of pendingDelete) deleteTask(id)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    setPendingDelete(null)
    toast({
      title: plural(removed.length, 'task eliminato', 'task eliminati'),
      description: touched.length
        ? `Rimosso anche da ${plural(touched.length, 'foglio di lavoro', 'fogli di lavoro')}. Puoi annullare finché questa notifica resta a schermo.`
        : 'Puoi annullare finché questa notifica resta a schermo.',
      action: {
        label: 'Annulla',
        onClick: () => {
          removed.forEach(upsertTask)
          touched.forEach(upsertWorkSheet)
        },
      },
    })
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Catalogo Task" />
        <EmptyState
          icon={ShieldAlert}
          title="Area riservata agli amministratori"
          description="Il catalogo dei task è modificabile solo dagli account con ruolo Amministratore."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">Catalogo Task<HelpTip term="task" /></span>}
        subtitle="Definisci i singoli task che potranno essere inseriti nei fogli di lavoro"
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cerca per nome o descrizione"
                aria-label="Cerca per nome o descrizione"
                className="h-10 pl-9"
              />
            </div>
            <Button onClick={openNew}>
              <Plus />
              Nuovo <span className="hidden sm:inline">task</span>
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <SummaryTile
          icon={ClipboardList}
          label="Task in catalogo"
          value={fmtNum(tasks.length)}
          hint={`${fmtNum(withEstimate.length)} con stima · ${fmtNum(tasks.length - withEstimate.length)} senza`}
        />
        <SummaryTile
          icon={Timer}
          label="Stima media"
          value={withEstimate.length === 0 ? '—' : fmtMin(avgMinutes)}
          hint={
            withEstimate.length === 0
              ? 'Nessun task ha ancora una stima'
              : `Su ${plural(withEstimate.length, 'task con stima', 'task con stima')}`
          }
        />
        <SummaryTile
          icon={ListChecks}
          label="Tempo totale catalogo"
          value={fmtDuration(totalMinutes)}
          hint={`Somma delle stime · ${plural(withEstimate.length, 'task conteggiato', 'task conteggiati')}`}
        />
        <SummaryTile
          icon={AlertTriangle}
          tone={unusedCount > 0 ? 'warn' : 'brand'}
          label="Non usati in nessun foglio"
          value={fmtNum(unusedCount)}
          hint={
            unusedCount > 0 ? (
              <button
                type="button"
                onClick={() => setUsage('unused')}
                className="rounded underline underline-offset-2 transition-colors focus-ring hover:text-foreground"
              >
                Mostra solo questi
              </button>
            ) : (
              'Ogni task è collegato ad almeno un foglio'
            )
          }
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <div className="w-full sm:w-64">
          <Select
            value={usage}
            onChange={(e) => setUsage(e.target.value)}
            aria-label="Filtra per utilizzo nei fogli di lavoro"
            className="h-9"
            options={[
              { value: 'all', label: 'Tutti i task' },
              { value: 'used', label: 'Solo task usati in un foglio' },
              { value: 'unused', label: 'Solo task non usati' },
              ...workSheets.map((w) => ({ value: `ws:${w.id}`, label: `Foglio: ${w.name}` })),
            ]}
          />
        </div>

        <div className="w-full sm:w-56">
          <Select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(':')
              setSortKey(k as SortKey)
              setSortDir(d as SortDir)
            }}
            aria-label="Ordina i task"
            className="h-9"
            options={[
              { value: 'name:asc', label: 'Nome (A → Z)' },
              { value: 'name:desc', label: 'Nome (Z → A)' },
              { value: 'estimate:desc', label: 'Stima (più lunghi prima)' },
              { value: 'estimate:asc', label: 'Stima (più brevi prima)' },
              { value: 'usage:desc', label: 'Fogli di lavoro (più usati)' },
              { value: 'usage:asc', label: 'Fogli di lavoro (meno usati)' },
            ]}
          />
        </div>

        <span aria-live="polite" className="text-sm tabular-nums text-muted-foreground">
          {fmtNum(filtered.length)} di {plural(tasks.length, 'task', 'task')}
        </span>

        {hasFilters && (
          <Button variant="link" size="sm" className="ml-auto" onClick={clearFilters}>
            Cancella filtri
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedIds.length, 'task selezionato', 'task selezionati')}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            Stima cumulata: {fmtDuration(selectedMinutes)}
          </span>
          <Button variant="destructive" size="sm" onClick={() => setPendingDelete(selectedIds)}>
            <Trash2 />
            Elimina selezionati
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Annulla selezione
          </Button>
        </div>
      )}

      <TableScroller innerClassName="overflow-x-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={tasks.length === 0 ? 'Il catalogo è vuoto' : 'Nessun task con questi filtri'}
            description={
              tasks.length === 0
                ? 'Crea il primo task: sarà la base con cui comporre i fogli di lavoro assegnati alle richieste.'
                : 'Prova a cambiare il filtro sui fogli di lavoro, oppure a svuotare la ricerca.'
            }
            action={
              tasks.length === 0
                ? <Button onClick={openNew}><Plus /> Nuovo task</Button>
                : <Button variant="outline" onClick={clearFilters}>Cancella filtri</Button>
            }
          />
        ) : (
          <>
            <div className="stagger space-y-3 p-4 md:hidden">
              {filtered.map((r) => (
                <MobileRecord
                  key={r.task.id}
                  title={r.task.name}
                  subtitle={r.task.description}
                  selected={selected.has(r.task.id)}
                  onClick={() => openEdit(r.task.id)}
                  badge={
                    <Checkbox
                      padded
                      checked={selected.has(r.task.id)}
                      onChange={() => toggleOne(r.task.id)}
                      label={`Seleziona ${r.task.name}`}
                    />
                  }
                  action={
                    <RowMenu
                      name={r.task.name}
                      onEdit={() => openEdit(r.task.id)}
                      onDuplicate={() => duplicate(r.task)}
                      onDelete={() => setPendingDelete([r.task.id])}
                    />
                  }
                  fields={[
                    { label: 'Stima', value: r.task.estimateMin ? fmtMin(r.task.estimateMin) : '—' },
                    { label: 'Usato in', value: plural(r.sheets.length, 'foglio', 'fogli') },
                  ]}
                />
              ))}
            </div>

          <Table className="hidden min-w-[980px] md:table">
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    label="Seleziona tutti i task filtrati"
                  />
                </Th>
                <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                <SortHeader label="Nome" sortKey="name" current={sortKey} dir={sortDir} onSort={sortBy} />
                <Th>Descrizione</Th>
                <SortHeader
                  label="Stima" sortKey="estimate" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
                <SortHeader label="Usato in" sortKey="usage" current={sortKey} dir={sortDir} onSort={sortBy} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSelected = selected.has(r.task.id)
                return (
                  <tr
                    key={r.task.id}
                    onClick={() => openEdit(r.task.id)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 transition-colors last:border-0',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(r.task.id)}
                        label={`Seleziona ${r.task.name}`}
                      />
                    </Td>

                    <Td onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        name={r.task.name}
                        onEdit={() => openEdit(r.task.id)}
                        onDuplicate={() => duplicate(r.task)}
                        onDelete={() => setPendingDelete([r.task.id])}
                      />
                    </Td>

                    <Td className="max-w-[260px]">
                      <span className="block truncate font-medium">{r.task.name}</span>
                    </Td>

                    <Td className="max-w-[420px]">
                      {r.task.description ? (
                        <p className="line-clamp-2 text-muted-foreground" title={r.task.description}>
                          {r.task.description}
                        </p>
                      ) : (
                        <span className="text-muted-foreground/60">—</span>
                      )}
                    </Td>

                    <Td className="whitespace-nowrap text-right tabular-nums">
                      {r.task.estimateMin === undefined
                        ? <span className="text-muted-foreground/60">—</span>
                        : <span className="font-medium">{fmtMin(r.task.estimateMin)}</span>}
                    </Td>

                    <Td className="max-w-[320px]">
                      <SheetChips sheets={r.sheets} onPick={(id) => setUsage(`ws:${id}`)} />
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          </>
        )}
      </TableScroller>

      <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 md:sticky md:bottom-0 md:z-10">
        <span className="text-sm text-muted-foreground">
          Ordinati per <span className="font-medium text-foreground">{SORT_LABEL[sortKey]}</span>{' '}
          ({sortDir === 'asc' ? 'crescente' : 'decrescente'})
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          (Task totali per i filtri applicati: {fmtNum(filtered.length)} | Selezionati: {fmtNum(selectedIds.length)})
        </span>
      </div>

      <TaskForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        tasks={tasks}
        sheets={editingSheets}
        onSaved={onSaved}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingRows.length > 1 ? `Elimina ${fmtNum(pendingRows.length)} task` : 'Elimina task'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          {pendingRows.length === 1 && pendingRows[0] ? (
            <p>
              Stai per eliminare <span className="font-medium">{pendingRows[0].task.name}</span>.
              Potrai annullare dalla notifica per qualche secondo.
            </p>
          ) : (
            <>
              <p>Stai per eliminare i seguenti task. Potrai annullare dalla notifica per qualche secondo.</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted px-3 py-2">
                {pendingRows.map((r) => (
                  <li key={r.task.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{r.task.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {r.task.estimateMin === undefined ? '—' : fmtMin(r.task.estimateMin)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pendingSheets.length > 0 && (
            <div className="space-y-2 rounded-md bg-status-pending/10 px-3 py-2.5 ring-1 ring-inset ring-status-pending/25">
              {/* Il testo resta nel colore del testo: l'ambra sulla tinta non regge il 4.5:1. */}
              <p className="flex items-start gap-2 font-medium">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-status-pending" />
                <span>
                  {pendingRows.length === 1
                    ? `Questo task è usato in ${plural(pendingSheets.length, 'foglio di lavoro', 'fogli di lavoro')}`
                    : `Questi task sono usati in ${plural(pendingSheets.length, 'foglio di lavoro', 'fogli di lavoro')}`}
                </span>
              </p>
              <ul className="space-y-1">
                {pendingSheets.map(({ sheet, hits }) => (
                  <li key={sheet.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{sheet.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {hits} di {sheet.taskIds.length}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Procedendo, i task verranno rimossi anche da questi fogli di lavoro.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
