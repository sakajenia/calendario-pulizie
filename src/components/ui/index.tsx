import * as React from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import { Check, ChevronDown, Loader2, X } from 'lucide-react'

/* ------------------------------------------------------------------ Button */

const BTN_VARIANTS = {
  default: 'bg-primary text-primary-foreground shadow-brand hover:bg-primary/90 active:translate-y-px',
  secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
  outline: 'border border-input bg-background hover:bg-muted hover:text-foreground',
  ghost: 'hover:bg-muted hover:text-foreground',
  destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  link: 'text-brand underline-offset-4 hover:underline',
} as const

const BTN_SIZES = {
  sm: 'h-8 rounded-md px-3 text-xs',
  md: 'h-10 rounded-md px-4 text-sm',
  lg: 'h-11 rounded-lg px-6 text-sm',
  icon: 'h-9 w-9 rounded-md',
  pill: 'h-11 rounded-full px-7 text-sm',
} as const

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BTN_VARIANTS
  size?: keyof typeof BTN_SIZES
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'md', loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-all focus-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4',
        BTN_VARIANTS[variant], BTN_SIZES[size], className,
      )}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

/* -------------------------------------------------------------------- Card */

export const Card = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('rounded-xl border border-border bg-card text-card-foreground shadow-card', className)} {...p} />
)
export const CardHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1 p-5', className)} {...p} />
)
export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <h3 className={cn('text-base font-semibold leading-none', className)} {...p} />
)
export const CardDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <p className={cn('text-sm text-muted-foreground', className)} {...p} />
)
export const CardContent = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('p-5 pt-0', className)} {...p} />
)
export const CardFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex items-center p-5 pt-0', className)} {...p} />
)

/* ------------------------------------------------------------------- Input */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors',
        'placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
        'placeholder:text-muted-foreground focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export const Label = ({ className, ...p }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
  <label className={cn('text-xs font-medium text-muted-foreground', className)} {...p} />
)

/**
 * Etichetta, controllo e messaggio collegati fra loro: senza `htmlFor` e
 * `aria-describedby` uno screen reader annuncia solo "casella di testo" e
 * l'errore non viene letto. Il controllo riceve l'id se non ne ha gia' uno.
 */
export function Field({
  label, hint, error, children, className, htmlFor,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode; className?: string
  /** Id del controllo quando e' avvolto in un contenitore (icona, prefisso) e non e' il figlio diretto. */
  htmlFor?: string
}) {
  const autoId = React.useId()
  const control = !htmlFor && React.isValidElement<Record<string, unknown>>(children) ? children : null
  const id = htmlFor ?? (control?.props.id as string | undefined) ?? autoId
  const descId = `${id}-desc`
  const described = error || hint ? descId : undefined
  const body = control
    ? React.cloneElement(control, {
        id,
        'aria-invalid': error ? true : control.props['aria-invalid'],
        'aria-describedby': [control.props['aria-describedby'], described].filter(Boolean).join(' ') || undefined,
      })
    : children
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      {body}
      {error ? (
        // Il testo in rosso e' testo, non riempimento: --destructive in tema
        // scuro non regge il 4.5:1, --status-cancelled si'.
        <p id={descId} role="alert" className="text-xs text-status-cancelled">{error}</p>
      ) : hint ? (
        <p id={descId} className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ Select */

export interface SelectOption { value: string; label: string }

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { options: SelectOption[] }
>(({ className, options, ...props }, ref) => (
  <div className="relative">
    <select
      ref={ref}
      className={cn(
        'flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 pr-9 text-sm',
        'focus-ring disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
  </div>
))
Select.displayName = 'Select'

/* ------------------------------------------------------------------- Badge */

export const Badge = ({ className, ...p }: React.HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
      className,
    )}
    {...p}
  />
)

/* ---------------------------------------------------------------- Checkbox */

export function Checkbox({
  checked, indeterminate, onChange, className, label, disabled, padded,
}: {
  checked: boolean; indeterminate?: boolean; onChange: (v: boolean) => void
  className?: string; label?: string; disabled?: boolean
  /** Area di tocco allargata (36px) per le schede su telefono: la casella da 16px da sola non basta al dito. */
  padded?: boolean
}) {
  const box = (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); onChange(!checked) }}
      className={cn(
        'grid size-4 shrink-0 place-items-center rounded border transition-colors focus-ring disabled:opacity-40',
        checked || indeterminate ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background hover:border-primary/50',
        className,
      )}
    >
      {indeterminate ? <span className="h-0.5 w-2 rounded bg-current" /> : checked ? <Check className="size-3" strokeWidth={3} /> : null}
    </button>
  )
  if (!padded) return box
  return (
    <span
      className="grid size-9 shrink-0 cursor-pointer place-items-center"
      onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked) }}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {box}
    </span>
  )
}

/* ------------------------------------------------------------------ Switch */

export function Switch({
  checked, onChange, label, disabled,
}: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-ring disabled:opacity-40',
        checked ? 'bg-primary' : 'bg-input',
      )}
    >
      <span
        className={cn(
          'inline-block size-4 transform rounded-full bg-primary-foreground shadow transition-transform',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  )
}

/* ------------------------------------------------------------------ Dialog */

export function Dialog({
  open, onClose, title, description, children, footer, size = 'md',
}: {
  open: boolean; onClose: () => void; title?: React.ReactNode; description?: string
  children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const titleId = React.useId()

  // Le pagine passano quasi sempre una funzione nuova a ogni render: se
  // l'effetto dipendesse da `onClose`, ogni modifica allo store fatta dentro
  // il dialog lo farebbe ripartire e il focus salterebbe al pulsante Chiudi.
  const onCloseRef = React.useRef(onClose)
  React.useEffect(() => { onCloseRef.current = onClose }, [onClose])

  React.useEffect(() => {
    if (!open) return
    // Alla chiusura il focus deve tornare da dove era partito, altrimenti chi
    // naviga da tastiera si ritrova all'inizio della pagina.
    const returnTo = document.activeElement as HTMLElement | null

    const focusables = () =>
      [...(panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ) ?? [])].filter((el) => el.offsetParent !== null)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onCloseRef.current(); return }
      if (e.key !== 'Tab') return
      // Il Tab non deve uscire dal dialog finche' resta aperto.
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || !panelRef.current?.contains(active))) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    // Lo scroller vero e' <main id="contenuto"> (AppShell): bloccare solo il
    // body lascerebbe la pagina di sfondo scorrevole sotto al dialog.
    const main = document.getElementById('contenuto')
    const prev = document.body.style.overflow
    const prevMain = main?.style.overflow
    document.body.style.overflow = 'hidden'
    if (main) main.style.overflow = 'hidden'
    const t = window.setTimeout(() => focusables()[0]?.focus(), 0)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      if (main) main.style.overflow = prevMain ?? ''
      window.clearTimeout(t)
      returnTo?.focus?.()
    }
  }, [open])

  if (!open) return null
  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <div className="fixed inset-0 bg-foreground/45 backdrop-blur-[2px] animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        {...(title ? { 'aria-labelledby': titleId } : { 'aria-label': 'Finestra di dialogo' })}
        className={cn(
          'relative z-10 my-auto w-full rounded-xl border border-border bg-card shadow-2xl animate-scale-in',
          width,
        )}
      >
        {(title || description) && (
          <div className="flex items-start justify-between gap-4 border-b border-border p-5">
            <div className="space-y-1">
              {title && <h2 id={titleId} className="font-display text-lg font-bold tracking-tight text-brand">{title}</h2>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi">
              <X />
            </Button>
          </div>
        )}
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-border p-4">{footer}</div>}
      </div>
    </div>
  )
}

/* ----------------------------------------------------------------- Dropdown */

/**
 * Il menu e' reso in un portal con posizione fissa, calcolata dal trigger.
 * Renderlo in linea lo faceva ritagliare dai contenitori con `overflow: auto`
 * (tabelle e liste scrollabili) proprio sulle ultime righe, dove serve di piu'.
 * Si ribalta verso l'alto quando sotto non c'e' spazio.
 */
export function Dropdown({
  trigger, children, align = 'end', className,
}: { trigger: React.ReactNode; children: React.ReactNode; align?: 'start' | 'end'; className?: string }) {
  const [open, setOpen] = React.useState(false)
  const [pos, setPos] = React.useState<{ top: number; left: number; up: boolean } | null>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const menuRef = React.useRef<HTMLDivElement>(null)

  const place = React.useCallback(() => {
    const el = anchorRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const h = menuRef.current?.offsetHeight ?? 220
    const w = menuRef.current?.offsetWidth ?? 200
    const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    const left = align === 'end' ? r.right - w : r.left
    setPos({
      top: up ? r.top - h - 4 : r.bottom + 4,
      left: Math.max(8, Math.min(left, window.innerWidth - w - 8)),
      up,
    })
  }, [align])

  React.useLayoutEffect(() => { if (open) place() }, [open, place])

  const items = () =>
    [...(menuRef.current?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]

  const close = React.useCallback((restoreFocus: boolean) => {
    setOpen(false)
    // Da tastiera il focus deve tornare al pulsante che ha aperto il menu,
    // altrimenti si riparte dall'inizio della pagina.
    if (restoreFocus) anchorRef.current?.querySelector<HTMLElement>('button, [tabindex]')?.focus()
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node
      if (!anchorRef.current?.contains(t) && !menuRef.current?.contains(t)) setOpen(false)
    }
    // In fase di cattura: Escape deve chiudere solo il menu, non anche un
    // eventuale dialog sottostante che ascolta lo stesso tasto sul documento.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); close(true); return }
      // Con Tab il focus esce dal menu: un menu aperto senza focus resterebbe appeso.
      if (e.key === 'Tab') { setOpen(false); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return
      const list = items()
      if (!list.length) return
      e.preventDefault()
      const i = list.indexOf(document.activeElement as HTMLElement)
      const next =
        e.key === 'Home' ? 0
        : e.key === 'End' ? list.length - 1
        : e.key === 'ArrowDown' ? (i + 1) % list.length
        : (i - 1 + list.length) % list.length
      list[next]?.focus()
    }
    // Il menu e' ancorato a coordinate di viewport: se la pagina scorre va richiuso.
    const onScroll = () => setOpen(false)
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    // Il focus entra nel menu appena si apre: chi naviga con Tab lo raggiunge subito.
    const t = window.setTimeout(() => items()[0]?.focus(), 0)
    return () => {
      window.clearTimeout(t)
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open, close])

  const triggerNode = React.isValidElement<Record<string, unknown>>(trigger)
    ? React.cloneElement(trigger, { 'aria-haspopup': 'menu', 'aria-expanded': open })
    : trigger

  return (
    <div ref={anchorRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{triggerNode}</div>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          /* Il focus torna al trigger prima che un eventuale dialog aperto
             dalla voce registri da dove ripartire alla chiusura. */
          onClick={() => close(true)}
          style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999 }}
          className={cn(
            'fixed z-50 min-w-[200px] overflow-hidden rounded-lg border border-border bg-popover p-1 shadow-raised animate-scale-in',
            pos ? 'visible' : 'invisible',
            className,
          )}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}

export function DropdownItem({
  className, danger, ...p
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
        danger && 'text-status-cancelled hover:bg-destructive/10 focus-visible:bg-destructive/10 [&_svg]:text-status-cancelled',
        className,
      )}
      {...p}
    />
  )
}

export const DropdownSeparator = () => <div className="my-1 h-px bg-border" />

/* ------------------------------------------------------------------- Table */

/**
 * Contenitore per tabelle piu' larghe dello schermo: scrolla in orizzontale e
 * mostra una sfumatura sul bordo finche' c'e' altro contenuto, cosi' l'ultima
 * colonna non sembra tagliata.
 */
export function TableScroller({
  className, innerClassName, children,
}: { className?: string; innerClassName?: string; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null)
  const [edges, setEdges] = React.useState({ left: false, right: false })

  const update = React.useCallback(() => {
    const el = ref.current
    if (!el) return
    const max = el.scrollWidth - el.clientWidth
    setEdges({ left: el.scrollLeft > 2, right: el.scrollLeft < max - 2 })
  }, [])

  React.useEffect(() => {
    update()
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [update, children])

  return (
    <div className={cn('relative flex min-h-0 min-w-0 flex-col', className)}>
      <div
        ref={ref}
        onScroll={update}
        // `overflow-auto` e' solo il default: se chi usa il componente indica
        // gia' un overflow (magari legato a un breakpoint) non va sovrascritto,
        // perche' twMerge non tratta `overflow-x-*` come conflitto di `overflow-*`.
        className={cn(!/(?:^|[\s:])overflow-/.test(innerClassName ?? '') && 'overflow-auto', innerClassName)}
      >
        {children}
      </div>
      {edges.left && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-0 z-20 w-8 bg-gradient-to-r from-background to-transparent" />
      )}
      {edges.right && (
        <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 z-20 w-8 bg-gradient-to-l from-background to-transparent" />
      )}
    </div>
  )
}

export const Table = ({ className, ...p }: React.TableHTMLAttributes<HTMLTableElement>) => (
  <table className={cn('w-full caption-bottom text-sm', className)} {...p} />
)
export const Th = ({ className, ...p }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
  <th
    className={cn(
      'sticky top-0 z-10 whitespace-nowrap border-b border-border bg-muted/60 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground backdrop-blur',
      className,
    )}
    {...p}
  />
)
export const Td = ({ className, ...p }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
  <td className={cn('px-3 py-2.5 align-middle', className)} {...p} />
)

/* ------------------------------------------------ Record su schermo stretto */

/**
 * Una riga di tabella densa, resa leggibile su telefono.
 * Sotto `md` una tabella a dieci colonne mostra solo la prima: titolo e campi
 * chiave vanno impilati, altrimenti il contenuto che conta resta fuori schermo
 * dietro uno scorrimento orizzontale che nessuno fa.
 */
export function MobileRecord({
  title, subtitle, badge, action, fields, onClick, selected,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  badge?: React.ReactNode
  action?: React.ReactNode
  fields: { label: string; value: React.ReactNode }[]
  onClick?: () => void
  selected?: boolean
}) {
  const interactive = Boolean(onClick)
  return (
    <div
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        // Solo i tasti premuti sulla scheda stessa: la casella e il menu al suo
        // interno gestiscono da soli Invio e Spazio.
        if (!interactive || e.target !== e.currentTarget) return
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() }
      }}
      className={cn(
        'rounded-xl border bg-card p-4 shadow-card transition-colors duration-200 ease-out-expo',
        interactive && 'cursor-pointer hover:border-primary/40 focus-ring',
        selected ? 'border-primary ring-1 ring-primary' : 'border-border',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{title}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {badge}
          {action && (
            <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>{action}</span>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-sm">
          {fields.map((f) => (
            <React.Fragment key={f.label}>
              <dt className="truncate text-muted-foreground">{f.label}</dt>
              <dd className="truncate text-right tabular-nums">{f.value}</dd>
            </React.Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  value, onChange, items, className, ...rest
}: {
  value: T; onChange: (v: T) => void; items: { value: T; label: string; count?: number }[]; className?: string
} & Pick<React.HTMLAttributes<HTMLDivElement>, 'aria-label' | 'aria-labelledby'>) {
  /* Su schermo stretto le voci scorrono su una riga: spezzare "Check-out" a
     meta' parola le rendeva illeggibili. */
  return (
    <div
      role="group"
      className={cn('no-scrollbar inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1', className)}
      {...rest}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          aria-pressed={value === it.value}
          onClick={() => onChange(it.value)}
          className={cn(
            'shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all focus-ring',
            value === it.value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {it.label}
          {it.count !== undefined && (
            <span className="ml-1.5 text-xs text-muted-foreground">{it.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------- Empty state */

export function EmptyState({
  icon: Icon, title, description, action,
}: { icon?: React.ComponentType<{ className?: string }>; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      {Icon && (
        <div className="grid size-12 place-items-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------------------------------------------------------------- Skeleton */

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn('animate-pulse rounded-md bg-muted', className)} />
)

/* ----------------------------------------------------------------- Tooltip */

/**
 * Il contenuto visibile resta il nome; il testo del suggerimento e' collegato
 * con aria-describedby. Visibile anche col focus da tastiera: un'informazione
 * solo al passaggio del mouse non esiste per chi il mouse non lo usa.
 * `focusable={false}` quando sta dentro un altro elemento interattivo.
 */
export function Tooltip({
  label, children, focusable = true,
}: { label: string; children: React.ReactNode; focusable?: boolean }) {
  const id = React.useId()
  return (
    <span className="group/tt relative inline-flex" tabIndex={focusable ? 0 : undefined} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-full z-50 mt-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background group-hover/tt:block group-focus-within/tt:block"
      >
        {label}
      </span>
    </span>
  )
}
