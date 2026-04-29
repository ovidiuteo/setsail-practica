'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ship, Pen, RotateCcw, Check } from 'lucide-react'

type Step = 'login' | 'select' | 'confirm' | 'sign' | 'done'

export default function PortalPage() {
  const [step, setStep] = useState<Step>('login')
  const [code, setCode] = useState('')
  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Signature canvas
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  useEffect(() => {
    // Pre-fill code from URL
    const params = new URLSearchParams(window.location.search)
    const c = params.get('cod')
    if (c) setCode(c.toUpperCase())
  }, [])

  async function login() {
    setError('')
    if (!code.trim()) { setError('Introduceți codul sesiunii.'); return }
    const { data: s } = await supabase
      .from('sessions')
      .select('*, locations(name, county), instructors(full_name), evaluators(full_name), boats(name)')
      .eq('access_code', code.toUpperCase().trim())
      .single()
    if (!s) { setError('Codul sesiunii nu a fost găsit. Verificați codul primit.'); return }
    if (s.status === 'draft') { setError('Sesiunea nu este activă încă. Contactați instructorul.'); return }
    const { data: sts } = await supabase.from('students').select('*').eq('session_id', s.id).order('order_in_session')
    setSession(s)
    setStudents(sts || [])
    setStep('select')
  }

  function selectStudent(s: any) {
    setSelected(s)
    if (s.email) setEmail(s.email)
    setStep('confirm')
  }

  function startSign() {
    setStep('sign')
    setTimeout(() => initCanvas(), 100)
  }

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#0a1628'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    return { x: (e.clientX - rect.left) * (canvas.width / rect.width), y: (e.clientY - rect.top) * (canvas.height / rect.height) }
  }

  function onMouseDown(e: React.MouseEvent) {
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e.nativeEvent, canvas)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e.nativeEvent, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault()
    drawing.current = true
    const canvas = canvasRef.current!
    lastPos.current = getPos(e.touches[0], canvas)
  }

  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e.touches[0], canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
  }

  function clearCanvas() { initCanvas() }

  async function submitSignature() {
    const canvas = canvasRef.current!
    const sig = canvas.toDataURL('image/png')
    setSaving(true)
    await supabase.from('students').update({
      portal_status: 'signed',
      signature_data: sig,
      signed_at: new Date().toISOString(),
      email: email || selected.email,
    }).eq('id', selected.id)
    setStep('done')
    setSaving(false)
  }

  const inputCls = "w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4" style={{ background: '#f5c842' }}>
            <Ship size={28} style={{ color: '#0a1628' }} />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>SetSail</h1>
          <p className="text-white/50 text-sm mt-1">Portal examen practic</p>
        </div>

        {/* Login */}
        {step === 'login' && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="font-bold text-gray-900 mb-1">Cod sesiune</h2>
            <p className="text-sm text-gray-400 mb-5">Introduceți codul primit de la instructor</p>
            <input className={inputCls} value={code} onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="ex: A3F2B1C8" onKeyDown={e => e.key === 'Enter' && login()} maxLength={20} />
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            <button onClick={login}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#0a1628' }}
            >
              Accesează sesiunea
            </button>
          </div>
        )}

        {/* Select student */}
        {step === 'select' && session && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <div className="mb-5">
              <h2 className="font-bold text-gray-900">Selectați-vă numele</h2>
              <div className="text-xs text-gray-400 mt-1">
                📅 {new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' · '}📍 {session.locations?.name}
              </div>
            </div>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {students.filter(s => s.portal_status !== 'signed').length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Toți cursanții au semnat deja.</p>
              ) : students.filter(s => s.portal_status !== 'signed').map(s => (
                <button key={s.id} onClick={() => selectStudent(s)}
                  className="w-full text-left px-4 py-3 rounded-xl border border-gray-100 hover:border-blue-300 hover:bg-blue-50 transition-all">
                  <div className="font-medium text-sm text-gray-900">{s.full_name}</div>
                  {s.cnp && <div className="text-xs text-gray-400 mt-0.5">CNP: {s.cnp}</div>}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Confirm data */}
        {step === 'confirm' && selected && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="font-bold text-gray-900 mb-1">Confirmați datele</h2>
            <p className="text-sm text-gray-400 mb-5">Verificați că informațiile de mai jos vă aparțin</p>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
              <div>
                <div className="text-xs text-gray-400">Nume și prenume</div>
                <div className="font-semibold text-gray-900">{selected.full_name}</div>
              </div>
              {selected.cnp && <div>
                <div className="text-xs text-gray-400">CNP</div>
                <div className="font-mono text-sm text-gray-700">{selected.cnp}</div>
              </div>}
              {selected.id_document && <div>
                <div className="text-xs text-gray-400">Document identitate</div>
                <div className="text-sm text-gray-700">{selected.id_document}</div>
              </div>}
              <div>
                <div className="text-xs text-gray-400">Clasa CAA</div>
                <div className="text-sm text-gray-700">{selected.class_caa}</div>
              </div>
            </div>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1.5">Email de contact (opțional)</div>
              <input className={inputCls} value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@exemplu.ro" type="email" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setStep('select')}
                className="flex-1 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                ← Înapoi
              </button>
              <button onClick={startSign}
                className="flex-2 flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: '#0a1628' }}
              >
                <Pen size={14} /> Semnează
              </button>
            </div>
          </div>
        )}

        {/* Signature */}
        {step === 'sign' && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="font-bold text-gray-900 mb-1">Semnătură</h2>
            <p className="text-xs text-gray-400 mb-4">Semnați în zona de mai jos cu degetul sau mouse-ul</p>
            <div className="border-2 border-dashed border-gray-200 rounded-xl overflow-hidden mb-4 bg-gray-50 relative">
              <canvas ref={canvasRef} width={420} height={180}
                className="signature-canvas w-full block"
                onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                onMouseUp={() => { drawing.current = false }}
                onMouseLeave={() => { drawing.current = false }}
                onTouchStart={onTouchStart} onTouchMove={onTouchMove}
                onTouchEnd={() => { drawing.current = false }}
                style={{ cursor: 'crosshair', touchAction: 'none' }}
              />
              <div className="absolute bottom-2 left-0 right-0 border-t border-gray-200 mx-4 pointer-events-none" />
            </div>
            <div className="flex gap-2">
              <button onClick={clearCanvas}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
                <RotateCcw size={13} /> Șterge
              </button>
              <button onClick={submitSignature} disabled={saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: '#059669' }}
              >
                <Check size={14} /> {saving ? 'Se salvează...' : 'Confirmă semnătura'}
              </button>
            </div>
          </div>
        )}

        {/* Done */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#d1fae5' }}>
              <Check size={32} style={{ color: '#059669' }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmat!</h2>
            <p className="text-sm text-gray-500 mb-1">Semnătura dvs. a fost înregistrată.</p>
            <p className="text-sm text-gray-500">
              <span className="font-medium">{selected?.full_name}</span>
            </p>
            <div className="mt-6 p-4 bg-amber-50 rounded-xl text-xs text-amber-700">
              Prezentați-vă la instructor pentru continuarea examinării practice.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
