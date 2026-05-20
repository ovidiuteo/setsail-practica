'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ApplyButton({
  clubSlug,
  clubName,
  disabled,
}: {
  clubSlug: string
  clubName: string
  disabled?: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function apply() {
    if (disabled) return
    if (!confirm(`Confirmi că vrei să aplici la „${clubName}"? Poți reveni asupra alegerii ulterior.`)) return

    setLoading(true)
    setError('')

    const res = await fetch(`/api/ssyt/club/${clubSlug}/apply`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))

    setLoading(false)

    if (!res.ok || !json.ok) {
      setError(json.error || 'A apărut o eroare.')
      return
    }

    router.push(`/ssyt/portal/club/${clubSlug}/aplicare`)
    router.refresh()
  }

  return (
    <div className="space-y-2">
      <button
        onClick={apply}
        disabled={loading || disabled}
        className="w-full md:w-auto px-6 py-3 rounded-md text-base font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: '#FF6B35', color: '#fff' }}
      >
        {loading ? 'Se procesează...' : `Aplică la ${clubName}`}
      </button>

      {error && (
        <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
    </div>
  )
}
