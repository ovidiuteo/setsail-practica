'use client'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'

export default function LogoutButton() {
  const router = useRouter()
  async function handleLogout() {
    await fetch('/api/ssyt/portal-logout', { method: 'POST' })
    router.push('/ssyt/portal-login')
    router.refresh()
  }
  return (
    <button onClick={handleLogout} className="text-gray-400 hover:text-gray-700 transition" title="Logout">
      <LogOut size={16} />
    </button>
  )
}
