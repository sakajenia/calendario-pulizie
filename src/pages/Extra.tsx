import * as React from 'react'
import {
  BedDouble, Building2, ChevronDown, ChevronUp, ChevronsUpDown, Download, MoreVertical,
  PackageOpen, Pencil, Plus, Search, ShieldAlert, Trash2, Users, Warehouse as WarehouseIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import { HelpTip } from '@/components/HelpTip'
import {
  Badge, Button, Checkbox, Dialog, Dropdown, DropdownItem, DropdownSeparator, EmptyState,
  Field, Input, MobileRecord, Select, Table, TableScroller, Tabs, Td, Th,
} from '@/components/ui'
import { useToast } from '@/components/feedback/Toast'
import { scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { asDate, downloadFile, fmtDate, fmtEur, fmtNum, norm, plural, toCsv } from '@/lib/format'
import { cn } from '@/lib/utils'
import type {
  BedType, ExtraCatalogItem, ExtraLine, ExtraScope, RequestStatus, Warehouse,
} from '@/types'

const PAGE_SUBTITLE = 'Crea, modifica ed elimina gli extra per appartamenti, letti e persona'

const BED_TYPES: BedType[] = [
  'Letto Matrimoniale',
  'Letto Singolo',
  'Divano letto Matrimoniale',
  'Divano letto Singolo',
  'Letto a Castello',
  'Culla',
]

const SCOPES: ExtraScope[] = ['apartment', 'bed', 'person']

interface ScopeMeta {
  tab: string
  singular: string
  /** Usato nel nome del file CSV: il resto dell'app nomina gli export in italiano. */
  slug: string
  icon: React.ComponentType<{ className?: string }>
  emptyTitle: string
  emptyText: string
  formHint: string
}

const SCOPE_META: Record<ExtraScope, ScopeMeta> = {
  apartment: {
    tab: 'Extra di appartamento',
    singular: 'Extra di appartamento',
    slug: 'appartamento',
    icon: Building2,
    emptyTitle: 'Nessun extra di appartamento',
    emptyText: 'Sono i materiali forniti una volta per intervento: carta igienica, detersivi, sacchi.',
    formHint: 'Conteggiato una volta per richiesta, indipendentemente da ospiti e letti.',
  },
  bed: {
    tab: 'Extra dei letti',
    singular: 'Extra dei letti',
    slug: 'letti',
    icon: BedDouble,
    emptyTitle: 'Nessun extra dei letti',
    emptyText: 'Sono i materiali legati al rifacimento: lenzuola, federe, amenities per tipologia di letto.',
    formHint: 'Conteggiato per ogni letto da rifare delle tipologie selezionate.',
  },
  person: {
    tab: 'Extra per persona',
    singular: 'Extra per persona',
    slug: 'persona',
    icon: Users,
    emptyTitle: 'Nessun extra per persona',
    emptyText: 'Sono i materiali moltiplicati per gli ospiti in arrivo: asciugamani, cialde, cortesie.',
    formHint: 'Conteggiato per ogni ospite in arrivo indicato nella richiesta.',
  },
}

/** Le richieste ancora da chiudere: sono quelle che impegnano davvero il magazzino. */
const OPEN_STATUSES = new Set<RequestStatus>(['in_attesa', 'accettata', 'in_corso', 'da_verificare'])

const CANCELLED_STATUSES = new Set<RequestStatus>(['cancellata', 'cancellata_guesty'])

type Basis = 'open' | 'last30' | 'all'

const BASIS_LABEL: Record<Basis, string> = {
  open: 'richieste aperte',
  last30: 'interventi degli ultimi 30 giorni',
  all: 'tutte le richieste',
}

type SortKey = 'name' | 'cost' | 'warehouse' | 'qty' | 'value'
type SortDir = 'asc' | 'desc'

const uid = () => `ex-${Math.random().toString(36).slice(2, 10)}`

/** Consumo aggregato di un extra, indicizzato per nome normalizzato. */
interface Usage {
  qty: number
  requests: number
}

/** Riga di tabella: l'extra piu' tutto cio' che serve a filtri, ordinamento ed export. */
interface Row {
  extra: ExtraCatalogItem
  warehouse: Warehouse | null
  /** Il magazzino e' referenziato ma non esiste piu' in anagrafica. */
  orphanWarehouse: boolean
  cost: number
  qty: number
  requests: number
  value: number
}

/* -------------------------------------------------------------- intestazioni */

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

/** Le stesse azioni della riga, sia in tabella sia nella scheda su telefono. */
function RowMenu({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <Dropdown
      align="end"
      className="w-[200px]"
      trigger={
        <Button variant="ghost" size="icon" className="size-8" aria-label={`Azioni per ${name}`}>
          <MoreVertical />
        </Button>
      }
    >
      <DropdownItem onClick={onEdit}><Pencil /> Modifica</DropdownItem>
      <DropdownSeparator />
      <DropdownItem danger onClick={onDelete}><Trash2 /> Elimina</DropdownItem>
    </Dropdown>
  )
}

/* --------------------------------------------------------------------- form */

interface Draft {
  name: string
  scope: ExtraScope
  bedTypes: BedType[]
  unitCost: string
  warehouseId: string
}

interface DraftErrors {
  name?: string
  unitCost?: string
}

const emptyDraft = (scope: ExtraScope): Draft => ({
  name: '', scope, bedTypes: [], unitCost: '', warehouseId: '',
})

/** Accetta sia "1.20" sia "1,20": la tastiera italiana produce la virgola. */
const parseAmount = (v: string) => Number(v.trim().replace(',', '.'))

function ExtraForm({
  open, onClose, initial, defaultScope, catalog, warehouses, usage, basis, onSaved,
}: {
  open: boolean
  onClose: () => void
  initial: ExtraCatalogItem | null
  defaultScope: ExtraScope
  catalog: ExtraCatalogItem[]
  warehouses: Warehouse[]
  usage: Map<string, Usage>
  basis: Basis
  onSaved: (item: ExtraCatalogItem, created: boolean) => void
}) {
  const upsertExtra = useStore((s) => s.upsertExtra)
  const [draft, setDraft] = React.useState<Draft>(() => emptyDraft(defaultScope))
  const [errors, setErrors] = React.useState<DraftErrors>({})

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setDraft(
      initial
        ? {
            name: initial.name,
            scope: initial.scope,
            bedTypes: initial.bedTypes ?? [],
            unitCost: initial.unitCost === undefined ? '' : String(initial.unitCost).replace('.', ','),
            warehouseId: initial.warehouseId ?? '',
          }
        : emptyDraft(defaultScope),
    )
  }, [open, initial, defaultScope])

  const toggleBedType = (t: BedType) =>
    setDraft((d) => ({
      ...d,
      bedTypes: d.bedTypes.includes(t) ? d.bedTypes.filter((x) => x !== t) : [...d.bedTypes, t],
    }))

  const preview = usage.get(norm(draft.name.trim()))
  const amount = parseAmount(draft.unitCost)
  /* La valorizzazione ha senso solo con un importo gia' valido: altrimenti l'anteprima
     mostrerebbe NaN o un valore negativo mentre si sta ancora digitando. */
  const showValue = draft.unitCost.trim() !== '' && Number.isFinite(amount) && amount >= 0

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    const next: DraftErrors = {}

    if (!name) next.name = 'Inserisci un nome'
    else if (catalog.some((x) => x.id !== initial?.id && norm(x.name) === norm(name))) {
      next.name = 'Nome già in uso'
    }

    if (!draft.unitCost.trim()) next.unitCost = 'Inserisci un importo'
    else if (!Number.isFinite(amount) || amount < 0) next.unitCost = 'Inserisci un importo valido'

    setErrors(next)
    if (next.name || next.unitCost) return

    const item: ExtraCatalogItem = {
      id: initial?.id ?? uid(),
      name,
      scope: draft.scope,
      bedTypes: draft.scope === 'bed' && draft.bedTypes.length > 0 ? draft.bedTypes : undefined,
      unitCost: amount,
      warehouseId: draft.warehouseId || undefined,
    }
    upsertExtra(item)
    onSaved(item, !initial)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={initial ? 'Modifica extra' : 'Nuovo extra'}
      description={initial ? `Stai modificando “${initial.name}”.` : PAGE_SUBTITLE}
      footer={
        <>
          <span className="mr-auto text-xs text-muted-foreground">
            {SCOPE_META[draft.scope].formHint}
          </span>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="extra-form">
            {initial ? 'Salva modifiche' : 'Crea extra'}
          </Button>
        </>
      }
    >
      <form id="extra-form" onSubmit={submit} className="space-y-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome extra" error={errors.name}>
            <Input
              value={draft.name}
              placeholder="Lenzuola matrimoniali"
              onChange={(e) => {
                const name = e.target.value
                setDraft((d) => ({ ...d, name }))
                setErrors((x) => ({ ...x, name: undefined }))
              }}
            />
          </Field>

          <Field label="Tipo di extra" hint={SCOPE_META[draft.scope].formHint}>
            <Select
              value={draft.scope}
              onChange={(e) => {
                const scope = e.target.value as ExtraScope
                setDraft((d) => ({ ...d, scope }))
              }}
              options={SCOPES.map((s) => ({ value: s, label: SCOPE_META[s].tab }))}
            />
          </Field>
        </div>

        {draft.scope === 'bed' && (
          <section className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-semibold">Tipologie letto applicabili</h3>
              <span className="text-xs text-muted-foreground">
                {draft.bedTypes.length === 0
                  ? 'Nessuna selezione: vale per tutte le tipologie'
                  : `${fmtNum(draft.bedTypes.length)} di ${fmtNum(BED_TYPES.length)} selezionate`}
              </span>
            </div>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {BED_TYPES.map((t) => {
                const on = draft.bedTypes.includes(t)
                return (
                  <div
                    key={t}
                    onClick={() => toggleBedType(t)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg border px-2.5 py-2 text-sm transition-colors',
                      on ? 'border-primary/45 bg-primary/5' : 'border-border hover:bg-muted',
                    )}
                  >
                    <Checkbox checked={on} onChange={() => toggleBedType(t)} label={t} />
                    <span className="truncate">{t}</span>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Costo unitario"
            error={errors.unitCost}
            hint="Costo di una singola unità, usato per valorizzare il consumo."
          >
            <Input
              value={draft.unitCost}
              inputMode="decimal"
              placeholder="2,40"
              onChange={(e) => {
                const unitCost = e.target.value
                setDraft((d) => ({ ...d, unitCost }))
                setErrors((x) => ({ ...x, unitCost: undefined }))
              }}
            />
          </Field>

          <Field
            label="Magazzino"
            hint={
              warehouses.length === 0
                ? 'Nessun magazzino in anagrafica: creane uno nella sezione Magazzini.'
                : "Dove l'operatore preleva questo materiale."
            }
          >
            <Select
              value={draft.warehouseId}
              disabled={warehouses.length === 0}
              onChange={(e) => {
                const warehouseId = e.target.value
                setDraft((d) => ({ ...d, warehouseId }))
              }}
              options={[
                { value: '', label: 'Nessun magazzino' },
                ...warehouses.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </Field>
        </div>

        <p className="rounded-lg bg-muted px-3 py-2.5 text-xs text-muted-foreground">
          {preview && preview.qty > 0 ? (
            <>
              Su {BASIS_LABEL[basis]} questo nome risulta impegnato per{' '}
              <span className="font-medium text-foreground">{fmtNum(preview.qty)} unità</span> in{' '}
              {plural(preview.requests, 'richiesta', 'richieste')}
              {showValue ? <> · valore {fmtEur(preview.qty * amount)}.</> : '.'}
            </>
          ) : (
            <>
              Nessun consumo su {BASIS_LABEL[basis]} per questo nome: le richieste referenziano gli extra
              per nome, quindi rinominarlo azzera lo storico associato.
            </>
          )}
        </p>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------- pagina */

export default function Extra() {
  const currentUser = useCurrentUser()
  const extraCatalog = useStore((s) => s.extraCatalog)
  const warehouses = useStore((s) => s.warehouses)
  const requests = useStore((s) => s.requests)
  const upsertExtra = useStore((s) => s.upsertExtra)
  const deleteExtra = useStore((s) => s.deleteExtra)
  const toast = useToast()

  const [scope, setScope] = React.useState<ExtraScope>('apartment')
  const [text, setText] = React.useState('')
  const [warehouseFilter, setWarehouseFilter] = React.useState<string>('all')
  const [basis, setBasis] = React.useState<Basis>('open')
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [selected, setSelected] = React.useState<string[]>([])

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null)

  const scoped = React.useMemo(() => scopeRequests(requests, currentUser), [requests, currentUser])

  const usage = React.useMemo(() => {
    const map = new Map<string, Usage>()
    const now = Date.now()
    const floor = now - 30 * 24 * 60 * 60 * 1000

    for (const r of scoped) {
      if (basis === 'open' && !OPEN_STATUSES.has(r.status)) continue
      if (basis === 'last30') {
        // Una richiesta cancellata non e' un intervento: non ha impegnato materiale.
        if (CANCELLED_STATUSES.has(r.status)) continue
        const t = asDate(r.checkOutAt).getTime()
        if (t < floor || t > now) continue
      }

      const seen = new Set<string>()
      const add = (lines: ExtraLine[]) => {
        for (const line of lines) {
          const key = norm(line.name)
          const cur = map.get(key) ?? { qty: 0, requests: 0 }
          cur.qty += line.qty
          if (!seen.has(key)) {
            cur.requests += 1
            seen.add(key)
          }
          map.set(key, cur)
        }
      }

      add(r.perPersonExtras)
      add(r.apartmentExtras)
      for (const bed of r.beds) add(bed.extras)
    }
    return map
  }, [scoped, basis])

  const allRows = React.useMemo<Row[]>(() => {
    const byId = new Map(warehouses.map((w) => [w.id, w]))
    return extraCatalog.map((extra) => {
      const warehouse = extra.warehouseId ? byId.get(extra.warehouseId) ?? null : null
      const cost = extra.unitCost ?? 0
      const u = usage.get(norm(extra.name))
      const qty = u?.qty ?? 0
      return {
        extra,
        warehouse,
        orphanWarehouse: extra.warehouseId !== undefined && warehouse === null,
        cost,
        qty,
        requests: u?.requests ?? 0,
        value: qty * cost,
      }
    })
  }, [extraCatalog, warehouses, usage])

  const counts = React.useMemo(() => {
    const out: Record<ExtraScope, number> = { apartment: 0, bed: 0, person: 0 }
    for (const row of allRows) out[row.extra.scope] += 1
    return out
  }, [allRows])

  const tabRows = React.useMemo(
    () => allRows.filter((r) => r.extra.scope === scope),
    [allRows, scope],
  )

  const rows = React.useMemo(() => {
    const q = norm(text.trim())
    const list = tabRows.filter((row) => {
      if (warehouseFilter === 'none' && row.extra.warehouseId) return false
      if (warehouseFilter !== 'all' && warehouseFilter !== 'none' && row.extra.warehouseId !== warehouseFilter) {
        return false
      }
      if (q) {
        const haystack = `${row.extra.name} ${row.warehouse?.name ?? ''} ${(row.extra.bedTypes ?? []).join(' ')}`
        if (!norm(haystack).includes(q)) return false
      }
      return true
    })

    const compare = (a: Row, b: Row): number => {
      switch (sortKey) {
        case 'cost': return a.cost - b.cost
        case 'warehouse': return (a.warehouse?.name ?? '').localeCompare(b.warehouse?.name ?? '', 'it')
        case 'qty': return a.qty - b.qty
        case 'value': return a.value - b.value
        default: return a.extra.name.localeCompare(b.extra.name, 'it')
      }
    }

    return list.sort((a, b) => {
      const r = compare(a, b) || a.extra.name.localeCompare(b.extra.name, 'it')
      return sortDir === 'asc' ? r : -r
    })
  }, [tabRows, text, warehouseFilter, sortKey, sortDir])

  const visibleIds = React.useMemo(() => new Set(rows.map((r) => r.extra.id)), [rows])
  const selectedVisible = React.useMemo(
    () => selected.filter((id) => visibleIds.has(id)),
    [selected, visibleIds],
  )

  const shownQty = rows.reduce((sum, r) => sum + r.qty, 0)
  const shownValue = rows.reduce((sum, r) => sum + r.value, 0)
  const tabQty = tabRows.reduce((sum, r) => sum + r.qty, 0)
  const tabValue = tabRows.reduce((sum, r) => sum + r.value, 0)
  const catalogValue = allRows.reduce((sum, r) => sum + r.value, 0)
  const hasFilters = text.trim() !== '' || warehouseFilter !== 'all'
  const isBedTab = scope === 'bed'
  const meta = SCOPE_META[scope]
  const editing = editingId ? extraCatalog.find((e) => e.id === editingId) ?? null : null

  const sortBy = (k: SortKey) => {
    if (k === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortKey(k)
    setSortDir(k === 'name' || k === 'warehouse' ? 'asc' : 'desc')
  }

  const changeScope = (s: ExtraScope) => {
    setScope(s)
    setSelected([])
  }

  const clearFilters = () => {
    setText('')
    setWarehouseFilter('all')
  }

  const toggleOne = (id: string) =>
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]))

  const toggleAll = () =>
    setSelected((cur) =>
      selectedVisible.length === rows.length && rows.length > 0
        ? cur.filter((id) => !visibleIds.has(id))
        : [...cur.filter((id) => !visibleIds.has(id)), ...rows.map((r) => r.extra.id)],
    )

  const openNew = () => {
    setEditingId(null)
    setFormOpen(true)
  }

  const openEdit = (id: string) => {
    setEditingId(id)
    setFormOpen(true)
  }

  const assignWarehouse = (warehouseId: string) => {
    const before = extraCatalog.filter((e) => selectedVisible.includes(e.id))
    for (const item of before) upsertExtra({ ...item, warehouseId: warehouseId || undefined })
    setSelected([])
    const target = warehouses.find((w) => w.id === warehouseId)
    toast({
      title: target
        ? `${plural(before.length, 'extra assegnato', 'extra assegnati')} a ${target.name}`
        : `Magazzino rimosso da ${plural(before.length, 'extra', 'extra')}`,
      action: { label: 'Annulla', onClick: () => before.forEach(upsertExtra) },
    })
  }

  const onSaved = (item: ExtraCatalogItem, created: boolean) => {
    if (item.scope !== scope) changeScope(item.scope)
    toast({ title: created ? 'Extra creato' : 'Extra aggiornato', description: item.name })
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const removed = extraCatalog.filter((e) => pendingDelete.includes(e.id))
    for (const id of pendingDelete) deleteExtra(id)
    setSelected((cur) => cur.filter((id) => !pendingDelete.includes(id)))
    setPendingDelete(null)
    toast({
      title: plural(removed.length, 'extra eliminato', 'extra eliminati'),
      description: 'Puoi annullare finché questa notifica resta a schermo.',
      action: { label: 'Annulla', onClick: () => removed.forEach(upsertExtra) },
    })
  }

  const exportCsv = () => {
    const data = rows.map((row) => ({
      Nome: row.extra.name,
      Tipo: SCOPE_META[row.extra.scope].tab,
      'Tipologie letto': (row.extra.bedTypes ?? []).join(' | '),
      'Costo unitario': row.cost.toFixed(2).replace('.', ','),
      Magazzino: row.warehouse?.name ?? '',
      'Consumo stimato': row.qty,
      'Richieste coinvolte': row.requests,
      Valore: row.value.toFixed(2).replace('.', ','),
      'Base di calcolo': BASIS_LABEL[basis],
    }))
    downloadFile(`extra-${meta.slug}-${fmtDate(new Date())}.csv`, toCsv(data))
  }

  const deleteRows = pendingDelete
    ? allRows.filter((r) => pendingDelete.includes(r.extra.id))
    : []

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex min-h-full flex-col">
        <PageHeader title="Extra" />
        <EmptyState
          icon={ShieldAlert}
          title="Area riservata agli amministratori"
          description="Il catalogo degli extra e i costi di magazzino sono gestiti solo dagli account con ruolo Amministratore."
        />
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title={<span className="inline-flex items-center gap-1.5">Extra<HelpTip term="extra" /></span>}
        subtitle={
          <span className="block space-y-0.5">
            <span className="block">{PAGE_SUBTITLE}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <span>{fmtNum(extraCatalog.length)} extra in catalogo</span>
              <span aria-hidden className="text-border">|</span>
              <span>{plural(warehouses.length, 'magazzino', 'magazzini')}</span>
              <span aria-hidden className="text-border">|</span>
              <span>Valore impegnato {fmtEur(catalogValue)}</span>
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <Download />
              <span className="hidden sm:inline">Esporta CSV</span>
            </Button>
            <Button onClick={openNew}>
              <Plus />
              Nuovo <span className="hidden sm:inline">extra</span>
            </Button>
          </>
        }
      />

      <div className="shrink-0 space-y-3 border-b border-border bg-card px-5 py-3">
        <Tabs
          value={scope}
          onChange={changeScope}
          items={SCOPES.map((s) => ({ value: s, label: SCOPE_META[s].tab, count: counts[s] }))}
        />

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtra per nome, magazzino o tipologia"
              aria-label="Filtra per nome, magazzino o tipologia"
              className="h-9 pl-9"
            />
          </div>

          <div className="w-full sm:w-56">
            <Select
              value={warehouseFilter}
              onChange={(e) => setWarehouseFilter(e.target.value)}
              aria-label="Filtra per magazzino"
              className="h-9"
              options={[
                { value: 'all', label: 'Tutti i magazzini' },
                { value: 'none', label: 'Senza magazzino' },
                ...warehouses.map((w) => ({ value: w.id, label: w.name })),
              ]}
            />
          </div>

          <div className="w-full sm:w-64">
            <Select
              value={basis}
              onChange={(e) => setBasis(e.target.value as Basis)}
              aria-label="Base di calcolo del consumo"
              className="h-9"
              options={(Object.keys(BASIS_LABEL) as Basis[]).map((b) => ({
                value: b,
                label: `Consumo su ${BASIS_LABEL[b]}`,
              }))}
            />
          </div>

          {hasFilters && (
            <Button variant="link" size="sm" onClick={clearFilters}>
              Cancella filtri
            </Button>
          )}
        </div>
      </div>

      {selectedVisible.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedVisible.length, 'extra selezionato', 'extra selezionati')}
          </span>

          <Dropdown
            align="start"
            trigger={
              <Button variant="outline" size="sm" disabled={warehouses.length === 0}>
                <WarehouseIcon />
                Assegna magazzino
              </Button>
            }
          >
            {warehouses.map((w) => (
              <DropdownItem key={w.id} onClick={() => assignWarehouse(w.id)}>
                <WarehouseIcon /> {w.name}
              </DropdownItem>
            ))}
            <DropdownSeparator />
            <DropdownItem onClick={() => assignWarehouse('')}>Rimuovi magazzino</DropdownItem>
          </Dropdown>

          <Button variant="destructive" size="sm" onClick={() => setPendingDelete(selectedVisible)}>
            <Trash2 />
            Elimina selezionati
          </Button>

          {selectedVisible.length < rows.length && (
            <Button variant="link" size="sm" onClick={() => setSelected(rows.map((r) => r.extra.id))}>
              Seleziona tutti i {fmtNum(rows.length)} filtrati
            </Button>
          )}

          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected([])}>
            Annulla selezione
          </Button>
        </div>
      )}

      <TableScroller innerClassName="overflow-x-auto">
        {extraCatalog.length === 0 ? (
          <EmptyState
            icon={PackageOpen}
            title="Nessun extra in catalogo"
            description="Il catalogo raccoglie i materiali forniti durante gli interventi: costo unitario, magazzino di prelievo e tipologie di letto a cui si applicano."
            action={<Button onClick={openNew}><Plus /> Nuovo extra</Button>}
          />
        ) : tabRows.length === 0 ? (
          <EmptyState
            icon={meta.icon}
            title={meta.emptyTitle}
            description={meta.emptyText}
            action={<Button onClick={openNew}><Plus /> Nuovo extra</Button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="Nessun extra corrisponde ai filtri"
            description="Cambia il testo di ricerca o il magazzino selezionato per vedere gli altri extra di questa categoria."
            action={<Button variant="outline" onClick={clearFilters}>Cancella filtri</Button>}
          />
        ) : (
          <>
            {/* Sotto md la tabella mostrerebbe solo il nome dell'articolo. */}
            <div className="stagger space-y-3 p-4 md:hidden">
              {rows.map((r) => (
                <MobileRecord
                  key={r.extra.id}
                  title={r.extra.name}
                  subtitle={r.warehouse?.name ?? (r.orphanWarehouse ? 'Magazzino rimosso' : 'Non assegnato')}
                  selected={selected.includes(r.extra.id)}
                  onClick={() => openEdit(r.extra.id)}
                  badge={
                    <Checkbox
                      padded
                      checked={selected.includes(r.extra.id)}
                      onChange={() => toggleOne(r.extra.id)}
                      label={`Seleziona ${r.extra.name}`}
                    />
                  }
                  action={
                    <RowMenu
                      name={r.extra.name}
                      onEdit={() => openEdit(r.extra.id)}
                      onDelete={() => setPendingDelete([r.extra.id])}
                    />
                  }
                  fields={[
                    { label: 'Costo unitario', value: fmtEur(r.cost) },
                    { label: 'Impegnato', value: fmtNum(r.qty) },
                    { label: 'Richieste', value: fmtNum(r.requests) },
                    { label: 'Valore', value: fmtEur(r.value) },
                  ]}
                />
              ))}
            </div>

          <Table className={cn('hidden md:table', isBedTab ? 'min-w-[1080px]' : 'min-w-[880px]')}>
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    checked={selectedVisible.length === rows.length}
                    indeterminate={selectedVisible.length > 0 && selectedVisible.length < rows.length}
                    onChange={toggleAll}
                    label="Seleziona tutte le righe visualizzate"
                  />
                </Th>
                <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                <SortHeader label="Nome" sortKey="name" current={sortKey} dir={sortDir} onSort={sortBy} />
                {isBedTab && <Th className="min-w-[280px]">Tipologie letto applicabili</Th>}
                <SortHeader
                  label="Costo unitario" sortKey="cost" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
                <SortHeader label="Magazzino" sortKey="warehouse" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader
                  label="Consumo stimato" sortKey="qty" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
                <SortHeader
                  label="Valore" sortKey="value" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => {
                const isSelected = selected.includes(row.extra.id)
                const types = row.extra.bedTypes ?? []
                return (
                  <tr
                    key={row.extra.id}
                    className={cn(
                      'border-b border-border/60 transition-colors last:border-0',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(row.extra.id)}
                        label={`Seleziona ${row.extra.name}`}
                      />
                    </Td>

                    <Td>
                      <RowMenu
                        name={row.extra.name}
                        onEdit={() => openEdit(row.extra.id)}
                        onDelete={() => setPendingDelete([row.extra.id])}
                      />
                    </Td>

                    <Td className="font-medium">{row.extra.name}</Td>

                    {isBedTab && (
                      <Td>
                        {types.length === 0 ? (
                          <span className="text-xs text-muted-foreground">Tutte le tipologie</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {types.map((t) => (
                              <Badge key={t} className="bg-muted text-muted-foreground">{t}</Badge>
                            ))}
                          </div>
                        )}
                      </Td>
                    )}

                    <Td className="text-right tabular-nums">{fmtEur(row.cost)}</Td>

                    <Td>
                      {row.orphanWarehouse ? (
                        <Badge className="bg-status-pending/12 text-status-pending ring-1 ring-inset ring-status-pending/25">
                          Magazzino rimosso
                        </Badge>
                      ) : row.warehouse ? (
                        <span className="inline-flex items-center gap-1.5">
                          <WarehouseIcon className="size-3.5 text-muted-foreground" />
                          {row.warehouse.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Non assegnato</span>
                      )}
                    </Td>

                    <Td className="text-right">
                      <span className="block tabular-nums">{fmtNum(row.qty)}</span>
                      <span className="block text-xs text-muted-foreground">
                        {row.requests === 0
                          ? 'mai richiesto'
                          : `in ${plural(row.requests, 'richiesta', 'richieste')}`}
                      </span>
                    </Td>

                    <Td className="text-right font-medium tabular-nums">{fmtEur(row.value)}</Td>
                  </tr>
                )
              })}
            </tbody>

            <tfoot>
              <tr className="border-t-2 border-border bg-muted/40">
                <Td colSpan={isBedTab ? 6 : 5} className="text-sm font-semibold">
                  Totale {meta.singular.toLowerCase()}
                  <span className="ml-2 font-normal text-xs text-muted-foreground">
                    {fmtNum(rows.length)} di {fmtNum(tabRows.length)} · consumo su {BASIS_LABEL[basis]}
                  </span>
                </Td>
                <Td className="text-right">
                  <span className="block font-semibold tabular-nums">{fmtNum(shownQty)}</span>
                  {hasFilters && (
                    <span className="block text-xs text-muted-foreground">di {fmtNum(tabQty)}</span>
                  )}
                </Td>
                <Td className="text-right">
                  <span className="block font-semibold tabular-nums text-brand">{fmtEur(shownValue)}</span>
                  {hasFilters && (
                    <span className="block text-xs text-muted-foreground">di {fmtEur(tabValue)}</span>
                  )}
                </Td>
              </tr>
            </tfoot>
          </Table>
          </>
        )}
      </TableScroller>

      <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 md:sticky md:bottom-0 md:z-10">
        <span className="text-sm text-muted-foreground">
          {meta.tab} · valore complessivo{' '}
          <span className="font-medium text-foreground">{fmtEur(tabValue)}</span> su {BASIS_LABEL[basis]}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          (Extra totali: {fmtNum(extraCatalog.length)} | Nel tab: {fmtNum(tabRows.length)} | Visualizzati:{' '}
          {fmtNum(rows.length)} | Selezionati: {fmtNum(selectedVisible.length)})
        </span>
      </div>

      <ExtraForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        defaultScope={scope}
        catalog={extraCatalog}
        warehouses={warehouses}
        usage={usage}
        basis={basis}
        onSaved={onSaved}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        size="sm"
        title={deleteRows.length > 1 ? 'Elimina extra selezionati' : 'Elimina extra'}
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
          </>
        }
      >
        {deleteRows.length > 0 && (
          <div className="space-y-3 text-sm">
            <p>
              {deleteRows.length === 1 ? (
                <>
                  Stai per eliminare <span className="font-medium">{deleteRows[0].extra.name}</span> dal
                  catalogo. Potrai annullare dalla notifica per qualche secondo.
                </>
              ) : (
                <>
                  Stai per eliminare <span className="font-medium">{fmtNum(deleteRows.length)} extra</span> dal
                  catalogo. Potrai annullare dalla notifica per qualche secondo.
                </>
              )}
            </p>

            {deleteRows.length > 1 && (
              <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                {deleteRows.map((r) => (
                  <li key={r.extra.id} className="flex items-center justify-between gap-3 px-1 text-xs">
                    <span className="truncate">{r.extra.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">{fmtEur(r.value)}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* Le quantita' si sommano tra extra diversi; i conteggi di richieste no
                (la stessa richiesta puo' usarne piu' d'uno), quindi qui si mostrano le unita'. */}
            <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
              {deleteRows.some((r) => r.qty > 0) ? (
                <>
                  Su {BASIS_LABEL[basis]} sono impegnate{' '}
                  {fmtNum(deleteRows.reduce((sum, r) => sum + r.qty, 0))} unità in totale: le righe già
                  inserite restano invariate, ma{' '}
                  {deleteRows.length === 1
                    ? "l'extra non sarà più selezionabile né valorizzato"
                    : 'gli extra non saranno più selezionabili né valorizzati'}
                  .
                </>
              ) : (
                <>
                  Nessuna richiesta su {BASIS_LABEL[basis]} impegna{' '}
                  {deleteRows.length === 1 ? 'questo extra' : 'questi extra'}.
                </>
              )}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
