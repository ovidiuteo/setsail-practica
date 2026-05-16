'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, ExternalLink, X, Save, Link as LinkIcon, FileText } from 'lucide-react'

export type Resource = {
  id: string
  title: string
  description: string | null
  url: string | null
  resource_type: string | null
  text_content: string | null
}

export default function ResourceList({
  resources,
  canEdit,
  apiEndpoint,  // /api/ssyt/portal/boat-type-resources sau team-boat-resources
  teamId,  // doar pentru team-boat-resources
  emptyText = 'Nicio resursă încă.',
}: {
  resources: Resource[]
  canEdit: boolean
  apiEndpoint: string
  teamId?: string
  emptyText?: string
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSave(formData: any, id?: string) {
    setBusy(true)
    const body: any = { ...formData }
    if (teamId && !id) body.team_id = teamId  // pentru create team-boat
    if (id) body.id = id

    const res = await fetch(apiEndpoint, {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const data = await res.json()
      alert(data.error || 'Eroare')
      return
    }
    setAddOpen(false)
    setEditingId(null)
    router.refresh()
  }

  return (
    <div>
      {canEdit && (
        <div className="mb-4">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white hover:opacity-90 transition"
            style={{ background: '#FF6B35' }}
          >
            <Plus size={14} /> Adaugă resursă
          </button>
        </div>
      )}

      {addOpen && (
        <ResourceForm onCancel={() => setAddOpen(false)} onSave={(d) => handleSave(d)} busy={busy} />
      )}

      <div className="space-y-2">
        {resources.length === 0 && !addOpen ? (
          <div className="text-sm text-gray-400 italic p-6 text-center rounded-lg" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            {emptyText}
          </div>
        ) : (
          resources.map((r) =>
            editingId === r.id ? (
              <ResourceForm key={r.id} initial={r} onCancel={() => setEditingId(null)} onSave={(d) => handleSave(d, r.id)} busy={busy} />
            ) : (
              <div key={r.id} className="rounded-lg p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f3f4f6' }}>
                  {r.url ? <LinkIcon size={14} className="text-gray-500" /> : <FileText size={14} className="text-gray-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: '#0a1628' }}>{r.title}</span>
                    {r.resource_type && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: '#f3f4f6', color: '#6B7280' }}>
                        {r.resource_type}
                      </span>
                    )}
                  </div>
                  {r.description && <p className="text-xs text-gray-500 mt-1">{r.description}</p>}
                  {r.text_content && <p className="text-xs text-gray-700 mt-2 whitespace-pre-wrap">{r.text_content}</p>}
                  {r.url && (
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 hover:underline" style={{ color: '#FF6B35' }}>
                      {r.url.length > 60 ? r.url.substring(0, 60) + '...' : r.url}
                      <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => setEditingId(r.id)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                    <Edit2 size={14} />
                  </button>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}

function ResourceForm({
  initial,
  onCancel,
  onSave,
  busy,
}: {
  initial?: Partial<Resource>
  onCancel: () => void
  onSave: (data: any) => void
  busy: boolean
}) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    url: initial?.url || '',
    resource_type: initial?.resource_type || 'other',
    text_content: initial?.text_content || '',
  })

  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Titlu *</label>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">URL (Google Doc, Sheet, PDF, etc.)</label>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://..."
              className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Tip</label>
            <select value={form.resource_type} onChange={(e) => setForm({ ...form, resource_type: e.target.value })}
              className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }}>
              <option value="manual">Manual</option>
              <option value="tutorial">Tutorial</option>
              <option value="video">Video</option>
              <option value="doc">Document</option>
              <option value="specs">Specs</option>
              <option value="orc">ORC</option>
              <option value="polara">Polara</option>
              <option value="tehnici">Tehnici</option>
              <option value="config">Config</option>
              <option value="other">Altele</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Descriere scurtă</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Text (opțional, dacă nu e URL)</label>
          <textarea value={form.text_content} onChange={(e) => setForm({ ...form, text_content: e.target.value })} rows={3}
            className="w-full px-3 py-1.5 border rounded-md text-sm resize-y" style={{ borderColor: '#d1d5db' }} />
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            <X size={14} className="inline mr-1" /> Anulează
          </button>
          <button onClick={() => onSave(form)} disabled={busy || !form.title}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#FF6B35' }}>
            <Save size={14} /> Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
