'use client'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ImagePlus, Trash2, Camera, Loader2 } from 'lucide-react'
import PhotoLightbox from './PhotoLightbox'

export type RegattaPhoto = {
  id: string
  url: string
  caption: string | null
}

export default function RegattaPhotoGallery({
  teamId,
  regattaId,
  teamName,
  initialPhotos,
  canEdit,
}: {
  teamId: string
  regattaId: string
  teamName: string
  initialPhotos: RegattaPhoto[]
  canEdit: boolean
}) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement | null>(null)
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
        fd.append('regatta_id', regattaId)
        const res = await fetch('/api/ssyt/portal/team-regatta-media', { method: 'POST', body: fd })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          setError(d.error || 'Eroare la upload.')
          break
        }
      }
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
      router.refresh()
    }
  }

  async function remove(id: string) {
    if (!confirm('Ștergi această poză?')) return
    setDeletingId(id)
    const res = await fetch('/api/ssyt/portal/team-regatta-media', {
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
    <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <Camera size={12} /> Poze {teamName}
          {initialPhotos.length > 0 && <span className="text-gray-300 normal-case">· {initialPhotos.length}</span>}
        </div>
        {canEdit && (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-gray-100 transition disabled:opacity-50"
              style={{ color: '#FF6B35' }}
            >
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
              {uploading ? 'Se încarcă...' : 'Adaugă poze'}
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      {initialPhotos.length === 0 ? (
        <p className="text-sm text-gray-400 italic">
          Nicio poză încă.{canEdit ? ' Adaugă primele poze cu butonul de mai sus.' : ''}
        </p>
      ) : (
        <PhotoLightbox
          photos={initialPhotos}
          corner={canEdit ? (p) => (
            <button
              onClick={(e) => { e.stopPropagation(); remove(p.id) }}
              disabled={deletingId === p.id}
              className="absolute top-1.5 right-1.5 z-10 p-1.5 rounded-md bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600 disabled:opacity-50"
              title="Șterge poza"
            >
              {deletingId === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          ) : undefined}
        />
      )}
    </div>
  )
}
