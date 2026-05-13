'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type BoatOption = { id: string; name: string; model: string | null }
type ParticipantOption = { id: string; full_name: string }

export default function TeamNewForm({
  seasonId,
  availableBoats,
  allBoats,
  participants,
}: {
  seasonId: string
  availableBoats: BoatOption[]
  allBoats: BoatOption[]
  participants: ParticipantOption[]
}) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAllBoats, setShowAllBoats] = useState(false)

  const [form, setForm] = useState({
    name: '',
    short_name: '',
    slug: '',
    slogan: '',
    description: '',
    color_primary: '#4A5568',
    color_secondary: '',
    boat_id: '',
    skipper_id: '',
    display_order: 0,
  })

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  }

  async function save() {
    setError(null)
    if (!form.name.trim()) {
      setError('Numele echipei este obligatoriu.')
      return
    }
    const finalSlug = form.slug.trim() || slugify(form.short_name || form.name)

    setSaving(true)
    const { data: team, error: err } = await supabase
      .from('ssyt_teams')
      .insert({
        season_id: seasonId,
        name: form.name.trim(),
        short_name: form.short_name.trim() || null,
        slug: finalSlug,
        slogan: form.slogan.trim() || null,
        description: form.description.trim() || null,
        color_primary: form.color_primary,
        color_secondary: form.color_secondary || null,
        boat_id: form.boat_id || null,
        skipper_id: form.skipper_id || null,
        display_order: form.display_order,
        status: 'active',
      })
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }

    // Daca am asignat un skipper, il adaug si ca membru core
    if (form.skipper_id && team) {
      await supabase.from('ssyt_team_memberships').insert({
        team_id: team.id,
        participant_id: form.skipper_id,
        membership_type: 'core',
        status: 'active',
      })
    }

    router.push(`/ssyt/admin/teams/${team.id}`)
    router.refresh()
  }

  const boatsToShow = showAllBoats ? allBoats : availableBoats
  const hiddenCount = allBoats.length - availableBoats.length

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nume echipă" required>
          <input
            type="text"
            value={form.name}
            onChange={(e) => {
              const v = e.target.value
              setForm({ ...form, name: v, slug: form.slug || slugify(form.short_name || v) })
            }}
            placeholder="Team LIFE, Team FLY..."
            className="input"
            autoFocus
          />
        </Field>
        <Field label="Short name">
          <input
            type="text"
            value={form.short_name}
            onChange={(e) => setForm({ ...form, short_name: e.target.value, slug: form.slug || slugify(e.target.value || form.name) })}
            placeholder="LIFE, FLY..."
            className="input"
          />
        </Field>
      </div>

      <Field label="Slug URL">
        <input
          type="text"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
          placeholder="se generează automat"
          className="input font-mono text-sm"
        />
      </Field>

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Ambarcațiune">
          <select
            value={form.boat_id}
            onChange={(e) => setForm({ ...form, boat_id: e.target.value })}
            className="input"
          >
            <option value="">— fără ambarcațiune —</option>
            {boatsToShow.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} {b.model ? `· ${b.model}` : ''}
              </option>
            ))}
          </select>
          {hiddenCount > 0 && !showAllBoats && (
            <button
              type="button"
              onClick={() => setShowAllBoats(true)}
              className="mt-1 text-xs text-gray-500 hover:text-gray-900 inline-flex items-center gap-1"
            >
              <AlertCircle size={11} /> {hiddenCount} {hiddenCount === 1 ? 'ambarcațiune ascunsă' : 'ambarcațiuni ascunse'} (deja alocate). Arată toate.
            </button>
          )}
        </Field>
        <Field label="Skipper">
          <select
            value={form.skipper_id}
            onChange={(e) => setForm({ ...form, skipper_id: e.target.value })}
            className="input"
          >
            <option value="">— fără skipper —</option>
            {participants.map((p) => (
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

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Creează echipă</>}
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
