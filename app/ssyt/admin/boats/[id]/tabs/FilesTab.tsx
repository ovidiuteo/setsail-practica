'use client'
import { useState } from 'react'
import { Plus, FileText, Trash2, X, Download } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

export default function FilesTab({ boatId, files, onChange }: { boatId: string; files: any[]; onChange: () => void }) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_boat_files').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest fișier (intrarea din DB)?')) return
    const { error } = await supabase.from('ssyt_boat_files').delete().eq('id', id)
    if (error) { alert(error.message); return }
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

      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        <span>ℹ️</span>
        <span>Pentru moment se adaugă doar link-uri spre fișiere (URL). Upload direct în Supabase Storage va veni în Sprint 3.</span>
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
                    <button onClick={() => remove(f.id)} className="text-gray-300 hover:text-red-600 p-1 ml-1"><Trash2 size={14} /></button>
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
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.name.trim() || !form.file_url.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_boat_files').insert({
      boat_id: boatId,
      name: form.name,
      category: form.category || null,
      file_url: form.file_url,
      description: form.description || null,
    })
    setSaving(false)
    if (error) { alert(error.message); return }
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
      <input placeholder="URL fișier *" value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3 font-mono" />
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <button onClick={save} disabled={saving || !form.name.trim() || !form.file_url.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
