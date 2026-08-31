import * as React from 'react'

/**
 * Segue una media query CSS dal lato JavaScript.
 * Serve quando il layout cambia davvero comportamento (non solo aspetto) tra
 * mobile e desktop: es. una finestra di riepilogo che sul desktop duplicherebbe
 * una colonna gia' visibile.
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    [query],
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** `true` da `lg` (1024px) in su: la soglia desktop usata in tutta l'app. */
export const useIsDesktop = () => useMediaQuery('(min-width: 1024px)')
