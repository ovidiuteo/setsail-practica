'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Anchor, LogOut } from 'lucide-react'
import { useRequireAuth } from '@/lib/ssyt/useCurrentUser'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import PortalNav from './PortalNav'

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, participant, isAdmin, loading } = useRequireAuth()

  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/ssyt')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f9fa' }}>
        <div className="text-sm text-gray-400">Se încarcă...</div>
      </div>
    )
  }

  if (!user) return null  // redirect-ul deja in progres

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      <header className="px-6 py-3 flex items-center justify-between border-b" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
        <Link href="/ssyt" className="inline-flex items-center gap-2">
          <Anchor size={18} style={{ color: '#FF6B35' }} />
          <span className="font-bold tracking-tight" style={{ color: '#0a1628' }}>SSYT2026</span>
          <span className="text-xs text-gray-400 ml-2">Portal membri</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          {isAdmin && (
            <Link href="/ssyt/admin" className="text-gray-600 hover:underline">Admin</Link>
          )}
          <span className="text-gray-700 font-medium">{participant?.full_name || user.email}</span>
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700 transition" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      <PortalNav />

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
