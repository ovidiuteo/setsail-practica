'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export default function RegattaNewForm({ seasonId }: { seasonId: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<{
    name: string
    short_name: string
    slug: string
    event_type: string
    location: string
    marina: string
    start_date: string
    end_date: string
    description: string
    expected_races: number
    status: string
    visibility: string
    points_multiplier: number
  }>({
    name: '',
    short_name: '',
    slug: '',
    event_type: 'regatta',
    location: '',
    marina: '',
    start_date: '',
    end_date: '',
    description: '',
    expected_races: 1,
    status: 'upcoming',
    visibility: 'public',
    points_multiplier: 1.0,
  })

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function save() {
    setError(null)
    if (!form.name.trim() || !form.start_date) {
      setError('Numele și data de început sunt obligatorii.')
      return
    }
    const finalSlug = form.slug.trim() || slugify(form.short_name || form.name)

    setSaving(true)
    const { data: regatta, error: err } = await supabase
      .from('ssyt_regattas')
      .insert({
        season_id: seasonId,
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        slug: finalSlug,
        event_type: form.event_type,
        location: form.location.trim() || null,
        marina: form.marina.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date || null,
        description: form.description.trim() || null,
        expected_races: form.expected_races,
        status: form.status,
        visibility: form.visibility,
        points_multiplier: form.points_multiplier,
      })
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }

    router.push(`/ssyt/admin/regattas/${regatta.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nume" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              const v = e.target.value
              setForm({ ...form, name: v, slug: form.slug || slugify(form.short_name || v) })
            }}
            placeholder="Cupa Mării Negre 2026"
            className="input"
            autoFocus
          />
        </Field>
        <Field label="Short name">
          <input
            type="text"
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value, slug: form.slug || slugify(e.target.value || form.name) })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Slug URL">
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
          className="input font-mono text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Field label="Tip eveniment">
          <select value={form.event_type} onChange={(e) => setForm({ ...form, event_type: e.target.value })} className="input">
            <option value="regatta">regatta</option>
            <option value="training">training</option>
            <option value="briefing">briefing</option>
            <option value="social">social</option>
          </select>
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
            <option value="draft">draft</option>
            <option value="upcoming">upcoming</option>
            <option value="live">live</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
          </select>
        </Field>
        <Field label="Vizibilitate">
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="input">
            <option value="public">public</option>
            <option value="members">members</option>
            <option value="admin">admin</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Data început" required>
          <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="input" />
        </Field>
        <Field label="Data sfârșit">
          <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Locație">
          <input type="text" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="ex: Mamaia, Constanța" className="input" />
        </Field>
        <Field label="Marina">
          <input type="text" value={form.marina} onChange={(e) => setForm({ ...form, marina: e.target.value })} placeholder="ex: Marina Mamaia" className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Curse planificate">
          <input type="number" min={1} value={form.expected_races} onChange={(e) => setForm({ ...form, expected_races: Number(e.target.value) })} className="input w-24" />
        </Field>
        <Field label="Multiplicator puncte sezon">
          <input type="number" step="0.1" min={0} value={form.points_multiplier} onChange={(e) => setForm({ ...form, points_multiplier: Number(e.target.value) })} className="input w-24" />
        </Field>
      </div>

      <Field label="Descriere">
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="input" />
      </Field>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Creează regatta</>}
        </button>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">
          Anulează
        </button>
        {error && <span className="text-sm text-red-600 ml-auto">{error}</span>}
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

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}