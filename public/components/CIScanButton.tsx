'use client'
import { useState, useRef } from 'react'
import { ScanLine, Loader2, CheckCircle, AlertCircle } from 'lucide-react'

export type CIScanResult = {
  ci_series?: string
  ci_number?: string
  cnp?: string
  birth_date?: string
  last_name?: string
  first_name?: string
  address?: string
  county?: string
  expiry_date?: string
}

type Props = {
  onResult: (data: CIScanResult, imageBase64: string) => void
  compact?: boolean
}

export default function CIScanButton({ onResult, compact = false }: Props) {
  const [scanning, setScanning] = useState(false)
  const [status, setStatus] = useState<'idle'|'ok'|'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    if (!file) return
    setScanning(true)
    setStatus('idle')
    setErrorMsg('')

    try {
      const reader = new FileReader()
      const imageBase64: string = await new Promise((res, rej) => {
        reader.onload = () => res(reader.result as string)
        reader.onerror = rej
        reader.readAsDataURL(file)
      })

      const res = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: imageBase64, mediaType: file.type })
      })

      const json = await res.json()
      if (json.success && json.data) {
        setStatus('ok')
        onResult(json.data, imageBase64)
      } else {
        setStatus('error')
        setErrorMsg(json.error || 'Nu am putut citi CI-ul')
      }
    } catch (e: any) {
      setStatus('error')
      setErrorMsg(e.message)
    } finally {
      setScanning(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={compact ? 'inline-flex items-center gap-2' : 'w-full'}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={scanning}
        className={`flex items-center gap-2 font-medium transition-colors disabled:opacity-60 ${
          compact
            ? 'px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50'
            : 'w-full justify-center px-4 py-2.5 text-sm rounded-xl border-2 border-dashed border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-400'
        }`}
      >
        {scanning
          ? <><Loader2 size={compact?13:16} className="animate-spin"/> Citesc CI...</>
          : <><ScanLine size={compact?13:16}/> {compact ? 'Scan CI' : '📷 Fotografiază / Încarcă CI'}</>
        }
      </button>
      {status === 'ok' && (
        <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
          <CheckCircle size={13}/> Date extrase!
        </span>
      )}
      {status === 'error' && (
        <span className="flex items-center gap-1 text-xs text-red-500" title={errorMsg}>
          <AlertCircle size={13}/> Eroare scan
        </span>
      )}
    </div>
  )
}