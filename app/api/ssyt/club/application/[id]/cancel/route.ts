import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Neautentificat.' }, { status: 401 })
  }

  const supabase = getPortalSupabase()

  const { data: app } = await supabase
    .from('ssyt_club_applications')
    .select('id, participant_id, status')
    .eq('id', params.id)
    .maybeSingle()

  if (!app) {
    return NextResponse.json({ ok: false, error: 'Aplicație inexistentă.' }, { status: 404 })
  }

  if (app.participant_id !== session.participantId) {
    return NextResponse.json({ ok: false, error: 'Aplicația nu îți aparține.' }, { status: 403 })
  }

  if (app.status === 'approved' || app.status === 'rejected') {
    return NextResponse.json(
      { ok: false, error: 'Aplicația a fost deja finalizată și nu mai poate fi anulată.' },
      { status: 409 }
    )
  }

  const { error } = await supabase
    .from('ssyt_club_applications')
    .update({ status: 'cancelled' })
    .eq('id', app.id)

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
