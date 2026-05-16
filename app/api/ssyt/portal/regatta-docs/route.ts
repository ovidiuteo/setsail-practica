import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

async function getParticipant(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(data) ? data[0] : data
  return row?.valid ? row.participant_id : null
}

async function canEditAny(participantId: string, supabase: any): Promise<boolean> {
  const { data: skip } = await supabase.from('ssyt_teams').select('id').eq('skipper_id', participantId).limit(1)
  if (skip && skip.length > 0) return true
  const { data: ed } = await supabase
    .from('ssyt_team_memberships').select('id')
    .eq('participant_id', participantId).eq('status', 'active').eq('is_editor', true).limit(1)
  return !!(ed && ed.length > 0)
}

// POST = creare; PUT = update; DELETE = sterge
export async function POST(req: NextRequest) {
  const pid = await getParticipant(req)
  if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { regatta_id, name, description, url, document_type_id } = body
  if (!regatta_id || !name) return NextResponse.json({ error: 'Parametri lipsa' }, { status: 400 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await canEditAny(pid, supabase))) {
    return NextResponse.json({ error: 'Forbidden - doar skipper/editor poate adauga' }, { status: 403 })
  }

  const { data, error } = await supabase.from('ssyt_regatta_documents').insert({
    regatta_id, name, description: description || null, file_url: url || null,
    document_type_id: document_type_id || null,
    visibility: 'public', status: 'approved',
    uploaded_by: pid,
  }).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, doc: data })
}

export async function PUT(req: NextRequest) {
  const pid = await getParticipant(req)
  if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, name, description, url, document_type_id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID lipsa' }, { status: 400 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await canEditAny(pid, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: any = {}
  if (name !== undefined) updates.name = name
  if (description !== undefined) updates.description = description
  if (url !== undefined) updates.file_url = url
  if (document_type_id !== undefined) updates.document_type_id = document_type_id

  const { error } = await supabase.from('ssyt_regatta_documents').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Delete = doar admin (nu skipper/editor)
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID lipsa' }, { status: 400 })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Admin auth required' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase.from('ssyt_admin_users').select('level').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden - admin only' }, { status: 403 })

  const { error } = await supabase.from('ssyt_regatta_documents').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
