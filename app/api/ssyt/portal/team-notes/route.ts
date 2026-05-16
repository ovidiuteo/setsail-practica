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

// PUT - upsert pe team_id (1 nota per echipa)
export async function PUT(req: NextRequest) {
  const pid = await getParticipant(req)
  if (!pid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { team_id, content } = await req.json()
  if (!team_id) return NextResponse.json({ error: 'team_id lipsa' }, { status: 400 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await canEditTeam(pid, team_id, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Upsert - daca nu exista, insert
  const { data: existing } = await supabase.from('ssyt_team_notes').select('id').eq('team_id', team_id).maybeSingle()

  if (existing) {
    const { error } = await supabase.from('ssyt_team_notes').update({
      content: content || '',
      updated_by_participant: pid,
      updated_at: new Date().toISOString(),
    }).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('ssyt_team_notes').insert({
      team_id, content: content || '', updated_by_participant: pid,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
