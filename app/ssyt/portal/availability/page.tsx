import { redirect } from 'next/navigation'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import AvailabilityEditor from './AvailabilityEditor'

export const dynamic = 'force-dynamic'

export default async function PortalAvailabilityPage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login')

  const { participant, seasonId } = session
  const supabase = getPortalSupabase()

  // Membership propriu
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id, membership_type')
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  // Echipa + colegi cu nume
  let teamName: string | null = null
  let teamColor = '#00A8B5'
  let teamMembers: { id: string; full_name: string; first_name: string }[] = []
  if (mem?.team_id) {
    const { data: t } = await supabase.from('ssyt_teams').select('name, color_primary').eq('id', mem.team_id).maybeSingle()
    teamName = t?.name || null
    teamColor = t?.color_primary || '#00A8B5'

    // Membership-uri + JOIN cu participants pentru nume
    const { data: teammates } = await supabase
      .from('ssyt_team_memberships')
      .select('participant_id, participants:ssyt_participants(id, full_name, first_name)')
      .eq('team_id', mem.team_id)
      .eq('status', 'active')

    teamMembers = (teammates || [])
      .map((m: any) => m.participants)
      .filter(Boolean)
      .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'ro'))
  }

  const teamMemberIds = teamMembers.map((m) => m.id)

  // Regate sezon
  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, slug, start_date, end_date, event_type')
    .eq('season_id', seasonId)
    .order('start_date')

  const regIds = (regattas || []).map((r) => r.id)

  // Participations proprii
  const { data: myParticipations } = regIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('id, regatta_id, confirmation_status, on_crewlist, team_id')
        .eq('participant_id', participant.id)
        .in('regatta_id', regIds)
    : { data: [] }

  // Participations colegilor
  const { data: teamParticipations } = regIds.length > 0 && teamMemberIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('regatta_id, participant_id, confirmation_status')
        .in('regatta_id', regIds)
        .in('participant_id', teamMemberIds)
    : { data: [] }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Disponibilități</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Marchează-ți prezența
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pentru fiecare regatta, marchează dacă ești disponibil, indisponibil sau încă nu știi.
          {teamName && <> Echipa <strong>{teamName}</strong>.</>}
        </p>
      </div>

      <AvailabilityEditor
        participantId={participant.id}
        teamId={mem?.team_id || null}
        teamColor={teamColor}
        membershipType={mem?.membership_type || 'core'}
        regattas={regattas || []}
        initialParticipations={myParticipations || []}
        teamMembers={teamMembers}
        teamParticipations={teamParticipations || []}
      />
    </div>
  )
}
