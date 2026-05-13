import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft, Crown, Sailboat, Trophy, Calendar, Users, MapPin } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { slug: string } }) {
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select('name, slogan, short_name')
    .eq('slug', params.slug)
    .maybeSingle()
  if (!team) return { title: 'Echipă necunoscută' }
  return {
    title: `${team.name} · SSYT2026`,
    description: team.slogan || `Echipa ${team.short_name} în SSYT2026.`,
  }
}

export default async function TeamPublicPage({ params }: { params: { slug: string } }) {
  // Iau echipa de baza
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, slug, color_primary, color_secondary, slogan, description, logo_url, flag_url, boat_id, skipper_id, season_id')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!team) notFound()

  // Iau separat boat, skipper, season (mai sigur decat join-uri)
  const [boatRes, skipperRes, seasonRes] = await Promise.all([
    team.boat_id ? supabase.from('ssyt_boats').select('id, name, model, sail_number, photo_url, capacity').eq('id', team.boat_id).maybeSingle() : Promise.resolve({ data: null }),
    team.skipper_id ? supabase.from('ssyt_participants').select('id, full_name, first_name, last_name, photo_url, nickname, sailing_experience').eq('id', team.skipper_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from('ssyt_seasons').select('id, name, year, status').eq('id', team.season_id).maybeSingle(),
  ])
  const boat = boatRes.data
  const skipper = skipperRes.data
  const season = seasonRes.data

  // Membri (fara skipper)
  const { data: memberships } = await supabase
    .from('ssyt_team_memberships')
    .select('id, membership_type, status, participant_id')
    .eq('team_id', team.id)
    .eq('status', 'active')

  const memberIds = (memberships || []).map((m) => m.participant_id)
  const { data: memberParticipants } = memberIds.length > 0
    ? await supabase
        .from('ssyt_participants')
        .select('id, full_name, first_name, last_name, photo_url, nickname')
        .in('id', memberIds)
    : { data: [] }

  const allMembers = (memberships || []).map((m) => {
    const p = (memberParticipants || []).find((x) => x.id === m.participant_id)
    if (!p) return null
    return {
      id: p.id,
      full_name: p.full_name,
      first_name: p.first_name,
      last_name: p.last_name,
      photo_url: p.photo_url,
      nickname: p.nickname,
      membership_type: m.membership_type,
      isSkipper: p.id === team.skipper_id,
    }
  }).filter(Boolean) as any[]

  const core = allMembers.filter((m) => m.membership_type === 'core' && !m.isSkipper).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ro'))
  const occasional = allMembers.filter((m) => m.membership_type === 'occasional').sort((a, b) => a.full_name.localeCompare(b.full_name, 'ro'))

  // Regate sezon
  const { data: regattas } = season?.id ? await supabase
    .from('ssyt_regattas')
    .select('id, name, short_name, slug, start_date, end_date, event_type, status, location')
    .eq('season_id', season.id)
    .order('start_date') : { data: [] }

  // Disponibilitati echipa pentru regate
  const regattaIds = (regattas || []).map((r) => r.id)
  const { data: participations } = regattaIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('regatta_id, confirmation_status, on_crewlist')
        .in('regatta_id', regattaIds)
        .eq('team_id', team.id)
    : { data: [] }

  const partByRegatta: Record<string, { confirmed: number; total: number; onCrewlist: number }> = {}
  for (const r of regattas || []) {
    const parts = (participations || []).filter((p) => p.regatta_id === r.id)
    partByRegatta[r.id] = {
      confirmed: parts.filter((p) => p.confirmation_status === 'confirmed').length,
      total: parts.length,
      onCrewlist: parts.filter((p) => p.on_crewlist).length,
    }
  }

  // Rezultate echipa - simplu, fara join in order
  const { data: results } = await supabase
    .from('ssyt_results')
    .select('id, regatta_id, official_place, official_class, official_total_boats, official_points, ssyt_internal_points, ssyt_internal_place, recap')
    .eq('team_id', team.id)

  // Badge-uri castigate - simplu
  const { data: teamBadgesRaw } = await supabase
    .from('ssyt_team_badges')
    .select('id, awarded_at, notes, badge_id, regatta_id')
    .eq('team_id', team.id)

  const badgeIds = (teamBadgesRaw || []).map((tb) => tb.badge_id).filter(Boolean)
  const { data: badgesData } = badgeIds.length > 0
    ? await supabase.from('ssyt_badges').select('id, name, icon_url, color, description').in('id', badgeIds)
    : { data: [] }

  const teamBadges = (teamBadgesRaw || []).map((tb) => ({
    ...tb,
    badge: (badgesData || []).find((b) => b.id === tb.badge_id) || null,
  }))

  const colorPrimary = team.color_primary || '#4A5568'
  const today = new Date().toISOString().split('T')[0]
  const upcomingRegattas = (regattas || []).filter((r) => r.start_date >= today)
  const pastRegattas = (regattas || []).filter((r) => r.start_date < today).reverse()  // cele mai recente sus

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Hero */}
      <section className="relative overflow-hidden" style={{ background: colorPrimary }}>
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.3) 0%, transparent 40%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.2) 0%, transparent 50%)',
        }}></div>
        <div className="max-w-6xl mx-auto px-6 py-8 relative">
          <Link href="/ssyt/teams" className="inline-flex items-center gap-1 text-sm text-white/70 hover:text-white mb-4 transition">
            <ChevronLeft size={16} /> Toate echipele
          </Link>

          <div className="flex items-end gap-6 flex-wrap">
            {team.logo_url ? (
              <img src={team.logo_url} alt={team.name} className="w-24 h-24 rounded-lg object-cover" />
            ) : (
              <div className="w-24 h-24 rounded-lg flex items-center justify-center text-white text-4xl font-black" style={{ background: 'rgba(255,255,255,0.15)' }}>
                {team.short_name?.[0] || team.name[0]}
              </div>
            )}
            <div className="flex-1 text-white">
              <p className="text-sm font-medium uppercase tracking-wider mb-1 text-white/70">
                Team · {season?.name || ''}
              </p>
              <h1 className="text-5xl font-black tracking-tight mb-2" style={{ letterSpacing: '-0.03em' }}>
                {team.name}
              </h1>
              {team.slogan && (
                <p className="text-lg italic text-white/90">"{team.slogan}"</p>
              )}
            </div>
            {boat && (
              <Link href={`/ssyt/admin/boats/${boat.id}`} className="hidden md:block rounded-lg p-3 transition hover:opacity-90" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <div className="flex items-center gap-2 text-white text-sm">
                  <Sailboat size={16} />
                  <div>
                    <div className="text-xs uppercase opacity-70">Ambarcațiune</div>
                    <div className="font-semibold">{boat.name}</div>
                  </div>
                </div>
              </Link>
            )}
          </div>

          {team.description && (
            <p className="text-white/80 mt-6 max-w-3xl leading-relaxed">{team.description}</p>
          )}
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6 py-10 space-y-12">
        {/* Skipper + Boat */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {skipper && (
            <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: colorPrimary, color: '#fff' }}>
                <Crown size={16} style={{ color: '#FF6B35' }} />
                <span className="text-xs font-medium uppercase tracking-wider">Skipper</span>
              </div>
              <div className="p-5 flex items-center gap-4">
                {skipper.photo_url ? (
                  <img src={skipper.photo_url} alt={skipper.full_name} className="w-20 h-20 rounded-full object-cover" />
                ) : (
                  <div className="w-20 h-20 rounded-full flex items-center justify-center font-bold text-2xl" style={{ background: colorPrimary, color: '#fff' }}>
                    {skipper.first_name?.[0]}{skipper.last_name?.[0]}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg tracking-tight" style={{ color: '#0a1628' }}>{skipper.full_name}</h3>
                  {skipper.nickname && <p className="text-xs text-gray-500 mb-1">"{skipper.nickname}"</p>}
                  {skipper.sailing_experience && (
                    <p className="text-xs text-gray-600 line-clamp-3">{skipper.sailing_experience}</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {boat && (
            <Link href={`/ssyt/admin/boats/${boat.id}`} className="rounded-lg overflow-hidden hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="px-5 py-3 flex items-center gap-2" style={{ background: colorPrimary, color: '#fff' }}>
                <Sailboat size={16} style={{ color: '#FF6B35' }} />
                <span className="text-xs font-medium uppercase tracking-wider">Ambarcațiune</span>
              </div>
              <div className="p-5 flex items-center gap-4">
                {boat.photo_url ? (
                  <img src={boat.photo_url} alt={boat.name} className="w-24 h-20 rounded-md object-cover" />
                ) : (
                  <div className="w-24 h-20 rounded-md flex items-center justify-center" style={{ background: 'rgba(0,168,181,0.12)' }}>
                    <Sailboat size={28} style={{ color: '#00A8B5' }} />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-lg tracking-tight" style={{ color: '#0a1628' }}>{boat.name}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{boat.model}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-600">
                    {boat.sail_number && <span className="font-mono uppercase">{boat.sail_number}</span>}
                    {boat.capacity && (
                      <span className="inline-flex items-center gap-1">
                        <Users size={11} /> {boat.capacity}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )}
        </section>

        {/* Echipaj */}
        <section>
          <h2 className="text-2xl font-bold tracking-tight mb-4" style={{ color: '#0a1628' }}>
            <Users size={22} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Echipaj
            <span className="text-base font-normal text-gray-500 ml-2">({core.length + occasional.length})</span>
          </h2>
          {core.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Core</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {core.map((m) => <MemberCard key={m.id} member={m} color={colorPrimary} />)}
              </div>
            </div>
          )}
          {occasional.length > 0 && (
            <div>
              <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Occasional</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {occasional.map((m) => <MemberCard key={m.id} member={m} color={colorPrimary} occasional />)}
              </div>
            </div>
          )}
          {core.length === 0 && occasional.length === 0 && (
            <div className="rounded-lg p-8 text-center text-gray-400 italic" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
              Niciun membru încă.
            </div>
          )}
        </section>

        {/* Regate viitoare */}
        {upcomingRegattas.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4" style={{ color: '#0a1628' }}>
              <Calendar size={22} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
              Regate viitoare
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingRegattas.map((r) => {
                const stat = partByRegatta[r.id] || { confirmed: 0, total: 0, onCrewlist: 0 }
                const d1 = new Date(r.start_date)
                return (
                  <Link key={r.id} href={`/ssyt/regattas/${r.slug}`} className="rounded-lg p-4 flex items-center gap-4 hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                    <div className="w-12 h-12 rounded-md flex flex-col items-center justify-center flex-shrink-0" style={{ background: '#0a1628', color: '#fff' }}>
                      <div className="text-[10px] uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
                      <div className="text-base font-bold leading-none">{d1.getDate()}</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate" style={{ color: '#0a1628' }}>{r.name}</div>
                      <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                        <span>{d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}</span>
                        {r.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin size={10} /> {r.location}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                          {stat.confirmed} confirmat{stat.confirmed === 1 ? '' : 'i'}
                        </span>
                        {stat.onCrewlist > 0 && (
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}>
                            {stat.onCrewlist} pe crewlist
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* Rezultate */}
        {pastRegattas.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4" style={{ color: '#0a1628' }}>
              <Trophy size={22} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
              Rezultate
            </h2>
            <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Regatta</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
                    <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Loc oficial</th>
                    <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Loc SSYT</th>
                    <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Puncte</th>
                  </tr>
                </thead>
                <tbody>
                  {pastRegattas.map((r) => {
                    const res = (results || []).find((rs: any) => rs.regatta_id === r.id)
                    const d = new Date(r.start_date)
                    return (
                      <tr key={r.id} className="hover:bg-gray-50" style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td className="px-4 py-2">
                          <Link href={`/ssyt/regattas/${r.slug}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                            {r.short_name || r.name}
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-2 text-center text-sm tabular-nums">
                          {res?.official_place ? (
                            <span className="font-bold" style={{ color: res.official_place <= 3 ? '#FF6B35' : '#0a1628' }}>
                              {res.official_place}
                              {res.official_total_boats && <span className="text-gray-400 text-xs"> / {res.official_total_boats}</span>}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-center text-sm tabular-nums">
                          {res?.ssyt_internal_place ? (
                            <span className="font-bold" style={{ color: '#0a1628' }}>{res.ssyt_internal_place}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-2 text-center text-sm tabular-nums">
                          {res?.ssyt_internal_points ? (
                            <span className="font-semibold" style={{ color: '#10B981' }}>{Number(res.ssyt_internal_points).toFixed(0)}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Badge-uri */}
        {teamBadges.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold tracking-tight mb-4" style={{ color: '#0a1628' }}>
              🏆 Badge-uri câștigate
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {teamBadges.map((tb: any) => {
                const badge = tb.badge
                if (!badge) return null
                return (
                  <div key={tb.id} className="rounded-lg p-3 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                    {badge.icon_url ? (
                      <img src={badge.icon_url} alt={badge.name} className="w-12 h-12 mx-auto mb-2" />
                    ) : (
                      <div className="w-12 h-12 mx-auto mb-2 rounded-full flex items-center justify-center text-2xl" style={{ background: badge.color || colorPrimary, color: '#fff' }}>
                        🏆
                      </div>
                    )}
                    <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>{badge.name}</div>
                    {badge.description && <p className="text-[10px] text-gray-500 mt-1">{badge.description}</p>}
                  </div>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}

function MemberCard({ member, color, occasional }: { member: any; color: string; occasional?: boolean }) {
  return (
    <div className="rounded-lg p-3 text-center hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      {member.photo_url ? (
        <img src={member.photo_url} alt={member.full_name} className="w-16 h-16 mx-auto rounded-full object-cover mb-2" />
      ) : (
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center font-bold text-lg mb-2" style={{ background: color, color: '#fff' }}>
          {member.first_name?.[0]}{member.last_name?.[0]}
        </div>
      )}
      <div className="font-semibold text-xs leading-tight" style={{ color: '#0a1628' }}>
        {member.full_name}
      </div>
      {member.nickname && (
        <div className="text-[10px] text-gray-500 italic mt-0.5">"{member.nickname}"</div>
      )}
      {occasional && (
        <div className="mt-1.5">
          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(0,168,181,0.12)', color: '#00A8B5' }}>
            occasional
          </span>
        </div>
      )}
    </div>
  )
}