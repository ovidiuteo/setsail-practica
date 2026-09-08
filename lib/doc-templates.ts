// Template-uri editabile pe fragmente pentru documentele oficiale generate (docx).
// Override-urile stau in tabela Supabase `doc_templates` (doc_type + key); daca un
// fragment lipseste din DB, generatorul foloseste `default`-ul de aici.
//
// Sintaxa unui fragment:
//   {{var}}        -> valoarea variabilei, randata BOLD
//   {{var:plain}}  -> valoarea variabilei, randata normal (ne-bold)
//   *text*         -> text static italic
// Restul textului e randat normal. Layout-ul (tabele, antet, semnaturi) ramane in cod.

export type DocAlign = 'left' | 'center' | 'right' | 'justify'

export type DocFragmentDef = {
  key: string
  label: string
  hint?: string
  default: string
  defaultAlign: DocAlign
}

export type DocPlaceholderDef = { name: string; desc: string }

export type DocTypeDef = {
  value: string
  label: string
  // Documentele care fac parte din aceeasi familie primesc acelasi `group`:
  // in admin apar ca un singur tab, cu sub-taburi pe `label`.
  group?: string
  placeholders: DocPlaceholderDef[]
  fragments: DocFragmentDef[]
}

// ─── Înștiințări ANCOM ────────────────────────────────────────────────────
// Cele patru înștiințări au aceeași structură (subiect, adresare, corp) și
// aceleași variabile; diferă doar textele.
const ANCOM_GROUP = 'Înștiințări ANCOM'

const ANCOM_PLACEHOLDERS: DocPlaceholderDef[] = [
  { name: 'protocol_valabil_pana', desc: 'Data până la care e valabil protocolul ANCOM (Configurare → Info SetSail)' },
  { name: 'perioada_curs', desc: 'Perioada cursului (ex. 10 septembrie 2026 - 17 septembrie 2026)' },
  { name: 'data_start_curs', desc: 'Data de început a cursului' },
  { name: 'data_examen', desc: 'Data examenului (data sesiunii)' },
  { name: 'ora_examen', desc: 'Ora examinării de pe sesiune (ex. 20:00)' },
  { name: 'pers_contact_1', desc: 'Prima persoană de contact bifată pe sesiune' },
  { name: 'pers_contact_2', desc: 'A doua persoană de contact bifată pe sesiune' },
]

const ancomFragments = (titlu: string, subiect: string, corp: string): DocFragmentDef[] => [
  {
    key: 'titlu_doc',
    label: 'Denumirea documentului',
    hint: 'Nu apare în document; e numele care se propune la tipărire/salvare PDF.',
    default: titlu,
    defaultAlign: 'left',
  },
  {
    key: 'subiect',
    label: 'Subiect',
    hint: 'Apare după „Subiect:”, cu italice.',
    default: subiect,
    defaultAlign: 'left',
  },
  {
    key: 'adresare',
    label: 'Formulă de adresare',
    default: 'Domnule Președinte,',
    defaultAlign: 'center',
  },
  {
    key: 'corp',
    label: 'Corpul înștiințării',
    hint: 'Rând gol = paragraf nou. Rândurile care încep cu „-” devin listă indentată.',
    default: corp,
    defaultAlign: 'justify',
  },
]

const CORP_CURS = (ce: string) =>
  `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de {{protocol_valabil_pana}}, vă înștiințăm că vom organiza un curs de ${ce} de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC în perioada {{perioada_curs}}.\n\nLocul de desfășurare al cursului este online.`

const CORP_EXAMEN = (cand: string, ce: string) =>
  `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de {{protocol_valabil_pana}}, vă înștiințăm că ${cand}, organizam o sesiune de examinare în vederea ${ce} certificatelor de operator radio, online.\n\nMembrii comisiei de examinare vor fi:\n- {{pers_contact_1:plain}}, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC\n- {{pers_contact_2:plain}}, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC`

// tip din generator ('curs-obtinere') -> doc_type din template-uri
export function ancomDocType(tip: string): string {
  return 'instiintare_ancom_' + String(tip || '').replace(/-/g, '_')
}

export const DOC_TEMPLATE_TYPES: DocTypeDef[] = [
  {
    value: 'pv_practica',
    label: 'PV Practică',
    placeholders: [
      { name: 'data_practica', desc: 'Data probei practice (ex. 11 iunie 2026)' },
      { name: 'evaluator', desc: 'Numele evaluatorului ANR' },
      { name: 'functie_evaluator', desc: 'Funcția evaluatorului' },
      { name: 'capitania', desc: 'Căpitănia (derivată din locație)' },
      { name: 'decizie_anr', desc: 'Numărul deciziei ANR a evaluatorului' },
      { name: 'furnizor', desc: 'Numele furnizorului (S.C. Set Sail Advertising S.R.L.)' },
      { name: 'nr_solicitare', desc: 'Nr. înștiințare reg ANR' },
      { name: 'locatie', desc: 'Locația detaliată' },
      { name: 'fraza_ambarcatiuni', desc: '„cu ambarcațiunea" / „cu ambarcațiunile" (auto singular/plural)' },
      { name: 'ambarcatiuni', desc: 'Ambarcațiunile, cu nr. de înmatriculare, separate cu virgulă' },
      { name: 'fraza_instructori', desc: '„în prezența instructorului/instructorilor" (auto singular/plural)' },
      { name: 'instructori', desc: 'Instructorii, separați cu virgulă' },
    ],
    fragments: [
      {
        key: 'titlu',
        label: 'Titlu document',
        default: 'Proces – Verbal  Examen Practic',
        defaultAlign: 'center',
      },
      {
        key: 'incheiat_limanu',
        label: 'Paragraf „Încheiat astăzi" (doar Limanu)',
        hint: 'Apare doar la sesiunile din Limanu, imediat după titlu.',
        default: 'Încheiat astăzi {{data_practica}}',
        defaultAlign: 'center',
      },
      {
        key: 'p1_subsemnatul',
        label: 'Paragraful 1 — Subsemnatul',
        default: 'Subsemnatul {{evaluator}}, cu funcția {{functie_evaluator}}, din cadrul {{capitania}}, desemnat prin Decizia Directorului General al Autorității Navale Române nr. {{decizie_anr}}, în calitate de evaluator la examenele practice ale cursurilor aprobate, organizate de furnizorii de educație, formare profesională sau de perfecționare, pentru obținerea certificatelor internaționale de conducător de ambarcațiune de agrement,',
        defaultAlign: 'justify',
      },
      {
        key: 'p2_regulament',
        label: 'Paragraful 2 — Având în vedere',
        default: 'Având în vedere prevederile „*Regulamentului privind cerințele minime de pregătire, precum și condițiile de obținere a certificatelor internaționale de conducător de ambarcațiune de agrement*”, aprobat prin Ordinul M.T. nr. 527/2016, cu modificările și completările în vigoare și,',
        defaultAlign: 'justify',
      },
      {
        key: 'p3_solicitare',
        label: 'Paragraful 3 — În baza solicitării',
        default: 'În baza solicitării furnizorului {{furnizor}}, nr. {{nr_solicitare}}, s-a desfășurat în locația {{locatie}}, {{fraza_ambarcatiuni:plain}} {{ambarcatiuni}}, {{fraza_instructori:plain}} {{instructori}}, evaluarea/examinarea cunoștințelor practice ale candidaților enumerați mai jos și, în baza fișei individuale de verificare a aptitudinilor, am constatat următoarele:',
        defaultAlign: 'justify',
      },
      {
        key: 'final',
        label: 'Paragraf final',
        default: 'Drept pentru care am încheiat prezentul proces-verbal în două exemplare; un exemplar a fost înaintat furnizorului de educație, formare profesională sau de perfecționare, în vederea emiterii certificatelor de absolvire a cursului, după caz.',
        defaultAlign: 'justify',
      },
    ],
  },
  {
    value: 'instiintare_ancom_curs_obtinere',
    label: 'Curs obținere',
    group: ANCOM_GROUP,
    placeholders: ANCOM_PLACEHOLDERS,
    fragments: ancomFragments(
      'Înștiințare organizare curs obținere LRC',
      'Înștiințare cu privire la data de începere a cursului de pregătire în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC',
      CORP_CURS('pregătire în vederea obținerii certificatelor'),
    ),
  },
  {
    value: 'instiintare_ancom_examen_obtinere',
    label: 'Examen obținere',
    group: ANCOM_GROUP,
    placeholders: ANCOM_PLACEHOLDERS,
    fragments: ancomFragments(
      'Înștiințare organizare examen obținere LRC',
      'Înștiințare cu privire la data de desfășurare a examenului în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC',
      CORP_EXAMEN('pe data de {{data_examen}}', 'obținerii'),
    ),
  },
  {
    value: 'instiintare_ancom_curs_prelungire',
    label: 'Curs prelungire',
    group: ANCOM_GROUP,
    placeholders: ANCOM_PLACEHOLDERS,
    fragments: ancomFragments(
      'Înștiințare organizare curs reconfirmare LRC',
      'Înștiințare cu privire la data de începere a cursului de reconfirmare în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC',
      CORP_CURS('reconfirmare în vederea prelungirii valabilității certificatelor'),
    ),
  },
  {
    value: 'instiintare_ancom_examen_prelungire',
    label: 'Examen prelungire',
    group: ANCOM_GROUP,
    placeholders: ANCOM_PLACEHOLDERS,
    fragments: ancomFragments(
      'Înștiințare organizare examen prelungire LRC',
      'Înștiințare cu privire la data de desfășurare a examenului în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC',
      CORP_EXAMEN('pe data de {{data_examen}}, orele 19.00', 'prelungirii valabilității'),
    ),
  },
]

export function docTypeDef(docType: string): DocTypeDef | undefined {
  return DOC_TEMPLATE_TYPES.find(d => d.value === docType)
}

export function fragmentDefault(docType: string, key: string): string {
  return docTypeDef(docType)?.fragments.find(f => f.key === key)?.default || ''
}

export function fragmentDefaultAlign(docType: string, key: string): DocAlign {
  return docTypeDef(docType)?.fragments.find(f => f.key === key)?.defaultAlign || 'justify'
}

export type Segment = { text: string; bold?: boolean; italics?: boolean }

// Transforma continutul unui fragment + variabilele in segmente de text formatate.
export function fillDocTemplate(content: string, vars: Record<string, string>): Segment[] {
  const segs: Segment[] = []
  const pushStatic = (t: string) => {
    const parts = t.split('*')
    parts.forEach((p, i) => { if (p) segs.push({ text: p, italics: i % 2 === 1 || undefined }) })
  }
  const re = /\{\{(\w+)(:plain)?\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(content))) {
    if (m.index > last) pushStatic(content.slice(last, m.index))
    const val = vars[m[1]] ?? ''
    if (val) segs.push({ text: val, bold: m[2] ? undefined : true })
    last = m.index + m[0].length
  }
  if (last < content.length) pushStatic(content.slice(last))
  return segs
}
