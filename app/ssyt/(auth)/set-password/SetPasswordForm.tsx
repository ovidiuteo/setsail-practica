'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function SetPasswordForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)

  useEffect(() => {
    // La invitatie, Supabase trimite #access_token in URL. Verific sesiunea
    const supabase = createSupabaseBrowserClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      setValidSession(!!session)
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('Parolele nu coincid.')
      return
    }
    if (password.length < 6) {
      setError('Parola trebuie să aibă minim 6 caractere.')
      return
    }
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    setSuccess(true)
    // Marchez participantul ca 'active'
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('ssyt_participants').update({ auth_status: 'active' }).eq('user_id', user.id)
    }
    setTimeout(() => router.push('/ssyt/portal'), 1500)
  }

  if (validSession === null) {
    return <div className="text-sm text-gray-400">Verificare sesiune...</div>
  }
  if (validSession === false) {
    return (
      <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
        Link invalid sau expirat. Cere un alt link de invitație de la administrator.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Parolă nouă</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
          autoComplete="new-password"
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Confirmă parola</label>
        <input
          type="password"
          required
          minLength={6}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
          autoComplete="new-password"
        />
      </div>

      {error && (
        <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
          Parola setată. Te redirecționăm spre portal...
        </div>
      )}

      <button
        type="submit"
        disabled={loading || success}
        className="w-full py-2.5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: '#FF6B35' }}
      >
        {loading ? 'Se salvează...' : 'Setează parola'}
      </button>
    </form>
  )
}
