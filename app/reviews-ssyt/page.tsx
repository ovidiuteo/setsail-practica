'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

export const dynamic = 'force-dynamic'

type Q = { id: string; label: string; section: string | null; follow_up: string | null }
type R = {
  id: string; email: string; review_text: string | null; answers: Record<string, string> | null
  created_at: string; updated_at: string; participant_name: string | null
}

export default function ReviewsExternPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 text-center text-gray-400">Se încarcă…</div>}>
      <ReviewsExtern />
    </Suspense>
  )
}

function ReviewsExtern() {
  const token = useSearchParams().get('token') || ''
  const [reviews, setReviews] = useState<R[] | null>(null)
  const [questions, setQuestions] = useState<Q[]>([])
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/ssyt/reviews-list?token=${encodeURIComponent(token)}`).catch(() => null)
    if (!r || !r.ok) { setDenied(true); return }
    const j = await r.json()
    setReviews(j.reviews || [])
    setQuestions(j.questions || [])
  }, [token])

  useEffect(() => { if (token) { load(); document.title = 'Reviews SSYT 2026' } else setDenied(true) }, [token, load])

  if (denied) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#cdd9e5', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Acces restricționat</h1><p style={{ color: '#8aa0b3', fontSize: 14 }}>Link invalid sau token lipsă.</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
        <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#0a1628' }}>Reviews</h1>
        <p className="text-sm text-gray-500 mb-6">
          {reviews === null ? 'Se încarcă…' : `${reviews.length} ${reviews.length === 1 ? 'răspuns' : 'răspunsuri'} de la participanți.`}
        </p>

        {reviews === null ? (
          <div className="text-center text-gray-400 py-16">Se încarcă…</div>
        ) : reviews.length === 0 ? (
          <div className="rounded-xl p-12 text-center text-gray-400 bg-white border border-dashed border-gray-200">Niciun review încă.</div>
        ) : (
          <div className="space-y-4">
            {reviews.map((r) => (
              <div key={r.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2 bg-gray-50 border-b border-gray-100">
                  <div className="font-semibold text-gray-900">
                    {r.participant_name || r.email}
                    <span className="ml-2 text-xs font-normal text-gray-400">{r.email}</span>
                  </div>
                  <span className="text-xs text-gray-400">{new Date(r.updated_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="p-5 space-y-3 text-sm">
                  {questions.map((q) => {
                    const val = r.answers?.[q.id]
                    const why = q.follow_up ? r.answers?.[`${q.id}__why`] : null
                    if (!val && !why) return null
                    return (
                      <div key={q.id}>
                        {val && <Field label={q.label} value={val} />}
                        {why && <Field label={`↳ ${q.follow_up}`} value={why} />}
                      </div>
                    )
                  })}
                  {r.review_text && (
                    <div className="rounded-lg p-3 mt-1" style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)' }}>
                      <div className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: '#FF6B35' }}>Review</div>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{r.review_text}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{label}</div>
      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}
