'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, ExternalLink, X, Save, FileText, Upload, Loader2 } from 'lucide-react'
import { uploadSsytFile } from '@/lib/ssyt/upload-client'

type Doc = {
  id: string
  name: string
  description: string | null
  file_url: string | null
  document_type_id: string | null
  doc_type: { id: string; name: string; code: string } | null
}

type DocType = { id: string; name: string; code: string }

export default function RegattaDocsList({
  docs,
  docTypes,
  regattaId,
  canEdit,
}: {
  docs: Doc[]
  docTypes: DocType[]
  regattaId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(formData: any, id?: string) {
    setBusy(true)
    const body: any = { ...formData, regatta_id: regattaId }
    if (id) body.id = id

    const res = await fetch('/api/ssyt/portal/regatta-docs', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Eroare')
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
            <Plus size={14} /> Adaugă document
          </button>
        </div>
      )}

      {addOpen && (
        <DocForm regattaId={regattaId} docTypes={docTypes} onCancel={() => setAddOpen(false)} onSave={(d) => save(d)} busy={busy} />
      )}

      <div className="space-y-2">
        {docs.length === 0 && !addOpen ? (
          <div className="text-sm text-gray-400 italic p-6 text-center rounded-lg" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            Niciun document încă.
          </div>
        ) : (
          docs.map((d) =>
            editingId === d.id ? (
              <DocForm
                key={d.id}
                regattaId={regattaId}
                initial={{ name: d.name, description: d.description || '', url: d.file_url || '', document_type_id: d.document_type_id || '' }}
                docTypes={docTypes}
                onCancel={() => setEditingId(null)}
                onSave={(form) => save(form, d.id)}
                busy={busy}
              />
            ) : (
              <div key={d.id} className="rounded-lg p-4 flex items-start gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f3f4f6' }}>
                  <FileText size={14} className="text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium" style={{ color: '#0a1628' }}>{d.name}</span>
                    {d.doc_type && (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
                        {d.doc_type.name}
                      </span>
                    )}
                  </div>
                  {d.description && <p className="text-xs text-gray-500 mt-1">{d.description}</p>}
                  {d.file_url && (
                    <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs mt-2 hover:underline" style={{ color: '#FF6B35' }}>
                      Deschide <ExternalLink size={10} />
                    </a>
                  )}
                </div>
                {canEdit && (
                  <button onClick={() => setEditingId(d.id)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
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

function DocForm({
  regattaId,
  initial,
  docTypes,
  onCancel,
  onSave,
  busy,
}: {
  regattaId: string
  initial?: { name?: string; description?: string; url?: string; document_type_id?: string }
  docTypes: DocType[]
  onCancel: () => void
  onSave: (data: any) => void
  busy: boolean
}) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    description: initial?.description || '',
    url: initial?.url || '',
    document_type_id: initial?.document_type_id || '',
  })
  const [uploading, setUploading] = useState(false)
  const [uploadErr, setUploadErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function handleFile(file: File | null) {
    if (!file) return
    setUploading(true)
    setUploadErr(null)
    try {
      const up = await uploadSsytFile(file, { context: 'regatta_document', regattaId })
      setForm((f) => ({ ...f, url: up.url, name: f.name || up.filename }))
    } catch (e: any) {
      setUploadErr(e.message || 'Upload eșuat.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Nume document *</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} autoFocus />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Fișier (PDF/imagine) sau link</label>
            <div className="flex items-center gap-2 mb-1.5">
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] || null)} />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Se încarcă...' : 'Încarcă fișier'}
              </button>
              {form.url && !uploading && <span className="text-xs text-emerald-600">✓</span>}
            </div>
            <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="sau link extern https://..."
              className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
            {uploadErr && <p className="text-[11px] text-red-600 mt-1">{uploadErr}</p>}
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Tip document</label>
            <select value={form.document_type_id} onChange={(e) => setForm({ ...form, document_type_id: e.target.value })}
              className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }}>
              <option value="">— alege —</option>
              {docTypes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Descriere</label>
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} />
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            <X size={14} className="inline mr-1" /> Anulează
          </button>
          <button onClick={() => onSave(form)} disabled={busy || !form.name}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#FF6B35' }}>
            <Save size={14} /> Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
