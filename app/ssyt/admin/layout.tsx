'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import AdminSidebar from '@/components/ssyt/admin/AdminSidebar'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized'>('loading')

  useEffect(() => {
    async function check() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/ssyt/login?next=' + encodeURIComponent(pathname || '/ssyt/admin'))
        return
      }
      const { data: adminRow } = await supabase
        .from('ssyt_admin_users')
        .select('level')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!adminRow) {
        router.replace('/ssyt/portal-login')
        return
      }
      setStatus('authorized')
    }
    check()
  }, [router, pathname])

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f8f9fa' }}>
        <div className="text-sm text-gray-400">Se verifică acces admin...</div>
      </div>
    )
  }

  if (status === 'unauthorized') return null

  return (
    <div style={{ paddingLeft: 56, minHeight: '100vh', background: '#f8f9fa' }}>
      <AdminSidebar />
      {children}
    </div>
  )
}
