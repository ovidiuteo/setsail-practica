import Link from 'next/link'
import { Plus, Users } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ParticipantsView from './ParticipantsView'
import PublicLinkBar from '@/components/ssyt/admin/PublicLinkBar'

export const dynamic = 'force-dynamic'

export default async function AdminParticipantsPage() {
  const { data: participantsRaw } = await supabase
    .from('ssyt_participants')
    .select(`
      id, first_name, last_name, full_name, email, phone, status, auth_status,
      memberships:ssyt_team_memberships(membership_type, status, team_id)
    `)
    .order('full_name')

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, slug, color_primary, display_order')
    .eq('status', 'active')
    .order('display_order')

  // Iau token-ul public activ pentru lista de participanti
  const { data: tokens } = await supabase
    .from('ssyt_public_tokens')
    .select('token')
    .eq('resource_type', 'participants_list')
    .is('revoked_at', null)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order('created_at', { ascending: false })
    .limit(1)

  const publicToken = tokens?.[0]?.token || null
  const publicPath = publicToken ? `/ssyt/p/${publicToken}` : null

  const participants = (participantsRaw || []).map((p: any) => {
    const activeMembership = (p.memberships || []).find((m: any) => m.status === 'active')
    return {
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      auth_status: p.auth_status,
      team_id: activeMembership?.team_id || null,
      membership_type: activeMembership?.membership_type || null,
    }
  })

  return (
    <div className="px-8 py-8 max-w-[1400px]">
      <div className="flex items-end justify-between mb-4 flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Users size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Participanți
          </h1>
          <p className="text-sm text-gray-500 mt-1">{participants.length} participanți totali</p>
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

      {publicPath && (
        <PublicLinkBar publicPath={publicPath} label="Link public read-only" />
      )}

      <ParticipantsView participants={participants} teams={teams || []} />
    </div>
  )
}
