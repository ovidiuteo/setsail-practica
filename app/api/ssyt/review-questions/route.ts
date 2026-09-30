import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Întoarce sezonul (id + texte) pentru token, sau null
async function seasonForToken(token: string | null | undefined, supabase: any) {
  if (!token) return null
  const { data } = await supabase
    .from('ssyt_seasons')
    .select('id, review_intro_text, review_skipper_text')
    .not('review_questions_token', 'is', null)
    .eq('review_questions_token', token)
    .maybeSingle()
  return data || null
}

// GET ?token= — listă întrebări + texte
export async function GET(req: NextRequest) {
  const supabase = client()
  const token = req.nextUrl.searchParams.get('token')
  const season = await seasonForToken(token, supabase)
  if (!season) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  const { data } = await supabase.from('ssyt_review_questions').select('*').order('position').order('created_at')
  return NextResponse.json({
    questions: data || [],
    texts: { intro: season.review_intro_text || '', skipper: season.review_skipper_text || '' },
  })
}

// PATCH { token, intro, skipper } — salvează textele de întâmpinare
export async function PATCH(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  const season = await seasonForToken(body.token, supabase)
  if (!season) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  const { error } = await supabase.from('ssyt_seasons').update({
    review_intro_text: (body.intro || '').toString().slice(0, 2000) || null,
    review_skipper_text: (body.skipper || '').toString().slice(0, 2000) || null,
  }).eq('id', season.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// POST { token, label, qtype, max_value } — adaugă
export async function POST(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  if (!(await seasonForToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })

  const { data: last } = await supabase.from('ssyt_review_questions').select('position').order('position', { ascending: false }).limit(1).maybeSingle()
  let position = (last?.position ?? 0)

  // Import în bloc: body.labels = string[]  (fiecare devine întrebare de tip text)
  if (Array.isArray(body.labels)) {
    const rows = body.labels
      .map((l: any) => (l || '').toString().trim())
      .filter(Boolean)
      .map((label: string) => ({ label: label.slice(0, 1000), qtype: 'text', max_value: 5, position: ++position }))
    if (rows.length === 0) return NextResponse.json({ error: 'Nicio întrebare validă.' }, { status: 400 })
    const { error } = await supabase.from('ssyt_review_questions').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, added: rows.length })
  }

  // Adăugare simplă
  const label = (body.label || '').toString().trim()
  if (!label) return NextResponse.json({ error: 'Lipsește textul întrebării.' }, { status: 400 })
  const qtype = body.qtype === 'number' ? 'number' : 'text'
  const max_value = Math.min(Math.max(parseInt(body.max_value, 10) || 5, 2), 10)
  const { error } = await supabase.from('ssyt_review_questions').insert({ label, qtype, max_value, position: position + 1 })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PUT { token, id, label?, qtype?, max_value?, active?, position? } — modifică
export async function PUT(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  if (!(await seasonForToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  if (!body.id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })
  const upd: any = {}
  if (body.label !== undefined) upd.label = (body.label || '').toString().trim()
  if (body.qtype !== undefined) upd.qtype = body.qtype === 'number' ? 'number' : 'text'
  if (body.max_value !== undefined) upd.max_value = Math.min(Math.max(parseInt(body.max_value, 10) || 5, 2), 10)
  if (body.active !== undefined) upd.active = !!body.active
  if (body.position !== undefined) upd.position = parseInt(body.position, 10) || 0
  const { error } = await supabase.from('ssyt_review_questions').update(upd).eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE { token, id } — șterge
export async function DELETE(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  if (!(await seasonForToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  if (!body.id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })
  const { error } = await supabase.from('ssyt_review_questions').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
