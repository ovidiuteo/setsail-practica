'use client'
import { useState } from 'react'
import { Plus, Link as LinkIcon, ExternalLink, Trash2, X } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function ResourcesTab({ boatId, resources, onChange }: { boatId: string; resources: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_resources').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi această resursă?')) return
    const { error } = await supabase.from('ssyt_boat_resources').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{resources.length} link-uri utile</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă resursă
        </button>
      </div>

      {showNew && <NewResourceForm boatId={boatId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

      {resources.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <LinkIcon size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nicio resursă adăugată.</p>
          <p className="text-xs text-gray-400 mt-1">Link-uri spre forum-uri, ghiduri tuning, video-uri etc.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {resources.map((r) => (
            <div key={r.id} className="rounded-lg p-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: '#0a1628' }}>
                    <EditableField value={r.title} onSave={(v) => updateField(r.id, 'title', v)} placeholder="Titlu" />
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    <EditableField value={r.category} onSave={(v) => updateField(r.id, 'category', v)} placeholder="categorie" />
                  </div>
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1" title="Deschide">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                </div>
              </div>

              <div className="text-xs text-gray-600 mb-2">
                <EditableField value={r.description} onSave={(v) => updateField(r.id, 'description', v)} placeholder="Descriere..." type="textarea" multiline />
              </div>

              <div className="text-xs text-gray-500 font-mono break-all">
                <EditableField value={r.url} onSave={(v) => updateField(r.id, 'url', v)} placeholder="https://..." type="url" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewResourceForm({ boatId, onClose, onSaved }: { boatId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ title: '', url: '', description: '', category: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim() || !form.url.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_boat_resources').insert({
      boat_id: boatId,
      title: form.title,
      url: form.url,
      description: form.description || null,
      category: form.category || null,
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Resursă nouă</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input placeholder="Titlu *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
        <input placeholder="Categorie" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
      </div>
      <input placeholder="URL *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving || !form.title.trim() || !form.url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
