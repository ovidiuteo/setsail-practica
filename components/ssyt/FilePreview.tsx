'use client'
import { useEffect, useState } from 'react'
import { Eye, X, ExternalLink, FileText } from 'lucide-react'

function previewKind(url?: string | null, contentType?: string | null): 'image' | 'pdf' | 'other' {
  const ct = (contentType || '').toLowerCase()
  const u = (url || '').toLowerCase().split('?')[0]
  if (ct.startsWith('image/') || /\.(jpe?g|png|webp|gif|avif)$/.test(u)) return 'image'
  if (ct === 'application/pdf' || /\.pdf$/.test(u)) return 'pdf'
  return 'other'
}

export function PreviewModal({
  url,
  title,
  contentType,
  onClose,
}: {
  url: string
  title?: string | null
  contentType?: string | null
  onClose: () => void
}) {
  const kind = previewKind(url, contentType)
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={onClose}>
      <button onClick={onClose} className="absolute top-4 right-4 text-white/80 hover:text-white p-2" title="Închide (Esc)">
        <X size={26} />
      </button>
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
        className="absolute top-4 left-4 inline-flex items-center gap-1.5 text-white/80 hover:text-white text-sm px-3 py-1.5 rounded-md" style={{ background: 'rgba(255,255,255,0.12)' }}>
        Deschide / descarcă <ExternalLink size={13} />
      </a>

      <div className="max-w-[92vw] max-h-[88vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
        {kind === 'image' && (
          <img src={url} alt={title || ''} className="max-w-[92vw] max-h-[82vh] object-contain rounded" />
        )}
        {kind === 'pdf' && (
          <iframe src={url} title={title || 'PDF'} className="bg-white rounded" style={{ width: '92vw', maxWidth: 1000, height: '82vh' }} />
        )}
        {kind === 'other' && (
          <div className="bg-white rounded-lg p-10 text-center max-w-md">
            <FileText size={40} className="mx-auto mb-4 text-gray-300" />
            <p className="text-sm text-gray-600 mb-1">Fără previzualizare inline pentru acest tip de fișier/link.</p>
            <p className="text-xs text-gray-400 mb-5 break-all">{url}</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: '#FF6B35' }}>
              Deschide în tab nou <ExternalLink size={13} />
            </a>
          </div>
        )}
        {title && <div className="mt-3 text-center text-white/80 text-sm px-4">{title}</div>}
      </div>
    </div>
  )
}

// Buton cu icon ochi care deschide modalul de preview.
export default function PreviewButton({
  url,
  title,
  contentType,
  className,
}: {
  url?: string | null
  title?: string | null
  contentType?: string | null
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!url) return null
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen(true) }}
        className={className || 'text-gray-400 hover:text-gray-700 p-1'}
        title="Previzualizează"
      >
        <Eye size={15} />
      </button>
      {open && <PreviewModal url={url} title={title} contentType={contentType} onClose={() => setOpen(false)} />}
    </>
  )
}
