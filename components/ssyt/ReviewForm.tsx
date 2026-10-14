'use client'
import { useState } from 'react'
import { Send, Loader2, CheckCircle2, Star } from 'lucide-react'

export type ReviewQuestion = {
  id: string
  section: string | null
  label: string
  qtype: 'text' | 'number' | 'stars' | 'choice'
  max_value: number
  options: any | null // choice: string[]; stars: {low,high}
  follow_up: string | null
}

type Initial = {
  review_text?: string | null
  answers?: Record<string, string> | null
}

export default function ReviewForm({ email, questions, initial }: { email: string; questions: ReviewQuestion[]; initial?: Initial }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(initial?.answers || {}) }))
  const [reviewText, setReviewText] = useState(initial?.review_text || '')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }))

  async function submit() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/ssyt/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, review_text: reviewText, answers }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Eroare la trimitere.')
      return
    }
    setDone(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (done) {
    return (
      <div className="rounded-xl p-10 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#10B981' }} />
        <h2 className="text-lg font-semibold" style={{ color: '#0a1628' }}>Mulțumim! Răspunsurile au fost trimise.</h2>
        <p className="text-sm text-gray-500 mt-1">Poți închide pagina. Keep on sailing! ⛵</p>
      </div>
    )
  }

  const cardStyle = { background: '#fff', border: '1px solid #e5e7eb' } as const
  const taCls = 'w-full px-3 py-2 border rounded-md text-sm resize-y'

  let lastSection: string | null = null

  return (
    <div className="space-y-5">
      {questions.map((q, i) => {
        const showSection = q.section && q.section !== lastSection
        if (q.section) lastSection = q.section
        return (
          <div key={q.id}>
            {showSection && (
              <h2 className="text-base font-semibold mt-4 mb-2" style={{ color: '#0a1628' }}>{q.section}</h2>
            )}
            <div className="rounded-lg p-5" style={cardStyle}>
              <label className="block text-sm font-medium mb-3" style={{ color: '#0a1628' }}>{i + 1}. {q.label}</label>

              {q.qtype === 'text' && (
                <textarea value={answers[q.id] || ''} onChange={(e) => set(q.id, e.target.value)} rows={3} className={taCls} style={{ borderColor: '#d1d5db' }} />
              )}

              {q.qtype === 'number' && (
                <Circles value={answers[q.id] || ''} max={q.max_value || 5} onChange={(v) => set(q.id, v)} allowEmpty />
              )}

              {q.qtype === 'stars' && (
                <Stars value={answers[q.id] || ''} onChange={(v) => set(q.id, v)} low={q.options?.low} high={q.options?.high} />
              )}

              {q.qtype === 'choice' && (
                <>
                  <Choices value={answers[q.id] || ''} options={Array.isArray(q.options) ? q.options : []} onChange={(v) => set(q.id, v)} />
                  {q.follow_up && (
                    <div className="mt-3">
                      <span className="block text-xs text-gray-500 mb-1">{q.follow_up}</span>
                      <textarea value={answers[`${q.id}__why`] || ''} onChange={(e) => set(`${q.id}__why`, e.target.value)} rows={2} className={taCls} style={{ borderColor: '#d1d5db' }} />
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )
      })}

      {/* Review liber */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
        <label className="block text-sm font-medium mb-2" style={{ color: '#FF6B35' }}>Review (recomandare / testimonial)</label>
        <p className="text-xs text-gray-500 mb-2">Un gând liber despre SSYT 2026 — îl putem folosi ca testimonial.</p>
        <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={5} className={taCls} style={{ borderColor: '#d1d5db' }} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={submit} disabled={saving} className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {saving ? 'Se trimite...' : 'Trimite răspunsurile'}
      </button>
    </div>
  )
}

function Circles({ value, max, onChange, allowEmpty }: { value: string; max: number; onChange: (v: string) => void; allowEmpty?: boolean }) {
  const nums = Array.from({ length: max }, (_, i) => String(i + 1))
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {nums.map((nn) => {
        const active = value === nn
        return (
          <button key={nn} type="button" onClick={() => onChange(allowEmpty && active ? '' : nn)}
            className="w-10 h-10 rounded-full font-semibold transition flex items-center justify-center"
            style={{ background: active ? '#FF6B35' : '#fff', color: active ? '#fff' : '#6B7280', border: `2px solid ${active ? '#FF6B35' : '#d1d5db'}` }}
            aria-pressed={active}>
            {nn}
          </button>
        )
      })}
    </div>
  )
}

function Stars({ value, onChange, low, high }: { value: string; onChange: (v: string) => void; low?: string; high?: string }) {
  const sel = parseInt(value, 10) || 0
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" onClick={() => onChange(sel === n ? '' : String(n))} title={`${n}`} className="p-0.5 transition hover:scale-110">
            <Star size={30} style={{ color: n <= sel ? '#F5B301' : '#D1D5DB', fill: n <= sel ? '#FCC419' : 'transparent' }} />
          </button>
        ))}
      </div>
      {(low || high) && (
        <div className="flex justify-between text-[11px] text-gray-400 mt-1" style={{ maxWidth: 190 }}>
          <span>1 – {low}</span>
          <span>5 – {high}</span>
        </div>
      )}
    </div>
  )
}

function Choices({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt
        return (
          <button key={opt} type="button" onClick={() => onChange(active ? '' : opt)}
            className="px-4 py-2 rounded-full text-sm font-medium transition"
            style={{ background: active ? '#FF6B35' : '#fff', color: active ? '#fff' : '#374151', border: `1.5px solid ${active ? '#FF6B35' : '#d1d5db'}` }}
            aria-pressed={active}>
            {opt}
          </button>
        )
      })}
    </div>
  )
}
