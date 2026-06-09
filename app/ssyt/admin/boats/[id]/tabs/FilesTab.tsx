'use client'
import { useRef, useState } from 'react'
import { Plus, FileText, Trash2, X, Download, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'
import { uploadSsytFile, deleteSsytFile } from '@/lib/ssyt/upload-client'

export default function FilesTab({ boatId, files, onChange }: { boatId: string; files: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_files').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(f: any) {
    if (!confirm('Ștergi acest fișier?')) return
    const { error } = await supabase.from('ssyt_boat_files').delete().eq('id', f.id)
    if (error) { alert(error.message); return }
    if (f.file_url) await deleteSsytFile({ url: f.file_url, admin: true })
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{files.length} fișiere</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă fișier
        </button>
      </div>

      {showNew && (
        <NewFileForm boatId={boatId} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />
      )}

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#065F46' }}>
        <span>📎</span>
        <span>Poți încărca fișierul direct (PDF/JPG/PNG/WebP — găzduit pe Cloudflare R2) sau adăuga un link extern.</span>
      </div>

      {files.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <FileText size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun fișier adăugat.</p>
          <p className="text-xs text-gray-400 mt-1">Polare, manuale, scheme rig, sail plan etc.</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Categorie</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Descriere</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">URL</th>
                <th className="text-right px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="px-4 py-3 font-medium" style={{ color: '#0a1628' }}>
                    <span className="inline-flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <EditableField value={f.name} onSave={(v) => updateField(f.id, 'name', v)} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    <EditableField value={f.category} onSave={(v) => updateField(f.id, 'category', v)} placeholder="ex: polară" />
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">
                    <EditableField value={f.description} onSave={(v) => updateField(f.id, 'description', v)} placeholder="descriere" />
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <EditableField value={f.file_url} onSave={(v) => updateField(f.id, 'file_url', v)} placeholder="URL" type="url" displayClassName="font-mono" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {f.file_url && (
                      <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1 inline-block" title="Deschide">
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={() => remove(f)} className="text-gray-300 hover:text-red-600 p-1 ml-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NewFileForm({ boatId, onClose, onSaved }: { boatId: string; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: '', category: '', file_url: '', description: '' })
  const [meta, setMeta] = useState<{ mime?: string; size?: number }>({})
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setError(null)
    try {
      const up = await uploadSsytFile(file, { context: 'boat_file', admin: true, boatId })
      setForm((f) => ({ ...f, file_url: up.url, name: f.name || up.filename }))
      setMeta({ mime: up.content_type, size: up.size_bytes })
    } catch (e: any) {
      setError(e.message || 'Upload eșuat.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function save() {
    if (!form.name.trim() || !form.file_url.trim()) { setError('Nume și fișier/URL obligatorii.'); return }
    setSaving(true)
    const { error: err } = await supabase.from('ssyt_boat_files').insert({
      boat_id: boatId,
      name: form.name,
      category: form.category || null,
      file_url: form.file_url,
      mime_type: meta.mime || null,
      file_size_bytes: meta.size || null,
      description: form.description || null,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Fișier nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input placeholder="Nume *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
        <input placeholder="Categorie (ex: polară, manual, rig)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Se încarcă...' : 'Încarcă fișier (PDF/imagine)'}
        </button>
        {form.file_url && !uploading && <span className="text-xs text-emerald-600">✓ încărcat</span>}
      </div>
      <input placeholder="sau link extern (URL)" value={form.file_url} onChange={(e) => { setForm({ ...form, file_url: e.target.value }); setMeta({}) }} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
      <button onClick={save} disabled={saving || uploading || !form.name.trim() || !form.file_url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
