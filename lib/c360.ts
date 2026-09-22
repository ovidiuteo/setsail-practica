// Cursant 360 — adună tot ce știm despre un om din toate seriile în care apare
// (același CNP sau același email), plus financiarul din cursant_obligatii / cursant_plati.
// Folosit de /api/c360/admin (admin) și /api/c360/portal (cod serie + email).
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { scopeForSession, timelineScopeLabel } from '@/lib/timeline-scope'

export function svc360(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

const ROW_COLS = 'id, session_id, full_name, cnp, email, phone, birth_date, address, city, county, country, ' +
  'nationality, class_caa, portal_status, signed_at, created_at, ci_series, ci_number, expiry_date, doc_type, ' +
  'only_sailing, notes, obtinere_prelungire, livrare_tip, livrare_adresa, livrare_trimis_la, ' +
  'are_ci, are_ci_verso, are_semnatura, are_adeverinta, are_cert_nastere, are_lrc, are_cerere_semnata'

const SESSION_COLS = 'id, session_date, course_start_date, practice_start_date, practice_start_time, exam_time, ' +
  'status, session_type, parent_session_id, class_caa, access_code, timeline_scope, location_detail, ' +
  'zoom_url, whatsapp_url, arhiva_video_url, materiale_url, comunitate_url, instructor_id_2, instructor_id_3, ' +
  'boat_id_2, boat_id_3, practice_booking_enabled, locations(name, county), instructors(full_name), boats(name)'

export type Pas = { titlu: string; data: string | null; stare: 'gata' | 'curent' | 'viitor'; detaliu?: string }
export type Suma = Record<string, number> // pe monedă

export type Cursant360 = {
  seedId: string
  persoana: {
    full_name: string; email: string; phone: string; cnp: string; birth_date: string
    address: string; city: string; county: string; country: string; nationality: string
    ci_series: string; ci_number: string; expiry_date: string; class_caa: string; doc_type: string
    livrare_tip: string; livrare_adresa: string
  }
  notite: string
  inscrieri: Array<{
    studentId: string; sessionId: string; program: string; clasa: string; locatie: string
    dataCurs: string | null; dataPractica: string | null; dataExamen: string | null; oraExamen: string
    stareSesiune: string; tipSesiune: string; stareCursant: string; codSerie: string
    instructori: string[]; barci: string[]; semnatLa: string | null; creatLa: string
    doarNavigatie: boolean
  }>
  documente: Array<{ nume: string; ok: boolean; detaliu?: string }>
  programari: Array<{ sessionId: string; data: string; de: string; pana: string; colegi: string[] }>
  diplome: Array<{ id: string; serie: string; numar: number; emisa: string | null; activa: boolean; tiparita: string | null; livrata: string | null }>
  financiar: {
    obligatii: Array<{ id: string; studentId: string; program: string; suma: number; moneda: string; scadenta: string | null; note: string | null; platit: number }>
    plati: Array<{ id: string; studentId: string; obligatieId: string | null; suma: number; moneda: string; platitLa: string; metoda: string | null; facturaNr: string | null; note: string | null }>
    datorat: Suma; platit: Suma; sold: Suma
    urmatoareaScadenta: string | null
  }
  resurse: Array<{ tip: 'zoom' | 'whatsapp' | 'video' | 'materiale' | 'comunitate'; titlu: string; url: string }>
  evenimente: Array<{ sessionId: string; titlu: string; locatie: string; data: string; clasa: string }>
  pasi: Pas[]
  indicatori: { serii: number; zilePana: number | null; urmatorulPas: string | null; documenteLipsa: number }
}

const today = () => new Date().toISOString().slice(0, 10)
// ilike fără wildcard-uri: „_” și „%” din email se potrivesc doar pe ele însele
const exact = (v: string) => v.replace(/[\\%_]/g, m => '\\' + m)
const add = (s: Suma, moneda: string, v: number) => { s[moneda] = Math.round(((s[moneda] || 0) + v) * 100) / 100 }
const pick = (rows: any[], k: string) => {
  for (const r of rows) if (r[k] != null && String(r[k]).trim() !== '') return String(r[k])
  return ''
}

// Toate rândurile din students care reprezintă același om ca seed-ul
async function randuriPersoana(sb: SupabaseClient, seed: any): Promise<any[]> {
  const byId = new Map<string, any>([[seed.id, seed]])
  const email = String(seed.email || '').trim()
  const cnp = String(seed.cnp || '').replace(/\D/g, '')
  const [a, b] = await Promise.all([
    email ? sb.from('students_360').select(ROW_COLS).ilike('email', exact(email)) : Promise.resolve({ data: [] as any[] }),
    cnp.length === 13 ? sb.from('students_360').select(ROW_COLS).eq('cnp', cnp) : Promise.resolve({ data: [] as any[] }),
  ])
  for (const r of [...(a.data || []), ...(b.data || [])]) byId.set(r.id, r)
  // cele mai noi primele — datele personale se iau din cel mai recent rând completat
  return Array.from(byId.values()).sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))
}

export async function seedDupaId(sb: SupabaseClient, id: string) {
  const { data } = await sb.from('students_360').select(ROW_COLS).eq('id', id).maybeSingle()
  return data
}

// Poarta portalului: codul seriei + emailul. Codul poate fi al oricărei serii a cursantului
// (principală, clonă sau absenți), iar sesiunile finalizate rămân accesibile.
export async function seedDupaCod(sb: SupabaseClient, cod: string, email: string) {
  const code = cod.toUpperCase().trim()
  const mail = email.trim()
  if (!code || !mail) return null
  const { data: sess } = await sb.from('sessions').select('id').eq('access_code', code)
  const ids = (sess || []).map((s: any) => s.id)
  if (!ids.length) return null
  const { data: abs } = await sb.from('sessions').select('id').in('parent_session_id', ids).eq('session_type', 'absent')
  for (const a of abs || []) if (!ids.includes(a.id)) ids.push(a.id)
  const { data: rows } = await sb.from('students_360').select(ROW_COLS).in('session_id', ids).ilike('email', exact(mail))
  const rank = (x: any) => (x.portal_status === 'absent' ? 2 : x.only_sailing ? 1 : 0)
  return (rows || []).sort((a: any, b: any) => rank(a) - rank(b))[0] || null
}

function programLabel(s: any): string {
  const scope = scopeForSession(s)
  return timelineScopeLabel(scope)
}

export async function incarca360(sb: SupabaseClient, seed: any, opts: { admin: boolean }): Promise<Cursant360> {
  const rows = await randuriPersoana(sb, seed)
  const studentIds = rows.map(r => r.id)
  const sessionIds = Array.from(new Set(rows.map(r => r.session_id).filter(Boolean)))

  const [sessRes, bookRes, dipRes, oblRes, platRes, evRes] = await Promise.all([
    sessionIds.length ? sb.from('sessions').select(SESSION_COLS).in('id', sessionIds) : Promise.resolve({ data: [] as any[] }),
    sb.from('practice_bookings').select('session_id, student_id, slot_date, slot_from, slot_to').in('student_id', studentIds),
    sb.from('diplomas').select('id, series, number, issue_date, status, printed_at, delivered_at, student_id').in('student_id', studentIds),
    sb.from('cursant_obligatii').select('*').in('student_id', studentIds).order('created_at'),
    sb.from('cursant_plati').select('*').in('student_id', studentIds).order('platit_la', { ascending: false }),
    sb.from('sessions').select('id, session_date, course_start_date, class_caa, timeline_scope, status, session_type, location_detail, locations(name, county)')
      .eq('session_type', 'principal').gte('session_date', today()).neq('status', 'completed')
      .order('session_date').limit(12),
  ])
  const sessions = new Map<string, any>((sessRes.data || []).map((s: any) => [s.id, s]))

  // Instructorii și bărcile 2/3 nu au FK — îi citim separat
  const extraInstr = new Set<string>(), extraBoats = new Set<string>()
  for (const s of Array.from(sessions.values())) {
    if (s.instructor_id_2) extraInstr.add(s.instructor_id_2)
    if (s.instructor_id_3) extraInstr.add(s.instructor_id_3)
    if (s.boat_id_2) extraBoats.add(s.boat_id_2)
    if (s.boat_id_3) extraBoats.add(s.boat_id_3)
  }
  const [ii, bb] = await Promise.all([
    extraInstr.size ? sb.from('instructors').select('id, full_name').in('id', Array.from(extraInstr)) : Promise.resolve({ data: [] as any[] }),
    extraBoats.size ? sb.from('boats').select('id, name').in('id', Array.from(extraBoats)) : Promise.resolve({ data: [] as any[] }),
  ])
  const instrName = new Map<string, string>((ii.data || []).map((x: any) => [x.id, x.full_name]))
  const boatName = new Map<string, string>((bb.data || []).map((x: any) => [x.id, x.name]))

  const inscrieri = rows.filter(r => sessions.has(r.session_id)).map(r => {
    const s = sessions.get(r.session_id)
    const instructori = [s.instructors?.full_name, instrName.get(s.instructor_id_2), instrName.get(s.instructor_id_3)].filter(Boolean)
    const barci = [s.boats?.name, boatName.get(s.boat_id_2), boatName.get(s.boat_id_3)].filter(Boolean)
    return {
      studentId: r.id, sessionId: s.id, program: programLabel(s), clasa: r.class_caa || s.class_caa || '',
      locatie: (s.location_detail || s.locations?.name || ''),
      dataCurs: s.course_start_date || null, dataPractica: s.practice_start_date || s.session_date || null,
      dataExamen: s.session_date || null, oraExamen: s.exam_time || s.practice_start_time || '',
      stareSesiune: s.status || '', tipSesiune: s.session_type || '', stareCursant: r.portal_status || '',
      codSerie: opts.admin ? (s.access_code || '') : '',
      instructori, barci, semnatLa: r.signed_at || null, creatLa: r.created_at, doarNavigatie: !!r.only_sailing,
    }
  }).sort((a, b) => String(b.dataExamen || '').localeCompare(String(a.dataExamen || '')))

  // Colegii de interval: ceilalți cursanți programați în aceleași sloturi
  const bookings = bookRes.data || []
  const programari: Cursant360['programari'] = []
  if (bookings.length) {
    const { data: all } = await sb.from('practice_bookings')
      .select('session_id, student_id, slot_from, students!student_id(full_name)')
      .in('session_id', Array.from(new Set(bookings.map((b: any) => b.session_id))))
    for (const b of bookings) {
      const colegi = (all || [])
        .filter((x: any) => x.session_id === b.session_id && x.slot_from === b.slot_from && !studentIds.includes(x.student_id))
        .map((x: any) => scurtNume(x.students?.full_name || ''))
      programari.push({ sessionId: b.session_id, data: b.slot_date, de: b.slot_from, pana: b.slot_to, colegi })
    }
  }

  // Documentele: prezente pe oricare dintre rânduri
  const oricare = (k: string) => rows.some(r => r[k])
  const documente = [
    { nume: 'Act de identitate (față)', ok: oricare('are_ci') },
    { nume: 'Act de identitate (verso)', ok: oricare('are_ci_verso'), optional: true },
    { nume: 'Semnătură', ok: oricare('are_semnatura') },
    { nume: 'Date completate în portal', ok: rows.some(r => r.portal_status === 'signed'), detaliu: rows.find(r => r.signed_at)?.signed_at || undefined },
    { nume: 'Adeverință adresă', ok: oricare('are_adeverinta'), optional: true },
    { nume: 'Certificat naștere', ok: oricare('are_cert_nastere'), optional: true },
    { nume: 'Certificat LRC', ok: oricare('are_lrc'), optional: true },
    { nume: 'Cerere semnată', ok: oricare('are_cerere_semnata'), optional: true },
  ].filter(d => d.ok || !(d as any).optional).map(({ nume, ok, detaliu }) => ({ nume, ok, detaliu }))

  const diplome = (dipRes.data || []).map((d: any) => ({
    id: d.id, serie: d.series, numar: d.number, emisa: d.issue_date, activa: d.status === 1,
    tiparita: d.printed_at, livrata: d.delivered_at,
  }))

  // Financiar
  const plati = (platRes.data || []).map((p: any) => ({
    id: p.id, studentId: p.student_id, obligatieId: p.obligatie_id, suma: Number(p.suma), moneda: p.moneda,
    platitLa: p.platit_la, metoda: p.metoda, facturaNr: p.factura_nr, note: opts.admin ? p.note : null,
  }))
  const datorat: Suma = {}, platit: Suma = {}, sold: Suma = {}
  const obligatii = (oblRes.data || []).map((o: any) => {
    const pl = plati.filter(p => p.obligatieId === o.id && p.moneda === o.moneda).reduce((s, p) => s + p.suma, 0)
    add(datorat, o.moneda, Number(o.suma))
    return { id: o.id, studentId: o.student_id, program: o.program, suma: Number(o.suma), moneda: o.moneda, scadenta: o.scadenta, note: opts.admin ? o.note : null, platit: pl }
  })
  for (const p of plati) add(platit, p.moneda, p.suma)
  for (const m of Array.from(new Set(Object.keys(datorat).concat(Object.keys(platit))))) sold[m] = Math.round(((datorat[m] || 0) - (platit[m] || 0)) * 100) / 100
  const urmatoareaScadenta = obligatii.filter(o => o.scadenta && o.platit < o.suma).map(o => o.scadenta!).sort()[0] || null

  // Resursele seriilor (cea mai recentă serie întâi, fără duplicate)
  const resurse: Cursant360['resurse'] = []
  const seen = new Set<string>()
  const RES: Array<[string, Cursant360['resurse'][number]['tip'], string]> = [
    ['zoom_url', 'zoom', 'Zoom — cursul online'], ['whatsapp_url', 'whatsapp', 'Grupul WhatsApp al seriei'],
    ['arhiva_video_url', 'video', 'Arhiva video a cursului'], ['materiale_url', 'materiale', 'Materiale de curs'],
    ['comunitate_url', 'comunitate', 'Comunitatea SetSail'],
  ]
  for (const i of inscrieri) {
    const s = sessions.get(i.sessionId)
    for (const [k, tip, titlu] of RES) {
      const url = String(s?.[k] || '').trim()
      if (url && !seen.has(url)) { seen.add(url); resurse.push({ tip, titlu: inscrieri.length > 1 ? `${titlu} · ${i.program}` : titlu, url }) }
    }
  }

  const meiSesiuni = new Set(inscrieri.map(i => i.sessionId))
  const evenimente = (evRes.data || []).filter((s: any) => !meiSesiuni.has(s.id)).slice(0, 8).map((s: any) => ({
    sessionId: s.id, titlu: programLabel(s), locatie: (s.location_detail || s.locations?.name || ''),
    data: s.session_date, clasa: s.class_caa || '',
  }))

  // Parcursul — după înscrierea cea mai recentă
  const pasi: Pas[] = []
  const cur = inscrieri[0]
  const t = today()
  const stare = (d: string | null, gata?: boolean): Pas['stare'] => gata || (d && d < t) ? 'gata' : 'viitor'
  if (cur) {
    pasi.push({ titlu: 'Înscriere', data: cur.creatLa?.slice(0, 10) || null, stare: 'gata' })
    pasi.push({ titlu: 'Date & semnătură', data: cur.semnatLa?.slice(0, 10) || null, stare: cur.stareCursant === 'signed' ? 'gata' : 'viitor' })
    if (obligatii.length) {
      const achitat = Object.values(sold).every(v => v <= 0)
      pasi.push({ titlu: 'Plată integrală', data: urmatoareaScadenta, stare: achitat ? 'gata' : 'viitor', detaliu: achitat ? 'achitat' : 'rest de plată' })
    }
    if (cur.dataCurs) pasi.push({ titlu: 'Curs teoretic', data: cur.dataCurs, stare: stare(cur.dataCurs) })
    const prog = programari.find(p => p.sessionId === cur.sessionId)
    if (prog) pasi.push({ titlu: 'Practică programată', data: prog.data, stare: stare(prog.data), detaliu: `${prog.de}–${prog.pana}` })
    pasi.push({ titlu: 'Practică & examen', data: cur.dataExamen, stare: stare(cur.dataExamen, cur.stareSesiune === 'completed'), detaliu: cur.oraExamen || undefined })
    const dip = diplome.find(d => d.activa)
    pasi.push({ titlu: 'Brevet / diplomă', data: dip?.emisa || null, stare: dip ? 'gata' : 'viitor', detaliu: dip ? `${dip.serie} ${dip.numar}` : undefined })
    const firstOpen = pasi.findIndex(p => p.stare !== 'gata')
    if (firstOpen >= 0) pasi[firstOpen].stare = 'curent'
  }
  const urm = pasi.find(p => p.stare === 'curent') || null
  const zilePana = urm?.data ? Math.ceil((Date.parse(urm.data) - Date.parse(t)) / 86400000) : null

  return {
    seedId: seed.id,
    persoana: {
      full_name: pick(rows, 'full_name'), email: pick(rows, 'email'), phone: pick(rows, 'phone'),
      cnp: opts.admin ? pick(rows, 'cnp') : mascheaza(pick(rows, 'cnp')), birth_date: pick(rows, 'birth_date'),
      address: pick(rows, 'address'), city: pick(rows, 'city'), county: pick(rows, 'county'), country: pick(rows, 'country'),
      nationality: pick(rows, 'nationality'), ci_series: pick(rows, 'ci_series'),
      ci_number: opts.admin ? pick(rows, 'ci_number') : mascheaza(pick(rows, 'ci_number')),
      expiry_date: pick(rows, 'expiry_date'), class_caa: pick(rows, 'class_caa'), doc_type: pick(rows, 'doc_type'),
      livrare_tip: pick(rows, 'livrare_tip'), livrare_adresa: pick(rows, 'livrare_adresa'),
    },
    notite: opts.admin ? String(rows.find(r => r.id === seed.id)?.notes || '') : '',
    inscrieri, documente, programari, diplome,
    financiar: { obligatii, plati, datorat, platit, sold, urmatoareaScadenta },
    resurse, evenimente, pasi,
    indicatori: {
      serii: inscrieri.length, zilePana, urmatorulPas: urm?.titlu || null,
      documenteLipsa: documente.filter(d => !d.ok).length,
    },
  }
}

function mascheaza(v: string): string {
  if (!v) return ''
  if (v.length <= 4) return '••••'
  return v.slice(0, 1) + '•'.repeat(Math.max(3, v.length - 4)) + v.slice(-3)
}

function scurtNume(n: string): string {
  const p = n.trim().split(/\s+/).filter(Boolean)
  if (p.length < 2) return n.trim()
  // „POPESCU Ion” / „Ion Popescu” → prenumele + inițiala numelui
  const prenume = p[p.length - 1]
  return `${prenume.charAt(0).toUpperCase()}${prenume.slice(1).toLowerCase()} ${p[0].charAt(0).toUpperCase()}.`
}
