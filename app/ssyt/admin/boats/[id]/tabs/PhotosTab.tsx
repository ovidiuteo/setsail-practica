'use client'
import { useState } from 'react'
import { Plus, Image as ImageIcon, Trash2, X, Star } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function PhotosTab({ boatId, photos, onChange }: { boatId: string; photos: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string | boolean) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_photos').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(String(error.message)); throw error }
    onChange()
  }

  async function setCover(id: string) {
    // Setam toate ca non-cover apoi acesta cover
    await supabase.from('ssyt_boat_photos').update({ is_cover: false }).eq('boat_id', boatId)
    await supabase.from('ssyt_boat_photos').update({ is_cover: true }).eq('id', id)
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi această poză?')) return
    const { error } = await supabase.from('ssyt_boat_photos').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{photos.length} poze în galerie</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă poză
        </button>
      </div>

      {showNew && <NewPhotoForm boatId={boatId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        <span>ℹ️</span>
        <span>Pentru moment se adaugă doar URL-uri spre imagini. Upload direct va veni în Sprint 3.</span>
      </div>

      {photos.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ImageIcon size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio poză în galerie.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((p) => (
            <div key={p.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="aspect-video bg-gray-100 relative">
                {p.url ? (
                  <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={32} className="text-gray-300" />
                  </div>
                )}
                {p.is_cover && (
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white inline-flex items-center gap-1" style={{ background: '#FF6B35' }}>
                    <Star size={10} /> cover
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="text-xs text-gray-600 mb-2">
                  <EditableField value={p.caption} onSave={(v) => updateField(p.id, 'caption', v)} placeholder="Caption..." />
                </div>
                <div className="text-xs text-gray-400 font-mono break-all mb-3">
                  <EditableField value={p.url} onSave={(v) => updateField(p.id, 'url', v)} placeholder="URL imagine" type="url" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  {!p.is_cover ? (
                    <button onClick={() => setCover(p.id)} className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
                      <Star size={11} /> Setează cover
                    </button>
                  ) : (
                    <span className="text-gray-400">★ cover</span>
                  )}
                  <button onClick={() => remove(p.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewPhotoForm({ boatId, onClose, onSaved }: { boatId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ url: '', caption: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.url.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_boat_photos').insert({
      boat_id: boatId,
      url: form.url,
      caption: form.caption || null,
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Poză nouă</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <input placeholder="URL imagine *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <input placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving || !form.url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
