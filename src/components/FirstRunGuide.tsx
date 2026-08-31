import * as React from 'react'
import { ArrowRight, BedDouble, CalendarCheck, ChevronDown, ClipboardList, Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useCurrentUser } from '@/data/store'
import { cn } from '@/lib/utils'

const KEY = 'ppm-guide-dismissed'

const STEPS = [
  {
    icon: CalendarCheck,
    title: 'Una richiesta per ogni turnover',
    body: 'Quando un ospite esce e un altro entra, serve un intervento. La richiesta tiene insieme data, appartamento, ospiti attesi e letti da rifare.',
  },
  {
    icon: ClipboardList,
    title: 'Il foglio di lavoro dice cosa fare',
    body: 'Un modello di intervento già pronto, da assegnare alla richiesta. L’operatore trova l’elenco dei task invece di ricostruirlo ogni volta.',
  },
  {
    icon: BedDouble,
    title: 'Gli extra dicono cosa portare',
    body: 'Lenzuola, asciugamani, cortesie: si contano per appartamento, per letto o per persona, e si prelevano dal magazzino indicato.',
  },
]

/**
 * Spiegazione del flusso al primo accesso.
 *
 * Il vocabolario di questo mestiere non e' ovvio da fuori. La guida compare
 * una volta sola, si chiude e non torna: chi sa gia' come funziona non deve
 * ripassarci ogni giorno.
 *
 * Su schermo stretto il calendario e' la cosa che serve davvero: la guida si
 * riduce a una riga sola e i tre passi restano dietro un "Mostra". Da lg in su
 * c'e' spazio e i passi sono sempre visibili.
 */
export function FirstRunGuide() {
  const user = useCurrentUser()
  const [open, setOpen] = React.useState(() => {
    try {
      return localStorage.getItem(KEY) !== '1'
    } catch {
      return false
    }
  })
  const [expanded, setExpanded] = React.useState(false)

  const dismiss = () => {
    setOpen(false)
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      /* finestra privata: la guida ricomparira' al prossimo accesso */
    }
  }

  if (!open || !user) return null

  return (
    <section
      aria-labelledby="guida-titolo"
      className="relative mx-4 mt-4 overflow-hidden rounded-xl border border-brand/20 bg-brand/[0.04] p-3 lg:p-5"
    >
      <div className="flex items-start gap-2">
        <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand lg:hidden" aria-hidden="true" />

        <div className="min-w-0 flex-1">
          <p className="eyebrow hidden lg:block">Come funziona</p>
          <h2
            id="guida-titolo"
            className="truncate font-display text-sm font-bold tracking-tight lg:mt-1 lg:whitespace-normal lg:text-lg"
          >
            Tre cose e hai capito tutto il resto
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="guida-dettagli"
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring lg:hidden"
        >
          {expanded ? 'Nascondi' : 'Mostra'}
          <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>

        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi la guida"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring lg:p-1.5"
        >
          <X className="size-4" />
        </button>
      </div>

      <div id="guida-dettagli" className={cn(expanded ? 'block' : 'hidden', 'lg:block')}>
        <div className="mt-4 grid gap-4 lg:grid-cols-3">
          {STEPS.map((s, i) => {
            const Icon = s.icon
            return (
              <div key={s.title} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/10 font-mono text-[11px] font-bold text-brand">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-sm font-medium">
                    <Icon className="size-3.5 shrink-0 text-brand" />
                    <span className="min-w-0">{s.title}</span>
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button size="sm" onClick={dismiss}>
            Ho capito, iniziamo <ArrowRight />
          </Button>
          <span className="min-w-0 text-xs text-muted-foreground">
            Il punto interrogativo accanto ai termini apre sempre la spiegazione.
          </span>
        </div>
      </div>
    </section>
  )
}
