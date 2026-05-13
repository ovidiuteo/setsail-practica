import { CheckSquare } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import AvailabilityTabs from './AvailabilityTabs'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function AdminAvailabilityPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  // Iau IDs-urile regatelor sezonului ca sa filtrez participation
  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, short_name, start_date, end_date, event_type, status')
    .eq('season_id', season.id)
    .order('start_date')

  const regattaIds = (regattas || []).map((r) => r.id)

  const [teamsRes, membershipsRes, participationRes] = await Promise.all([
    supabase
      .from('ssyt_teams')
      .select(`
        id, name, short_name, color_primary, display_order, skipper_id,
        boat:ssyt_boats(id, name, capacity)
      `)
      .eq('season_id', season.id)
      .eq('status', 'active')
      .order('display_order'),
    supabase
      .from('ssyt_team_memberships')
      .select(`
        id, team_id, participant_id, membership_type,
        participant:ssyt_participants(id, full_name, first_name, last_name)
      `)
      .eq('status', 'active')
      .limit(2000),
    // Query simplificat: doar coloanele de baza, fara relatie pe participant
    supabase
      .from('ssyt_regatta_participation')
      .select('id, regatta_id, participant_id, team_id, confirmation_status, attendance_type, on_crewlist')
      .in('regatta_id', regattaIds.length > 0 ? regattaIds : ['00000000-0000-0000-0000-000000000000'])
      .limit(2000),
  ])

  // Iau separat datele participantilor pe care le-am referit
  const participantIds = Array.from(new Set((participationRes.data || []).map((p) => p.participant_id)))
  const { data: extraParticipants } = participantIds.length > 0
    ? await supabase
        .from('ssyt_participants')
        .select('id, full_name, first_name, last_name')
        .in('id', participantIds)
    : { data: [] }

  // Atasez participantii la fiecare participation
  const partMap: Record<string, any> = {}
  for (const p of extraParticipants || []) partMap[p.id] = p

  const enrichedParticipation = (participationRes.data || []).map((p) => ({
    ...p,
    participant: partMap[p.participant_id] || null,
  }))

  return (
    <div className="px-8 py-8 max-w-[1600px]">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <CheckSquare size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Disponibilități
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Două vizualizări: pe <strong>membri</strong> (matricea confirmărilor) sau pe <strong>bărci</strong> (capacitate per regatta).
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Debug: {regattas?.length || 0} regate · {teamsRes.data?.length || 0} echipe · {membershipsRes.data?.length || 0} memberships · {enrichedParticipation.length} confirmări
        </p>
      </div>

      <AvailabilityTabs
        regattas={regattas || []}
        teams={teamsRes.data || []}
        memberships={membershipsRes.data || []}
        participation={enrichedParticipation}
      />
    </div>
  )
}