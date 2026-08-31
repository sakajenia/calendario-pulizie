import * as React from 'react'
import {
  ArrowRightLeft, ChevronDown, ChevronUp, ChevronsUpDown, Download, MoreVertical,
  Pencil, Plus, Search, ShieldAlert, Trash2, UserCheck, Users, UserX,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Checkbox, MobileRecord,
  Dialog, Dropdown, DropdownItem, DropdownSeparator, EmptyState, Field, Input, Select,
  Switch, Table, Td, Th, Tooltip,
} from '@/components/ui'
import { useCurrentUser, useStore } from '@/data/store'
import { asDate, downloadFile, fmtDate, fmtNum, fmtRelative, norm, plural, toCsv } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { User, UserRole } from '@/types'

const ROLES: UserRole[] = ['admin', 'host', 'operator']

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Amministratore',
  host: 'Host',
  operator: 'Operatore',
}

/** Forma plurale minuscola per i conteggi nel sottotitolo. */
const ROLE_PLURAL: Record<UserRole, string> = {
  admin: 'amministratori',
  host: 'host',
  operator: 'operatori',
}

const ROLE_CHIP: Record<UserRole, string> = {
  admin: 'bg-primary/10 text-brand ring-1 ring-inset ring-primary/25',
  host: 'bg-status-progress/12 text-status-progress ring-1 ring-inset ring-status-progress/25',
  operator: 'bg-status-verify/12 text-status-verify ring-1 ring-inset ring-status-verify/25',
}

const ROLE_ORDER: Record<UserRole, number> = { admin: 0, host: 1, operator: 2 }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type StatusFilter = 'all' | 'active' | 'inactive'
type SortKey = 'name' | 'email' | 'role' | 'status' | 'requests' | 'createdAt'
type SortDir = 'asc' | 'desc'

const SORT_LABEL: Record<SortKey, string> = {
  name: 'Nome',
  email: 'Email',
  role: 'Ruolo',
  status: 'Stato',
  requests: 'Richieste collegate',
  createdAt: 'Data di creazione',
}

/** Utente + i dati derivati usati da filtri, ordinamento, export e migrazione. */
interface Row {
  user: User
  refHostName: string
  hostRequests: number
  assignedRequests: number
  requestCount: number
  apartmentCount: number
}

const uid = () => `u-${Math.random().toString(36).slice(2, 10)}`

const initials = (name: string) =>
  name.trim().split(/\s+/).map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase() || '?'

/* ------------------------------------------------------------------- chip */

function RoleBadge({ role }: { role: UserRole }) {
  return <Badge className={ROLE_CHIP[role]}>{ROLE_LABEL[role]}</Badge>
}

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <Badge
      className={
        active
          ? 'bg-status-accepted/12 text-status-accepted ring-1 ring-inset ring-status-accepted/25'
          : 'bg-status-cancelled/12 text-status-cancelled ring-1 ring-inset ring-status-cancelled/25'
      }
    >
      <span className={cn('size-1.5 rounded-full', active ? 'bg-status-accepted' : 'bg-status-cancelled')} />
      {active ? 'Attivo' : 'Non attivo'}
    </Badge>
  )
}

/* ------------------------------------------------------------- intestazioni */

function SortHeader({
  label, sortKey, current, dir, onSort, className,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: SortDir
  onSort: (k: SortKey) => void; className?: string
}) {
  const active = current === sortKey
  return (
    <Th className={className} aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        aria-label={`Ordina per ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded uppercase tracking-wide transition-colors focus-ring hover:text-foreground',
          active && 'text-foreground',
        )}
      >
        {label}
        {active
          ? dir === 'asc' ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />
          : <ChevronsUpDown className="size-3.5 opacity-40" />}
      </button>
    </Th>
  )
}

/* -------------------------------------------------------------------- form */

interface Draft {
  name: string
  email: string
  phone: string
  role: UserRole
  refHostId: string
  active: boolean
}

const emptyDraft: Draft = { name: '', email: '', phone: '', role: 'operator', refHostId: '', active: true }

function UserForm({
  open, onClose, initial, hosts, users,
}: {
  open: boolean
  onClose: () => void
  initial: User | null
  hosts: User[]
  users: User[]
}) {
  const upsertUser = useStore((s) => s.upsertUser)
  const [draft, setDraft] = React.useState<Draft>(emptyDraft)
  const [errors, setErrors] = React.useState<{ name?: string; email?: string }>({})

  React.useEffect(() => {
    if (!open) return
    setErrors({})
    setDraft(
      initial
        ? {
            name: initial.name,
            email: initial.email,
            phone: initial.phone ?? '',
            role: initial.role,
            refHostId: initial.refHostId ?? '',
            active: initial.active,
          }
        : emptyDraft,
    )
  }, [open, initial])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const name = draft.name.trim()
    const email = draft.email.trim().toLowerCase()
    const next: { name?: string; email?: string } = {}

    if (!name) next.name = 'Inserisci un nome'
    if (!EMAIL_RE.test(email)) next.email = 'Inserire un indirizzo email valido'
    else if (users.some((u) => u.id !== initial?.id && u.email.toLowerCase() === email)) {
      next.email = 'Email già in uso'
    }

    setErrors(next)
    if (next.name || next.email) return

    upsertUser({
      id: initial?.id ?? uid(),
      name,
      email,
      phone: draft.phone.trim() || undefined,
      role: draft.role,
      active: draft.active,
      refHostId: draft.role === 'operator' && draft.refHostId ? draft.refHostId : undefined,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
    })
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={initial ? 'Modifica utente' : 'Nuovo utente'}
      description={initial ? initial.email : 'Le credenziali di accesso vengono inviate via email.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Annulla</Button>
          <Button type="submit" form="user-form">{initial ? 'Salva modifiche' : 'Crea utente'}</Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome" error={errors.name}>
          <Input
            value={draft.name}
            placeholder="Nome e cognome, o ragione sociale"
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" error={errors.email}>
            <Input
              type="email"
              autoComplete="off"
              value={draft.email}
              placeholder="nome@propromanager.com"
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
            />
          </Field>

          <Field label="Telefono" hint="Usato per le comunicazioni operative.">
            <Input
              type="tel"
              value={draft.phone}
              placeholder="+39 340 000 0000"
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Ruolo">
            <Select
              value={draft.role}
              onChange={(e) => {
                const role = e.target.value as UserRole
                setDraft((d) => ({ ...d, role, refHostId: role === 'operator' ? d.refHostId : '' }))
              }}
              options={ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          </Field>

          {draft.role === 'operator' && (
            <Field label="Host di riferimento" hint="Determina quali richieste vede l'operatore.">
              <Select
                value={draft.refHostId}
                onChange={(e) => setDraft((d) => ({ ...d, refHostId: e.target.value }))}
                options={[
                  { value: '', label: 'Nessun host di riferimento' },
                  ...hosts.map((h) => ({ value: h.id, label: h.name })),
                ]}
              />
            </Field>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium">Utente attivo</p>
            <p className="text-xs text-muted-foreground">Un utente non attivo non può accedere all'applicazione.</p>
          </div>
          <Switch
            checked={draft.active}
            onChange={(active) => setDraft((d) => ({ ...d, active }))}
            label="Utente attivo"
          />
        </div>
      </form>
    </Dialog>
  )
}

/* ------------------------------------------------------------------ pagina */

export default function Utenti() {
  const currentUser = useCurrentUser()
  const users = useStore((s) => s.users)
  const apartments = useStore((s) => s.apartments)
  const requests = useStore((s) => s.requests)
  const deleteUser = useStore((s) => s.deleteUser)
  const setUsersActive = useStore((s) => s.setUsersActive)
  const upsertUser = useStore((s) => s.upsertUser)
  const upsertApartment = useStore((s) => s.upsertApartment)
  const upsertRequest = useStore((s) => s.upsertRequest)

  const [text, setText] = React.useState('')
  const [roleFilter, setRoleFilter] = React.useState<UserRole | 'all'>('all')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const [sortKey, setSortKey] = React.useState<SortKey>('name')
  const [sortDir, setSortDir] = React.useState<SortDir>('asc')
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set())

  const [formOpen, setFormOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(null)

  const [migrationOpen, setMigrationOpen] = React.useState(true)
  const [migrateFrom, setMigrateFrom] = React.useState('')
  const [migrateTo, setMigrateTo] = React.useState('')
  const [migrateConfirm, setMigrateConfirm] = React.useState(false)
  const [migrationNote, setMigrationNote] = React.useState('')

  const hosts = React.useMemo(() => users.filter((u) => u.role === 'host'), [users])

  const rows = React.useMemo<Row[]>(() => {
    const nameById = new Map(users.map((u) => [u.id, u.name]))
    const asHost = new Map<string, number>()
    const asAssignee = new Map<string, number>()
    for (const r of requests) {
      asHost.set(r.hostId, (asHost.get(r.hostId) ?? 0) + 1)
      if (r.assigneeId) asAssignee.set(r.assigneeId, (asAssignee.get(r.assigneeId) ?? 0) + 1)
    }
    const owned = new Map<string, number>()
    for (const a of apartments) owned.set(a.ownerId, (owned.get(a.ownerId) ?? 0) + 1)

    return users.map((u) => {
      const hostRequests = asHost.get(u.id) ?? 0
      const assignedRequests = asAssignee.get(u.id) ?? 0
      return {
        user: u,
        refHostName: u.refHostId ? nameById.get(u.refHostId) ?? 'Host non trovato' : '',
        hostRequests,
        assignedRequests,
        requestCount: hostRequests + assignedRequests,
        apartmentCount: owned.get(u.id) ?? 0,
      }
    })
  }, [users, requests, apartments])

  const filtered = React.useMemo(() => {
    const q = norm(text.trim())
    const list = rows.filter((r) => {
      if (roleFilter !== 'all' && r.user.role !== roleFilter) return false
      if (statusFilter === 'active' && !r.user.active) return false
      if (statusFilter === 'inactive' && r.user.active) return false
      if (q && !norm(`${r.user.name} ${r.user.email}`).includes(q)) return false
      return true
    })

    const primary = (a: Row, b: Row): number => {
      switch (sortKey) {
        case 'email': return a.user.email.localeCompare(b.user.email, 'it')
        case 'role': return ROLE_ORDER[a.user.role] - ROLE_ORDER[b.user.role]
        case 'status': return Number(a.user.active) - Number(b.user.active)
        case 'requests': return a.requestCount - b.requestCount
        case 'createdAt': return asDate(a.user.createdAt).getTime() - asDate(b.user.createdAt).getTime()
        default: return a.user.name.localeCompare(b.user.name, 'it')
      }
    }

    return list.sort((a, b) => {
      const r = primary(a, b)
      if (r !== 0) return sortDir === 'asc' ? r : -r
      return a.user.name.localeCompare(b.user.name, 'it')
    })
  }, [rows, text, roleFilter, statusFilter, sortKey, sortDir])

  const visibleIds = filtered.map((r) => r.user.id)
  const selectedIds = React.useMemo(
    () => filtered.filter((r) => selected.has(r.user.id)).map((r) => r.user.id),
    [filtered, selected],
  )
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = !allSelected && visibleIds.some((id) => selected.has(id))
  /** Le azioni multiple non toccano mai l'account con cui si è connessi. */
  const bulkIds = selectedIds.filter((id) => id !== currentUser?.id)
  const selfInSelection = selectedIds.length !== bulkIds.length

  const hasFilters = text.trim() !== '' || roleFilter !== 'all' || statusFilter !== 'all'
  const activeCount = users.filter((u) => u.active).length
  const roleCounts = ROLES.map((r) => ({ role: r, n: users.filter((u) => u.role === r).length }))

  const editing = editingId ? users.find((u) => u.id === editingId) ?? null : null
  const pendingDelete = pendingDeleteId ? rows.find((r) => r.user.id === pendingDeleteId) ?? null : null
  const deleteBlocked = pendingDelete !== null && pendingDelete.user.id === currentUser?.id

  const fromRow = migrateFrom ? rows.find((r) => r.user.id === migrateFrom) ?? null : null
  const toUser = migrateTo ? users.find((u) => u.id === migrateTo) ?? null : null
  const migrateRequests = fromRow?.hostRequests ?? 0
  const migrateApartments = fromRow?.apartmentCount ?? 0
  const canMigrate =
    fromRow !== null && toUser !== null && migrateFrom !== migrateTo &&
    migrateRequests + migrateApartments > 0

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleAll = (on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of visibleIds) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })

  const sortBy = (k: SortKey) => {
    if (k === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(k)
      setSortDir(k === 'status' || k === 'requests' || k === 'createdAt' ? 'desc' : 'asc')
    }
  }

  const clearFilters = () => {
    setText('')
    setRoleFilter('all')
    setStatusFilter('all')
  }

  const openEdit = (u: User) => {
    setEditingId(u.id)
    setFormOpen(true)
  }

  const bulkSetActive = (active: boolean) => {
    if (bulkIds.length > 0) setUsersActive(bulkIds, active)
  }

  const bulkSetRole = (role: UserRole) => {
    for (const id of bulkIds) {
      const u = users.find((x) => x.id === id)
      if (!u || u.role === role) continue
      upsertUser({ ...u, role, refHostId: role === 'operator' ? u.refHostId : undefined })
    }
  }

  const exportCsv = () => {
    const source = selectedIds.length > 0 ? filtered.filter((r) => selected.has(r.user.id)) : filtered
    const data = source.map((r) => ({
      Nome: r.user.name,
      Email: r.user.email,
      Telefono: r.user.phone ?? '',
      Ruolo: ROLE_LABEL[r.user.role],
      Stato: r.user.active ? 'Attivo' : 'Non attivo',
      'Host di riferimento': r.refHostName,
      'Richieste come host': r.hostRequests,
      'Richieste assegnate': r.assignedRequests,
      Appartamenti: r.apartmentCount,
      'Creato il': fmtDate(r.user.createdAt),
    }))
    downloadFile(`utenti-${fmtDate(new Date())}.csv`, toCsv(data))
  }

  const confirmDelete = () => {
    if (!pendingDelete || deleteBlocked) return
    deleteUser(pendingDelete.user.id)
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(pendingDelete.user.id)
      return next
    })
    setPendingDeleteId(null)
  }

  const runMigration = () => {
    if (!fromRow || !toUser) return
    for (const a of apartments) {
      if (a.ownerId === fromRow.user.id) upsertApartment({ ...a, ownerId: toUser.id })
    }
    for (const r of requests) {
      if (r.hostId === fromRow.user.id) upsertRequest({ ...r, hostId: toUser.id })
    }
    setMigrationNote(
      `Spostate ${plural(migrateRequests, 'richiesta', 'richieste')} e ` +
      `${plural(migrateApartments, 'appartamento', 'appartamenti')} da ${fromRow.user.name} a ${toUser.name}.`,
    )
    setMigrateFrom('')
    setMigrateTo('')
    setMigrateConfirm(false)
  }

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-full flex-col">
        <PageHeader title="Utenti" />
        <EmptyState
          icon={ShieldAlert}
          title="Area riservata agli amministratori"
          description="La gestione degli utenti è disponibile solo per gli account con ruolo Amministratore."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Utenti"
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span>{fmtNum(filtered.length)} di {plural(users.length, 'utente', 'utenti')}</span>
            <span aria-hidden className="text-border">|</span>
            <span>{fmtNum(activeCount)} attivi · {fmtNum(users.length - activeCount)} non attivi</span>
            <span aria-hidden className="text-border">|</span>
            <span>
              {roleCounts
                .map((r) => plural(r.n, ROLE_LABEL[r.role].toLowerCase(), ROLE_PLURAL[r.role]))
                .join(' · ')}
            </span>
          </span>
        }
        actions={
          <>
            <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
              <Download />
              <span className="hidden sm:inline">Esporta CSV</span>
            </Button>
            <Button onClick={() => { setEditingId(null); setFormOpen(true) }}>
              <Plus />
              Nuovo <span className="hidden sm:inline">utente</span>
            </Button>
          </>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-border bg-card px-5 py-3">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Filtra per nome o email"
            aria-label="Filtra per nome o email"
            className="h-9 pl-9"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            aria-label="Filtra per ruolo"
            className="h-9"
            options={[
              { value: 'all', label: 'Tutti i ruoli' },
              ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
            ]}
          />
        </div>

        <div className="w-full sm:w-44">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            aria-label="Filtra per stato"
            className="h-9"
            options={[
              { value: 'all', label: 'Tutti gli stati' },
              { value: 'active', label: 'Solo attivi' },
              { value: 'inactive', label: 'Solo non attivi' },
            ]}
          />
        </div>

        {hasFilters && (
          <Button variant="link" size="sm" className="ml-auto" onClick={clearFilters}>
            Cancella filtri
          </Button>
        )}
      </div>

      {selectedIds.length > 0 && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b border-border bg-primary/5 px-5 py-2.5">
          <span className="text-sm font-medium">
            {plural(selectedIds.length, 'utente selezionato', 'utenti selezionati')}
          </span>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cambia lo stato degli utenti selezionati</span>
            <Button variant="outline" size="sm" disabled={bulkIds.length === 0} onClick={() => bulkSetActive(true)}>
              <UserCheck />
              Attiva
            </Button>
            <Button variant="outline" size="sm" disabled={bulkIds.length === 0} onClick={() => bulkSetActive(false)}>
              <UserX />
              Disattiva
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Cambia il ruolo degli utenti selezionati</span>
            <div className="w-44">
              <Select
                value=""
                disabled={bulkIds.length === 0}
                aria-label="Cambia il ruolo degli utenti selezionati"
                className="h-8 text-xs"
                onChange={(e) => {
                  if (e.target.value) bulkSetRole(e.target.value as UserRole)
                }}
                options={[
                  { value: '', label: 'Seleziona un ruolo…' },
                  ...ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
                ]}
              />
            </div>
          </div>

          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setSelected(new Set())}>
            Annulla selezione
          </Button>

          {selfInSelection && (
            <p className="w-full text-xs text-muted-foreground">
              Il tuo account ({currentUser.name}) è escluso dalle azioni multiple.
            </p>
          )}
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-auto">
        {filtered.length === 0 ? (
          <EmptyState
            icon={Users}
            title={users.length === 0 ? 'Nessun utente' : 'Nessun risultato con questi filtri'}
            description={
              users.length === 0
                ? 'Crea il primo account per iniziare ad assegnare appartamenti e richieste.'
                : 'Prova a cambiare ruolo o stato, oppure a svuotare la ricerca per nome ed email.'
            }
            action={
              users.length === 0
                ? <Button onClick={() => { setEditingId(null); setFormOpen(true) }}><Plus /> Nuovo utente</Button>
                : <Button variant="outline" onClick={clearFilters}>Cancella filtri</Button>
            }
          />
        ) : (
          <>
            <div className="stagger space-y-3 p-4 md:hidden">
              {filtered.map((r) => (
                <MobileRecord
                  key={r.user.id}
                  title={r.user.name}
                  subtitle={r.user.email}
                  selected={selected.has(r.user.id)}
                  onClick={() => openEdit(r.user)}
                  badge={<ActiveBadge active={r.user.active} />}
                  fields={[
                    { label: 'Ruolo', value: ROLE_LABEL[r.user.role] },
                    { label: 'Telefono', value: r.user.phone ?? '—' },
                    { label: 'Richieste', value: fmtNum(r.requestCount) },
                    { label: 'Creato il', value: fmtDate(r.user.createdAt) },
                  ]}
                />
              ))}
            </div>

          <Table className="hidden min-w-[1180px] md:table">
            <thead>
              <tr>
                <Th className="w-10">
                  <Checkbox
                    checked={allSelected}
                    indeterminate={someSelected}
                    onChange={toggleAll}
                    label="Seleziona tutti gli utenti filtrati"
                  />
                </Th>
                <Th className="w-10"><span className="sr-only">Azioni</span></Th>
                <SortHeader label="Nome" sortKey="name" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader label="Email" sortKey="email" current={sortKey} dir={sortDir} onSort={sortBy} />
                <Th>Telefono</Th>
                <SortHeader label="Ruolo" sortKey="role" current={sortKey} dir={sortDir} onSort={sortBy} />
                <SortHeader label="Stato" sortKey="status" current={sortKey} dir={sortDir} onSort={sortBy} />
                <Th>Host di riferimento</Th>
                <SortHeader
                  label="Richieste collegate" sortKey="requests" current={sortKey} dir={sortDir}
                  onSort={sortBy} className="text-right"
                />
                <SortHeader label="Creato il" sortKey="createdAt" current={sortKey} dir={sortDir} onSort={sortBy} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const isSelected = selected.has(r.user.id)
                const isSelf = r.user.id === currentUser.id
                return (
                  <tr
                    key={r.user.id}
                    onClick={() => openEdit(r.user)}
                    className={cn(
                      'cursor-pointer border-b border-border/60 transition-colors last:border-0',
                      isSelected ? 'bg-primary/5' : 'hover:bg-muted/50',
                      !r.user.active && 'opacity-70',
                    )}
                  >
                    <Td>
                      <Checkbox
                        checked={isSelected}
                        onChange={() => toggleOne(r.user.id)}
                        label={`Seleziona ${r.user.name}`}
                      />
                    </Td>

                    <Td onClick={(e) => e.stopPropagation()}>
                      <Dropdown
                        align="start"
                        className="w-[200px]"
                        trigger={
                          <Button variant="ghost" size="icon" className="size-7" aria-label={`Azioni ${r.user.name}`}>
                            <MoreVertical />
                          </Button>
                        }
                      >
                        <DropdownItem onClick={() => openEdit(r.user)}><Pencil /> Modifica</DropdownItem>
                        <DropdownItem onClick={() => setUsersActive([r.user.id], !r.user.active)}>
                          {r.user.active ? <UserX /> : <UserCheck />}
                          {r.user.active ? 'Disattiva' : 'Attiva'}
                        </DropdownItem>
                        <DropdownSeparator />
                        <DropdownItem danger onClick={() => setPendingDeleteId(r.user.id)}>
                          <Trash2 /> Elimina
                        </DropdownItem>
                      </Dropdown>
                    </Td>

                    <Td className="max-w-[240px]">
                      <div className="flex items-center gap-2.5">
                        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {initials(r.user.name)}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{r.user.name}</span>
                            {isSelf && (
                              <Badge className="bg-muted px-1.5 py-0 text-[10px] uppercase tracking-wide text-muted-foreground ring-1 ring-inset ring-border">
                                Tu
                              </Badge>
                            )}
                          </div>
                          {r.apartmentCount > 0 && (
                            <div className="truncate text-xs text-muted-foreground">
                              {plural(r.apartmentCount, 'appartamento', 'appartamenti')}
                            </div>
                          )}
                        </div>
                      </div>
                    </Td>

                    <Td className="max-w-[240px]">
                      <span className="block truncate text-muted-foreground">{r.user.email}</span>
                    </Td>

                    <Td className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {r.user.phone ?? <span className="text-muted-foreground/60">—</span>}
                    </Td>

                    <Td><RoleBadge role={r.user.role} /></Td>
                    <Td><ActiveBadge active={r.user.active} /></Td>

                    <Td className="max-w-[200px]">
                      {r.refHostName
                        ? <span className="block truncate text-muted-foreground">{r.refHostName}</span>
                        : <span className="text-muted-foreground/60">—</span>}
                    </Td>

                    <Td className="text-right tabular-nums">
                      {r.requestCount === 0 ? (
                        <span className="text-muted-foreground/60">0</span>
                      ) : (
                        <Tooltip
                          label={`${plural(r.hostRequests, 'richiesta come host', 'richieste come host')} · ${fmtNum(r.assignedRequests)} in carico`}
                        >
                          <span className="font-medium">{fmtNum(r.requestCount)}</span>
                        </Tooltip>
                      )}
                    </Td>

                    <Td className="whitespace-nowrap">
                      <div className="tabular-nums">{fmtDate(r.user.createdAt)}</div>
                      <div className="text-xs text-muted-foreground">{fmtRelative(r.user.createdAt)}</div>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          </>
        )}
      </div>

      <section className="shrink-0 border-t border-border bg-muted/30 px-5 py-4">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-3 space-y-0 p-4">
            <div className="space-y-1">
              <CardTitle className="text-sm">
                Trasferisci richieste e appartamenti da un utente ad un altro
              </CardTitle>
              <CardDescription className="text-xs">
                Riassegna in blocco il proprietario degli appartamenti e l'host delle richieste.
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-expanded={migrationOpen}
              onClick={() => setMigrationOpen((v) => !v)}
            >
              {migrationOpen ? <ChevronUp /> : <ChevronDown />}
              {migrationOpen ? 'Chiudi' : 'Apri'}
            </Button>
          </CardHeader>

          {migrationOpen && (
            <CardContent className="p-4 pt-0">
              {hosts.length < 2 ? (
                <p className="text-sm text-muted-foreground">
                  Servono almeno due host per poter trasferire i dati. Crea un secondo host per abilitare la migrazione.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <Field label="Da host">
                      <Select
                        value={migrateFrom}
                        onChange={(e) => {
                          const id = e.target.value
                          setMigrateFrom(id)
                          // la destinazione non e' piu' fra le opzioni se coincide con la partenza
                          setMigrateTo((to) => (to === id ? '' : to))
                          setMigrationNote('')
                        }}
                        aria-label="Host di partenza"
                        className="h-9"
                        options={[
                          { value: '', label: 'Seleziona host di partenza' },
                          ...hosts.map((h) => ({ value: h.id, label: h.name })),
                        ]}
                      />
                    </Field>

                    <Field label="A host">
                      <Select
                        value={migrateTo}
                        onChange={(e) => { setMigrateTo(e.target.value); setMigrationNote('') }}
                        aria-label="Host di destinazione"
                        className="h-9"
                        options={[
                          { value: '', label: 'Seleziona host di destinazione' },
                          ...hosts
                            .filter((h) => h.id !== migrateFrom)
                            .map((h) => ({ value: h.id, label: h.name })),
                        ]}
                      />
                    </Field>

                    <Button disabled={!canMigrate} onClick={() => setMigrateConfirm(true)}>
                      <ArrowRightLeft />
                      Migra dati
                    </Button>
                  </div>

                  <p className="mt-2.5 text-xs text-muted-foreground">
                    {migrationNote ? (
                      <span className="font-medium text-status-accepted">{migrationNote}</span>
                    ) : fromRow ? (
                      `${fromRow.user.name}: ${plural(migrateRequests, 'richiesta', 'richieste')} e ${plural(migrateApartments, 'appartamento', 'appartamenti')} trasferibili.`
                    ) : (
                      'Seleziona due host diversi per calcolare quanti elementi verranno spostati.'
                    )}
                  </p>
                </>
              )}
            </CardContent>
          )}
        </Card>
      </section>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border bg-card px-5 py-3">
        <span className="text-sm text-muted-foreground">
          Ordinati per <span className="font-medium text-foreground">{SORT_LABEL[sortKey]}</span>{' '}
          ({sortDir === 'asc' ? 'crescente' : 'decrescente'})
        </span>
        <span className="text-sm tabular-nums text-muted-foreground">
          (Utenti totali per i filtri applicati: {fmtNum(filtered.length)} | Selezionati: {fmtNum(selectedIds.length)})
        </span>
      </div>

      <UserForm
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditingId(null) }}
        initial={editing}
        hosts={hosts}
        users={users}
      />

      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDeleteId(null)}
        title={deleteBlocked ? 'Eliminazione non consentita' : 'Elimina utente'}
        size="sm"
        footer={
          deleteBlocked ? (
            <Button variant="outline" onClick={() => setPendingDeleteId(null)}>Ho capito</Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setPendingDeleteId(null)}>Annulla</Button>
              <Button variant="destructive" onClick={confirmDelete}><Trash2 /> Elimina</Button>
            </>
          )
        }
      >
        {pendingDelete && (
          <div className="space-y-3 text-sm">
            {deleteBlocked ? (
              <>
                <p>
                  Non puoi eliminare <span className="font-medium">{pendingDelete.user.name}</span>: è l'account
                  con cui hai effettuato l'accesso.
                </p>
                <p className="text-muted-foreground">
                  Accedi con un altro amministratore, oppure disattiva questo account, per poterlo rimuovere.
                </p>
              </>
            ) : (
              <>
                <p>
                  Stai per eliminare <span className="font-medium">{pendingDelete.user.name}</span>{' '}
                  ({pendingDelete.user.email}). L'operazione non è reversibile.
                </p>
                {pendingDelete.requestCount + pendingDelete.apartmentCount > 0 && (
                  <p className="rounded-md bg-muted px-3 py-2 text-muted-foreground">
                    Restano collegati a questo utente{' '}
                    {plural(pendingDelete.requestCount, 'richiesta', 'richieste')} e{' '}
                    {plural(pendingDelete.apartmentCount, 'appartamento', 'appartamenti')}: trasferiscili prima
                    di procedere, altrimenti resteranno senza titolare.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </Dialog>

      <Dialog
        open={migrateConfirm}
        onClose={() => setMigrateConfirm(false)}
        title="Conferma migrazione dati"
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setMigrateConfirm(false)}>Annulla</Button>
            <Button onClick={runMigration}><ArrowRightLeft /> Migra dati</Button>
          </>
        }
      >
        {fromRow && toUser && (
          <div className="space-y-3 text-sm">
            <p>
              Verranno spostati <span className="font-medium">{plural(migrateRequests, 'richiesta', 'richieste')}</span>{' '}
              e <span className="font-medium">{plural(migrateApartments, 'appartamento', 'appartamenti')}</span> da{' '}
              <span className="font-medium">{fromRow.user.name}</span> a{' '}
              <span className="font-medium">{toUser.name}</span>.
            </p>
            <p className="text-muted-foreground">
              Stato, date ed extra delle richieste restano invariati: cambia solo l'host di riferimento e il
              proprietario degli appartamenti.
            </p>
          </div>
        )}
      </Dialog>
    </div>
  )
}
