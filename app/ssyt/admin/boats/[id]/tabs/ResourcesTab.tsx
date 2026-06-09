'use client'
import { useRef, useState } from 'react'
import { Plus, Link as LinkIcon, ExternalLink, Trash2, X, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'
import { uploadSsytFile, deleteSsytFile } from '@/lib/ssyt/upload-client'
import PreviewButton from '@/components/ssyt/FilePreview'

export default function ResourcesTab({ boatId, resources, onChange }: { boatId: string; resources: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_resources').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(r: any) {
    if (!confirm('Ștergi această resursă?')) return
    const { error } = await supabase.from('ssyt_boat_resources').delete().eq('id', r.id)
    if (error) { alert(error.message); return }
    if (r.url) await deleteSsytFile({ url: r.url, admin: true })
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
                  <PreviewButton url={r.url} title={r.title} />
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1" title="Deschide">
                      <ExternalLink size={14} />
                    </a>
                  )}
                  <button onClick={() => remove(r)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
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
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const up = await uploadSsytFile(file, { context: 'boat_resource', admin: true, boatId })
      setForm((f) => ({ ...f, url: up.url, title: f.title || up.filename }))
    } catch (e: any) {
      setError(e.message || 'Upload eșuat.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!form.title.trim() || !form.url.trim()) return
    setSaving(true)
    const { error: err } = await supabase.from('ssyt_boat_resources').insert({
      boat_id: boatId,
      title: form.title,
      url: form.url,
      description: form.description || null,
      category: form.category || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
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
      <div className="flex items-center gap-2 mb-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Se încarcă...' : 'Încarcă fișier (PDF/imagine)'}
        </button>
        {form.url && !uploading && <span className="text-xs text-emerald-600">✓ încărcat</span>}
      </div>
      <input placeholder="sau URL extern *" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={save} disabled={saving || uploading || !form.title.trim() || !form.url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
