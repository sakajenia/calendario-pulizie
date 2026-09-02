import * as React from 'react'
import {
  Activity, ArrowDown, ArrowDownRight, ArrowUp, ArrowUpRight, Building2,
  ChartPie, ChevronsUpDown, Download, Inbox,
  Minus, ShieldAlert, Users, Wallet,
} from 'lucide-react'
import {
  Area, Bar, BarChart, CartesianGrid, Cell, ComposedChart, Line, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle,
  EmptyState, Select, Table, Tabs, Td, Th,
} from '@/components/ui'
import { totalBedExtras } from '@/components/requests/RequestDetail'
import { scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { TODAY } from '@/data/seed'
import { asDate, downloadFile, fmtDate, fmtEur, fmtNum, norm, plural, toCsv } from '@/lib/format'
import {
  REQUEST_STATUSES, ROLE_META, STATUS_META,
  type CleaningRequest, type ExtraLine, type RequestStatus, type UserRole,
} from '@/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ palette */

/*
 * I grafici vivono fuori da Tailwind: recharts vuole colori veri, non classi.
 * Li leggiamo dalle custom property del tema, così restano token anche in SVG
 * e seguono il passaggio light/dark senza duplicare la palette.
 */
const CHART_VARS = {
  primary: '--primary',
  muted: '--muted-foreground',
  border: '--border',
  pending: '--status-pending',
  accepted: '--status-accepted',
  progress: '--status-progress',
  verify: '--status-verify',
  done: '--status-done',
  cancelled: '--status-cancelled',
} as const

type PaletteKey = keyof typeof CHART_VARS
type Palette = Record<PaletteKey, string>

const KEYS = Object.keys(CHART_VARS) as PaletteKey[]

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement)
  const out = {} as Palette
  for (const k of KEYS) out[k] = cs.getPropertyValue(CHART_VARS[k]).trim()
  return out
}

/** `346 72% 31%` → colore CSS, opzionalmente con alpha. */
const tone = (raw: string, alpha = 1) =>
  !raw ? 'currentColor' : alpha >= 1 ? `hsl(${raw})` : `hsl(${raw} / ${alpha})`

function useChartPalette(): Palette {
  const [palette, setPalette] = React.useState<Palette>(readPalette)
  React.useEffect(() => {
    // Il tema si cambia togglando la classe `dark` sull'html: rileggiamo i token.
    const obs = new MutationObserver(() => setPalette(readPalette()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])
  return palette
}

const STATUS_TONE: Record<RequestStatus, PaletteKey> = {
  in_attesa: 'pending',
  accettata: 'accepted',
  in_corso: 'progress',
  da_verificare: 'verify',
  completata: 'done',
  cancellata: 'cancelled',
  cancellata_guesty: 'cancelled',
}

/* ------------------------------------------------------------------ periodo */

const PERIODS = [7, 30, 90] as const
type Period = (typeof PERIODS)[number]

const DATE_FIELDS = [
  { value: 'createdAt', label: 'Creazione' },
  { value: 'checkOutAt', label: 'Check-out' },
  { value: 'checkInAt', label: 'Check-in' },
] as const
type DateField = (typeof DATE_FIELDS)[number]['value']

/* Il ruolo si chiama come nel resto dell'app (Utenti, Login): un vocabolario diverso per pagina confonde. */
const ROLE_CHIP: Record<UserRole, string> = {
  admin: 'bg-primary/10 text-brand ring-1 ring-inset ring-primary/20',
  host: 'bg-status-progress/12 text-status-progress ring-1 ring-inset ring-status-progress/25',
  operator: 'bg-muted text-muted-foreground ring-1 ring-inset ring-border',
}

/* --------------------------------------------------------------- componenti */

interface TooltipItem {
  name?: number | string
  value?: number | string | Array<number | string>
  color?: string
}

function ChartTooltip({
  active, payload, label, currency,
}: { active?: boolean; payload?: TooltipItem[]; label?: number | string; currency?: boolean }) {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-raised">
      {label !== undefined && label !== '' && (
        <p className="mb-1.5 text-xs font-semibold text-foreground">{String(label)}</p>
      )}
      <ul className="space-y-1">
        {payload.map((it, i) => {
          const n = Number(it.value ?? 0)
          return (
            <li key={`${String(it.name)}-${i}`} className="flex items-center gap-2 text-xs">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
              <span className="text-muted-foreground">{String(it.name ?? '')}</span>
              <span className="ml-auto pl-3 font-semibold tabular-nums text-foreground">
                {currency ? fmtEur(n) : fmtNum(n)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function SectionHeader({
  icon: Icon, title, description, action,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
}) {
  /* Niente icona dentro un quadratino colorato: e' la firma visiva piu' battuta
     dei dashboard generati. L'icona resta, in linea col titolo e senza sfondo. */
  return (
    <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
      <div className="min-w-0 space-y-1">
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-4 shrink-0 text-brand" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </div>
      {action}
    </CardHeader>
  )
}

function Delta({ current, previous }: { current: number; previous: number }) {
  const diff = current - previous

  if (previous === 0 && current === 0) {
    return <p className="text-xs text-muted-foreground">Nessun dato nel periodo precedente</p>
  }
  if (previous === 0) {
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-status-accepted">
        <ArrowUpRight className="size-3.5" />
        +{fmtNum(current)}
        <span className="font-normal text-muted-foreground">da zero nel periodo precedente</span>
      </p>
    )
  }
  if (diff === 0) {
    return (
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Minus className="size-3.5" />
        Stabile <span className="font-normal">vs periodo precedente</span>
      </p>
    )
  }

  const pct = (diff / previous) * 100
  const up = diff > 0
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return (
    <p className={cn('flex items-center gap-1 text-xs font-medium', up ? 'text-status-accepted' : 'text-status-cancelled')}>
      <Icon className="size-3.5" />
      {up ? '+' : '−'}{fmtNum(Math.abs(Math.round(pct * 10) / 10))}%
      <span className="font-normal text-muted-foreground">
        ({up ? '+' : '−'}{fmtNum(Math.abs(diff))} vs precedente)
      </span>
    </p>
  )
}

/**
 * Banda di metriche, non griglia di card.
 * Quattro riquadri identici con numerone e badge-icona sono il "hero metric"
 * da SaaS: qui le cifre stanno direttamente sul fondo della pagina, separate
 * da filetti, e la prima domina le altre per scala invece che per decorazione.
 */
function Stat({
  label, value, hint, current, previous, lead = false,
}: {
  label: string
  value: string
  hint: string
  current: number
  previous: number
  lead?: boolean
}) {
  return (
    <div className={cn('min-w-0 px-5 py-4 first:pl-0 last:pr-0', lead && 'sm:col-span-2 xl:col-span-1')}>
      <p className="eyebrow truncate">{label}</p>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span
          className={cn(
            'font-display font-extrabold tabular-nums tracking-tight',
            lead ? 'text-[2.75rem] leading-[0.95]' : 'text-3xl leading-none',
          )}
        >
          {value}
        </span>
        <Delta current={current} previous={previous} />
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{hint}</p>
    </div>
  )
}

type BudgetKey = 'name' | 'requests' | 'qty' | 'bed' | 'person' | 'apartment' | 'avg' | 'total'
interface BudgetSort { key: BudgetKey; dir: 'asc' | 'desc' }

function SortTh({
  label, sortKey, sort, onSort, numeric,
}: { label: string; sortKey: BudgetKey; sort: BudgetSort; onSort: (k: BudgetKey) => void; numeric?: boolean }) {
  const active = sort.key === sortKey
  const Icon = !active ? ChevronsUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
  return (
    <Th className={numeric ? 'text-right' : undefined}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          'inline-flex items-center gap-1 rounded uppercase tracking-wide transition-colors focus-ring hover:text-foreground',
          numeric && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className={cn('size-3', active ? 'opacity-90' : 'opacity-40')} />
      </button>
    </Th>
  )
}

/* --------------------------------------------------------------- la pagina */

interface BudgetRow {
  id: string
  name: string
  requests: number
  qty: number
  bed: number
  person: number
  apartment: number
  avg: number
  total: number
}

export default function Dashboard() {
  const user = useCurrentUser()
  const requests = useStore((s) => s.requests)
  const apartments = useStore((s) => s.apartments)
  const users = useStore((s) => s.users)
  const extraCatalog = useStore((s) => s.extraCatalog)

  const [period, setPeriod] = React.useState<Period>(30)
  const [dateField, setDateField] = React.useState<DateField>('createdAt')
  const [sort, setSort] = React.useState<BudgetSort>({ key: 'total', dir: 'desc' })
  const palette = useChartPalette()

  const scoped = React.useMemo(() => scopeRequests(requests, user), [requests, user])
  const apartmentById = React.useMemo(
    () => new Map(apartments.map((a) => [a.id, a])), [apartments],
  )
  const nameOf = React.useCallback(
    (r: CleaningRequest) => apartmentById.get(r.apartmentId)?.name ?? r.spotApartmentName ?? 'Appartamento rimosso',
    [apartmentById],
  )

  const range = React.useMemo(() => {
    const end = endOfDay(TODAY)
    const start = startOfDay(subDays(TODAY, period - 1))
    return {
      start,
      end,
      prevStart: startOfDay(subDays(start, period)),
      prevEnd: endOfDay(subDays(start, 1)),
    }
  }, [period])

  const within = React.useCallback(
    (r: CleaningRequest, field: DateField, a: Date, b: Date) => {
      const t = asDate(r[field]).getTime()
      return t >= a.getTime() && t <= b.getTime()
    },
    [],
  )

  const current = React.useMemo(
    () => scoped.filter((r) => within(r, dateField, range.start, range.end)),
    [scoped, dateField, range, within],
  )
  const previous = React.useMemo(
    () => scoped.filter((r) => within(r, dateField, range.prevStart, range.prevEnd)),
    [scoped, dateField, range, within],
  )

  const fieldCounts = React.useMemo(() => {
    const out = {} as Record<DateField, number>
    for (const f of DATE_FIELDS) {
      out[f.value] = scoped.filter((r) => within(r, f.value, range.start, range.end)).length
    }
    return out
  }, [scoped, range, within])

  const kpi = React.useMemo(() => {
    const agg = (list: CleaningRequest[]) => ({
      total: list.length,
      done: list.filter((r) => r.status === 'completata').length,
      pending: list.filter((r) => r.status === 'in_attesa').length,
      beds: list.reduce((sum, r) => sum + r.beds.length, 0),
    })
    return { cur: agg(current), prev: agg(previous) }
  }, [current, previous])

  const statusRows = React.useMemo(
    () => REQUEST_STATUSES.map((s) => ({
      status: s,
      name: STATUS_META[s].label,
      value: current.filter((r) => r.status === s).length,
    })),
    [current],
  )
  const statusSlices = React.useMemo(() => statusRows.filter((s) => s.value > 0), [statusRows])

  const trend = React.useMemo(() => {
    const buckets = new Map<string, { label: string; create: number; done: number }>()
    for (const d of eachDayOfInterval({ start: range.start, end: range.end })) {
      buckets.set(format(d, 'yyyy-MM-dd'), { label: format(d, 'dd/MM'), create: 0, done: 0 })
    }
    for (const r of current) {
      const b = buckets.get(format(asDate(r[dateField]), 'yyyy-MM-dd'))
      if (!b) continue
      b.create += 1
      if (r.status === 'completata') b.done += 1
    }
    return [...buckets.values()]
  }, [current, dateField, range])

  const topApartments = React.useMemo(() => {
    const acc = new Map<string, { name: string; value: number }>()
    for (const r of current) {
      const key = r.apartmentId
      const row = acc.get(key) ?? { name: nameOf(r), value: 0 }
      row.value += 1
      acc.set(key, row)
    }
    return [...acc.entries()]
      .map(([id, v]) => ({
        id,
        name: v.name,
        short: v.name.length > 22 ? `${v.name.slice(0, 21)}…` : v.name,
        value: v.value,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6)
  }, [current, nameOf])

  const topUsers = React.useMemo(() => {
    const acc = new Map<string, number>()
    for (const r of current) {
      acc.set(r.hostId, (acc.get(r.hostId) ?? 0) + 1)
      if (r.assigneeId) acc.set(r.assigneeId, (acc.get(r.assigneeId) ?? 0) + 1)
    }
    const rows = users
      .map((u) => ({ user: u, value: acc.get(u.id) ?? 0 }))
      .filter((r) => r.value > 0)
      .sort((a, b) => b.value - a.value || a.user.name.localeCompare(b.user.name, 'it'))
      .slice(0, 8)
    const max = rows.reduce((m, r) => Math.max(m, r.value), 0)
    return { rows, max }
  }, [current, users])

  const budget = React.useMemo(() => {
    const unitCost = new Map<string, number>()
    for (const e of extraCatalog) {
      if (typeof e.unitCost === 'number') unitCost.set(norm(e.name), e.unitCost)
    }
    const missing = new Set<string>()
    const rows = new Map<string, BudgetRow>()

    const addLines = (row: BudgetRow, lines: ExtraLine[], bucket: 'bed' | 'person' | 'apartment') => {
      for (const l of lines) {
        const unit = unitCost.get(norm(l.name))
        if (unit === undefined) missing.add(l.name)
        const cost = (unit ?? 0) * l.qty
        row.qty += l.qty
        row[bucket] += cost
        row.total += cost
      }
    }

    for (const r of current) {
      let row = rows.get(r.apartmentId)
      if (!row) {
        row = {
          id: r.apartmentId, name: nameOf(r), requests: 0, qty: 0,
          bed: 0, person: 0, apartment: 0, avg: 0, total: 0,
        }
        rows.set(r.apartmentId, row)
      }
      row.requests += 1
      addLines(row, totalBedExtras(r), 'bed')
      addLines(row, r.perPersonExtras, 'person')
      addLines(row, r.apartmentExtras, 'apartment')
    }

    const list = [...rows.values()]
    for (const r of list) r.avg = r.requests > 0 ? r.total / r.requests : 0

    const totals = list.reduce(
      (t, r) => ({
        requests: t.requests + r.requests,
        qty: t.qty + r.qty,
        bed: t.bed + r.bed,
        person: t.person + r.person,
        apartment: t.apartment + r.apartment,
        total: t.total + r.total,
      }),
      { requests: 0, qty: 0, bed: 0, person: 0, apartment: 0, total: 0 },
    )

    return { list, totals, missing: [...missing].sort((a, b) => a.localeCompare(b, 'it')) }
  }, [current, extraCatalog, nameOf])

  const sortedBudget = React.useMemo(() => {
    const { key, dir } = sort
    const sign = dir === 'asc' ? 1 : -1
    return budget.list
      .slice()
      .sort((a, b) => (key === 'name' ? a.name.localeCompare(b.name, 'it') : a[key] - b[key]) * sign)
  }, [budget.list, sort])

  const toggleSort = (k: BudgetKey) =>
    setSort((s) => (s.key === k
      ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { key: k, dir: k === 'name' ? 'asc' : 'desc' }))

  const exportBudget = () => {
    const rows = sortedBudget.map((r) => ({
      Appartamento: r.name,
      Richieste: r.requests,
      Pezzi: r.qty,
      'Extra letti': r.bed.toFixed(2),
      'Extra persona': r.person.toFixed(2),
      'Extra appartamento': r.apartment.toFixed(2),
      'Media a richiesta': r.avg.toFixed(2),
      'Totale periodo': r.total.toFixed(2),
    }))
    downloadFile(`budget-extra-${fmtDate(range.start)}_${fmtDate(range.end)}.csv`, toCsv(rows))
  }

  if (!user || user.role !== 'admin') {
    return (
      <div>
        <PageHeader title="Dashboard" />
        <div className="p-5">
          <Card>
            <EmptyState
              icon={ShieldAlert}
              title="Sezione riservata agli amministratori"
              description="Le statistiche aggregate sono visibili solo con un profilo admin."
            />
          </Card>
        </div>
      </div>
    )
  }

  const donePct = kpi.cur.total > 0 ? Math.round((kpi.cur.done / kpi.cur.total) * 100) : 0
  const bedsPerRequest = kpi.cur.total > 0 ? kpi.cur.beds / kpi.cur.total : 0
  const tickStyle = { fill: tone(palette.muted), fontSize: 11 }

  /** Tick dell'asse su una riga sola: niente a capo, troncatura con ellissi. */
  const SingleLineTick = ({ x, y, payload }: { x?: number; y?: number; payload?: { value?: string } }) => (
    <text
      x={x} y={y} dy={4} textAnchor="end"
      fill={tone(palette.muted)} fontSize={11}
      style={{ pointerEvents: 'none' }}
    >
      {payload?.value ?? ''}
    </text>
  )
  const gridStroke = tone(palette.border)
  const xInterval = Math.max(0, Math.ceil(trend.length / 10) - 1)

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{fmtDate(range.start)} → {fmtDate(range.end)}</span>
            <span aria-hidden className="text-border">|</span>
            <span>{plural(current.length, 'richiesta', 'richieste')} nel periodo</span>
            <span aria-hidden className="text-border">|</span>
            <span>confronto con i {period} giorni precedenti</span>
          </span>
        }
        actions={
          <div className="w-48">
            <Select
              aria-label="Periodo di analisi"
              value={String(period)}
              onChange={(e) => setPeriod(Number(e.target.value) as Period)}
              options={PERIODS.map((p) => ({ value: String(p), label: `Ultimi ${p} giorni` }))}
            />
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-2.5">
        <span id="dash-date-field" className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Tipo filtro data
        </span>
        <Tabs
          aria-labelledby="dash-date-field"
          value={dateField}
          onChange={setDateField}
          items={DATE_FIELDS.map((f) => ({ value: f.value, label: f.label, count: fieldCounts[f.value] }))}
        />
      </div>

      <div className="space-y-4 p-5">
        <div className="grid grid-cols-1 border-y border-border sm:grid-cols-2 sm:divide-x sm:divide-border xl:grid-cols-4">
          <Stat
            lead
            label="Richieste nel periodo"
            value={fmtNum(kpi.cur.total)}
            hint={`Su ${plural(scoped.length, 'richiesta totale', 'richieste totali')} in archivio`}
            current={kpi.cur.total}
            previous={kpi.prev.total}
          />
          <Stat
            label="Completate"
            value={fmtNum(kpi.cur.done)}
            hint={`${fmtNum(donePct)}% delle richieste del periodo`}
            current={kpi.cur.done}
            previous={kpi.prev.done}
          />
          <Stat
            label="In attesa"
            value={fmtNum(kpi.cur.pending)}
            hint="Da accettare o assegnare a un operatore"
            current={kpi.cur.pending}
            previous={kpi.prev.pending}
          />
          <Stat
            label="Letti preparati"
            value={fmtNum(kpi.cur.beds)}
            hint={`Media di ${fmtNum(Math.round(bedsPerRequest * 10) / 10)} letti a richiesta`}
            current={kpi.cur.beds}
            previous={kpi.prev.beds}
          />
        </div>

        {current.length === 0 ? (
          <Card>
            <EmptyState
              icon={Inbox}
              title="Nessuna richiesta nel periodo selezionato"
              description={`Nessuna richiesta con ${DATE_FIELDS.find((f) => f.value === dateField)?.label.toLowerCase()} fra il ${fmtDate(range.start)} e il ${fmtDate(range.end)}. Allarga il periodo o cambia il tipo di filtro data.`}
              action={
                period !== 90 ? (
                  <Button variant="outline" onClick={() => setPeriod(90)}>Estendi a 90 giorni</Button>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <>
            <div className="grid gap-4 xl:grid-cols-3">
              <Card className="xl:col-span-2">
                <SectionHeader
                  icon={Activity}
                  title="Andamento richieste"
                  description={`Richieste per giorno nel periodo, per data di ${DATE_FIELDS.find((f) => f.value === dateField)?.label.toLowerCase()}.`}
                />
                <CardContent>
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={trend} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                        <defs>
                          <linearGradient id="ppm-trend-fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={tone(palette.primary)} stopOpacity={0.32} />
                            <stop offset="100%" stopColor={tone(palette.primary)} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" vertical={false} />
                        <XAxis
                          dataKey="label"
                          tick={tickStyle}
                          tickLine={false}
                          axisLine={{ stroke: gridStroke }}
                          interval={xInterval}
                        />
                        <YAxis tick={tickStyle} tickLine={false} axisLine={false} allowDecimals={false} width={38} />
                        <Tooltip
                          content={<ChartTooltip />}
                          cursor={{ stroke: tone(palette.muted, 0.35), strokeDasharray: '3 3' }}
                        />
                        <Area
                          type="monotone"
                          dataKey="create"
                          name="Richieste"
                          stroke={tone(palette.primary)}
                          strokeWidth={2}
                          fill="url(#ppm-trend-fill)"
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="done"
                          name="Completate"
                          stroke={tone(palette.accepted)}
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-4 rounded-full bg-primary" />
                      Richieste
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="h-0.5 w-4 rounded-full bg-status-accepted" />
                      Completate
                    </span>
                    <span className="ml-auto tabular-nums">
                      Picco: {fmtNum(trend.reduce((m, d) => Math.max(m, d.create), 0))} in un giorno
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <SectionHeader
                  icon={ChartPie}
                  title="Richieste per Stato"
                  description="Distribuzione degli stati nel periodo."
                />
                <CardContent>
                  <div className="relative h-[192px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusSlices}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={58}
                          outerRadius={86}
                          paddingAngle={2}
                          stroke="none"
                        >
                          {statusSlices.map((s) => (
                            <Cell
                              key={s.status}
                              fill={tone(palette[STATUS_TONE[s.status]], s.status === 'cancellata_guesty' ? 0.5 : 1)}
                            />
                          ))}
                        </Pie>
                        <Tooltip content={<ChartTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display text-2xl font-extrabold tabular-nums">{fmtNum(current.length)}</span>
                      <span className="text-[11px] uppercase tracking-widest text-muted-foreground">Totale</span>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-1.5 border-t border-border pt-3">
                    {statusRows.map((s) => {
                      const pct = current.length > 0 ? (s.value / current.length) * 100 : 0
                      return (
                        <li
                          key={s.status}
                          className={cn('flex items-center gap-2 text-xs', s.value === 0 && 'opacity-40')}
                        >
                          <span className={cn('size-2 shrink-0 rounded-full', STATUS_META[s.status].dot)} />
                          <span className="truncate text-muted-foreground">{s.name}</span>
                          <span className="ml-auto font-semibold tabular-nums">{fmtNum(s.value)}</span>
                          <span className="w-11 shrink-0 text-right tabular-nums text-muted-foreground">
                            {fmtNum(Math.round(pct))}%
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <SectionHeader
                  icon={Building2}
                  title="Top Appartamenti per Richieste"
                  description={`I 6 immobili più movimentati su ${plural(budget.list.length, 'appartamento attivo', 'appartamenti attivi')} nel periodo.`}
                />
                <CardContent>
                  <div className="h-[248px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={topApartments}
                        layout="vertical"
                        margin={{ top: 0, right: 16, bottom: 0, left: 8 }}
                        barCategoryGap={10}
                      >
                        <CartesianGrid stroke={gridStroke} strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={tickStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="short"
                          tick={<SingleLineTick />}
                          tickLine={false}
                          axisLine={false}
                          width={168}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: tone(palette.muted, 0.08) }} />
                        <Bar dataKey="value" name="Richieste" radius={[0, 4, 4, 0]} maxBarSize={22}>
                          {topApartments.map((a, i) => (
                            <Cell key={a.id} fill={tone(palette.primary, 1 - i * 0.12)} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <SectionHeader
                  icon={Users}
                  title="Top Utenti per Richieste"
                  description="Un host conta le richieste dei suoi appartamenti, un operatore quelle che gli sono assegnate."
                />
                <CardContent>
                  <div className="overflow-x-auto">
                    <Table>
                      <thead>
                        <tr>
                          <Th>Utente</Th>
                          <Th>Ruolo</Th>
                          <Th className="text-right">Richieste</Th>
                          <Th className="w-[36%]">Quota</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {topUsers.rows.map(({ user: u, value }) => (
                          <tr key={u.id} className="border-b border-border last:border-0">
                            <Td>
                              <div className="min-w-0">
                                <p className="truncate font-medium">{u.name}</p>
                                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
                              </div>
                            </Td>
                            <Td>
                              <div className="flex items-center gap-1.5">
                                <Badge className={cn('whitespace-nowrap', ROLE_CHIP[u.role])}>{ROLE_META[u.role].label}</Badge>
                                {!u.active && (
                                  <Badge className="bg-muted text-muted-foreground ring-1 ring-inset ring-border">
                                    Non attivo
                                  </Badge>
                                )}
                              </div>
                            </Td>
                            <Td className="text-right font-semibold tabular-nums">{fmtNum(value)}</Td>
                            <Td>
                              <div className="flex items-center gap-2">
                                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-primary"
                                    style={{ width: `${topUsers.max > 0 ? (value / topUsers.max) * 100 : 0}%` }}
                                  />
                                </div>
                                <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                                  {fmtNum(Math.round(current.length > 0 ? (value / current.length) * 100 : 0))}%
                                </span>
                              </div>
                            </Td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <SectionHeader
                icon={Wallet}
                title="Pianificazione e Budget"
                description="Costo stimato degli extra consumati per appartamento, incrociando le righe delle richieste con il catalogo extra."
                action={
                  <Button variant="outline" size="sm" onClick={exportBudget}>
                    <Download />
                    <span className="hidden sm:inline">Esporta CSV</span>
                  </Button>
                }
              />
              <CardContent>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <thead>
                      <tr>
                        <SortTh label="Appartamento" sortKey="name" sort={sort} onSort={toggleSort} />
                        <SortTh label="Richieste" sortKey="requests" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Pezzi" sortKey="qty" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Extra letti" sortKey="bed" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Extra persona" sortKey="person" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Extra appartamento" sortKey="apartment" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Media a richiesta" sortKey="avg" sort={sort} onSort={toggleSort} numeric />
                        <SortTh label="Totale periodo" sortKey="total" sort={sort} onSort={toggleSort} numeric />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedBudget.map((r) => (
                        <tr key={r.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
                          <Td className="max-w-[260px] truncate font-medium">{r.name}</Td>
                          <Td className="text-right tabular-nums">{fmtNum(r.requests)}</Td>
                          <Td className="text-right tabular-nums text-muted-foreground">{fmtNum(r.qty)}</Td>
                          <Td className="text-right tabular-nums">{fmtEur(r.bed)}</Td>
                          <Td className="text-right tabular-nums">{fmtEur(r.person)}</Td>
                          <Td className="text-right tabular-nums">{fmtEur(r.apartment)}</Td>
                          <Td className="text-right tabular-nums text-muted-foreground">{fmtEur(r.avg)}</Td>
                          <Td className="text-right font-semibold tabular-nums">{fmtEur(r.total)}</Td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-muted/50">
                        <Td className="font-semibold uppercase tracking-wide">Totale</Td>
                        <Td className="text-right font-semibold tabular-nums">{fmtNum(budget.totals.requests)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{fmtNum(budget.totals.qty)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{fmtEur(budget.totals.bed)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{fmtEur(budget.totals.person)}</Td>
                        <Td className="text-right font-semibold tabular-nums">{fmtEur(budget.totals.apartment)}</Td>
                        <Td className="text-right font-semibold tabular-nums">
                          {fmtEur(budget.totals.requests > 0 ? budget.totals.total / budget.totals.requests : 0)}
                        </Td>
                        <Td className="text-right font-display text-base font-extrabold tabular-nums text-brand">
                          {fmtEur(budget.totals.total)}
                        </Td>
                      </tr>
                    </tfoot>
                  </Table>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {plural(budget.list.length, 'appartamento', 'appartamenti')} ·{' '}
                    {fmtNum(budget.totals.qty)} pezzi movimentati
                  </span>
                  {budget.missing.length > 0 && (
                    <span aria-live="polite">
                      <span aria-hidden className="mr-3 text-border">|</span>
                      Senza costo a catalogo, esclusi dal totale: {budget.missing.join(', ')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
}
