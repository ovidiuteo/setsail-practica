// Catalog unic de variabile pentru template-urile de email + funcția de aplicare.
// Folosit atât la trimitere (pagina sesiunii) cât și la editor (picker cu exemple).
import { buildSlots, configFromSession } from './practice-slots'
import { scopeForSession } from './timeline-scope'
import { defaultExamTime } from './session-defaults'

export type MailVarCtx = {
  origin?: string
  sess?: any
  contacts?: any[]                       // toate persoanele de contact (se filtrează după contact_person_ids)
  instructors?: { full_name: string }[]  // instructorii sesiunii, în ordine [1,2,3]
  setsailInfo?: Record<string, string>   // setsail_info key→value
}

export type MailVar = { key: string; label: string }
export type MailVarGroup = { category: string; icon: string; vars: MailVar[] }

// Grupuri afișate în picker (stânga: formula {{key}}, dreapta: valoare-exemplu)
export const MAIL_VAR_GROUPS: MailVarGroup[] = [
  {
    category: 'Sesiune practică', icon: '⛵', vars: [
      { key: 'link_portal', label: 'Link portal cursant' },
      { key: 'data_sesiune', label: 'Data sesiunii (zi lună an)' },
      { key: 'locatie', label: 'Locația (ex: Snagov, jud. Ilfov)' },
      { key: 'locatie_scurta', label: 'Locația, doar numele (ex: Snagov)' },
      { key: 'ambarcatiune', label: 'Ambarcațiunea' },
      { key: 'ora_start', label: 'Ora de start practică' },
      { key: 'ora_examinare', label: 'Ora examinării (ex: 12:00)' },
      { key: 'data_start_curs', label: 'Data start curs (zi săpt, zz lună)' },
      { key: 'zz_data_start_practica', label: 'Ziua din data start practică' },
      { key: 'zz_llll_data_practica', label: 'Ziua și luna practicii' },
      { key: 'zz_data_start_curs', label: 'Ziua din data start curs' },
      { key: 'zz_llll_aaaa_data_practica', label: 'Ziua, luna, anul practicii' },
      { key: 'zi_sapt_start_curs', label: 'Ziua săptămânii, ziua 1 de curs (ex: luni)' },
      { key: 'zi_sapt_curs_2', label: 'Ziua săptămânii, ziua 2 de curs (ex: marți)' },
      { key: 'zi_sapt_curs_3', label: 'Ziua săptămânii, ziua 3 de curs (ex: miercuri)' },
      { key: 'zz_llll_curs_2', label: 'Data zilei 2 de curs (ex: 15 septembrie)' },
      { key: 'zz_llll_curs_3', label: 'Data zilei 3 de curs (ex: 16 septembrie)' },
      { key: 'ore_practica', label: 'Orele de practică (ex: 10:00, 12:00 sau 14:00)' },
      { key: 'intervale_practica', label: 'Intervalele de practică (ex: 10:00–12:00, …)' },
      { key: 'zi_sapt_practica', label: 'Ziua săptămânii, practică (ex: joi)' },
      { key: 'zi_sapt_examen', label: 'Ziua săptămânii, examen (ex: vineri)' },
    ],
  },
  {
    category: 'Date de contact', icon: '📞', vars: [
      { key: 'pers_cont_1', label: 'Persoană contact 1' },
      { key: 'pers_cont_2', label: 'Persoană contact 2' },
      { key: 'pers_cont_3', label: 'Persoană contact 3' },
      { key: 'pers_cont_4', label: 'Persoană contact 4' },
      { key: 'tel_cont_1', label: 'Telefon contact 1' },
      { key: 'tel_cont_2', label: 'Telefon contact 2' },
      { key: 'tel_cont_3', label: 'Telefon contact 3' },
      { key: 'tel_cont_4', label: 'Telefon contact 4' },
      { key: 'email_oficial_reprezentant', label: 'Email oficial reprezentant (sesiune)' },
      { key: 'email_personal_reprezentant', label: 'Email personal reprezentant (sesiune)' },
    ],
  },
  {
    category: 'Firma SetSail', icon: '🏢', vars: [
      { key: 'setsail_nume_firma', label: 'Nume firmă' },
      { key: 'setsail_cui', label: 'CUI' },
      { key: 'setsail_nr_registru', label: 'Nr. registru comerțului' },
      { key: 'setsail_adresa', label: 'Adresă sediu' },
      { key: 'setsail_punct_lucru', label: 'Adresă punct de lucru' },
      { key: 'setsail_baza_limanu', label: 'Adresă bază Limanu' },
      { key: 'setsail_marina', label: 'Adresă marină' },
      { key: 'setsail_reprezentant', label: 'Reprezentant legal' },
      { key: 'setsail_functie_reprezentant', label: 'Funcție reprezentant' },
      { key: 'setsail_banca', label: 'Bancă' },
      { key: 'setsail_telefon', label: 'Telefon SetSail' },
      { key: 'email_setsail', label: 'Email SetSail' },
    ],
  },
  {
    category: 'Instructori', icon: '👤', vars: [
      { key: 'instructor_1', label: 'Instructor 1' },
      { key: 'instructor_2', label: 'Instructor 2' },
      { key: 'instructor_3', label: 'Instructor 3' },
    ],
  },
]

// Toate variabilele într-o listă plată (key + categorie)
export const MAIL_VARIABLES_FLAT: { key: string; label: string; category: string; icon: string }[] =
  MAIL_VAR_GROUPS.flatMap(g => g.vars.map(v => ({ ...v, category: g.category, icon: g.icon })))

function roDate(d: string, opts: Intl.DateTimeFormatOptions): string {
  return d ? new Date(d).toLocaleDateString('ro-RO', opts) : ''
}

// Ziua săptămânii în română („luni", „joi"). Data vine ca 'YYYY-MM-DD', deci o
// citim pe componente — `new Date(iso)` ar da miezul nopții UTC și, la fusul
// nostru, ar putea aluneca într-o altă zi.
function roWeekday(d: string): string {
  const day = localDay(d)
  return day ? day.toLocaleDateString('ro-RO', { weekday: 'long' }) : ''
}

// 'YYYY-MM-DD' → Date la miezul nopții LOCAL (null dacă lipsește)
function localDay(d: string): Date | null {
  const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number)
  return y && m && dd ? new Date(y, m - 1, dd) : null
}

// Regulile implicite stau în lib/session-defaults, ca să fie una singură
export { defaultExamTime } from './session-defaults'

// Intervalele de practică definite pe sesiune (programarea C/D Snagov).
// Se calculează pentru cursurile unde există programare pe ore — indiferent dacă
// e deja deschisă cursanților; la restul sesiunilor rămân goale.
function practiceSlots(sess: any): { ore: string; intervale: string } {
  const areIntervale = sess?.practice_booking_enabled || scopeForSession(sess) === 'curs_cd_snagov'
  if (!sess || !areIntervale) return { ore: '', intervale: '' }
  const slots = buildSlots(configFromSession(sess))
  if (!slots.length) return { ore: '', intervale: '' }
  const join = (list: string[]) => list.length > 1
    ? `${list.slice(0, -1).join(', ')} sau ${list[list.length - 1]}`
    : list[0] || ''
  return {
    ore: join(slots.map(s => s.from)),
    intervale: join(slots.map(s => `${s.from}–${s.to}`)),
  }
}

// Ziua a n-a de curs (1 = ziua de start): ziua săptămânii și data scurtă
function cursDay(csd: string, n: number): { zi: string; data: string } {
  const start = localDay(csd)
  if (!start) return { zi: '', data: '' }
  const d = new Date(start)
  d.setDate(d.getDate() + (n - 1))
  return {
    zi: d.toLocaleDateString('ro-RO', { weekday: 'long' }),
    data: d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }),
  }
}

// Calculează valorile tuturor variabilelor pentru un context
export function mailVarValues(ctx: MailVarCtx): Record<string, string> {
  const sess = ctx.sess || {}
  const origin = ctx.origin || 'https://setsail-practica.vercel.app'
  const info = ctx.setsailInfo || {}
  const sd = sess.session_date || ''
  const psd = sess.practice_start_date || ''
  const csd = sess.course_start_date || ''

  const contactIds: string[] = sess.contact_person_ids || []
  const selected = (ctx.contacts || [])
    .filter((c: any) => contactIds.includes(c.id))
    .sort((a: any, b: any) => String(a.full_name || '').localeCompare(String(b.full_name || ''), 'ro'))
  const instr = ctx.instructors || []

  return {
    // Sesiune
    link_portal: origin + '/portal?cod=' + (sess.access_code || ''),
    data_sesiune: roDate(sd, { day: '2-digit', month: 'long', year: 'numeric' }),
    locatie: sess.location_detail || sess.locations?.name || '',
    // doar numele localității: „Snagov", nu „Snagov, jud. Ilfov"
    locatie_scurta: String(sess.locations?.name || String(sess.location_detail || '').split(',')[0] || '').trim(),
    ambarcatiune: sess.boats?.name || '',
    ora_start: sess.practice_start_time || '9:30',
    ora_examinare: String(sess.exam_time || '').trim() || defaultExamTime(sess),
    data_start_curs: csd ? new Date(csd).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
    zz_data_start_practica: psd ? String(new Date(psd).getDate()) : '',
    zz_llll_data_practica: roDate(sd, { day: '2-digit', month: 'long' }),
    zz_data_start_curs: sess.course_start_date ? String(new Date(sess.course_start_date).getDate()) : '',
    zz_llll_aaaa_data_practica: roDate(sd, { day: '2-digit', month: 'long', year: 'numeric' }),
    zi_sapt_start_curs: roWeekday(csd),
    zi_sapt_practica: roWeekday(psd || sd),
    zi_sapt_examen: roWeekday(sd),
    // Zilele 2 și 3 de curs, calculate din ziua de start
    zi_sapt_curs_2: cursDay(csd, 2).zi,
    zi_sapt_curs_3: cursDay(csd, 3).zi,
    zz_llll_curs_2: cursDay(csd, 2).data,
    zz_llll_curs_3: cursDay(csd, 3).data,
    // Intervalele de programare la practică
    ore_practica: practiceSlots(sess).ore,
    intervale_practica: practiceSlots(sess).intervale,
    // Contact
    pers_cont_1: selected[0]?.full_name || '',
    pers_cont_2: selected[1]?.full_name || '',
    pers_cont_3: selected[2]?.full_name || '',
    pers_cont_4: selected[3]?.full_name || '',
    tel_cont_1: selected[0]?.phone || '',
    tel_cont_2: selected[1]?.phone || '',
    tel_cont_3: selected[2]?.phone || '',
    tel_cont_4: selected[3]?.phone || '',
    email_oficial_reprezentant: sess.evaluators?.email_oficial || '',
    email_personal_reprezentant: sess.evaluators?.email_personal || '',
    // Firma SetSail
    setsail_nume_firma: info.nume_firma || '',
    setsail_cui: info.cui || '',
    setsail_nr_registru: info.nr_registru || '',
    setsail_adresa: info.adresa || '',
    setsail_punct_lucru: info.adresa_punct_lucru || '',
    setsail_baza_limanu: info.adresa_baza_limanu || '',
    setsail_marina: info.adresa_marina || '',
    setsail_reprezentant: info.reprezentant_legal || '',
    setsail_functie_reprezentant: info.functie_reprezentant || '',
    setsail_banca: info.banca_1 || '',
    setsail_telefon: info.telefon_ruxandra || '',
    email_setsail: info.email_ruxandra || 'office@setsail.ro',
    // Instructori
    instructor_1: instr[0]?.full_name || '',
    instructor_2: instr[1]?.full_name || '',
    instructor_3: instr[2]?.full_name || '',
  }
}

// Extrage cheile interne ale formulelor {{cheie}} dintr-un text (unic, în ordinea apariției)
export function extractVars(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text || ''))) {
    const k = m[1]
    if (!seen.has(k)) { seen.add(k); out.push(k) }
  }
  return out
}

export function applyMailTemplate(text: string, ctx: MailVarCtx): string {
  if (!text) return ''
  const vals = mailVarValues(ctx)
  let result = text
  for (const [key, val] of Object.entries(vals)) {
    result = result.split('{{' + key + '}}').join(val)
  }
  return result
}
