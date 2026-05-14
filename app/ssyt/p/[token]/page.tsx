import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Anchor, Users } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import PublicParticipantsView from './PublicParticipantsView'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: { token: string } }) {
  return {
    title: 'Participanți SSYT2026',
    description: 'Lista publică a participanților SSYT2026',
    robots: { index: false, follow: false },  // nu indexa în Google
  }
}

export default async function PublicTokenPage({ params }: { params: { token: string } }) {
  // Validez token-ul prin functia DB
  const { data: validation } = await supabase.rpc('ssyt_validate_public_token', {
    p_token: params.token,
  })

  const v = Array.isArray(validation) ? validation[0] : validation
  if (!v || !v.valid) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: '#f8f9fa' }}>
        <div className="max-w-md w-full rounded-lg p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <Anchor size={32} className="mx-auto mb-3" style={{ color: '#FF6B35' }} />
          <h1 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628' }}>
            Link invalid
          </h1>
          <p className="text-sm text-gray-500">
            {v?.reason === 'expired' && 'Acest link a expirat.'}
            {v?.reason === 'revoked' && 'Acest link a fost dezactivat de administrator.'}
            {(!v || v?.reason === 'token_not_found') && 'Acest link nu este valid sau a fost șters.'}
          </p>
          <Link href="/ssyt" className="inline-block mt-4 text-sm" style={{ color: '#FF6B35' }}>
            ← Pagina principală
          </Link>
        </div>
      </div>
    )
  }

  // Token valid; resourceType ne spune ce sa afisam
  if (v.resource_type !== 'participants_list') {
    // Pentru moment suportam doar lista participanți
    notFound()
  }

  // Fetch participanti + teams (la fel ca pagina admin)
  const { data: participantsRaw } = await supabase
    .from('ssyt_participants')
    .select(`
      id, first_name, last_name, full_name, email, phone, status,
      memberships:ssyt_team_memberships(membership_type, status, team_id)
    `)
    .order('full_name')

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, slug, color_primary, display_order')
    .eq('status', 'active')
    .order('display_order')

  const participants = (participantsRaw || []).map((p: any) => {
    const activeMembership = (p.memberships || []).find((m: any) => m.status === 'active')
    return {
      id: p.id,
      full_name: p.full_name,
      email: p.email,
      phone: p.phone,
      status: p.status,
      team_id: activeMembership?.team_id || null,
      membership_type: activeMembership?.membership_type || null,
    }
  })

  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa' }}>
      {/* Header public minimal */}
      <header className="border-b" style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.08)' }}>
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <Link href="/ssyt" className="inline-flex items-center gap-2 text-white">
            <Anchor size={20} style={{ color: '#FF6B35' }} />
            <span className="font-bold tracking-tight">SSYT2026</span>
          </Link>
          <span className="text-xs uppercase tracking-wider text-white/50">
            🔗 Vizualizare publică
          </span>
        </div>
      </header>

      <div className="max-w-[1400px] mx-auto px-6 md:px-8 py-8">
        <div className="mb-6">
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Users size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Participanți
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {participants.length} participanți · grupați pe echipe
          </p>
        </div>

        <PublicParticipantsView participants={participants} teams={teams || []} />
      </div>

      <footer className="border-t mt-12 py-6" style={{ borderColor: '#e5e7eb' }}>
        <div className="max-w-7xl mx-auto px-6 text-center text-xs text-gray-400">
          SetSail Yachting Teams · Sezon 2026 · Pagină accesată prin link de partajare
        </div>
      </footer>
    </div>
  )
}
