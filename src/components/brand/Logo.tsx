import { cn } from '@/lib/utils'

/** Marchio esagonale ProProManager, ridisegnato in SVG dal logo ufficiale. */
export function LogoMark({ className, gradient = true }: { className?: string; gradient?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('h-8 w-8', className)} aria-hidden="true">
      <defs>
        <linearGradient id="ppm-hex" x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#B91C3C" />
          <stop offset="100%" stopColor="#6B1128" />
        </linearGradient>
      </defs>
      <path d="M50 3 93 27v46L50 97 7 73V27z" fill={gradient ? 'url(#ppm-hex)' : 'currentColor'} />
      <path d="M50 25 75 39.5v35.5h-9.5V45L50 36 34.5 45v30H25V39.5z" fill="#fff" />
      <path d="M50 51.5l8.5 5V75h-17V56.5z" fill="#fff" />
    </svg>
  )
}

/** Lockup completo: marchio + "PROPRO manager". */
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
            invert ? 'text-white' : 'text-foreground',
          )}
        >
          PROPRO
          {showR && <sup className="ml-0.5 text-[7px] font-bold align-super">®</sup>}
        </span>
        <span
          className={cn(
            'font-serif text-[13px] tracking-[0.30em] -mt-0.5',
            invert ? 'text-white/80' : 'text-foreground/80',
          )}
        >
          manager
        </span>
      </span>
    </span>
  )
}
