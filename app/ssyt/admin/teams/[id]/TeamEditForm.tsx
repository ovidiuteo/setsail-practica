'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Check } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Team = any
type Boat = { id: string; name: string; model: string | null }
type ParticipantOption = { id: string; full_name: string; email: string }

export default function TeamEditForm({ team, allBoats, allParticipants }: {
  team: Team
  allBoats: Boat[]
  allParticipants: ParticipantOption[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: team.name || '',
    short_name: team.short_name || '',
    slug: team.slug || '',
    slogan: team.slogan || '',
    description: team.description || '',
    color_primary: team.color_primary || '#4A5568',
    color_secondary: team.color_secondary || '',
    boat_id: team.boat_id || '',
    skipper_id: team.skipper_id || '',
    status: team.status || 'active',
    display_order: team.display_order ?? 0,
  })

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const { error: err } = await supabase
      .from('ssyt_teams')
      .update({
        name: form.name,
        short_name: form.short_name || null,
        slug: form.slug || null,
        slogan: form.slogan || null,
        description: form.description || null,
        color_primary: form.color_primary || null,
        color_secondary: form.color_secondary || null,
        boat_id: form.boat_id || null,
        skipper_id: form.skipper_id || null,
        status: form.status,
        display_order: form.display_order,
      })
      .eq('id', team.id)

    setSaving(false)

    if (err) {
      setError(err.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {/* Nume + short name */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nume echipă" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Short name (afișare cards)">
          <input
            type="text"
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value })}
            placeholder="LIFE, DREAM..."
            className="input"
          />
        </Field>
      </div>

      {/* Slug + status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Slug URL (ex: life)">
          <input
            type="text"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
            className="input font-mono text-sm"
          />
        </Field>
        <Field label="Status">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            className="input"
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
            <option value="archived">archived</option>
          </select>
        </Field>
      </div>

      {/* Slogan + description */}
      <Field label="Slogan">
        <input
          type="text"
          value={form.slogan}
          onChange={(e) => setForm({ ...form, slogan: e.target.value })}
          placeholder='ex: "Live the wind"'
          className="input"
        />
      </Field>

      <Field label="Descriere">
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          rows={3}
          className="input"
        />
      </Field>

      {/* Culori */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Culoare principală">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color_primary}
              onChange={(e) => setForm({ ...form, color_primary: e.target.value })}
              className="h-9 w-14 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={form.color_primary}
              onChange={(e) => setForm({ ...form, color_primary: e.target.value })}
              className="input flex-1 font-mono text-sm"
            />
          </div>
        </Field>
        <Field label="Culoare secundară">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color_secondary || '#ffffff'}
              onChange={(e) => setForm({ ...form, color_secondary: e.target.value })}
              className="h-9 w-14 rounded border border-gray-300 cursor-pointer"
            />
            <input
              type="text"
              value={form.color_secondary}
              onChange={(e) => setForm({ ...form, color_secondary: e.target.value })}
              placeholder="opțional"
              className="input flex-1 font-mono text-sm"
            />
          </div>
        </Field>
      </div>

      {/* Boat + Skipper */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Ambarcațiune">
          <select
            value={form.boat_id}
            onChange={(e) => setForm({ ...form, boat_id: e.target.value })}
            className="input"
          >
            <option value="">— nicio selecție —</option>
            {allBoats.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.model ? `· ${b.model}` : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Skipper">
          <select
            value={form.skipper_id}
            onChange={(e) => setForm({ ...form, skipper_id: e.target.value })}
            className="input"
          >
            <option value="">— nicio selecție —</option>
            {allParticipants.map((p) => (
              <option key={p.id} value={p.id}>{p.full_name}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Ordine afișare">
        <input
          type="number"
          value={form.display_order}
          onChange={(e) => setForm({ ...form, display_order: Number(e.target.value) })}
          className="input w-24"
        />
      </Field>

      {/* Acțiuni */}
      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Salvează</>}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1 text-sm text-green-600">
            <Check size={14} /> Salvat
          </span>
        )}
        {error && <span className="text-sm text-red-600">Eroare: {error}</span>}
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