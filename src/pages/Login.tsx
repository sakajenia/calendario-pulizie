import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, KeyRound, Mail, ShieldCheck, Sparkles } from 'lucide-react'
import { Button, Card, Field, Input } from '@/components/ui'
import { Logo } from '@/components/brand/Logo'
import { useStore } from '@/data/store'
import { ROLE_META, type UserRole } from '@/types'

const APP_VERSION = '1.0.0'
const DEMO_PASSWORD = '123456'

/** Le due tipologie di account, con l'utente di prova che le rappresenta. */
const DEMO_ACCOUNTS: { role: UserRole; name: string; email: string; icon: typeof ShieldCheck }[] = [
  { role: 'admin', name: 'Aurea Consulting', email: 'aurea.consulting.marketing@gmail.com', icon: ShieldCheck },
  { role: 'operator', name: 'Pulizie ProProManager', email: 'pulizie@propromanager.it', icon: Sparkles },
]

export default function Login() {
  const login = useStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('aurea.consulting.marketing@gmail.com')
  const [password, setPassword] = React.useState(DEMO_PASSWORD)
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)

  /** Unico punto di accesso: lo usano sia il modulo sia le scorciatoie di prova. */
  const run = (mail: string, pass: string) => {
    setError(undefined)
    if (!mail.trim()) return setError('Inserire un indirizzo email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail.trim())) return setError('Inserire un indirizzo email valido')
    if (!pass) return setError('Inserisci una password')

    setLoading(true)
    window.setTimeout(() => {
      const res = login(mail, pass)
      setLoading(false)
      if (res.ok) navigate('/calendario')
      else setError(res.error)
    }, 450)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    run(email, password)
  }

  /* Riempie il modulo a vista e poi entra: si vede con quali credenziali si accede. */
  const useDemo = (mail: string) => {
    if (loading) return
    setEmail(mail)
    setPassword(DEMO_PASSWORD)
    run(mail, DEMO_PASSWORD)
  }

  return (
    <div className="relative flex min-h-screen flex-col bg-background bg-dotted">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[42vh] bg-gradient-to-b from-primary/10 to-transparent"
      />

      <header className="relative z-10 px-6 py-5">
        <Logo />
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-4 pb-24">
        <div className="w-full max-w-[420px]">
          <div className="mb-7 text-center">
            <p className="mb-3 inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
              Gestione operativa pulizie
            </p>
            <h1 className="font-display text-3xl font-extrabold tracking-tight">Bentornato</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Accedi per gestire turnover, richieste e appartamenti.
            </p>
          </div>

          <Card className="p-6 shadow-raised">
            <form onSubmit={submit} className="space-y-4" noValidate>
              <Field label="Email">
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="email"
                    autoComplete="username"
                    placeholder="nome@propromanager.com"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </Field>

              <Field label="Password">
                <div className="relative">
                  <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="password"
                    autoComplete="current-password"
                    placeholder="••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </Field>

              {error && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                Accedi
              </Button>
            </form>
          </Card>

          <Card className="mt-4 p-4">
            <p className="eyebrow">Accessi di prova</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Due tipologie di account. Scegline una: il modulo si compila e l&apos;accesso parte.
            </p>

            <div className="mt-3 grid gap-2">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = a.icon
                return (
                  <button
                    key={a.role}
                    type="button"
                    disabled={loading}
                    onClick={() => useDemo(a.email)}
                    className="group flex w-full items-start gap-3 rounded-lg border border-border bg-background/60 p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted focus-ring disabled:opacity-60"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold leading-tight">{ROLE_META[a.role].label}</span>
                      <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                        {ROLE_META[a.role].hint}
                      </span>
                      <span className="mt-1 block truncate font-mono text-[11px] leading-snug text-muted-foreground">
                        {a.email}
                      </span>
                    </span>
                    <ArrowRight className="mt-1.5 size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-brand" />
                  </button>
                )
              })}
            </div>
          </Card>

          <p className="mt-4 text-center text-xs text-muted-foreground">
            Demo: usa una qualsiasi email del team con password di almeno 6 caratteri.
          </p>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border bg-card py-3 text-center text-xs text-muted-foreground">
        ProProManager® · Versione {APP_VERSION}
      </footer>
    </div>
  )
}
