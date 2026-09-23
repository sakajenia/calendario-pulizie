import { format, formatDistanceToNow, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export const asDate = (v: string | Date | null | undefined) =>
  typeof v === 'string' ? parseISO(v) : (v ?? new Date(NaN))

const valida = (d: Date) => !Number.isNaN(d.getTime())

/*
 * Una data mancante o scritta male non deve far cadere la pagina. Prima
 * arrivava fino in fondo a date-fns, che rispondeva "Invalid time value" e
 * lasciava lo schermo bianco; adesso al suo posto compare un trattino e il
 * resto dell'elenco si vede lo stesso.
 */
const formatta = (v: string | Date | null | undefined, come: string, locale?: typeof it) => {
  const d = asDate(v)
  return valida(d) ? format(d, come, locale ? { locale } : undefined) : '—'
}

/** Formato usato in tutta l'app originale: 31-08-2026 10:00 */
export const fmtDateTime = (v: string | Date | null | undefined) => formatta(v, 'dd-MM-yyyy HH:mm')
export const fmtDate = (v: string | Date | null | undefined) => formatta(v, 'dd-MM-yyyy')
export const fmtTime = (v: string | Date | null | undefined) => formatta(v, 'HH:mm')
export const fmtDayLong = (v: string | Date | null | undefined) => formatta(v, 'EEEE d MMMM yyyy', it)
export const fmtMonthYear = (v: string | Date | null | undefined) => formatta(v, 'MMMM yyyy', it)
export const fmtRelative = (v: string | Date | null | undefined) => {
  const d = asDate(v)
  return valida(d) ? formatDistanceToNow(d, { addSuffix: true, locale: it }) : '—'
}

export const sameDay = (a: string | Date | null | undefined, b: string | Date | null | undefined) => {
  const x = asDate(a), y = asDate(b)
  return valida(x) && valida(y) && isSameDay(x, y)
}

export const fmtEur = (n: number) =>
  new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(n)

export const fmtNum = (n: number) => new Intl.NumberFormat('it-IT').format(n)

/** "3 richieste" / "1 richiesta" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * Normalizza per ricerche insensibili a maiuscole e accenti.
 * L'intervallo dei segni diacritici va scritto con escape Unicode: i caratteri
 * combinanti letterali nel sorgente diventano una regex non valida appena il
 * file viene servito o incorporato senza charset UTF-8.
 */
export const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

export function toCsv(rows: Record<string, unknown>[], headers?: string[]): string {
  if (!rows.length) return ''
  const cols = headers ?? Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n')
}

/*
 * Dentro il viewer di un Artifact i download via <a download> sono inerti: il
 * file va consegnato con la capability `downloads`, che chiede conferma a chi
 * guarda. Fuori da quel contesto resta il salvataggio via blob. La capability
 * si risolve in modo asincrono e una sola volta.
 */
type DownloadsApi = { save: (r: { filename: string; data: string }) => Promise<unknown> }

const downloadsApi: Promise<DownloadsApi | null> = (() => {
  const claude = (window as unknown as { claude?: { use?: (n: string) => Promise<unknown> } }).claude
  if (!claude?.use) return Promise.resolve(null)
  return claude.use('downloads').then((v) => (v as DownloadsApi | null) ?? null).catch(() => null)
})()

/* Il BOM va scritto come escape: un U+FEFF letterale nel sorgente e' invisibile
   e si perde al primo passaggio di encoding. Serve a Excel per riconoscere
   l'UTF-8 nei CSV. */
const BOM = '\uFEFF'

function saveViaAnchor(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function downloadFile(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const payload = mime.startsWith('text/csv') ? BOM + content : content
  const api = await downloadsApi
  if (!api) return saveViaAnchor(name, payload, mime)
  try {
    await api.save({ filename: name, data: payload })
  } catch {
    /* rifiuto di chi guarda, o capability non disponibile: nessuna azione */
  }
}
