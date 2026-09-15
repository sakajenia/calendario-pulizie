/*
 * Report mensile per i proprietari.
 *
 * Una scheda per appartamento con quattro numeri - pulizie completate,
 * controlli sul posto, problemi risolti, costi extra - l'elenco di cosa e'
 * stato sistemato e l'andamento degli ultimi sei mesi. A fine mese il
 * responsabile operativo aggiunge gli interventi, poi esporta il PDF e lo
 * manda al proprietario: serve a far vedere che sulla casa si lavora davvero.
 *
 * L'esportazione passa dal dialogo di stampa del browser ("Salva come PDF"):
 * le regole `@media print` in index.css lasciano visibile solo il report.
 */
import * as React from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import {
  addMonths, endOfMonth, format, isSameMonth, startOfMonth, subMonths,
} from 'date-fns'
import { it } from 'date-fns/locale'
import {
  Building2, ChevronLeft, ChevronRight, FileText, Plus, Printer,
  ShieldCheck, Sparkles, Trash2, Wallet, Wrench,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, Dialog, EmptyState, Field, Input, Select, Textarea,
} from '@/components/ui'
import { MonthPicker } from '@/components/calendar/MonthPicker'
import { useCurrentUser, useStore } from '@/data/store'
import { isManager } from '@/lib/permissions'
import { useToast } from '@/components/feedback/Toast'
import { TODAY } from '@/data/seed'
import { asDate, downloadFile, fmtDate, fmtEur, fmtMonthYear, fmtNum, plural, toCsv } from '@/lib/format'
import {
  COMPANY_META,
  type Apartment, type CleaningCompanyId, type Intervention,
} from '@/types'
import { cn } from '@/lib/utils'

/* ------------------------------------------------------------------ grafico */

/* Recharts vuole colori veri, non classi: li leggiamo dai token del tema. */
const CHART_VARS = {
  cleanings: '--primary',
  inspections: '--inspector-manuel',
  interventions: '--status-pending',
  grid: '--border',
  axis: '--muted-foreground',
} as const

type PaletteKey = keyof typeof CHART_VARS
type Palette = Record<PaletteKey, string>
const KEYS = Object.keys(CHART_VARS) as PaletteKey[]

const tone = (raw: string) => (raw ? `hsl(${raw})` : 'currentColor')

function usePalette(): Palette {
  const read = React.useCallback(() => {
    const cs = getComputedStyle(document.documentElement)
    const out = {} as Palette
    for (const k of KEYS) out[k] = cs.getPropertyValue(CHART_VARS[k]).trim()
    return out
  }, [])

  const [palette, setPalette] = React.useState<Palette>(read)

  /* Il tema si cambia aggiungendo una classe alla radice: i colori del grafico
     vanno riletti, altrimenti restano quelli del tema precedente. */
  React.useEffect(() => {
    const obs = new MutationObserver(() => setPalette(read()))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [read])

  return palette
}

/* ------------------------------------------------------------------- conti */

interface MonthStats {
  cleanings: number
  inspections: number
  interventions: Intervention[]
  /** Somma dei costi noti. */
  cost: number
  /** Interventi ancora senza costo indicato. */
  costMissing: number
}

function CompanyBadge({ companyId }: { companyId: CleaningCompanyId }) {
  const meta = COMPANY_META[companyId]
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function Stat({
  label, value, hint, icon: Icon,
}: { label: string; value: string; hint?: string; icon: typeof Sparkles }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/30 p-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 shrink-0" />
        <span className="min-w-0 truncate">{label}</span>
      </p>
      <p className="mt-1 font-display text-2xl font-bold tabular-nums">{value}</p>
      {hint && <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{hint}</p>}
    </div>
  )
}

/* ------------------------------------------------- scheda di un immobile */

function ApartmentReport({
  apartment, stats, trend, palette, month, mayEdit, hidden, onAdd, onDelete, onExport,
}: {
  apartment: Apartment
  stats: MonthStats
  trend: { mese: string; Pulizie: number; Controlli: number; Interventi: number }[]
  palette: Palette
  month: Date
  mayEdit: boolean
  /** Fuori dalla stampa quando si esporta un'altra casa. */
  hidden: boolean
  onAdd: (a: Apartment) => void
  onDelete: (i: Intervention) => void
  onExport: (a: Apartment) => void
}) {
  return (
    <Card className={cn('print-block overflow-hidden', hidden && 'print-hidden')}>
      {/* Il mese sta nell'intestazione della casa: il PDF di un singolo
          appartamento deve spiegarsi da solo, senza il riepilogo generale. */}
      <div className="flex flex-wrap items-start gap-3 border-b-2 border-primary/20 bg-muted/30 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand">
          <Building2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg font-bold leading-tight">{apartment.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {apartment.address} · {apartment.district} · {apartment.city}
          </p>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge className="bg-primary/10 px-2 py-0.5 text-[11px] font-semibold capitalize text-brand ring-1 ring-inset ring-primary/20">
              {fmtMonthYear(month)}
            </Badge>
            <CompanyBadge companyId={apartment.companyId} />
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="no-print shrink-0"
          onClick={() => onExport(apartment)}
          aria-label={`Esporta il PDF di ${apartment.name}`}
          title={`Esporta il PDF di ${apartment.name}`}
        >
          <Printer /> <span className="hidden sm:inline">PDF</span>
        </Button>
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pulizie completate" value={fmtNum(stats.cleanings)} icon={Sparkles} />
        <Stat label="Controlli sul posto" value={fmtNum(stats.inspections)} icon={ShieldCheck} />
        <Stat label="Problemi risolti" value={fmtNum(stats.interventions.length)} icon={Wrench} />
        <Stat
          label="Costi extra"
          value={fmtEur(stats.cost)}
          hint={
            stats.costMissing > 0
              ? `${plural(stats.costMissing, 'intervento senza costo', 'interventi senza costo')}`
              : 'Interventi e pezzi sostitutivi'
          }
          icon={Wallet}
        />
      </div>

      <div className="border-t border-border p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Problemi riscontrati e risolti
          </h3>
          {mayEdit && (
            <Button variant="outline" size="sm" className="no-print" onClick={() => onAdd(apartment)}>
              <Plus /> Aggiungi
            </Button>
          )}
        </div>

        {stats.interventions.length === 0 ? (
          <p className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
            Nessun intervento registrato in questo mese.
          </p>
        ) : (
          <ul className="space-y-1">
            {stats.interventions.map((i) => (
              <li
                key={i.id}
                className="group flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-border/60 py-1.5 last:border-0"
              >
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtDate(i.at)}</span>
                <span className="min-w-0 flex-1 text-sm">{i.title}</span>
                {i.coveredBy && (
                  <Badge className="bg-status-accepted/12 px-2 py-0.5 text-[10px] text-status-accepted ring-1 ring-inset ring-status-accepted/25">
                    {i.coveredBy}
                  </Badge>
                )}
                <span
                  className={cn(
                    'shrink-0 text-sm tabular-nums',
                    i.cost === undefined ? 'text-muted-foreground' : 'font-medium',
                  )}
                >
                  {i.cost === undefined ? '—' : fmtEur(i.cost)}
                </span>
                {mayEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="no-print size-6 shrink-0 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`Elimina l’intervento “${i.title}”`}
                    onClick={() => onDelete(i)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}

        {stats.interventions.some((i) => i.notes) && (
          <ul className="mt-2 space-y-1">
            {stats.interventions
              .filter((i) => i.notes)
              .map((i) => (
                <li key={`n-${i.id}`} className="text-xs text-muted-foreground">
                  <span className="font-medium">{i.title}:</span> {i.notes}
                </li>
              ))}
          </ul>
        )}
      </div>

      <div className="border-t border-border p-4">
        <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Ultimi sei mesi
        </h3>
        <div className="h-48 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={tone(palette.grid)} vertical={false} />
              <XAxis dataKey="mese" tick={{ fontSize: 11, fill: tone(palette.axis) }} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: tone(palette.axis) }} tickLine={false} axisLine={false} />
              <Tooltip
                cursor={{ fill: tone(palette.grid), opacity: 0.3 }}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${tone(palette.grid)}` }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Pulizie" fill={tone(palette.cleanings)} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Controlli" fill={tone(palette.inspections)} radius={[3, 3, 0, 0]} />
              <Bar dataKey="Interventi" fill={tone(palette.interventions)} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------- modulo nuovo intervento */

function InterventionForm({
  open, onClose, apartment, month,
}: {
  open: boolean
  onClose: () => void
  apartment: Apartment | null
  month: Date
}) {
  const upsert = useStore((s) => s.upsertIntervention)
  const toast = useToast()
  const blank = React.useCallback(
    () => ({
      at: format(isSameMonth(TODAY, month) ? TODAY : endOfMonth(month), 'yyyy-MM-dd'),
      title: '',
      cost: '',
      coveredBy: '',
      notes: '',
    }),
    [month],
  )
  const [draft, setDraft] = React.useState(blank)
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!open) return
    setDraft(blank())
    setError(undefined)
  }, [open, blank])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!apartment) return
    if (!draft.title.trim()) return setError('Descrivi cosa è stato risolto')
    const at = new Date(`${draft.at}T11:00:00`)
    if (Number.isNaN(at.getTime())) return setError('Inserisci una data valida')

    const raw = draft.cost.trim().replace(',', '.')
    const cost = raw === '' ? undefined : Number(raw)
    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      return setError('Inserisci un costo valido, oppure lascialo vuoto')
    }

    upsert({
      id: `int-${Date.now()}`,
      apartmentId: apartment.id,
      at: at.toISOString(),
      title: draft.title.trim(),
      notes: draft.notes.trim() || undefined,
      cost,
      coveredBy: draft.coveredBy.trim() || undefined,
      createdAt: new Date().toISOString(),
    })
    onClose()
    toast({ title: `Intervento aggiunto a ${apartment.name}` })
  }

  return (
    <Dialog
      open={open && apartment !== null}
      onClose={onClose}
      title={apartment ? `Nuovo intervento · ${apartment.name}` : 'Nuovo intervento'}
      description="Un problema riscontrato e risolto in casa."
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button form="form-intervento" type="submit">Aggiungi</Button>
        </>
      }
    >
      <form id="form-intervento" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Cosa è stato risolto" htmlFor="int-titolo">
          <Input
            id="int-titolo"
            value={draft.title}
            placeholder="Es. Sistemato allagamento lavatrice"
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </Field>

        <Field label="Data" htmlFor="int-data">
          <Input
            id="int-data"
            type="date"
            value={draft.at}
            onChange={(e) => setDraft((d) => ({ ...d, at: e.target.value }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Costo" htmlFor="int-costo" hint="Vuoto se non ancora noto. Zero se non c’è costo.">
            <Input
              id="int-costo"
              inputMode="decimal"
              value={draft.cost}
              placeholder="0,00"
              onChange={(e) => setDraft((d) => ({ ...d, cost: e.target.value }))}
            />
          </Field>
          <Field label="Coperto da" htmlFor="int-copertura" hint="Facoltativo, es. Aircover.">
            <Input
              id="int-copertura"
              value={draft.coveredBy}
              placeholder="Aircover"
              onChange={(e) => setDraft((d) => ({ ...d, coveredBy: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Note" htmlFor="int-note" hint="Facoltative: dettaglio per il proprietario.">
          <Textarea
            id="int-note"
            rows={2}
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

export default function Dashboard() {
  const user = useCurrentUser()
  const apartments = useStore((s) => s.apartments)
  const requests = useStore((s) => s.requests)
  const inspections = useStore((s) => s.inspections)
  const interventions = useStore((s) => s.interventions)
  const deleteIntervention = useStore((s) => s.deleteIntervention)
  const upsertIntervention = useStore((s) => s.upsertIntervention)
  const toast = useToast()
  const palette = usePalette()
  const mayEdit = isManager(user)

  const [cursor, setCursor] = React.useState<Date>(TODAY)
  const [only, setOnly] = React.useState<string>('all')
  const [adding, setAdding] = React.useState<Apartment | null>(null)

  const shown = React.useMemo(
    () => (only === 'all' ? apartments : apartments.filter((a) => a.id === only)),
    [apartments, only],
  )

  const statsFor = React.useCallback(
    (apartmentId: string, month: Date): MonthStats => {
      const inMonth = (v: string) => isSameMonth(asDate(v), month)
      const own = interventions
        .filter((i) => i.apartmentId === apartmentId && inMonth(i.at))
        .sort((a, b) => asDate(a.at).getTime() - asDate(b.at).getTime())
      return {
        cleanings: requests.filter(
          (r) => r.apartmentId === apartmentId && r.status === 'completata' && inMonth(r.checkOutAt),
        ).length,
        inspections: inspections.filter(
          (i) => i.apartmentId === apartmentId && inMonth(i.scheduledAt),
        ).length,
        interventions: own,
        cost: own.reduce((n, i) => n + (i.cost ?? 0), 0),
        costMissing: own.filter((i) => i.cost === undefined).length,
      }
    },
    [requests, inspections, interventions],
  )

  const trendFor = React.useCallback(
    (apartmentId: string) =>
      Array.from({ length: 6 }, (_, k) => {
        const m = subMonths(cursor, 5 - k)
        const s = statsFor(apartmentId, m)
        return {
          mese: format(m, 'LLL', { locale: it }),
          Pulizie: s.cleanings,
          Controlli: s.inspections,
          Interventi: s.interventions.length,
        }
      }),
    [cursor, statsFor],
  )

  const rows = React.useMemo(
    () => shown.map((a) => ({ apartment: a, stats: statsFor(a.id, cursor) })),
    [shown, statsFor, cursor],
  )

  const totals = rows.reduce(
    (acc, r) => ({
      cleanings: acc.cleanings + r.stats.cleanings,
      inspections: acc.inspections + r.stats.inspections,
      interventions: acc.interventions + r.stats.interventions.length,
      cost: acc.cost + r.stats.cost,
    }),
    { cleanings: 0, inspections: 0, interventions: 0, cost: 0 },
  )

  const monthLabel = fmtMonthYear(cursor)
  const move = (dir: -1 | 1) => setCursor((c) => addMonths(c, dir))

  /* Il PDF esce dal dialogo di stampa: e' l'unico modo per avere un file vero
     senza trascinarsi dietro una libreria di impaginazione. */
  const exportPdf = () => window.print()

  /*
   * Esportare una casa sola: si nascondono le altre, si lascia al browser un
   * istante per ridisegnare e poi si apre la stampa. Senza l'attesa il dialogo
   * fotograferebbe la pagina prima che le altre schede spariscano.
   */
  const [printingId, setPrintingId] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (!printingId) return
    /* Si rientra a stampa finita, non subito dopo `print()`: non tutti i
       browser bloccano su quella chiamata, e chiudere prima rimetterebbe le
       altre schede nel PDF. La rete di sicurezza copre chi non annuncia la
       fine; intanto a schermo non cambia nulla, `print-hidden` vale solo in
       stampa. */
    const done = () => setPrintingId(null)
    window.addEventListener('afterprint', done)
    const start = window.setTimeout(() => window.print(), 60)
    const safety = window.setTimeout(done, 60_000)
    return () => {
      window.clearTimeout(start)
      window.clearTimeout(safety)
      window.removeEventListener('afterprint', done)
    }
  }, [printingId])

  const exportCsv = () => {
    const data = rows.flatMap((r) =>
      r.stats.interventions.length === 0
        ? [{
            Mese: monthLabel,
            Appartamento: r.apartment.name,
            'Pulizie completate': r.stats.cleanings,
            'Controlli sul posto': r.stats.inspections,
            Data: '', Intervento: '', Costo: '', 'Coperto da': '',
          }]
        : r.stats.interventions.map((i) => ({
            Mese: monthLabel,
            Appartamento: r.apartment.name,
            'Pulizie completate': r.stats.cleanings,
            'Controlli sul posto': r.stats.inspections,
            Data: fmtDate(i.at),
            Intervento: i.title,
            Costo: i.cost ?? '',
            'Coperto da': i.coveredBy ?? '',
          })),
    )
    downloadFile(`report-${format(startOfMonth(cursor), 'yyyy-MM')}.csv`, toCsv(data))
  }

  const removeIntervention = (i: Intervention) => {
    deleteIntervention(i.id)
    toast({
      title: 'Intervento eliminato',
      description: 'Puoi rimetterlo come era finché questa notifica resta a schermo.',
      action: { label: 'Annulla', onClick: () => upsertIntervention(i) },
    })
  }

  const closeForm = React.useCallback(() => setAdding(null), [])

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        className="no-print"
        title="Report mensile"
        subtitle={
          <span>
            <span className="capitalize">{monthLabel}</span> ·{' '}
            {plural(rows.length, 'appartamento', 'appartamenti')} · {totals.cleanings} pulizie ·{' '}
            {totals.interventions} interventi
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
              <FileText />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button onClick={exportPdf} disabled={rows.length === 0}>
              <Printer />
              <span className="hidden sm:inline">
                {only === 'all' ? 'Esporta tutte' : 'Esporta PDF'}
              </span>
            </Button>
          </>
        }
      />

      <div className="no-print flex flex-wrap items-center gap-2 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Mese precedente">
            <ChevronLeft />
          </Button>
          <MonthPicker value={cursor} onChange={setCursor} />
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Mese successivo">
            <ChevronRight />
          </Button>
        </div>

        <Select
          className="ml-auto h-9 w-auto text-sm"
          aria-label="Appartamento da mostrare"
          value={only}
          onChange={(e) => setOnly(e.target.value)}
          options={[
            { value: 'all', label: 'Tutti gli appartamenti' },
            ...apartments.map((a) => ({ value: a.id, label: a.name })),
          ]}
        />
      </div>

      {/* Solo questo blocco finisce nel PDF. */}
      <div id="report-stampa" className="space-y-4 p-4">
        <div className={cn('print-block rounded-xl border border-border bg-card p-4', printingId && 'print-hidden')}>
          <h1 className="font-display text-lg font-bold">
            Report operativo · <span className="capitalize">{monthLabel}</span>
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {only === 'all'
              ? `${plural(rows.length, 'appartamento', 'appartamenti')} in gestione`
              : rows[0]?.apartment.name}
            {' · '}
            {totals.cleanings} pulizie completate · {totals.inspections} controlli sul posto ·{' '}
            {totals.interventions} problemi risolti · {fmtEur(totals.cost)} di costi extra
          </p>
        </div>

        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={Building2}
              title="Nessun appartamento"
              description="Non c’è niente da riportare per questa selezione."
            />
          </Card>
        ) : (
          rows.map((r) => (
            <ApartmentReport
              key={r.apartment.id}
              apartment={r.apartment}
              stats={r.stats}
              trend={trendFor(r.apartment.id)}
              palette={palette}
              month={cursor}
              mayEdit={mayEdit}
              hidden={printingId !== null && printingId !== r.apartment.id}
              onAdd={setAdding}
              onDelete={removeIntervention}
              onExport={(a) => setPrintingId(a.id)}
            />
          ))
        )}
      </div>

      <InterventionForm open={adding !== null} onClose={closeForm} apartment={adding} month={cursor} />
    </div>
  )
}
