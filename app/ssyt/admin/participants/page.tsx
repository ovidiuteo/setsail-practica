import Link from 'next/link'
import { Plus, Users, ChevronRight, Mail } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminParticipantsPage() {
  const { data: participants } = await supabase
    .from('ssyt_participants')
    .select(`
      id, first_name, last_name, full_name, email, phone, status, applied_at, accepted_at,
      memberships:ssyt_team_memberships(
        membership_type, status,
        team:ssyt_teams(id, name, short_name, color_primary)
      )
    `)
    .order('full_name')

  const byStatus = (participants || []).reduce((acc: Record<string, number>, p: any) => {
    acc[p.status] = (acc[p.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Participanți
          </h1>
          <p className="text-sm text-gray-500 mt-1">{participants?.length ?? 0} participanți totali</p>
        </div>
        <Link
          href="/ssyt/admin/participants/new"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} />
          Adaugă participant
        </Link>
      </div>

      {/* Statistici per status */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        {(['applied', 'accepted', 'active', 'waitlist', 'inactive', 'rejected'] as const).map((status) => (
          <div key={status} className="rounded-lg p-3 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{status}</div>
            <div className="text-xl font-semibold" style={{ color: '#0a1628' }}>{byStatus[status] || 0}</div>
          </div>
        ))}
      </div>

      {/* Tabel */}
      {participants && participants.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p: any) => {
                const activeMembership = (p.memberships || []).find((m: any) => m.status === 'active')
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-3">
                      <Link href={`/ssyt/admin/participants/${p.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                        {p.full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">
                      <span className="inline-flex items-center gap-1">
                        <Mail size={11} className="text-gray-400" />
                        {p.email}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {activeMembership?.team ? (
                        <Link
                          href={`/ssyt/admin/teams/${activeMembership.team.id}`}
                          className="inline-flex items-center gap-1.5 hover:underline"
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: activeMembership.team.color_primary || '#4A5568' }}></span>
                          <span style={{ color: '#0a1628' }}>{activeMembership.team.short_name || activeMembership.team.name}</span>
                          <span className="text-xs text-gray-400">({activeMembership.membership_type})</span>
                        </Link>
                      ) : (
                        <span className="text-gray-400 italic text-xs">— neasignat</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="pr-5">
                      <Link href={`/ssyt/admin/participants/${p.id}`} className="text-gray-400 hover:text-gray-700">
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
          <p className="text-sm mb-4">Niciun participant.</p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: '#10B981',
    accepted: '#3B82F6',
    applied: '#F59E0B',
    waitlist: '#8B5CF6',
    inactive: '#6B7280',
    rejected: '#EF4444',
  }
  const c = colors[status] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}