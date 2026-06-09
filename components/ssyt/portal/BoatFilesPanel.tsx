'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Download, Upload, Loader2, Trash2 } from 'lucide-react'

export type BoatFile = {
  id: string
  name: string
  category: string | null
  file_url: string | null
  mime_type: string | null
}

export default function BoatFilesPanel({
  adminFiles,
  teamFiles,
  teamId,
  canEdit,
}: {
  adminFiles: BoatFile[]
  teamFiles: BoatFile[]
  teamId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append('file', file)
        fd.append('team_id', teamId)
        fd.append('name', file.name)
        const res = await fetch('/api/ssyt/portal/team-boat-files', { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(d.error || 'Upload eșuat.')
          break
        }
      }
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
      router.refresh()
    }
  }

  async function removeTeamFile(id: string) {
    if (!confirm('Ștergi acest fișier?')) return
    setDeletingId(id)
    const res = await fetch('/api/ssyt/portal/team-boat-files', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setDeletingId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Eroare la ștergere.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Fișiere de la organizatori (admin) */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-1">Fișiere barcă (de la organizatori)</h2>
        <p className="text-xs text-gray-400 mb-4">Polare, manuale, scheme, certificate — adăugate de admin. Doar citire.</p>
        {adminFiles.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Niciun fișier de la organizatori.</p>
        ) : (
          <FileRows files={adminFiles} />
        )}
      </div>

      {/* Fișierele echipei (portal) */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">Fișierele echipei</h2>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium disabled:opacity-50" style={{ background: '#fff', border: '1px solid #FF6B35', color: '#FF6B35' }}>
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                {uploading ? 'Se încarcă...' : 'Încarcă fișier'}
              </button>
            </>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">Fișiere încărcate de echipa ta (vizibile și organizatorilor).</p>
        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        {teamFiles.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Niciun fișier al echipei încă.{canEdit ? ' Încarcă primul cu butonul de sus.' : ''}</p>
        ) : (
          <FileRows files={teamFiles} onDelete={canEdit ? removeTeamFile : undefined} deletingId={deletingId} />
        )}
      </div>
    </div>
  )
}

function FileRows({ files, onDelete, deletingId }: { files: BoatFile[]; onDelete?: (id: string) => void; deletingId?: string | null }) {
  return (
    <div className="space-y-2">
      {files.map((f) => (
        <div key={f.id} className="rounded-lg p-3 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#f3f4f6' }}>
            <FileText size={14} className="text-gray-500" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium text-sm truncate" style={{ color: '#0a1628' }}>{f.name}</div>
            {f.category && <div className="text-xs text-gray-400">{f.category}</div>}
          </div>
          {f.file_url && (
            <a href={f.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700 p-1" title="Deschide / descarcă">
              <Download size={15} />
            </a>
          )}
          {onDelete && (
            <button onClick={() => onDelete(f.id)} disabled={deletingId === f.id} className="text-gray-300 hover:text-red-600 p-1 disabled:opacity-50" title="Șterge">
              {deletingId === f.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
