'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Plus, Trash2, Save, X, Edit2, Loader2, GripVertical, ArrowUp, ArrowDown } from 'lucide-react'

type Q = { id: string; position: number; label: string; qtype: 'text' | 'number'; max_value: number; active: boolean }

export const dynamic = 'force-dynamic'

export default function ReviewQuestionsAdmin() {
  const token = useSearchParams().get('token') || ''
  const [questions, setQuestions] = useState<Q[]>([])
  const [loading, setLoading] = useState(true)
  const [authErr, setAuthErr] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/ssyt/review-questions?token=${encodeURIComponent(token)}`)
    if (!res.ok) { setAuthErr(true); setLoading(false); return }
    const d = await res.json()
    setQuestions(d.questions || [])
    setAuthErr(false)
    setLoading(false)
  }, [token])

  useEffect(() => { if (token) load(); else { setAuthErr(true); setLoading(false) } }, [token, load])

  async function call(method: string, body: any) {
    setBusy(true)
    const res = await fetch('/api/ssyt/review-questions', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, ...body }),
    })
    setBusy(false)
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || 'Eroare'); return false }
    await load()
    return true
  }

  if (loading) return <div className="max-w-2xl mx-auto px-6 py-16 text-center text-gray-400">Se încarcă…</div>
  if (authErr) return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0a1628' }}>Acces restricționat</h1>
      <p className="text-gray-600">Link invalid sau token lipsă. Folosește linkul complet cu token din panoul admin.</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
      <h1 className="text-3xl font-semibold tracking-tight mb-1" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>Întrebări review</h1>
      <p className="text-sm text-gray-500 mb-6">Adaugă, modifică sau șterge întrebările din formularul de review. Tip <strong>text</strong> = casetă de răspuns; tip <strong>cifre</strong> = buline (1…N).</p>

      <div className="space-y-3 mb-6">
        {questions.map((q, i) => (
          <QuestionRow key={q.id} q={q} index={i} total={questions.length} busy={busy} onSave={call} />
        ))}
        {questions.length === 0 && <p className="text-sm text-gray-400 italic">Nicio întrebare. Adaugă prima mai jos.</p>}
      </div>

      <NewQuestion busy={busy} onSave={call} />
    </div>
  )
}

function QuestionRow({ q, index, total, busy, onSave }: { q: Q; index: number; total: number; busy: boolean; onSave: (m: string, b: any) => Promise<boolean> }) {
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState(q.label)
  const [qtype, setQtype] = useState<'text' | 'number'>(q.qtype)
  const [maxValue, setMaxValue] = useState(q.max_value)

  if (editing) {
    return (
      <div className="rounded-lg p-4" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
        <textarea value={label} onChange={(e) => setLabel(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-2" style={{ borderColor: '#d1d5db' }} />
        <div className="flex items-center gap-3 mb-3">
          <TypePicker qtype={qtype} setQtype={setQtype} />
          {qtype === 'number' && (
            <label className="text-sm text-gray-600 inline-flex items-center gap-1">
              până la
              <input type="number" min={2} max={10} value={maxValue} onChange={(e) => setMaxValue(parseInt(e.target.value, 10) || 5)} className="w-16 px-2 py-1 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
            </label>
          )}
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button onClick={() => { setEditing(false); setLabel(q.label); setQtype(q.qtype); setMaxValue(q.max_value) }} className="px-3 py-1.5 text-sm text-gray-600"><X size={14} className="inline mr-1" />Anulează</button>
          <button onClick={async () => { if (await onSave('PUT', { id: q.id, label, qtype, max_value: maxValue })) setEditing(false) }} disabled={busy || !label.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}><Save size={14} />Salvează</button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex flex-col gap-0.5 pt-0.5">
        <button disabled={index === 0 || busy} onClick={() => onSave('PUT', { id: q.id, position: q.position - 1 })} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp size={13} /></button>
        <button disabled={index === total - 1 || busy} onClick={() => onSave('PUT', { id: q.id, position: q.position + 1 })} className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown size={13} /></button>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium" style={{ color: '#0a1628' }}>{q.label}</div>
        <div className="text-[11px] text-gray-400 mt-0.5">
          {q.qtype === 'number' ? `cifre (buline 1–${q.max_value})` : 'text'}{!q.active && ' · inactivă'}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-gray-700 p-1"><Edit2 size={14} /></button>
        <button onClick={() => { if (confirm('Ștergi întrebarea?')) onSave('DELETE', { id: q.id }) }} disabled={busy} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
      </div>
    </div>
  )
}

function NewQuestion({ busy, onSave }: { busy: boolean; onSave: (m: string, b: any) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [qtype, setQtype] = useState<'text' | 'number'>('text')
  const [maxValue, setMaxValue] = useState(5)

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
        <Plus size={14} /> Adaugă întrebare
      </button>
    )
  }
  return (
    <div className="rounded-lg p-4" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
      <textarea value={label} onChange={(e) => setLabel(e.target.value)} rows={2} placeholder="Textul întrebării…" className="w-full px-3 py-2 border rounded-md text-sm mb-2" style={{ borderColor: '#d1d5db' }} autoFocus />
      <div className="flex items-center gap-3 mb-3">
        <TypePicker qtype={qtype} setQtype={setQtype} />
        {qtype === 'number' && (
          <label className="text-sm text-gray-600 inline-flex items-center gap-1">
            până la
            <input type="number" min={2} max={10} value={maxValue} onChange={(e) => setMaxValue(parseInt(e.target.value, 10) || 5)} className="w-16 px-2 py-1 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
          </label>
        )}
      </div>
      <div className="flex items-center gap-2 justify-end">
        <button onClick={() => { setOpen(false); setLabel('') }} className="px-3 py-1.5 text-sm text-gray-600"><X size={14} className="inline mr-1" />Anulează</button>
        <button onClick={async () => { if (await onSave('POST', { label, qtype, max_value: maxValue })) { setOpen(false); setLabel(''); setQtype('text'); setMaxValue(5) } }} disabled={busy || !label.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Adaugă
        </button>
      </div>
    </div>
  )
}

function TypePicker({ qtype, setQtype }: { qtype: 'text' | 'number'; setQtype: (t: 'text' | 'number') => void }) {
  return (
    <div className="inline-flex rounded-md overflow-hidden" style={{ border: '1px solid #d1d5db' }}>
      {(['text', 'number'] as const).map((t) => (
        <button key={t} onClick={() => setQtype(t)} className="px-3 py-1.5 text-sm font-medium"
          style={{ background: qtype === t ? '#FF6B35' : '#fff', color: qtype === t ? '#fff' : '#6B7280' }}>
          {t === 'text' ? 'Text' : 'Cifre'}
        </button>
      ))}
    </div>
  )
}
