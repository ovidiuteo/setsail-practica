import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import { getSportClubsAccess } from '@/lib/ssyt/club-access'

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, { params }: { params: { slug: string } }) {
  const session = await getPortalSession()
  if (!session) {
    return NextResponse.json({ ok: false, error: 'Neautentificat.' }, { status: 401 })
  }

  const access = await getSportClubsAccess(session.participantId, session.seasonId)
  if (!access.hasAccess) {
    return NextResponse.json({ ok: false, error: 'Modulul nu este disponibil.' }, { status: 403 })
  }

  const supabase = getPortalSupabase()

  const { data: club, error: clubErr } = await supabase
    .from('ssyt_sport_clubs')
    .select('id, is_active')
    .eq('slug', params.slug)
    .maybeSingle()

  if (clubErr || !club || !club.is_active) {
    return NextResponse.json({ ok: false, error: 'Club inexistent sau inactiv.' }, { status: 404 })
  }

  // Verifica daca exista deja aplicatie activa (la orice club)
  const { data: existing } = await supabase
    .from('ssyt_club_applications')
    .select('id, club_id')
    .eq('participant_id', session.participantId)
    .in('status', ['started', 'submitted', 'approved'])
    .maybeSingle()

  if (existing) {
    if (existing.club_id === club.id) {
      return NextResponse.json({ ok: true, id: existing.id, alreadyApplied: true })
    }
    return NextResponse.json(
      {
        ok: false,
        error:
          'Ai deja o aplicație activă la alt club. Anulează aplicația curentă înainte să aplici aici.',
      },
      { status: 409 }
    )
  }

  const { data: created, error: insertErr } = await supabase
    .from('ssyt_club_applications')
    .insert({
      participant_id: session.participantId,
      club_id: club.id,
      status: 'started',
    })
    .select('id')
    .single()

  if (insertErr || !created) {
    return NextResponse.json(
      { ok: false, error: insertErr?.message ?? 'Eroare la creare.' },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, id: created.id })
}
