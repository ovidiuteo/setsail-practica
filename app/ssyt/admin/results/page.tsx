import Link from 'next/link'
import { Trophy, Anchor, ExternalLink } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminResultsPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select(`
      id, name, slug, start_date, status, event_type,
      races:ssyt_races(id, race_number, name, status),
      results:ssyt_results(
        id, official_place, official_points, ssyt_internal_place, ssyt_internal_points,
        is_dnf, is_dns, is_dsq, recap,
        team:ssyt_teams(id, name, short_name, color_primary)
      )
    `)
    .eq('season_id', season.id)
    .order('start_date')

  const totalResults = (regattas || []).reduce((sum, r: any) => sum + (r.results?.length || 0), 0)
  const totalRaces = (regattas || []).reduce((sum, r: any) => sum + (r.races?.length || 0), 0)

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Trophy size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Rezultate
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalResults} rezultate în {totalRaces} curse, {regattas?.length || 0} regate.
          </p>
        </div>
        <Link
          href="/ssyt/admin/leaderboard"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-50 transition"
          style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}
        >
          <Trophy size={14} />
          Vezi clasament agregat
        </Link>
      </div>

      <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        💡 Această pagină listează rezultate din toate regatele sezonului. Pentru a edita rezultate, deschide regatta și mergi la tab-ul <strong>Rezultate</strong>.
      </div>

      <div className="space-y-5">
        {(regattas || []).map((r: any) => (
          <RegattaResultCard key={r.id} regatta={r} />
        ))}
        {(!regattas || regattas.length === 0) && (
          <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            <Anchor size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nicio regatta în sezon.</p>
          </div>
        )}
      </div>
    </div>
  )
}

function RegattaResultCard({ regatta }: { regatta: any }) {
  const hasResults = (regatta.results || []).length > 0
  const sortedResults = hasResults
    ? [...regatta.results].sort((a, b) => (a.ssyt_internal_place ?? 999) - (b.ssyt_internal_place ?? 999))
    : []

  const statusColors: Record<string, string> = {
    upcoming: '#3B82F6',
    live: '#EF4444',
    completed: '#10B981',
    cancelled: '#6B7280',
    draft: '#9CA3AF',
  }
  const statusColor = statusColors[regatta.status] || '#6B7280'

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3" style={{ borderBottom: '1px solid #e5e7eb' }}>
        <div>
          <Link href={`/ssyt/admin/regattas/${regatta.id}`} className="font-semibold text-lg tracking-tight hover:underline inline-flex items-center gap-2" style={{ color: '#0a1628' }}>
            {regatta.name}
            <ExternalLink size={12} className="text-gray-400" />
          </Link>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>{new Date(regatta.start_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
            <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: `${statusColor}15`, color: statusColor }}>
              {regatta.status}
            </span>
            <span>{(regatta.races || []).length} curse</span>
          </div>
        </div>
      </div>

      {!hasResults ? (
        <div className="px-5 py-8 text-center text-sm text-gray-400 italic">
          Niciun rezultat înregistrat pentru această regatta.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500 w-16">Loc SSYT</th>
              <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
              <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Loc oficial</th>
              <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: '#FF6B35' }}>Puncte SSYT</th>
              <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((res: any) => (
              <tr key={res.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td className="px-5 py-3">
                  <span className="font-bold text-lg" style={{ color: '#FF6B35' }}>{res.ssyt_internal_place || '—'}</span>
                </td>
                <td className="px-5 py-3">
                  <Link href={`/ssyt/admin/teams/${res.team?.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className="w-3 h-3 rounded-full" style={{ background: res.team?.color_primary || '#4A5568' }}></span>
                    <span className="font-medium" style={{ color: '#0a1628' }}>{res.team?.name}</span>
                  </Link>
                </td>
                <td className="px-5 py-3 text-center text-gray-700">{res.official_place || '—'}</td>
                <td className="px-5 py-3 text-center font-medium" style={{ color: '#FF6B35' }}>{Number(res.ssyt_internal_points) || 0}</td>
                <td className="px-5 py-3 text-center">
                  {res.is_dnf && <FlagTag label="DNF" />}
                  {res.is_dns && <FlagTag label="DNS" />}
                  {res.is_dsq && <FlagTag label="DSQ" />}
                  {!res.is_dnf && !res.is_dns && !res.is_dsq && (
                    <span className="text-xs text-gray-400">OK</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function FlagTag({ label }: { label: string }) {
  return (
    <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white mr-1" style={{ background: '#EF4444' }}>
      {label}
    </span>
  )
}