'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, RotateCw, Crop, Check, X, Scissors } from 'lucide-react'

type Props = {
  file: File
  onConfirm: (processedDataUrl: string, mediaType: string) => void
  onCancel: () => void
}

type Handle = 'tl'|'t'|'tr'|'r'|'br'|'b'|'bl'|'l'

export default function CIImageEditor({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const originalImgRef = useRef<HTMLImageElement | null>(null) // imaginea originala pt reset
  const [rotation, setRotation] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [cropApplied, setCropApplied] = useState(false)
  const isPDF = file.type === 'application/pdf'

  // Crop state in procente 0-100
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [isCropDefault, setIsCropDefault] = useState(true)

  const dragState = useRef<{
    handle: Handle | 'move' | null
    startX: number; startY: number
    startCrop: typeof crop
  } | null>(null)

  // Incarca imaginea
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      originalImgRef.current = img
      setImageLoaded(true)
    }
    const reader = new FileReader()
    reader.onload = e => { img.src = e.target?.result as string }
    reader.readAsDataURL(file)
  }, [file])

  useEffect(() => {
    if (!imageLoaded) return
    drawCanvas()
  }, [imageLoaded, rotation])

  function drawCanvas(sourceImg?: HTMLImageElement) {
    const canvas = canvasRef.current
    const img = sourceImg || imgRef.current
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

  // Aplica crop - taie imaginea si actualizeaza imgRef
  function applyCrop() {
    const canvas = canvasRef.current
    if (!canvas) return

    const cx = Math.round((crop.x / 100) * canvas.width)
    const cy = Math.round((crop.y / 100) * canvas.height)
    const cw = Math.round((crop.w / 100) * canvas.width)
    const ch = Math.round((crop.h / 100) * canvas.height)

    // Creeaza canvas temporar cu zona selectata
    const tmp = document.createElement('canvas')
    tmp.width = cw
    tmp.height = ch
    const tmpCtx = tmp.getContext('2d')!
    tmpCtx.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)

    // Actualizeaza imaginea si redeseneaza
    const newImg = new Image()
    newImg.onload = () => {
      imgRef.current = newImg
      // Reset canvas la imaginea cropped
      const c = canvasRef.current!
      c.width = cw
      c.height = ch
      c.getContext('2d')!.drawImage(newImg, 0, 0)
      setCrop({ x: 0, y: 0, w: 100, h: 100 })
      setIsCropDefault(true)
      setCropApplied(true)
    }
    newImg.src = tmp.toDataURL('image/jpeg', 0.85)
  }

  // Reset crop - revine la imaginea originala (inainte de orice crop)
  function resetCrop() {
    imgRef.current = originalImgRef.current
    setCrop({ x: 0, y: 0, w: 100, h: 100 })
    setIsCropDefault(true)
    setCropApplied(false)
    setRotation(0)
    drawCanvas(originalImgRef.current!)
  }

  function rotateLeft() {
    setRotation(r => r - 90)
    setCrop({ x: 0, y: 0, w: 100, h: 100 })
    setIsCropDefault(true)
  }

  function rotateRight() {
    setRotation(r => r + 90)
    setCrop({ x: 0, y: 0, w: 100, h: 100 })
    setIsCropDefault(true)
  }

  function toPercent(e: React.MouseEvent | MouseEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      px: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      py: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

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
    e.stopPropagation()
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
    const MIN = 5

    setCrop(() => {
      let { x, y, w, h } = sc
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
    setIsCropDefault(false)
  }, [])

  const onMouseUp = useCallback(() => {
    dragState.current = null
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [])

  // Save & Scan: comprima imaginea la max 1200px latime si calitate 0.7
  function handleConfirm() {
    const canvas = canvasRef.current!
    const MAX_W = 1200
    const MAX_H = 1600
    let { width, height } = canvas
    if (width > MAX_W || height > MAX_H) {
      const scale = Math.min(MAX_W / width, MAX_H / height)
      width = Math.round(width * scale)
      height = Math.round(height * scale)
    }
    const tmp = document.createElement('canvas')
    tmp.width = width; tmp.height = height
    tmp.getContext('2d')!.drawImage(canvas, 0, 0, width, height)
    const dataUrl = tmp.toDataURL('image/jpeg', 0.75)
    console.log('Image size:', Math.round(dataUrl.length / 1024), 'KB')
    onConfirm(dataUrl, 'image/jpeg')
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{maxHeight:'95vh'}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {isPDF ? 'Rotire document' : 'Editare document'}
            </h3>
            {!isPDF && (
              <p className="text-xs text-gray-400 mt-0.5">Rotiți și decupați, apoi apăsați <b>Apply Crop</b>, apoi <b>Save & Scan OCR</b></p>
            )}
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>

        {/* Canvas */}
        <div className="relative bg-gray-900 flex items-center justify-center overflow-hidden" style={{flex:1, minHeight:200, maxHeight:'58vh'}}>
          {!imageLoaded ? (
            <div className="text-gray-400 text-sm">Se încarcă...</div>
          ) : (
            <div className="relative inline-block select-none" style={{maxWidth:'100%', maxHeight:'58vh'}}>
              <canvas
                ref={canvasRef}
                style={{display:'block', maxWidth:'100%', maxHeight:'58vh', objectFit:'contain'}}
              />

              {/* Overlay SVG crop */}
              {!isPDF && (
                <svg className="absolute inset-0 w-full h-full" style={{pointerEvents:'none'}} viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path fillRule="evenodd" fill="rgba(0,0,0,0.5)"
                    d={`M0 0 L100 0 L100 100 L0 100 Z M${crop.x} ${crop.y} L${crop.x+crop.w} ${crop.y} L${crop.x+crop.w} ${crop.y+crop.h} L${crop.x} ${crop.y+crop.h} Z`}
                    style={{pointerEvents:'none'}}/>
                  <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="white" strokeWidth="0.4" style={{pointerEvents:'none'}}/>
                  {/* Grid */}
                  {[1,2].map(n=>(
                    <g key={n}>
                      <line x1={crop.x+crop.w*n/3} y1={crop.y} x2={crop.x+crop.w*n/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.3)" strokeWidth="0.25" style={{pointerEvents:'none'}}/>
                      <line x1={crop.x} y1={crop.y+crop.h*n/3} x2={crop.x+crop.w} y2={crop.y+crop.h*n/3} stroke="rgba(255,255,255,0.3)" strokeWidth="0.25" style={{pointerEvents:'none'}}/>
                    </g>
                  ))}
                </svg>
              )}

              {/* Handles interactive */}
              {!isPDF && (
                <>
                  {/* Move zone */}
                  <div style={{position:'absolute', left:`${crop.x}%`, top:`${crop.y}%`, width:`${crop.w}%`, height:`${crop.h}%`, cursor:'move', pointerEvents:'all'}}
                    onMouseDown={e=>onMouseDown(e,'move')}/>
                  {/* Resize handles */}
                  {handles.map(h=>(
                    <div key={h.id} style={{
                      position:'absolute',
                      left:`calc(${h.cx}% - 7px)`, top:`calc(${h.cy}% - 7px)`,
                      width:14, height:14,
                      background:'white', border:'2.5px solid #3b82f6', borderRadius:3,
                      cursor:h.cursor, pointerEvents:'all', zIndex:10,
                      boxShadow:'0 1px 4px rgba(0,0,0,0.3)',
                    }} onMouseDown={e=>{e.stopPropagation();onMouseDown(e,h.id)}}/>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-5 py-3 border-t border-gray-100 shrink-0 bg-white">
          <div className="flex items-center justify-between gap-2">

            {/* Stanga: Rotate + Reset */}
            <div className="flex items-center gap-1.5">
              <button onClick={rotateLeft}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs">
                <RotateCcw size={12}/> -90°
              </button>
              <button onClick={rotateRight}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs">
                <RotateCw size={12}/> +90°
              </button>
              {!isPDF && (
                <button onClick={resetCrop}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs"
                  title="Revine la imaginea originală">
                  <Crop size={12}/> Reset
                </button>
              )}
            </div>

            {/* Dreapta: Apply Crop + Save & Scan */}
            <div className="flex items-center gap-2">
              <button onClick={onCancel}
                className="px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs hover:bg-gray-50">
                Anulează
              </button>
              {!isPDF && (
                <button onClick={applyCrop}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isCropDefault
                      ? 'border border-gray-200 text-gray-400 cursor-default'
                      : 'bg-amber-500 text-white hover:bg-amber-600'
                  }`}
                  disabled={isCropDefault}
                  title="Taie imaginea la zona selectată">
                  <Scissors size={12}/> Apply Crop
                </button>
              )}
              <button onClick={handleConfirm}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{background:'#0a1628'}}>
                <Check size={12}/> Save & Scan OCR
              </button>
            </div>
          </div>

          {/* Status */}
          {cropApplied && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <Check size={11}/> Crop aplicat — imaginea a fost decupată. Apasă <b className="mx-0.5">Save & Scan OCR</b> pentru a continua.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}