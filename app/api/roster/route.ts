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
    .select('roster_token, roster_verified, roster_docs_visible, class_caa, session_date, course_start_date')
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

  if (studentId) {
    const col = side === 'verso' ? 'ci_verso_data' : 'ci_image_data'
    const { data } = await sb.from('students').select(`${col}`).eq('id', studentId).eq('session_id', sessionId).maybeSingle()
    return NextResponse.json({ image: (data as any)?.[col] || null })
  }

  const { data, error } = await sb.from('students')
    .select('id, full_name, email, cnp, birth_date, address, city, county, class_caa, obtinere_prelungire, ci_image_data, ci_verso_data')
    .eq('session_id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []).map((r: any) => ({
    id: r.id, full_name: r.full_name, email: r.email, cnp: r.cnp, birth_date: r.birth_date,
    address: r.address, city: r.city, county: r.county,
    // Informația vine din clasă (sursa de adevăr); valoarea stocată e doar fallback dacă clasa nu o conține
    obtinere_prelungire: lrcFromClass(r.class_caa) || r.obtinere_prelungire || '',
    has_ci: !!r.ci_image_data, has_verso: !!r.ci_verso_data,
  }))
  rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ro', { sensitivity: 'base' }))
  const verified: Record<string, boolean> = {}
  for (const v of VERIFIERS) verified[v] = !!(sess.roster_verified as any)?.[v]
  return NextResponse.json({
    students: rows, verified, docs_visible: !!sess.roster_docs_visible,
    // pentru titlul paginii/tab-ului (ex. „Curs Radio 5-7 oct")
    session: { class_caa: sess.class_caa, session_date: sess.session_date, course_start_date: sess.course_start_date },
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
  const { session_id, token, student_id } = await req.json().catch(() => ({}))
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  if (!student_id) return NextResponse.json({ error: 'lipsește cursantul' }, { status: 400 })

  const { data: st } = await sb.from('students')
    .select('cnp, email, full_name').eq('id', student_id).eq('session_id', session_id).maybeSingle()
  if (!st) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const others = await findPersonRows(sb, st, student_id)
  const { error } = await sb.from('students').delete().eq('id', student_id).eq('session_id', session_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, removed_from_series: true, still_in_other_series: others.length })
}
