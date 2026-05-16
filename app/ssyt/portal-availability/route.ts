import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

async function getParticipantFromSession(req: NextRequest): Promise<{ participantId: string; seasonId: string } | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(data) ? data[0] : data
  if (!row || !row.valid) return null
  return { participantId: row.participant_id, seasonId: row.season_id }
}

export async function POST(req: NextRequest) {
  const session = await getParticipantFromSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { regatta_id, status } = await req.json()
  if (!regatta_id || !['confirmed', 'declined', 'tentative'].includes(status)) {
    return NextResponse.json({ error: 'Parametri invalizi' }, { status: 400 })
  }

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  // Iau team_id din membership activ
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id, membership_type')
    .eq('participant_id', session.participantId)
    .eq('status', 'active')
    .maybeSingle()

  // Verific daca exista participation
  const { data: existing } = await supabase
    .from('ssyt_regatta_participation')
    .select('id')
    .eq('regatta_id', regatta_id)
    .eq('participant_id', session.participantId)
    .maybeSingle()

  if (existing) {
    const updates: any = { confirmation_status: status }
    if (status === 'confirmed') {
      updates.confirmed_at = new Date().toISOString()
    } else {
      updates.on_crewlist = false
    }
    const { error } = await supabase.from('ssyt_regatta_participation').update(updates).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('ssyt_regatta_participation').insert({
      regatta_id,
      participant_id: session.participantId,
      team_id: mem?.team_id || null,
      confirmation_status: status,
      attendance_type: mem?.membership_type || 'core',
      on_crewlist: false,
      confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
