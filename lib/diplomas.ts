// Modul diplome — port după sistemul din teste.setsail.ro (Laravel).
// Diplomele sunt foi A4 landscape PRE-TIPĂRITE; aplicația printează doar textul
// variabil, poziționat absolut pe o pagină de exact 1123x794 px (A4 @ 96dpi).
// Imaginea-model (public/images/diplomas/model-diploma-<cat>.jpg) se vede doar
// pe ecran, pentru aliniere — la print rămâne numai textul.
// Coordonatele sunt calibrate per (imprimantă, categorie) în diploma_templates.

export type DiplomaCategory = 'A' | 'B' | 'C' | 'D' | 'S'
export const DIPLOMA_CATEGORIES: DiplomaCategory[] = ['A', 'B', 'C', 'D', 'S']

// Dimensiunea paginii de print (px la 96dpi, A4 landscape) — NU modifica:
// toate coordonatele calibrate sunt relative la această suprafață.
export const PAGE_W = 1123
export const PAGE_H = 794
// Offsetul imaginii-model față de pagină (moștenit din vechiul sistem,
// unde fundalul era desenat la -30,-33 pe pagina de print).
export const BG_OFFSET_X = -30
export const BG_OFFSET_Y = -33

export type FieldBox = { top: number; left: number; width?: number }
export type TemplateFields = Record<string, FieldBox>

export type DiplomaPrinter = {
  id: string
  name: string
  active: boolean
}

export type DiplomaTemplate = {
  id: string
  printer_id: string
  category: DiplomaCategory
  text_color: string
  fields: TemplateFields
}

export type Diploma = {
  id: string
  series: DiplomaCategory
  number: number
  issue_date: string
  expiration: string | null
  full_name: string
  cnp: string | null
  address: string | null
  city: string | null
  group_name: string | null
  practice_location: string | null
  practice_date: string | null
  show_practice: boolean
  session_id: string | null
  student_id: string | null
  status: number          // 1 activă, 0 anulată
  in_print_queue: boolean
  printed_at: string | null
  delivered_at: string | null
  delivery_address: string | null
  duplicate: boolean
  created_at: string
}

// Definițiile câmpurilor de pe diplomă. Două grupuri cu offset propriu:
//  - base    = cotorul din stânga (rămâne în registrul școlii)
//  - diploma = corpul diplomei (partea care pleacă la cursant)
// Câmpurile au top/left relative la grupul lor + width; stilurile (font, aliniere)
// replică 1:1 vechiul print-diploma.blade.php ca să putem importa calibrările.
export type FieldDef = {
  key: string
  label: string
  group: 'base' | 'diploma'
  kind: 'text' | 'image'
  fontSize?: number
  align?: 'left' | 'center' | 'right'
  italic?: boolean
  image?: string // pentru kind=image: cale în /public
}

export const GROUP_KEYS = ['base', 'diploma'] as const

export const DIPLOMA_FIELD_DEFS: FieldDef[] = [
  // Cotor
  { key: 'base_number', label: 'Număr cotor',          group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  { key: 'base_name_1', label: 'Nume cotor 1',         group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  { key: 'base_date_1', label: 'Dată eliberare cotor', group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  { key: 'base_group',  label: 'Serie cotor',          group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  { key: 'base_name_2', label: 'Nume cotor 2',         group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  { key: 'base_date_2', label: 'Dată cotor 2',         group: 'base', kind: 'text', fontSize: 11, align: 'left' },
  // Corp diplomă
  { key: 'number',     label: 'Număr',          group: 'diploma', kind: 'text', fontSize: 16, align: 'left' },
  { key: 'date',       label: 'Dată eliberare', group: 'diploma', kind: 'text', fontSize: 16, align: 'left' },
  { key: 'expiration', label: 'Expiră la',      group: 'diploma', kind: 'text', fontSize: 16, align: 'left' },
  { key: 'name',       label: 'Nume',           group: 'diploma', kind: 'text', fontSize: 18, align: 'center', italic: true },
  { key: 'address',    label: 'Adresă',         group: 'diploma', kind: 'text', fontSize: 14, align: 'center' },
  { key: 'city',       label: 'Oraș',           group: 'diploma', kind: 'text', fontSize: 14, align: 'center' },
  { key: 'cnp',        label: 'CNP',            group: 'diploma', kind: 'text', fontSize: 14, align: 'center' },
  { key: 'group',      label: 'Serie curs',     group: 'diploma', kind: 'text', fontSize: 14, align: 'center' },
  { key: 'practice',   label: 'Probă practică', group: 'diploma', kind: 'text', fontSize: 14, align: 'right' },
  { key: 'manager',    label: 'Semnătură director',   group: 'diploma', kind: 'image', image: '/images/diplomas/semnatura-director.png' },
  { key: 'stamp',      label: 'Ștampilă',             group: 'diploma', kind: 'image', image: '/images/diplomas/stampila.png' },
  { key: 'instructor', label: 'Semnătură instructor', group: 'diploma', kind: 'image', image: '/images/diplomas/semnatura-instructor.png' },
]

// Valori de pornire rezonabile (estimare pe imaginea-model) — se înlocuiesc
// cu calibrările importate din vechiul sistem sau ajustate din pagina de șablon.
export const DEFAULT_TEMPLATE_FIELDS: TemplateFields = {
  base:        { top: 180, left: 40 },
  base_number: { top: 8,   left: 32,  width: 120 },
  base_name_1: { top: 80,  left: 0,   width: 175 },
  base_date_1: { top: 165, left: 42,  width: 130 },
  base_group:  { top: 200, left: 70,  width: 100 },
  base_name_2: { top: 305, left: 0,   width: 175 },
  base_date_2: { top: 390, left: 42,  width: 130 },
  diploma:     { top: 0,   left: 0 },
  number:      { top: 238, left: 575, width: 160 },
  date:        { top: 259, left: 558, width: 160 },
  expiration:  { top: 280, left: 538, width: 160 },
  name:        { top: 338, left: 620, width: 430 },
  address:     { top: 376, left: 530, width: 510 },
  city:        { top: 412, left: 460, width: 510 },
  cnp:         { top: 452, left: 470, width: 300 },
  group:       { top: 486, left: 590, width: 300 },
  practice:    { top: 558, left: 580, width: 420 },
  manager:     { top: 638, left: 330, width: 150 },
  stamp:       { top: 595, left: 530, width: 120 },
  instructor:  { top: 638, left: 858, width: 150 },
}

export const DEFAULT_TEXT_COLOR = '#1b3a5e'

export function fieldBox(fields: TemplateFields | null | undefined, key: string): FieldBox {
  return fields?.[key] ?? DEFAULT_TEMPLATE_FIELDS[key] ?? { top: 0, left: 0, width: 100 }
}

export function formatDiplomaDate(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

// Categoriile implicite pentru un cursant, după clasa CAA (ex. "C", "C,D", "C/D").
// La clasele cu velă (A/B) vechiul sistem emitea automat și diploma S.
export function defaultCategoriesForClass(classCaa: string | null | undefined): DiplomaCategory[] {
  const found = new Set<DiplomaCategory>()
  const norm = (classCaa || '').toUpperCase()
  for (const c of ['A', 'B', 'C', 'D'] as DiplomaCategory[]) {
    if (norm.includes(c)) found.add(c)
  }
  if (found.has('A') || found.has('B')) found.add('S')
  return DIPLOMA_CATEGORIES.filter(c => found.has(c))
}

// Următorul număr de diplomă: max(numărul maxim existent + 1, start_number din setări).
export async function getNextDiplomaNumber(supabase: any): Promise<number> {
  const [{ data: maxRow }, { data: settings }] = await Promise.all([
    supabase.from('diplomas').select('number').order('number', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('diploma_settings').select('start_number').eq('id', 1).maybeSingle(),
  ])
  const start = settings?.start_number ?? 10000
  return Math.max((maxRow?.number ?? 0) + 1, start)
}
