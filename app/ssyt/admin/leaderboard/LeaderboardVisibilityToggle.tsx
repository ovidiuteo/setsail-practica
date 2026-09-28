'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function LeaderboardVisibilityToggle({ seasonId, initialVisible }: { seasonId: string; initialVisible: boolean }) {
  const router = useRouter()
  const [visible, setVisible] = useState(initialVisible)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    setBusy(true)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { alert('Nu ești logat ca admin.'); setBusy(false); return }
      const res = await fetch('/api/ssyt/admin/leaderboard-visibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ season_id: seasonId, visible: !visible }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Eroare'); setBusy(false); return }
      setVisible(!visible)
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm transition disabled:opacity-50"
      style={{
        background: visible ? '#10B981' : '#fff',
        color: visible ? '#fff' : '#6B7280',
        border: `1px solid ${visible ? '#10B981' : '#d1d5db'}`,
      }}
      title={visible ? 'Clasamentul general e public — click pentru a-l ascunde' : 'Clasamentul general e ascuns — click pentru a-l publica'}
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : visible ? <Eye size={14} /> : <EyeOff size={14} />}
      {visible ? 'Public: vizibil' : 'Public: ascuns'}
    </button>
  )
}
