'use client'
import { useState } from 'react'
import { Plus, Anchor, Trash2, X, Wind } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

const STATUS_OPTIONS = [
  { value: 'scheduled', label: 'programată' },
  { value: 'completed', label: 'finalizată' },
  { value: 'abandoned', label: 'abandonată' },
  { value: 'postponed', label: 'amânată' },
]

const STATUS_COLORS: Record<string, string> = {
  scheduled: '#3B82F6',
  completed: '#10B981',
  abandoned: '#EF4444',
  postponed: '#F59E0B',
}

export default function RacesTab({ regattaId, races, onChange }: { regattaId: string; races: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_races').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi această cursă? Rezultatele asociate vor fi șterse și ele.')) return
    const { error } = await supabase.from('ssyt_races').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{races.length} curse înregistrate</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă cursă
        </button>
      </div>

      {showNew && <NewRaceForm regattaId={regattaId} nextNumber={(races.length || 0) + 1} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

      {races.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Anchor size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio cursă programată.</p>
          <p className="text-xs text-gray-400 mt-1">O regatta poate avea 1+ curse (Race 1, Race 2...).</p>
        </div>
      ) : (
        <div className="space-y-3">
          {races.map((r) => (
            <div key={r.id} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-md flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: '#0a1628' }}>
                  R{r.race_number}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-baseline gap-3 mb-2">
                    <div className="font-semibold" style={{ color: '#0a1628' }}>
                      <EditableField value={r.name} onSave={(v) => updateField(r.id, 'name', v)} placeholder={`Race ${r.race_number}`} />
                    </div>
                    <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{
                      background: `${STATUS_COLORS[r.status]}15`,
                      color: STATUS_COLORS[r.status],
                    }}>
                      <EditableField value={r.status} onSave={(v) => updateField(r.id, 'status', v)} type="select" options={STATUS_OPTIONS} formatDisplay={(v) => STATUS_OPTIONS.find(o => o.value === v)?.label || String(v)} />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <Field label="Tip">
                      <EditableField value={r.race_type} onSave={(v) => updateField(r.id, 'race_type', v)} placeholder="inshore / coastal" />
                    </Field>
                    <Field label="Start time">
                      <EditableField value={r.start_time} onSave={(v) => updateField(r.id, 'start_time', v)} placeholder="ISO" />
                    </Field>
                    <Field label={<><Wind size={10} className="inline" /> Vânt (kts)</>}>
                      <EditableField value={r.wind_speed_knots} onSave={(v) => updateField(r.id, 'wind_speed_knots', v)} type="number" placeholder="—" />
                    </Field>
                    <Field label="Direcție vânt">
                      <EditableField value={r.wind_direction} onSave={(v) => updateField(r.id, 'wind_direction', v)} placeholder="ex: NE 045°" />
                    </Field>
                  </div>

                  <div className="mt-3 text-xs">
                    <div className="text-gray-400 mb-1">Descriere parcurs</div>
                    <EditableField
                      value={r.course_description}
                      onSave={(v) => updateField(r.id, 'course_description', v)}
                      placeholder="Descriere parcurs..."
                      type="textarea"
                      multiline
                      displayClassName="text-gray-700"
                    />
                  </div>

                  <div className="mt-2 text-xs">
                    <div className="text-gray-400 mb-1">Note</div>
                    <EditableField
                      value={r.notes}
                      onSave={(v) => updateField(r.id, 'notes', v)}
                      placeholder="Note..."
                      type="textarea"
                      multiline
                      displayClassName="text-gray-600"
                    />
                  </div>
                </div>

                <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-600 p-1 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewRaceForm({ regattaId, nextNumber, onClose, onSaved }: { regattaId: string; nextNumber: number; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ race_number: nextNumber, name: '', race_type: 'inshore', course_description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_races').insert({
      regatta_id: regattaId,
      race_number: form.race_number,
      name: form.name || `Race ${form.race_number}`,
      race_type: form.race_type || null,
      course_description: form.course_description || null,
      status: 'scheduled',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Cursă nouă</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Nr. cursă</label>
          <input type="number" min={1} value={form.race_number} onChange={(e) => setForm({ ...form, race_number: Number(e.target.value) })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Nume (opțional)</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={`Race ${form.race_number}`} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      </div>
      <div className="mb-3">
        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Tip</label>
        <select value={form.race_type} onChange={(e) => setForm({ ...form, race_type: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
          <option value="inshore">inshore</option>
          <option value="coastal">coastal</option>
          <option value="offshore">offshore</option>
          <option value="practice">practice</option>
        </select>
      </div>
      <textarea placeholder="Descriere parcurs (opțional)" value={form.course_description} onChange={(e) => setForm({ ...form, course_description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
      {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
    </div>
  )
}

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-gray-400 mb-0.5">{label}</div>
      <div style={{ color: '#0a1628' }}>{children}</div>
    </div>
  )
}