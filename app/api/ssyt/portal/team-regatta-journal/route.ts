import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function getParticipant(req: NextRequest, supabase: any): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const { data } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(data) ? data[0] : data
  return row?.valid ? row.participant_id : null
}

async function canEditTeam(pid: string, teamId: string, supabase: any): Promise<boolean> {
  const { data: team } = await supabase.from('ssyt_teams').select('skipper_id').eq('id', teamId).maybeSingle()
  if (team?.skipper_id === pid) return true
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('is_editor')
    .eq('participant_id', pid)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .maybeSingle()
  return !!mem?.is_editor
}

// PUT - upsert pe (team_id, regatta_id): o intrare markdown per echipă/regatta
export async function PUT(req: NextRequest) {
  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const { team_id, regatta_id, content } = await req.json().catch(() => ({}))
  if (!team_id || !regatta_id) return NextResponse.json({ error: 'team_id / regatta_id lipsă.' }, { status: 400 })

  if (!(await canEditTeam(pid, team_id, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: existing } = await supabase
    .from('ssyt_team_regatta_journal')
    .select('id')
    .eq('team_id', team_id)
    .eq('regatta_id', regatta_id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('ssyt_team_regatta_journal')
      .update({
        content: content || '',
        updated_by_participant: pid,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('ssyt_team_regatta_journal').insert({
      team_id,
      regatta_id,
      content: content || '',
      updated_by_participant: pid,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
