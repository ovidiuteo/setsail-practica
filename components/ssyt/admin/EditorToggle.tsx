'use client'
import { useState } from 'react'
import { Check, X, ShieldCheck } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function EditorToggle({
  membershipId,
  initialValue,
  participantName,
}: {
  membershipId: string
  initialValue: boolean
  participantName?: string
}) {
  const [value, setValue] = useState(initialValue)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function toggle() {
    setBusy(true)
    setError(null)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setError('Nu sunt logat ca admin')
        setBusy(false)
        return
      }

      const res = await fetch('/api/ssyt/admin/membership-editor', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ membership_id: membershipId, is_editor: !value }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Eroare')
        setBusy(false)
        return
      }
      setValue(!value)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="inline-flex items-center gap-2">
      <button
        onClick={toggle}
        disabled={busy}
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition disabled:opacity-50"
        style={{
          background: value ? '#FF6B35' : '#fff',
          color: value ? '#fff' : '#6B7280',
          border: `1.5px solid ${value ? '#FF6B35' : '#d1d5db'}`,
        }}
        title={value ? 'Editor activ — click pentru a dezactiva' : 'Click pentru a desemna ca editor'}
      >
        <ShieldCheck size={12} />
        {value ? 'Editor' : 'Crew obișnuit'}
      </button>
      {error && <span className="text-xs" style={{ color: '#EF4444' }}>{error}</span>}
    </div>
  )
}
