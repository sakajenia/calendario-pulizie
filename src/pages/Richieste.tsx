import * as React from 'react'
import {
  ChevronDown, ChevronLeft, ChevronRight, ChevronUp, ChevronsUpDown, ClipboardList,
  Download, Eye, MoreVertical, Pencil, Plus, RefreshCw, SlidersHorizontal, Trash2, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Checkbox, Dialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Field, Input, Select, Table, TableScroller, Td, Th, Tooltip,
} from '@/components/ui'
import { StatusChip, StatusDot } from '@/components/StatusChip'
import { RequestDetail } from '@/components/requests/RequestDetail'
import { RequestForm } from '@/components/requests/RequestForm'
import { scopeApartments, scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { asDate, downloadFile, fmtDate, fmtDateTime, fmtNum, norm, plural, toCsv } from '@/lib/format'
import { REQUEST_STATUSES, STATUS_META, type CleaningRequest, type RequestStatus } from '@/types'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 25

type DateField = 'checkOutAt' | 'checkInAt' | 'createdAt'
type SortKey = 'createdAt' | 'checkOutAt' | 'checkInAt' | 'checkInPeople' | 'status'
type SortDir = 'asc' | 'desc'

const DATE_FIELD_LABEL: Record<DateField, string> = {
  checkOutAt: 'Check-out',
  checkInAt: 'Check-in',
  createdAt: 'Creazione',
}

/** Riga della tabella: la richiesta più i campi dell'appartamento usati per filtri e ordinamento. */
interface Row {
  req: CleaningRequest
  name: string
  address: string
  district: string
  city: string
}

const ts = (v: string | null): number | null => {
  if (!v) return null
  const t = asDate(v).getTime()
  return Number.isNaN(t) ? null : t
}

/* --------------------------------------------------------------- intestazioni */

function SortHeader({
  label, sortKey, current, dir, onSort, className,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = current === sortKey
  return (
    <Th className={className}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
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

/* -------------------------------------------------------------- menu di riga */

function RowMenu({
  openUp, onView, onEdit, onStatus, onDelete,
}: {
  openUp: boolean
  onView: () => void
  onEdit: () => void
  onStatus: (s: RequestStatus) => void
  onDelete: () => void
}) {
  const [statusOpen, setStatusOpen] = React.useState(false)

  return (
    <Dropdown
      align="start"
      className={cn('w-[220px]', openUp && 'bottom-full mb-1 mt-0')}
      trigger={
        <Button variant="ghost" size="icon" className="size-7" aria-label="Azioni richiesta" onClick={() => setStatusOpen(false)}>
          <MoreVertical />
        </Button>
      }
    >
      <DropdownItem onClick={onView}><Eye /> Visualizza</DropdownItem>
      <DropdownItem onClick={onEdit}><Pencil /> Modifica</DropdownItem>
      <DropdownSeparator />

      {/* Lo stop qui tiene aperto il menu mentre si espande il sotto-menu stati. */}
      <div onClick={(e) => e.stopPropagation()}>
        <DropdownItem onClick={() => setStatusOpen((v) => !v)}>
          <RefreshCw /> Cambia stato
          <ChevronRight className={cn('ml-auto transition-transform', statusOpen && 'rotate-90')} />
        </DropdownItem>
      </div>

      {statusOpen && (
        <div className="ml-3 border-l border-border pl-1">
          {REQUEST_STATUSES.map((s) => (
            <DropdownItem key={s} onClick={() => onStatus(s)}>
              <StatusDot status={s} />
              <span className="truncate">{STATUS_META[s].label}</span>
            </DropdownItem>
          ))}
        </div>
      )}

      <DropdownSeparator />
      <DropdownItem danger onClick={onDelete}><Trash2 /> Elimina</DropdownItem>
    </Dropdown>
  )
}

/* ----------------------------------------------------------- pannello filtri */

function FiltersDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const user = useCurrentUser()
  const allApartments = useStore((s) => s.apartments)
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const apartments = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-foreground/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Filtri richieste"
        className="absolute inset-y-0 right-0 flex w-80 max-w-full flex-col border-l border-border bg-card shadow-2xl animate-slide-up"
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="font-display text-lg font-bold tracking-tight text-primary">Filtri</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi filtri"><X /></Button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-5">
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Filtri per campo
            </h3>
            <Field label="Indirizzo" hint="Cerca per indirizzo, quartiere, città o nome appartamento">
              <Input
                value={filters.text}
                placeholder="Es. Via del Corso"
                onChange={(e) => setFilters({ text: e.target.value })}
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Filtro per stato
            </h3>
            <Field label="Stato">
              <Select
                value={filters.status}
                onChange={(e) => setFilters({ status: e.target.value as RequestStatus | 'all' })}
                options={[
                  { value: 'all', label: 'Tutti gli stati' },
                  ...REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
                ]}
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Filtri per data
            </h3>
            <Field label="Tipo filtro data">
              <Select
                value={filters.dateField}
                onChange={(e) => setFilters({ dateField: e.target.value as DateField })}
                options={(Object.keys(DATE_FIELD_LABEL) as DateField[]).map((k) => ({
                  value: k, label: DATE_FIELD_LABEL[k],
                }))}
              />
            </Field>
            <Field label="Da">
              <Input
                type="datetime-local"
                value={filters.from ?? ''}
                onChange={(e) => setFilters({ from: e.target.value || null })}
              />
            </Field>
            <Field label="A">
              <Input
                type="datetime-local"
                value={filters.to ?? ''}
                onChange={(e) => setFilters({ to: e.target.value || null })}
              />
            </Field>
          </section>

          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
              Appartamento
            </h3>
            <Field label="Appartamento">
              <Select
                value={filters.apartmentId}
                onChange={(e) => setFilters({ apartmentId: e.target.value })}
                options={[
                  { value: 'all', label: 'Tutti gli appartamenti' },
                  ...apartments.map((a) => ({ value: a.id, label: a.name })),
                ]}
              />
            </Field>
          </section>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={resetFilters}>Cancella filtri</Button>
          <Button onClick={onClose}>Applica</Button>
        </div>
      </aside>
    </div>
  )
}

/* --------------------------------------------------------------------- pagina */

export default function Richieste() {
  const user = useCurrentUser()
  const allRequests = useStore((s) => s.requests)
  const allApartments = useStore((s) => s.apartments)
  const filters = useStore((s) => s.filters)
  const setFilters = useStore((s) => s.setFilters)
  const resetFilters = useStore((s) => s.resetFilters)
  const setRequestStatus = useStore((s) => s.setRequestStatus)
  const deleteRequests = useStore((s) => s.deleteRequests)

  const [sortKey, setSortKey] = React.useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')
  const [page, setPage] = React.useState(1)
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [filtersOpen, setFiltersOpen] = React.useState(false)
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null)

  const closeFilters = React.useCallback(() => setFiltersOpen(false), [])

  const scoped = React.useMemo(() => scopeRequests(allRequests, user), [allRequests, user])
  const apartments = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])

  const rows = React.useMemo<Row[]>(() => {
    const byId = new Map(apartments.map((a) => [a.id, a]))
    return scoped.map((req) => {
      const apartment = byId.get(req.apartmentId)
      return {
        req,
        name: apartment?.name ?? req.spotApartmentName ?? 'Appartamento spot',
        address: apartment?.address ?? req.spotApartmentName ?? '—',
        district: apartment?.district ?? '—',
        city: apartment?.city ?? '—',
      }
    })
  }, [scoped, apartments])

  /** Tutti i filtri tranne lo stato: serve anche per i conteggi delle pillole. */
  const baseRows = React.useMemo(() => {
    const q = norm(filters.text.trim())
    const from = ts(filters.from)
    const to = ts(filters.to)
    return rows.filter((r) => {
      if (filters.apartmentId !== 'all' && r.req.apartmentId !== filters.apartmentId) return false
      if (q && !norm(`${r.address} ${r.district} ${r.city} ${r.name}`).includes(q)) return false
      if (from !== null || to !== null) {
        const t = asDate(r.req[filters.dateField]).getTime()
        if (from !== null && t < from) return false
        if (to !== null && t > to) return false
      }
      return true
    })
  }, [rows, filters.text, filters.apartmentId, filters.dateField, filters.from, filters.to])

  const statusCounts = React.useMemo(() => {
    const acc = {} as Record<RequestStatus, number>
    for (const s of REQUEST_STATUSES) acc[s] = 0
    for (const r of baseRows) acc[r.req.status] += 1
    return acc
  }, [baseRows])

  const filtered = React.useMemo(() => {
    const list = filters.status === 'all'
      ? baseRows.slice()
      : baseRows.filter((r) => r.req.status === filters.status)

    const primary = (a: Row, b: Row): number => {
      switch (sortKey) {
        case 'status':
          return REQUEST_STATUSES.indexOf(a.req.status) - REQUEST_STATUSES.indexOf(b.req.status)
        case 'checkInPeople':
          return a.req.checkInPeople - b.req.checkInPeople
        default:
          return asDate(a.req[sortKey]).getTime() - asDate(b.req[sortKey]).getTime()
      }
    }

    return list.sort((a, b) => {
      const r = primary(a, b)
      if (r !== 0) return sortDir === 'asc' ? r : -r
      return a.req.id < b.req.id ? -1 : 1
    })
  }, [baseRows, filters.status, sortKey, sortDir])

  React.useEffect(() => { setPage(1) }, [filters, sortKey, sortDir])

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const current = Math.min(page, pageCount)
  const pageRows = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE)

  const selectedIds = React.useMemo(
    () => filtered.filter((r) => selected.has(r.req.id)).map((r) => r.req.id),
    [filtered, selected],
  )
  const pageIds = pageRows.map((r) => r.req.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selected.has(id))
  const somePageSelected = !allPageSelected && pageIds.some((id) => selected.has(id))

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const togglePage = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of pageIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'createdAt' ? 'desc' : 'asc')
    }
  }

  const activeChips: { key: string; label: string; clear: () => void }[] = []
  if (filters.text.trim()) {
    activeChips.push({ key: 'text', label: `Indirizzo: ${filters.text.trim()}`, clear: () => setFilters({ text: '' }) })
  }
  if (filters.apartmentId !== 'all') {
    const apt = apartments.find((a) => a.id === filters.apartmentId)
    activeChips.push({
      key: 'apt',
      label: `Appartamento: ${apt?.name ?? filters.apartmentId}`,
      clear: () => setFilters({ apartmentId: 'all' }),
    })
  }
  if (filters.from) {
    activeChips.push({
      key: 'from',
      label: `${DATE_FIELD_LABEL[filters.dateField]} da ${fmtDateTime(filters.from)}`,
      clear: () => setFilters({ from: null }),
    })
  }
  if (filters.to) {
    activeChips.push({
      key: 'to',
      label: `${DATE_FIELD_LABEL[filters.dateField]} a ${fmtDateTime(filters.to)}`,
      clear: () => setFilters({ to: null }),
    })
  }

  const activeCount = activeChips.length + (filters.status === 'all' ? 0 : 1)

  const rangeText = filters.from || filters.to
    ? [
        DATE_FIELD_LABEL[filters.dateField],
        filters.from ? `dal ${fmtDateTime(filters.from)}` : null,
        filters.to ? `al ${fmtDateTime(filters.to)}` : null,
      ].filter(Boolean).join(' ')
    : `${DATE_FIELD_LABEL[filters.dateField]} · nessun intervallo impostato`

  const detail = detailId ? scoped.find((r) => r.id === detailId) ?? null : null
  const editing = editingId ? scoped.find((r) => r.id === editingId) ?? null : null

  const openEdit = (r: CleaningRequest) => {
    setDetailId(null)
    setEditingId(r.id)
    setFormOpen(true)
  }

  const exportCsv = () => {
    const data = filtered.map((r) => ({
      Indirizzo: r.address,
      'Cap/Quartiere': r.district,
      'Città': r.city,
      Appartamento: r.name,
      Creazione: fmtDateTime(r.req.createdAt),
      Stato: STATUS_META[r.req.status].label,
      'Check-out': fmtDateTime(r.req.checkOutAt),
      'Check-in': fmtDateTime(r.req.checkInAt),
      'Ospiti in arrivo': r.req.checkInPeople,
      'Letti da preparare': r.req.beds.length,
      Note: (r.req.notes ?? '').replace(/\s+/g, ' ').trim(),
    }))
    downloadFile(`richieste-${fmtDate(new Date())}.csv`, toCsv(data))
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    deleteRequests(pendingDelete)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of pendingDelete) next.delete(id)
      return next
    })
    if (pendingDelete.includes(detailId ?? '')) setDetailId(null)
    setPendingDelete(null)
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Richieste"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{rangeText}</span>
            <span aria-hidden className="text-border">|</span>
            <span>{fmtNum(filtered.length)} di {plural(scoped.length, 'richiesta', 'richieste')}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setFiltersOpen(true)}>
              <SlidersHorizontal />
              Filtri
              {activeCount > 0 && (
                <span className="grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                  {activeCount}
                </span>
              )}
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download />
              Esporta CSV
            </Button>
            <Button onClick={() => { setEditingId(null); setFormOpen(true) }}>
              <Plus />
              Nuova richiesta
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-card px-5 py-2.5">
        <button
          type="button"
          onClick={() => setFilters({ status: 'all' })}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
            filters.status === 'all'
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:text-foreground',
          )}
        >
          Tutte
          <span className="tabular-nums opacity-70">{fmtNum(baseRows.length)}</span>
        </button>

        {REQUEST_STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilters({ status: filters.status === s ? 'all' : s })}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
              filters.status === s
                ? 'border-primary/40 bg-primary/10 text-primary'
                : 'border-border text-muted-foreground hover:text-foreground',
              statusCounts[s] === 0 && filters.status !== s && 'opacity-50',
            )}
          >
            <StatusDot status={s} />
            {STATUS_META[s].label}
            <span className="tabular-nums opacity-70">{fmtNum(statusCounts[s])}</span>
          </button>
        ))}
      </div>

      {activeChips.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-5 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Filtri attivi
          </span>
          {activeChips.map((c) => (
            <Badge key={c.key} className="bg-card text-foreground ring-1 ring-inset ring-border">
              {c.label}
              <button type="button" onClick={c.clear} aria-label={`Rimuovi filtro ${c.label}`} className="focus-ring rounded">
                <X className="size-3" />
              </button>
            </Badge>
          ))}
          <Button variant="link" size="sm" onClick={resetFilters}>Cancella filtri</Button>
        </div>
      )}

      {selectedIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedIds.length, 'richiesta selezionata', 'richieste selezionate')}
          </span>

          <div className="w-48">
            <Select
              value=""
              aria-label="Cambia stato delle richieste selezionate"
              onChange={(e) => {
                const v = e.target.value
                if (v) setRequestStatus(selectedIds, v as RequestStatus)
              }}
              className="h-9"
              options={[
                { value: '', label: 'Cambia stato…' },
                ...REQUEST_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label })),
              ]}
            />
          </div>

          <Button variant="destructive" size="sm" onClick={() => setPendingDelete(selectedIds)}>
            <Trash2 />
            Elimina selezionate
          </Button>

          {selectedIds.length < filtered.length && (
            <Button
              variant="link"
              size="sm"
              onClick={() => setSelected(new Set(filtered.map((r) => r.req.id)))}
            >
              Seleziona tutte le {fmtNum(filtered.length)} filtrate
            </Button>
          )}

          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Annulla selezione
          </Button>
        </div>
      )}

      <TableScroller className="flex-1" innerClassName="min-h-0 flex-1">
        {pageRows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={scoped.length === 0 ? 'Nessuna richiesta' : 'Nessun risultato con questi filtri'}
            description={
              scoped.length === 0
                ? 'Crea la prima richiesta di pulizia per iniziare a pianificare i turnover.'
                : 'Allarga l’intervallo di date oppure azzera i filtri per vedere tutte le richieste.'
            }
            action={
              scoped.length === 0
                ? <Button onClick={() => { setEditingId(null); setFormOpen(true) }}><Plus /> Nuova richiesta</Button>
                : <Button variant="outline" onClick={resetFilters}>Cancella filtri</Button>
            }
          />
        ) : (
          <Table className="min-w-[1240px]">
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    checked={allPageSelected}
                    indeterminate={somePageSelected}
                    onChange={togglePage}
                    label="Seleziona tutte le righe della pagina"
                  />
                </Th>
                <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                <Th>Indirizzo</Th>
                <Th>Cap/Quartiere</Th>
                <Th>Città</Th>
                <SortHeader label="Creazione" sortKey="createdAt" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader label="Stato" sortKey="status" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader label="Check-out" sortKey="checkOutAt" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader label="Check-in" sortKey="checkInAt" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader
                  label="Ospiti in arrivo" sortKey="checkInPeople" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
                <Th className="text-right">Letti da preparare</Th>
                <Th className="w-[260px] min-w-[200px]">Note</Th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r, i) => {
                const isSelected = selected.has(r.req.id)
                return (
                  <tr
                    key={r.req.id}
                    onClick={() => setDetailId(r.req.id)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 transition-colors last:border-0',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(r.req.id)}
                        label={`Seleziona richiesta ${r.address}`}
                      />
                    </Td>

                    <Td onClick={(e) => e.stopPropagation()}>
                      <RowMenu
                        openUp={pageRows.length > 6 && i >= pageRows.length - 4}
                        onView={() => setDetailId(r.req.id)}
                        onEdit={() => openEdit(r.req)}
                        onStatus={(s) => setRequestStatus([r.req.id], s)}
                        onDelete={() => setPendingDelete([r.req.id])}
                      />
                    </Td>

                    <Td className="max-w-[260px]">
                      <div className="truncate font-medium">{r.address}</div>
                      {r.name !== r.address && (
                        <div className="truncate text-xs text-muted-foreground">{r.name}</div>
                      )}
                    </Td>

                    <Td className="whitespace-nowrap text-muted-foreground">{r.district}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{r.city}</Td>

                    <Td className="whitespace-nowrap tabular-nums text-xs text-muted-foreground">
                      {fmtDateTime(r.req.createdAt)}
                    </Td>

                    <Td><StatusChip status={r.req.status} size="sm" /></Td>

                    <Td className="whitespace-nowrap tabular-nums text-xs">{fmtDateTime(r.req.checkOutAt)}</Td>
                    <Td className="whitespace-nowrap tabular-nums text-xs">{fmtDateTime(r.req.checkInAt)}</Td>

                    <Td className="text-right tabular-nums font-medium">{fmtNum(r.req.checkInPeople)}</Td>

                    <Td className="text-right tabular-nums font-medium">
                      {r.req.beds.length === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <Tooltip label={r.req.beds.map((b) => b.type).join(', ')}>
                          <span>{fmtNum(r.req.beds.length)}</span>
                        </Tooltip>
                      )}
                    </Td>

                    <Td className="max-w-[280px]">
                      {r.req.notes ? (
                        <p className="line-clamp-2 text-xs text-muted-foreground">{r.req.notes}</p>
                      ) : (
                        <span className="text-xs text-muted-foreground/60">—</span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </TableScroller>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline" size="icon" aria-label="Pagina precedente"
            disabled={current <= 1} onClick={() => setPage(current - 1)}
          >
            <ChevronLeft />
          </Button>
          <span className="text-sm font-medium tabular-nums">Pagina {current} di {pageCount}</span>
          <Button
            variant="outline" size="icon" aria-label="Pagina successiva"
            disabled={current >= pageCount} onClick={() => setPage(current + 1)}
          >
            <ChevronRight />
          </Button>
        </div>

        <span className="text-sm tabular-nums text-muted-foreground">
          (Richieste totali: {fmtNum(filtered.length)} | Selezionate: {fmtNum(selectedIds.length)})
        </span>
      </div>

      <FiltersDrawer open={filtersOpen} onClose={closeFilters} />

      <RequestDetail
        request={detail}
        open={detail !== null}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
      />

      <RequestForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.length === 1 ? 'Elimina richiesta' : 'Elimina richieste'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
          </>
        }
      >
        <p className="text-sm">
          Stai per eliminare {plural(pendingDelete?.length ?? 0, 'richiesta', 'richieste')}.
          L’operazione non è reversibile.
        </p>
      </Dialog>
    </div>
  )
}
