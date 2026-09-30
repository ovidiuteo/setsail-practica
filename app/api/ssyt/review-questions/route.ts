import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function validToken(token: string | null, supabase: any): Promise<boolean> {
  if (!token) return false
  const { data } = await supabase
    .from('ssyt_seasons')
    .select('review_questions_token')
    .not('review_questions_token', 'is', null)
    .eq('review_questions_token', token)
    .maybeSingle()
  return !!data
}

// GET ?token= — listă întrebări
export async function GET(req: NextRequest) {
  const supabase = client()
  const token = req.nextUrl.searchParams.get('token')
  if (!(await validToken(token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  const { data } = await supabase.from('ssyt_review_questions').select('*').order('position').order('created_at')
  return NextResponse.json({ questions: data || [] })
}

// POST { token, label, qtype, max_value } — adaugă
export async function POST(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  if (!(await validToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  const label = (body.label || '').toString().trim()
  if (!label) return NextResponse.json({ error: 'Lipsește textul întrebării.' }, { status: 400 })
  const qtype = body.qtype === 'number' ? 'number' : 'text'
  const max_value = Math.min(Math.max(parseInt(body.max_value, 10) || 5, 2), 10)
  const { data: last } = await supabase.from('ssyt_review_questions').select('position').order('position', { ascending: false }).limit(1).maybeSingle()
  const position = (last?.position ?? 0) + 1
  const { error } = await supabase.from('ssyt_review_questions').insert({ label, qtype, max_value, position })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// PUT { token, id, label?, qtype?, max_value?, active?, position? } — modifică
export async function PUT(req: NextRequest) {
  const supabase = client()
  const body = await req.json().catch(() => ({}))
  if (!(await validToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
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
  if (!(await validToken(body.token, supabase))) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })
  if (!body.id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })
  const { error } = await supabase.from('ssyt_review_questions').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
