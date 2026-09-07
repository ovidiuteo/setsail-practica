// Valorile implicite derivate din locația și tipul unei sesiuni.
// Folosite la crearea sesiunii, în „Editează sesiunea" și în notificarea ANR,
// ca peste tot să se vadă aceleași valori.

const ADRESA_SEDIU = 'str. Virgiliu nr. 15, etaj 3, Sector 1, București'

function locKind(sess: any): 'snagov' | 'litoral' | 'alta' {
  const loc = String(sess?.locations?.name || sess?.location_name || '').toLowerCase()
  if (loc.includes('snagov')) return 'snagov'
  if (loc.includes('limanu') || loc.includes('mangalia')) return 'litoral'
  return 'alta'
}

const isRadioSess = (sess: any) =>
  /radio|lrc/i.test(String(sess?.timeline_scope || sess?.class_caa || ''))

// Ora examinării: 12:00 la Snagov, 10:00 la Limanu/Mangalia, 20:00 la radio
export function defaultExamTime(sess: any): string {
  if (isRadioSess(sess)) return '20:00'
  return locKind(sess) === 'snagov' ? '12:00' : '10:00'
}

// Locul unde se țin cursurile, așa cum apare în notificarea ANR
export function defaultLocatieCurs(sess: any): string {
  const k = locKind(sess)
  if (k === 'snagov') return `${ADRESA_SEDIU}/Lacul Snagov`
  if (k === 'litoral') return `${ADRESA_SEDIU}/Marina Limanu`
  return `${ADRESA_SEDIU}/${String(sess?.locations?.name || '')}`
}

// Locul examinării practice
export function defaultLocatieExaminare(sess: any): string {
  const k = locKind(sess)
  if (k === 'snagov') return 'de pe Lacul Snagov'
  if (k === 'litoral') return 'din Marina Limanu'
  return `din ${String(sess?.locations?.name || '')}`
}

// Clasa, așa cum apare în notificare
export function defaultNotifClasa(sess: any): string {
  return String(sess?.class_caa || '').includes('B')
    ? 'B/Manevra ambarcatiunii cu vele'
    : 'C/D/Manevra ambarcatiunii cu vele'
}

// Toate valorile care se scriu pe sesiune la creare
export function sessionDefaults(sess: any): Record<string, string> {
  return {
    exam_time: defaultExamTime(sess),
    notif_clasa: defaultNotifClasa(sess),
    notif_locatie_curs: defaultLocatieCurs(sess),
    notif_locatie_examinare: defaultLocatieExaminare(sess),
  }
}
