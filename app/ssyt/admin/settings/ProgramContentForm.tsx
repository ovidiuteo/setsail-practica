'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Check } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export default function ProgramContentForm({ seasonId, initial }: { seasonId: string; initial: any }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    hero_title: initial?.hero_title || '',
    hero_subtitle: initial?.hero_subtitle || '',
    intro: initial?.intro || '',
    format_description: initial?.format_description || '',
    who_should_apply: initial?.who_should_apply || '',
    what_you_get: initial?.what_you_get || '',
    requirements: initial?.requirements || '',
    pricing_info: initial?.pricing_info || '',
  })

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const payload = {
      season_id: seasonId,
      hero_title: form.hero_title || null,
      hero_subtitle: form.hero_subtitle || null,
      intro: form.intro || null,
      format_description: form.format_description || null,
      who_should_apply: form.who_should_apply || null,
      what_you_get: form.what_you_get || null,
      requirements: form.requirements || null,
      pricing_info: form.pricing_info || null,
    }

    let err: any
    if (initial?.id) {
      const r = await supabase.from('ssyt_program_content').update(payload).eq('id', initial.id)
      err = r.error
    } else {
      const r = await supabase.from('ssyt_program_content').insert(payload)
      err = r.error
    }

    setSaving(false)
    if (err) { setError(err.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md p-3 text-xs" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        💡 Folosește <code className="bg-white px-1 rounded">**text**</code> pentru bold și <code className="bg-white px-1 rounded">- item</code> la început de linie pentru bullet-uri.
      </div>

      <Field label="Hero — Titlu mare">
        <input type="text" value={form.hero_title} onChange={(e) => setForm({ ...form, hero_title: e.target.value })} className="input" placeholder="ex: SSYT 2026 - Racing League" />
      </Field>

      <Field label="Hero — Subtitlu">
        <input type="text" value={form.hero_subtitle} onChange={(e) => setForm({ ...form, hero_subtitle: e.target.value })} className="input" placeholder="ex: 4 Teams. 5 Regattas. 1 Racing Season." />
      </Field>

      <Field label="Intro (despre program)">
        <textarea value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} rows={4} className="input" />
      </Field>

      <Field label="Format sezon">
        <textarea value={form.format_description} onChange={(e) => setForm({ ...form, format_description: e.target.value })} rows={6} className="input" />
      </Field>

      <Field label="Pentru cine este SSYT">
        <textarea value={form.who_should_apply} onChange={(e) => setForm({ ...form, who_should_apply: e.target.value })} rows={4} className="input" />
      </Field>

      <Field label="Ce primești (beneficii)">
        <textarea value={form.what_you_get} onChange={(e) => setForm({ ...form, what_you_get: e.target.value })} rows={4} className="input" />
      </Field>

      <Field label="Cerințe">
        <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={4} className="input" />
      </Field>

      <Field label="Cost / pricing (opțional)">
        <textarea value={form.pricing_info} onChange={(e) => setForm({ ...form, pricing_info: e.target.value })} rows={3} className="input" placeholder="Lasă gol dacă nu vrei să apară secțiunea Cost." />
      </Field>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Salvează</>}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Check size={14} /> Salvat</span>}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: #fff;
          color: #0a1628;
          transition: border-color 0.15s;
        }
        .input:focus {
          outline: none;
          border-color: #FF6B35;
          box-shadow: 0 0 0 2px rgba(255,107,53,0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">{label}</label>
      {children}
    </div>
  )
}