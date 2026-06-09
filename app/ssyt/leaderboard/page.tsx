import Link from 'next/link'
import { Trophy, Anchor, Users } from 'lucide-react'
import { supabase, getActiveSeason, getSeasonLeaderboard } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function LeaderboardPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="py-20 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const leaderboard = await getSeasonLeaderboard(season.id)

  // Cati regate completate are sezonul
  const { count: completedRegattas } = await supabase
    .from('ssyt_regattas')
    .select('id', { count: 'exact', head: true })
    .eq('season_id', season.id)
    .eq('status', 'completed')

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <Trophy size={32} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Leaderboard
        </h1>
        <p className="text-gray-600">
          {completedRegattas && completedRegattas > 0
            ? `Clasament intern după ${completedRegattas} ${completedRegattas === 1 ? 'regatta' : 'regate'} finalizate.`
            : 'Sezon în curs. Clasamentul se actualizează după fiecare regatta.'}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="rounded-xl p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Trophy size={32} className="mx-auto mb-4 opacity-30" />
          <p>Clasamentul va fi disponibil după prima regatta.</p>
        </div>
      ) : (
        <>
          {/* Podium top 3 (daca avem rezultate) */}
          {leaderboard.some((r) => Number(r.total_ssyt_points) > 0) && (
            <PodiumSection rows={leaderboard.slice(0, 3)} />
          )}

          {/* Tabel complet */}
          <div className="rounded-xl overflow-hidden mt-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <table className="w-full">
              <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 w-16">Loc</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Regatte</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Victorii</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Podium</th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#FF6B35' }}>Puncte SetSail</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row, idx) => (
                  <tr key={row.team_id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-4">
                      <PositionBadge position={idx + 1} />
                    </td>
                    <td className="px-5 py-4">
                      <Link href={`/ssyt/teams/${row.team_id}`} className="flex items-center gap-3 hover:underline">
                        <div className="w-10 h-10 rounded flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: row.color_primary || '#4A5568' }}>
                          {row.team_name?.replace('Team ', '').charAt(0) || 'T'}
                        </div>
                        <span className="font-semibold" style={{ color: '#0a1628' }}>{row.team_name}</span>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-center text-gray-700">{row.regattas_completed}</td>
                    <td className="px-5 py-4 text-center text-gray-700">
                      {Number(row.wins_internal) > 0 ? (
                        <span className="font-semibold" style={{ color: '#FF6B35' }}>{row.wins_internal}</span>
                      ) : '—'}
                    </td>
                    <td className="px-5 py-4 text-center text-gray-700">
                      {Number(row.podiums_internal) > 0 ? row.podiums_internal : '—'}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <span className="text-2xl font-bold tabular-nums" style={{ color: idx === 0 && Number(row.total_ssyt_points) > 0 ? '#FF6B35' : '#0a1628' }}>
                        {Number(row.total_ssyt_points) || 0}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-xs text-gray-500 leading-relaxed">
            <strong>Notă</strong>: Punctaj SetSail — în fiecare regatta, locul între bărcile noastre dă puncte (1, 3, 5, 8),
            însumate pe sezon. Sistem low-point: <strong>mai puține puncte = mai bine</strong>. Separat de clasamentul oficial.
          </p>
        </>
      )}
    </div>
  )
}

function PodiumSection({ rows }: { rows: any[] }) {
  const ordered = [
    rows[1] ? { ...rows[1], position: 2 } : null,
    rows[0] ? { ...rows[0], position: 1 } : null,
    rows[2] ? { ...rows[2], position: 3 } : null,
  ].filter(Boolean) as any[]

  return (
    <div className="mb-10">
      <div className="grid grid-cols-3 gap-3 items-end max-w-3xl mx-auto">
        {ordered.map((row) => (
          <PodiumCard key={row.team_id} row={row} />
        ))}
      </div>
    </div>
  )
}

function PodiumCard({ row }: { row: any }) {
  const height = row.position === 1 ? 220 : row.position === 2 ? 180 : 150
  const medal = row.position === 1 ? '🥇' : row.position === 2 ? '🥈' : '🥉'

  return (
    <Link href={`/ssyt/teams/${row.team_id}`} className="block group">
      <div
        className="rounded-t-xl flex flex-col items-center justify-end pb-4 pt-6 text-white transition group-hover:opacity-95"
        style={{ background: row.color_primary || '#4A5568', height }}
      >
        <div className="text-3xl mb-2">{medal}</div>
        <div className="text-center">
          <div className="text-xs uppercase tracking-wider text-white/70">{row.team_name?.replace('Team ', '')}</div>
          <div className="text-2xl font-bold mt-1 tabular-nums">{Number(row.total_ssyt_points) || 0}</div>
          <div className="text-xs text-white/70">puncte</div>
        </div>
      </div>
    </Link>
  )
}

function PositionBadge({ position }: { position: number }) {
  if (position === 1) {
    return (
      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white" style={{ background: '#FF6B35' }}>
        1
      </span>
    )
  }
  return (
    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-semibold text-gray-700" style={{ background: '#f3f4f6' }}>
      {position}
    </span>
  )
}