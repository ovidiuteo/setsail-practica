'use client'
import { useEffect, useState, type ReactNode } from 'react'
import { X, ChevronLeft, ChevronRight, Eye } from 'lucide-react'

export type LightboxPhoto = { id: string; url: string; caption?: string | null; badge?: string | null }

export default function PhotoLightbox({
  photos,
  gridClassName = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3',
  corner,
}: {
  photos: LightboxPhoto[]
  gridClassName?: string
  corner?: (photo: LightboxPhoto, index: number) => ReactNode
}) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const isOpen = openIndex !== null

  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenIndex(null)
      else if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? i : (i + 1) % photos.length))
      else if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, photos.length])

  const current = isOpen ? photos[openIndex] : null

  return (
    <>
      <div className={gridClassName}>
        {photos.map((p, i) => (
          <div key={p.id} className="group relative rounded-lg overflow-hidden" style={{ background: '#f3f4f6' }}>
            <button onClick={() => setOpenIndex(i)} className="block w-full aspect-square cursor-zoom-in">
              <img src={p.url} alt={p.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" loading="lazy" />
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition" style={{ background: 'rgba(0,0,0,0.25)' }}>
                <Eye size={22} className="text-white drop-shadow" />
              </span>
            </button>
            {p.badge && (
              <div className="pointer-events-none absolute bottom-0 inset-x-0 px-2 py-1 text-[11px] text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                {p.badge}
              </div>
            )}
            {corner && corner(p, i)}
          </div>
        ))}
      </div>

      {current && openIndex !== null && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.9)' }}
          onClick={() => setOpenIndex(null)}
        >
          <button onClick={() => setOpenIndex(null)} className="absolute top-4 right-4 text-white/80 hover:text-white p-2" title="Închide (Esc)">
            <X size={28} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenIndex((i) => (i! - 1 + photos.length) % photos.length) }}
                className="absolute left-3 md:left-6 text-white/70 hover:text-white p-2"
                title="Anterioara (←)"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); setOpenIndex((i) => (i! + 1) % photos.length) }}
                className="absolute right-3 md:right-6 text-white/70 hover:text-white p-2"
                title="Urmatoarea (→)"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}
          <figure className="max-w-[92vw] max-h-[90vh] flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            <img src={current.url} alt={current.caption || ''} className="max-w-[92vw] max-h-[82vh] object-contain rounded" />
            {(current.caption || current.badge) && (
              <figcaption className="mt-3 text-center text-white/80 text-sm px-4">
                {current.badge && <span className="mr-2 text-white/50">{current.badge}</span>}
                {current.caption}
              </figcaption>
            )}
            <div className="mt-1 text-white/40 text-xs">{openIndex + 1} / {photos.length}</div>
          </figure>
        </div>
      )}
    </>
  )
}
