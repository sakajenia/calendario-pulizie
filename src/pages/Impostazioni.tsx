import * as React from 'react'
import {
  AlertTriangle, BarChart3, Building2, CheckCircle2, ClipboardList, Clock, Database,
  Download, Info, Mail, Moon, Palette, Phone, RotateCcw, Save, Sun, UserRound,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/AppShell'
import {
  Badge, Button, Dialog,
  EmptyState, Field, Input,
} from '@/components/ui'
import { StatusChip } from '@/components/StatusChip'
import { scopeApartments, scopeRequests, useCurrentUser, useStore } from '@/data/store'
import { downloadFile, fmtDate, fmtNum, plural } from '@/lib/format'
import { REQUEST_STATUSES, ROLE_META, STATUS_META, type RequestStatus } from '@/types'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'

const APP_NAME = 'ProProManager'
const APP_VERSION = '1.0.0'
const LEGACY_APP = 'ComfyHost 1.6.5'


/** Messaggio inline che si spegne da solo dopo qualche secondo. */
function useFlash(): [string | null, (text: string) => void] {
  const [flash, setFlash] = React.useState<{ text: string; at: number } | null>(null)
  React.useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), 3500)
    return () => window.clearTimeout(t)
  }, [flash])
  return [flash?.text ?? null, React.useCallback((text: string) => setFlash({ text, at: Date.now() }), [])]
}

function Stat({
  icon: Icon, label, value, hint,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-[11px] font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1.5 font-display text-2xl font-bold tabular-nums leading-none">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export default function Impostazioni() {
  const user = useCurrentUser()
  const isAdmin = user?.role === 'admin'

  const users = useStore((s) => s.users)
  const apartments = useStore((s) => s.apartments)
  const requests = useStore((s) => s.requests)
  const taskCatalog = useStore((s) => s.taskCatalog)
  const workSheets = useStore((s) => s.workSheets)
  const extraCatalog = useStore((s) => s.extraCatalog)
  const warehouses = useStore((s) => s.warehouses)
  const notifications = useStore((s) => s.notifications)
  const upsertUser = useStore((s) => s.upsertUser)
  const resetData = useStore((s) => s.resetData)

  const [form, setForm] = React.useState({ name: user?.name ?? '', phone: user?.phone ?? '' })
  const [errors, setErrors] = React.useState<{ name?: string; phone?: string }>({})
  const [profileMsg, flashProfile] = useFlash()
  const [dataMsg, flashData] = useFlash()
  const [confirmReset, setConfirmReset] = React.useState(false)

  // Il profilo puo' cambiare da fuori (switch utente, ripristino dati): risincronizza il form.
  React.useEffect(() => {
    setForm({ name: user?.name ?? '', phone: user?.phone ?? '' })
    setErrors({})
  }, [user?.id, user?.name, user?.phone])

  const { dark, apply: applyTheme } = useTheme()

  const myRequests = React.useMemo(() => scopeRequests(requests, user), [requests, user])
  const myApartments = React.useMemo(() => scopeApartments(apartments, user), [apartments, user])

  const byStatus = React.useMemo(() => {
    const acc = Object.fromEntries(REQUEST_STATUSES.map((s) => [s, 0])) as Record<RequestStatus, number>
    for (const r of myRequests) acc[r.status] += 1
    return acc
  }, [myRequests])

  const total = myRequests.length
  const done = byStatus.completata
  const pending = byStatus.in_attesa
  const completion = total ? Math.round((done / total) * 100) : 0
  const activeStatuses = REQUEST_STATUSES.filter((s) => byStatus[s] > 0)

  // Appartamenti e richieste restano filtrati per ruolo anche nel conteggio e
  // nell'export: un host non deve vedere il dataset degli altri host.
  const dataset = [
    { label: 'Utenti', value: users.length },
    { label: 'Appartamenti', value: myApartments.length },
    { label: 'Richieste', value: myRequests.length },
    { label: 'Catalogo Task', value: taskCatalog.length },
    { label: 'Fogli di Lavoro', value: workSheets.length },
    { label: 'Extra', value: extraCatalog.length },
    { label: 'Magazzini', value: warehouses.length },
    { label: 'Notifiche', value: notifications.length },
  ]
  const records = dataset.reduce((n, d) => n + d.value, 0)

  const initials =
    form.name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '—'

  const dirty = !!user && (form.name !== user.name || form.phone !== (user.phone ?? ''))

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    const name = form.name.trim()
    const phone = form.phone.trim()
    const next: { name?: string; phone?: string } = {}
    if (name.length < 2) next.name = 'Inserisci un nome di almeno 2 caratteri'
    if (phone && !/^[+0-9][0-9\s./-]{5,}$/.test(phone)) next.phone = 'Numero non valido: usa cifre, spazi e prefisso'
    setErrors(next)
    if (next.name || next.phone) return
    upsertUser({ ...user, name, phone: phone || undefined })
    flashProfile('Profilo aggiornato')
  }

  const exportAll = async () => {
    const snapshot = {
      app: APP_NAME,
      version: APP_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        // La rubrica del team esce solo per l'amministratore.
        users: isAdmin ? users : user ? [user] : [],
        apartments: myApartments,
        requests: myRequests,
        taskCatalog, workSheets, extraCatalog, warehouses, notifications,
      },
    }
    // downloadFile e' asincrona: senza await il messaggio comparirebbe anche
    // quando chi guarda rifiuta il salvataggio.
    await downloadFile(
      `propromanager-dati-${fmtDate(new Date())}.json`,
      JSON.stringify(snapshot, null, 2),
      'application/json;charset=utf-8',
    )
    flashData(`Esportati ${fmtNum(records)} record in formato JSON`)
  }

  const confirmResetData = () => {
    if (!isAdmin) return
    resetData()
    setConfirmReset(false)
    flashData('Dataset riportato allo stato iniziale')
  }

  if (!user) {
    return (
      <div>
        <PageHeader title="Impostazioni" />
        <EmptyState
          icon={UserRound}
          title="Nessun profilo attivo"
          description="Accedi con un account del team per gestire preferenze e dati dell'applicazione."
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader title="Impostazioni" subtitle="Profilo, aspetto e gestione del dataset locale." />

      <div className="mx-auto max-w-3xl px-6 sm:px-8">
        <div className="divide-y divide-border">

          {/* ------------------------------------------------------------ Profilo */}
          <section className="py-8 first:pt-7">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <UserRound className="size-4 text-brand" />
              Profilo
            </h2>
            <div>
              <form onSubmit={saveProfile} className="space-y-5" noValidate>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary font-display text-xl font-bold text-primary-foreground shadow-brand">
                    {initials}
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <p className="truncate font-display text-lg font-bold leading-tight">
                      {form.name.trim() || user.name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-primary/10 text-brand ring-1 ring-inset ring-primary/25">
                        {ROLE_META[user.role].label}
                      </Badge>
                      <Badge
                        className={cn(
                          'ring-1 ring-inset',
                          user.active
                            ? 'bg-status-accepted/12 text-status-accepted ring-status-accepted/25'
                            : 'bg-status-cancelled/12 text-status-cancelled ring-status-cancelled/25',
                        )}
                      >
                        {user.active ? 'Attivo' : 'Non attivo'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Account creato il {fmtDate(user.createdAt)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nome e cognome" error={errors.name}>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Nome e cognome"
                      autoComplete="name"
                    />
                  </Field>

                  <Field label="Telefono" error={errors.phone} hint="Usato per le comunicazioni operative." htmlFor="profilo-telefono">
                    <div className="relative">
                      <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="profilo-telefono"
                        aria-invalid={errors.phone ? true : undefined}
                        aria-describedby="profilo-telefono-desc"
                        className="pl-9"
                        value={form.phone}
                        onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                        placeholder="+39 333 000 0000"
                        autoComplete="tel"
                      />
                    </div>
                  </Field>

                  <Field label="Email" hint="L'indirizzo di accesso non è modificabile." htmlFor="profilo-email">
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input id="profilo-email" aria-describedby="profilo-email-desc" className="pl-9" value={user.email} readOnly disabled />
                    </div>
                  </Field>

                  <Field label="Ruolo" hint={ROLE_META[user.role].hint}>
                    <Input value={ROLE_META[user.role].label} readOnly disabled />
                  </Field>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={!dirty}>
                    <Save /> Salva modifiche
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!dirty}
                    onClick={() => { setForm({ name: user.name, phone: user.phone ?? '' }); setErrors({}) }}
                  >
                    Annulla
                  </Button>
                  {profileMsg && (
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-status-accepted">
                      <CheckCircle2 className="size-4" /> {profileMsg}
                    </span>
                  )}
                  {!profileMsg && dirty && (
                    <span className="text-sm text-muted-foreground">Modifiche non salvate.</span>
                  )}
                </div>
              </form>
            </div>
          </section>

          {/* ----------------------------------------------------------- Aspetto */}
          <section className="py-8 first:pt-7">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <Palette className="size-4 text-brand" />
              Aspetto
            </h2>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {dark
                  ? 'Interfaccia a basso contrasto luminoso, adatta alle ore serali.'
                  : 'Interfaccia chiara, adatta alla luce diurna.'}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {([false, true] as const).map((value) => (
                  <button
                    key={String(value)}
                    type="button"
                    onClick={() => applyTheme(value)}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border p-3 text-left text-sm font-medium transition-colors focus-ring',
                      dark === value
                        ? 'border-primary bg-primary/5 text-brand'
                        : 'border-border text-muted-foreground hover:bg-muted',
                    )}
                  >
                    {value ? <Moon className="size-4" /> : <Sun className="size-4" />}
                    {value ? 'Scuro' : 'Chiaro'}
                  </button>
                ))}
              </div>

              <p className="text-xs text-muted-foreground">
                La preferenza resta su questo browser e viene riapplicata a ogni accesso.
              </p>
            </div>
          </section>

          {/* ------------------------------------------------------ Informazioni */}
          <section className="py-8 first:pt-7">
            <h2 className="mb-4 flex items-center gap-2 font-display text-base font-bold tracking-tight">
              <Info className="size-4 text-brand" />
              Informazioni
            </h2>
            <div className="space-y-3">
              <div>
                <InfoRow label="Applicazione" value={`${APP_NAME}®`} />
                <InfoRow label="Versione" value={APP_VERSION} />
                <InfoRow label="Sostituisce" value={LEGACY_APP} />
                <InfoRow label="Archiviazione" value="Locale al browser" />
              </div>
              <p className="text-xs text-muted-foreground">
                {APP_NAME} riprende il flusso operativo di {LEGACY_APP} · calendario, richieste di
                pulizia, appartamenti ed extra · con l'identità visiva e i ruoli di ProProManager.
              </p>
            </div>
          </section>

          {/* ------------------------------------------------ Piano di lavoro */}
          <section className="py-8 first:pt-7">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
                <BarChart3 className="size-4 shrink-0 text-brand" />
                Il tuo piano di lavoro
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {plural(total, 'richiesta visibile', 'richieste visibili')} con il profilo{' '}
                {ROLE_META[user.role].label.toLowerCase()} di {user.name}.
              </p>
            </div>
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat icon={ClipboardList} label="Richieste totali" value={fmtNum(total)} hint="Visibili al tuo ruolo" />
                <Stat icon={CheckCircle2} label="Completate" value={fmtNum(done)} hint={`${completion}% del totale`} />
                <Stat icon={Clock} label="In attesa" value={fmtNum(pending)} hint="Da accettare" />
                <Stat
                  icon={Building2}
                  label="Appartamenti"
                  value={fmtNum(myApartments.length)}
                  hint={plural(myApartments.length, 'immobile gestito', 'immobili gestiti')}
                />
              </div>

              {total === 0 ? (
                <EmptyState
                  icon={ClipboardList}
                  title="Nessuna richiesta collegata al tuo profilo"
                  description="Quando ti verranno assegnate richieste di pulizia, qui troverai avanzamento e ripartizione per stato."
                />
              ) : (
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Ripartizione per stato
                  </p>
                  {activeStatuses.map((s) => {
                    const n = byStatus[s]
                    const pct = Math.round((n / total) * 100)
                    return (
                      <div key={s} className="flex items-center gap-3">
                        <div className="w-40 shrink-0">
                          <StatusChip status={s} size="sm" />
                        </div>
                        <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn('h-full rounded-full', STATUS_META[s].dot)}
                            style={{ width: `${Math.max(pct, 2)}%` }}
                          />
                        </div>
                        <span className="w-20 shrink-0 text-right text-sm tabular-nums">
                          {fmtNum(n)} <span className="text-muted-foreground">({pct}%)</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* --------------------------------------------- Dati dimostrativi */}
          <section className="py-8 first:pt-7">
            <div className="mb-4">
              <h2 className="flex items-center gap-2 font-display text-base font-bold tracking-tight">
                <Database className="size-4 shrink-0 text-brand" />
                Dati dimostrativi
              </h2>
              <p className="mt-1 max-w-[65ch] text-sm leading-relaxed text-muted-foreground">
                L'applicazione gira su un dataset dimostrativo ricostruito dal modello di {LEGACY_APP}:
                vive nel tuo browser, non viene inviato ad alcun server e ogni modifica che fai resta
                solo su questo dispositivo. L'export contiene i dati visibili al tuo ruolo.
              </p>
            </div>
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {dataset.map((d) => (
                  <div key={d.label} className="rounded-lg border border-border px-3 py-2">
                    <p className="font-display text-lg font-bold tabular-nums leading-tight">{fmtNum(d.value)}</p>
                    <p className="text-xs text-muted-foreground">{d.label}</p>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={exportAll}>
                  <Download /> Esporta i dati
                </Button>
                {/* Il ripristino azzera il dataset condiviso, non solo la
                    porzione di chi lo esegue: resta agli amministratori. */}
                {isAdmin && (
                  <Button variant="outline" onClick={() => setConfirmReset(true)}>
                    <RotateCcw /> Ripristina dati iniziali
                  </Button>
                )}
                {dataMsg && (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-status-accepted">
                    <CheckCircle2 className="size-4" /> {dataMsg}
                  </span>
                )}
                {!dataMsg && (
                  <span className="text-sm text-muted-foreground">
                    {fmtNum(records)} record nel dataset corrente.
                  </span>
                )}
              </div>
            </div>
          </section>

        </div>
      </div>

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Ripristina dati iniziali"
        description="L'operazione riporta il dataset allo stato di partenza."
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmReset(false)}>Annulla</Button>
            <Button variant="destructive" onClick={confirmResetData}>
              <RotateCcw /> Ripristina
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div className="space-y-2 text-sm">
            <p>
              Tutte le modifiche locali andranno perse: richieste create o aggiornate, appartamenti,
              utenti, cataloghi e notifiche torneranno al dataset dimostrativo iniziale.
            </p>
            <p className="text-muted-foreground">
              Coinvolge {fmtNum(records)} record. Se vuoi conservarli, chiudi questa finestra ed esegui
              prima "Esporta i dati".
            </p>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
