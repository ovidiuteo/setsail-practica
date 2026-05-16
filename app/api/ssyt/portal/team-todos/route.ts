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

async function canEditTeam(pid: string, teamId: string, supabase: any): Promise<boolean> {
  const { data: team } = await supabase.from('ssyt_teams').select('skipper_id').eq('id', teamId).maybeSingle()
  if (team?.skipper_id === pid) return true
  const { data: mem } = await supabase.from('ssyt_team_memberships').select('is_editor')
    .eq('participant_id', pid).eq('team_id', teamId).eq('status', 'active').maybeSingle()
  return !!mem?.is_editor
}

// POST - create
export async function POST(req: NextRequest) {
  const pid = await getParticipant(req)
  if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { team_id, scope, title, description, assignee_type, assignee_participant } = await req.json()
  if (!team_id || !scope || !title) return NextResponse.json({ error: 'Parametri lipsa' }, { status: 400 })
  if (!['team', 'boat'].includes(scope)) return NextResponse.json({ error: 'Scope invalid' }, { status: 400 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await canEditTeam(pid, team_id, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase.from('ssyt_team_todos').insert({
    team_id, scope, title, description: description || null,
    assignee_type: assignee_type || 'all',
    assignee_participant: assignee_type === 'individual' ? assignee_participant : null,
    created_by_participant: pid,
  }).select().maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, todo: data })
}

// PUT - update / toggle done
export async function PUT(req: NextRequest) {
  const pid = await getParticipant(req)
  if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, action, title, description, assignee_type, assignee_participant } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID lipsa' }, { status: 400 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: todo } = await supabase.from('ssyt_team_todos').select('team_id, is_done').eq('id', id).maybeSingle()
  if (!todo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!(await canEditTeam(pid, todo.team_id, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const updates: any = { updated_at: new Date().toISOString() }

  if (action === 'toggle_done') {
    updates.is_done = !todo.is_done
    updates.done_at = !todo.is_done ? new Date().toISOString() : null
    updates.done_by_participant = !todo.is_done ? pid : null
  } else {
    if (title !== undefined) updates.title = title
    if (description !== undefined) updates.description = description
    if (assignee_type !== undefined) updates.assignee_type = assignee_type
    if (assignee_participant !== undefined) {
      updates.assignee_participant = assignee_type === 'individual' ? assignee_participant : null
    }
  }

  const { error } = await supabase.from('ssyt_team_todos').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// Delete = doar admin
export async function DELETE(req: NextRequest) {
  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'ID lipsa' }, { status: 400 })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Admin required' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: adminRow } = await supabase.from('ssyt_admin_users').select('level').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('ssyt_team_todos').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
