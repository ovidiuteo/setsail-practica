import Link from 'next/link'
import { Users, Crown, Sailboat } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const dynamic = 'force-dynamic'
export const revalidate = 60

export async function generateMetadata() {
  return {
    title: 'Echipe · SSYT2026',
    description: '4 echipe, 4 ambarcațiuni, un sezon de regate Black Sea.',
  }
}

export default async function TeamsListPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select(`
      id, name, short_name, slug, color_primary, slogan, description, logo_url,
      boat:ssyt_boats(id, name, model),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, full_name, first_name, last_name, photo_url)
    `)
    .eq('season_id', season.id)
    .eq('status', 'active')
    .order('display_order')

  // Numar membri per echipa
  const teamIds = (teams || []).map((t) => t.id)
  const { data: allMemberships } = teamIds.length > 0
    ? await supabase
        .from('ssyt_team_memberships')
        .select('team_id, membership_type')
        .in('team_id', teamIds)
        .eq('status', 'active')
    : { data: [] }

  const memberCounts: Record<string, { core: number; occasional: number }> = {}
  for (const m of allMemberships || []) {
    if (!memberCounts[m.team_id]) memberCounts[m.team_id] = { core: 0, occasional: 0 }
    if (m.membership_type === 'core') memberCounts[m.team_id].core++
    else memberCounts[m.team_id].occasional++
  }

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      <div className="max-w-6xl mx-auto px-6 py-10">
        <header className="mb-8">
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-4xl font-black tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.03em' }}>
            <Users size={28} className="inline mr-3 align-middle" style={{ color: '#FF6B35' }} />
            Echipe
          </h1>
          <p className="text-sm text-gray-500 mt-2 max-w-2xl">
            Patru echipe, patru ambarcațiuni Beneteau First 34.7, un sezon de regate pe Marea Neagră.
            Click pe orice echipă pentru a vedea echipajul, barca și rezultatele.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(teams || []).map((team: any) => {
            const boat = Array.isArray(team.boat) ? team.boat[0] : team.boat
            const skipper = Array.isArray(team.skipper) ? team.skipper[0] : team.skipper
            const counts = memberCounts[team.id] || { core: 0, occasional: 0 }
            const totalMembers = counts.core + counts.occasional + (skipper ? 1 : 0)

            return (
              <Link
                key={team.id}
                href={`/ssyt/teams/${team.slug}`}
                className="group rounded-lg overflow-hidden hover:shadow-lg transition"
                style={{ background: '#fff', border: '1px solid #e5e7eb' }}
              >
                {/* Header colorat */}
                <div className="px-6 py-5 relative overflow-hidden" style={{ background: team.color_primary || '#4A5568' }}>
                  <div className="absolute inset-0 opacity-15" style={{
                    backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.4) 0%, transparent 60%)',
                  }}></div>
                  <div className="relative flex items-end gap-3">
                    {team.logo_url ? (
                      <img src={team.logo_url} alt={team.name} className="w-14 h-14 rounded-md object-cover" />
                    ) : (
                      <div className="w-14 h-14 rounded-md flex items-center justify-center text-white text-2xl font-black" style={{ background: 'rgba(255,255,255,0.18)' }}>
                        {team.short_name?.[0] || team.name[0]}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-3xl font-black tracking-tight text-white" style={{ letterSpacing: '-0.02em' }}>
                        {team.short_name || team.name}
                      </div>
                      {team.slogan && (
                        <p className="text-xs text-white/80 italic mt-0.5 truncate">"{team.slogan}"</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5 space-y-3">
                  {skipper && (
                    <div className="flex items-center gap-3">
                      {skipper.photo_url ? (
                        <img src={skipper.photo_url} alt={skipper.full_name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs" style={{ background: team.color_primary || '#4A5568', color: '#fff' }}>
                          {skipper.first_name?.[0]}{skipper.last_name?.[0]}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium flex items-center gap-1">
                          <Crown size={10} style={{ color: '#FF6B35' }} /> Skipper
                        </div>
                        <div className="font-semibold text-sm truncate" style={{ color: '#0a1628' }}>{skipper.full_name}</div>
                      </div>
                    </div>
                  )}

                  {boat && (
                    <div className="flex items-center gap-3 pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                      <div className="w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(0,168,181,0.12)' }}>
                        <Sailboat size={16} style={{ color: '#00A8B5' }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Ambarcațiune</div>
                        <div className="font-semibold text-sm truncate" style={{ color: '#0a1628' }}>{boat.name}</div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                    <div className="text-xs text-gray-500">
                      <Users size={11} className="inline mr-1" /> {totalMembers} membri
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span style={{ color: '#FF6B35' }}>{counts.core} core</span>
                      {counts.occasional > 0 && (
                        <>
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span style={{ color: '#00A8B5' }}>{counts.occasional} occ</span>
                        </>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-wider font-semibold transition group-hover:translate-x-1 inline-block" style={{ color: team.color_primary || '#FF6B35' }}>
                      vezi echipa →
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>

        {(!teams || teams.length === 0) && (
          <div className="rounded-lg p-16 text-center text-gray-400" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            <Users size={28} className="mx-auto mb-3 opacity-30" />
            Nicio echipă în acest sezon.
          </div>
        )}
      </div>
    </div>
  )
}
