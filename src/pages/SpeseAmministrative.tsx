/*
 * Spese amministrative: quello che l'amministrazione anticipa per le case.
 *
 * Ogni spesa dice quanto, per quale appartamento e dove e' stata fatta (Amazon,
 * negozio fisico, o un tag nuovo aggiunto sul momento). La classificazione
 * decide chi la paga davvero: le spese coperte da Aircover restano a noi e non
 * arrivano mai al proprietario, le altre entrano fra i costi extra del foglio
 * di fine mese di quella casa (vedi Dashboard).
 *
 * Il responsabile e' Manuel: lo dice la testata, cosi' chi apre la pagina sa a
 * chi chiedere conto di una riga.
 */
import * as React from 'react'
import { addMonths, format, isSameMonth } from 'date-fns'
import {
  ChevronLeft, ChevronRight, Download, Plus, Search, SearchX, ShoppingBag,
  Trash2, Wallet, X,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, Dialog, EmptyState, Field, Input, MobileRecord, Select,
  Table, TableScroller, Td, Textarea, Th,
} from '@/components/ui'
import { MonthPicker } from '@/components/calendar/MonthPicker'
import { useStore } from '@/data/store'
import { useToast } from '@/components/feedback/Toast'
import { TODAY } from '@/data/seed'
import {
  asDate, downloadFile, fmtDate, fmtEur, fmtMonthYear, fmtNum, plural, toCsv,
} from '@/lib/format'
import {
  EXPENSE_CLASSES, EXPENSE_CLASS_META, EXPENSE_PLACES, INSPECTOR_META,
  type AdminExpense, type Apartment, type ExpenseClass,
} from '@/types'
import { cn } from '@/lib/utils'

/** Chi risponde delle spese: e' una persona della squadra, non un account. */
const RESPONSABILE = INSPECTOR_META.manuel.label

function ClassBadge({ value }: { value: ExpenseClass }) {
  const meta = EXPENSE_CLASS_META[value]
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function PlaceBadge({ value }: { value: string }) {
  return (
    <Badge className="bg-muted px-2 py-0.5 text-[11px] text-muted-foreground ring-1 ring-inset ring-border">
      <ShoppingBag className="size-3" aria-hidden />
      {value}
    </Badge>
  )
}

/* -------------------------------------------------------- modulo di spesa */

/** Valore del menu che apre il campo libero per un tag nuovo. */
const NEW_PLACE = '__nuovo__'

function ExpenseForm({
  open, onClose, initial, apartments, places, month,
}: {
  open: boolean
  onClose: () => void
  initial: AdminExpense | null
  apartments: Apartment[]
  /** Tag gia' in uso: l'elenco cresce da solo con quelli aggiunti. */
  places: string[]
  month: Date
}) {
  const upsert = useStore((s) => s.upsertAdminExpense)
  const toast = useToast()

  const blank = React.useCallback(
    () => ({
      title: '',
      amount: '',
      apartmentId: apartments[0]?.id ?? '',
      place: places[0] ?? EXPENSE_PLACES[0],
      newPlace: '',
      classification: 'extra' as ExpenseClass,
      at: format(isSameMonth(TODAY, month) ? TODAY : month, 'yyyy-MM-dd'),
      notes: '',
    }),
    [apartments, places, month],
  )

  const [draft, setDraft] = React.useState(blank)
  const [error, setError] = React.useState<string>()

  React.useEffect(() => {
    if (!open) return
    setError(undefined)
    setDraft(
      initial
        ? {
            title: initial.title,
            amount: String(initial.amount).replace('.', ','),
            apartmentId: initial.apartmentId,
            place: initial.place,
            newPlace: '',
            classification: initial.classification,
            at: format(asDate(initial.at), 'yyyy-MM-dd'),
            notes: initial.notes ?? '',
          }
        : blank(),
    )
  }, [open, initial, blank])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.title.trim()) return setError('Scrivi che spesa è')
    if (!draft.apartmentId) return setError('Scegli l’appartamento')

    const raw = draft.amount.trim().replace(',', '.')
    const amount = Number(raw)
    if (raw === '' || !Number.isFinite(amount) || amount < 0) {
      return setError('Inserisci un importo valido')
    }

    const place = (draft.place === NEW_PLACE ? draft.newPlace : draft.place).trim()
    if (!place) return setError('Scrivi dove è stata fatta la spesa')

    const at = new Date(`${draft.at}T12:00:00`)
    if (Number.isNaN(at.getTime())) return setError('Inserisci una data valida')

    upsert({
      id: initial?.id ?? `spe-${Date.now()}`,
      title: draft.title.trim(),
      amount,
      apartmentId: draft.apartmentId,
      place,
      classification: draft.classification,
      at: at.toISOString(),
      notes: draft.notes.trim() || undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    })
    onClose()
    toast({ title: initial ? 'Spesa aggiornata' : 'Spesa registrata' })
  }

  const classMeta = EXPENSE_CLASS_META[draft.classification]

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica spesa' : 'Nuova spesa'}
      description={`Registrata da ${RESPONSABILE}, responsabile operativo.`}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button form="form-spesa" type="submit">{initial ? 'Salva' : 'Aggiungi'}</Button>
        </>
      }
    >
      <form id="form-spesa" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Spesa" htmlFor="spesa-titolo">
          <Input
            id="spesa-titolo"
            value={draft.title}
            placeholder="Es. Tubo flessibile lavatrice"
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Importo" htmlFor="spesa-importo" hint="In euro, IVA inclusa.">
            <Input
              id="spesa-importo"
              inputMode="decimal"
              value={draft.amount}
              placeholder="0,00"
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
            />
          </Field>
          <Field label="Data" htmlFor="spesa-data">
            <Input
              id="spesa-data"
              type="date"
              value={draft.at}
              onChange={(e) => setDraft((d) => ({ ...d, at: e.target.value }))}
            />
          </Field>
        </div>

        <Field label="Per quale appartamento" htmlFor="spesa-appartamento">
          <Select
            id="spesa-appartamento"
            value={draft.apartmentId}
            onChange={(e) => setDraft((d) => ({ ...d, apartmentId: e.target.value }))}
            options={apartments.map((a) => ({
              value: a.id,
              label: [a.name, a.district].filter(Boolean).join(' · '),
            }))}
          />
        </Field>

        <Field label="Dove è stata fatta" htmlFor="spesa-dove">
          <Select
            id="spesa-dove"
            value={draft.place}
            onChange={(e) => setDraft((d) => ({ ...d, place: e.target.value }))}
            options={[
              ...places.map((p) => ({ value: p, label: p })),
              { value: NEW_PLACE, label: 'Aggiungi un altro tag…' },
            ]}
          />
        </Field>

        {draft.place === NEW_PLACE && (
          <Field label="Nuovo tag" htmlFor="spesa-nuovo-tag" hint="Resta disponibile per le spese successive.">
            <Input
              id="spesa-nuovo-tag"
              value={draft.newPlace}
              placeholder="Es. Ferramenta sotto casa"
              onChange={(e) => setDraft((d) => ({ ...d, newPlace: e.target.value }))}
            />
          </Field>
        )}

        <Field label="Classificazione" htmlFor="spesa-classe" hint={classMeta.hint}>
          <Select
            id="spesa-classe"
            value={draft.classification}
            onChange={(e) =>
              setDraft((d) => ({ ...d, classification: e.target.value as ExpenseClass }))}
            options={EXPENSE_CLASSES.map((c) => ({ value: c, label: EXPENSE_CLASS_META[c].label }))}
          />
        </Field>

        <Field label="Note" htmlFor="spesa-note" hint="Facoltative.">
          <Textarea
            id="spesa-note"
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

export default function SpeseAmministrative() {
  const apartments = useStore((s) => s.apartments)
  const expenses = useStore((s) => s.adminExpenses)
  const upsert = useStore((s) => s.upsertAdminExpense)
  const remove = useStore((s) => s.deleteAdminExpense)
  const toast = useToast()

  const [cursor, setCursor] = React.useState<Date>(TODAY)
  const [text, setText] = React.useState('')
  const [cls, setCls] = React.useState<ExpenseClass | 'all'>('all')
  const [apartmentId, setApartmentId] = React.useState<string>('all')
  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<AdminExpense | null>(null)

  const apartmentById = React.useMemo(
    () => new Map(apartments.map((a) => [a.id, a])), [apartments],
  )
  const nameOf = (id: string) => apartmentById.get(id)?.name ?? 'Appartamento non disponibile'

  /* I tag disponibili sono quelli di partenza piu' quelli gia' usati: chi ne
     aggiunge uno lo ritrova nel menu la volta dopo. */
  const places = React.useMemo(() => {
    const set = new Set<string>(EXPENSE_PLACES)
    for (const e of expenses) if (e.place.trim()) set.add(e.place.trim())
    return [...set].sort((a, b) => a.localeCompare(b, 'it'))
  }, [expenses])

  const monthly = React.useMemo(
    () =>
      expenses
        .filter((e) => isSameMonth(asDate(e.at), cursor))
        .sort((a, b) => asDate(b.at).getTime() - asDate(a.at).getTime()),
    [expenses, cursor],
  )

  const filtered = React.useMemo(() => {
    const q = text.trim().toLowerCase()
    return monthly.filter((e) => {
      if (cls !== 'all' && e.classification !== cls) return false
      if (apartmentId !== 'all' && e.apartmentId !== apartmentId) return false
      if (!q) return true
      return `${e.title} ${e.place} ${nameOf(e.apartmentId)}`.toLowerCase().includes(q)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthly, text, cls, apartmentId, apartmentById])

  const sum = (list: AdminExpense[]) => list.reduce((n, e) => n + e.amount, 0)
  const aircover = monthly.filter((e) => e.classification === 'aircover')
  const extra = monthly.filter((e) => e.classification === 'extra')

  const monthLabel = fmtMonthYear(cursor)
  const filtersOn = text.trim().length > 0 || cls !== 'all' || apartmentId !== 'all'
  const move = (dir: -1 | 1) => setCursor((c) => addMonths(c, dir))

  const clear = () => {
    setText('')
    setCls('all')
    setApartmentId('all')
  }

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (e: AdminExpense) => {
    setEditing(e)
    setFormOpen(true)
  }

  const closeForm = React.useCallback(() => {
    setFormOpen(false)
    setEditing(null)
  }, [])

  const drop = (e: AdminExpense) => {
    remove(e.id)
    toast({
      title: 'Spesa eliminata',
      description: 'Puoi rimetterla com’era finché questa notifica resta a schermo.',
      action: { label: 'Annulla', onClick: () => upsert(e) },
    })
  }

  const exportCsv = () => {
    downloadFile(
      `spese-amministrative-${format(cursor, 'yyyy-MM')}.csv`,
      toCsv(filtered.map((e) => ({
        Data: fmtDate(e.at),
        Spesa: e.title,
        Appartamento: nameOf(e.apartmentId),
        Dove: e.place,
        Classificazione: EXPENSE_CLASS_META[e.classification].label,
        Importo: e.amount,
        Note: e.notes ?? '',
      }))),
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Spese Amministrative"
        subtitle={
          <span>
            Responsabile: <span className="font-medium text-foreground">{RESPONSABILE}</span> ·{' '}
            <span className="capitalize">{monthLabel}</span> ·{' '}
            {plural(monthly.length, 'spesa', 'spese')} · {fmtEur(sum(monthly))}
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button onClick={openNew}>
              <Plus />
              <span className="hidden sm:inline">Nuova spesa</span>
            </Button>
          </>
        }
      />

      <div className="space-y-3 border-b border-border bg-card px-5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Mese precedente">
              <ChevronLeft />
            </Button>
            <MonthPicker value={cursor} onChange={setCursor} />
            <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Mese successivo">
              <ChevronRight />
            </Button>
          </div>

          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtra per spesa, casa o tag"
              className="pl-9 pr-9"
              aria-label="Filtra per spesa, casa o tag"
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

          <Select
            className="h-10 w-auto text-sm"
            aria-label="Appartamento"
            value={apartmentId}
            onChange={(e) => setApartmentId(e.target.value)}
            options={[
              { value: 'all', label: 'Tutti gli appartamenti' },
              ...apartments.map((a) => ({ value: a.id, label: a.name })),
            ]}
          />
          <Select
            className="h-10 w-auto text-sm"
            aria-label="Classificazione"
            value={cls}
            onChange={(e) => setCls(e.target.value as ExpenseClass | 'all')}
            options={[
              { value: 'all', label: 'Tutte le classificazioni' },
              ...EXPENSE_CLASSES.map((c) => ({ value: c, label: EXPENSE_CLASS_META[c].label })),
            ]}
          />
          {filtersOn && (
            <Button variant="ghost" size="sm" onClick={clear}>Cancella filtri</Button>
          )}
        </div>
      </div>

      {/* Il conto del mese diviso per destinazione: e' la domanda che si fa
          chi apre la pagina a fine mese. */}
      <div className="grid gap-3 p-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Totale del mese
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtEur(sum(monthly))}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {plural(monthly.length, 'spesa registrata', 'spese registrate')}
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className={cn('size-2 rounded-full', EXPENSE_CLASS_META.extra.dot)} />
            {EXPENSE_CLASS_META.extra.label}
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtEur(sum(extra))}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Vanno nel foglio di fine mese degli appartamenti
          </p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span className={cn('size-2 rounded-full', EXPENSE_CLASS_META.aircover.dot)} />
            {EXPENSE_CLASS_META.aircover.label}
          </p>
          <p className="mt-1 font-display text-2xl font-bold tabular-nums">{fmtEur(sum(aircover))}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Restano a noi: non arrivano al proprietario
          </p>
        </Card>
      </div>

      {filtered.length === 0 ? (
        <div className="px-4 pb-4">
          <Card>
            {monthly.length === 0 ? (
              <EmptyState
                icon={Wallet}
                title="Nessuna spesa in questo mese"
                description={`Non è stata registrata nessuna spesa per ${monthLabel}.`}
                action={<Button onClick={openNew}><Plus /> Nuova spesa</Button>}
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Nessuna spesa trovata"
                description="Nessun risultato per i filtri attivi."
                action={<Button variant="outline" onClick={clear}>Cancella filtri</Button>}
              />
            )}
          </Card>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border md:hidden">
            {filtered.map((e) => (
              <MobileRecord
                key={e.id}
                title={e.title}
                subtitle={nameOf(e.apartmentId)}
                badge={<ClassBadge value={e.classification} />}
                fields={[
                  { label: 'Importo', value: fmtEur(e.amount) },
                  { label: 'Data', value: fmtDate(e.at) },
                  { label: 'Dove', value: <PlaceBadge value={e.place} /> },
                ]}
                onClick={() => openEdit(e)}
              />
            ))}
          </div>

          <TableScroller innerClassName="overflow-x-auto">
            <Table className="hidden min-w-[900px] md:table">
              <thead>
                <tr>
                  <Th>Data</Th>
                  <Th>Spesa</Th>
                  <Th>Appartamento</Th>
                  <Th>Dove</Th>
                  <Th>Classificazione</Th>
                  <Th className="text-right">Importo</Th>
                  <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => (
                  <tr key={e.id} className="group border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <Td className="whitespace-nowrap tabular-nums text-muted-foreground">{fmtDate(e.at)}</Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => openEdit(e)}
                        className="rounded-sm text-left font-medium hover:underline focus-ring"
                      >
                        {e.title}
                      </button>
                      {e.notes && <p className="text-xs text-muted-foreground">{e.notes}</p>}
                    </Td>
                    <Td className="text-muted-foreground">{nameOf(e.apartmentId)}</Td>
                    <Td><PlaceBadge value={e.place} /></Td>
                    <Td><ClassBadge value={e.classification} /></Td>
                    <Td className="whitespace-nowrap text-right font-medium tabular-nums">{fmtEur(e.amount)}</Td>
                    <Td>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
                        aria-label={`Elimina la spesa “${e.title}”`}
                        onClick={() => drop(e)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroller>

          <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 md:sticky md:bottom-0 md:z-10">
            <span className="text-sm text-muted-foreground">
              Le spese classificate “{EXPENSE_CLASS_META.extra.label}” finiscono nei costi extra del report mensile.
            </span>
            <span className="text-sm text-muted-foreground">
              (Spese elencate: {fmtNum(filtered.length)} | Totale: {fmtEur(sum(filtered))})
            </span>
          </div>
        </>
      )}

      <ExpenseForm
        open={formOpen}
        onClose={closeForm}
        initial={editing}
        apartments={apartments}
        places={places}
        month={cursor}
      />
    </div>
  )
}
