/*
 * Pezzi di calendario condivisi fra il calendario pulizie e quello controlli:
 * settimana che parte da lunedi', etichette dei giorni e dei mesi, chiave di
 * raggruppamento per giorno e selettore del mese.
 */
import * as React from 'react'
import { addDays, format, getMonth, getYear, startOfWeek } from 'date-fns'
import { it } from 'date-fns/locale'
import { CalendarCheck, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui'
import { TODAY } from '@/data/seed'
import { asDate, fmtMonthYear } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Vista del calendario, comune alle due modalita'. */
export type CalView = 'mese' | 'settimana'

/** La settimana lavorativa italiana parte da lunedi'. */
export const WEEK = { weekStartsOn: 1 } as const

export const WEEKDAYS = Array.from({ length: 7 }, (_, i) =>
  format(addDays(startOfWeek(new Date(2024, 0, 1), WEEK), i), 'EEE', { locale: it }),
)
const MONTHS = Array.from({ length: 12 }, (_, i) => format(new Date(2024, i, 1), 'LLL', { locale: it }))

/** Chiave di raggruppamento per giorno. */
export const dayKey = (v: string | Date) => format(asDate(v), 'yyyy-MM-dd')
export const ms = (v: string) => asDate(v).getTime()

/* --------------------------------------------------------- selettore mese */

export function MonthPicker({ value, onChange }: { value: Date; onChange: (d: Date) => void }) {
  const [open, setOpen] = React.useState(false)
  const [year, setYear] = React.useState(() => getYear(value))
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (open) setYear(getYear(value))
  }, [open, value])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 transition-colors hover:bg-muted focus-ring"
      >
        <span className="font-display text-base font-bold capitalize tracking-tight">{fmtMonthYear(value)}</span>
        <ChevronDown className={cn('size-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1.5 w-64 rounded-lg border border-border bg-popover p-3 shadow-raised animate-scale-in">
          <div className="mb-2 flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente">
              <ChevronLeft />
            </Button>
            <span className="text-sm font-semibold tabular-nums">{year}</span>
            <Button variant="ghost" size="icon" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo">
              <ChevronRight />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {MONTHS.map((label, i) => {
              const current = i === getMonth(value) && year === getYear(value)
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    onChange(new Date(year, i, 1))
                    setOpen(false)
                  }}
                  className={cn(
                    'rounded-md py-2 text-xs font-medium capitalize transition-colors focus-ring',
                    current ? 'bg-primary text-primary-foreground' : 'hover:bg-muted',
                  )}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            onClick={() => {
              onChange(TODAY)
              setOpen(false)
            }}
          >
            <CalendarCheck /> Mese corrente
          </Button>
        </div>
      )}
    </div>
  )
}
