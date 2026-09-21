// Zilele foii de prezență: interval, etichete („Luni, 21.09") și conversii de dată.
// Stau separat de componentă, ca să le poată folosi și rutele de API.

export const ziISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function dinISO(s: string): Date | null {
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

// Zilele scurtate pentru capul de tabel al catalogului
const ZI_SCURT = ['Dum', 'Luni', 'Marți', 'Mierc', 'Joi', 'Vineri', 'Sâmb']

// „Mierc, 23.09" — ziua scurtată și data
export function etichetaZi(iso: string): string {
  const d = dinISO(iso)
  if (!d) return iso
  return `${ZI_SCURT[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Lunea săptămânii din care face parte ziua (ca să știm unde începe o săptămână nouă)
export function lunea(iso: string): string {
  const d = dinISO(iso)
  if (!d) return iso
  const delta = (d.getDay() + 6) % 7
  return ziISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - delta))
}

// Toate zilele dintre start și final (inclusiv)
export function zileIntre(start: string | null | undefined, final: string | null | undefined): string[] {
  const a = dinISO(start || ''), b = dinISO(final || '')
  if (!a || !b || b < a) return []
  const out: string[] = []
  for (const t = new Date(a); t <= b && out.length < 120; t.setDate(t.getDate() + 1)) out.push(ziISO(t))
  return out
}

const LUNI_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

// Titlul foii de prezență, din prima și ultima zi bifată:
// „Prezență 21 septembrie - 1 octombrie 2026" sau „Prezență 3-12 octombrie 2026"
export function titluCatalog(zile: string[]): string {
  const alese = (zile || []).filter(Boolean).slice().sort()
  const a = dinISO(alese[0] || ''), b = dinISO(alese[alese.length - 1] || '')
  if (!a || !b) return 'Prezență'
  const an = b.getFullYear()
  if (a.getMonth() === b.getMonth() && a.getFullYear() === an) {
    return a.getDate() === b.getDate()
      ? `Prezență ${a.getDate()} ${LUNI_RO[a.getMonth()]} ${an}`
      : `Prezență ${a.getDate()}-${b.getDate()} ${LUNI_RO[b.getMonth()]} ${an}`
  }
  const anA = a.getFullYear() === an ? '' : ` ${a.getFullYear()}`
  return `Prezență ${a.getDate()} ${LUNI_RO[a.getMonth()]}${anA} - ${b.getDate()} ${LUNI_RO[b.getMonth()]} ${an}`
}
