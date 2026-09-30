'use client'
import { useState } from 'react'
import { Send, Loader2, CheckCircle2 } from 'lucide-react'

type Initial = {
  regattas_count?: string | null
  training_count?: string | null
  q_experienta?: string | null
  q_placut_schimbat?: string | null
  q_echipa?: string | null
  review_text?: string | null
}

export default function ReviewForm({ email, initial }: { email: string; initial?: Initial }) {
  const [form, setForm] = useState({
    regattas_count: initial?.regattas_count || '1',
    training_yes: initial?.training_count === 'Da',
    q_experienta: initial?.q_experienta || '',
    q_placut_schimbat: initial?.q_placut_schimbat || '',
    q_echipa: initial?.q_echipa || '',
    review_text: initial?.review_text || '',
  })
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit() {
    setSaving(true)
    setError(null)
    const { training_yes, ...rest } = form
    const res = await fetch('/api/ssyt/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, ...rest, training_count: training_yes ? 'Da' : 'Nu' }),
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

  const labelCls = 'block text-sm font-medium mb-2'
  const inputCls = 'w-full px-3 py-2 border rounded-md text-sm'
  const taCls = 'w-full px-3 py-2 border rounded-md text-sm resize-y'

  return (
    <div className="space-y-5">
      {/* Q1 */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <label className={labelCls} style={{ color: '#0a1628' }}>1. La câte regate ai participat? Dar la antrenamente?</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
          <div>
            <span className="block text-xs text-gray-500 mb-1">Regate</span>
            <div className="flex items-center gap-2">
              {['1', '2', '3', '4', '5'].map((n) => {
                const active = form.regattas_count === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, regattas_count: n }))}
                    className="w-10 h-10 rounded-full font-semibold transition flex items-center justify-center"
                    style={{
                      background: active ? '#FF6B35' : '#fff',
                      color: active ? '#fff' : '#6B7280',
                      border: `2px solid ${active ? '#FF6B35' : '#d1d5db'}`,
                    }}
                    aria-pressed={active}
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <span className="block text-xs text-gray-500 mb-1">Antrenamente</span>
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md text-sm cursor-pointer select-none" style={{ borderColor: '#d1d5db' }}>
              <input
                type="checkbox"
                checked={form.training_yes}
                onChange={(e) => setForm((f) => ({ ...f, training_yes: e.target.checked }))}
                className="w-4 h-4 accent-[#FF6B35]"
              />
              <span>{form.training_yes ? 'Da, am participat' : 'Nu am participat'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Q2 */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <label className={labelCls} style={{ color: '#0a1628' }}>2. Cum a fost experiența generală? (poți da și o notă de la 1 la 5)</label>
        <textarea value={form.q_experienta} onChange={set('q_experienta')} rows={3} className={taCls} style={{ borderColor: '#d1d5db' }} />
      </div>

      {/* Q3 */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <label className={labelCls} style={{ color: '#0a1628' }}>3. Ce ți-a plăcut cel mai mult și ce ai schimba?</label>
        <textarea value={form.q_placut_schimbat} onChange={set('q_placut_schimbat')} rows={3} className={taCls} style={{ borderColor: '#d1d5db' }} />
      </div>

      {/* Q4 */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <label className={labelCls} style={{ color: '#0a1628' }}>4. Cum a fost colaborarea în echipă (skipper + crew)?</label>
        <textarea value={form.q_echipa} onChange={set('q_echipa')} rows={3} className={taCls} style={{ borderColor: '#d1d5db' }} />
      </div>

      {/* Review liber */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
        <label className={labelCls} style={{ color: '#FF6B35' }}>Review (recomandare / testimonial)</label>
        <p className="text-xs text-gray-500 mb-2">Un gând liber despre SSYT 2026 — îl putem folosi ca testimonial.</p>
        <textarea value={form.review_text} onChange={set('review_text')} rows={5} className={taCls} style={{ borderColor: '#d1d5db' }} />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button onClick={submit} disabled={saving}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white disabled:opacity-50"
        style={{ background: '#FF6B35' }}>
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        {saving ? 'Se trimite...' : 'Trimite răspunsurile'}
      </button>
    </div>
  )
}
