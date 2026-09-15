/*
 * Interruttore fra i due calendari. Vive in testata, sopra la griglia, ed e'
 * visibile solo all'area manager: il calendario controlli e' interno.
 */
import { ShieldCheck, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CalendarMode = 'pulizie' | 'controlli'

const MODES: { value: CalendarMode; label: string; icon: typeof Sparkles }[] = [
  { value: 'pulizie', label: 'Pulizie', icon: Sparkles },
  { value: 'controlli', label: 'Controlli', icon: ShieldCheck },
]

export function CalendarModeSwitch({
  value, onChange, className,
}: { value: CalendarMode; onChange: (v: CalendarMode) => void; className?: string }) {
  return (
    <div
      role="group"
      aria-label="Calendario da visualizzare"
      className={cn('no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1', className)}
    >
      {MODES.map((m) => {
        const Icon = m.icon
        const on = value === m.value
        return (
          <button
            key={m.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(m.value)}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-ring',
              /* Verde su dove siamo: fra due calendari quasi identici la
                 posizione corrente deve saltare all'occhio, non solo staccarsi
                 dal fondo. */
              on ? 'bg-success text-success-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="size-4" />
            {m.label}
          </button>
        )
      })}
    </div>
  )
}
