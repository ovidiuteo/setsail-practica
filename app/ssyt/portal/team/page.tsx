import Link from 'next/link'
import { Crown, Sailboat } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getCurrentUser, createSupabaseServerClient } from '@/lib/ssyt/supabase-server'

export const dynamic = 'force-dynamic'

export default async function PortalTeamPage() {
  const { user, participant } = await getCurrentUser()
  if (!user) redirect('/ssyt/login')
  if (!participant) redirect('/ssyt/portal')

  const supabase = createSupabaseServerClient()

  const { data: myMembership } = await supabase
    .from('ssyt_team_memberships')
    .select(`team_id`)
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  if (!myMembership) {
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
    .select(`
      id, name, short_name, color_primary, slogan, skipper_id,
      boat:ssyt_boats(id, name, model, sail_number),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, full_name, first_name, last_name, photo_url)
    `)
    .eq('id', myMembership.team_id)
    .maybeSingle()

  if (!team) return null

  const boat = Array.isArray(team.boat) ? team.boat[0] : team.boat
  const skipper = Array.isArray(team.skipper) ? team.skipper[0] : team.skipper

  const { data: teammates } = await supabase
    .from('ssyt_team_memberships')
    .select(`
      id, membership_type,
      participant:ssyt_participants(id, full_name, first_name, last_name, photo_url)
    `)
    .eq('team_id', team.id)
    .eq('status', 'active')

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="rounded-lg overflow-hidden mb-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="px-6 py-5 text-white" style={{ background: team.color_primary || '#4A5568' }}>
          <h1 className="text-3xl font-bold tracking-tight">{team.name}</h1>
          {team.slogan && <p className="text-sm text-white/80 mt-1 italic">"{team.slogan}"</p>}
        </div>
        <div className="px-6 py-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          {boat && (
            <Link href={`/ssyt/admin/boats/${boat.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
              <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: 'rgba(255,107,53,0.12)' }}>
                <Sailboat size={18} style={{ color: '#FF6B35' }} />
              </div>
              <div>
                <div className="text-xs uppercase text-gray-500">Ambarcațiune</div>
                <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>{boat.name}</div>
                <div className="text-xs text-gray-500">{boat.model}</div>
              </div>
            </Link>
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
          Echipaj ({teammates?.length || 0})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {teammates?.map((m) => {
            const p = Array.isArray(m.participant) ? m.participant[0] : m.participant
            if (!p) return null
            const isMe = p.id === participant.id
            const isSkipperRow = p.id === team.skipper_id
            return (
              <div
                key={m.id}
                className="rounded-lg p-3 flex items-center gap-3"
                style={{
                  background: '#fff',
                  border: isMe ? '2px solid #FF6B35' : '1px solid #e5e7eb',
                }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                  style={{ background: isSkipperRow ? '#FF6B35' : (team.color_primary || '#4A5568'), color: '#fff' }}
                >
                  {p.first_name?.[0]}{p.last_name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate" style={{ color: '#0a1628' }}>
                    {p.full_name}
                    {isMe && <span className="ml-1 text-[10px] uppercase tracking-wider" style={{ color: '#FF6B35' }}>(tu)</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {isSkipperRow ? 'Skipper' : m.membership_type === 'occasional' ? 'Occasional' : 'Crew'}
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
