'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { RotateCcw, RotateCw, Crop, Check, X, Scissors, ChevronLeft, ChevronRight } from 'lucide-react'

type Props = {
  file: File
  onConfirm: (processedDataUrl: string, mediaType: string) => void
  onCancel: () => void
}

type Handle = 'tl'|'t'|'tr'|'r'|'br'|'b'|'bl'|'l'

export default function CIImageEditor({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const originalImgRef = useRef<HTMLImageElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const [rotation, setRotation] = useState(0)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [cropApplied, setCropApplied] = useState(false)
  const [crop, setCrop] = useState({ x: 0, y: 0, w: 100, h: 100 })
  const [isCropDefault, setIsCropDefault] = useState(true)
  const [pdfPage, setPdfPage] = useState(1)
  const [pdfTotalPages, setPdfTotalPages] = useState(0)
  const isPDF = file.type === 'application/pdf'

  const dragState = useRef<{
    handle: Handle | 'move' | null
    startX: number; startY: number
    startCrop: typeof crop
  } | null>(null)

  // Incarca imaginea sau PDF
  useEffect(() => {
    if (isPDF) {
      loadPDFPage(1)
    } else {
      const img = new Image()
      img.onload = () => {
        imgRef.current = img
        originalImgRef.current = img
        setImageLoaded(true)
      }
      const reader = new FileReader()
      reader.onload = e => { img.src = e.target?.result as string }
      reader.readAsDataURL(file)
    }
  }, [file])

  async function loadPDFPage(pageNum: number) {
    setImageLoaded(false)
    try {
      // Incarca PDF.js din CDN
      if (!(window as any).pdfjsLib) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script')
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
          script.onload = () => resolve()
          script.onerror = reject
          document.head.appendChild(script)
        })
        ;(window as any).pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      }

      const pdfjsLib = (window as any).pdfjsLib

      // Incarca PDF daca nu e deja
      if (!pdfDocRef.current) {
        const arrayBuffer = await file.arrayBuffer()
        pdfDocRef.current = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
        setPdfTotalPages(pdfDocRef.current.numPages)
      }

      // Rendereza pagina selectata
      const page = await pdfDocRef.current.getPage(pageNum)
      const viewport = page.getViewport({ scale: 2.0 }) // scale 2x pentru calitate

      const canvas = canvasRef.current!
      canvas.width = viewport.width
      canvas.height = viewport.height
      const ctx = canvas.getContext('2d')!

      await page.render({ canvasContext: ctx, viewport }).promise

      // Salveaza ca imagine pentru crop/rotate
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95)
      const img = new Image()
      img.onload = () => {
        imgRef.current = img
        originalImgRef.current = img
        setCrop({ x: 0, y: 0, w: 100, h: 100 })
        setIsCropDefault(true)
        setCropApplied(false)
        setRotation(0)
        setImageLoaded(true)
      }
      img.src = dataUrl
    } catch (err) {
      console.error('PDF load error:', err)
      setImageLoaded(true)
    }
  }

  async function changePage(newPage: number) {
    if (newPage < 1 || newPage > pdfTotalPages) return
    setPdfPage(newPage)
    await loadPDFPage(newPage)
  }

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

  function applyCrop() {
    const canvas = canvasRef.current
    if (!canvas) return
    const cx = Math.round((crop.x / 100) * canvas.width)
    const cy = Math.round((crop.y / 100) * canvas.height)
    const cw = Math.round((crop.w / 100) * canvas.width)
    const ch = Math.round((crop.h / 100) * canvas.height)
    const tmp = document.createElement('canvas')
    tmp.width = cw; tmp.height = ch
    tmp.getContext('2d')!.drawImage(canvas, cx, cy, cw, ch, 0, 0, cw, ch)
    const newImg = new Image()
    newImg.onload = () => {
      imgRef.current = newImg
      const c = canvasRef.current!
      c.width = cw; c.height = ch
      c.getContext('2d')!.drawImage(newImg, 0, 0)
      setCrop({ x: 0, y: 0, w: 100, h: 100 })
      setIsCropDefault(true)
      setCropApplied(true)
    }
    newImg.src = tmp.toDataURL('image/jpeg', 0.92)
  }

  function resetCrop() {
    imgRef.current = originalImgRef.current
    setCrop({ x: 0, y: 0, w: 100, h: 100 })
    setIsCropDefault(true)
    setCropApplied(false)
    setRotation(0)
    drawCanvas(originalImgRef.current!)
  }

  function rotateLeft() { setRotation(r => r - 90); setCrop({ x: 0, y: 0, w: 100, h: 100 }); setIsCropDefault(true) }
  function rotateRight() { setRotation(r => r + 90); setCrop({ x: 0, y: 0, w: 100, h: 100 }); setIsCropDefault(true) }

  function toPercent(e: React.MouseEvent | MouseEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      px: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      py: Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100)),
    }
  }

  function toPercentTouch(touch: {clientX:number, clientY:number}) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      px: Math.max(0, Math.min(100, ((touch.clientX - rect.left) / rect.width) * 100)),
      py: Math.max(0, Math.min(100, ((touch.clientY - rect.top) / rect.height) * 100)),
    }
  }

  function startDrag(handle: Handle | 'move', px: number, py: number) {
    dragState.current = { handle, startX: px, startY: py, startCrop: { ...crop } }
  }

  function doDrag(px: number, py: number) {
    if (!dragState.current) return
    const { handle, startX, startY, startCrop: sc } = dragState.current
    const dx = px - startX, dy = py - startY
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
  }

  function endDrag() { dragState.current = null }

  // Mouse handlers
  function onMouseDown(e: React.MouseEvent, handle: Handle | 'move') {
    e.preventDefault(); e.stopPropagation()
    const { px, py } = toPercent(e)
    startDrag(handle, px, py)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }
  const onMouseMove = useCallback((e: MouseEvent) => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    doDrag(
      Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100)),
      Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    )
  }, [])
  const onMouseUp = useCallback(() => {
    endDrag()
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
  }, [])

  // Touch handlers
  function onTouchStart(e: React.TouchEvent, handle: Handle | 'move') {
    e.preventDefault(); e.stopPropagation()
    const { px, py } = toPercentTouch(e.touches[0])
    startDrag(handle, px, py)
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
  }
  const onTouchMove = useCallback((e: TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const t = e.touches[0]
    doDrag(
      Math.max(0, Math.min(100, ((t.clientX - rect.left) / rect.width) * 100)),
      Math.max(0, Math.min(100, ((t.clientY - rect.top) / rect.height) * 100))
    )
  }, [])
  const onTouchEnd = useCallback(() => {
    endDrag()
    window.removeEventListener('touchmove', onTouchMove)
    window.removeEventListener('touchend', onTouchEnd)
  }, [])

  function handleConfirm() {
    const canvas = canvasRef.current!
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    console.log(`CI pentru OCR: ${canvas.width}x${canvas.height}px, ${Math.round(dataUrl.length/1024)}KB`)
    onConfirm(dataUrl, 'image/jpeg')
  }

  const handles: { id: Handle; cx: number; cy: number; cursor: string }[] = [
    { id: 'tl', cx: crop.x,          cy: crop.y,          cursor: 'nw-resize' },
    { id: 't',  cx: crop.x+crop.w/2, cy: crop.y,          cursor: 'n-resize'  },
    { id: 'tr', cx: crop.x+crop.w,   cy: crop.y,          cursor: 'ne-resize' },
    { id: 'r',  cx: crop.x+crop.w,   cy: crop.y+crop.h/2, cursor: 'e-resize'  },
    { id: 'br', cx: crop.x+crop.w,   cy: crop.y+crop.h,   cursor: 'se-resize' },
    { id: 'b',  cx: crop.x+crop.w/2, cy: crop.y+crop.h,   cursor: 's-resize'  },
    { id: 'bl', cx: crop.x,          cy: crop.y+crop.h,   cursor: 'sw-resize' },
    { id: 'l',  cx: crop.x,          cy: crop.y+crop.h/2, cursor: 'w-resize'  },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col" style={{maxHeight:'95vh'}}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">
              {isPDF ? `Document PDF${pdfTotalPages > 1 ? ` — Pagina ${pdfPage} / ${pdfTotalPages}` : ''}` : 'Editare document'}
            </h3>
            {!isPDF && <p className="text-xs text-gray-400 mt-0.5">Rotiți și decupați, apoi <b>Apply Crop</b> → <b>Save & Scan OCR</b></p>}
            {isPDF && pdfTotalPages > 1 && <p className="text-xs text-gray-400 mt-0.5">Navighează la pagina cu actul de identitate, decupează și scanează</p>}
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
        </div>

        {/* Navigare pagini PDF */}
        {isPDF && pdfTotalPages > 1 && (
          <div className="flex items-center justify-center gap-3 px-5 py-2 bg-gray-50 border-b border-gray-100 shrink-0">
            <button onClick={() => changePage(pdfPage - 1)} disabled={pdfPage <= 1}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white transition-colors">
              <ChevronLeft size={16}/>
            </button>
            <span className="text-sm font-medium text-gray-700">Pagina {pdfPage} din {pdfTotalPages}</span>
            <button onClick={() => changePage(pdfPage + 1)} disabled={pdfPage >= pdfTotalPages}
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-white transition-colors">
              <ChevronRight size={16}/>
            </button>
          </div>
        )}

        {/* Canvas */}
        <div className="relative bg-gray-900 flex items-center justify-center overflow-hidden" style={{flex:1, minHeight:200, maxHeight:'55vh'}}>
          {!imageLoaded ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              <div className="w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"/>
              <span className="text-sm">{isPDF ? 'Se redă pagina PDF...' : 'Se încarcă...'}</span>
            </div>
          ) : (
            <div className="relative inline-block select-none" style={{maxWidth:'100%', maxHeight:'55vh'}}>
              <canvas ref={canvasRef} style={{display:'block', maxWidth:'100%', maxHeight:'55vh', objectFit:'contain'}}/>

              {/* Overlay SVG crop */}
              <svg className="absolute inset-0 w-full h-full" style={{pointerEvents:'none'}} viewBox="0 0 100 100" preserveAspectRatio="none">
                <path fillRule="evenodd" fill="rgba(0,0,0,0.5)"
                  d={`M0 0 L100 0 L100 100 L0 100 Z M${crop.x} ${crop.y} L${crop.x+crop.w} ${crop.y} L${crop.x+crop.w} ${crop.y+crop.h} L${crop.x} ${crop.y+crop.h} Z`}
                  style={{pointerEvents:'none'}}/>
                <rect x={crop.x} y={crop.y} width={crop.w} height={crop.h} fill="none" stroke="white" strokeWidth="0.4" style={{pointerEvents:'none'}}/>
                {[1,2].map(n=>(
                  <g key={n}>
                    <line x1={crop.x+crop.w*n/3} y1={crop.y} x2={crop.x+crop.w*n/3} y2={crop.y+crop.h} stroke="rgba(255,255,255,0.3)" strokeWidth="0.25" style={{pointerEvents:'none'}}/>
                    <line x1={crop.x} y1={crop.y+crop.h*n/3} x2={crop.x+crop.w} y2={crop.y+crop.h*n/3} stroke="rgba(255,255,255,0.3)" strokeWidth="0.25" style={{pointerEvents:'none'}}/>
                  </g>
                ))}
              </svg>

              {/* Handles interactive */}
              <div style={{position:'absolute',inset:0,touchAction:'none',pointerEvents:'none'}}>
                <div style={{position:'absolute', left:`${crop.x}%`, top:`${crop.y}%`, width:`${crop.w}%`, height:`${crop.h}%`, cursor:'move', pointerEvents:'all'}}
                  onMouseDown={e=>onMouseDown(e,'move')} onTouchStart={e=>onTouchStart(e,'move')}/>
                {handles.map(h=>(
                  <div key={h.id} style={{
                    position:'absolute',
                    left:`calc(${h.cx}% - 10px)`, top:`calc(${h.cy}% - 10px)`,
                    width:20, height:20,
                    background:'white', border:'2.5px solid #3b82f6', borderRadius:4,
                    cursor:h.cursor, pointerEvents:'all', zIndex:10,
                    boxShadow:'0 1px 4px rgba(0,0,0,0.3)', touchAction:'none',
                  }}
                  onMouseDown={e=>{e.stopPropagation();onMouseDown(e,h.id)}}
                  onTouchStart={e=>{e.stopPropagation();onTouchStart(e,h.id)}}/>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-3 py-2.5 border-t border-gray-100 shrink-0 bg-white">
          {/* Rândul 1: Rotate + Reset */}
          <div className="flex items-center gap-1.5 mb-2">
            <button onClick={rotateLeft} className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs flex-1 justify-center sm:flex-none">
              <RotateCcw size={13}/> -90°
            </button>
            <button onClick={rotateRight} className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs flex-1 justify-center sm:flex-none">
              <RotateCw size={13}/> +90°
            </button>
            <button onClick={resetCrop} className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs flex-1 justify-center sm:flex-none">
              <Crop size={13}/> Reset
            </button>
            <button onClick={onCancel} className="hidden sm:flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 text-gray-500 text-xs ml-auto">
              <X size={12}/> Anulează
            </button>
          </div>

          {/* Rândul 2: Apply Crop + Save & Scan */}
          <div className="flex items-center gap-2">
            <button onClick={onCancel} className="flex sm:hidden items-center justify-center px-3 py-2.5 rounded-lg border border-gray-200 text-gray-500 text-xs flex-1">
              Anulează
            </button>
            <button onClick={applyCrop}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors flex-1 ${
                isCropDefault ? 'border border-gray-200 text-gray-400 cursor-default' : 'bg-amber-500 text-white'
              }`}
              disabled={isCropDefault}>
              <Scissors size={13}/> Apply Crop
            </button>
            <button onClick={handleConfirm}
              disabled={!isCropDefault}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-colors flex-1 ${
                !isCropDefault ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'text-white'
              }`}
              style={isCropDefault ? {background:'#0a1628'} : {}}>
              <Check size={13}/> Save & Scan OCR
            </button>
          </div>

          {cropApplied && (
            <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
              <Check size={11}/> Crop aplicat. Apasă <b className="mx-0.5">Save & Scan OCR</b>.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}