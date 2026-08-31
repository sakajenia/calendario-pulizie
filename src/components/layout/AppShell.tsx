import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Bell, Boxes, Building2, CalendarDays, ClipboardList, LayoutDashboard, ListChecks,
  LogOut, Moon, PackageOpen, Settings, Sun, Users, Menu, X,
} from 'lucide-react'
import { Logo, LogoMark } from '@/components/brand/Logo'
import { Button, Dropdown, DropdownItem, DropdownSeparator } from '@/components/ui'
import { useCurrentUser, useStore } from '@/data/store'
import { cn } from '@/lib/utils'

interface NavEntry {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  adminOnly?: boolean
}

const PRIMARY: NavEntry[] = [
  { to: '/calendario', label: 'Calendario', icon: CalendarDays },
  { to: '/richieste', label: 'Richieste', icon: ClipboardList },
  { to: '/appartamenti', label: 'Appartamenti', icon: Building2 },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
]

const ADMIN: NavEntry[] = [
  { to: '/utenti', label: 'Utenti', icon: Users, adminOnly: true },
  { to: '/fogli-di-lavoro', label: 'Fogli di Lavoro', icon: ListChecks, adminOnly: true },
  { to: '/catalogo-task', label: 'Catalogo Task', icon: ClipboardList, adminOnly: true },
  { to: '/extra', label: 'Extra', icon: PackageOpen, adminOnly: true },
  { to: '/magazzini', label: 'Magazzini', icon: Boxes, adminOnly: true },
]

function useTheme() {
  const [dark, setDark] = React.useState(
    () => localStorage.getItem('ppm-theme') === 'dark',
  )
  React.useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('ppm-theme', dark ? 'dark' : 'light')
  }, [dark])
  return { dark, toggle: () => setDark((v) => !v) }
}

function NavItem({ entry, onNavigate }: { entry: NavEntry; onNavigate?: () => void }) {
  const Icon = entry.icon
  return (
    <NavLink
      to={entry.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
          isActive
            ? 'bg-sidebar-accent text-white'
            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span className={cn('relative flex size-5 items-center justify-center', isActive && 'text-primary')}>
            <Icon className="size-[18px]" />
          </span>
          <span className="truncate">{entry.label}</span>
          {isActive && <span className="ml-auto h-4 w-1 rounded-full bg-primary" />}
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
  const primary = PRIMARY.filter((e) => !e.adminOnly || isAdmin)
  const admin = isAdmin ? ADMIN : []

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
    <div className="flex h-screen overflow-hidden bg-background">
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
              trigger={
                <button className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-muted focus-ring">
                  <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                    {user?.name.split(' ').map((w) => w[0]).slice(0, 2).join('')}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-xs font-medium leading-tight">{user?.name}</span>
                    <span className="block text-[11px] leading-tight text-muted-foreground">
                      {user?.role === 'admin' ? 'Amministratore' : user?.role === 'host' ? 'Host' : 'Operatore'}
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
                  <span className="text-[10px] uppercase text-muted-foreground">{u.role}</span>
                </DropdownItem>
              ))}
              <DropdownSeparator />
              <DropdownItem danger onClick={() => { logout(); navigate('/login') }}>
                <LogOut /> Logout
              </DropdownItem>
            </Dropdown>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

/** Intestazione standard di pagina. */
export function PageHeader({
  title, subtitle, actions, className,
}: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
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
