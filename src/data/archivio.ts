/*
 * Il dialogo con l'archivio condiviso.
 *
 * Qui non c'e' logica dell'app: solo le chiamate e il gettone di accesso. Chi
 * decide cosa mandare e cosa fare di quello che torna e' lo store (vedi
 * `sincronizza` in store.ts).
 *
 * Tutto e' pensato per funzionare anche quando l'archivio non c'e': il
 * telefono in ascensore, il database non ancora collegato, la rete che cade a
 * meta'. In quei casi l'app resta quella di prima, con i dati sul dispositivo,
 * e lo dice in Impostazioni invece di fingere che sia tutto a posto.
 */

const CHIAVE_GETTONE = 'ppm-gettone'

/** Tipi di dato che viaggiano. Devono combaciare con quelli del Worker. */
export const TIPI_SINCRONIZZATI = [
  'users', 'apartments', 'requests', 'inspections', 'interventions', 'adminExpenses',
] as const
export type TipoSincronizzato = (typeof TIPI_SINCRONIZZATI)[number]

export interface RigaArchivio {
  tipo: TipoSincronizzato
  id: string
  dati?: unknown
  eliminato?: boolean
  aggiornato?: number
}

export interface UtenteArchivio {
  id: string
  nome: string
  email: string
  username: string | null
  ruolo: string
}

let gettone: string | null = (() => {
  try {
    return localStorage.getItem(CHIAVE_GETTONE)
  } catch {
    return null
  }
})()

export const haGettone = () => gettone !== null

function salvaGettone(valore: string | null) {
  gettone = valore
  try {
    if (valore) localStorage.setItem(CHIAVE_GETTONE, valore)
    else localStorage.removeItem(CHIAVE_GETTONE)
  } catch {
    /* finestra privata: il gettone vale solo per questa sessione */
  }
}

export const dimenticaGettone = () => salvaGettone(null)

/** Risposta di ogni chiamata: o il contenuto, o il motivo per cui non c'e'. */
export type Esito<T> =
  | { ok: true; dati: T }
  | { ok: false; errore: string; scaduto?: boolean; assente?: boolean }

async function chiama<T>(percorso: string, init?: RequestInit): Promise<Esito<T>> {
  try {
    const risposta = await fetch(`/api${percorso}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...(gettone ? { authorization: `Bearer ${gettone}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
    /* 503 e' l'archivio non ancora collegato: non e' un guasto, e' una cosa
       da fare una volta sola (vedi docs/ARCHIVIO-CONDIVISO.md). */
    if (risposta.status === 503) return { ok: false, errore: 'Archivio condiviso non collegato', assente: true }
    if (risposta.status === 401) {
      salvaGettone(null)
      /* Sull'accesso il 401 dice il motivo vero (password errata, utente
         inesistente): va mostrato, non coperto da un "accesso scaduto". */
      if (percorso === '/accesso') {
        const motivo = await risposta.json().then((c) => (c as { errore?: string }).errore).catch(() => undefined)
        return { ok: false, errore: motivo ?? 'Password errata', scaduto: true }
      }
      return { ok: false, errore: 'Accesso scaduto: esci e rientra con la password', scaduto: true }
    }
    /* Un 200 che non e' JSON vuol dire che a rispondere non e' l'archivio: la
       pagina servita al posto dell'API, un portale di rete, un proxy. Vale
       come archivio assente, cosi' l'app rientra sui dati del dispositivo
       invece di credere a una risposta vuota. */
    const testo = await risposta.text()
    let corpo: unknown = null
    try {
      corpo = JSON.parse(testo)
    } catch {
      return { ok: false, errore: 'Archivio condiviso non collegato', assente: true }
    }
    if (!risposta.ok) {
      return { ok: false, errore: (corpo as { errore?: string }).errore ?? `Errore ${risposta.status}` }
    }
    return { ok: true, dati: corpo as T }
  } catch {
    /* Rete assente o pagina aperta da file: si lavora in locale. */
    return { ok: false, errore: 'Archivio non raggiungibile', assente: true }
  }
}

/** Verifica che l'archivio esista, senza bisogno di essere collegati. */
export async function archivioDisponibile(): Promise<boolean> {
  const esito = await chiama<{ ok: boolean }>('/stato')
  return esito.ok
}

export async function accediArchivio(
  identificativo: string, password: string,
): Promise<Esito<UtenteArchivio>> {
  const esito = await chiama<{ gettone?: string; utente?: UtenteArchivio }>('/accesso', {
    method: 'POST',
    body: JSON.stringify({ identificativo, password }),
  })
  if (!esito.ok) return esito
  /* Risposta senza gettone: non e' l'archivio che parla. */
  if (!esito.dati.gettone || !esito.dati.utente?.id) {
    return { ok: false, errore: 'Archivio condiviso non collegato', assente: true }
  }
  salvaGettone(esito.dati.gettone)
  return { ok: true, dati: esito.dati.utente }
}

/** Cos'e' cambiato nell'archivio dopo `da` (millisecondi del server). */
export const tiraDallArchivio = (da: number) =>
  chiama<{ record: Required<RigaArchivio>[]; adesso: number }>(`/dati?da=${da}`)

/** Manda all'archivio le righe cambiate qui. */
export const spingiNellArchivio = (record: RigaArchivio[]) =>
  chiama<{ scritti: number; adesso: number }>('/dati', {
    method: 'POST',
    body: JSON.stringify({ record }),
  })
