import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit, Anchor, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ParticipantEditForm from './ParticipantEditForm'
import EditorToggle from '@/components/ssyt/admin/EditorToggle'
import { effectiveRegattaStatus, regattaStatusColor } from '@/lib/ssyt/regatta-status'

export const revalidate = 0

const CONFIRM: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Disponibil', color: '#10B981' },
  declined: { label: 'Indisponibil', color: '#EF4444' },
  tentative: { label: 'Nu știu', color: '#F59E0B' },
  pending: { label: 'În așteptare', color: '#9CA3AF' },
}

export default async function AdminParticipantDetailPage({ params }: { params: { id: string } }) {
  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select(`
      *,
      memberships:ssyt_team_memberships(
        id, membership_type, status, start_date, end_date, is_editor,
        team:ssyt_teams(id, name, short_name, color_primary, skipper_id)
      )
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!participant) notFound()

  // Participări la regate
  const { data: participationsRaw } = await supabase
    .from('ssyt_regatta_participation')
    .select(`
      id, confirmation_status, attendance_type, on_crewlist,
      regatta:ssyt_regattas(id, name, slug, start_date, end_date, status),
      team:ssyt_teams(id, name, short_name, color_primary)
    `)
    .eq('participant_id', params.id)

  const participations = (participationsRaw || [])
    .map((p: any) => ({ ...p, regatta: Array.isArray(p.regatta) ? p.regatta[0] : p.regatta, team: Array.isArray(p.team) ? p.team[0] : p.team }))
    .filter((p: any) => p.regatta)
    .sort((a: any, b: any) => new Date(b.regatta.start_date).getTime() - new Date(a.regatta.start_date).getTime())

  const activeMembership = (participant.memberships || []).find((m: any) => m.status === 'active')
  const isSkipper = activeMembership?.team?.skipper_id === participant.id

  return (
    <div className="px-8 py-8 max-w-5xl">
      <Link href="/ssyt/admin/participants" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4">
        <ArrowLeft size={14} />
        Toți participanții
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl" style={{ background: '#0a1628' }}>
          {participant.first_name?.charAt(0)}{participant.last_name?.charAt(0)}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            {participant.full_name}
          </h1>
          <p className="text-sm text-gray-500">{participant.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-2">
              <Edit size={14} /> Editează participant
            </h2>
            <ParticipantEditForm participant={participant} />
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Status</div>
            <StatusBadge status={participant.status} />
          </div>

          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Echipa curentă</div>
            {!activeMembership?.team ? (
              <div className="text-sm text-gray-400 italic">Neasignat</div>
            ) : (
              <>
                <Link href={`/ssyt/admin/teams/${activeMembership.team.id}`} className="inline-flex items-center gap-2 hover:underline">
                  <span className="w-3 h-3 rounded-full" style={{ background: activeMembership.team.color_primary || '#4A5568' }}></span>
                  <span className="font-medium" style={{ color: '#0a1628' }}>{activeMembership.team.name}</span>
                  <span className="text-xs text-gray-400">({activeMembership.membership_type})</span>
                </Link>
                <div className="mt-3 pt-3 border-t" style={{ borderColor: '#f3f4f6' }}>
                  <div className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-1.5">Rol portal</div>
                  {isSkipper ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium" style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35' }}>
                      👑 Skipper (editor automat)
                    </span>
                  ) : (
                    <EditorToggle
                      membershipId={activeMembership.id}
                      initialValue={!!activeMembership.is_editor}
                      participantName={participant.full_name}
                    />
                  )}
                  <p className="text-[10px] text-gray-400 mt-1.5">
                    Editorii pot crea/edita to-do-uri, resurse și note în portal.
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">Date aplicare</div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>Aplicat: {participant.applied_at ? new Date(participant.applied_at).toLocaleDateString('ro-RO') : '—'}</div>
              <div>Acceptat: {participant.accepted_at ? new Date(participant.accepted_at).toLocaleDateString('ro-RO') : '—'}</div>
              <div>GDPR: {participant.consent_gdpr ? '✓' : '✗'}</div>
              <div>Profil public: {participant.consent_public_profile ? '✓' : '✗'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Participări la regate */}
      <div className="rounded-lg overflow-hidden mt-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="px-5 py-3 flex items-center justify-between" style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
            <Anchor size={14} /> Participări la regate
          </h2>
          <span className="text-xs text-gray-400">{participations.length}</span>
        </div>
        {participations.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-gray-400 italic">Nicio participare înregistrată.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead style={{ background: '#fff', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Regatta</th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Când</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Disponibilitate</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Crewlist</th>
                </tr>
              </thead>
              <tbody>
                {participations.map((p: any) => {
                  const eff = effectiveRegattaStatus(p.regatta)
                  const effColor = regattaStatusColor(eff)
                  const conf = p.confirmation_status ? CONFIRM[p.confirmation_status] : null
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td className="px-5 py-3">
                        <Link href={`/ssyt/admin/regattas/${p.regatta.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                          {p.regatta.name}
                        </Link>
                        <div className="text-xs text-gray-500">
                          {new Date(p.regatta.start_date).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {p.team ? (
                          <Link href={`/ssyt/admin/teams/${p.team.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.team.color_primary || '#4A5568' }}></span>
                            <span className="text-gray-700">{p.team.short_name || p.team.name}</span>
                          </Link>
                        ) : <span className="text-gray-400 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${effColor}15`, color: effColor }}>{eff}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {conf ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: `${conf.color}15`, color: conf.color }}>{conf.label}</span>
                        ) : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.on_crewlist ? <UserCheck size={16} className="inline" style={{ color: '#10B981' }} /> : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
