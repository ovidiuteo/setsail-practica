'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Trash2, CheckCircle2, PenLine, RotateCcw } from 'lucide-react'

const MAX_CI_SIZE_BYTES = 5 * 1024 * 1024

export default function IdentityForm({
  hasCiOnServer,
  hasSignatureOnServer,
  ciSignedUrl,
  signatureSignedUrl,
}: {
  hasCiOnServer: boolean
  hasSignatureOnServer: boolean
  ciSignedUrl: string | null
  signatureSignedUrl: string | null
}) {
  return (
    <div className="space-y-6">
      <CiUploader hasCi={hasCiOnServer} signedUrl={ciSignedUrl} />
      <SignaturePad hasSignature={hasSignatureOnServer} signedUrl={signatureSignedUrl} />
    </div>
  )
}

// ============================================================================
// 1) Upload CI (JPG/PNG)
// ============================================================================
function CiUploader({ hasCi, signedUrl }: { hasCi: boolean; signedUrl: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleFile(file: File) {
    if (!file.type.startsWith('image/')) {
      setError('Doar imagini JPG/PNG/WebP sunt acceptate.')
      return
    }
    if (file.size > MAX_CI_SIZE_BYTES) {
      setError('Imaginea e prea mare (max 5 MB).')
      return
    }
    setError('')
    setUploading(true)
    setSuccess(false)

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/ssyt/portal/upload-ci', { method: 'POST', body: formData })
    const json = await res.json().catch(() => ({}))
    setUploading(false)

    if (!res.ok || !json.ok) {
      setError(json.error || 'Eroare la upload.')
      return
    }
    setSuccess(true)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  async function remove() {
    if (!confirm('Ștergi poza CI?')) return
    setError('')
    const res = await fetch('/api/ssyt/portal/upload-ci', { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) {
      setError(json.error || 'Eroare la ștergere.')
      return
    }
    router.refresh()
  }

  return (
    <section className="rounded-lg border p-6" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
      <h2 className="text-base font-semibold mb-1" style={{ color: '#0a1628' }}>
        Poza Cărții de Identitate (CI)
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Fotografiază partea din față a CI cu telefonul, pe un fundal contrastant. Acceptate: JPG,
        PNG, WebP. Maxim 5 MB.
      </p>

      {hasCi && signedUrl ? (
        <div className="space-y-3">
          <div
            className="rounded-md border overflow-hidden inline-block max-w-md"
            style={{ borderColor: '#e2e8f0' }}
          >
            <img src={signedUrl} alt="Poza CI" className="block w-full h-auto" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-orange-50"
              style={{ color: '#FF6B35', border: '1px solid #FF6B35' }}
            >
              <Upload size={12} />
              Înlocuiește
            </button>
            <button
              onClick={remove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-50"
              style={{ color: '#dc2626' }}
            >
              <Trash2 size={12} />
              Șterge
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-sm font-medium disabled:opacity-50"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Upload size={14} />
          {uploading ? 'Se încarcă...' : 'Încarcă poza CI'}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = ''
        }}
      />

      {error && (
        <div className="text-sm rounded-md px-3 py-2 mt-3" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      {success && (
        <div
          className="text-sm rounded-md px-3 py-2 mt-3 inline-flex items-center gap-1"
          style={{ background: '#f0fdf4', color: '#16a34a' }}
        >
          <CheckCircle2 size={14} /> Salvat.
        </div>
      )}
    </section>
  )
}

// ============================================================================
// 2) Signature pad (canvas)
// ============================================================================
function SignaturePad({
  hasSignature,
  signedUrl,
}: {
  hasSignature: boolean
  signedUrl: string | null
}) {
  const router = useRouter()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPoint = useRef<{ x: number; y: number } | null>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [editing, setEditing] = useState(!hasSignature)

  // Setup canvas
  useEffect(() => {
    if (!editing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ratio = window.devicePixelRatio || 1
    const w = canvas.offsetWidth
    const h = canvas.offsetHeight
    canvas.width = w * ratio
    canvas.height = h * ratio
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(ratio, ratio)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.strokeStyle = '#0a1628'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [editing])

  function getPos(e: React.MouseEvent | React.TouchEvent): { x: number; y: number } | null {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    let clientX: number, clientY: number
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      clientX = t.clientX
      clientY = t.clientY
    } else {
      clientX = e.clientX
      clientY = e.clientY
    }
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    drawing.current = true
    lastPoint.current = pos
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!drawing.current) return
    e.preventDefault()
    const pos = getPos(e)
    if (!pos) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx || !lastPoint.current) return
    ctx.beginPath()
    ctx.moveTo(lastPoint.current.x, lastPoint.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPoint.current = pos
    setHasDrawn(true)
  }

  function endDraw() {
    drawing.current = false
    lastPoint.current = null
  }

  function clearPad() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.restore()
    setHasDrawn(false)
  }

  async function save() {
    if (!hasDrawn) {
      setError('Te rog desenează semnătura înainte să salvezi.')
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    setSaving(true)
    setError('')

    const dataUrl = canvas.toDataURL('image/png')

    const res = await fetch('/api/ssyt/portal/upload-signature', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)

    if (!res.ok || !json.ok) {
      setError(json.error || 'Eroare la salvare.')
      return
    }
    setSuccess(true)
    setEditing(false)
    router.refresh()
    setTimeout(() => setSuccess(false), 3000)
  }

  async function remove() {
    if (!confirm('Ștergi semnătura?')) return
    const res = await fetch('/api/ssyt/portal/upload-signature', { method: 'DELETE' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.ok) {
      setError(json.error || 'Eroare la ștergere.')
      return
    }
    setEditing(true)
    setHasDrawn(false)
    router.refresh()
  }

  return (
    <section className="rounded-lg border p-6" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
      <h2 className="text-base font-semibold mb-1" style={{ color: '#0a1628' }}>
        Semnătura olografă
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Semnează cu mouse-ul sau cu degetul (pe mobile/tabletă). Folosim această semnătură pentru
        precompletarea documentelor către cluburi.
      </p>

      {!editing && hasSignature && signedUrl ? (
        <div className="space-y-3">
          <div
            className="rounded-md border inline-block bg-white max-w-md"
            style={{ borderColor: '#e2e8f0' }}
          >
            <img src={signedUrl} alt="Semnătura ta" className="block w-full h-auto" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditing(true)
                setHasDrawn(false)
                setSuccess(false)
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-orange-50"
              style={{ color: '#FF6B35', border: '1px solid #FF6B35' }}
            >
              <PenLine size={12} />
              Resemnează
            </button>
            <button
              onClick={remove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-50"
              style={{ color: '#dc2626' }}
            >
              <Trash2 size={12} />
              Șterge
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div
            className="rounded-md overflow-hidden touch-none"
            style={{ border: '2px dashed #cbd5e1', background: '#fff' }}
          >
            <canvas
              ref={canvasRef}
              className="block w-full"
              style={{ height: 200, cursor: 'crosshair' }}
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={save}
              disabled={saving || !hasDrawn}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-40"
              style={{ background: '#FF6B35', color: '#fff' }}
            >
              {saving ? 'Se salvează...' : 'Salvează semnătura'}
            </button>
            <button
              onClick={clearPad}
              disabled={!hasDrawn}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <RotateCcw size={12} />
              Șterge desenul
            </button>
            {hasSignature && (
              <button
                onClick={() => {
                  setEditing(false)
                  setHasDrawn(false)
                }}
                className="px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100"
              >
                Anulează
              </button>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm rounded-md px-3 py-2 mt-3" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      {success && (
        <div
          className="text-sm rounded-md px-3 py-2 mt-3 inline-flex items-center gap-1"
          style={{ background: '#f0fdf4', color: '#16a34a' }}
        >
          <CheckCircle2 size={14} /> Semnătura a fost salvată.
        </div>
      )}
    </section>
  )
}
