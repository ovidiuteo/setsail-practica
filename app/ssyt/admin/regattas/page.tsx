import Link from 'next/link'
import { Plus, Anchor, ChevronRight, MapPin } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminRegattasListPage() {
  const season = await getActiveSeason()
  if (!season) return <EmptyState />

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select(`
      *,
      races:ssyt_races(id),
      results:ssyt_results(id),
      participation:ssyt_regatta_participation(team_id)
    `)
    .eq('season_id', season.id)
    .order('start_date')

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Regatte
          </h1>
          <p className="text-sm text-gray-500 mt-1">{regattas?.length ?? 0} evenimente programate</p>
        </div>
        <Link
          href="/ssyt/admin/regattas/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} />
          Adaugă regatta
        </Link>
      </div>

      {regattas && regattas.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500 w-20">Data</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Eveniment</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Locație</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Curse</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipe</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {regattas.map((r: any) => {
                const teamsCount = new Set((r.participation || []).map((p: any) => p.team_id)).size
                return (
                  <tr key={r.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-3">
                      <DateBadge date={r.start_date} endDate={r.end_date} />
                    </td>
                    <td className="px-5 py-3">
                      <Link href={`/ssyt/admin/regattas/${r.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-700 text-xs">
                      {r.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={11} className="text-gray-400" />
                          {r.location}
                        </span>
                      ) : (
                        <span className="text-gray-400 italic">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <EventTypeBadge type={r.event_type} />
                    </td>
                    <td className="px-5 py-3 text-center text-gray-700">
                      {(r.races || []).length || (r.expected_races || 0)}
                    </td>
                    <td className="px-5 py-3 text-center text-gray-700">
                      {teamsCount}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={effectiveStatus(r)} />
                    </td>
                    <td className="pr-5">
                      <Link href={`/ssyt/admin/regattas/${r.id}`} className="text-gray-400 hover:text-gray-700">
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
          <Anchor size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm mb-4">Nicio regatta programată.</p>
          <Link
            href="/ssyt/admin/regattas/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90"
            style={{ background: '#FF6B35' }}
          >
            <Plus size={14} /> Adaugă prima regatta
          </Link>
        </div>
      )}
    </div>
  )
}

function DateBadge({ date, endDate }: { date: string; endDate: string | null }) {
  const d1 = new Date(date)
  const d2 = endDate ? new Date(endDate) : null
  const monthShort = d1.toLocaleString('ro-RO', { month: 'short' })
  const day1 = d1.getDate()
  const day2 = d2 ? d2.getDate() : null
  const sameMonth = d2 && d2.getMonth() === d1.getMonth()

  return (
    <div className="inline-flex flex-col items-center justify-center text-white font-medium px-2 py-1 rounded" style={{ background: '#0a1628', minWidth: 56 }}>
      <span className="text-[10px] uppercase opacity-70 leading-none">{monthShort}</span>
      <span className="text-sm font-semibold leading-tight mt-0.5">
        {day1}{day2 && day2 !== day1 ? `-${day2}` : ''}
      </span>
    </div>
  )
}

function EventTypeBadge({ type }: { type: string }) {
  const colors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const c = colors[type] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {type}
    </span>
  )
}

// Status efectiv pentru afisare: stari explicite (completed/cancelled/draft) raman;
// altfel deriva din date (ex: 'upcoming' in DB dar regata a trecut -> 'passed').
function effectiveStatus(r: any): string {
  if (r.status === 'completed' || r.status === 'cancelled' || r.status === 'draft') return r.status
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const start = new Date(r.start_date); start.setHours(0, 0, 0, 0)
  const end = r.end_date ? new Date(r.end_date) : start; end.setHours(0, 0, 0, 0)
  if (today > end) return 'passed'
  if (today >= start && today <= end) return 'live'
  return 'upcoming'
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: '#3B82F6',
    live: '#EF4444',
    passed: '#9CA3AF',
    completed: '#10B981',
    cancelled: '#6B7280',
    draft: '#9CA3AF',
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