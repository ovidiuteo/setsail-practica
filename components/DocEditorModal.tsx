'use client'
import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

// Vizualizator/editor pentru un document al cursantului (CI, verso, adeverință,
// certificat de naștere, carnet VHF, semnătură, cerere semnată).
// Aceleași unelte ca în lista de cursanți: rotire, decupare, zoom, înlocuire, ștergere.

export type DocDef = { column: string; label: string }

export const STUDENT_DOCS: DocDef[] = [
  { column: 'ci_image_data', label: 'Act de identitate' },
  { column: 'ci_verso_data', label: 'Verso CI nou' },
  { column: 'adeverinta_adresa_data', label: 'Adeverință domiciliu' },
  { column: 'certificat_nastere_data', label: 'Certificat de naștere' },
  { column: 'lrc_certificat_data', label: 'Carnet VHF/LRC existent' },
  { column: 'signature_data', label: 'Semnătură' },
  { column: 'cerere_semnata_data', label: 'Cerere semnată' },
]

// Reduce imaginea la max 1800px lățime, JPEG 0.85
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('citire eșuată'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('imagine invalidă'))
      img.onload = () => {
        const max = 1800
        let { width, height } = img
        if (width > max) { height = Math.round(height * max / width); width = max }
        const c = document.createElement('canvas'); c.width = width; c.height = height
        c.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.src = fr.result as string
    }
    fr.readAsDataURL(file)
  })
}
function rotate(src: string, deg: number): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.height; c.height = img.width
      const ctx = c.getContext('2d')!
      ctx.translate(c.width / 2, c.height / 2)
      ctx.rotate(deg * Math.PI / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.src = src
  })
}
function crop(src: string, r: { x: number; y: number; w: number; h: number }): Promise<string> {
  return new Promise(resolve => {
    const img = new Image()
    img.onload = () => {
      const sx = r.x * img.width, sy = r.y * img.height, sw = r.w * img.width, sh = r.h * img.height
      const c = document.createElement('canvas'); c.width = Math.max(1, sw); c.height = Math.max(1, sh)
      c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.src = src
  })
}

export default function DocEditorModal({ studentId, studentName, doc, initial, onSaved, onClose }: {
  studentId: string
  studentName?: string
  doc: DocDef
  initial: string | null
  onSaved: (dataUrl: string | null) => void
  onClose: () => void
}) {
  const [img, setImg] = useState<string | null>(initial)
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function persist(dataUrl: string) {
    setBusy(true)
    const { error } = await supabase.from('students').update({ [doc.column]: dataUrl }).eq('id', studentId)
    setBusy(false)
    if (error) { alert('Salvare eșuată: ' + error.message); return }
    setDirty(false); setZoom(1); onSaved(dataUrl)
  }
  async function removeDoc() {
    if (!confirm(`Ștergi documentul „${doc.label}"${studentName ? ` al cursantului ${studentName}` : ''}?`)) return
    setBusy(true)
    const { error } = await supabase.from('students').update({ [doc.column]: null }).eq('id', studentId)
    setBusy(false)
    if (error) { alert('Ștergere eșuată: ' + error.message); return }
    setImg(null); setDirty(false); onSaved(null)
  }
  async function onPick(file: File) {
    setBusy(true)
    try { const d = await downscale(file); setImg(d); setDirty(true); setZoom(1); setCropMode(false); setSel(null) }
    catch (e: any) { alert('Eroare imagine: ' + e.message) }
    setBusy(false)
  }
  async function doRotate(deg: number) {
    if (!img) return
    setBusy(true); const d = await rotate(img, deg); setImg(d); setDirty(true); setZoom(1); setBusy(false)
  }
  async function applyCrop() {
    if (!img || !sel || sel.w < 0.02 || sel.h < 0.02) { setCropMode(false); setSel(null); return }
    setBusy(true); const d = await crop(img, sel); setImg(d); setDirty(true); setCropMode(false); setSel(null); setZoom(1); setBusy(false)
  }

  function relFromEvent(e: React.PointerEvent) {
    const el = imgRef.current; if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  function onDown(e: React.PointerEvent) { if (!cropMode) return; const p = relFromEvent(e); drag.current = p; setSel({ x: p.x, y: p.y, w: 0, h: 0 }) }
  function onMove(e: React.PointerEvent) {
    if (!cropMode || !drag.current) return
    const p = relFromEvent(e), s = drag.current
    setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div onClick={e => e.stopPropagation()} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-900 text-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          {studentName && <span className="font-medium truncate max-w-[40vw]">{studentName}</span>}
          <span className="px-2 py-1 rounded-lg bg-gray-800 text-xs text-gray-300">{doc.label}</span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => doRotate(-90)} disabled={!img || cropMode} title="Rotește stânga" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">⟲</button>
          <button onClick={() => doRotate(90)} disabled={!img || cropMode} title="Rotește dreapta" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">⟳</button>
          {!cropMode ? (
            <button onClick={() => { setCropMode(true); setSel(null); setZoom(1) }} disabled={!img} className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs disabled:opacity-40">✂ Crop</button>
          ) : (
            <>
              <button onClick={applyCrop} className="px-2.5 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs">Aplică</button>
              <button onClick={() => { setCropMode(false); setSel(null) }} className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">Renunță</button>
            </>
          )}
          <span className="w-px h-5 bg-gray-700 mx-0.5" />
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={!img || cropMode} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">−</button>
          <span className="text-xs text-gray-400 w-11 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} disabled={!img || cropMode} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">+</button>
          <button onClick={() => setZoom(1)} disabled={!img || cropMode} className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs disabled:opacity-40">1:1</button>
          <span className="w-px h-5 bg-gray-700 mx-0.5" />
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50">{img ? 'Înlocuiește' : 'Încarcă'}</button>
          {dirty && <button onClick={() => img && persist(img)} disabled={busy} className="px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50">{busy ? 'Se salvează…' : 'Salvează imaginea'}</button>}
          {img && !dirty && <button onClick={removeDoc} disabled={busy} className="px-3 h-8 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs disabled:opacity-50">Șterge</button>}
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg ml-1">✕</button>
        </div>
      </div>

      <div onClick={e => e.stopPropagation()} className="flex-1 overflow-auto flex items-start justify-center p-4">
        {!img ? (
          <div className="text-gray-400 mt-20 text-center">
            <p className="mb-3">Nu e încărcat: {doc.label.toLowerCase()}.</p>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Încarcă imagine</button>
          </div>
        ) : cropMode ? (
          <div className="relative inline-block max-w-full select-none touch-none"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}>
            <img ref={imgRef} src={img} alt={doc.label} className="max-w-full max-h-[75vh] object-contain pointer-events-none" draggable={false} />
            {sel && sel.w > 0 && (
              <div className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
                style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%` }} />
            )}
            <div className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded pointer-events-none">Trage pentru a selecta zona, apoi „Aplică"</div>
          </div>
        ) : (
          <img src={img} alt={doc.label} style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="shadow-2xl rounded transition-transform" />
        )}
      </div>
    </div>
  )
}
