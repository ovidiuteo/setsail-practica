'use client'

import { useRef, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Upload,
  Trash2,
  CheckCircle2,
  PenLine,
  RotateCcw,
  Loader2,
  ScanLine,
  Camera,
} from 'lucide-react'
import CIImageEditor from '@/components/CIImageEditor'

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
// Helpers — compresie + conversie + mapare OCR
// ============================================================================

function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) u8arr[n] = bstr.charCodeAt(n)
  return new Blob([u8arr], { type: mime })
}

// Comprima dataUrl JPEG la max 800px latime, sub 450KB (acelasi pattern ca SetSail)
function compressImage(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const MAX_W = 800
      const scale = Math.min(1, MAX_W / img.width)
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const tmp = document.createElement('canvas')
      tmp.width = w
      tmp.height = h
      tmp.getContext('2d')!.drawImage(img, 0, 0, w, h)
      let result = tmp.toDataURL('image/jpeg', 0.85)
      if (Math.round(result.length / 1024) <= 450) {
        resolve(result)
        return
      }
      for (const q of [0.75, 0.65, 0.55, 0.45, 0.35]) {
        result = tmp.toDataURL('image/jpeg', q)
        if (Math.round(result.length / 1024) <= 450) break
      }
      resolve(result)
    }
    img.src = dataUrl
  })
}

function mapOcrToSsytFields(d: any): {
  ssytFields: Record<string, any>
  labels: string[]
} {
  const ssytFields: Record<string, any> = {}
  const labels: string[] = []

  if (d.ci_series) {
    ssytFields.ci_seria = String(d.ci_series).toUpperCase().slice(0, 2)
    labels.push('seria CI')
  }
  if (d.ci_number) {
    ssytFields.ci_numar = String(d.ci_number).replace(/\D/g, '').slice(0, 9)
    labels.push('numărul CI')
  }
  if (d.cnp) {
    ssytFields.cnp = String(d.cnp).replace(/\D/g, '').slice(0, 13)
    labels.push('CNP')
  }
  if (d.issued_by) {
    ssytFields.ci_emis_de = String(d.issued_by)
    labels.push('CI emisă de')
  }
  if (d.issued_date) {
    const parts = String(d.issued_date).split('.')
    if (parts.length === 3) {
      const [dd, mm, yyyy] = parts
      if (yyyy?.length === 4) {
        ssytFields.ci_emisa_la = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
        labels.push('data emiterii CI')
      }
    }
  }
  if (d.nationality) {
    const n = String(d.nationality).toUpperCase()
    ssytFields.cetatenia = n === 'ROU' || n === 'ROMANIAN' || n === 'ROMÂN' ? 'Română' : d.nationality
    labels.push('cetățenia')
  }

  const addressParts: string[] = []
  if (d.address) addressParts.push(d.address)
  if (d.city) addressParts.push(d.city)
  if (d.county) addressParts.push(d.county)
  if (addressParts.length > 0) {
    ssytFields.adresa_completa = addressParts.join(', ')
    labels.push('adresa')
  }

  return { ssytFields, labels }
}

// ============================================================================
// 1) CI Uploader cu CIImageEditor + OCR Claude
// ============================================================================
function CiUploader({ hasCi, signedUrl }: { hasCi: boolean; signedUrl: string | null }) {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [detectedLabels, setDetectedLabels] = useState<string[]>([])
  const [ocrWarning, setOcrWarning] = useState('')

  function pickFile() {
    setError('')
    setOcrWarning('')
    setDetectedLabels([])
    inputRef.current?.click()
  }

  function onFilePicked(file: File) {
    if (
      !file.type.startsWith('image/') &&
      file.type !== 'application/pdf'
    ) {
      setError('Acceptăm doar imagini JPG/PNG/WebP sau PDF.')
      return
    }
    if (file.size > MAX_CI_SIZE_BYTES) {
      setError('Fișier prea mare (max 5 MB).')
      return
    }
    setPendingFile(file)
  }

  async function handleCropConfirm(dataUrl: string, mediaType: string) {
    setPendingFile(null)
    setProcessing(true)
    setError('')
    setOcrWarning('')
    setDetectedLabels([])

    try {
      setProgress('Pregătesc imaginea...')
      const compressed = await compressImage(dataUrl)

      // 1. Upload Storage
      setProgress('Salvez imaginea în portal...')
      const blob = dataUrlToBlob(compressed)
      const fd = new FormData()
      fd.append('file', blob, 'ci.jpg')
      const upRes = await fetch('/api/ssyt/portal/upload-ci', {
        method: 'POST',
        body: fd,
      })
      if (!upRes.ok) {
        const j = await upRes.json().catch(() => ({}))
        throw new Error(j.error || 'Eroare la upload imagine.')
      }

      // 2. OCR (Claude Vision)
      setProgress('Citesc datele din document...')
      const ocrRes = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType: mediaType || 'image/jpeg' }),
      })

      if (!ocrRes.ok) {
        setOcrWarning('Imaginea a fost salvată, dar nu am putut citi automat datele. Completează-le manual în profil.')
        setProcessing(false)
        setProgress('')
        router.refresh()
        return
      }

      const ocrJson = await ocrRes.json()
      if (!ocrJson?.success || !ocrJson?.data) {
        setOcrWarning('Imaginea a fost salvată, dar nu am putut interpreta documentul. Completează-le manual în profil.')
        setProcessing(false)
        setProgress('')
        router.refresh()
        return
      }

      // 3. Update profile
      const { ssytFields, labels } = mapOcrToSsytFields(ocrJson.data)
      if (Object.keys(ssytFields).length > 0) {
        setProgress('Actualizez profilul...')
        const updRes = await fetch('/api/ssyt/portal-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ssytFields),
        })
        if (!updRes.ok) {
          const j = await updRes.json().catch(() => ({}))
          setOcrWarning(
            'Date detectate dar nu am putut salva profilul automat: ' +
              (j.error || 'eroare necunoscută') +
              '. Verifică profilul.'
          )
        } else {
          setDetectedLabels(labels)
        }
      } else {
        setOcrWarning('Documentul a fost citit dar nu am detectat date utile (CI/CNP). Verifică imaginea sau completează manual.')
      }

      setProcessing(false)
      setProgress('')
      router.refresh()
    } catch (err: any) {
      setProcessing(false)
      setProgress('')
      setError(err?.message || 'Eroare neașteptată.')
    }
  }

  async function remove() {
    if (!confirm('Ștergi poza CI?')) return
    setError('')
    const res = await fetch('/api/ssyt/portal/upload-ci', { method: 'DELETE' })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError(j.error || 'Eroare la ștergere.')
      return
    }
    router.refresh()
  }

  return (
    <>
      {pendingFile && (
        <CIImageEditor
          file={pendingFile}
          onConfirm={handleCropConfirm}
          onCancel={() => setPendingFile(null)}
        />
      )}

      <section className="rounded-lg border p-6" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
        <h2 className="text-base font-semibold mb-1" style={{ color: '#0a1628' }}>
          Cartea de identitate
        </h2>
        <p className="text-xs text-gray-500 mb-4">
          Fotografiază sau încarcă CI (JPG/PNG/PDF). Te asistăm cu rotire, decupare și apoi <strong>citim
          automat</strong> seria, numărul, CNP-ul, adresa și emitentul. Datele detectate apar imediat
          în profil — verifică-le acolo.
        </p>

        {processing && (
          <div
            className="text-sm rounded-md px-3 py-2 mb-3 inline-flex items-center gap-2"
            style={{ background: '#eff6ff', color: '#1e40af' }}
          >
            <Loader2 size={14} className="animate-spin" />
            {progress || 'Se procesează...'}
          </div>
        )}

        {detectedLabels.length > 0 && (
          <div
            className="text-sm rounded-md px-3 py-2 mb-3"
            style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}
          >
            <ScanLine size={14} className="inline mr-1.5 align-middle" />
            Detectat automat din CI: <strong>{detectedLabels.join(', ')}</strong>. Verifică valorile
            în profil.
          </div>
        )}

        {ocrWarning && (
          <div
            className="text-sm rounded-md px-3 py-2 mb-3"
            style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
          >
            {ocrWarning}
          </div>
        )}

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
                onClick={pickFile}
                disabled={processing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-orange-50 disabled:opacity-50"
                style={{ color: '#FF6B35', border: '1px solid #FF6B35' }}
              >
                <Camera size={12} />
                Înlocuiește (cu OCR)
              </button>
              <button
                onClick={remove}
                disabled={processing}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium hover:bg-red-50 disabled:opacity-50"
                style={{ color: '#dc2626' }}
              >
                <Trash2 size={12} />
                Șterge
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={pickFile}
            disabled={processing}
            className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md text-sm font-medium disabled:opacity-50"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            <Camera size={14} />
            Încarcă CI și citește automat datele
          </button>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onFilePicked(f)
            e.target.value = ''
          }}
        />

        {error && (
          <div className="text-sm rounded-md px-3 py-2 mt-3" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}
      </section>
    </>
  )
}

// ============================================================================
// 2) Signature pad (canvas) — pattern ajustat la SetSail Practica
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
  const hasDrawn = useRef(false)
  const [, forceTick] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [editing, setEditing] = useState(!hasSignature)

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
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    hasDrawn.current = false
  }, [editing])

  function getPos(e: React.MouseEvent | React.TouchEvent) {
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
    hasDrawn.current = true
    forceTick((t) => t + 1) // re-render pentru butoanele care depind de hasDrawn
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
    hasDrawn.current = false
    forceTick((t) => t + 1)
  }

  async function save() {
    if (!hasDrawn.current) {
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
    hasDrawn.current = false
    router.refresh()
  }

  const ready = hasDrawn.current

  return (
    <section className="rounded-lg border p-6" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
      <h2 className="text-base font-semibold mb-1" style={{ color: '#0a1628' }}>
        Semnătura olografă
      </h2>
      <p className="text-xs text-gray-500 mb-4">
        Semnează cu mouse-ul sau cu degetul (mobile/tabletă). Folosim această semnătură pentru
        precompletarea documentelor către cluburi.
      </p>

      {!editing && hasSignature && signedUrl ? (
        <div className="space-y-3">
          <div
            className="rounded-md border-2 inline-block bg-white max-w-md"
            style={{ borderColor: '#22c55e' }}
          >
            <img src={signedUrl} alt="Semnătura ta" className="block w-full h-auto" />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => {
                setEditing(true)
                hasDrawn.current = false
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
            style={{
              border: '2px dashed #cbd5e1',
              background: '#fff',
            }}
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
              disabled={saving || !ready}
              className="inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-40"
              style={{ background: '#FF6B35', color: '#fff' }}
            >
              {saving ? 'Se salvează...' : 'Salvează semnătura'}
            </button>
            <button
              onClick={clearPad}
              disabled={!ready}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-40"
            >
              <RotateCcw size={12} />
              Șterge desenul
            </button>
            {hasSignature && (
              <button
                onClick={() => {
                  setEditing(false)
                  hasDrawn.current = false
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
