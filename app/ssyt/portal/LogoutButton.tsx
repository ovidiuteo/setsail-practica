'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function LogoutButton() {
  const router = useRouter()
  async function handleLogout() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/ssyt')
    router.refresh()
  }
  return (
    <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700 transition" title="Logout">
      <LogOut size={16} />
    </button>
  )
}
