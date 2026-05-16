import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Edit } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ParticipantEditForm from './ParticipantEditForm'
import EditorToggle from '@/components/ssyt/admin/EditorToggle'

export const revalidate = 0

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
