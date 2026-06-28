// Catalog unic de variabile pentru template-urile de email + funcția de aplicare.
// Folosit atât la trimitere (pagina sesiunii) cât și la editor (picker cu exemple).

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
      { key: 'locatie', label: 'Locația' },
      { key: 'ambarcatiune', label: 'Ambarcațiunea' },
      { key: 'ora_start', label: 'Ora de start practică' },
      { key: 'data_start_curs', label: 'Data start curs (zi săpt, zz lună)' },
      { key: 'zz_data_start_practica', label: 'Ziua din data start practică' },
      { key: 'zz_llll_data_practica', label: 'Ziua și luna practicii' },
      { key: 'zz_data_start_curs', label: 'Ziua din data start curs' },
      { key: 'zz_llll_aaaa_data_practica', label: 'Ziua, luna, anul practicii' },
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
    ambarcatiune: sess.boats?.name || '',
    ora_start: sess.practice_start_time || '9:30',
    data_start_curs: csd ? new Date(csd).toLocaleDateString('ro-RO', { weekday: 'long', day: 'numeric', month: 'long' }) : '',
    zz_data_start_practica: psd ? String(new Date(psd).getDate()) : '',
    zz_llll_data_practica: roDate(sd, { day: '2-digit', month: 'long' }),
    zz_data_start_curs: sess.course_start_date ? String(new Date(sess.course_start_date).getDate()) : '',
    zz_llll_aaaa_data_practica: roDate(sd, { day: '2-digit', month: 'long', year: 'numeric' }),
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

export function applyMailTemplate(text: string, ctx: MailVarCtx): string {
  if (!text) return ''
  const vals = mailVarValues(ctx)
  let result = text
  for (const [key, val] of Object.entries(vals)) {
    result = result.split('{{' + key + '}}').join(val)
  }
  return result
}
