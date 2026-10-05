import * as React from 'react'
import { ArrowRight, BedDouble, CalendarCheck, ChevronDown, ClipboardList, Lightbulb, X } from 'lucide-react'
import { Button } from '@/components/ui'
import { useCurrentUser } from '@/data/store'
import { cn } from '@/lib/utils'

/** Il "ho capito" e' di chi lo ha detto: la chiave e' per utente, non per dispositivo. */
const KEY = 'ppm-guide-dismissed'

/** Spazio per la guida estesa: sotto questa soglia il calendario ha la precedenza. */
const SPAZIO_AMPIO = '(min-width: 1280px) and (min-height: 900px)'

function useSpazioAmpio() {
  const [ampio, setAmpio] = React.useState(() => window.matchMedia(SPAZIO_AMPIO).matches)
  React.useEffect(() => {
    const mq = window.matchMedia(SPAZIO_AMPIO)
    const aggiorna = () => setAmpio(mq.matches)
    aggiorna()
    mq.addEventListener('change', aggiorna)
    return () => mq.removeEventListener('change', aggiorna)
  }, [])
  return ampio
}

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
 * Il calendario e' la cosa che serve davvero: se lo schermo e' stretto (sotto
 * xl) o basso (meno di 900px) la guida si riduce a una riga sola e i tre passi
 * restano dietro un "Mostra". Solo con spazio di sobra i passi sono sempre
 * visibili. Alle ditte di pulizia non serve: non creano richieste.
 */
export function FirstRunGuide() {
  const user = useCurrentUser()
  const ampio = useSpazioAmpio()
  const chiave = user ? `${KEY}:${user.id}` : null
  /* Si rilegge quando cambia l'utente (cambio profilo): il "chiuso" di uno
     non deve nascondere la guida a un altro. */
  const [chiusaOra, setChiusaOra] = React.useState<string | null>(null)
  const [expanded, setExpanded] = React.useState(false)

  const gia = React.useMemo(() => {
    if (!chiave) return true
    try {
      return localStorage.getItem(chiave) === '1'
    } catch {
      return true
    }
  }, [chiave])

  const dismiss = () => {
    if (!chiave) return
    setChiusaOra(chiave)
    try {
      localStorage.setItem(chiave, '1')
    } catch {
      /* finestra privata: la guida ricomparira' al prossimo accesso */
    }
  }

  if (!user || user.role === 'operator' || gia || chiusaOra === chiave) return null

  const mostraPassi = ampio || expanded

  return (
    <section
      aria-labelledby="guida-titolo"
      className={cn(
        /* `shrink-0`: con overflow nascosto il riquadro e' comprimibile e, nel
           contenitore che scorre della pagina, si tagliava a meta' riga. */
        'relative mx-4 mt-4 shrink-0 overflow-hidden rounded-xl border border-brand/20 bg-brand/[0.04]',
        ampio ? 'p-5' : 'p-3',
      )}
    >
      <div className="flex items-start gap-2">
        {!ampio && <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />}

        <div className="min-w-0 flex-1">
          {ampio && <p className="eyebrow">Come funziona</p>}
          <h2
            id="guida-titolo"
            className={cn(
              'break-words font-display font-bold tracking-tight',
              ampio ? 'mt-1 text-lg' : 'text-sm',
            )}
          >
            Tre cose e hai capito tutto il resto
          </h2>
        </div>

        {!ampio && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-controls="guida-dettagli"
            /* Area di tocco di almeno 40px anche se la riga e' compatta. */
            className="flex min-h-10 min-w-10 shrink-0 items-center justify-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
          >
            {expanded ? 'Nascondi' : 'Mostra'}
            <ChevronDown className={cn('size-3.5 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}

        <button
          type="button"
          onClick={dismiss}
          aria-label="Nascondi la guida"
          className={cn(
            'grid min-h-10 min-w-10 shrink-0 place-items-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring',
          )}
        >
          <X className="size-4" />
        </button>
      </div>

      <div id="guida-dettagli" className={mostraPassi ? 'block' : 'hidden'}>
        <div className={cn('mt-4 grid gap-4', ampio && 'grid-cols-3')}>
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
