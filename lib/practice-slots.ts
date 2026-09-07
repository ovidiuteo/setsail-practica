// Intervalele de programare la practică (curs C/D Snagov).
// Aceleași reguli folosite și în admin (configurare) și în portalul cursantului.

export type SlotConfig = {
  enabled: boolean
  date: string | null        // ziua de practică (YYYY-MM-DD)
  minutes: number            // durata unui interval: 60 / 90 / 120
  startHour: number          // 9 / 10 / 11 / 12
  endHour: number            // 16 / 17 / 18
  boats: number              // 1 / 2
  perBoat: number            // 1 / 2 / 3
  perSlot: number            // 4 / 5 / 6 — plafon pe interval, indiferent de bărci
}

export const SLOT_MINUTES = [60, 90, 120]
export const START_HOURS = [9, 10, 11, 12]
export const END_HOURS = [16, 17, 18]
export const BOATS = [1, 2]
export const PER_BOAT = [1, 2, 3]
export const PER_SLOT = [4, 5, 6]

export const DEFAULT_SLOT_CONFIG: SlotConfig = {
  enabled: false, date: null, minutes: 120, startHour: 12, endHour: 16,
  boats: 1, perBoat: 2, perSlot: 4,
}

// Ziua de practică: cea setată pe sesiune, altfel ziua dinaintea examenului
export function practiceDate(s: any): string | null {
  if (s?.practice_start_date) return String(s.practice_start_date).slice(0, 10)
  if (!s?.session_date) return null
  const [y, m, d] = String(s.session_date).slice(0, 10).split('-').map(Number)
  const dt = new Date(y, (m || 1) - 1, d || 1)
  dt.setDate(dt.getDate() - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

// Config-ul dintr-un rând `sessions` (coloanele practice_*)
export function configFromSession(s: any): SlotConfig {
  return {
    enabled: !!s?.practice_booking_enabled,
    date: practiceDate(s),
    minutes: s?.practice_slot_minutes ?? DEFAULT_SLOT_CONFIG.minutes,
    startHour: s?.practice_start_hour ?? DEFAULT_SLOT_CONFIG.startHour,
    endHour: s?.practice_end_hour ?? DEFAULT_SLOT_CONFIG.endHour,
    boats: s?.practice_boats ?? DEFAULT_SLOT_CONFIG.boats,
    perBoat: s?.practice_per_boat ?? DEFAULT_SLOT_CONFIG.perBoat,
    perSlot: s?.practice_per_slot ?? DEFAULT_SLOT_CONFIG.perSlot,
  }
}

// Câți încap într-un interval: bărcile ori locurile pe barcă, dar fără să
// depășească plafonul pe interval.
export function slotCapacity(c: SlotConfig): number {
  return Math.max(1, Math.min(c.boats * c.perBoat, c.perSlot))
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

export type Slot = { from: string; to: string }

// Intervalele zilei, din oră în oră după durata aleasă. Ultimul interval nu
// depășește ora de final; dacă nu mai încape unul întreg, se oprește.
export function buildSlots(c: SlotConfig): Slot[] {
  const out: Slot[] = []
  const end = c.endHour * 60
  for (let t = c.startHour * 60; t + c.minutes <= end; t += c.minutes) {
    out.push({ from: hhmm(t), to: hhmm(t + c.minutes) })
  }
  return out
}

// Ziua de practică, scrisă pentru oameni: „miercuri, 23 septembrie 2026"
export function slotDateLabel(date: string | null | undefined): string {
  if (!date) return ''
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
    .toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
