import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, MapPin, Calendar, Anchor, ExternalLink, Users, Trophy } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function PublicRegattaPage({ params }: { params: { slug: string } }) {
  const season = await getActiveSeason()
  if (!season) notFound()

  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('*, races:ssyt_races(*)')
    .eq('season_id', season.id)
    .eq('slug', params.slug)
    .maybeSingle()

  if (!regatta) notFound()
  if (regatta.visibility === 'admin') notFound()

  // Crewlist public (doar echipe + counts, fara detalii personale)
  const { data: participation } = await supabase
    .from('ssyt_regatta_participation')
    .select(`
      id, team_id, confirmation_status,
      team:ssyt_teams(id, name, short_name, color_primary, slug)
    `)
    .eq('regatta_id', regatta.id)

  // Group by team
  const teamMap: Record<string, any> = {}
  for (const p of participation || []) {
    const tid = p.team_id
    if (!teamMap[tid]) teamMap[tid] = { team: (p as any).team, count: 0 }
    teamMap[tid].count++
  }
  const teamsParticipating = Object.values(teamMap)

  // Public results (only if status = completed)
  let results: any[] = []
  if (regatta.status === 'completed') {
    const { data } = await supabase
      .from('ssyt_results')
      .select('*, team:ssyt_teams(id, name, short_name, color_primary, slug)')
      .eq('regatta_id', regatta.id)
      .order('ssyt_internal_place')
    results = data || []
  }

  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const headerColor = eventTypeColors[regatta.event_type] || '#FF6B35'

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Link href="/ssyt/regattas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-6">
        <ArrowLeft size={14} />
        Toate regatele
      </Link>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ background: '#0a1628' }}>
        <div className="p-8 md:p-12">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs uppercase tracking-wider px-3 py-1 rounded-full font-medium text-white" style={{ background: headerColor }}>
              {regatta.event_type}
            </span>
            <span className="text-xs uppercase tracking-wider text-white/60">{regatta.status}</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4" style={{ letterSpacing: '-0.02em' }}>
            {regatta.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-white/70">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {formatDateRange(regatta.start_date, regatta.end_date)}
            </span>
            {regatta.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} />
                {regatta.location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {regatta.description && (
        <div className="mb-8">
          <p className="text-gray-700 leading-relaxed text-lg">{regatta.description}</p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {regatta.marina && (
          <InfoCard label="Marina" value={regatta.marina} />
        )}
        {regatta.start_time && (
          <InfoCard label="Ora start" value={regatta.start_time} />
        )}
        {regatta.briefing_location && (
          <InfoCard label="Briefing" value={regatta.briefing_location} />
        )}
        {regatta.vhf_channel && (
          <InfoCard label="Canal VHF" value={regatta.vhf_channel} />
        )}
      </div>

      {/* External links */}
      {(regatta.notice_of_race_url || regatta.sailing_instructions_url || regatta.external_event_url || regatta.official_results_url) && (
        <div className="mb-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Documente & link-uri</h2>
          <div className="flex flex-wrap gap-2">
            {regatta.notice_of_race_url && <ExternalLinkButton href={regatta.notice_of_race_url} label="Notice of Race" />}
            {regatta.sailing_instructions_url && <ExternalLinkButton href={regatta.sailing_instructions_url} label="Sailing Instructions" />}
            {regatta.external_event_url && <ExternalLinkButton href={regatta.external_event_url} label="Site eveniment" />}
            {regatta.official_results_url && <ExternalLinkButton href={regatta.official_results_url} label="Rezultate oficiale" />}
          </div>
        </div>
      )}

      {/* Races */}
      {regatta.races && regatta.races.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
            <Anchor size={12} className="inline mr-1.5" /> Curse ({regatta.races.length})
          </h2>
          <div className="space-y-2">
            {regatta.races.map((r: any) => (
              <div key={r.id} className="rounded-lg p-4 flex items-center gap-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="w-10 h-10 rounded flex items-center justify-center font-bold text-white text-xs flex-shrink-0" style={{ background: '#0a1628' }}>
                  R{r.race_number}
                </div>
                <div className="flex-1">
                  <div className="font-medium" style={{ color: '#0a1628' }}>{r.name || `Race ${r.race_number}`}</div>
                  {r.race_type && <div className="text-xs text-gray-500">{r.race_type}</div>}
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: '#f3f4f6', color: '#6B7280' }}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Echipe participante */}
      {teamsParticipating.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
            <Users size={12} className="inline mr-1.5" /> Echipe înscrise
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {teamsParticipating.map((tp: any) => (
              <Link
                key={tp.team.id}
                href={`/ssyt/teams/${tp.team.slug || tp.team.id}`}
                className="block rounded-lg overflow-hidden hover:shadow-md transition"
                style={{ background: '#fff', border: '1px solid #e5e7eb' }}
              >
                <div className="h-16 flex items-center justify-center" style={{ background: tp.team.color_primary || '#4A5568' }}>
                  <span className="text-white font-bold text-lg">{tp.team.short_name || tp.team.name}</span>
                </div>
                <div className="p-3 text-center">
                  <div className="text-xs text-gray-500">{tp.count} membri</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Results (only if completed) */}
      {results.length > 0 && (
        <div className="mb-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
            <Trophy size={12} className="inline mr-1.5" /> Rezultate
          </h2>
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <table className="w-full">
              <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Loc SSYT</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Loc oficial</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Puncte SSYT</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-3">
                      <span className="text-2xl font-bold" style={{ color: '#FF6B35' }}>
                        {r.ssyt_internal_place || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/ssyt/teams/${r.team?.slug || r.team?.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <span className="w-3 h-3 rounded-full" style={{ background: r.team?.color_primary }}></span>
                        <span className="font-medium" style={{ color: '#0a1628' }}>{r.team?.name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-center text-gray-700">{r.official_place || '—'}</td>
                    <td className="px-5 py-3 text-center font-medium" style={{ color: '#FF6B35' }}>{r.ssyt_internal_points || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1">{label}</div>
      <div className="font-medium" style={{ color: '#0a1628' }}>{value}</div>
    </div>
  )
}

function ExternalLinkButton({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium hover:bg-gray-50 transition"
      style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}
    >
      {label}
      <ExternalLink size={12} className="text-gray-400" />
    </a>
  )
}

function formatDateRange(start: string, end: string | null) {
  const d1 = new Date(start)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  if (!end || end === start) return d1.toLocaleDateString('ro-RO', opts)
  const d2 = new Date(end)
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${d1.getDate()} – ${d2.getDate()} ${d1.toLocaleString('ro-RO', { month: 'long' })} ${d1.getFullYear()}`
  }
  return `${d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – ${d2.toLocaleDateString('ro-RO', opts)}`
}