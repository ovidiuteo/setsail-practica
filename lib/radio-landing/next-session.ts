import 'server-only'
import { radioServiceClient } from './server'
import { scopeForSession } from '@/lib/timeline-scope'

// ============================================================================
// Datele următoarei serii de radio, injectate în textele landing-ului.
//
// Textele din admin conțin placeholdere ({{data_curs}} etc.), înlocuite aici cu
// datele seriei care urmează. „Care urmează" = prima serie de radio care nu a
// început încă: din prima zi de curs, landing-ul trece automat la seria de după.
// Dacă nu există nicio serie viitoare definită, placeholderele devin „next session".
// ============================================================================

const LIVE = ['draft', 'active', 'focus']
const NONE = 'next session'

export type SessionTokens = Record<string, string>

// '2026-10-05' → Date la miezul nopții LOCAL. `new Date(iso)` ar da miezul nopții
// UTC, adică 03:00 la noi, iar comparațiile „a început azi?" ieșeau greșit.
function parseDay(iso: string): Date {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const luna = (d: Date) => d.toLocaleDateString('ro-RO', { month: 'long' })
const zi = (d: Date) => d.toLocaleDateString('ro-RO', { weekday: 'long' })
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function interval(start: Date, end: Date): string {
  if (+start === +end) return `${end.getDate()} ${luna(end)}`
  return start.getMonth() === end.getMonth()
    ? `${start.getDate()}–${end.getDate()} ${luna(end)}`
    : `${start.getDate()} ${luna(start)} – ${end.getDate()} ${luna(end)}`
}

export async function getNextRadioSessionTokens(): Promise<SessionTokens> {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const sb = radioServiceClient()
  const { data } = await sb.from('sessions')
    .select('class_caa, session_date, course_start_date, status, timeline_scope, session_type, is_clone')
    .in('status', LIVE)
    .gte('session_date', iso)
    .order('session_date', { ascending: true })

  const next = (data || []).find((s: any) =>
    scopeForSession(s) === 'radio_lrc' && s.session_type === 'principal' && !s.is_clone &&
    // din prima zi de curs, seria curentă nu mai e „următoarea"
    String(s.course_start_date || s.session_date).slice(0, 10) > iso)

  if (!next) {
    return {
      data_curs: NONE, data_curs_caps: NONE.toUpperCase(), data_curs_mare: 'NEXT\nSESSION',
      data_examen: NONE, zile_curs: NONE,
    }
  }

  const end = parseDay((next as any).session_date)
  const start = (next as any).course_start_date ? parseDay((next as any).course_start_date) : end
  const intv = interval(start, end)

  return {
    data_curs: intv,
    data_curs_caps: intv.toUpperCase(),
    // blocul mare din secțiunea de înscriere e pe două rânduri
    data_curs_mare: +start === +end
      ? `${end.getDate()}\n${luna(end).toUpperCase()}`
      : `${start.getDate()} – ${end.getDate()}\n${luna(end).toUpperCase()}`,
    data_examen: `${end.getDate()} ${luna(end)}`,
    zile_curs: +start === +end ? cap(zi(end)) : `${cap(zi(start))} – ${cap(zi(end))}`,
  }
}

// Înlocuiește {{token}} în toate textele conținutului (recursiv)
export function applyTokens<T>(content: T, tokens: SessionTokens): T {
  const walk = (v: any): any => {
    if (typeof v === 'string') return v.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in tokens ? tokens[k] : m))
    if (Array.isArray(v)) return v.map(walk)
    if (v && typeof v === 'object') {
      const out: any = {}
      for (const [k, val] of Object.entries(v)) out[k] = walk(val)
      return out
    }
    return v
  }
  return walk(content)
}
