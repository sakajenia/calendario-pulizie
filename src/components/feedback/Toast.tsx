import * as React from 'react'
import { createPortal } from 'react-dom'
import { Check, Info, TriangleAlert, Undo2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'info' | 'warning'

interface ToastAction {
  label: string
  onClick: () => void
}

interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  /** Un'azione di rientro, tipicamente "Annulla". Chiudere la notifica la scarta. */
  action?: ToastAction
  /** Millisecondi prima della chiusura automatica. 0 la rende persistente. */
  duration?: number
}

interface ToastItem extends ToastInput {
  id: number
}

const ToastContext = React.createContext<((t: ToastInput) => void) | null>(null)

/**
 * Notifiche brevi con azione di rientro.
 *
 * Senza riscontro un'azione riuscita e una fallita sono indistinguibili, e
 * un'eliminazione senza rientro obbliga a rifare a mano il lavoro perso.
 * Le notifiche non rubano il focus: sono annunciate con aria-live.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])
  const nextId = React.useRef(1)

  const dismiss = React.useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback((t: ToastInput) => {
    const id = nextId.current++
    setItems((list) => [...list.slice(-2), { ...t, id }])
    const ms = t.duration ?? (t.action ? 7000 : 4000)
    if (ms > 0) window.setTimeout(() => dismiss(id), ms)
  }, [dismiss])

  return (
    <ToastContext.Provider value={push}>
      {children}
      {createPortal(
        <div
          aria-live="polite"
          aria-atomic="false"
          className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6"
        >
          {items.map((t) => (
            <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  )
}

const TONE_ICON: Record<ToastTone, React.ComponentType<{ className?: string }>> = {
  success: Check,
  info: Info,
  warning: TriangleAlert,
}

const TONE_COLOR: Record<ToastTone, string> = {
  success: 'text-status-accepted',
  info: 'text-brand',
  warning: 'text-status-pending',
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const tone = toast.tone ?? 'success'
  const Icon = TONE_ICON[tone]
  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-[26rem] items-start gap-3 rounded-xl border border-border bg-popover p-3.5 shadow-raised animate-slide-up"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', TONE_COLOR[tone])} />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{toast.description}</p>
        )}
      </div>

      {toast.action && (
        <button
          type="button"
          onClick={() => { toast.action?.onClick(); onDismiss() }}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-brand transition-colors hover:bg-muted focus-ring"
        >
          <Undo2 className="size-3.5" />
          {toast.action.label}
        </button>
      )}

      <button
        type="button"
        onClick={onDismiss}
        aria-label="Chiudi notifica"
        className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring"
      >
        <X className="size-3.5" />
      </button>
    </div>
  )
}

export function useToast() {
  const push = React.useContext(ToastContext)
  if (!push) throw new Error('useToast richiede ToastProvider')
  return push
}
