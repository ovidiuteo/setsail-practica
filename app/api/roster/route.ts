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
const EDITABLE = new Set(['full_name', 'cnp', 'birth_date', 'address', 'city', 'county', 'obtinere_prelungire'])
const MAX_IMG = 8 * 1024 * 1024 // ~8MB data URL

// Validează (session_id, token) și întoarce true dacă tokenul corespunde
async function authed(sb: ReturnType<typeof svc>, sessionId: string, token: string) {
  if (!sessionId || !token) return false
  const { data } = await sb.from('sessions').select('roster_token').eq('id', sessionId).maybeSingle()
  return !!data?.roster_token && data.roster_token === token
}

const VERIFIERS = ['corina', 'paula', 'ruxandra'] as const

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
  const { data: sess } = await sb.from('sessions').select('roster_token, roster_verified, roster_docs_visible').eq('id', sessionId).maybeSingle()
  if (!sessionId || !token || !sess?.roster_token || sess.roster_token !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const studentId = sp.get('student_id')
  const side = sp.get('side') // 'recto' | 'verso'
  if (studentId) {
    const col = side === 'verso' ? 'ci_verso_data' : 'ci_image_data'
    const { data } = await sb.from('students').select(`${col}`).eq('id', studentId).eq('session_id', sessionId).maybeSingle()
    return NextResponse.json({ image: (data as any)?.[col] || null })
  }

  const { data, error } = await sb.from('students')
    .select('id, full_name, cnp, birth_date, address, city, county, class_caa, obtinere_prelungire, ci_image_data, ci_verso_data')
    .eq('session_id', sessionId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = (data || []).map((r: any) => ({
    id: r.id, full_name: r.full_name, cnp: r.cnp, birth_date: r.birth_date,
    address: r.address, city: r.city, county: r.county,
    // Informația vine din clasă (sursa de adevăr); valoarea stocată e doar fallback dacă clasa nu o conține
    obtinere_prelungire: lrcFromClass(r.class_caa) || r.obtinere_prelungire || '',
    has_ci: !!r.ci_image_data, has_verso: !!r.ci_verso_data,
  }))
  rows.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'ro', { sensitivity: 'base' }))
  const verified: Record<string, boolean> = {}
  for (const v of VERIFIERS) verified[v] = !!(sess.roster_verified as any)?.[v]
  return NextResponse.json({ students: rows, verified, docs_visible: !!sess.roster_docs_visible })
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

// POST — upload imagine CI { session_id, token, student_id, side, imageData(dataURL) }
export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => ({}))
  const { session_id, token, student_id, side, imageData } = body || {}
  if (!(await authed(sb, session_id, token)))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
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
