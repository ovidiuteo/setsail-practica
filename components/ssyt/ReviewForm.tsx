'use client'
import { useState } from 'react'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'

export type ReviewQuestion = { id: string; label: string; qtype: 'text' | 'number'; max_value: number }

type Initial = {
  regattas_count?: string | null
  training_count?: string | null
  review_text?: string | null
  answers?: Record<string, string> | null
}

export default function ReviewForm({ email, questions, initial }: { email: string; questions: ReviewQuestion[]; initial?: Initial }) {
  const [regattas, setRegattas] = useState(initial?.regattas_count || '1')
  const [trainingYes, setTrainingYes] = useState(initial?.training_count === 'Da')
  const [reviewText, setReviewText] = useState(initial?.review_text || '')
  const [answers, setAnswers] = useState<Record<string, string>>(() => ({ ...(initial?.answers || {}) }))
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setAnswer(id: string, v: string) {
    setAnswers((a) => ({ ...a, [id]: v }))
  }

  async function submit() {
    setSaving(true)
    setError(null)
    const res = await fetch('/api/ssyt/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        regattas_count: regattas,
        training_count: trainingYes ? 'Da' : 'Nu',
        review_text: reviewText,
        answers,
      }),
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
        <p className="text-sm text-gray-500 mt-1">Poți închide pagina. Fair Winds Always! ⛵</p>
      </div>
    )
  }

  const cardCls = 'rounded-lg p-5'
  const cardStyle = { background: '#fff', border: '1px solid #e5e7eb' } as const
  const labelCls = 'block text-sm font-medium mb-2'
  const taCls = 'w-full px-3 py-2 border rounded-md text-sm resize-y'

  let n = 1

  return (
    <div className="space-y-5">
      {/* Q1 fix: regate + antrenamente */}
      <div className={cardCls} style={cardStyle}>
        <label className={labelCls} style={{ color: '#0a1628' }}>{n++}. La câte regate ai participat? Dar la antrenamente?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Regate</span>
            <Circles value={regattas} max={5} onChange={setRegattas} />
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Antrenamente</span>
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer select-none" style={{ borderColor: '#d1d5db' }}>
              <input type="checkbox" checked={trainingYes} onChange={(e) => setTrainingYes(e.target.checked)} className="w-4 h-4 accent-[#FF6B35]" />
              <span>{trainingYes ? 'Da, am participat' : 'Nu am participat'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Întrebări dinamice */}
      {questions.map((q) => (
        <div key={q.id} className={cardCls} style={cardStyle}>
          <label className={labelCls} style={{ color: '#0a1628' }}>{n++}. {q.label}</label>
          {q.qtype === 'number' ? (
            <Circles value={answers[q.id] || ''} max={q.max_value} onChange={(v) => setAnswer(q.id, v)} allowEmpty />
          ) : (
            <textarea value={answers[q.id] || ''} onChange={(e) => setAnswer(q.id, e.target.value)} rows={3} className={taCls} style={{ borderColor: '#d1d5db' }} />
          )}
        </div>
      ))}

      {/* Review liber */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
        <label className={labelCls} style={{ color: '#FF6B35' }}>Review (recomandare / testimonial)</label>
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
          <button
            key={nn}
            type="button"
            onClick={() => onChange(allowEmpty && active ? '' : nn)}
            className="w-10 h-10 rounded-full font-semibold transition flex items-center justify-center"
            style={{
              background: active ? '#FF6B35' : '#fff',
              color: active ? '#fff' : '#6B7280',
              border: `2px solid ${active ? '#FF6B35' : '#d1d5db'}`,
            }}
            aria-pressed={active}
          >
            {nn}
          </button>
        )
      })}
    </div>
  )
}
