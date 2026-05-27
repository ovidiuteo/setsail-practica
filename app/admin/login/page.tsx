'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Ship, LogIn, Loader2 } from 'lucide-react'

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/admin'

  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Auto-focus
  useEffect(() => {
    const el = document.getElementById('admin-pw') as HTMLInputElement | null
    el?.focus()
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const res = await fetch('/api/admin-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.replace(from.startsWith('/admin') ? from : '/admin')
    } else {
      setError('Parolă incorectă')
      setPassword('')
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: '#0a1628' }}
    >
      <form
        onSubmit={submit}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7"
      >
        <div className="flex justify-center mb-5">
          <div className="rounded-xl p-2.5" style={{ background: '#f5c842' }}>
            <Ship size={28} style={{ color: '#0a1628' }} />
          </div>
        </div>
        <h1 className="text-center font-semibold text-gray-900 mb-1">
          SetSail Admin
        </h1>
        <p className="text-center text-xs text-gray-500 mb-5">
          Acces restricționat
        </p>
        <input
          id="admin-pw"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Parolă"
          className="w-full px-3 py-2.5 mb-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
          required
        />
        {error && (
          <div className="text-xs text-red-600 mb-3 text-center">{error}</div>
        )}
        <button
          type="submit"
          disabled={loading || !password}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg font-medium text-white disabled:opacity-50"
          style={{ background: '#0a1628' }}
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={16} />}
          {loading ? 'Se verifică...' : 'Intră'}
        </button>
      </form>
    </div>
  )
}
