import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Anchor } from 'lucide-react'
import { getPortalSession } from '@/lib/ssyt/portal-session'
import { getSportClubsAccess } from '@/lib/ssyt/club-access'
import PortalNav from './PortalNav'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login?next=/ssyt/portal')

  const { participant } = session
  const access = await getSportClubsAccess(session.participantId, session.seasonId)

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      <header className="px-6 py-3 flex items-center justify-between border-b" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
        <Link href="/ssyt" className="inline-flex items-center gap-2">
          <Anchor size={18} style={{ color: '#FF6B35' }} />
          <span className="font-bold tracking-tight" style={{ color: '#0a1628' }}>SSYT2026</span>
          <span className="text-xs text-gray-400 ml-2">Portal membri</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-gray-700 font-medium">{participant.full_name}</span>
          <LogoutButton />
        </div>
      </header>

      <PortalNav showClubsTab={access.hasAccess} />

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
