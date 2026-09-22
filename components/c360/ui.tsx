// Elemente comune pentru Cursant 360 (admin + portal): fonturi, culori, formatare.
import { Fraunces, Manrope } from 'next/font/google'

export const fDisplay = Fraunces({ subsets: ['latin', 'latin-ext'], weight: ['500', '600'], variable: '--c360-display' })
export const fBody = Manrope({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], variable: '--c360-body' })

export const C = {
  navy: '#0A1628', ink: '#0B1B33', gold: '#F5C842', sea: '#1B6E99', seaLight: '#2EA8D8',
  muted: '#5B6472', line: '#E1E4DE', ok: '#1E7A4F', okBg: '#E1F3EA', warn: '#9A4A07', warnBg: '#FDEBD7',
  bad: '#B42318', seaBg: '#E6EEF5',
}

export const disp = { fontFamily: 'var(--c360-display), Georgia, serif' } as const

const LUNI = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sep.', 'oct.', 'nov.', 'dec.']

export function fmtData(d: string | null | undefined, cuAn = true): string {
  if (!d) return '—'
  const x = new Date(d.length === 10 ? d + 'T12:00:00' : d)
  if (isNaN(x.getTime())) return d
  return `${x.getDate()} ${LUNI[x.getMonth()]}${cuAn ? ' ' + x.getFullYear() : ''}`
}

export function fmtBani(v: number, moneda: string): string {
  const s = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 2 }).format(v)
  return moneda === 'EUR' ? `${s} €` : `${s} ${moneda}`
}

// { EUR: 120, RON: 50 } -> "120 € · 50 RON"
export function fmtSume(s: Record<string, number>): string {
  const e = Object.entries(s).filter(([, v]) => v !== 0)
  if (!e.length) return '0 €'
  return e.map(([m, v]) => fmtBani(v, m)).join(' · ')
}

export function initiale(n: string): string {
  const p = n.trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?'
}

// Prenumele (de obicei ultimul cuvânt la „NUME Prenume”, primul la „Prenume Nume”)
export function prenume(n: string): string {
  const p = n.trim().split(/\s+/).filter(Boolean)
  if (!p.length) return ''
  const w = p[0] === p[0].toUpperCase() && p.length > 1 ? p[p.length - 1] : p[0]
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
}
