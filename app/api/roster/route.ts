import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Câmpuri editabile de pe pagina gated
const EDITABLE = new Set(['full_name', 'email', 'cnp', 'birth_date', 'address', 'city', 'county', 'obtinere_prelungire'])
const MAX_IMG = 8 * 1024 * 1024 // ~8MB data URL

// Validează (session_id, token) și întoarce true dacă tokenul corespunde
async function authed(sb: ReturnType<typeof svc>, sessionId: string, token: string) {
  if (!sessionId || !token) return false
  const { data } = await sb.from('sessions').select('roster_token').eq('id', sessionId).maybeSingle()
  return !!data?.roster_token && data.roster_token === token
}

const VERIFIERS = ['corina', 'paula', 'ruxandra'] as const

// Găsește celelalte fișe ale ACELEIAȘI persoane (fiecare rând din `students` e o
// înscriere per sesiune). Potrivire în ordinea încrederii: CNP → email → nume.
async function findPersonRows(
  sb: ReturnType<typeof svc>,
  person: { cnp?: string | null; email?: string | null; full_name?: string | null },
  excludeId?: string,
) {
  const cnp = String(person.cnp || '').trim()
  const email = String(person.email || '').trim()
  const name = String(person.full_name || '').trim()
  const sel = '*, sessions!session_id(session_date, class_caa)'
  let rows: any[] = []

  if (cnp) {
    const { data } = await sb.from('students').select(sel).eq('cnp', cnp)
    rows = data || []
  }
  if (!rows.length && email) {
    const { data } = await sb.from('students').select(sel).ilike('email', email)
    rows = data || []
  }
  if (!rows.length && name) {
    const { data } = await sb.from('students').select(sel).ilike('full_name', name)
    rows = data || []
  }
  return rows.filter(r => r.id !== excludeId)
}

// Câmpurile care se moștenesc de la o fișă existentă a aceleiași persoane:
// date personale + documentele deja încărcate și verificate.
const CARRY_FIELDS = [
  'cnp', 'birth_date', 'address', 'city', 'county', 'country', 'phone',
  'ci_series', 'ci_number', 'expiry_date', 'nationality', 'doc_type',
  'ci_image_data', 'ci_verso_data', 'adeverinta_adresa_data', 'certificat_nastere_data',
  'signature_data', 'lrc_certificat_data', 'lrc_numar', 'lrc_emis_la', 'lrc_expira_la',
]

// Seriile de radio pentru dropdownul „Înscris la": întâi seria care urmează,
// apoi cele trecute (cea mai recentă prima), apoi eventualele serii de după.
async function radioSessionOptions(sb: ReturnType<typeof svc>) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const { data } = await sb.from('sessions')
    .select('id, class_caa, session_date, course_start_date, timeline_scope, session_type, is_clone, locations(name)')
    .order('session_date', { ascending: true })

  const radio = (data || []).filter((s: any) =>
    /radio|lrc/i.test(String(s.timeline_scope || s.class_caa || '')) && s.session_type === 'principal' && !s.is_clone)
  const startOf = (s: any) => String(s.course_start_date || s.session_date || '').slice(0, 10)
  const upcoming = radio.filter((s: any) => startOf(s) > iso)
  const past = radio.filter((s: any) => startOf(s) <= iso).reverse()

  const opt = (s: any, group: 'next' | 'past' | 'future') => ({
    id: s.id, group,
    label: `${(s.class_caa || 'Radio').trim()} · ${s.session_date ? new Date(s.session_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}`,
  })
  return [
    ...upcoming.slice(0, 1).map((s: any) => opt(s, 'next')),
    ...past.map((s: any) => opt(s, 'past')),
    ...upcoming.slice(1).map((s: any) => opt(s, 'future')),
  ]
}

// Vizitele pe landing-ul de radio: azi + totalul de la ultimul examen încoace.
// Ziua examenului seriei precedente e momentul din care vizitele „aparțin"
// cursului următor, deci de acolo repornește totalul.
async function landingVisits(sb: ReturnType<typeof svc>) {
  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data: sessions } = await sb.from('sessions')
    .select('session_date, class_caa, timeline_scope, session_type, is_clone')
    .lte('session_date', iso)
    .order('session_date', { ascending: false })
  const prev = (sessions || []).find((s: any) =>
    /radio|lrc/i.test(String(s.timeline_scope || s.class_caa || '')) && s.session_type === 'principal' && !s.is_clone)
  const from = prev?.session_date ? String(prev.session_date).slice(0, 10) : null

  const { data: days } = await sb.from('radio_visit_stats').select('day, count')
  const rows = (days || []) as { day: string; count: number }[]
  return {
    today: rows.find(r => r.day === iso)?.count || 0,
    overall: rows.filter(r => !from || r.day >= from).reduce((a, r) => a + (r.count || 0), 0),
    since: from,
  }
}

// Derivă obținere/prelungire din clasă (ex. "Obtinere LRC", "Prelungire LRC")
function lrcFromClass(cls: string): string {
  const c = (cls || '').toLowerCase()
  if (c.includes('prelungire')) return 'prelungire'
  if (c.includes('obtinere') || c.includes('obținere')) return 'obtinere'
  return ''
}

// GET — lista cursanților (fără base64), sau imaginea CI a unui cursant (student_id + side)
export async function GET(req: NextRequest) {
  const sb = svc()
  const sp = req.nextUrl.searchParams
  const sessionId = sp.get('session_id') || ''
  const token = sp.get('token') || ''
  const { data: sess } = await sb.from('sessions')
    .select('roster_token, roster_verified, roster_docs_visible, class_caa, session_date, course_start_date, access_code')
    .eq('id', sessionId).maybeSingle()
  if (!sessionId || !token || !sess?.roster_token || sess.roster_token !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const studentId = sp.get('student_id')
  const side = sp.get('side') // 'recto' | 'verso'

  // Câte alte serii mai are persoana — ca ștergerea să spună exact ce se întâmplă
  if (studentId && sp.get('action') === 'usage') {
    const { data: st } = await sb.from('students')
      .select('cnp, email, full_name').eq('id', studentId).eq('session_id', sessionId).maybeSingle()
    if (!st) return NextResponse.json({ error: 'not found' }, { status: 404 })
    const others = await findPersonRows(sb, st, studentId)
    return NextResponse.json({
      other_count: others.length,
      other_sessions: others.map((o: any) => ({
        session_date: o.sessions?.session_date || null,
        class_caa: o.sessions?.class_caa || o.class_caa || null,
      })),
    })
  }

  // Leadurile de pe landing-ul de radio (fără arhivate și fără cei deja înscriși
  // în această serie — după email), plus seriile pentru dropdownul de participare
  if (sp.get('action') === 'leads') {
    const [{ data }, { data: enrolled }, sessions] = await Promise.all([
      sb.from('radio_leads').select('*').order('created_at', { ascending: false }),
      sb.from('students').select('email').eq('session_id', sessionId),
      radioSessionOptions(sb),
    ])
    const taken = new Set((enrolled || []).map((s: any) => String(s.email || '').trim().toLowerCase()).filter(Boolean))
    const leads = (data || []).filter((l: any) =>
      l.status !== 'arhivat' && !taken.has(String(l.email || '').trim().toLowerCase()))
    return NextResponse.json({ leads, sessions })
  }

  if (studentId) {
    const col = side === 'verso' ? 'ci_verso_data' : 'ci_image_data'
    const { data } = await sb.from('students').select(`${col}`).eq('id', studentId).eq('session_id', sessionId).maybeSingle()
    return NextResponse.json({ image: (data as any)?.[col] || null })
  }

  // Documentele sunt base64 de câțiva MB → nu le aducem în listă, ci întrebăm
  // doar CINE are fiecare document (interogări care întorc numai id-uri).
  const DOC_COLS = {
    has_ci: 'ci_image_data',
    has_verso: 'ci_verso_data',
    has_adeverinta: 'adeverinta_adresa_data',
    has_cert_nastere: 'certificat_nastere_data',
    has_signature: 'signature_data',
    has_cerere: 'cerere_semnata_data',
  } as const
  type DocKey = keyof typeof DOC_COLS

  const [{ data, error }, docSets, { data: cereri }] = await Promise.all([
    sb.from('students')
      .select('id, full_name, email, cnp, birth_date, address, city, county, class_caa, obtinere_prelungire, doc_type')
      .eq('session_id', sessionId),
    Promise.all((Object.entries(DOC_COLS) as [DocKey, string][]).map(async ([key, col]) => {
      const { data: ids } = await sb.from('students').select('id')
        .eq('session_id', sessionId).not(col, 'is', null).neq(col, '')
      return [key, new Set((ids || []).map((r: any) => r.id))] as [DocKey, Set<string>]
    })),
    sb.from('cerere_numbers').select('student_id, numar, data_cerere').eq('session_id', sessionId),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const has = Object.fromEntries(docSets) as Record<DocKey, Set<string>>
  const cerereBy = new Map<string, { numar: number; data_cerere: string }>()
  for (const c of cereri || []) cerereBy.set((c as any).student_id, c as any)

  const rows = (data || []).map((r: any) => ({
    id: r.id, full_name: r.full_name, email: r.email, cnp: r.cnp, birth_date: r.birth_date,
    address: r.address, city: r.city, county: r.county,
    // Informația vine din clasă (sursa de adevăr); valoarea stocată e doar fallback dacă clasa nu o conține
    obtinere_prelungire: lrcFromClass(r.class_caa) || r.obtinere_prelungire || '',
    doc_type: r.doc_type || '',
    has_ci: has.has_ci.has(r.id), has_verso: has.has_verso.has(r.id),
    has_adeverinta: has.has_adeverinta.has(r.id),
    has_cert_nastere: has.has_cert_nastere.has(r.id),
    has_signature: has.has_signature.has(r.id),
    has_cerere: has.has_cerere.has(r.id),
    cerere_nr: cerereBy.get(r.id)?.numar ?? null,
    cerere_data: cerereBy.get(r.id)?.data_cerere ?? null,
  }))
  rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ro', { sensitivity: 'base' }))
  const verified: Record<string, boolean> = {}
  for (const v of VERIFIERS) verified[v] = !!(sess.roster_verified as any)?.[v]
  // Vizitele pe landing-ul de radio. „Overall" repornește în ziua examenului
  // seriei precedente — de atunci încolo vizitele sunt pentru cursul următor.
  const visits = await landingVisits(sb)

  return NextResponse.json({
    students: rows, verified, docs_visible: !!sess.roster_docs_visible, visits,
    // pentru titlul paginii/tab-ului (ex. „Curs Radio 5-7 oct")
    session: { class_caa: sess.class_caa, session_date: sess.session_date, course_start_date: sess.course_start_date },
    // codul sesiunii — pentru linkul portalului cursantului
    access_code: sess.access_code || '',
  })
}

// PATCH — modifică câmpuri ale unui cursant
//   { session_id, token, student_id, field, value }  sau  { ..., fields: {...} }
export async function PATCH(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => ({}))
  const { session_id, token, student_id, field, value, fields } = body || {}
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  // Editarea unui lead de pe landing (status / seria la care e înscris)
  if (body?.lead_id) {
    const upd: Record<string, any> = {}
    if (typeof body.status === 'string') upd.status = body.status
    if ('participare_session_id' in body) upd.participare_session_id = body.participare_session_id || null
    if (!Object.keys(upd).length) return NextResponse.json({ error: 'câmp invalid' }, { status: 400 })
    const { error } = await sb.from('radio_leads').update(upd).eq('id', body.lead_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (!student_id) return NextResponse.json({ error: 'lipsește cursantul' }, { status: 400 })

  const updates: Record<string, any> = {}
  if (fields && typeof fields === 'object') {
    for (const [k, v] of Object.entries(fields)) if (EDITABLE.has(k)) updates[k] = typeof v === 'string' ? v.trim() : v
  } else if (EDITABLE.has(field)) {
    updates[field] = typeof value === 'string' ? value.trim() : value
  }
  if (!Object.keys(updates).length) return NextResponse.json({ error: 'câmp invalid' }, { status: 400 })

  const { error } = await sb.from('students').update(updates).eq('id', student_id).eq('session_id', session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// PUT — actualizează flag-urile de verificare a listei { session_id, token, verified:{corina,paula,ruxandra} }
export async function PUT(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => ({}))
  const { session_id, token, verified } = body || {}
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const clean: Record<string, boolean> = {}
  for (const v of VERIFIERS) clean[v] = !!(verified || {})[v]
  const { error } = await sb.from('sessions').update({ roster_verified: clean }).eq('id', session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, verified: clean })
}

// Clasa CAA pentru un cursant nou, după obținere/prelungire (sesiuni radio)
function classFromLrc(lrc: string, sessionClass: string): string {
  if (lrc === 'obtinere') return 'Obtinere LRC'
  if (lrc === 'prelungire') return 'Prelungire LRC'
  return sessionClass || ''
}

// POST — upload imagine CI { session_id, token, student_id, side, imageData(dataURL) }
//   sau adăugare cursanți { session_id, token, students: [{ full_name, cnp, ... }] }
export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => ({}))
  const { session_id, token, student_id, side, imageData } = body || {}
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  // ── Înscrie un lead ca cursant în această serie ──
  // Trece prin aceeași cale ca adăugarea manuală, deci moștenește datele și
  // documentele dacă persoana mai e în sistem din altă serie.
  if (body?.enroll_lead_id) {
    const { data: lead } = await sb.from('radio_leads').select('*').eq('id', body.enroll_lead_id).maybeSingle()
    if (!lead) return NextResponse.json({ error: 'lead inexistent' }, { status: 404 })

    const email = String((lead as any).email || '').trim()
    if (email) {
      const { data: dup } = await sb.from('students').select('id').eq('session_id', session_id).ilike('email', email)
      if (dup?.length) return NextResponse.json({ error: 'Cursantul e deja în această serie.' }, { status: 409 })
    }

    const [{ data: sessRow }, { data: last }] = await Promise.all([
      sb.from('sessions').select('class_caa').eq('id', session_id).maybeSingle(),
      sb.from('students').select('order_in_session').eq('session_id', session_id)
        .order('order_in_session', { ascending: false }).limit(1).maybeSingle(),
    ])
    const person = {
      full_name: String((lead as any).name || '').trim().toUpperCase(),
      email, phone: String((lead as any).phone || '').trim(),
    }
    const base: any = {
      session_id, ...person,
      // „Reînnoire" pe landing = prelungirea valabilității certificatului
      obtinere_prelungire: /re[iî]n/i.test(String((lead as any).lead_type || '')) ? 'prelungire' : 'obtinere',
      order_in_session: ((last as any)?.order_in_session || 0) + 1,
      only_sailing: false, portal_status: 'pending',
    }
    base.class_caa = classFromLrc(base.obtinere_prelungire, (sessRow as any)?.class_caa || '')
    const prevRows = await findPersonRows(sb, person)
    if (prevRows.length) {
      const prev: any = prevRows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
      for (const f of CARRY_FIELDS) if (!String(base[f] ?? '').trim() && String(prev[f] ?? '').trim()) base[f] = prev[f]
    }
    const { error } = await sb.from('students').insert(base)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await sb.from('radio_leads')
      .update({ status: 'inscris', participare_session_id: session_id }).eq('id', body.enroll_lead_id)
    return NextResponse.json({ ok: true, reused: prevRows.length > 0 })
  }

  // ── Adăugare cursanți (manual sau din tabel lipit) ──
  if (Array.isArray(body.students)) {
    const incoming = body.students
      .map((s: any) => ({
        full_name: String(s?.full_name || '').trim(),
        cnp: String(s?.cnp || '').trim(),
        birth_date: String(s?.birth_date || '').trim(),
        address: String(s?.address || '').trim(),
        city: String(s?.city || '').trim(),
        county: String(s?.county || '').trim(),
        email: String(s?.email || '').trim(),
        phone: String(s?.phone || '').trim(),
        ci_series: String(s?.ci_series || '').trim(),
        ci_number: String(s?.ci_number || '').trim(),
        obtinere_prelungire: ['obtinere', 'prelungire'].includes(s?.obtinere_prelungire) ? s.obtinere_prelungire : '',
      }))
      .filter((s: any) => s.full_name)
    if (!incoming.length) return NextResponse.json({ error: 'Niciun cursant valid (numele e obligatoriu).' }, { status: 400 })
    if (incoming.length > 200) return NextResponse.json({ error: 'Prea mulți cursanți într-o singură operație.' }, { status: 400 })

    const [{ data: sessRow }, { data: last }] = await Promise.all([
      sb.from('sessions').select('class_caa').eq('id', session_id).maybeSingle(),
      sb.from('students').select('order_in_session').eq('session_id', session_id)
        .order('order_in_session', { ascending: false }).limit(1).maybeSingle(),
    ])
    const sessionClass = (sessRow as any)?.class_caa || ''
    let order = (last as any)?.order_in_session || 0

    // Dacă persoana e deja în sistem (altă serie), preluăm datele și documentele
    // ei — altfel cursantul ar trebui să încarce din nou CI-ul, semnătura etc.
    const rows: any[] = []
    const reused: string[] = []
    const skipped: string[] = []
    for (const s of incoming) {
      const base: any = {
        session_id,
        full_name: s.full_name,
        cnp: s.cnp, birth_date: s.birth_date,
        address: s.address, city: s.city, county: s.county,
        email: s.email, phone: s.phone,
        ci_series: s.ci_series, ci_number: s.ci_number,
        obtinere_prelungire: s.obtinere_prelungire,
        class_caa: classFromLrc(s.obtinere_prelungire, sessionClass),
        order_in_session: ++order,
        only_sailing: false,
        portal_status: 'pending',
      }
      const found = await findPersonRows(sb, s)
      // deja în ACEASTĂ serie → nu dublăm rândul (import rulat de două ori)
      if (found.some((p: any) => p.session_id === session_id)) { skipped.push(s.full_name); continue }
      const prevRows = found
      if (prevRows.length) {
        // cea mai recentă fișă a persoanei
        const prev: any = prevRows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0]
        for (const f of CARRY_FIELDS) {
          // ce a scris utilizatorul acum are prioritate; restul vine din fișa veche
          if (!String(base[f] ?? '').trim() && String(prev[f] ?? '').trim()) base[f] = prev[f]
        }
        reused.push(s.full_name)
      }
      rows.push(base)
    }

    if (!rows.length) return NextResponse.json({ ok: true, added: 0, reused, skipped })
    const { data: inserted, error } = await sb.from('students').insert(rows).select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, added: inserted?.length || 0, reused, skipped })
  }
  if (!student_id || typeof imageData !== 'string' || !imageData.startsWith('data:image/'))
    return NextResponse.json({ error: 'imagine invalidă' }, { status: 400 })
  if (imageData.length > MAX_IMG)
    return NextResponse.json({ error: 'Imaginea e prea mare (max ~6MB).' }, { status: 400 })

  const col = side === 'verso' ? 'ci_verso_data' : 'ci_image_data'
  const { error } = await sb.from('students')
    .update({ [col]: imageData }).eq('id', student_id).eq('session_id', session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — scoate cursantul din ACEASTĂ serie.
// Fiecare rând din `students` e o înscriere per sesiune: dacă persoana mai e și în
// alte serii, acelea rămân neatinse; dacă asta era singura, dispare din sistem.
export async function DELETE(req: NextRequest) {
  const sb = svc()
  const { session_id, token, student_id, lead_id } = await req.json().catch(() => ({}))
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  if (lead_id) {
    const { error } = await sb.from('radio_leads').delete().eq('id', lead_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (!student_id) return NextResponse.json({ error: 'lipsește cursantul' }, { status: 400 })

  const { data: st } = await sb.from('students')
    .select('cnp, email, full_name').eq('id', student_id).eq('session_id', session_id).maybeSingle()
  if (!st) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const others = await findPersonRows(sb, st, student_id)
  const { error } = await sb.from('students').delete().eq('id', student_id).eq('session_id', session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, removed_from_series: true, still_in_other_series: others.length })
}
