import * as React from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Glossario dei termini di dominio.
 *
 * "Foglio di lavoro", "extra", "letti da rifare" sono ovvi a chi gestisce
 * appartamenti da anni e opachi a chiunque altro. Invece di riscriverli con
 * parole generiche, che li renderebbero imprecisi, restano com'e' e portano
 * con se' la spiegazione.
 */
export const GLOSSARY: Record<string, string> = {
  richiesta:
    'Un intervento di pulizia fra un check-out e il check-in successivo: dice quale appartamento, quando, quanti letti rifare e quanti ospiti sono attesi.',
  'letti da rifare':
    'Quali letti vanno preparati in questo intervento. Non sempre coincidono con tutti quelli dell’appartamento: dipende da quanti ospiti arrivano.',
  extra:
    'Materiale di consumo da lasciare in appartamento. Si conta in tre modi: per appartamento (carta igienica), per letto (lenzuola) o per persona (asciugamani).',
  'foglio di lavoro':
    'Un modello di intervento: l’elenco ordinato dei task da svolgere. Si assegna a una richiesta per dire all’operatore cosa fare, senza riscriverlo ogni volta.',
  task: 'Una singola operazione con la sua stima in minuti. I task si compongono nei fogli di lavoro.',
  magazzino:
    'Il deposito da cui l’operatore preleva gli extra, col codice di accesso. Serve a sapere dove andare a prendere il materiale.',
  host: 'Chi possiede o gestisce gli appartamenti. Vede solo le proprie richieste e i propri immobili.',
  operatore: 'Chi esegue le pulizie. Vede solo gli interventi che gli sono stati assegnati.',
  'spot': 'Un appartamento non in anagrafica, inserito al volo per un intervento occasionale.',
}

/**
 * Punto interrogativo che apre una spiegazione. Si apre al passaggio del mouse
 * e col focus da tastiera, e si chiude con Escape.
 */
export function HelpTip({ term, text, className }: { term?: string; text?: string; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null)
  const ref = React.useRef<HTMLButtonElement>(null)

  const body = text ?? (term ? GLOSSARY[term.toLowerCase()] : undefined)

  const place = React.useCallback(() => {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return
    const w = 288
    setPos({
      top: r.bottom + 8,
      left: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 8)),
    })
  }, [])

  React.useEffect(() => {
    if (!open) return
    place()
    const close = () => setOpen(false)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, place])

  if (!body) return null

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label={`Cosa significa ${term ?? 'questo termine'}`}
        aria-expanded={open}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors hover:text-brand focus-ring',
          className,
        )}
      >
        <HelpCircle className="size-3.5" />
      </button>

      {open && pos && createPortal(
        <div
          role="tooltip"
          style={{ top: pos.top, left: pos.left, width: 288 }}
          className="pointer-events-none fixed z-[80] rounded-lg border border-border bg-popover p-3 text-xs leading-relaxed text-popover-foreground shadow-raised animate-scale-in"
        >
          {term && <p className="mb-1 font-semibold first-letter:uppercase">{term}</p>}
          {body}
        </div>,
        document.body,
      )}
    </>
  )
}
