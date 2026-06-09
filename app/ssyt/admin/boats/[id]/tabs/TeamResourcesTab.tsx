'use client'
import { useRef, useState } from 'react'
import { ExternalLink, Trash2, Edit2, X, Save, FolderInput, FileText, Upload, Loader2 } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import { uploadSsytFile, deleteSsytFile } from '@/lib/ssyt/upload-client'

type Resource = {
  id: string
  team_id: string
  team_name: string | null
  team_color: string | null
  title: string
  description: string | null
  resource_type: string | null
  url: string | null
  text_content: string | null
}

async function adminHeaders(): Promise<Record<string, string>> {
  const supabase = createSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Nu ești logat ca admin.')
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` }
}

export default function TeamResourcesTab({ resources, onChange }: { resources: Resource[]; onChange: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function remove(r: Resource) {
    if (!confirm('Ștergi această resursă adăugată de echipă?')) return
    setBusy(true)
    try {
      const headers = await adminHeaders()
      const res = await fetch('/api/ssyt/admin/team-resources', { method: 'DELETE', headers, body: JSON.stringify({ id: r.id }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Eroare'); return }
      if (r.url) await deleteSsytFile({ url: r.url, admin: true })
      onChange()
    } catch (e: any) { alert(e.message) } finally { setBusy(false) }
  }

  async function save(id: string, form: any) {
    setBusy(true)
    try {
      const headers = await adminHeaders()
      const res = await fetch('/api/ssyt/admin/team-resources', { method: 'PUT', headers, body: JSON.stringify({ id, ...form }) })
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || 'Eroare'); return }
      setEditingId(null)
      onChange()
    } catch (e: any) { alert(e.message) } finally { setBusy(false) }
  }

  if (resources.length === 0) {
    return (
      <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
        <FolderInput size={28} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Echipa nu a adăugat nicio resursă în portal pentru această barcă.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="rounded-lg p-3 mb-4 text-xs flex items-start gap-2" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        <span>ℹ️</span>
        <span>Resurse adăugate de echipă din portal (spațiul echipei). Le poți edita sau șterge ca admin.</span>
      </div>

      <div className="space-y-2">
        {resources.map((r) =>
          editingId === r.id ? (
            <EditForm key={r.id} resource={r} busy={busy} onCancel={() => setEditingId(null)} onSave={(form) => save(r.id, form)} />
          ) : (
            <div key={r.id} className="rounded-lg p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f3f4f6' }}>
                <FileText size={14} className="text-gray-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium" style={{ color: '#0a1628' }}>{r.title}</span>
                  {r.team_name && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded text-white" style={{ background: r.team_color || '#4A5568' }}>
                      {r.team_name}
                    </span>
                  )}
                  {r.resource_type && (
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
                      {r.resource_type}
                    </span>
                  )}
                </div>
                {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                {r.text_content && <p className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">{r.text_content}</p>}
                {r.url && (
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 hover:underline break-all" style={{ color: '#FF6B35' }}>
                    Deschide <ExternalLink size={10} />
                  </a>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => setEditingId(r.id)} className="text-gray-400 hover:text-gray-700 p-1"><Edit2 size={14} /></button>
                <button onClick={() => remove(r)} disabled={busy} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

function EditForm({ resource, busy, onCancel, onSave }: { resource: Resource; busy: boolean; onCancel: () => void; onSave: (form: any) => void }) {
  const [form, setForm] = useState({
    title: resource.title || '',
    resource_type: resource.resource_type || '',
    url: resource.url || '',
    description: resource.description || '',
    text_content: resource.text_content || '',
  })
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setUploading(true)
    try {
      const up = await uploadSsytFile(file, { context: 'team_resource', admin: true, teamId: resource.team_id })
      setForm((f) => ({ ...f, url: up.url, title: f.title || up.filename }))
    } catch (e: any) {
      alert(e.message || 'Upload eșuat.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="rounded-lg p-4" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
      <div className="space-y-3">
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Titlu *" className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })} placeholder="Tip (ex: polara, other)" className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="URL" className="w-full px-3 py-1.5 border rounded-md text-sm font-mono" style={{ borderColor: '#d1d5db' }} />
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? 'Se încarcă...' : 'Înlocuiește cu fișier (R2)'}
          </button>
          {form.url && !uploading && <span className="text-xs text-emerald-600">✓</span>}
        </div>
        <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descriere" className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
        <textarea value={form.text_content} onChange={(e) => setForm({ ...form, text_content: e.target.value })} placeholder="Conținut text (opțional)" rows={2} className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
        <div className="flex items-center gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"><X size={14} className="inline mr-1" /> Anulează</button>
          <button onClick={() => onSave(form)} disabled={busy || !form.title.trim()} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}>
            <Save size={14} /> Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
