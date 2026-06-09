'use client'
import { useRef, useState } from 'react'
import { Plus, FileText, Trash2, X, Download, Upload, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'
import { uploadSsytFile, deleteSsytFile } from '@/lib/ssyt/upload-client'
import PreviewButton from '@/components/ssyt/FilePreview'

export default function DocumentsTab({
  regattaId, documents, docTypes, onChange,
}: {
  regattaId: string; documents: any[]; docTypes: any[]; onChange: () => void
}) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_regatta_documents').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(d: any) {
    if (!confirm('Ștergi acest document?')) return
    const { error } = await supabase.from('ssyt_regatta_documents').delete().eq('id', d.id)
    if (error) { alert(error.message); return }
    // Șterge și fișierul găzduit pe R2 (dacă e cazul)
    if (d.file_url) await deleteSsytFile({ url: d.file_url, admin: true })
    onChange()
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{documents.length} documente</p>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Adaugă document
        </button>
      </div>

      {showNew && <NewDocForm regattaId={regattaId} docTypes={docTypes} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(16,185,129,0.08)', color: '#065F46' }}>
        <span>📎</span>
        <span>Poți încărca fișierul direct (PDF/JPG/PNG/WebP — găzduit pe Cloudflare R2) sau adăuga un link extern.</span>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <FileText size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun document.</p>
          <p className="text-xs text-gray-400 mt-1">NoR, Sailing Instructions, Crewlist semnat, certificate medicale etc.</p>
        </div>
      ) : (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
                <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">URL</th>
                <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Vizibilitate</th>
                <th className="text-right px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-1 rounded-full font-medium" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
                      {d.document_type?.name || d.custom_type_name || '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: '#0a1628' }}>
                    <span className="inline-flex items-center gap-2">
                      <FileText size={14} className="text-gray-400" />
                      <EditableField value={d.name} onSave={(v) => updateField(d.id, 'name', v)} />
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <EditableField value={d.file_url} onSave={(v) => updateField(d.id, 'file_url', v)} placeholder="URL" type="url" displayClassName="font-mono" />
                  </td>
                  <td className="px-4 py-3 text-center text-xs">
                    <EditableField
                      value={d.visibility}
                      onSave={(v) => updateField(d.id, 'visibility', v)}
                      type="select"
                      options={[
                        { value: 'public', label: 'public' },
                        { value: 'members', label: 'members' },
                        { value: 'admin', label: 'admin' },
                      ]}
                    />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <PreviewButton url={d.file_url} title={d.name} contentType={d.mime_type} className="text-gray-400 hover:text-gray-700 p-1 inline-block" />
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1 inline-block ml-1" title="Deschide">
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={() => remove(d)} className="text-gray-300 hover:text-red-600 p-1 ml-1"><Trash2 size={14} /></button>
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

function NewDocForm({ regattaId, docTypes, onClose, onSaved }: { regattaId: string; docTypes: any[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    document_type_id: '',
    custom_type_name: '',
    name: '',
    file_url: '',
    visibility: 'members',
  })
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
      const up = await uploadSsytFile(file, { context: 'regatta_document', admin: true, regattaId })
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
    if (!form.name.trim() || !form.file_url.trim()) {
      setError('Nume și fișier/URL obligatorii.')
      return
    }
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_regatta_documents').insert({
      regatta_id: regattaId,
      document_type_id: form.document_type_id || null,
      custom_type_name: form.custom_type_name || null,
      name: form.name,
      file_url: form.file_url,
      mime_type: meta.mime || null,
      file_size_bytes: meta.size || null,
      visibility: form.visibility,
      status: 'uploaded',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Document nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Tip document</label>
          <select value={form.document_type_id} onChange={(e) => setForm({ ...form, document_type_id: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
            <option value="">— alege —</option>
            {docTypes.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Vizibilitate</label>
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
            <option value="public">public</option>
            <option value="members">members</option>
            <option value="admin">admin</option>
          </select>
        </div>
      </div>
      <input placeholder="Nume *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />

      <div className="flex items-center gap-2 mb-2">
        <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
        <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
          {uploading ? 'Se încarcă...' : 'Încarcă fișier (PDF/imagine)'}
        </button>
        {form.file_url && !uploading && <span className="text-xs text-emerald-600 truncate">✓ încărcat</span>}
      </div>

      <input placeholder="sau link extern (URL)" value={form.file_url} onChange={(e) => { setForm({ ...form, file_url: e.target.value }); setMeta({}) }} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <button onClick={save} disabled={saving || uploading} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
      {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
    </div>
  )
}