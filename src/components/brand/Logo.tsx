import { cn } from '@/lib/utils'

/*
 * Marchio ProProManager: si usa il file ufficiale, non una ricostruzione.
 * `public/logo-propromanager.png` e' il lockup fornito dal cliente.
 *
 * La scritta del lockup e' nera, quindi su fondo scuro - la barra laterale -
 * l'immagine va posata su una targhetta chiara invece di essere ridisegnata.
 */
const SRC = '/logo-propromanager.png'

export function Logo({
  className, panel = false,
}: {
  className?: string
  /** Targhetta chiara sotto al logo: serve sui fondi scuri. */
  panel?: boolean
}) {
  const img = (
    <img
      src={SRC}
      alt="ProProManager"
      className={cn('h-10 w-auto select-none', className)}
      draggable={false}
    />
  )
  if (!panel) return img
  return (
    <span className="inline-flex items-center rounded-lg bg-primary-foreground px-2.5 py-1.5 shadow-card">
      {img}
    </span>
  )
}

/**
 * Solo il simbolo, per gli spazi stretti: tessera cremisi e simbolo bianco,
 * la stessa forma della favicon. I colori qui sono quelli del marchio, non del
 * tema, per questo il file e' escluso dal lint dei token.
 */
export function LogoMark({ className, rounded = true }: { className?: string; rounded?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="100" height="100" rx={rounded ? 18 : 0} fill="#A81E3F" />
      <path
        fillRule="evenodd"
        fill="#fff"
        d="M50 9 81 29v42L50 91 19 71V29zM50 19.4 73.1 34.4v31.2L50 80.6 26.9 65.6V34.4z"
      />
      <path fill="#fff" d="M30 69V45.5L50 34.5l20 11V69h-7.5V51.5L50 42.5l-12.5 9V69z" />
      <path fill="#fff" d="M50 45l6 5v25l-6 4.5-6-4.5V50z" />
    </svg>
  )
}
