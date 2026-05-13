'use client'
import { useState } from 'react'
import { Plus, FileText, Trash2, X, Download } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

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

  async function remove(id: string) {
    if (!confirm('Ștergi acest document?')) return
    const { error } = await supabase.from('ssyt_regatta_documents').delete().eq('id', id)
    if (error) { alert(error.message); return }
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

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        <span>ℹ️</span>
        <span>Pentru moment se adaugă link-uri spre fișiere externe. Upload direct în Supabase Storage va veni în Sprint 3.</span>
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
                  <td className="px-4 py-3 text-right">
                    {d.file_url && (
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1 inline-block" title="Deschide">
                        <Download size={14} />
                      </a>
                    )}
                    <button onClick={() => remove(d.id)} className="text-gray-300 hover:text-red-600 p-1 ml-1"><Trash2 size={14} /></button>
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!form.name.trim() || !form.file_url.trim()) {
      setError('Nume și URL obligatorii.')
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
      <input placeholder="URL fișier *" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
      {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
    </div>
  )
}