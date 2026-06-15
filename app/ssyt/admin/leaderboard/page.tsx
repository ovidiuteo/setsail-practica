import Link from 'next/link'
import { Trophy, Settings, Anchor } from 'lucide-react'
import { supabase, getActiveSeason, getSeasonLeaderboard } from '@/lib/ssyt/supabase'
import { effectiveRegattaStatus, regattaStatusColor } from '@/lib/ssyt/regatta-status'

export const revalidate = 0

export default async function AdminLeaderboardPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const leaderboard = await getSeasonLeaderboard(season.id)

  // Toate regatele si rezultatele lor
  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select(`
      id, name, slug, status, start_date, end_date,
      results:ssyt_results(team_id, ssyt_internal_place, ssyt_internal_points, official_place)
    `)
    .eq('season_id', season.id)
    .order('start_date')

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Leaderboard
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Clasamentul intern SSYT este calculat automat din rezultatele introduse la regate.
          </p>
        </div>
        <Link
          href="/ssyt/leaderboard"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-50 transition"
          style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}
        >
          <Trophy size={14} />
          Vezi public
        </Link>
      </div>

      {/* Notice scoring */}
      <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'rgba(245,158,11,0.08)', color: '#92400E', border: '1px solid rgba(245,158,11,0.2)' }}>
        <Settings size={14} className="inline mr-1.5" />
        <strong>Sistemul de punctaj</strong> nu este încă configurat. Pentru moment, punctele se introduc manual la fiecare rezultat (câmpul <code className="text-xs bg-white px-1 rounded">ssyt_internal_points</code>). Formula automată va fi adăugată într-un sprint viitor.
      </div>

      {/* Clasament curent */}
      <div className="rounded-lg overflow-hidden mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500" style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
          Clasament agregat
        </div>
        <table className="w-full text-sm">
          <thead style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 w-16">Loc</th>
              <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
              <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Regatte</th>
              <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Victorii</th>
              <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Podium</th>
              <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#FF6B35' }}>Puncte SSYT</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((row: any, idx: number) => (
              <tr key={row.team_id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                <td className="px-5 py-3 font-bold" style={{ color: '#0a1628' }}>{idx + 1}</td>
                <td className="px-5 py-3">
                  <Link href={`/ssyt/admin/teams/${row.team_id}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className="w-3 h-3 rounded-full" style={{ background: row.color_primary || '#4A5568' }}></span>
                    <span className="font-medium" style={{ color: '#0a1628' }}>{row.team_name}</span>
                  </Link>
                </td>
                <td className="px-5 py-3 text-center">{row.regattas_completed}</td>
                <td className="px-5 py-3 text-center">{Number(row.wins_internal) || '—'}</td>
                <td className="px-5 py-3 text-center">{Number(row.podiums_internal) || '—'}</td>
                <td className="px-5 py-3 text-right font-bold" style={{ color: '#FF6B35' }}>
                  {Number(row.total_ssyt_points) || 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Matricea regate × echipe */}
      <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500" style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
          Matrice rezultate per regatta
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Regatta</th>
                <th className="text-center px-3 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                {leaderboard.map((t: any) => (
                  <th key={t.team_id} className="text-center px-3 py-3">
                    <Link href={`/ssyt/admin/teams/${t.team_id}`} className="inline-flex flex-col items-center hover:opacity-80">
                      <span className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold" style={{ background: t.color_primary || '#4A5568' }}>
                        {t.team_name?.replace('Team ', '').charAt(0)}
                      </span>
                      <span className="text-[10px] text-gray-500 mt-1">{t.team_name?.replace('Team ', '')}</span>
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(regattas || []).map((r: any) => (
                <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="px-5 py-3">
                    <Link href={`/ssyt/admin/regattas/${r.id}`} className="font-medium hover:underline text-sm" style={{ color: '#0a1628' }}>
                      {r.name}
                    </Link>
                    <div className="text-xs text-gray-500">{new Date(r.start_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</div>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <StatusBadge status={effectiveRegattaStatus(r)} />
                  </td>
                  {leaderboard.map((t: any) => {
                    const result = (r.results || []).find((res: any) => res.team_id === t.team_id)
                    return (
                      <td key={t.team_id} className="px-3 py-3 text-center">
                        {result ? (
                          <div>
                            <div className="font-bold text-sm" style={{ color: '#FF6B35' }}>
                              {result.ssyt_internal_place || '—'}
                            </div>
                            <div className="text-[10px] text-gray-400">
                              {Number(result.ssyt_internal_points) || 0}p
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-300 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
              {(!regattas || regattas.length === 0) && (
                <tr>
                  <td colSpan={leaderboard.length + 2} className="px-5 py-8 text-center text-sm text-gray-500">
                    Nicio regatta în sezon.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const c = regattaStatusColor(status)
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}