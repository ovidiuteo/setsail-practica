import Link from 'next/link'
import { ClipboardList, ChevronRight, Mail, Phone, Calendar } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminApplicationsPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: applications } = await supabase
    .from('ssyt_applications')
    .select(`
      *,
      preferred_team:ssyt_teams!ssyt_applications_preferred_team_id_fkey(id, name, short_name, color_primary)
    `)
    .eq('season_id', season.id)
    .order('submitted_at', { ascending: false })

  const byStatus = (applications || []).reduce((acc: Record<string, number>, a: any) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Aplicări
        </h1>
        <p className="text-sm text-gray-500 mt-1">{applications?.length ?? 0} aplicări totale</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {(['pending', 'accepted', 'waitlist', 'occasional', 'rejected'] as const).map((status) => (
          <div key={status} className="rounded-lg p-3 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{status}</div>
            <div className="text-xl font-semibold" style={{ color: '#0a1628' }}>{byStatus[status] || 0}</div>
          </div>
        ))}
      </div>

      {applications && applications.length > 0 ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Contact</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă preferată</th>
                <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Data aplicării</th>
                <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {applications.map((a: any) => (
                <tr key={a.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="px-5 py-3">
                    <Link href={`/ssyt/admin/applications/${a.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                      {a.first_name} {a.last_name}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-xs">
                    <div className="flex items-center gap-1 text-gray-500">
                      <Mail size={11} /> {a.email}
                    </div>
                    {a.phone && (
                      <div className="flex items-center gap-1 text-gray-500 mt-0.5">
                        <Phone size={11} /> {a.phone}
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {a.preferred_team ? (
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="w-2 h-2 rounded-full" style={{ background: a.preferred_team.color_primary || '#4A5568' }}></span>
                        {a.preferred_team.short_name || a.preferred_team.name}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">— fără preferință</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(a.submitted_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-center">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="pr-5">
                    <Link href={`/ssyt/admin/applications/${a.id}`} className="text-gray-400 hover:text-gray-700">
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ClipboardList size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio aplicare primită încă.</p>
          <p className="text-xs text-gray-400 mt-2">
            Aplicările sosesc din formularul public <Link href="/ssyt/apply" className="underline">/ssyt/apply</Link>.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: '#F59E0B',
    accepted: '#10B981',
    waitlist: '#8B5CF6',
    occasional: '#3B82F6',
    rejected: '#EF4444',
    needs_discussion: '#6B7280',
  }
  const c = colors[status] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}