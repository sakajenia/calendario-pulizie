/*
 * Compensi di fine mese: quanto spetta a ogni ditta di pulizie.
 *
 * Il conto parte dalle pulizie del mese - la data che conta e' il check-out,
 * cioe' quando l'intervento viene fatto - e per ognuna prende la tariffa
 * dell'appartamento per il numero di ospiti in arrivo. A questo si somma il
 * costo fisso per intervento previsto dalla ditta: Comfy Host aggiunge 0,50 EUR
 * di canovaccio a ogni pulizia.
 *
 * Pagina riservata all'amministratore: e' il conto che paga lui.
 */
import * as React from 'react'
import { addMonths, endOfMonth, isSameMonth, startOfMonth } from 'date-fns'
import {
  Building2, ChevronLeft, ChevronRight, Download, Receipt, Sparkles,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, EmptyState, Table, TableScroller, Tabs, Td, Th, MobileRecord,
} from '@/components/ui'
import { MonthPicker } from '@/components/calendar/MonthPicker'
import { useStore } from '@/data/store'
import { TODAY } from '@/data/seed'
import { asDate, downloadFile, fmtDate, fmtEur, fmtMonthYear, fmtNum, plural, toCsv } from '@/lib/format'
import {
  CLEANING_COMPANIES, COMPANY_META, priceForGuests,
  type Apartment, type CleaningCompanyId, type CleaningRequest,
} from '@/types'
import { cn } from '@/lib/utils'

/**
 * Quali pulizie entrano nel conto. Di norma si paga il lavoro chiuso, ma
 * l'elenco completo serve a riconciliare quando qualcosa e' rimasto aperto.
 */
type Basis = 'completate' | 'tutte'

const BASIS_ITEMS: { value: Basis; label: string }[] = [
  { value: 'completate', label: 'Solo completate' },
  { value: 'tutte', label: 'Tutte le non cancellate' },
]

const isCancelled = (r: CleaningRequest) =>
  r.status === 'cancellata'

interface Line {
  apartment: Apartment
  cleanings: number
  /** Somma delle tariffe delle pulizie, senza costi fissi. */
  amount: number
}

interface CompanyTotal {
  id: CleaningCompanyId
  lines: Line[]
  cleanings: number
  /** Totale delle tariffe di pulizia. */
  cleaningAmount: number
  /** Costo fisso per intervento (canovaccio per Comfy Host). */
  feeAmount: number
  total: number
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

/** Riquadro del compenso di una ditta: quanto, e da cosa viene fuori. */
function CompanyCard({ total }: { total: CompanyTotal }) {
  const meta = COMPANY_META[total.id]
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
        <span className={cn('grid size-8 shrink-0 place-items-center rounded-lg bg-muted', meta.text)}>
          <Sparkles className="size-4" />
        </span>
        <h2 className="font-display text-sm font-bold">{meta.label}</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {plural(total.cleanings, 'pulizia', 'pulizie')} · {plural(total.lines.length, 'appartamento', 'appartamenti')}
        </span>
      </div>

      <dl className="space-y-1.5 px-4 py-3 text-sm">
        <div className="flex items-baseline justify-between gap-4">
          <dt className="text-muted-foreground">Pulizie</dt>
          <dd className="tabular-nums">{fmtEur(total.cleaningAmount)}</dd>
        </div>
        {meta.perCleaningFee > 0 && (
          <div className="flex items-baseline justify-between gap-4">
            <dt className="min-w-0 text-muted-foreground">
              {meta.perCleaningFeeLabel ?? 'Costo fisso'}{' '}
              <span className="tabular-nums">
                {fmtEur(meta.perCleaningFee)} × {fmtNum(total.cleanings)}
              </span>
            </dt>
            <dd className="tabular-nums">{fmtEur(total.feeAmount)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-auto flex items-baseline justify-between gap-4 border-t border-border bg-muted/40 px-4 py-3">
        <span className="text-sm font-semibold">Da versare</span>
        <span className="font-display text-xl font-bold tabular-nums">{fmtEur(total.total)}</span>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Compensi() {
  const apartments = useStore((s) => s.apartments)
  const requests = useStore((s) => s.requests)

  const [cursor, setCursor] = React.useState<Date>(TODAY)
  /* Si parte dalle pulizie del mese, non dalle sole completate: all'inizio
     del mese quelle sono zero e la pagina sembrava rotta. */
  const [basis, setBasis] = React.useState<Basis>('tutte')

  const apartmentById = React.useMemo(() => new Map(apartments.map((a) => [a.id, a])), [apartments])

  /* Pulizie del mese: fa fede il check-out, cioe' quando si interviene. */
  const monthly = React.useMemo(
    () =>
      requests.filter((r) => {
        if (isCancelled(r)) return false
        if (basis === 'completate' && r.status !== 'completata') return false
        return isSameMonth(asDate(r.checkOutAt), cursor)
      }),
    [requests, cursor, basis],
  )

  const totals = React.useMemo<CompanyTotal[]>(() => {
    const byCompany = new Map<CleaningCompanyId, Map<string, Line>>()
    for (const c of CLEANING_COMPANIES) byCompany.set(c, new Map())

    for (const r of monthly) {
      const apt = apartmentById.get(r.apartmentId)
      if (!apt) continue
      const lines = byCompany.get(apt.companyId)
      if (!lines) continue
      const line = lines.get(apt.id) ?? { apartment: apt, cleanings: 0, amount: 0 }
      line.cleanings += 1
      line.amount += priceForGuests(apt, r.checkInPeople)
      lines.set(apt.id, line)
    }

    return CLEANING_COMPANIES.map((id) => {
      const lines = [...(byCompany.get(id)?.values() ?? [])].sort((a, b) => b.amount - a.amount)
      const cleanings = lines.reduce((n, l) => n + l.cleanings, 0)
      const cleaningAmount = lines.reduce((n, l) => n + l.amount, 0)
      const feeAmount = cleanings * COMPANY_META[id].perCleaningFee
      return { id, lines, cleanings, cleaningAmount, feeAmount, total: cleaningAmount + feeAmount }
    })
  }, [monthly, apartmentById])

  const grandTotal = totals.reduce((n, t) => n + t.total, 0)
  const totalCleanings = totals.reduce((n, t) => n + t.cleanings, 0)
  const rows = totals.flatMap((t) => t.lines.map((l) => ({ company: t.id, ...l })))

  const exportCsv = () => {
    const data = [
      ...rows.map((l) => ({
        Mese: fmtMonthYear(cursor),
        Ditta: COMPANY_META[l.company].label,
        Appartamento: l.apartment.name,
        Indirizzo: l.apartment.address,
        Pulizie: l.cleanings,
        'Totale pulizie': l.amount,
      })),
      ...totals
        .filter((t) => t.cleanings > 0)
        .map((t) => ({
          Mese: fmtMonthYear(cursor),
          Ditta: COMPANY_META[t.id].label,
          Appartamento: `TOTALE ${COMPANY_META[t.id].label}`,
          Indirizzo: COMPANY_META[t.id].perCleaningFee > 0
            ? `${COMPANY_META[t.id].perCleaningFeeLabel}: ${t.feeAmount.toFixed(2)}`
            : '',
          Pulizie: t.cleanings,
          'Totale pulizie': t.total,
        })),
    ]
    downloadFile(`compensi-${fmtDate(startOfMonth(cursor))}.csv`, toCsv(data))
  }

  const move = (dir: -1 | 1) => setCursor((c) => addMonths(c, dir))
  const monthEnd = endOfMonth(cursor)

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Compensi ditte di pulizie"
        subtitle={
          <span>
            <span className="capitalize">{fmtMonthYear(cursor)}</span> ·{' '}
            {plural(totalCleanings, 'pulizia conteggiata', 'pulizie conteggiate')} · chiusura al{' '}
            {fmtDate(monthEnd)}
          </span>
        }
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download />
            <span className="hidden sm:inline">Esporta CSV</span>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={() => move(-1)} aria-label="Mese precedente">
            <ChevronLeft />
          </Button>
          <MonthPicker value={cursor} onChange={setCursor} />
          <Button variant="ghost" size="icon" onClick={() => move(1)} aria-label="Mese successivo">
            <ChevronRight />
          </Button>
        </div>

        <Tabs
          className="ml-auto"
          value={basis}
          onChange={setBasis}
          aria-label="Quali pulizie entrano nel conto"
          items={BASIS_ITEMS}
        />
      </div>

      <div className="space-y-4 p-4">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {totals.map((t) => (
            <CompanyCard key={t.id} total={t} />
          ))}

          <Card className="flex min-w-0 flex-col overflow-hidden ring-1 ring-inset ring-primary/20">
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand">
                <Receipt className="size-4" />
              </span>
              <h2 className="font-display text-sm font-bold">Totale del mese</h2>
            </div>
            <dl className="space-y-1.5 px-4 py-3 text-sm">
              {totals.map((t) => (
                <div key={t.id} className="flex items-baseline justify-between gap-4">
                  <dt className="text-muted-foreground">{COMPANY_META[t.id].label}</dt>
                  <dd className="tabular-nums">{fmtEur(t.total)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-auto flex items-baseline justify-between gap-4 border-t border-border bg-primary/5 px-4 py-3">
              <span className="text-sm font-semibold">Esborso complessivo</span>
              <span className="font-display text-xl font-bold tabular-nums text-brand">{fmtEur(grandTotal)}</span>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
            <h2 className="font-display text-sm font-bold">Dettaglio per appartamento</h2>
            <p className="text-xs text-muted-foreground">
              Tariffa per numero di ospiti in arrivo; il costo fisso della ditta è sommato a parte.
            </p>
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nessuna pulizia da conteggiare"
              description={`Non risultano pulizie ${
                basis === 'completate' ? 'completate' : 'attive'
              } con check-out in ${fmtMonthYear(cursor)}.`}
            />
          ) : (
            <>
              {/* schede sotto md, tabella da md in su */}
              <div className="divide-y divide-border md:hidden">
                {rows.map((l) => (
                  <MobileRecord
                    key={`${l.company}-${l.apartment.id}`}
                    title={l.apartment.name}
                    subtitle={`${l.apartment.district} · ${l.apartment.city}`}
                    fields={[
                      { label: 'Ditta', value: <CompanyBadge companyId={l.company} /> },
                      { label: 'Pulizie', value: fmtNum(l.cleanings) },
                      { label: 'Totale', value: fmtEur(l.amount) },
                    ]}
                  />
                ))}
              </div>

              <TableScroller innerClassName="overflow-x-auto">
                <Table className="hidden min-w-[720px] md:table">
                  <thead>
                    <tr>
                      <Th>Appartamento</Th>
                      <Th>Indirizzo</Th>
                      <Th>Ditta pulizie</Th>
                      <Th className="text-right">Pulizie</Th>
                      <Th className="text-right">Totale pulizie</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((l) => (
                      <tr key={`${l.company}-${l.apartment.id}`} className="border-b border-border/60 last:border-0">
                        <Td className="font-medium">{l.apartment.name}</Td>
                        <Td className="text-muted-foreground">{l.apartment.address}</Td>
                        <Td><CompanyBadge companyId={l.company} /></Td>
                        <Td className="text-right tabular-nums">{fmtNum(l.cleanings)}</Td>
                        <Td className="text-right font-medium tabular-nums">{fmtEur(l.amount)}</Td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    {totals
                      .filter((t) => t.cleanings > 0)
                      .map((t) => (
                        <tr key={t.id} className="border-t border-border bg-muted/40">
                          <Td className="font-semibold" colSpan={2}>
                            Totale {COMPANY_META[t.id].label}
                            {COMPANY_META[t.id].perCleaningFee > 0 && (
                              <span className="ml-1.5 font-normal text-muted-foreground">
                                (compreso {COMPANY_META[t.id].perCleaningFeeLabel?.toLowerCase()}{' '}
                                {fmtEur(t.feeAmount)})
                              </span>
                            )}
                          </Td>
                          <Td />
                          <Td className="text-right font-semibold tabular-nums">{fmtNum(t.cleanings)}</Td>
                          <Td className="text-right font-semibold tabular-nums">{fmtEur(t.total)}</Td>
                        </tr>
                      ))}
                  </tfoot>
                </Table>
              </TableScroller>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
