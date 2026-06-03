'use client'
import { useState } from 'react'
import { Plus, Image as ImageIcon, Trash2, X, Star } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function MediaTab({ regattaId, media, onChange }: { regattaId: string; media: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string | boolean) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_media').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(String(error.message)); throw error }
    onChange()
  }

  async function setFeatured(id: string) {
    await supabase.from('ssyt_media').update({ is_featured: false }).eq('regatta_id', regattaId)
    await supabase.from('ssyt_media').update({ is_featured: true }).eq('id', id)
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest item media?')) return
    const { error } = await supabase.from('ssyt_media').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{media.length} items media</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă
        </button>
      </div>

      {showNew && <NewMediaForm regattaId={regattaId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        <span>ℹ️</span>
        <span>URL-uri spre imagini/video pentru moment. Upload direct va veni în Sprint 3.</span>
      </div>

      {media.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ImageIcon size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio poză/video pentru această regatta.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {media.map((m) => (
            <div key={m.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="aspect-video bg-gray-100 relative">
                {m.url && m.media_type === 'photo' ? (
                  <img src={m.url} alt={m.caption || ''} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon size={32} className="text-gray-300" />
                  </div>
                )}
                {m.is_featured && (
                  <span className="absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium text-white inline-flex items-center gap-1" style={{ background: '#FF6B35' }}>
                    <Star size={10} /> featured
                  </span>
                )}
              </div>
              <div className="p-3">
                {m.team && (
                  <div className="text-xs font-medium mb-2" style={{ color: '#0a1628' }}>
                    Echipa {m.team.short_name || m.team.name}
                  </div>
                )}
                <div className="text-xs text-gray-600 mb-2">
                  <EditableField value={m.caption} onSave={(v) => updateField(m.id, 'caption', v)} placeholder="Caption..." />
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  Credit: <EditableField value={m.credit} onSave={(v) => updateField(m.id, 'credit', v)} placeholder="autor / fotograf" />
                </div>
                <div className="text-xs text-gray-400 font-mono break-all mb-3">
                  <EditableField value={m.url} onSave={(v) => updateField(m.id, 'url', v)} placeholder="URL" type="url" />
                </div>
                <div className="flex items-center justify-between text-xs">
                  {!m.is_featured ? (
                    <button onClick={() => setFeatured(m.id)} className="text-gray-500 hover:text-gray-900 inline-flex items-center gap-1">
                      <Star size={11} /> Set featured
                    </button>
                  ) : (
                    <span className="text-gray-400">★ featured</span>
                  )}
                  <button onClick={() => remove(m.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={12} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewMediaForm({ regattaId, onClose, onSaved }: { regattaId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ url: '', caption: '', credit: '', media_type: 'photo' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.url.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_media').insert({
      regatta_id: regattaId,
      url: form.url,
      caption: form.caption || null,
      credit: form.credit || null,
      media_type: form.media_type,
      visibility: 'public',
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Media nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <select value={form.media_type} onChange={(e) => setForm({ ...form, media_type: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="photo">photo</option>
          <option value="video">video</option>
          <option value="reel">reel</option>
        </select>
        <input placeholder="Credit (autor)" value={form.credit} onChange={(e) => setForm({ ...form, credit: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
      </div>
      <input placeholder="URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <input placeholder="Caption" value={form.caption} onChange={(e) => setForm({ ...form, caption: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving || !form.url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}