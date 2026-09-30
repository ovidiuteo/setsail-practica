'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Mail, ArrowRight } from 'lucide-react'

export default function ReviewEntryPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')

  function go(e: React.FormEvent) {
    e.preventDefault()
    const v = email.trim().toLowerCase()
    if (!v) return
    router.push(`/ssyt/review/${encodeURIComponent(v)}`)
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>SSYT 2026</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        Reviews SSYT 2026
      </h1>
      <p className="text-gray-600 mb-6">
        Introdu adresa de e-mail cu care ai participat și te ducem la formularul tău de review.
      </p>

      <form onSubmit={go} className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <label className="block text-sm font-medium mb-2" style={{ color: '#0a1628' }}>Adresa de e-mail</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nume@exemplu.com"
              className="w-full pl-9 pr-3 py-2.5 border rounded-md text-sm"
              style={{ borderColor: '#d1d5db' }}
              autoFocus
            />
          </div>
          <button type="submit" disabled={!email.trim()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md font-medium text-white disabled:opacity-50"
            style={{ background: '#FF6B35' }}>
            Continuă <ArrowRight size={15} />
          </button>
        </div>
      </form>
    </div>
  )
}
