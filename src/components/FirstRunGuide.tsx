import * as React from 'react'
import { ArrowRight, BedDouble, CalendarCheck, ClipboardList, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useCurrentUser } from '@/data/store'

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
      className="relative mx-4 mt-4 overflow-hidden rounded-xl border border-brand/20 bg-brand/[0.04] p-5"
    >
      <button
        type="button"
        onClick={dismiss}
        aria-label="Nascondi la guida"
        className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
      >
        <X className="size-4" />
      </button>

      <p className="eyebrow">Come funziona</p>
      <h2 id="guida-titolo" className="mt-1 font-display text-lg font-bold tracking-tight">
        Tre cose e hai capito tutto il resto
      </h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
                  {s.title}
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
        <span className="text-xs text-muted-foreground">
          Il punto interrogativo accanto ai termini apre sempre la spiegazione.
        </span>
      </div>
    </section>
  )
}
