// Zilele foii de prezență: interval, etichete („Luni, 21.09") și conversii de dată.
// Stau separat de componentă, ca să le poată folosi și rutele de API.

export const ziISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function dinISO(s: string): Date | null {
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

// „Luni, 21.09"
export function etichetaZi(iso: string): string {
  const d = dinISO(iso)
  if (!d) return iso
  const zi = d.toLocaleDateString('ro-RO', { weekday: 'long' })
  return `${zi.charAt(0).toLocaleUpperCase('ro-RO')}${zi.slice(1)}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Toate zilele dintre start și final (inclusiv)
export function zileIntre(start: string | null | undefined, final: string | null | undefined): string[] {
  const a = dinISO(start || ''), b = dinISO(final || '')
  if (!a || !b || b < a) return []
  const out: string[] = []
  for (const t = new Date(a); t <= b && out.length < 120; t.setDate(t.getDate() + 1)) out.push(ziISO(t))
  return out
}
