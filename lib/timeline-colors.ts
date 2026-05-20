// Funcții utile pentru derivarea automată a culorilor de zi/weekend
// pornind de la culoarea „event" a unui milestone.

export function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '').padStart(6, '0')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let hue = 0
  if (d !== 0) {
    if (max === r) hue = ((g - b) / d) % 6
    else if (max === g) hue = (b - r) / d + 2
    else hue = (r - g) / d + 4
    hue *= 60
    if (hue < 0) hue += 360
  }
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  return [hue, s * 100, l * 100]
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100
  const lN = l / 100
  const c = (1 - Math.abs(2 * lN - 1)) * sN
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = lN - c / 2
  let r = 0, g = 0, b = 0
  if (h < 60)        { r = c; g = x; b = 0 }
  else if (h < 120)  { r = x; g = c; b = 0 }
  else if (h < 180)  { r = 0; g = c; b = x }
  else if (h < 240)  { r = 0; g = x; b = c }
  else if (h < 300)  { r = x; g = 0; b = c }
  else               { r = c; g = 0; b = x }
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

// Lighten cu un număr de „L points" pe scala 0-100 din HSL
export function lighten(hex: string, points: number): string {
  if (!hex || hex === 'none' || !hex.startsWith('#')) return hex
  const [h, s, l] = hexToHsl(hex)
  // Reducem un pic și saturația pentru tonuri mai blânde
  const newS = Math.max(0, Math.min(100, s * 0.85))
  const newL = Math.max(0, Math.min(96, l + points))
  return hslToHex(h, newS, newL)
}

// Culoare default pentru „zi normală" (mai deschisă decât event)
export function defaultDayColor(eventColor: string): string {
  return lighten(eventColor, 32)
}

// Culoare default pentru „weekend" (între event și day, mai saturată decât day)
export function defaultWeekendColor(eventColor: string): string {
  return lighten(eventColor, 22)
}

// Returnează culoarea efectivă, ținând cont de fallback la derivat
export function resolveColor(stored: string | null | undefined, eventColor: string, kind: 'day' | 'weekend'): string | null {
  if (stored === 'none') return null // transparent
  if (stored && stored.startsWith('#')) return stored
  return kind === 'day' ? defaultDayColor(eventColor) : defaultWeekendColor(eventColor)
}
