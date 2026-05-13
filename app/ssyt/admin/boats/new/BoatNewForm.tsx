'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

const BENETEAU_347_SPECS = {
  designer: 'Farr Yacht Design',
  builder: 'Bénéteau',
  country: 'France',
  year_first_built: 2005,
  year_last_built: 2009,
  hulls_built: 125,
  hull_type: 'monohull',
  construction: 'GRP - glassfibre / balsa sandwich deck',
  loa_m: 9.98,
  lwl_m: 8.74,
  beam_m: 3.38,
  draft_m: 2.01,
  displacement_kg: 4520,
  ballast_kg: 1670,
  keel_type: 'Fin keel with weighted bulb (T-shaped, deep draft)',
  rudder_type: 'Spade-type rudder',
  rig_type: 'Bermuda rig',
  sailplan: 'Fractional rigged sloop',
  i_height_m: 13.18,
  j_base_m: 3.68,
  p_main_luff_m: 12.80,
  e_main_foot_m: 4.54,
  mainsail_area_m2: 35.0,
  jib_area_m2: 35.0,
  upwind_sail_area_m2: 70.3,
  engine_make: 'Yanmar',
  engine_hp: 21,
  engine_type: 'Diesel inboard',
  description: "Cruiser-racer 32'10\" (9.99m) proiectat de Farr Yacht Design. Versiunea Deep Draft are chila in T pentru performanta sporita la upwind. Cunoscut si ca First 10R sau Beneteau 34.7.",
  source_url: 'https://sailboatdata.com/sailboat/beneteau-347/',
}

export default function BoatNewForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    name: '',
    model: 'Beneteau First 34.7',
    sail_number: '',
    hull_color: '',
    capacity: 10,
    notes: '',
    is_active: true,
    populate_specs: true,
  })

  const isFarr347 = form.model.toLowerCase().includes('first 34.7') || form.model.toLowerCase().includes('34.7')

  async function save() {
    setError(null)
    if (!form.name.trim()) {
      setError('Numele ambarcațiunii este obligatoriu.')
      return
    }
    setSaving(true)

    const { data: boat, error: err } = await supabase
      .from('ssyt_boats')
      .insert({
        name: form.name.trim(),
        model: form.model.trim() || null,
        sail_number: form.sail_number.trim() || null,
        hull_color: form.hull_color.trim() || null,
        capacity: form.capacity,
        notes: form.notes.trim() || null,
        is_active: form.is_active,
      })
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }

    // Daca e Beneteau First 34.7 si populate_specs e ON, adaug specs
    if (boat && form.populate_specs && isFarr347) {
      await supabase.from('ssyt_boat_specs').insert({
        boat_id: boat.id,
        ...BENETEAU_347_SPECS,
      })
    }

    router.push(`/ssyt/admin/boats/${boat.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <Field label="Nume" required>
        <input
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="LIFE, DREAM, FLY, ABRACADABRA..."
          className="input"
          autoFocus
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Model">
          <input
            type="text"
            value={form.model}
            onChange={(e) => setForm({ ...form, model: e.target.value })}
            className="input"
          />
        </Field>
        <Field label="Sail number">
          <input
            type="text"
            value={form.sail_number}
            onChange={(e) => setForm({ ...form, sail_number: e.target.value })}
            className="input font-mono"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Culoare cocă">
          <input
            type="text"
            value={form.hull_color}
            onChange={(e) => setForm({ ...form, hull_color: e.target.value })}
            placeholder="ex: alb, navy"
            className="input"
          />
        </Field>
        <Field label="Capacitate (persoane)">
          <input
            type="number"
            value={form.capacity}
            onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })}
            className="input"
          />
        </Field>
      </div>

      <Field label="Note">
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          className="input"
        />
      </Field>

      <label className="inline-flex items-center gap-2 text-sm cursor-pointer pt-2">
        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
        <span className="text-gray-700">Ambarcațiune activă (disponibilă pentru alocare la echipe)</span>
      </label>

      {/* Auto-populate specs */}
      {isFarr347 && (
        <div className="rounded-lg p-4 mt-3" style={{ background: 'rgba(255,107,53,0.08)', border: '1px solid rgba(255,107,53,0.2)' }}>
          <label className="inline-flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.populate_specs}
              onChange={(e) => setForm({ ...form, populate_specs: e.target.checked })}
              className="mt-0.5"
            />
            <div>
              <div className="text-sm font-medium inline-flex items-center gap-1.5" style={{ color: '#FF6B35' }}>
                <Sparkles size={14} /> Populează automat date tehnice Beneteau First 34.7
              </div>
              <div className="text-xs text-gray-600 mt-1">
                LOA 9.98m · Beam 3.38m · Displacement 4520kg · Designer Farr Yacht Design · Engine Yanmar 21HP și restul. Le poți edita ulterior din pagina detalii.
              </div>
            </div>
          </label>
        </div>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Creează ambarcațiune</>}
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
