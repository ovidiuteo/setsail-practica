import Link from 'next/link'
import { Award, Users } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import BadgesManager from './BadgesManager'

export const revalidate = 0

export default async function AdminBadgesPage() {
  const season = await getActiveSeason()

  const [badgesRes, participantsRes, teamsRes, partBadgesRes, teamBadgesRes] = await Promise.all([
    supabase.from('ssyt_badges').select('*').order('category').order('name'),
    supabase.from('ssyt_participants').select('id, full_name').in('status', ['active', 'accepted']).order('full_name'),
    supabase.from('ssyt_teams').select('id, name, short_name, color_primary').eq('status', 'active').order('display_order'),
    supabase
      .from('ssyt_participant_badges')
      .select(`
        id, badge_id, participant_id, awarded_at, notes,
        participant:ssyt_participants(id, full_name),
        regatta:ssyt_regattas(id, name)
      `)
      .order('awarded_at', { ascending: false }),
    supabase
      .from('ssyt_team_badges')
      .select(`
        id, badge_id, team_id, awarded_at, notes,
        team:ssyt_teams(id, name, color_primary)
      `)
      .order('awarded_at', { ascending: false }),
  ])

  // Regatte pentru context la awarding
  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name')
    .eq('season_id', season?.id || '00000000-0000-0000-0000-000000000000')
    .order('start_date')

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          {season && <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>{season.name}</p>}
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Award size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Badge-uri
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {badgesRes.data?.length || 0} badge-uri active. Atribuie-le participanților sau echipelor.
          </p>
        </div>
      </div>

      <BadgesManager
        badges={badgesRes.data || []}
        participants={participantsRes.data || []}
        teams={teamsRes.data || []}
        regattas={regattas || []}
        participantBadges={partBadgesRes.data || []}
        teamBadges={teamBadgesRes.data || []}
      />
    </div>
  )
}