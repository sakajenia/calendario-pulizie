/*
 * Catalogo Task: il registro di tutte le verifiche messe nel calendario delle
 * task operative.
 *
 * Non e' un elenco a parte da tenere aggiornato a mano: legge le voci del
 * calendario e ne estrae le task, ognuna col tag di chi la esegue, il tipo di
 * voce, la casa e il giorno. Aggiungendo una verifica dal calendario, la riga
 * compare qui da sola. La gestione interna non ha una casa: in quella colonna
 * resta il titolo della voce.
 */
import * as React from 'react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, Checkbox, EmptyState, Input, Select, Table, TableScroller,
  Tabs, Td, Th, MobileRecord,
} from '@/components/ui'
import {
  CalendarDays, ClipboardList, Download, Search, SearchX, X,
} from 'lucide-react'
import { useStore } from '@/data/store'
import { asDate, downloadFile, fmtDate, fmtDateTime, fmtNum, norm, plural, toCsv } from '@/lib/format'
import { TODAY } from '@/data/seed'
import {
  INSPECTION_KIND_META, INSPECTORS, INSPECTOR_META, inspectionStatus,
  type InspectionKind, type InspectorId,
} from '@/types'
import { cn } from '@/lib/utils'

type StateFilter = 'all' | 'done' | 'open'
type SortKey = 'when-desc' | 'when-asc' | 'name' | 'person'

/**
 * Il registro si apre sulle task di oggi: e' la domanda con cui lo si apre.
 * Domani e il mese sono a un tocco; "Tutte" resta per non nascondere le
 * scadenze dei mesi successivi.
 */
type Period = 'oggi' | 'domani' | 'mese' | 'tutte'

const PERIOD_ITEMS: { value: Period; label: string }[] = [
  { value: 'oggi', label: 'Oggi' },
  { value: 'domani', label: 'Domani' },
  { value: 'mese', label: 'Mese' },
  { value: 'tutte', label: 'Tutte' },
]

const sameDate = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

function inPeriod(when: string, period: Period, now: Date): boolean {
  if (period === 'tutte') return true
  const d = asDate(when)
  if (period === 'mese') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const riferimento = new Date(now)
  if (period === 'domani') riferimento.setDate(riferimento.getDate() + 1)
  return sameDate(d, riferimento)
}

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'when-desc', label: 'Più recenti' },
  { value: 'when-asc', label: 'Più vecchie' },
  { value: 'name', label: 'Nome task' },
  { value: 'person', label: 'Persona' },
]

interface Row {
  key: string
  inspectionId: string
  taskId: string
  name: string
  inspectorId: InspectorId
  kind: InspectionKind
  /** Nome della casa, o titolo della voce quando la casa non c'e'. */
  apartmentName: string
  /** ISO del controllo a cui la task appartiene. */
  at: string
  done: boolean
  doneAt?: string
}

function PersonBadge({ id }: { id: InspectorId }) {
  const meta = INSPECTOR_META[id]
  return (
    <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>
      <span className={cn('size-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </Badge>
  )
}

function KindBadge({ kind }: { kind: InspectionKind }) {
  const meta = INSPECTION_KIND_META[kind]
  return <Badge className={cn(meta.chip, 'px-2 py-0.5 text-[11px]')}>{meta.label}</Badge>
}

function StateBadge({ done }: { done: boolean }) {
  return (
    <Badge
      className={cn(
        'px-2 py-0.5 text-[11px] ring-1 ring-inset',
        done
          ? 'bg-status-done/12 text-status-done ring-status-done/25'
          : 'bg-status-progress/12 text-status-progress ring-status-progress/25',
      )}
    >
      {done ? 'Fatta' : 'Da fare'}
    </Badge>
  )
}

export default function CatalogoTask() {
  const inspections = useStore((s) => s.inspections)
  const apartments = useStore((s) => s.apartments)
  const setTaskDone = useStore((s) => s.setInspectionTaskDone)

  const [text, setText] = React.useState('')
  const [people, setPeople] = React.useState<InspectorId[]>([])
  const [state, setState] = React.useState<StateFilter>('all')
  const [sort, setSort] = React.useState<SortKey>('when-desc')
  const [period, setPeriod] = React.useState<Period>('oggi')

  const apartmentById = React.useMemo(
    () => new Map(apartments.map((a) => [a.id, a])), [apartments],
  )

  const rows = React.useMemo<Row[]>(
    () =>
      inspections.flatMap((i) => {
        const where = i.apartmentId
          ? (apartmentById.get(i.apartmentId)?.name ?? 'Appartamento non disponibile')
          : (i.title?.trim() || INSPECTION_KIND_META[i.kind].label)
        return i.tasks.map((t) => ({
          key: `${i.id}:${t.id}`,
          inspectionId: i.id,
          taskId: t.id,
          name: t.name,
          inspectorId: i.inspectorId,
          kind: i.kind,
          apartmentName: where,
          at: i.scheduledAt,
          done: t.done,
          doneAt: t.doneAt,
        }))
      }),
    [inspections, apartmentById],
  )

  /* Prima il periodo: gli altri filtri e i conteggi lavorano su quello. */
  const inScope = React.useMemo(
    () => rows.filter((r) => inPeriod(r.at, period, TODAY)),
    [rows, period],
  )

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    const out = inScope.filter((r) => {
      if (people.length > 0 && !people.includes(r.inspectorId)) return false
      if (state === 'done' && !r.done) return false
      if (state === 'open' && r.done) return false
      if (!q) return true
      return norm(
        `${r.name} ${r.apartmentName} ${INSPECTOR_META[r.inspectorId].label} ${INSPECTION_KIND_META[r.kind].label}`,
      ).includes(q)
    })
    const ms = (v: string) => new Date(v).getTime()
    switch (sort) {
      case 'when-asc': return out.sort((a, b) => ms(a.at) - ms(b.at))
      case 'name': return out.sort((a, b) => a.name.localeCompare(b.name, 'it'))
      case 'person':
        return out.sort(
          (a, b) =>
            INSPECTORS.indexOf(a.inspectorId) - INSPECTORS.indexOf(b.inspectorId) ||
            ms(b.at) - ms(a.at),
        )
      default: return out.sort((a, b) => ms(b.at) - ms(a.at))
    }
  }, [inScope, text, people, state, sort])

  const countByPerson = React.useMemo(() => {
    const acc = Object.fromEntries(INSPECTORS.map((p) => [p, 0])) as Record<InspectorId, number>
    for (const r of inScope) acc[r.inspectorId] += 1
    return acc
  }, [inScope])

  const countByPeriod = React.useMemo(() => {
    const acc = { oggi: 0, domani: 0, mese: 0, tutte: rows.length }
    for (const r of rows) {
      if (inPeriod(r.at, "oggi", TODAY)) acc.oggi += 1
      if (inPeriod(r.at, "domani", TODAY)) acc.domani += 1
      if (inPeriod(r.at, "mese", TODAY)) acc.mese += 1
    }
    return acc
  }, [rows])

  const doneCount = filtered.filter((r) => r.done).length
  const filtersOn = text.trim().length > 0 || people.length > 0 || state !== 'all'

  const togglePerson = (p: InspectorId) =>
    setPeople((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))

  const clear = () => {
    setText('')
    setPeople([])
    setState('all')
  }

  const exportCsv = () => {
    downloadFile(
      `catalogo-task-${period}-${fmtDate(new Date())}.csv`,
      toCsv(filtered.map((r) => ({
        Task: r.name,
        Tipo: INSPECTION_KIND_META[r.kind].label,
        Persona: INSPECTOR_META[r.inspectorId].label,
        Appartamento: r.apartmentName,
        Quando: fmtDateTime(r.at),
        Stato: r.done ? 'Fatta' : 'Da fare',
        'Spuntata il': r.doneAt ? fmtDateTime(r.doneAt) : '',
      }))),
    )
  }

  /* Le task nascono nel calendario: qui non si creano, si consultano e si
     spuntano. Il controllo a cui appartengono resta la fonte. */
  const openInspections = inspections.filter((i) => inspectionStatus(i) === 'in_corso').length

  return (
    <div className="flex min-h-full flex-col">
      <PageHeader
        title="Catalogo Task"
        subtitle={
          <span>
            {plural(inScope.length, 'task', 'task')} nel periodo scelto ·{' '}
            {plural(openInspections, 'voce aperta', 'voci aperte')} in calendario
          </span>
        }
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download />
            <span className="hidden sm:inline">Esporta CSV</span>
          </Button>
        }
      />

      <div className="space-y-3 border-b border-border bg-card px-5 py-3">
        <Tabs
          value={period}
          onChange={setPeriod}
          aria-label="Periodo delle task"
          items={PERIOD_ITEMS.map((p) => ({ ...p, count: countByPeriod[p.value] }))}
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[14rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtra per task, casa o persona"
              className="pl-9 pr-9"
              aria-label="Filtra per task, casa o persona"
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
            aria-label="Stato della task"
            value={state}
            onChange={(e) => setState(e.target.value as StateFilter)}
            options={[
              { value: 'all', label: 'Tutti gli stati' },
              { value: 'open', label: 'Da fare' },
              { value: 'done', label: 'Fatte' },
            ]}
          />
          <Select
            className="h-10 w-auto text-sm"
            aria-label="Ordinamento"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            options={SORT_OPTIONS}
          />
        </div>

        {/* tag delle persone, con quante task ciascuna */}
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setPeople([])}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
              people.length === 0 ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted',
            )}
          >
            Tutti
            <span className="tabular-nums">{inScope.length}</span>
          </button>
          {INSPECTORS.map((p) => {
            const on = people.includes(p)
            const n = countByPerson[p]
            return (
              <button
                key={p}
                type="button"
                onClick={() => togglePerson(p)}
                aria-pressed={on}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium transition-colors focus-ring',
                  on ? 'bg-muted text-foreground ring-1 ring-inset ring-border' : 'text-muted-foreground hover:bg-muted',
                  !on && n === 0 && 'opacity-45',
                )}
              >
                <span className={cn('inline-block size-2 rounded-full', INSPECTOR_META[p].dot)} />
                {INSPECTOR_META[p].label}
                <span className="tabular-nums">{n}</span>
              </button>
            )
          })}
          {filtersOn && (
            <Button variant="ghost" size="sm" className="ml-auto shrink-0" onClick={clear}>
              Cancella filtri
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-4">
          <Card>
            {inScope.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={
                  period === 'oggi' ? 'Nessuna task per oggi'
                    : period === 'domani' ? 'Nessuna task per domani'
                      : period === 'mese' ? 'Nessuna task in questo mese'
                        : 'Nessuna task'
                }
                description="Le task compaiono qui quando le aggiungi a una voce del calendario Task Operative."
                action={
                  period !== 'tutte'
                    ? <Button variant="outline" onClick={() => setPeriod('tutte')}>Mostra tutte</Button>
                    : undefined
                }
              />
            ) : (
              <EmptyState
                icon={SearchX}
                title="Nessuna task trovata"
                description="Nessun risultato per i filtri attivi."
                action={<Button variant="outline" onClick={clear}>Cancella filtri</Button>}
              />
            )}
          </Card>
        </div>
      ) : (
        <>
          {/* schede sotto md, tabella da md in su */}
          <div className="divide-y divide-border md:hidden">
            {filtered.map((r) => (
              <MobileRecord
                key={r.key}
                title={r.name}
                subtitle={r.apartmentName}
                badge={
                  <Checkbox
                    padded
                    checked={r.done}
                    onChange={(v) => setTaskDone(r.inspectionId, r.taskId, v)}
                    label={`Segna "${r.name}" come fatta`}
                  />
                }
                fields={[
                  { label: 'Tipo', value: <KindBadge kind={r.kind} /> },
                  { label: 'Persona', value: <PersonBadge id={r.inspectorId} /> },
                  { label: 'Quando', value: fmtDateTime(r.at) },
                  { label: 'Stato', value: <StateBadge done={r.done} /> },
                ]}
              />
            ))}
          </div>

          <TableScroller innerClassName="overflow-x-auto">
            <Table className="hidden min-w-[940px] md:table">
              <thead>
                <tr>
                  <Th className="w-10"><span className="sr-only">Fatta</span></Th>
                  <Th>Task</Th>
                  <Th>Tipo</Th>
                  <Th>Persona</Th>
                  <Th>Appartamento</Th>
                  <Th>Quando</Th>
                  <Th>Stato</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.key} className="border-b border-border/60 transition-colors last:border-0 hover:bg-muted/50">
                    <Td>
                      <Checkbox
                        checked={r.done}
                        onChange={(v) => setTaskDone(r.inspectionId, r.taskId, v)}
                        label={`Segna "${r.name}" come fatta`}
                      />
                    </Td>
                    <Td className={cn('font-medium', r.done && 'text-muted-foreground line-through')}>
                      {r.name}
                    </Td>
                    <Td><KindBadge kind={r.kind} /></Td>
                    <Td><PersonBadge id={r.inspectorId} /></Td>
                    <Td className="text-muted-foreground">{r.apartmentName}</Td>
                    <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" /> {fmtDateTime(r.at)}
                      </span>
                    </Td>
                    <Td><StateBadge done={r.done} /></Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroller>

          <div className="mt-auto flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3 md:sticky md:bottom-0 md:z-10">
            <span className="text-sm text-muted-foreground">
              Le task arrivano dal calendario Task Operative e si aggiornano da sole.
            </span>
            <span className="text-sm text-muted-foreground">
              (Task elencate: {fmtNum(filtered.length)} | Fatte: {fmtNum(doneCount)})
            </span>
          </div>
        </>
      )}
    </div>
  )
}
