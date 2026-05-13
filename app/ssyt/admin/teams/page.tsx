import Link from 'next/link'
import { Plus, Users, Sailboat, ChevronRight } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminTeamsPage() {
  const season = await getActiveSeason()
  if (!season) return <EmptyState />

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select(`
      *,
      boat:ssyt_boats(*),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, full_name, photo_url),
      memberships:ssyt_team_memberships(id, status)
    `)
    .eq('season_id', season.id)
    .order('display_order')

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Echipe
          </h1>
          <p className="text-sm text-gray-500 mt-1">{teams?.length ?? 0} echipe în sezon</p>
        </div>
        <Link
          href="/ssyt/admin/teams/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} />
          Adaugă echipă
        </Link>
      </div>

      {teams && teams.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Skipper</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Ambarcațiune</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Membri</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t: any) => {
                const activeMembers = (t.memberships || []).filter((m: any) => m.status === 'active').length
                return (
                  <tr key={t.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-4">
                      <Link href={`/ssyt/admin/teams/${t.id}`} className="flex items-center gap-3 group">
                        <div className="w-9 h-9 rounded-md flex items-center justify-center text-white font-semibold text-xs flex-shrink-0" style={{ background: t.color_primary || '#4A5568' }}>
                          {t.short_name?.charAt(0) || 'T'}
                        </div>
                        <div>
                          <div className="font-medium group-hover:underline" style={{ color: '#0a1628' }}>{t.name}</div>
                          {t.slogan && <div className="text-xs text-gray-400 italic">"{t.slogan}"</div>}
                        </div>
                      </Link>
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {t.skipper?.full_name || <span className="text-gray-400 italic">— neasignat</span>}
                    </td>
                    <td className="px-5 py-4 text-gray-700">
                      {t.boat ? (
                        <span className="inline-flex items-center gap-1.5">
                          <Sailboat size={12} className="text-gray-400" />
                          {t.boat.name}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">— fără</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="inline-flex items-center gap-1 text-gray-700">
                        <Users size={12} className="text-gray-400" />
                        {activeMembers}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="pr-5">
                      <Link href={`/ssyt/admin/teams/${t.id}`} className="text-gray-400 hover:text-gray-700">
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Users size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-4">Nicio echipă creată încă.</p>
          <Link
            href="/ssyt/admin/teams/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90"
            style={{ background: '#FF6B35' }}
          >
            <Plus size={14} /> Creează prima echipă
          </Link>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: '#10B981',
    inactive: '#6B7280',
    archived: '#9CA3AF',
  }
  const c = colors[status] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}

function EmptyState() {
  return (
    <div className="px-8 py-16 text-center">
      <p className="text-gray-500">Niciun sezon activ.</p>
    </div>
  )
}