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

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, short_name, start_date, end_date, event_type, status')
    .eq('season_id', season.id)
    .order('start_date')

  const regattaIds = (regattas || []).map((r) => r.id)

  // Lazy sync: arhivez toate regatele cu end_date trecut (idempotent, fail-safe)
  try {
    await supabase.rpc('ssyt_archive_all_past_regattas')
  } catch {
    // ignor — UI rămâne funcțional chiar dacă sync eșuează
  }

  const [teamsRes, membershipsRes, participationRes, unallocatedParticipantsRes, archivedRowsRes] = await Promise.all([
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
        id, team_id, participant_id, membership_type, status, punctual_anchor_regatta_id,
        participant:ssyt_participants(id, full_name, first_name, last_name)
      `)
      .in('status', ['active', 'left'])
      .limit(2000),
    supabase
      .from('ssyt_regatta_participation')
      .select('id, regatta_id, participant_id, team_id, confirmation_status, attendance_type, on_crewlist')
      .in('regatta_id', regattaIds.length > 0 ? regattaIds : ['00000000-0000-0000-0000-000000000000'])
      .limit(2000),
    // Participanti activi care NU au membership intr-o echipa
    supabase
      .from('ssyt_participants')
      .select('id, full_name, first_name, last_name')
      .in('status', ['active', 'accepted'])
      .limit(500),
    // Arhivă participări pentru regate cu archived_at != NULL
    supabase
      .from('ssyt_regatta_participation')
      .select(
        'id, regatta_id, participant_id, team_id, confirmation_status, attendance_type, ' +
        'archived_participant_full_name, archived_participant_email, ' +
        'archived_team_name, archived_team_short_name, archived_team_color, archived_at'
      )
      .in('regatta_id', regattaIds.length > 0 ? regattaIds : ['00000000-0000-0000-0000-000000000000'])
      .not('archived_at', 'is', null)
      .limit(2000),
  ])

  // Iau separat datele participantilor referite in participation
  const participantIds = Array.from(new Set((participationRes.data || []).map((p) => p.participant_id)))
  const { data: extraParticipants } = participantIds.length > 0
    ? await supabase
        .from('ssyt_participants')
        .select('id, full_name, first_name, last_name')
        .in('id', participantIds)
    : { data: [] }

  // Atasez participantii la participation
  const participantMap: Record<string, any> = {}
  for (const p of extraParticipants || []) participantMap[p.id] = p

  const enrichedParticipation = (participationRes.data || []).map((p) => ({
    ...p,
    participant: participantMap[p.participant_id] || null,
  }))

  // Membership-uri: active (randuri cu nume) vs ascunse 'left' (placeholder anonim)
  const allMemberships = membershipsRes.data || []
  const activeMemberships = allMemberships.filter((m: any) => m.status === 'active')
  const hiddenMemberships = allMemberships.filter((m: any) => m.status === 'left')

  // Filtru nealocati: participanti care nu sunt in nicio echipa activa
  const allocatedIds = new Set(activeMemberships.map((m) => m.participant_id))
  const unallocatedParticipants = (unallocatedParticipantsRes.data || [])
    .filter((p) => !allocatedIds.has(p.id))

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
      </div>

      <AvailabilityTabs
        regattas={regattas || []}
        teams={teamsRes.data || []}
        memberships={activeMemberships}
        hiddenMemberships={hiddenMemberships}
        participation={enrichedParticipation}
        unallocatedParticipants={unallocatedParticipants}
        archivedRows={archivedRowsRes.data || []}
      />
    </div>
  )
}