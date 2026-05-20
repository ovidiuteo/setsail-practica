'use client'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'

export default function PortalLoginForm() {
  const params = useSearchParams()
  const next = params.get('next') || '/ssyt/portal'
  const prefilledEmail = params.get('email') || ''
  const [email, setEmail] = useState(prefilledEmail)
  const [keyword, setKeyword] = useState('ssyt2026')  // precompletat
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/ssyt/portal-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), keyword: keyword.trim() }),
    })
    const data = await res.json()

    if (!res.ok || !data.success) {
      setLoading(false)
      setError(data.error || 'Email sau cod sesiune invalid.')
      return
    }

    // HARD NAVIGATION - forteaza full page reload ca sa garanteze
    // ca cookie-ul HttpOnly e trimis la urmatoarele requests
    window.location.href = next
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
          placeholder="email-ul tau"
          className="w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-2"
          style={{ borderColor: '#d1d5db' }}
          autoComplete="email"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
          Cod sesiune
        </label>
        <input
          type="text"
          required
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm font-mono focus:outline-none focus:ring-2"
          style={{ borderColor: '#d1d5db' }}
        />
        <p className="text-xs text-gray-400 mt-1">Codul sezonului curent.</p>
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
        {loading ? 'Se verifică...' : 'Intră în portal'}
      </button>
    </form>
  )
}
