import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sailboat, Users, Edit } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import TeamEditForm from './TeamEditForm'

export const revalidate = 0

export default async function AdminTeamDetailPage({ params }: { params: { id: string } }) {
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select(`
      *,
      boat:ssyt_boats(*),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, full_name, email, photo_url),
      memberships:ssyt_team_memberships(
        id, membership_type, status, start_date,
        participant:ssyt_participants(id, full_name, email, photo_url, status)
      )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!team) notFound()

  // Toate boats + participants pentru dropdown-uri în formul de editare
  const [{ data: allBoats }, { data: allParticipants }] = await Promise.all([
    supabase.from('ssyt_boats').select('id, name, model').eq('is_active', true).order('name'),
    supabase.from('ssyt_participants').select('id, full_name, email').in('status', ['active', 'accepted']).order('full_name'),
  ])

  const activeMembers = (team.memberships || []).filter((m: any) => m.status === 'active')

  return (
    <div className="px-8 py-8 max-w-6xl">
      {/* Breadcrumb + back */}
      <Link href="/ssyt/admin/teams" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4">
        <ArrowLeft size={14} />
        Toate echipele
      </Link>

      {/* Header echipă */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-2xl" style={{ background: team.color_primary || '#4A5568' }}>
          {team.short_name?.charAt(0) || 'T'}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            {team.name}
          </h1>
          {team.slogan && <p className="text-gray-500 italic">"{team.slogan}"</p>}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Coloana stânga — formul editare */}
        <div className="lg:col-span-2">
          <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
              <Edit size={14} /> Editează echipa
            </h2>
            <TeamEditForm team={team} allBoats={allBoats || []} allParticipants={allParticipants || []} />
          </div>
        </div>

        {/* Coloana dreapta — info rapidă */}
        <div className="space-y-4">
          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <Sailboat size={12} /> Ambarcațiune
            </div>
            {team.boat ? (
              <>
                <div className="font-semibold text-lg" style={{ color: '#0a1628' }}>{team.boat.name}</div>
                <div className="text-sm text-gray-500">{team.boat.model}</div>
              </>
            ) : (
              <div className="text-sm text-gray-400 italic">Neasignată</div>
            )}
          </div>

          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Skipper</div>
            {team.skipper ? (
              <div className="font-medium" style={{ color: '#0a1628' }}>{team.skipper.full_name}</div>
            ) : (
              <div className="text-sm text-gray-400 italic">Neasignat</div>
            )}
          </div>

          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
              <Users size={12} /> Membri activi
            </div>
            <div className="text-2xl font-semibold" style={{ color: '#0a1628' }}>{activeMembers.length}</div>
          </div>
        </div>
      </div>

      {/* Roster */}
      <div className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Roster ({activeMembers.length} membri)</h2>
        {activeMembers.length > 0 ? (
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <table className="w-full text-sm">
              <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
                  <th className="text-center px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Din</th>
                </tr>
              </thead>
              <tbody>
                {activeMembers.map((m: any) => (
                  <tr key={m.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-5 py-3">
                      <Link href={`/ssyt/admin/participants/${m.participant?.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                        {m.participant?.full_name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-gray-500 font-mono text-xs">{m.participant?.email}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{
                        background: m.membership_type === 'core' ? 'rgba(255,107,53,0.12)' : 'rgba(0,168,181,0.12)',
                        color: m.membership_type === 'core' ? '#FF6B35' : '#00A8B5',
                      }}>
                        {m.membership_type}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {m.start_date ? new Date(m.start_date).toLocaleDateString('ro-RO') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-lg p-8 text-center text-sm text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            Niciun membru în echipă.
          </div>
        )}
      </div>
    </div>
  )
}