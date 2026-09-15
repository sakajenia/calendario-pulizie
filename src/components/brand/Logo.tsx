import { cn } from '@/lib/utils'

/*
 * Marchio ProProManager. I colori qui sono quelli del marchio, non del tema:
 * per questo il file e' escluso dal lint dei token (vedi scripts/check-tokens.mjs).
 */

const CRIMSON = '#A81E3F'

/**
 * Il simbolo come sta nella favicon: tessera cremisi piena e simbolo bianco a
 * filo - esagono, arcata e pilastro centrale. Non porta scritta, quindi regge
 * qualsiasi fondo.
 */
export function LogoMark({ className, rounded = true }: { className?: string; rounded?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('h-8 w-8', className)} aria-hidden="true">
      <rect width="100" height="100" rx={rounded ? 18 : 0} fill={CRIMSON} />
      {/* Esagono ad anello: il pieno interno resta del fondo. */}
      <path
        fillRule="evenodd"
        fill="#fff"
        d="M50 9 81 29v42L50 91 19 71V29zM50 19.4 73.1 34.4v31.2L50 80.6 26.9 65.6V34.4z"
      />
      {/* Arcata */}
      <path fill="#fff" d="M30 69V45.5L50 34.5l20 11V69h-7.5V51.5L50 42.5l-12.5 9V69z" />
      {/* Pilastro centrale */}
      <path fill="#fff" d="M50 45l6 5v25l-6 4.5-6-4.5V50z" />
    </svg>
  )
}

/**
 * Lockup completo: simbolo + "PROPRO manager". Su fondo scuro la scritta passa
 * al bianco del marchio (`invert`).
 */
export function Logo({
  className, markClassName, invert = false, showR = true,
}: { className?: string; markClassName?: string; invert?: boolean; showR?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('h-9 w-9 shrink-0', markClassName)} />
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            'font-display text-[15px] font-extrabold tracking-[0.16em]',
            invert ? 'text-primary-foreground' : 'text-foreground',
          )}
        >
          PROPRO
          {showR && <sup className="ml-0.5 text-[7px] font-bold align-super">®</sup>}
        </span>
        <span
          className={cn(
            'font-serif text-[13px] tracking-[0.30em] -mt-0.5',
            invert ? 'text-primary-foreground/80' : 'text-foreground/80',
          )}
        >
          manager
        </span>
      </span>
    </span>
  )
}

/**
 * Lockup ufficiale. In tema chiaro e' l'immagine originale; in tema scuro la
 * scritta nera sparirebbe sul fondo, quindi subentra la versione con la
 * scritta chiara.
 */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <>
      <img
        src="/logo-propromanager.png"
        alt="ProProManager"
        className={cn('h-14 w-auto select-none dark:hidden', className)}
        draggable={false}
      />
      <Logo invert className="hidden dark:inline-flex" />
    </>
  )
}
