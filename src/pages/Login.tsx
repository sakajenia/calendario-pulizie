import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { KeyRound, Mail } from 'lucide-react'
import { Button, Card, Field, Input } from '@/components/ui'
import { Logo } from '@/components/brand/Logo'
import { useStore } from '@/data/store'

const APP_VERSION = '1.0.0'

export default function Login() {
  const login = useStore((s) => s.login)
  const navigate = useNavigate()
  const [email, setEmail] = React.useState('aurea.consulting.marketing@gmail.com')
  const [password, setPassword] = React.useState('123456')
  const [error, setError] = React.useState<string>()
  const [loading, setLoading] = React.useState(false)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(undefined)
    if (!email.trim()) return setError('Inserire un indirizzo email')
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Inserire un indirizzo email valido')
    if (!password) return setError('Inserisci una password')

    setLoading(true)
    window.setTimeout(() => {
      const res = login(email, password)
      setLoading(false)
      if (res.ok) navigate('/calendario')
      else setError(res.error)
    }, 450)
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
