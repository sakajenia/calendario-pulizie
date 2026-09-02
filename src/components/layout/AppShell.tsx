import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  Bell, Boxes, Building2, CalendarDays, ClipboardList, LayoutDashboard, ListChecks,
  LogOut, Moon, PackageOpen, Search, Settings, Sun, Users, Menu, X,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { CommandPalette } from '@/components/CommandPalette'
import { Button, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui'
import { useCurrentUser, useStore } from '@/data/store'
import { isManager } from '@/lib/permissions'
import { ROLE_META } from '@/types'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

interface NavEntry {
  to: string
  label: string
  icon: LucideIcon
  /** Solo per il manager amministratore. */
  adminOnly?: boolean
  /** Nascosta agli account "pulizie": l'addetto vede solo il proprio lavoro. */
  managerOnly?: boolean
}

const PRIMARY: NavEntry[] = [
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/richieste', label: 'Richieste', icon: ClipboardList },
  { to: '/appartamenti', label: 'Appartamenti', icon: Building2, managerOnly: true },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
]

const ADMIN: NavEntry[] = [
  { to: '/utenti', label: 'Utenti', icon: Users, adminOnly: true },
  { to: '/fogli-di-lavoro', label: 'Fogli di Lavoro', icon: ListChecks, adminOnly: true },
  { to: '/catalogo-task', label: 'Catalogo Task', icon: ClipboardList, adminOnly: true },
  { to: '/extra', label: 'Extra', icon: PackageOpen, adminOnly: true },
  { to: '/magazzini', label: 'Magazzini', icon: Boxes, adminOnly: true },
]

function NavItem({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const Icon = entry.icon
  return (
    <NavLink
      to={entry.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-[background-color,color] duration-200 ease-out-expo',
          isActive
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'relative flex size-5 items-center justify-center transition-colors duration-200 ease-out-expo',
              isActive ? 'text-brand' : 'text-sidebar-foreground/55 group-hover:text-sidebar-foreground',
            )}
          >
            <Icon className="size-[18px]" strokeWidth={isActive ? 2.1 : 1.75} />
          </span>
          <span className="truncate">{entry.label}</span>
        </>
      )}
    </NavLink>
  )
}

export function AppShell() {
  const user = useCurrentUser()
  const logout = useStore((s) => s.logout)
  const notifications = useStore((s) => s.notifications)
  const users = useStore((s) => s.users)
  const switchUser = useStore((s) => s.switchUser)
  const navigate = useNavigate()
  const { dark, toggle } = useTheme()
  const [mobileOpen, setMobileOpen] = React.useState(false)

  const unread = notifications.filter((n) => !n.read).length
  const isAdmin = user?.role === 'admin'
  const manager = isManager(user)
  const allowed = (e: NavEntry) => (!e.adminOnly || isAdmin) && (!e.managerOnly || manager)
  const primary = PRIMARY.filter(allowed)
  const admin = ADMIN.filter(allowed)

  const sidebar = (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <Logo invert />
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3 no-scrollbar">
        {primary.map((e) => <NavItem key={e.to} entry={e} onNavigate={() => setMobileOpen(false)} />)}

        {admin.length > 0 && (
          <>
            <p className="px-3 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
              Amministrazione
            </p>
            {admin.map((e) => <NavItem key={e.to} entry={e} onNavigate={() => setMobileOpen(false)} />)}
          </>
        )}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <NavItem entry={{ to: '/impostazioni', label: 'Impostazioni', icon: Settings }} onNavigate={() => setMobileOpen(false)} />
      </div>
    </div>
  )

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-background">
      <CommandPalette />
      {/* Senza questo, da tastiera si attraversa tutta la navigazione a ogni pagina. */}
      <a
        href="#contenuto"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Salta al contenuto
      </a>
      <aside className="hidden w-60 shrink-0 lg:block">{sidebar}</aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-foreground/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 animate-slide-up">{sidebar}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-border bg-card px-4">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen((v) => !v)} aria-label="Menu">
            {mobileOpen ? <X /> : <Menu />}
          </Button>
          <LogoMark className="size-7 lg:hidden" />

          <div className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => document.dispatchEvent(new CustomEvent('ppm:command-palette'))}
              className="mr-1 hidden items-center gap-2 rounded-lg border border-border bg-background/60 py-1.5 pl-2.5 pr-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-ring sm:flex"
            >
              <Search className="size-4" />
              <span className="pr-6">Cerca o vai a…</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px]">⌘K</kbd>
            </button>

            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Cambia tema">
              {dark ? <Sun /> : <Moon />}
            </Button>

            <Button variant="ghost" size="icon" className="relative" onClick={() => navigate('/notifiche')} aria-label="Notifiche">
              <Bell />
              {unread > 0 && (
                <span className="absolute right-1.5 top-1.5 grid min-w-[16px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                  {unread}
                </span>
              )}
            </Button>

            <Dropdown
              className="max-w-[calc(100vw-1rem)]"
              trigger={
                <button className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-muted focus-ring">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-medium leading-tight">{user?.name}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {user ? ROLE_META[user.role].label : ''}
                    </span>
                  </span>
                </button>
              }
            >
              <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                Cambia profilo
              </p>
              {users.filter((u) => u.active).map((u) => (
                <DropdownItem key={u.id} onClick={() => { switchUser(u.id); navigate('/calendario') }}>
                  <span className={cn('size-1.5 rounded-full', u.id === user?.id ? 'bg-primary' : 'bg-border')} />
                  <span className="flex-1 truncate">{u.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">{ROLE_META[u.role].label}</span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem danger onClick={() => { logout(); navigate('/login') }}>
                <LogOut /> Logout
              </DropdownItem>
            </Dropdown>
          </div>
        </header>

        <main id="contenuto" tabIndex={-1} className="min-h-0 flex-1 overflow-y-auto focus:outline-none">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Intestazione standard di pagina. */
export function PageHeader({
  title, subtitle, actions, className,
}: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-3 border-b border-border bg-card px-5 py-4', className)}>
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-0.5 text-sm text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
