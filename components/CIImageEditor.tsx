'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { RotateCcw, RotateCw, Crop, Check, X, ZoomIn, ZoomOut } from 'lucide-react'

type Props = {
  file: File
  onConfirm: (processedDataUrl: string, mediaType: string) => void
  onCancel: () => void
}

export default function CIImageEditor({ file, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [rotation, setRotation] = useState(0)
  const [cropping, setCropping] = useState(false)
  const [cropStart, setCropStart] = useState<{x:number,y:number}|null>(null)
  const [cropRect, setCropRect] = useState<{x:number,y:number,w:number,h:number}|null>(null)
  const [zoom, setZoom] = useState(1)
  const [imageLoaded, setImageLoaded] = useState(false)
  const imgRef = useRef<HTMLImageElement|null>(null)
  const isPDF = file.type === 'application/pdf'

  // Load image
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImageLoaded(true)
    }
    const reader = new FileReader()
    reader.onload = e => { img.src = e.target?.result as string }
    reader.readAsDataURL(file)
  }, [file])

  // Draw on canvas whenever rotation/crop changes
  useEffect(() => {
    if (!imageLoaded || !canvasRef.current || !imgRef.current) return
    drawImage()
  }, [imageLoaded, rotation, zoom])

  function drawImage() {
    const canvas = canvasRef.current!
    const img = imgRef.current!
    const ctx = canvas.getContext('2d')!

    const rad = (rotation * Math.PI) / 180
    const cos = Math.abs(Math.cos(rad))
    const sin = Math.abs(Math.sin(rad))

    const rotW = img.width * cos + img.height * sin
    const rotH = img.width * sin + img.height * cos

    canvas.width = rotW
    canvas.height = rotH

    ctx.save()
    ctx.translate(rotW / 2, rotH / 2)
    ctx.rotate(rad)
    ctx.drawImage(img, -img.width / 2, -img.height / 2)
    ctx.restore()
  }

  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropping) return
    setCropStart(getCanvasCoords(e))
    setCropRect(null)
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!cropping || !cropStart) return
    const cur = getCanvasCoords(e)
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    drawImage()
    const x = Math.min(cropStart.x, cur.x)
    const y = Math.min(cropStart.y, cur.y)
    const w = Math.abs(cur.x - cropStart.x)
    const h = Math.abs(cur.y - cropStart.y)
    // Draw crop overlay
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.clearRect(x, y, w, h)
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 2
    ctx.strokeRect(x, y, w, h)
    setCropRect({ x, y, w, h })
  }

  function handleMouseUp() {
    if (!cropping) return
    setCropStart(null)
  }

  function applyCrop() {
    if (!cropRect || !canvasRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.getImageData(cropRect.x, cropRect.y, cropRect.w, cropRect.h)
    const tmpCanvas = document.createElement('canvas')
    tmpCanvas.width = cropRect.w
    tmpCanvas.height = cropRect.h
    tmpCanvas.getContext('2d')!.putImageData(imageData, 0, 0)
    // Update imgRef with cropped version
    const img = new Image()
    img.onload = () => { imgRef.current = img; setCropRect(null); setCropping(false); drawImage() }
    img.src = tmpCanvas.toDataURL('image/jpeg', 0.95)
  }

  function handleConfirm() {
    if (!canvasRef.current) return
    // Apply crop if active
    if (cropRect) {
      applyCrop()
      return
    }
    const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.92)
    onConfirm(dataUrl, 'image/jpeg')
  }

  const displayStyle = {
    maxWidth: '100%',
    maxHeight: '55vh',
    cursor: cropping ? 'crosshair' : 'default',
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">
            {isPDF ? 'Rotire document' : 'Editare CI înainte de scanare'}
          </h3>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18}/>
          </button>
        </div>

        {/* Canvas */}
        <div className="bg-gray-100 flex items-center justify-center p-4" style={{minHeight:200}}>
          {!imageLoaded ? (
            <div className="text-gray-400 text-sm">Se încarcă...</div>
          ) : (
            <canvas
              ref={canvasRef}
              style={displayStyle}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          )}
          {cropRect && (
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full">
              Eliberați mouse-ul, apoi apăsați ✓ pentru crop
            </div>
          )}
        </div>

        {/* Toolbar */}
        <div className="px-5 py-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            {/* Rotate + Crop tools */}
            <div className="flex items-center gap-2">
              <button onClick={() => { setRotation(r => r - 90); setCropRect(null) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
                <RotateCcw size={14}/> -90°
              </button>
              <button onClick={() => { setRotation(r => r + 90); setCropRect(null) }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs font-medium">
                <RotateCw size={14}/> +90°
              </button>
              {!isPDF && (
                <button onClick={() => { setCropping(c => !c); setCropRect(null) }}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                    cropping ? 'bg-blue-500 text-white border border-blue-500' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}>
                  <Crop size={14}/> {cropping ? 'Anulează crop' : 'Crop'}
                </button>
              )}
              {cropRect && (
                <button onClick={applyCrop}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-100 text-blue-700 border border-blue-200 text-xs font-medium">
                  <Check size={14}/> Aplică crop
                </button>
              )}
            </div>

            {/* Confirm / Cancel */}
            <div className="flex items-center gap-2">
              <button onClick={onCancel}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-500 text-sm hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={handleConfirm}
                className="px-5 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2"
                style={{background:'#0a1628'}}>
                <Check size={15}/> Trimite la scanare
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {isPDF ? 'Rotiți dacă e cazul, apoi trimiteți.' : 'Rotiți și/sau cropați imaginea pentru o citire mai bună, apoi trimiteți la scanare OCR.'}
          </p>
        </div>
      </div>
    </div>
  )
}