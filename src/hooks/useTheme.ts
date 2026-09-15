import * as React from 'react'

const KEY = 'ppm-theme'

/*
 * Il tema e' letto in piu' punti (header e Impostazioni): tenerlo in uno stato
 * React locale ne creerebbe copie indipendenti, e cambiarlo da una parte non
 * aggiornerebbe l'altra. Sta quindi in un piccolo store esterno condiviso.
 */
const listeners = new Set<() => void>()
let current = false

function readStored(): 'dark' | 'light' | null {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : null
  } catch {
    return null
  }
}

/*
 * Nessuna scelta salvata vuol dire chiaro. Non si guarda la preferenza di
 * sistema: chi apre l'app la trova sempre in chiaro, e passa allo scuro
 * premendo la luna. Il buio deve essere una scelta, non una sorpresa.
 */

function commit(next: boolean) {
  current = next
  document.documentElement.classList.toggle('dark', next)
  listeners.forEach((l) => l())
}

/* Stato iniziale, applicato una sola volta al caricamento del modulo. */
commit(readStored() === 'dark')

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const dark = React.useSyncExternalStore(subscribe, () => current, () => false)

  const apply = React.useCallback((next: boolean) => {
    commit(next)
    try {
      localStorage.setItem(KEY, next ? 'dark' : 'light')
    } catch {
      /* finestra privata: la preferenza vale solo per questa sessione */
    }
  }, [])

  return { dark, apply, toggle: () => apply(!current) }
}
