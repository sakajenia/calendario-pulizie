import { format, formatDistanceToNow, isSameDay, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

export const asDate = (v: string | Date) => (typeof v === 'string' ? parseISO(v) : v)

/** Formato usato in tutta l'app originale: 31-08-2026 10:00 */
export const fmtDateTime = (v: string | Date) => format(asDate(v), 'dd-MM-yyyy HH:mm')
export const fmtDate = (v: string | Date) => format(asDate(v), 'dd-MM-yyyy')
export const fmtTime = (v: string | Date) => format(asDate(v), 'HH:mm')
export const fmtDayLong = (v: string | Date) => format(asDate(v), 'EEEE d MMMM yyyy', { locale: it })
export const fmtMonthYear = (v: string | Date) => format(asDate(v), 'MMMM yyyy', { locale: it })
export const fmtRelative = (v: string | Date) =>
  formatDistanceToNow(asDate(v), { addSuffix: true, locale: it })

export const sameDay = (a: string | Date, b: string | Date) => isSameDay(asDate(a), asDate(b))

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

export function downloadFile(name: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([`﻿${content}`], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
