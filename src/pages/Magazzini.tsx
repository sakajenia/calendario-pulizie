import * as React from 'react'
import {
  AlertTriangle, Boxes, ChevronDown, ChevronUp, ChevronsUpDown, Download, KeyRound, MapPin,
  MoreVertical, PackageOpen, Pencil, Plus, Search, ShieldAlert, Trash2, Wallet,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { HelpTip } from '@/components/HelpTip'
import {
  Badge, Button, Checkbox, Dialog,
  Dropdown, DropdownItem, DropdownSeparator, EmptyState, Field, Input, Select, Switch,
  Table, TableScroller, Td, Textarea, Th,
} from '@/components/ui'
import { scopeRequests, useCurrentUser, useIsAdmin, useStore } from '@/data/store'
import { downloadFile, fmtEur, fmtNum, norm, plural, toCsv } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { ExtraCatalogItem, ExtraLine, ExtraScope, RequestStatus, Warehouse } from '@/types'

/* --------------------------------------------------------------- costanti */

const SCOPE_LABEL: Record<ExtraScope, string> = {
  apartment: 'Appartamento',
  bed: 'Letto',
  person: 'Persona',
}

const SCOPE_CHIP: Record<ExtraScope, string> = {
  apartment: 'bg-primary/10 text-brand ring-1 ring-inset ring-primary/25',
  bed: 'bg-status-progress/12 text-status-progress ring-1 ring-inset ring-status-progress/25',
  person: 'bg-status-verify/12 text-status-verify ring-1 ring-inset ring-status-verify/25',
}

const SCOPE_ORDER: Record<ExtraScope, number> = { apartment: 0, bed: 1, person: 2 }

/** Su quali richieste si calcola il consumo impegnato di ogni articolo. */
type Basis = 'active' | 'open' | 'all'

const BASIS_LABEL: Record<Basis, string> = {
  active: 'richieste non cancellate',
  open: 'richieste aperte',
  all: 'tutte le richieste',
}

const OPEN_STATUSES: RequestStatus[] = ['in_attesa', 'accettata', 'in_corso', 'da_verificare']
const CANCELLED_STATUSES: RequestStatus[] = ['cancellata', 'cancellata_guesty']

type CardSort = 'name' | 'value' | 'items'

const CARD_SORT_LABEL: Record<CardSort, string> = {
  name: 'nome',
  value: 'valore impegnato',
  items: 'numero di articoli',
}

type SortKey = 'warehouse' | 'item' | 'scope' | 'unit' | 'qty' | 'value'
type SortDir = 'asc' | 'desc'

/** Riga del dettaglio: un articolo del catalogo con il suo impegno stimato. */
interface ItemRow {
  extra: ExtraCatalogItem
  warehouse: Warehouse | null
  qty: number
  value: number
}

interface WarehouseRow {
  warehouse: Warehouse
  items: ItemRow[]
  committed: number
  value: number
}

const uid = () => `wh-${Math.random().toString(36).slice(2, 10)}`

/** Excel italiano si aspetta la virgola come separatore decimale. */
const csvNum = (n: number) => n.toFixed(2).replace('.', ',')

/* ------------------------------------------------------------------ pezzi */

function SummaryTile({
  icon: Icon, label, value, hint, tone = 'brand',
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: React.ReactNode
  tone?: 'brand' | 'warn'
}) {
  return (
    <div className="min-w-0 bg-card px-5 py-3.5">
      <p className="eyebrow flex items-center gap-1.5">
        <Icon className={cn('size-3.5 shrink-0', tone === 'warn' ? 'text-status-pending' : 'text-brand')} />
        <span className="truncate">{label}</span>
      </p>
      <p className="mt-1.5 font-display text-xl font-bold leading-none tabular-nums">{value}</p>
      {hint && <div className="mt-1 text-xs leading-relaxed text-muted-foreground">{hint}</div>}
    </div>
  )
}

function ScopeBadge({ scope }: { scope: ExtraScope }) {
  return <Badge className={SCOPE_CHIP[scope]}>{SCOPE_LABEL[scope]}</Badge>
}

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

/* -------------------------------------------------------------------- form */

interface Draft {
  name: string
  address: string
  code: string
  notes: string
}

const emptyDraft: Draft = { name: '', address: '', code: '', notes: '' }

function WarehouseForm({
  open, onClose, initial, warehouses, items,
}: {
  open: boolean
  onClose: () => void
  initial: Warehouse | null
  warehouses: Warehouse[]
  items: ItemRow[]
}) {
  const upsertWarehouse = useStore((s) => s.upsertWarehouse)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!open) return
    setError(undefined)
    setDraft(
      initial
        ? {
            name: initial.name,
            address: initial.address ?? '',
            code: initial.code ?? '',
            notes: initial.notes ?? '',
          }
        : emptyDraft,
    )
  }, [open, initial])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    if (!name) return setError('Inserisci un nome')
    if (warehouses.some((w) => w.id !== initial?.id && norm(w.name) === norm(name))) {
      return setError('Esiste già un magazzino con questo nome')
    }

    const address = draft.address.trim()
    const code = draft.code.trim()
    const notes = draft.notes.trim()

    upsertWarehouse({
      id: initial?.id ?? uid(),
      name,
      address: address || undefined,
      code: code || undefined,
      notes: notes || undefined,
    })
    onClose()
  }

  const committed = items.reduce((sum, r) => sum + r.value, 0)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica magazzino' : 'Nuovo magazzino'}
      description={
        initial
          ? 'Le modifiche valgono per tutti gli articoli assegnati a questo magazzino.'
          : 'Il magazzino diventa assegnabile agli articoli del catalogo extra.'
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="warehouse-form">
            {initial ? 'Salva modifiche' : 'Crea magazzino'}
          </Button>
        </>
      }
    >
      <form id="warehouse-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome magazzino" error={error}>
          <Input
            value={draft.name}
            placeholder="Es. Magazzino Trastevere"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <Field label="Indirizzo" hint="Dove si trova fisicamente il deposito.">
            <Input
              value={draft.address}
              placeholder="Vicolo del Cinque 12, Roma"
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
          </Field>

          <Field label="Codice lucchetto" hint="Visibile agli operatori nelle note.">
            <Input
              value={draft.code}
              inputMode="numeric"
              placeholder="1405"
              className="font-mono tracking-widest"
              onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            />
          </Field>
        </div>

        <Field
          label="Note"
          hint="Indicazioni per raggiungere e usare il deposito: una riga per ogni istruzione."
        >
          <Textarea
            value={draft.notes}
            rows={4}
            placeholder={'Armadio grande a sinistra.\nLenzuola e amenities.'}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </Field>

        {initial && (
          <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {items.length === 0
                ? 'Nessun articolo assegnato a questo magazzino'
                : `${plural(items.length, 'articolo assegnato', 'articoli assegnati')} · ${fmtEur(committed)} impegnati`}
            </p>
            {items.length > 0 && (
              <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
                {items.map((r) => (
                  <li key={r.extra.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{r.extra.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {fmtNum(r.qty)} pz · {fmtEur(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Magazzini() {
  const isAdmin = useIsAdmin()
  const user = useCurrentUser()
  const warehouses = useStore((s) => s.warehouses)
  const extras = useStore((s) => s.extraCatalog)
  const requests = useStore((s) => s.requests)
  const deleteWarehouse = useStore((s) => s.deleteWarehouse)
  const upsertExtra = useStore((s) => s.upsertExtra)

  const [text, setText] = React.useState('')
  const [basis, setBasis] = React.useState<Basis>('active')
  const [cardSort, setCardSort] = React.useState<CardSort>('name')
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [whFilter, setWhFilter] = React.useState('all')
  const [scopeFilter, setScopeFilter] = React.useState('all')
  const [onlyCommitted, setOnlyCommitted] = React.useState(false)
  const [sortKey, setSortKey] = React.useState<SortKey>('value')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null)
  const tableRef = React.useRef<HTMLElement>(null)

  const considered = React.useMemo(() => {
    const scoped = scopeRequests(requests, user)
    if (basis === 'all') return scoped
    if (basis === 'open') return scoped.filter((r) => OPEN_STATUSES.includes(r.status))
    return scoped.filter((r) => !CANCELLED_STATUSES.includes(r.status))
  }, [requests, user, basis])

  /* Le richieste citano gli extra per nome, non per id: l'incrocio col catalogo passa da lì. */
  const qtyByName = React.useMemo(() => {
    const map = new Map<string, number>()
    const add = (lines: ExtraLine[]) => {
      for (const line of lines) {
        const key = norm(line.name)
        map.set(key, (map.get(key) ?? 0) + line.qty)
      }
    }
    for (const r of considered) {
      add(r.perPersonExtras)
      add(r.apartmentExtras)
      for (const bed of r.beds) add(bed.extras)
    }
    return map
  }, [considered])

  const itemRows = React.useMemo<ItemRow[]>(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w] as const))
    return extras.map((extra) => {
      const qty = qtyByName.get(norm(extra.name)) ?? 0
      return {
        extra,
        warehouse: extra.warehouseId ? byId.get(extra.warehouseId) ?? null : null,
        qty,
        value: qty * (extra.unitCost ?? 0),
      }
    })
  }, [extras, warehouses, qtyByName])

  const warehouseRows = React.useMemo<WarehouseRow[]>(() => {
    const groups = new Map<string, ItemRow[]>()
    for (const row of itemRows) {
      if (!row.warehouse) continue
      const list = groups.get(row.warehouse.id)
      if (list) list.push(row)
      else groups.set(row.warehouse.id, [row])
    }
    return warehouses.map((warehouse) => {
      const items = (groups.get(warehouse.id) ?? []).slice().sort((a, b) => b.value - a.value)
      return {
        warehouse,
        items,
        committed: items.reduce((sum, r) => sum + r.qty, 0),
        value: items.reduce((sum, r) => sum + r.value, 0),
      }
    })
  }, [itemRows, warehouses])

  const cards = React.useMemo(() => {
    const q = norm(text.trim())
    const list = warehouseRows.filter((r) => {
      if (!q) return true
      const w = r.warehouse
      return norm(`${w.name} ${w.address ?? ''} ${w.code ?? ''} ${w.notes ?? ''}`).includes(q)
    })
    return list.sort((a, b) => {
      const byName = a.warehouse.name.localeCompare(b.warehouse.name, 'it')
      if (cardSort === 'value') return b.value - a.value || byName
      if (cardSort === 'items') return b.items.length - a.items.length || byName
      return byName
    })
  }, [warehouseRows, text, cardSort])

  const tableRows = React.useMemo(() => {
    const list = itemRows.filter((r) => {
      if (whFilter === 'none' && r.warehouse) return false
      if (whFilter !== 'all' && whFilter !== 'none' && r.warehouse?.id !== whFilter) return false
      if (scopeFilter !== 'all' && r.extra.scope !== scopeFilter) return false
      if (onlyCommitted && r.qty === 0) return false
      return true
    })

    const primary = (a: ItemRow, b: ItemRow): number => {
      switch (sortKey) {
        case 'warehouse': return (a.warehouse?.name ?? '').localeCompare(b.warehouse?.name ?? '', 'it')
        case 'item': return a.extra.name.localeCompare(b.extra.name, 'it')
        case 'scope': return SCOPE_ORDER[a.extra.scope] - SCOPE_ORDER[b.extra.scope]
        case 'unit': return (a.extra.unitCost ?? 0) - (b.extra.unitCost ?? 0)
        case 'qty': return a.qty - b.qty
        default: return a.value - b.value
      }
    }

    return list.sort((a, b) => {
      const r = primary(a, b)
      if (r !== 0) return sortDir === 'asc' ? r : -r
      return a.extra.name.localeCompare(b.extra.name, 'it')
    })
  }, [itemRows, whFilter, scopeFilter, onlyCommitted, sortKey, sortDir])

  const visibleIds = cards.map((r) => r.warehouse.id)
  const selectedRows = React.useMemo(
    () => cards.filter((r) => selected.has(r.warehouse.id)),
    [cards, selected],
  )
  const selectedIds = selectedRows.map((r) => r.warehouse.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id))
  const selectedValue = selectedRows.reduce((sum, r) => sum + r.value, 0)

  const assignedItems = itemRows.filter((r) => r.warehouse !== null).length
  const unassignedItems = itemRows.length - assignedItems
  const withoutCost = extras.filter((e) => e.unitCost === undefined).length
  const totalValue = itemRows.reduce((sum, r) => sum + r.value, 0)
  const tableQty = tableRows.reduce((sum, r) => sum + r.qty, 0)
  const tableValue = tableRows.reduce((sum, r) => sum + r.value, 0)

  const hasCardFilters = text.trim() !== '' || cardSort !== 'name'
  const hasTableFilters = whFilter !== 'all' || scopeFilter !== 'all' || onlyCommitted

  const editing = editingId ? warehouses.find((w) => w.id === editingId) ?? null : null
  const editingItems = editingId
    ? warehouseRows.find((r) => r.warehouse.id === editingId)?.items ?? []
    : []

  const pendingRows = React.useMemo(() => {
    if (!pendingDelete) return []
    const ids = new Set(pendingDelete)
    return warehouseRows.filter((r) => ids.has(r.warehouse.id))
  }, [pendingDelete, warehouseRows])

  const pendingItems = React.useMemo(() => {
    if (!pendingDelete) return []
    const ids = new Set(pendingDelete)
    return itemRows.filter((r) => r.warehouse !== null && ids.has(r.warehouse.id))
  }, [pendingDelete, itemRows])

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
      setSortDir(k === 'warehouse' || k === 'item' || k === 'scope' ? 'asc' : 'desc')
    }
  }

  const openNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  /* Azzera anche il filtro sugli impegnati: altrimenti "mostra articoli" puo' portare a una tabella vuota. */
  const showItemsOf = (id: string) => {
    setWhFilter(id)
    setScopeFilter('all')
    setOnlyCommitted(false)
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* Eliminare un magazzino non cancella le scorte: gli articoli restano a catalogo, senza assegnazione. */
  const confirmDelete = () => {
    if (!pendingDelete) return
    const ids = new Set(pendingDelete)
    for (const e of extras) {
      if (e.warehouseId && ids.has(e.warehouseId)) upsertExtra({ ...e, warehouseId: undefined })
    }
    for (const id of pendingDelete) deleteWarehouse(id)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) next.delete(id)
      return next
    })
    if (ids.has(whFilter)) setWhFilter('all')
    setPendingDelete(null)
  }

  const exportCsv = () => {
    const headers = ['Magazzino', 'Articolo', 'Tipo', 'Costo unitario', 'Impegnato', 'Valore']
    const rows = tableRows.map((r) => ({
      Magazzino: r.warehouse?.name ?? 'Non assegnato',
      Articolo: r.extra.name,
      Tipo: SCOPE_LABEL[r.extra.scope],
      'Costo unitario': r.extra.unitCost === undefined ? '' : csvNum(r.extra.unitCost),
      Impegnato: String(r.qty),
      Valore: csvNum(r.value),
    }))
    downloadFile('articoli-per-magazzino.csv', toCsv(rows, headers))
  }

  if (!isAdmin) {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Magazzini" />
        <EmptyState
          icon={ShieldAlert}
          title="Area riservata agli amministratori"
          description="I magazzini e le scorte sono gestiti solo dagli account con ruolo Amministratore."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">Magazzini<HelpTip term="magazzino" /></span>}
        subtitle="Crea, modifica ed elimina i magazzini"
        actions={
          <>
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Cerca per nome, indirizzo, codice o note"
                aria-label="Cerca per nome, indirizzo, codice o note"
                className="h-10 pl-9"
              />
            </div>
            <Button onClick={openNew}>
              <Plus />
              Nuovo <span className="hidden sm:inline">Magazzino</span>
            </Button>
          </>
        }
      />

      <div className="grid shrink-0 grid-cols-2 gap-px border-b border-border bg-border lg:grid-cols-4">
        <SummaryTile
          icon={Boxes}
          label="Magazzini"
          value={fmtNum(warehouses.length)}
          hint={`${plural(assignedItems, 'articolo assegnato', 'articoli assegnati')}`}
        />
        <SummaryTile
          icon={PackageOpen}
          label="Articoli a catalogo"
          value={fmtNum(extras.length)}
          hint={
            withoutCost === 0
              ? 'Tutti gli articoli hanno un costo unitario'
              : `${plural(withoutCost, 'articolo senza costo', 'articoli senza costo')}: esclusi dal valore`
          }
        />
        <SummaryTile
          icon={Wallet}
          label="Valore impegnato"
          value={fmtEur(totalValue)}
          hint={`Su ${plural(considered.length, 'richiesta considerata', 'richieste considerate')}`}
        />
        <SummaryTile
          icon={AlertTriangle}
          tone={unassignedItems > 0 ? 'warn' : 'brand'}
          label="Articoli senza magazzino"
          value={fmtNum(unassignedItems)}
          hint={
            unassignedItems > 0 ? (
              <button
                type="button"
                onClick={() => showItemsOf('none')}
                className="rounded underline underline-offset-2 transition-colors focus-ring hover:text-foreground"
              >
                Mostra nel dettaglio
              </button>
            ) : (
              'Ogni articolo ha un deposito assegnato'
            )
          }
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <Checkbox
          checked={allSelected}
          indeterminate={someSelected}
          onChange={toggleAll}
          disabled={visibleIds.length === 0}
          label="Seleziona tutti i magazzini filtrati"
        />

        <div className="w-full sm:w-56">
          <Select
            value={cardSort}
            onChange={(e) => setCardSort(e.target.value as CardSort)}
            aria-label="Ordina i magazzini"
            className="h-9"
            options={[
              { value: 'name', label: 'Nome (A → Z)' },
              { value: 'value', label: 'Valore impegnato (alto → basso)' },
              { value: 'items', label: 'Articoli assegnati (più → meno)' },
            ]}
          />
        </div>

        <div className="w-full sm:w-64">
          <Select
            value={basis}
            onChange={(e) => setBasis(e.target.value as Basis)}
            aria-label="Base di calcolo dei consumi"
            className="h-9"
            options={[
              { value: 'active', label: `Consumi su ${BASIS_LABEL.active}` },
              { value: 'open', label: `Consumi su ${BASIS_LABEL.open}` },
              { value: 'all', label: `Consumi su ${BASIS_LABEL.all}` },
            ]}
          />
        </div>

        <span className="text-sm tabular-nums text-muted-foreground">
          {fmtNum(cards.length)} di {plural(warehouses.length, 'magazzino', 'magazzini')}
        </span>

        {hasCardFilters && (
          <Button
            variant="link"
            size="sm"
            className="ml-auto"
            onClick={() => { setText(''); setCardSort('name') }}
          >
            Cancella filtri
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedIds.length, 'magazzino selezionato', 'magazzini selezionati')}
          </span>
          <span className="text-sm tabular-nums text-muted-foreground">
            Valore impegnato: {fmtEur(selectedValue)}
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

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="space-y-6 p-5">
          {warehouses.length === 0 ? (
            <EmptyState
              icon={Boxes}
              title="Nessun magazzino"
              description="Crea il primo deposito: potrai assegnargli gli articoli del catalogo extra e seguire il consumo stimato delle richieste."
              action={<Button onClick={openNew}><Plus /> Nuovo Magazzino</Button>}
            />
          ) : cards.length === 0 ? (
            <EmptyState
              icon={Search}
              title="Nessun magazzino con questi filtri"
              description="Nessun nome, indirizzo, codice o nota corrisponde alla ricerca."
              action={<Button variant="outline" onClick={() => setText('')}>Cancella ricerca</Button>}
            />
          ) : (
            <div className="stagger divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {cards.map((r) => {
                const w = r.warehouse
                const isSelected = selected.has(w.id)
                return (
                  <article
                    key={w.id}
                    onClick={() => openEdit(w.id)}
                    className={cn(
                      'grid cursor-pointer gap-4 px-5 py-4 transition-colors duration-200 ease-out-expo lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/40',
                    )}
                  >
                    <div className="min-w-0 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-1">
                          <Checkbox
                            checked={isSelected}
                            onChange={() => toggleOne(w.id)}
                            label={`Seleziona ${w.name}`}
                          />
                        </span>
                        <div className="min-w-0">
                          <h3 className="truncate font-display text-base font-bold tracking-tight">{w.name}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {plural(r.items.length, 'articolo assegnato', 'articoli assegnati')}
                          </p>
                        </div>
                      </div>

                      <span onClick={(e) => e.stopPropagation()}>
                        <Dropdown
                          trigger={
                            <Button variant="ghost" size="icon" className="size-8" aria-label={`Azioni ${w.name}`}>
                              <MoreVertical />
                            </Button>
                          }
                        >
                          <DropdownItem onClick={() => openEdit(w.id)}><Pencil /> Modifica</DropdownItem>
                          <DropdownItem onClick={() => showItemsOf(w.id)}><PackageOpen /> Mostra articoli</DropdownItem>
                          <DropdownSeparator />
                          <DropdownItem danger onClick={() => setPendingDelete([w.id])}>
                            <Trash2 /> Elimina
                          </DropdownItem>
                        </Dropdown>
                      </span>
                      </div>

                      <p className="flex items-start gap-2 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        {w.address
                          ? <span className="min-w-0">{w.address}</span>
                          : <span className="text-muted-foreground/70">Indirizzo non indicato</span>}
                      </p>

                      {w.code ? (
                        <Badge className="bg-muted font-mono tracking-widest text-foreground ring-1 ring-inset ring-border">
                          <KeyRound className="size-3.5 text-muted-foreground" />
                          {w.code}
                        </Badge>
                      ) : (
                        <p className="text-xs text-muted-foreground/70">Nessun codice lucchetto</p>
                      )}

                      {w.notes && (
                        <p
                          title={w.notes}
                          className="line-clamp-4 whitespace-pre-line text-sm text-muted-foreground"
                        >
                          {w.notes}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
                      <div className="min-w-0">
                        <p className="eyebrow whitespace-nowrap">Articoli</p>
                        <p className="font-display text-base font-bold tabular-nums">{fmtNum(r.items.length)}</p>
                        <p className="truncate text-xs tabular-nums text-muted-foreground">
                          {fmtNum(r.committed)} pz impegnati
                        </p>
                      </div>
                      <div className="min-w-0 text-right">
                        <p className="eyebrow whitespace-nowrap">Valore</p>
                        <p className="font-display text-base font-bold tabular-nums">{fmtEur(r.value)}</p>
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          )}

          <section ref={tableRef} className="rounded-xl border border-border bg-card shadow-card">
            <div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3.5">
              <div className="min-w-0">
                <h2 className="font-display text-base font-bold tracking-tight">Articoli per magazzino</h2>
                <p className="text-xs text-muted-foreground">
                  Impegno stimato incrociando il catalogo extra con {BASIS_LABEL[basis]}.
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <div className="w-full sm:w-56">
                  <Select
                    value={whFilter}
                    onChange={(e) => setWhFilter(e.target.value)}
                    aria-label="Filtra per magazzino"
                    className="h-9"
                    options={[
                      { value: 'all', label: 'Tutti i magazzini' },
                      ...warehouses.map((w) => ({ value: w.id, label: w.name })),
                      { value: 'none', label: 'Senza magazzino' },
                    ]}
                  />
                </div>
                <div className="w-full sm:w-44">
                  <Select
                    value={scopeFilter}
                    onChange={(e) => setScopeFilter(e.target.value)}
                    aria-label="Filtra per tipo di extra"
                    className="h-9"
                    options={[
                      { value: 'all', label: 'Tutti i tipi' },
                      { value: 'apartment', label: SCOPE_LABEL.apartment },
                      { value: 'bed', label: SCOPE_LABEL.bed },
                      { value: 'person', label: SCOPE_LABEL.person },
                    ]}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Switch
                    checked={onlyCommitted}
                    onChange={setOnlyCommitted}
                    label="Mostra solo gli articoli con impegno"
                  />
                  Solo impegnati
                </label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportCsv}
                  disabled={tableRows.length === 0}
                >
                  <Download />
                  <span className="hidden sm:inline">Esporta CSV</span>
                </Button>
              </div>
            </div>

            {tableRows.length === 0 ? (
              <EmptyState
                icon={PackageOpen}
                title={extras.length === 0 ? 'Il catalogo extra è vuoto' : 'Nessun articolo con questi filtri'}
                description={
                  extras.length === 0
                    ? 'Gli articoli si creano dalla sezione Extra: da lì si assegnano ai magazzini.'
                    : 'Prova a cambiare magazzino o tipo, oppure a disattivare il filtro sugli articoli impegnati.'
                }
                action={
                  hasTableFilters ? (
                    <Button
                      variant="outline"
                      onClick={() => { setWhFilter('all'); setScopeFilter('all'); setOnlyCommitted(false) }}
                    >
                      Cancella filtri
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <TableScroller>
                <Table className="min-w-[860px]">
                  <thead>
                    <tr>
                      <SortHeader label="Magazzino" sortKey="warehouse" current={sortKey} dir={sortDir} onSort={sortBy} />
                      <SortHeader label="Articolo" sortKey="item" current={sortKey} dir={sortDir} onSort={sortBy} />
                      <SortHeader label="Tipo" sortKey="scope" current={sortKey} dir={sortDir} onSort={sortBy} />
                      <SortHeader label="Costo unitario" sortKey="unit" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
                      <SortHeader label="Impegnato" sortKey="qty" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
                      <SortHeader label="Valore" sortKey="value" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((r) => (
                      <tr key={r.extra.id} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                        <Td className="max-w-[220px]">
                          {r.warehouse ? (
                            <button
                              type="button"
                              onClick={() => setWhFilter(r.warehouse ? r.warehouse.id : 'all')}
                              title={`Mostra solo gli articoli di ${r.warehouse.name}`}
                              className="block max-w-full truncate rounded text-left font-medium transition-colors focus-ring hover:text-brand"
                            >
                              {r.warehouse.name}
                            </button>
                          ) : (
                            <Badge className="bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/25">
                              Non assegnato
                            </Badge>
                          )}
                        </Td>

                        <Td className="max-w-[280px]">
                          <span className="block truncate">{r.extra.name}</span>
                        </Td>

                        <Td><ScopeBadge scope={r.extra.scope} /></Td>

                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {r.extra.unitCost === undefined
                            ? <span className="text-muted-foreground/60">—</span>
                            : fmtEur(r.extra.unitCost)}
                        </Td>

                        <Td className="whitespace-nowrap text-right tabular-nums">
                          {r.qty === 0
                            ? <span className="text-muted-foreground/60">0</span>
                            : fmtNum(r.qty)}
                        </Td>

                        <Td className="whitespace-nowrap text-right font-medium tabular-nums">
                          {r.value === 0
                            ? <span className="font-normal text-muted-foreground/60">{fmtEur(0)}</span>
                            : fmtEur(r.value)}
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border bg-muted/40">
                      <Td colSpan={4} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Totale {plural(tableRows.length, 'articolo', 'articoli')}
                      </Td>
                      <Td className="whitespace-nowrap text-right font-semibold tabular-nums">{fmtNum(tableQty)}</Td>
                      <Td className="whitespace-nowrap text-right font-semibold tabular-nums">{fmtEur(tableValue)}</Td>
                    </tr>
                  </tfoot>
                </Table>
              </TableScroller>
            )}
          </section>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">
          Magazzini ordinati per <span className="font-medium text-foreground">{CARD_SORT_LABEL[cardSort]}</span>{' '}
          · consumi calcolati su {BASIS_LABEL[basis]}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          (Magazzini filtrati: {fmtNum(cards.length)} | Selezionati: {fmtNum(selectedIds.length)} | Articoli in elenco: {fmtNum(tableRows.length)})
        </span>
      </div>

      <WarehouseForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        warehouses={warehouses}
        items={editingItems}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingRows.length > 1 ? `Elimina ${fmtNum(pendingRows.length)} magazzini` : 'Elimina magazzino'}
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
              Stai per eliminare <span className="font-medium">{pendingRows[0].warehouse.name}</span>.
              L'operazione non è reversibile.
            </p>
          ) : (
            <>
              <p>Stai per eliminare i seguenti magazzini. L'operazione non è reversibile.</p>
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md bg-muted px-3 py-2">
                {pendingRows.map((r) => (
                  <li key={r.warehouse.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate font-medium">{r.warehouse.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {plural(r.items.length, 'articolo', 'articoli')}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {pendingItems.length > 0 && (
            <div className="space-y-2 rounded-md bg-status-pending/10 px-3 py-2.5 ring-1 ring-inset ring-status-pending/25">
              <p className="flex items-start gap-2 font-medium text-status-pending">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                <span>
                  {pendingRows.length === 1
                    ? `A questo magazzino sono collegati ${plural(pendingItems.length, 'articolo extra', 'articoli extra')}`
                    : `A questi magazzini sono collegati ${plural(pendingItems.length, 'articolo extra', 'articoli extra')}`}
                </span>
              </p>
              <ul className="max-h-32 space-y-1 overflow-y-auto">
                {pendingItems.map((r) => (
                  <li key={r.extra.id} className="flex items-baseline justify-between gap-3">
                    <span className="truncate">{r.extra.name}</span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {fmtNum(r.qty)} pz · {fmtEur(r.value)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">
                Gli articoli restano nel catalogo extra, ma perderanno il magazzino assegnato.
              </p>
            </div>
          )}
        </div>
      </Dialog>
    </div>
  )
}
