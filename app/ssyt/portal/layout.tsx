import Link from 'next/link'
import { Anchor } from 'lucide-react'
import { getPortalSessionWithDebug } from '@/lib/ssyt/portal-session'
import PortalNav from './PortalNav'
import LogoutButton from './LogoutButton'

export const dynamic = 'force-dynamic'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { session, debug } = await getPortalSessionWithDebug()

  if (!session) {
    return (
      <div className="p-8 max-w-3xl mx-auto font-mono text-xs">
        <h1 className="text-lg font-bold mb-4">🔧 PORTAL DEBUG MODE</h1>
        <div className="bg-yellow-50 p-4 rounded mb-4">
          <p>Sesiune negăsită. Detalii detaliate:</p>
        </div>
        <pre className="bg-gray-100 p-4 rounded overflow-auto whitespace-pre-wrap break-all">
{JSON.stringify(debug, null, 2)}
        </pre>
        <a href="/ssyt/portal-login" className="inline-block mt-4 px-4 py-2 bg-orange-500 text-white rounded">
          Înapoi la login
        </a>
      </div>
    )
  }

  const { participant } = session

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

      <PortalNav />

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
