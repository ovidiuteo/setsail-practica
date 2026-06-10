// Categorii de timeline / milestones — sursa unica de adevar pentru lista de scope-uri.
// O sesiune isi alege categoria manual (sessions.timeline_scope); daca nu e setata,
// se deriva un best-guess din class_caa + locatie.

export type TimelineScope =
  | 'practica_cds_limanu'
  | 'curs_cd_snagov'
  | 'intensiv_cds_limanu'
  | 'practica_ba'
  | 'radio_lrc'

export const TIMELINE_SCOPES: Array<{ value: TimelineScope; label: string }> = [
  { value: 'practica_cds_limanu', label: 'Practica C/D/S Limanu' },
  { value: 'curs_cd_snagov',      label: 'Curs C/D Snagov' },
  { value: 'intensiv_cds_limanu', label: 'Intensiv C/D/S Limanu' },
  { value: 'practica_ba',         label: 'Practica B/A' },
  { value: 'radio_lrc',           label: 'Radio LRC' },
]

export const DEFAULT_TIMELINE_SCOPE: TimelineScope = 'practica_cds_limanu'

export function timelineScopeLabel(scope: string | null | undefined): string {
  return TIMELINE_SCOPES.find(s => s.value === scope)?.label || (scope || '—')
}

// Eticheta scurta a categoriei, pentru dashboard/TO DO (ex. "RADIO 17 iun · Bucuresti")
const SCOPE_SHORT: Record<TimelineScope, string> = {
  practica_cds_limanu: 'PRACTICA',
  curs_cd_snagov: 'SNAGOV',
  intensiv_cds_limanu: 'INTENSIV',
  practica_ba: 'B/A',
  radio_lrc: 'RADIO',
}

export function timelineScopeShort(scope: string | null | undefined): string {
  return SCOPE_SHORT[scope as TimelineScope] || ''
}

// Derivare best-guess cand timeline_scope nu e setat (fallback pentru sesiuni noi).
function deriveScope(session: any): TimelineScope {
  const clsU = String(session?.class_caa || '').toUpperCase()
  const clsL = clsU.toLowerCase()
  const loc = String(session?.locations?.name || session?.location_name || '').toLowerCase()
  if (/radio|lrc/.test(clsL)) return 'radio_lrc'
  if (loc.includes('snagov')) return 'curs_cd_snagov'
  if ((clsU.includes('A') || clsU.includes('B')) && !clsU.includes('C') && !clsU.includes('D')) return 'practica_ba'
  return 'practica_cds_limanu'
}

// Scope-ul efectiv al unei sesiuni: valoarea manuala daca e valida, altfel derivata.
export function scopeForSession(session: any): TimelineScope {
  const explicit = session?.timeline_scope
  if (explicit && TIMELINE_SCOPES.some(s => s.value === explicit)) return explicit as TimelineScope
  return deriveScope(session)
}
