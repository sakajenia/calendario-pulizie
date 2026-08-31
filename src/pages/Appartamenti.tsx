import * as React from 'react'
import {
  BedDouble, Building2, ChevronDown, ChevronUp, ChevronsUpDown, Download, Eye,
  MoreVertical, Pencil, Plus, Search, Trash2,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Checkbox, Dialog, Dropdown, DropdownItem, DropdownSeparator,
  EmptyState, Field, Input, Label, Select, Switch, Table, Td, Textarea, Th, Tooltip,
} from '@/components/ui'
import { StatusChip } from '@/components/StatusChip'
import { scopeApartments, scopeRequests, useCurrentUser, useStore } from '@/data/store'
import {
  asDate, downloadFile, fmtDate, fmtDateTime, fmtEur, fmtNum, norm, plural, toCsv,
} from '@/lib/format'
import type {
  Apartment, ApartmentVisibility, Bed, BedType, CleaningRequest, ListingProvider, User,
} from '@/types'
import { cn } from '@/lib/utils'

const BED_TYPES: BedType[] = [
  'Letto Matrimoniale',
  'Letto Singolo',
  'Divano letto Matrimoniale',
  'Divano letto Singolo',
  'Letto a Castello',
  'Culla',
]

const PROVIDER_LABEL: Record<ListingProvider, string> = {
  none: 'Nessuno',
  guesty: 'Guesty',
  hostaway: 'Hostaway',
}

const VISIBILITY_LABEL: Record<ApartmentVisibility, string> = {
  official: 'Ufficiale',
  temporary: 'Temporaneo (nascosto)',
  spot: 'Spot',
}

type SortKey = 'name' | 'beds' | 'price' | 'requests'
type SortDir = 'asc' | 'desc'

/** Appartamento + i dati derivati usati da filtri, ordinamento ed export. */
interface Row {
  apt: Apartment
  ownerName: string
  requestCount: number
}

const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`

const toNum = (s: string) => Number(s.trim().replace(',', '.'))

function bedSummary(beds: Bed[]): string {
  if (beds.length === 0) return 'Nessun letto configurato'
  const counts = new Map<BedType, number>()
  for (const b of beds) counts.set(b.type, (counts.get(b.type) ?? 0) + 1)
  return Array.from(counts, ([type, n]) => `${n}× ${type}`).join(', ')
}

function ProviderBadge({ provider, listingId }: { provider: ListingProvider; listingId?: string }) {
  if (provider === 'none') return <span className="text-muted-foreground/60">—</span>
  return (
    <div className="space-y-0.5">
      <Badge
        className={cn(
          'ring-1 ring-inset',
          provider === 'guesty'
            ? 'bg-primary/10 text-brand ring-primary/20'
            : 'bg-muted text-foreground ring-border',
        )}
      >
        {PROVIDER_LABEL[provider]}
      </Badge>
      {listingId && <div className="text-[11px] tabular-nums text-muted-foreground">{listingId}</div>}
    </div>
  )
}

function VisibilityBadge({ visibility }: { visibility: ApartmentVisibility }) {
  if (visibility === 'official') return null
  return (
    <Badge className="bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border">
      {visibility === 'temporary' ? 'Nascosto' : 'Spot'}
    </Badge>
  )
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

/* --------------------------------------------------------------- dettaglio */

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h3>
      {children}
    </section>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border/60 py-1.5 last:border-0">
      <span className="shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-right text-sm font-medium">{value}</span>
    </div>
  )
}

function ApartmentDetail({
  apartment, ownerName, requests, open, onClose, onEdit,
}: {
  apartment: Apartment | null
  ownerName: string
  requests: CleaningRequest[]
  open: boolean
  onClose: () => void
  onEdit: (a: Apartment) => void
}) {
  if (!apartment) return null

  const perGuest = Object.entries(apartment.prices.perGuest ?? {})
    .map(([guests, price]) => ({ guests: Number(guests), price }))
    .sort((a, b) => a.guests - b.guests)

  const recent = requests
    .slice()
    .sort((a, b) => asDate(b.createdAt).getTime() - asDate(a.createdAt).getTime())
    .slice(0, 5)

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Dettaglio appartamento"
      description={apartment.name}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Chiudi</Button>
          <Button onClick={() => onEdit(apartment)}><Pencil /> Modifica</Button>
        </>
      }
    >
      <div className="space-y-6">
        <DetailSection title="Dati appartamento">
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-1">
            <DetailRow label="Nome" value={apartment.name} />
            <DetailRow label="Indirizzo" value={apartment.address} />
            <DetailRow label="Località" value={`${apartment.district} · ${apartment.city}`} />
            <DetailRow label="Proprietario" value={ownerName} />
            <DetailRow
              label="Provider"
              value={apartment.provider === 'none' ? 'Nessuno' : PROVIDER_LABEL[apartment.provider]}
            />
            <DetailRow
              label="Id listing"
              value={apartment.providerListingId ?? <span className="text-muted-foreground">—</span>}
            />
            <DetailRow label="Visibilità" value={VISIBILITY_LABEL[apartment.visibility]} />
            {apartment.cleaningFrequencyDays !== undefined && (
              <DetailRow
                label="Frequenza pulizie"
                value={`Ogni ${plural(apartment.cleaningFrequencyDays, 'giorno', 'giorni')}`}
              />
            )}
          </div>
        </DetailSection>

        <DetailSection title={`Letti (${fmtNum(apartment.beds.length)})`}>
          {apartment.beds.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessun letto configurato per questo appartamento.</p>
          ) : (
            <ol className="space-y-1">
              {apartment.beds.map((b, i) => (
                <li
                  key={b.id}
                  className="flex items-center gap-2.5 rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm"
                >
                  <span className="grid size-5 shrink-0 place-items-center rounded bg-primary/10 text-[11px] font-bold tabular-nums text-brand">
                    {i + 1}
                  </span>
                  <span className="font-medium">{b.type}</span>
                  {b.label && <span className="text-xs text-muted-foreground">{b.label}</span>}
                </li>
              ))}
            </ol>
          )}
        </DetailSection>

        <DetailSection title="Prezzi">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Base', value: fmtEur(apartment.prices.base) },
              { label: 'Minimo', value: fmtEur(apartment.prices.min) },
              { label: 'Massimo', value: fmtEur(apartment.prices.max) },
              {
                label: 'Speciale',
                value: apartment.prices.special === undefined ? '—' : fmtEur(apartment.prices.special),
              },
            ].map((p) => (
              <div key={p.label} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{p.label}</div>
                <div className="text-sm font-semibold tabular-nums">{p.value}</div>
              </div>
            ))}
          </div>

          {perGuest.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <thead>
                  <tr>
                    <Th>Prezzi per numero ospiti</Th>
                    {perGuest.map((p) => (
                      <Th key={p.guests} className="text-right tabular-nums">{fmtNum(p.guests)}</Th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <Td className="text-xs text-muted-foreground">Prezzo</Td>
                    {perGuest.map((p) => (
                      <Td key={p.guests} className="text-right font-medium tabular-nums">{fmtEur(p.price)}</Td>
                    ))}
                  </tr>
                </tbody>
              </Table>
            </div>
          )}
        </DetailSection>

        <DetailSection title="Note">
          {apartment.notes ? (
            <p className="whitespace-pre-line rounded-lg border border-border bg-muted/30 p-3 text-sm leading-relaxed">
              {apartment.notes}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Nessuna nota per questo appartamento.</p>
          )}
        </DetailSection>

        <DetailSection title={`Ultime richieste (${fmtNum(requests.length)} collegate)`}>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna richiesta collegata a questo appartamento.</p>
          ) : (
            <ul className="space-y-1.5">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/30 px-3 py-2"
                >
                  <StatusChip status={r.status} size="sm" />
                  <span className="text-xs tabular-nums">
                    <span className="text-muted-foreground">Check-out</span> {fmtDateTime(r.checkOutAt)}
                  </span>
                  <span className="text-xs tabular-nums">
                    <span className="text-muted-foreground">Check-in</span> {fmtDateTime(r.checkInAt)}
                  </span>
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    Creata {fmtDate(r.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      </div>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ form */

interface Draft {
  name: string
  address: string
  district: string
  city: string
  ownerId: string
  visibility: ApartmentVisibility
  provider: ListingProvider
  providerListingId: string
  base: string
  min: string
  max: string
  notes: string
  beds: Bed[]
}

type DraftErrors = Partial<Record<'name' | 'address' | 'district' | 'city' | 'owner' | 'listing' | 'base' | 'range', string>>

const makeDraft = (a: Apartment | null, fallbackOwnerId: string): Draft => ({
  name: a?.name ?? '',
  address: a?.address ?? '',
  district: a?.district ?? '',
  city: a?.city ?? 'Roma',
  ownerId: a?.ownerId ?? fallbackOwnerId,
  visibility: a?.visibility ?? 'official',
  provider: a?.provider ?? 'none',
  providerListingId: a?.providerListingId ?? '',
  base: a ? String(a.prices.base) : '',
  min: a ? String(a.prices.min) : '',
  max: a ? String(a.prices.max) : '',
  notes: a?.notes ?? '',
  beds: a ? a.beds.map((b) => ({ ...b })) : [],
})

function ApartmentForm({
  open, onClose, initial, hosts, fallbackOwnerId,
}: {
  open: boolean
  onClose: () => void
  initial: Apartment | null
  hosts: User[]
  fallbackOwnerId: string
}) {
  const upsertApartment = useStore((s) => s.upsertApartment)
  const [draft, setDraft] = React.useState<Draft>(() => makeDraft(initial, fallbackOwnerId))
  const [errors, setErrors] = React.useState<DraftErrors>({})

  React.useEffect(() => {
    if (!open) return
    setDraft(makeDraft(initial, fallbackOwnerId))
    setErrors({})
  }, [open, initial, fallbackOwnerId])

  const validate = (d: Draft): DraftErrors => {
    const e: DraftErrors = {}
    if (!d.name.trim()) e.name = 'Inserisci un nome'
    if (!d.address.trim()) e.address = 'Inserisci un indirizzo'
    if (!d.district.trim()) e.district = 'Inserisci un cap/quartiere'
    if (!d.city.trim()) e.city = 'Inserisci una città'
    if (!d.ownerId) e.owner = 'Seleziona un proprietario'
    if (d.provider !== 'none' && !d.providerListingId.trim()) e.listing = 'Inserisci l’id listing'

    const base = toNum(d.base)
    const min = toNum(d.min)
    const max = toNum(d.max)
    if (!d.base.trim() || !Number.isFinite(base) || base < 0) e.base = 'Inserisci un prezzo base valido'
    if (!d.min.trim() || !d.max.trim() || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
      e.range = 'Inserisci prezzi minimo e massimo validi'
    } else if (min > max) {
      e.range = 'Il prezzo minimo non può superare il massimo'
    }
    return e
  }

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    const e = validate(draft)
    setErrors(e)
    if (Object.keys(e).length > 0) return

    upsertApartment({
      id: initial?.id ?? uid('ap'),
      name: draft.name.trim(),
      address: draft.address.trim(),
      district: draft.district.trim(),
      city: draft.city.trim(),
      ownerId: draft.ownerId,
      beds: draft.beds,
      notes: draft.notes.trim() || undefined,
      visibility: draft.visibility,
      provider: draft.provider,
      providerListingId: draft.provider === 'none' ? undefined : draft.providerListingId.trim(),
      providerNotes: initial?.providerNotes,
      prices: {
        base: toNum(draft.base),
        min: toNum(draft.min),
        max: toNum(draft.max),
        special: initial?.prices.special,
        perGuest: initial?.prices.perGuest,
      },
      cleaningFrequencyDays: initial?.cleaningFrequencyDays,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica appartamento' : 'Nuovo appartamento'}
      description={initial ? initial.address : 'Compila i dati dell’appartamento da gestire.'}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="form-appartamento">
            {initial ? 'Salva modifiche' : 'Crea appartamento'}
          </Button>
        </>
      }
    >
      <form id="form-appartamento" onSubmit={submit} className="space-y-6" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" error={errors.name} className="sm:col-span-2">
            <Input
              value={draft.name}
              placeholder="Es. Via della Scala 9"
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </Field>

          <Field label="Indirizzo" error={errors.address} className="sm:col-span-2">
            <Input
              value={draft.address}
              placeholder="Via, numero civico, interno"
              onChange={(e) => setDraft((d) => ({ ...d, address: e.target.value }))}
            />
          </Field>

          <Field label="Cap/Quartiere" error={errors.district}>
            <Input
              value={draft.district}
              placeholder="Es. Trastevere"
              onChange={(e) => setDraft((d) => ({ ...d, district: e.target.value }))}
            />
          </Field>

          <Field label="Città" error={errors.city}>
            <Input
              value={draft.city}
              placeholder="Es. Roma"
              onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))}
            />
          </Field>

          <Field label="Proprietario" error={errors.owner}>
            <Select
              value={draft.ownerId}
              onChange={(e) => setDraft((d) => ({ ...d, ownerId: e.target.value }))}
              options={[
                { value: '', label: 'Seleziona un proprietario' },
                ...hosts.map((h) => ({ value: h.id, label: h.name })),
              ]}
            />
          </Field>

          <Field label="Visibilità" hint="Gli appartamenti temporanei restano nascosti in elenco.">
            <Select
              value={draft.visibility}
              onChange={(e) => setDraft((d) => ({ ...d, visibility: e.target.value as ApartmentVisibility }))}
              options={(Object.keys(VISIBILITY_LABEL) as ApartmentVisibility[]).map((v) => ({
                value: v, label: VISIBILITY_LABEL[v],
              }))}
            />
          </Field>

          <Field label="Provider">
            <Select
              value={draft.provider}
              onChange={(e) => {
                const provider = e.target.value as ListingProvider
                setDraft((d) => ({
                  ...d,
                  provider,
                  providerListingId: provider === 'none' ? '' : d.providerListingId,
                }))
              }}
              options={(Object.keys(PROVIDER_LABEL) as ListingProvider[]).map((p) => ({
                value: p, label: PROVIDER_LABEL[p],
              }))}
            />
          </Field>

          <Field label="Id listing" error={errors.listing}>
            <Input
              value={draft.providerListingId}
              disabled={draft.provider === 'none'}
              placeholder={draft.provider === 'guesty' ? 'GY-00000' : draft.provider === 'hostaway' ? 'HA-00000' : '—'}
              onChange={(e) => setDraft((d) => ({ ...d, providerListingId: e.target.value }))}
            />
          </Field>
        </div>

        <div className="space-y-3">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Prezzi</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Prezzo base (€)" error={errors.base}>
              <Input
                type="number" min="0" step="1" inputMode="decimal"
                value={draft.base}
                onChange={(e) => setDraft((d) => ({ ...d, base: e.target.value }))}
              />
            </Field>
            <Field label="Prezzo minimo (€)">
              <Input
                type="number" min="0" step="1" inputMode="decimal"
                value={draft.min}
                onChange={(e) => setDraft((d) => ({ ...d, min: e.target.value }))}
              />
            </Field>
            <Field label="Prezzo massimo (€)" error={errors.range}>
              <Input
                type="number" min="0" step="1" inputMode="decimal"
                value={draft.max}
                onChange={(e) => setDraft((d) => ({ ...d, max: e.target.value }))}
              />
            </Field>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label>Letti ({fmtNum(draft.beds.length)})</Label>
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => setDraft((d) => ({ ...d, beds: [...d.beds, { id: uid('bed'), type: BED_TYPES[0] }] }))}
            >
              <Plus /> Aggiungi letto
            </Button>
          </div>

          {draft.beds.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
              Nessun letto configurato. Aggiungi le tipologie presenti nell’appartamento.
            </p>
          ) : (
            <ul className="space-y-2">
              {draft.beds.map((bed, i) => (
                <li key={bed.id} className="flex items-center gap-2">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-xs font-bold tabular-nums text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Select
                      value={bed.type}
                      aria-label={`Tipologia letto ${i + 1}`}
                      onChange={(e) => {
                        const type = e.target.value as BedType
                        setDraft((d) => ({
                          ...d,
                          beds: d.beds.map((b) => (b.id === bed.id ? { ...b, type } : b)),
                        }))
                      }}
                      options={BED_TYPES.map((t) => ({ value: t, label: t }))}
                    />
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon"
                    aria-label={`Rimuovi letto ${i + 1}`}
                    onClick={() => setDraft((d) => ({ ...d, beds: d.beds.filter((b) => b.id !== bed.id) }))}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="Note" hint="Accessi, keybox, rifornimenti: vengono mostrate agli operatori.">
          <Textarea
            rows={5}
            value={draft.notes}
            placeholder={'- Accesso con chiavi nella keybox\n- Codice cassetta pulizie: 0000'}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          />
        </Field>
      </form>
    </Dialog>
  )
}

/* --------------------------------------------------------------------- pagina */

export default function Appartamenti() {
  const user = useCurrentUser()
  const allApartments = useStore((s) => s.apartments)
  const allRequests = useStore((s) => s.requests)
  const users = useStore((s) => s.users)
  const deleteApartment = useStore((s) => s.deleteApartment)

  const [text, setText] = React.useState('')
  const [ownerFilter, setOwnerFilter] = React.useState('all')
  const [showTemporary, setShowTemporary] = React.useState(false)
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())
  const [detailId, setDetailId] = React.useState<string | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<string[] | null>(null)

  const scoped = React.useMemo(() => scopeApartments(allApartments, user), [allApartments, user])
  const scopedRequests = React.useMemo(() => scopeRequests(allRequests, user), [allRequests, user])

  /** Un host può assegnare gli appartamenti solo a sé stesso. */
  const hosts = React.useMemo(() => {
    if (user?.role === 'host') return [user]
    return users.filter((u) => u.role === 'host')
  }, [users, user])

  const rows = React.useMemo<Row[]>(() => {
    const counts = new Map<string, number>()
    for (const r of scopedRequests) counts.set(r.apartmentId, (counts.get(r.apartmentId) ?? 0) + 1)
    const nameById = new Map(users.map((u) => [u.id, u.name]))
    return scoped.map((apt) => ({
      apt,
      ownerName: nameById.get(apt.ownerId) ?? 'Proprietario non assegnato',
      requestCount: counts.get(apt.id) ?? 0,
    }))
  }, [scoped, scopedRequests, users])

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    const list = rows.filter((r) => {
      if (!showTemporary && r.apt.visibility === 'temporary') return false
      if (ownerFilter !== 'all' && r.apt.ownerId !== ownerFilter) return false
      if (q && !norm(`${r.apt.name} ${r.apt.address} ${r.apt.district} ${r.apt.city}`).includes(q)) return false
      return true
    })

    const primary = (a: Row, b: Row): number => {
      switch (sortKey) {
        case 'beds': return a.apt.beds.length - b.apt.beds.length
        case 'price': return a.apt.prices.base - b.apt.prices.base
        case 'requests': return a.requestCount - b.requestCount
        default: return a.apt.name.localeCompare(b.apt.name, 'it')
      }
    }

    return list.sort((a, b) => {
      const r = primary(a, b)
      if (r !== 0) return sortDir === 'asc' ? r : -r
      return a.apt.name.localeCompare(b.apt.name, 'it')
    })
  }, [rows, text, ownerFilter, showTemporary, sortKey, sortDir])

  const selectedIds = React.useMemo(
    () => filtered.filter((r) => selected.has(r.apt.id)).map((r) => r.apt.id),
    [filtered, selected],
  )
  const visibleIds = filtered.map((r) => r.apt.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id))

  const totalBeds = filtered.reduce((n, r) => n + r.apt.beds.length, 0)
  const totalRequests = filtered.reduce((n, r) => n + r.requestCount, 0)
  const hasFilters = text.trim() !== '' || ownerFilter !== 'all' || showTemporary

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

  const resetFilters = () => {
    setText('')
    setOwnerFilter('all')
    setShowTemporary(false)
  }

  const detail = detailId ? scoped.find((a) => a.id === detailId) ?? null : null
  const editing = editingId ? scoped.find((a) => a.id === editingId) ?? null : null

  const openEdit = (a: Apartment) => {
    setDetailId(null)
    setEditingId(a.id)
    setFormOpen(true)
  }

  const exportCsv = () => {
    const source = selectedIds.length > 0 ? filtered.filter((r) => selected.has(r.apt.id)) : filtered
    const data = source.map((r) => ({
      Nome: r.apt.name,
      Indirizzo: r.apt.address,
      'Cap/Quartiere': r.apt.district,
      'Città': r.apt.city,
      Proprietario: r.ownerName,
      Letti: r.apt.beds.length,
      'Tipologie letti': bedSummary(r.apt.beds),
      Provider: PROVIDER_LABEL[r.apt.provider],
      'Id listing': r.apt.providerListingId ?? '',
      'Visibilità': VISIBILITY_LABEL[r.apt.visibility],
      'Prezzo base': r.apt.prices.base,
      'Prezzo minimo': r.apt.prices.min,
      'Prezzo massimo': r.apt.prices.max,
      Richieste: r.requestCount,
      Note: (r.apt.notes ?? '').replace(/\s+/g, ' ').trim(),
    }))
    downloadFile(`appartamenti-${fmtDate(new Date())}.csv`, toCsv(data))
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    for (const id of pendingDelete) deleteApartment(id)
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of pendingDelete) next.delete(id)
      return next
    })
    if (detailId && pendingDelete.includes(detailId)) setDetailId(null)
    setPendingDelete(null)
  }

  const detailRequests = React.useMemo(
    () => (detail ? scopedRequests.filter((r) => r.apartmentId === detail.id) : []),
    [detail, scopedRequests],
  )

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Appartamenti"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{fmtNum(filtered.length)} di {plural(scoped.length, 'appartamento', 'appartamenti')}</span>
            <span aria-hidden className="text-border">|</span>
            <span>{plural(totalBeds, 'letto', 'letti')} · {plural(totalRequests, 'richiesta collegata', 'richieste collegate')}</span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download />
              Esporta CSV
            </Button>
            <Button onClick={() => { setEditingId(null); setFormOpen(true) }}>
              <Plus />
              Nuovo appartamento
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filtra per nome o indirizzo"
            aria-label="Filtra per nome o indirizzo"
            className="h-9 pl-9"
          />
        </div>

        <div className="w-full sm:w-60">
          <Select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            aria-label="Filtra per proprietario"
            className="h-9"
            options={[
              { value: 'all', label: 'Filtra per proprietario' },
              ...hosts.map((h) => ({ value: h.id, label: h.name })),
            ]}
          />
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
          <Switch
            checked={showTemporary}
            onChange={setShowTemporary}
            label="Mostra appartamenti temporanei (Nascosti)"
          />
          <span className="text-muted-foreground">Mostra appartamenti temporanei (Nascosti)</span>
        </label>

        {hasFilters && (
          <Button variant="link" size="sm" className="ml-auto" onClick={resetFilters}>
            Cancella filtri
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedIds.length, 'appartamento selezionato', 'appartamenti selezionati')}
          </span>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download />
            Esporta selezionati
          </Button>
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
        {filtered.length === 0 ? (
          <EmptyState
            icon={Building2}
            title={scoped.length === 0 ? 'Nessun appartamento' : 'Nessun risultato con questi filtri'}
            description={
              scoped.length === 0
                ? 'Aggiungi il primo appartamento per poter pianificare le richieste di pulizia.'
                : 'Prova a cambiare proprietario, a svuotare la ricerca o a mostrare anche gli appartamenti temporanei.'
            }
            action={
              scoped.length === 0
                ? <Button onClick={() => { setEditingId(null); setFormOpen(true) }}><Plus /> Nuovo appartamento</Button>
                : <Button variant="outline" onClick={resetFilters}>Cancella filtri</Button>
            }
          />
        ) : (
          <Table className="min-w-[1120px]">
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    label="Seleziona tutti gli appartamenti filtrati"
                  />
                </Th>
                <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                <SortHeader label="Nome" sortKey="name" current={sortKey} dir={sortDir} onSort={sortBy} />
                <Th>Indirizzo</Th>
                <Th>Cap/Quartiere</Th>
                <Th>Città</Th>
                <SortHeader label="Letti" sortKey="beds" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
                <Th>Provider</Th>
                <SortHeader label="Prezzo base" sortKey="price" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
                <SortHeader label="Richieste" sortKey="requests" current={sortKey} dir={sortDir} onSort={sortBy} className="text-right" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSelected = selected.has(r.apt.id)
                return (
                  <tr
                    key={r.apt.id}
                    onClick={() => setDetailId(r.apt.id)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 transition-colors last:border-0',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                    )}
                  >
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(r.apt.id)}
                        label={`Seleziona ${r.apt.name}`}
                      />
                    </Td>

                    <Td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        align="start"
                        className="w-[200px]"
                        trigger={
                          <Button variant="ghost" size="icon" className="size-7" aria-label={`Azioni ${r.apt.name}`}>
                            <MoreVertical />
                          </Button>
                        }
                      >
                        <DropdownItem onClick={() => setDetailId(r.apt.id)}><Eye /> Visualizza</DropdownItem>
                        <DropdownItem onClick={() => openEdit(r.apt)}><Pencil /> Modifica</DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem danger onClick={() => setPendingDelete([r.apt.id])}><Trash2 /> Elimina</DropdownItem>
                      </Dropdown>
                    </Td>

                    <Td className="max-w-[240px]">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{r.apt.name}</span>
                        <VisibilityBadge visibility={r.apt.visibility} />
                      </div>
                      {user?.role !== 'host' && (
                        <div className="truncate text-xs text-muted-foreground">{r.ownerName}</div>
                      )}
                    </Td>

                    <Td className="max-w-[240px]">
                      <span className="block truncate text-muted-foreground">{r.apt.address}</span>
                    </Td>

                    <Td className="whitespace-nowrap text-muted-foreground">{r.apt.district}</Td>
                    <Td className="whitespace-nowrap text-muted-foreground">{r.apt.city}</Td>

                    <Td className="text-right font-medium tabular-nums">
                      {r.apt.beds.length === 0 ? (
                        <span className="text-muted-foreground">0</span>
                      ) : (
                        <Tooltip label={bedSummary(r.apt.beds)}>
                          <span className="inline-flex items-center gap-1.5">
                            <BedDouble className="size-3.5 text-muted-foreground" />
                            {fmtNum(r.apt.beds.length)}
                          </span>
                        </Tooltip>
                      )}
                    </Td>

                    <Td>
                      <ProviderBadge provider={r.apt.provider} listingId={r.apt.providerListingId} />
                    </Td>

                    <Td className="text-right font-medium tabular-nums">{fmtEur(r.apt.prices.base)}</Td>

                    <Td className="text-right tabular-nums">
                      {r.requestCount === 0
                        ? <span className="text-muted-foreground/60">0</span>
                        : <span className="font-medium">{fmtNum(r.requestCount)}</span>}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">
          Ordinati per{' '}
          <span className="font-medium text-foreground">
            {{ name: 'Nome', beds: 'Letti', price: 'Prezzo base', requests: 'Richieste' }[sortKey]}
          </span>{' '}
          ({sortDir === 'asc' ? 'crescente' : 'decrescente'})
        </span>

        <span className="text-sm tabular-nums text-muted-foreground">
          (Appartamenti filtrati: {fmtNum(filtered.length)} | Selezionati: {fmtNum(selectedIds.length)})
        </span>
      </div>

      <ApartmentDetail
        apartment={detail}
        ownerName={detail ? (users.find((u) => u.id === detail.ownerId)?.name ?? 'Proprietario non assegnato') : ''}
        requests={detailRequests}
        open={detail !== null}
        onClose={() => setDetailId(null)}
        onEdit={openEdit}
      />

      <ApartmentForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        hosts={hosts}
        fallbackOwnerId={user?.role === 'host' ? user.id : (hosts[0]?.id ?? '')}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title={pendingDelete?.length === 1 ? 'Elimina appartamento' : 'Elimina appartamenti'}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setPendingDelete(null)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
          </>
        }
      >
        <p className="text-sm">
          Stai per eliminare {plural(pendingDelete?.length ?? 0, 'appartamento', 'appartamenti')}.
          Le richieste già collegate resteranno in elenco senza appartamento. L’operazione non è reversibile.
        </p>
      </Dialog>
    </div>
  )
}
