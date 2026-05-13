import Link from 'next/link'
import { Shuffle, AlertCircle } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import RosterBoard from './RosterBoard'

export const revalidate = 0

export default async function AdminRosterPage() {
  const season = await getActiveSeason()
  if (!season) {
    return (
      <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
    )
  }

  // Toate echipele + toți participanții activi/accepted
  const [teamsRes, participantsRes, membershipsRes] = await Promise.all([
    supabase
      .from('ssyt_teams')
      .select('id, name, short_name, color_primary, slug, skipper_id, boat:ssyt_boats(name)')
      .eq('season_id', season.id)
      .eq('status', 'active')
      .order('display_order'),
    supabase
      .from('ssyt_participants')
      .select('id, full_name, first_name, last_name, photo_url, status, email')
      .in('status', ['active', 'accepted'])
      .order('full_name'),
    supabase
      .from('ssyt_team_memberships')
      .select('id, team_id, participant_id, membership_type, status')
      .eq('status', 'active'),
  ])

  return (
    <div className="px-8 py-8 max-w-[1400px]">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Shuffle size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Roster
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Drag &amp; drop participanții între echipe. Click pe tipul "core" / "occasional" pentru a-l schimba.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 rounded-lg px-3 py-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
          <AlertCircle size={14} />
          <span>Trage cu mouse-ul un participant și aruncă-l în coloana echipei dorite.</span>
        </div>
      </div>

      <RosterBoard
        teams={teamsRes.data || []}
        participants={participantsRes.data || []}
        memberships={membershipsRes.data || []}
      />
    </div>
  )
}