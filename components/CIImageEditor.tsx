'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, RotateCw, Crop, Check, X } from 'lucide-react'

type Props = {
  file: File
  onConfirm: (processedDataUrl: string, mediaType: string) => void
  onCancel: () => void
}

type Handle = 'tl'|'t'|'tr'|'r'|'br'|'b'|'bl'|'l'

export default function CIImageEditor({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [rotation, setRotation] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const isPDF = file.type === 'application/pdf'

  // Crop state — in percentaje (0-100) relativ la canvas
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const dragState = useRef<{
    handle: Handle | 'move' | null
    startX: number; startY: number
    startCrop: typeof crop
  } | null>(null)

  // Incarca imaginea
  useEffect(() => {
    const img = new Image()
    img.onload = () => { imgRef.current = img; setImageLoaded(true) }
    const reader = new FileReader()
    reader.onload = e => { img.src = e.target?.result as string }
    reader.readAsDataURL(file)
  }, [file])

  // Redeseneaza canvas cand rotatie/imagine se schimba
  useEffect(() => {
    if (!imageLoaded) return
    drawCanvas()
  }, [imageLoaded, rotation])

  function drawCanvas() {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img) return
    const ctx = canvas.getContext('2d')!
    const rad = (rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))
    canvas.width  = img.width * cos + img.height * sin
    canvas.height = img.width * sin + img.height * cos
    ctx.save()
    ctx.translate(canvas.width / 2, canvas.height / 2)
    ctx.rotate(rad)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }

  // Coordonate mouse relative la canvas, in procente
  function toPercent(e: React.MouseEvent | MouseEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      px: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      py: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  // Handle-uri: pozitii relative la crop box (in %)
  const handles: { id: Handle; cx: number; cy: number; cursor: string }[] = [
    { id: 'tl', cx: crop.x,           cy: crop.y,           cursor: 'nw-resize' },
    { id: 't',  cx: crop.x+crop.w/2,  cy: crop.y,           cursor: 'n-resize'  },
    { id: 'tr', cx: crop.x+crop.w,    cy: crop.y,           cursor: 'ne-resize' },
    { id: 'r',  cx: crop.x+crop.w,    cy: crop.y+crop.h/2,  cursor: 'e-resize'  },
    { id: 'br', cx: crop.x+crop.w,    cy: crop.y+crop.h,    cursor: 'se-resize' },
    { id: 'b',  cx: crop.x+crop.w/2,  cy: crop.y+crop.h,    cursor: 's-resize'  },
    { id: 'bl', cx: crop.x,           cy: crop.y+crop.h,    cursor: 'sw-resize' },
    { id: 'l',  cx: crop.x,           cy: crop.y+crop.h/2,  cursor: 'w-resize'  },
  ]

  function onMouseDown(e: React.MouseEvent, handle: Handle | 'move') {
    e.preventDefault()
    const { px, py } = toPercent(e)
    dragState.current = { handle, startX: px, startY: py, startCrop: { ...crop } }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  const onMouseMove = useCallback((e: MouseEvent) => {
    if (!dragState.current) return
    const { handle, startX, startY, startCrop: sc } = dragState.current
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const px = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const py = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    const dx = px - startX
    const dy = py - startY

    setCrop(prev => {
      let { x, y, w, h } = sc
      const MIN = 5 // minim 5%

      if (handle === 'move') {
        x = Math.max(0, Math.min(100 - w, sc.x + dx))
        y = Math.max(0, Math.min(100 - h, sc.y + dy))
      } else {
        if (handle.includes('l')) { const nx = Math.min(sc.x+sc.w-MIN, sc.x+dx); x=Math.max(0,nx); w=sc.x+sc.w-x }
        if (handle.includes('r')) { w = Math.max(MIN, Math.min(100-sc.x, sc.w+dx)) }
        if (handle.includes('t')) { const ny = Math.min(sc.y+sc.h-MIN, sc.y+dy); y=Math.max(0,ny); h=sc.y+sc.h-y }
        if (handle.includes('b')) { h = Math.max(MIN, Math.min(100-sc.y, sc.h+dy)) }
      }
      return { x, y, w, h }
    })
  }, [])

  const onMouseUp = useCallback(() => {
    dragState.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [])

  function applyCrop() {
    const canvas = canvasRef.current!
    const tmp = document.createElement('canvas')
    const cx = (crop.x / 100) * canvas.width
    const cy = (crop.y / 100) * canvas.height
    const cw = (crop.w / 100) * canvas.width
    const ch = (crop.h / 100) * canvas.height
    tmp.width = cw; tmp.height = ch
    tmp.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
    const newImg = new Image()
    newImg.onload = () => { imgRef.current = newImg; setCrop({ x:0, y:0, w:100, h:100 }); drawCanvas() }
    newImg.src = tmp.toDataURL('image/jpeg', 0.95)
  }

  function handleConfirm() {
    // Applica crop daca nu e full
    const isFullCrop = crop.x < 0.5 && crop.y < 0.5 && crop.w > 99.5 && crop.h > 99.5
    if (!isFullCrop) {
      applyCrop()
      setTimeout(() => {
        const dataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.92)
        onConfirm(dataUrl, 'image/jpeg')
      }, 100)
    } else {
      const dataUrl = canvasRef.current!.toDataURL('image/jpeg', 0.92)
      onConfirm(dataUrl, 'image/jpeg')
    }
  }

  const getCursor = () => {
    return 'default'
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{maxHeight:'95vh'}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900 text-sm">
            {isPDF ? 'Rotire document' : 'Editare document înainte de scanare'}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>

        {/* Canvas area */}
        <div ref={containerRef} className="relative bg-gray-100 flex items-center justify-center overflow-hidden"
          style={{ flex: 1, minHeight: 200, maxHeight: '60vh' }}>
          {!imageLoaded ? (
            <div className="text-gray-400 text-sm">Se încarcă...</div>
          ) : (
            <div className="relative inline-block select-none" style={{ cursor: 'default', maxWidth: '100%', maxHeight: '100%' }}>
              {/* Canvas */}
              <canvas
                ref={canvasRef}
                style={{ display: 'block', maxWidth: '100%', maxHeight: '60vh', objectFit: 'contain' }}
              />

              {/* Overlay SVG pentru crop */}
              {!isPDF && (
                <svg
                  className="absolute inset-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                  viewBox="0 0 100 100"
                  preserveAspectRatio="none"
                >
                  {/* Zona intunecata in afara crop */}
                  <path
                    fillRule="evenodd"
                    fill="rgba(0,0,0,0.45)"
                    d={`M0 0 L100 0 L100 100 L0 100 Z M${crop.x} ${crop.y} L${crop.x+crop.w} ${crop.y} L${crop.x+crop.w} ${crop.y+crop.h} L${crop.x} ${crop.y+crop.h} Z`}
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Border crop box */}
                  <rect
                    x={crop.x} y={crop.y} width={crop.w} height={crop.h}
                    fill="none" stroke="white" strokeWidth="0.5"
                    style={{ pointerEvents: 'none' }}
                  />
                  {/* Grid lines */}
                  <line x1={crop.x+crop.w/3} y1={crop.y} x2={crop.x+crop.w/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" style={{pointerEvents:'none'}}/>
                  <line x1={crop.x+crop.w*2/3} y1={crop.y} x2={crop.x+crop.w*2/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" style={{pointerEvents:'none'}}/>
                  <line x1={crop.x} y1={crop.y+crop.h/3} x2={crop.x+crop.w} y2={crop.y+crop.h/3} stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" style={{pointerEvents:'none'}}/>
                  <line x1={crop.x} y1={crop.y+crop.h*2/3} x2={crop.x+crop.w} y2={crop.y+crop.h*2/3} stroke="rgba(255,255,255,0.4)" strokeWidth="0.3" style={{pointerEvents:'none'}}/>
                </svg>
              )}

              {/* Handle-uri interactive - pozitionate absolut */}
              {!isPDF && (() => {
                const canvas = canvasRef.current
                if (!canvas) return null
                const rect = canvas.getBoundingClientRect()
                const W = rect.width
                const H = rect.height

                return (
                  <>
                    {/* Zona interioara - drag pentru move */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${crop.x}%`, top: `${crop.y}%`,
                        width: `${crop.w}%`, height: `${crop.h}%`,
                        cursor: 'move',
                        pointerEvents: 'all',
                      }}
                      onMouseDown={e => onMouseDown(e, 'move')}
                    />
                    {/* Handle-uri pe colturi si margini */}
                    {handles.map(h => (
                      <div
                        key={h.id}
                        style={{
                          position: 'absolute',
                          left: `calc(${h.cx}% - 7px)`,
                          top: `calc(${h.cy}% - 7px)`,
                          width: 14, height: 14,
                          background: 'white',
                          border: '2px solid #3b82f6',
                          borderRadius: 3,
                          cursor: h.cursor,
                          pointerEvents: 'all',
                          zIndex: 10,
                        }}
                        onMouseDown={e => { e.stopPropagation(); onMouseDown(e, h.id) }}
                      />
                    ))}
                  </>
                )
              })()}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={() => { setRotation(r => r - 90); setCrop({ x:0,y:0,w:100,h:100 }) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
                <RotateCcw size={13}/> -90°
              </button>
              <button onClick={() => { setRotation(r => r + 90); setCrop({ x:0,y:0,w:100,h:100 }) }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
                <RotateCw size={13}/> +90°
              </button>
              {!isPDF && (
                <button onClick={() => setCrop({ x:0, y:0, w:100, h:100 })}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs">
                  <Crop size={13}/> Reset crop
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onCancel}
                className="px-4 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={handleConfirm}
                className="px-5 py-1.5 rounded-lg text-xs font-medium text-white flex items-center gap-1.5"
                style={{ background: '#0a1628' }}>
                <Check size={13}/> Trimite la scanare
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isPDF ? 'Rotiți dacă e cazul, apoi trimiteți.' : 'Trageți colțurile/marginile albe pentru a decupa. Trageți din interior pentru a muta zona.'}
          </p>
        </div>
      </div>
    </div>
  )
}