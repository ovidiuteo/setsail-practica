'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get('next')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (err) {
      setError(err.message)
      return
    }

    // Verific dacă e admin pentru redirect corespunzator
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: adminRow } = await supabase
        .from('ssyt_admin_users')
        .select('level')
        .eq('user_id', user.id)
        .maybeSingle()

      if (next) {
        router.push(next)
      } else if (adminRow) {
        router.push('/ssyt/admin')
      } else {
        router.push('/ssyt/portal')
      }
      router.refresh()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: '#d1d5db' }}
          autoComplete="email"
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Parolă</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: '#d1d5db' }}
          autoComplete="current-password"
        />
      </div>

      {error && (
        <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full py-2.5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: '#FF6B35' }}
      >
        {loading ? 'Se autentifică...' : 'Autentificare'}
      </button>
    </form>
  )
}
