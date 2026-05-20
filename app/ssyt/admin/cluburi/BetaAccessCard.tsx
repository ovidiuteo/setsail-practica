'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, X, Plus } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

type ParticipantRef = { id: string; full_name: string | null }

export default function BetaAccessCard({
  seasonId,
  enabledForAll: initialEnabled,
  betaParticipants: initialBeta,
  allParticipants,
}: {
  seasonId: string
  enabledForAll: boolean
  betaParticipants: ParticipantRef[]
  allParticipants: ParticipantRef[]
}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [enabledForAll, setEnabledForAll] = useState(initialEnabled)
  const [beta, setBeta] = useState<ParticipantRef[]>(initialBeta)
  const [searching, setSearching] = useState(false)
  const [query, setQuery] = useState('')
  const [error, setError] = useState('')

  const betaIds = useMemo(() => new Set(beta.map((p) => p.id)), [beta])

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return allParticipants
      .filter(
        (p) => !betaIds.has(p.id) && (p.full_name ?? '').toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [query, allParticipants, betaIds])

  async function updateRow(payload: {
    enabledForAll?: boolean
    newBetaIds?: string[]
  }) {
    setError('')
    const next = {
      sport_clubs_enabled:
        payload.enabledForAll === undefined ? enabledForAll : payload.enabledForAll,
      sport_clubs_beta_participant_ids:
        payload.newBetaIds === undefined ? beta.map((p) => p.id) : payload.newBetaIds,
    }
    const { error: err } = await supabase
      .from('ssyt_seasons')
      .update(next)
      .eq('id', seasonId)
    if (err) {
      setError(err.message)
      return false
    }
    router.refresh()
    return true
  }

  async function toggleEnabled() {
    const next = !enabledForAll
    setEnabledForAll(next)
    const ok = await updateRow({ enabledForAll: next })
    if (!ok) setEnabledForAll(!next) // rollback
  }

  async function addBeta(p: ParticipantRef) {
    setSearching(true)
    const newList = [...beta, p]
    setBeta(newList)
    setQuery('')
    const ok = await updateRow({ newBetaIds: newList.map((x) => x.id) })
    setSearching(false)
    if (!ok) setBeta(beta) // rollback
  }

  async function removeBeta(id: string) {
    const newList = beta.filter((p) => p.id !== id)
    setBeta(newList)
    const ok = await updateRow({ newBetaIds: newList.map((x) => x.id) })
    if (!ok) setBeta(beta) // rollback
  }

  return (
    <div
      className="rounded-lg border mb-6 p-5"
      style={{
        borderColor: enabledForAll ? '#bbf7d0' : '#fde68a',
        background: enabledForAll ? '#f0fdf4' : '#fffbeb',
      }}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: '#0a1628' }}>
            {enabledForAll ? (
              <>
                <Eye size={16} style={{ color: '#16a34a' }} />
                Vizibil pentru toți participanții
              </>
            ) : (
              <>
                <EyeOff size={16} style={{ color: '#d97706' }} />
                Modul în BETA — vizibil doar pentru lista de mai jos
              </>
            )}
          </h2>
          <p className="text-xs text-gray-600">
            {enabledForAll
              ? 'Tab-ul „Club sportiv" apare în portal pentru toți participanții cu status active/accepted.'
              : 'Doar participanții listați mai jos văd tab-ul „Club sportiv" în portalul lor. Activează pentru toți când modulul e gata.'}
          </p>
        </div>

        <button
          onClick={toggleEnabled}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition"
          style={{
            background: enabledForAll ? '#16a34a' : '#fff',
            color: enabledForAll ? '#fff' : '#d97706',
            border: enabledForAll ? 'none' : '1px solid #fcd34d',
          }}
        >
          {enabledForAll ? 'Dezactivează pentru toți' : 'Activează pentru toți'}
        </button>
      </div>

      {!enabledForAll && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {beta.length === 0 && (
              <span className="text-xs text-gray-400 italic">
                Niciun participant whitelistat. Nimeni nu vede tab-ul deocamdată.
              </span>
            )}
            {beta.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs"
                style={{ background: '#fff', color: '#0a1628', border: '1px solid #fcd34d' }}
              >
                {p.full_name ?? p.id.slice(0, 8)}
                <button
                  onClick={() => removeBeta(p.id)}
                  className="rounded-full hover:bg-red-50 p-0.5"
                  title="Elimină"
                >
                  <X size={12} style={{ color: '#dc2626' }} />
                </button>
              </span>
            ))}
          </div>

          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Adaugă participant (caută după nume)..."
              className="w-full md:w-96 px-3 py-1.5 rounded-md border text-sm"
              style={{ borderColor: '#fcd34d' }}
              disabled={searching}
            />
            {suggestions.length > 0 && (
              <ul
                className="absolute z-10 mt-1 w-full md:w-96 rounded-md border max-h-60 overflow-auto"
                style={{ background: '#fff', borderColor: '#e2e8f0', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              >
                {suggestions.map((p) => (
                  <li
                    key={p.id}
                    onClick={() => addBeta(p)}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-orange-50 flex items-center justify-between"
                  >
                    <span>{p.full_name ?? p.id.slice(0, 8)}</span>
                    <Plus size={14} style={{ color: '#FF6B35' }} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="mt-3 text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
    </div>
  )
}
