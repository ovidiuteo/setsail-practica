'use client'
import { useState } from 'react'
import { Plus, Wrench, X, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

const STATUS_OPTIONS = [
  { value: 'ok', label: 'OK' },
  { value: 'needs_check', label: 'Necesită verificare' },
  { value: 'needs_repair', label: 'Necesită reparație' },
  { value: 'broken', label: 'Defect' },
  { value: 'missing', label: 'Lipsă' },
]

const STATUS_COLORS: Record<string, string> = {
  ok: '#10B981',
  needs_check: '#F59E0B',
  needs_repair: '#FB923C',
  broken: '#EF4444',
  missing: '#6B7280',
}

export default function EquipmentTab({ boatId, equipment, onChange }: { boatId: string; equipment: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_equipment').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest echipament?')) return
    const { error } = await supabase.from('ssyt_boat_equipment').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-gray-500">{equipment.length} echipamente înregistrate</p>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} /> Adaugă echipament
        </button>
      </div>

      {showNew && (
        <NewEquipmentForm boatId={boatId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />
      )}

      {equipment.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Wrench size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun echipament înregistrat.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {equipment.map((eq) => (
            <div key={eq.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="flex">
                {/* Photo */}
                <div className="w-28 h-28 flex-shrink-0 bg-gray-100 flex items-center justify-center">
                  {eq.photo_url ? (
                    <img src={eq.photo_url} alt={eq.name} className="w-full h-full object-cover" />
                  ) : (
                    <Wrench size={22} className="text-gray-300" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 p-3 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm leading-tight" style={{ color: '#0a1628' }}>
                        <EditableField value={eq.name} onSave={(v) => updateField(eq.id, 'name', v)} placeholder="Nume echipament" />
                      </div>
                      <div className="text-xs text-gray-500 font-mono mt-0.5">
                        <span className="text-gray-400">cod:</span> <EditableField value={eq.code} onSave={(v) => updateField(eq.id, 'code', v)} placeholder="ex: GN-001" />
                      </div>
                    </div>
                    <button onClick={() => remove(eq.id)} className="text-gray-300 hover:text-red-600 p-1 flex-shrink-0">
                      <Trash2 size={12} />
                    </button>
                  </div>

                  <div className="text-xs text-gray-600 mb-2 line-clamp-2">
                    <EditableField
                      value={eq.description}
                      onSave={(v) => updateField(eq.id, 'description', v)}
                      placeholder="Descriere..."
                      type="textarea"
                      multiline
                    />
                  </div>

                  <div className="flex items-center gap-2 text-xs">
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{
                      background: `${STATUS_COLORS[eq.status] || '#6B7280'}15`,
                      color: STATUS_COLORS[eq.status] || '#6B7280',
                    }}>
                      <EditableField
                        value={eq.status}
                        onSave={(v) => updateField(eq.id, 'status', v)}
                        type="select"
                        options={STATUS_OPTIONS}
                        formatDisplay={(v) => STATUS_OPTIONS.find((o) => o.value === v)?.label || String(v)}
                      />
                    </span>
                    <span className="text-gray-400">·</span>
                    <span className="text-gray-500">
                      <EditableField value={eq.location_on_boat} onSave={(v) => updateField(eq.id, 'location_on_boat', v)} placeholder="Locație" />
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t text-xs text-gray-500" style={{ borderColor: '#f3f4f6' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Foto URL:</span>
                      <EditableField value={eq.photo_url} onSave={(v) => updateField(eq.id, 'photo_url', v)} placeholder="https://..." type="url" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewEquipmentForm({ boatId, onClose, onSaved }: { boatId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', code: '', category: '', description: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_boat_equipment').insert({
      boat_id: boatId,
      name: form.name,
      code: form.code || null,
      category: form.category || null,
      description: form.description || null,
      status: 'ok',
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Echipament nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <input placeholder="Nume *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
        <input placeholder="Cod (ex: GN-001)" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="px-3 py-2 border rounded-md text-sm font-mono" />
        <input placeholder="Categorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
      </div>
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving || !form.name.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
