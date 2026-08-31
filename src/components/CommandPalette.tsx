import * as React from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight, Bell, Boxes, Building2, CalendarDays, ClipboardList, Command, LayoutDashboard,
  ListChecks, Moon, PackageOpen, Search, Settings, Sun, UserRound, Users,
} from 'lucide-react'
import { useCurrentUser, useStore } from '@/data/store'
import { useTheme } from '@/hooks/useTheme'
import { norm } from '@/lib/format'
import { cn } from '@/lib/utils'

interface Command {
  id: string
  label: string
  hint?: string
  group: string
  icon: React.ComponentType<{ className?: string }>
  run: () => void
  adminOnly?: boolean
}

/**
 * Palette comandi su Ctrl/Cmd+K.
 *
 * Con dodici sezioni, arrivare da qualsiasi punto a qualsiasi altro richiedeva
 * di sapere dove guardare nel menu. Qui si scrive quello che si cerca.
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const navigate = useNavigate()
  const user = useCurrentUser()
  const users = useStore((s) => s.users)
  const switchUser = useStore((s) => s.switchUser)
  const logout = useStore((s) => s.logout)
  const { dark, apply } = useTheme()
  const listRef = React.useRef<HTMLDivElement>(null)

  const isAdmin = user?.role === 'admin'

  const commands = React.useMemo<Command[]>(() => {
    const go = (to: string) => () => navigate(to)
    const nav: Command[] = [
      { id: 'n-cal', label: 'Calendario', hint: 'Vista mese e settimana', group: 'Vai a', icon: CalendarDays, run: go('/calendario') },
      { id: 'n-req', label: 'Richieste', hint: 'Tabella, filtri, export', group: 'Vai a', icon: ClipboardList, run: go('/richieste') },
      { id: 'n-apt', label: 'Appartamenti', hint: 'Anagrafica, letti, prezzi', group: 'Vai a', icon: Building2, run: go('/appartamenti') },
      { id: 'n-dash', label: 'Dashboard', hint: 'Andamento e budget', group: 'Vai a', icon: LayoutDashboard, run: go('/dashboard'), adminOnly: true },
      { id: 'n-usr', label: 'Utenti', group: 'Vai a', icon: Users, run: go('/utenti'), adminOnly: true },
      { id: 'n-ws', label: 'Fogli di Lavoro', group: 'Vai a', icon: ListChecks, run: go('/fogli-di-lavoro'), adminOnly: true },
      { id: 'n-task', label: 'Catalogo Task', group: 'Vai a', icon: ClipboardList, run: go('/catalogo-task'), adminOnly: true },
      { id: 'n-extra', label: 'Extra', group: 'Vai a', icon: PackageOpen, run: go('/extra'), adminOnly: true },
      { id: 'n-wh', label: 'Magazzini', group: 'Vai a', icon: Boxes, run: go('/magazzini'), adminOnly: true },
      { id: 'n-notif', label: 'Notifiche', group: 'Vai a', icon: Bell, run: go('/notifiche') },
      { id: 'n-set', label: 'Impostazioni', group: 'Vai a', icon: Settings, run: go('/impostazioni') },
    ]

    const actions: Command[] = [
      {
        id: 'a-new', label: 'Nuova richiesta di pulizia', hint: 'Apre il calendario e il modulo',
        group: 'Azioni', icon: ClipboardList,
        run: () => navigate('/calendario?nuova=1'),
      },
      {
        id: 'a-theme', label: dark ? 'Passa al tema chiaro' : 'Passa al tema scuro',
        group: 'Azioni', icon: dark ? Sun : Moon, run: () => apply(!dark),
      },
      { id: 'a-logout', label: 'Esci', group: 'Azioni', icon: ArrowRight, run: () => { logout(); navigate('/login') } },
    ]

    const profiles: Command[] = users
      .filter((u) => u.active && u.id !== user?.id)
      .map((u) => ({
        id: `p-${u.id}`,
        label: u.name,
        hint: u.role === 'admin' ? 'Amministratore' : u.role === 'host' ? 'Host' : 'Operatore',
        group: 'Cambia profilo',
        icon: UserRound,
        run: () => { switchUser(u.id); navigate('/calendario') },
      }))

    return [...nav, ...actions, ...profiles].filter((c) => !c.adminOnly || isAdmin)
  }, [navigate, users, user?.id, switchUser, logout, dark, apply, isAdmin])

  const results = React.useMemo(() => {
    const q = norm(query.trim())
    if (!q) return commands
    return commands.filter((c) => norm(`${c.label} ${c.hint ?? ''} ${c.group}`).includes(q))
  }, [commands, query])

  React.useEffect(() => { setActive(0) }, [query, open])

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    const onOpen = () => setOpen(true)
    document.addEventListener('keydown', onKey)
    document.addEventListener('ppm:command-palette', onOpen)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('ppm:command-palette', onOpen)
    }
  }, [])

  React.useEffect(() => {
    if (!open) return
    const returnTo = document.activeElement as HTMLElement | null
    setQuery('')
    return () => returnTo?.focus?.()
  }, [open])

  // Tiene la voce selezionata dentro l'area visibile mentre si scorre da tastiera.
  React.useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [active])

  if (!open) return null

  const choose = (c: Command) => { c.run(); setOpen(false) }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setOpen(false); return }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && results[active]) { e.preventDefault(); choose(results[active]) }
  }

  let lastGroup = ''

  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-start justify-center p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-foreground/45 backdrop-blur-[2px] animate-fade-in" onClick={() => setOpen(false)} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palette comandi"
        onKeyDown={onKeyDown}
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border border-border bg-popover shadow-2xl animate-scale-in"
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca una sezione, un'azione o un profilo…"
            aria-label="Cerca un comando"
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:block">
            esc
          </kbd>
        </div>

        <div ref={listRef} role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nessun comando corrisponde a “{query}”.
            </p>
          ) : (
            results.map((c, i) => {
              const header = c.group !== lastGroup ? c.group : null
              lastGroup = c.group
              const Icon = c.icon
              return (
                <React.Fragment key={c.id}>
                  {header && <p className="eyebrow px-3 pb-1 pt-3 first:pt-1">{header}</p>}
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === active}
                    data-active={i === active}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(c)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                      i === active ? 'bg-muted text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    <Icon className={cn('size-4 shrink-0', i === active && 'text-brand')} />
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{c.label}</span>
                    {c.hint && <span className="hidden truncate text-xs text-muted-foreground sm:block">{c.hint}</span>}
                  </button>
                </React.Fragment>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> scorri</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">invio</kbd> apri</span>
          <span className="ml-auto flex items-center gap-1"><Command className="size-3" /> K</span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
