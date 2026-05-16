import { redirect } from 'next/navigation'
import { Crown, Sailboat } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

export default async function PortalTeamPage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login')

  const { participant } = session
  const supabase = getPortalSupabase()

  const { data: myMem } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id')
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myMem) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-lg p-8 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          Nu ești alocat la o echipă încă. Contactează organizatorul.
        </div>
      </div>
    )
  }

  // Detalii echipa + skipper + barca + membri
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, color_primary, slogan, skipper_id, boat_id')
    .eq('id', myMem.team_id)
    .maybeSingle()

  if (!team) return null

  let boat: any = null
  if (team.boat_id) {
    const { data } = await supabase.from('ssyt_boats').select('id, name, model, sail_number').eq('id', team.boat_id).maybeSingle()
    boat = data
  }

  let skipper: any = null
  if (team.skipper_id) {
    const { data } = await supabase.from('ssyt_participants').select('id, full_name, first_name, last_name, photo_url').eq('id', team.skipper_id).maybeSingle()
    skipper = data
  }

  const { data: memberships } = await supabase
    .from('ssyt_team_memberships')
    .select('id, membership_type, participant_id')
    .eq('team_id', team.id)
    .eq('status', 'active')

  const memberIds = (memberships || []).map((m) => m.participant_id)
  const { data: participants } = memberIds.length > 0
    ? await supabase.from('ssyt_participants').select('id, full_name, first_name, last_name, photo_url').in('id', memberIds)
    : { data: [] }

  const teammates = (memberships || []).map((m: any) => {
    const p = (participants || []).find((x) => x.id === m.participant_id)
    return p ? { ...p, membership_type: m.membership_type, membership_id: m.id } : null
  }).filter(Boolean) as any[]

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="rounded-lg overflow-hidden mb-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="px-6 py-5 text-white" style={{ background: team.color_primary || '#4A5568' }}>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          {team.slogan && <p className="text-sm text-white/80 mt-1 italic">"{team.slogan}"</p>}
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {boat && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,107,53,0.12)' }}>
                <Sailboat size={18} style={{ color: '#FF6B35' }} />
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Ambarcațiune</div>
                <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>{boat.name}</div>
                <div className="text-xs text-gray-500">{boat.model}</div>
              </div>
            </div>
          )}
          {skipper && (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold" style={{ background: '#FF6B35' }}>
                <Crown size={18} />
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Skipper</div>
                <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>{skipper.full_name}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Echipaj ({teammates.length})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teammates.map((p) => {
            const isMe = p.id === participant.id
            const isSkipperRow = p.id === team.skipper_id
            return (
              <div key={p.membership_id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#fff', border: isMe ? '2px solid #FF6B35' : '1px solid #e5e7eb' }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0" style={{ background: isSkipperRow ? '#FF6B35' : (team.color_primary || '#4A5568'), color: '#fff' }}>
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: '#0a1628' }}>
                    {p.full_name}
                    {isMe && <span className="ml-1 text-[10px] uppercase tracking-wider" style={{ color: '#FF6B35' }}>(tu)</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSkipperRow ? 'Skipper' : p.membership_type === 'occasional' ? 'Occasional' : 'Crew'}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
