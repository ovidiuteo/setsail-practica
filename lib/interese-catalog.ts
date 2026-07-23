// Catalog fix de câmpuri pentru „interese", etichetate cu genul programului.
// Fiecare interes preia câmpurile genului său; câmpurile au bifă arată/ascunde.

export type Genre = 'curs' | 'expeditie' | 'practica_suplimentara'

export const INTEREST_GENRES: { key: Genre; label: string }[] = [
  { key: 'curs', label: 'Curs' },
  { key: 'expeditie', label: 'Expediție' },
  { key: 'practica_suplimentara', label: 'Practică suplimentară' },
]

export const genreLabel = (g: string) => INTEREST_GENRES.find(x => x.key === g)?.label || g

export type CatalogField = { key: string; label: string; genres: Genre[]; vis: boolean }
export type InterestField = { key: string; label: string; value: string; visible: boolean; custom?: boolean }

const ALL: Genre[] = ['curs', 'expeditie', 'practica_suplimentara']

export const FIELD_CATALOG: CatalogField[] = [
  // comune
  { key: 'nume_program', label: 'Nume program', genres: ALL, vis: true },
  { key: 'interval', label: 'Interval / Date', genres: ALL, vis: true },
  { key: 'durata', label: 'Durată', genres: ALL, vis: true },
  { key: 'pret', label: 'Preț', genres: ALL, vis: true },
  { key: 'locatie', label: 'Locație', genres: ALL, vis: true },
  { key: 'ambarcatiune', label: 'Ambarcațiune', genres: ['curs', 'expeditie', 'practica_suplimentara'], vis: false },
  // curs / practică
  { key: 'link_portal', label: 'Link portal', genres: ['curs', 'practica_suplimentara'], vis: true },
  { key: 'clase', label: 'Clase CAA', genres: ['curs', 'practica_suplimentara'], vis: true },
  { key: 'data_start_curs', label: 'Data start curs', genres: ['curs'], vis: true },
  { key: 'ora_start', label: 'Ora start', genres: ['curs', 'practica_suplimentara'], vis: true },
  { key: 'instructor', label: 'Instructor', genres: ['curs', 'practica_suplimentara'], vis: true },
  { key: 'zi_proba_anr', label: 'Zi probă ANR', genres: ['curs'], vis: false },
  { key: 'ora_proba_anr', label: 'Ora probă ANR', genres: ['curs'], vis: false },
  { key: 'pauza_pranz', label: 'Pauză prânz', genres: ['curs'], vis: false },
  { key: 'ora_final', label: 'Ora final', genres: ['curs'], vis: false },
  { key: 'cazare_hotel', label: 'Cazare — hotel', genres: ['curs', 'expeditie'], vis: false },
  { key: 'cazare_contact', label: 'Cazare — contact', genres: ['curs'], vis: false },
  { key: 'cazare_telefon', label: 'Cazare — telefon', genres: ['curs'], vis: false },
  { key: 'zone_cazare', label: 'Zone cazare', genres: ['curs'], vis: false },
  // expediție
  { key: 'traseu', label: 'Traseu', genres: ['expeditie'], vis: true },
  { key: 'skipper', label: 'Skipper', genres: ['expeditie'], vis: true },
  { key: 'ce_include', label: 'Ce include', genres: ['expeditie'], vis: true },
  { key: 'nr_locuri', label: 'Nr. locuri', genres: ['expeditie'], vis: false },
]

// Construiește setul de câmpuri pentru un gen, cu valori inițiale opționale.
// Păstrează câmpurile custom existente și valorile deja completate.
export function buildFields(genre: Genre, values: Record<string, string> = {}, existing: InterestField[] = []): InterestField[] {
  const exMap = new Map(existing.map(f => [f.key, f]))
  const catalog = FIELD_CATALOG.filter(f => f.genres.includes(genre)).map(f => {
    const prev = exMap.get(f.key)
    return {
      key: f.key, label: f.label,
      value: prev?.value || values[f.key] || '',
      visible: prev ? prev.visible : f.vis,
      custom: false,
    }
  })
  // păstrează câmpurile custom adăugate manual
  const customs = existing.filter(f => f.custom)
  return [...catalog, ...customs]
}
