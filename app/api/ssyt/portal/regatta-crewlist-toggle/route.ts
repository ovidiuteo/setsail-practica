import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: sessionRpc } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(sessionRpc) ? sessionRpc[0] : sessionRpc
  if (!row?.valid) return NextResponse.json({ error: 'Sesiune invalidă.' }, { status: 401 })
  const meId = row.participant_id as string

  const body = await req.json().catch(() => ({}))
  const regatta_id: string | undefined = body.regatta_id
  const participant_id: string | undefined = body.participant_id
  if (!regatta_id || !participant_id) {
    return NextResponse.json({ error: 'Parametri lipsă.' }, { status: 400 })
  }

  // Verific regata not frozen
  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('id, end_date, status')
    .eq('id', regatta_id)
    .maybeSingle()
  if (!regatta) return NextResponse.json({ error: 'Regată inexistentă.' }, { status: 404 })
  if (regatta.status === 'completed' || regatta.status === 'cancelled') {
    return NextResponse.json({ error: 'Regată finalizată.' }, { status: 409 })
  }
  if (regatta.end_date) {
    const end = new Date(regatta.end_date)
    const today = new Date(); today.setHours(0, 0, 0, 0)
    if (end < today) {
      return NextResponse.json({ error: 'Regată finalizată.' }, { status: 409 })
    }
  }

  // Participation existing
  const { data: part } = await supabase
    .from('ssyt_regatta_participation')
    .select('id, team_id, on_crewlist, confirmation_status')
    .eq('regatta_id', regatta_id)
    .eq('participant_id', participant_id)
    .maybeSingle()

  if (!part) {
    return NextResponse.json(
      { error: 'Participantul nu are status pentru această regată.' },
      { status: 404 }
    )
  }
  if (part.confirmation_status !== 'confirmed') {
    return NextResponse.json(
      { error: 'Doar membri marcați ca "Disponibil" pot intra pe crewlist.' },
      { status: 409 }
    )
  }
  if (!part.team_id) {
    return NextResponse.json(
      { error: 'Participantul nu e alocat unei echipe.' },
      { status: 409 }
    )
  }

  // Permisiune: skipper sau editor al echipei
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select('skipper_id')
    .eq('id', part.team_id)
    .maybeSingle()
  const isSkipper = team?.skipper_id === meId

  let isEditor = false
  if (!isSkipper) {
    const { data: editorMem } = await supabase
      .from('ssyt_team_memberships')
      .select('id')
      .eq('participant_id', meId)
      .eq('team_id', part.team_id)
      .eq('is_editor', true)
      .eq('status', 'active')
      .maybeSingle()
    isEditor = !!editorMem
  }

  if (!isSkipper && !isEditor) {
    return NextResponse.json(
      { error: 'Doar skipper-ul sau editorii echipei pot modifica crewlist-ul.' },
      { status: 403 }
    )
  }

  const next = !part.on_crewlist
  const { error } = await supabase
    .from('ssyt_regatta_participation')
    .update({ on_crewlist: next })
    .eq('id', part.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, on_crewlist: next })
}
