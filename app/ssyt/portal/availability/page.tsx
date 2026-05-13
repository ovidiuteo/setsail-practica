import { redirect } from 'next/navigation'
import { getCurrentUser, createSupabaseServerClient } from '@/lib/ssyt/supabase-server'
import AvailabilityEditor from './AvailabilityEditor'

export const dynamic = 'force-dynamic'

export default async function PortalAvailabilityPage() {
  const { user, participant } = await getCurrentUser()
  if (!user) redirect('/ssyt/login')
  if (!participant) redirect('/ssyt/portal')

  const supabase = createSupabaseServerClient()

  const { data: membership } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id, membership_type')
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  const { data: seasons } = await supabase.from('ssyt_seasons').select('id, name').eq('status', 'active').limit(1)
  const seasonId = seasons?.[0]?.id

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, slug, start_date, end_date, event_type')
    .eq('season_id', seasonId)
    .order('start_date')

  const regattaIds = (regattas || []).map((r) => r.id)
  const { data: participations } = regattaIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('id, regatta_id, confirmation_status, on_crewlist, team_id')
        .eq('participant_id', participant.id)
        .in('regatta_id', regattaIds)
    : { data: [] }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Disponibilități</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Marchează-ți prezența
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pentru fiecare regatta, marchează dacă ești disponibil, indisponibil sau încă neștiut.
        </p>
      </div>

      <AvailabilityEditor
        participantId={participant.id}
        teamId={membership?.team_id || null}
        membershipType={membership?.membership_type || 'core'}
        regattas={regattas || []}
        participations={participations || []}
      />
    </div>
  )
}
