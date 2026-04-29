'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ship, RotateCcw, Check, Upload, Loader2, CheckCircle, AlertCircle, Camera } from 'lucide-react'

type Step = 'login' | 'confirm' | 'done'

export default function PortalPage() {
  const [step, setStep] = useState<Step>('login')
  const [code, setCode] = useState('')
  const [emailInput, setEmailInput] = useState('')
  const [session, setSession] = useState<any>(null)
  const [student, setStudent] = useState<any>(null)
  const [loginError, setLoginError] = useState('')
  const [saving, setSaving] = useState(false)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [signatureSaved, setSignatureSaved] = useState(false)

  const [form, setForm] = useState({
    phone: '', birth_date: '', ci_series: '', ci_number: '',
    address: '', county: '', email: ''
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasDrawn = useRef(false)
  const ciInputRef = useRef<HTMLInputElement>(null)

  // Validare CI
  const ciSeriesValid = /^[A-Z]{2}$/.test(form.ci_series.trim())
  const ciNumberValid = /^\d{6}$/.test(form.ci_number.trim())
  const canSave = ciSeriesValid && ciNumberValid

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('cod')
    if (c) setCode(c.toUpperCase())
  }, [])

  async function login() {
    setLoginError('')
    if (!code.trim()) { setLoginError('Introduceți codul sesiunii.'); return }
    if (!emailInput.trim()) { setLoginError('Introduceți adresa de email.'); return }

    const { data: s } = await supabase
      .from('sessions')
      .select('*, locations(name), instructors(full_name)')
      .eq('access_code', code.toUpperCase().trim())
      .single()

    if (!s) { setLoginError('Codul sesiunii nu a fost găsit.'); return }
    if (s.status === 'draft') { setLoginError('Sesiunea nu este activă încă. Contactați instructorul.'); return }
    if (s.status === 'completed') { setLoginError('Această sesiune a fost finalizată și nu mai acceptă conexiuni.'); return }

    const { data: st } = await supabase
      .from('students')
      .select('*')
      .eq('session_id', s.id)
      .ilike('email', emailInput.trim())
      .single()

    if (!st) { setLoginError('Email-ul nu a fost găsit în această sesiune. Verificați adresa sau contactați instructorul.'); return }
    // Cursantii care au semnat pot reveni oricand sa modifice datele

    setSession(s)
    setStudent(st)
    setForm({
      phone: st.phone || '',
      birth_date: st.birth_date || '',
      ci_series: st.ci_series || '',
      ci_number: st.ci_number || '',
      address: st.address || '',
      county: st.county || '',
      email: st.email || emailInput.trim(),
    })
    setStep('confirm')
    setTimeout(() => initCanvas(), 300)
  }

  // Canvas semnătură
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
    hasDrawn.current = false
    setSignatureSaved(false)
  }

  function getPos(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height)
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    drawing.current = true; hasDrawn.current = true
    lastPos.current = getPos(e.nativeEvent, canvasRef.current!)
  }
  function onMouseMove(e: React.MouseEvent) {
    if (!drawing.current) return
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    const pos = getPos(e.nativeEvent, canvas)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
  }
  function onTouchStart(e: React.TouchEvent) {
    e.preventDefault(); drawing.current = true; hasDrawn.current = true
    lastPos.current = getPos(e.touches[0], canvasRef.current!)
  }
  function onTouchMove(e: React.TouchEvent) {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current!; const ctx = canvas.getContext('2d')!
    const pos = getPos(e.touches[0], canvas)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y); ctx.stroke()
    lastPos.current = pos
  }

  function clearCanvas() { initCanvas() }

  async function saveSignature() {
    if (!hasDrawn.current) return
    const canvas = canvasRef.current!
    const sig = canvas.toDataURL('image/png')
    await supabase.from('students').update({ signature_data: sig }).eq('id', student.id)
    setSignatureSaved(true)
  }

  // OCR via server-side API
  async function handleCIUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setOcrStatus('loading')

    const reader = new FileReader()
    reader.onload = async (ev) => {
      const imageData = ev.target?.result as string
      const mediaType = file.type || 'image/jpeg'

      try {
        const res = await fetch('/api/ocr-ci', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageData, mediaType })
        })

        const json = await res.json()

        if (!res.ok || !json.success) {
          setOcrStatus('error')
          return
        }

        const d = json.data
        setForm(f => ({
          ...f,
          ci_series: d.ci_series || f.ci_series,
          ci_number: d.ci_number || f.ci_number,
          birth_date: d.birth_date || f.birth_date,
          address: d.address || f.address,
          county: d.county || f.county,
        }))

        // Salvează imaginea CI
        await supabase.from('students')
          .update({ ci_image_data: imageData })
          .eq('id', student.id)

        setOcrStatus('done')
      } catch (err) {
        console.error('OCR error:', err)
        setOcrStatus('error')
      }
    }
    reader.readAsDataURL(file)
    if (ciInputRef.current) ciInputRef.current.value = ''
  }

  async function saveAll() {
    setSaving(true)

    // Salvează semnătura dacă există
    let sigData: string | null = null
    if (hasDrawn.current) {
      sigData = canvasRef.current!.toDataURL('image/png')
    }

    await supabase.from('students').update({
      portal_status: 'signed',
      signed_at: new Date().toISOString(),
      phone: form.phone,
      birth_date: form.birth_date,
      ci_series: form.ci_series.trim().toUpperCase(),
      ci_number: form.ci_number.trim(),
      address: form.address,
      county: form.county,
      email: form.email,
      id_document: `${form.ci_series.trim().toUpperCase()} ${form.ci_number.trim()}`,
      ...(sigData ? { signature_data: sigData } : {}),
    }).eq('id', student.id)

    setStep('done')
    setSaving(false)
  }

  // Stiluri câmpuri CI cu validare vizuală
  const baseCls = "w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 border-2 bg-white transition-colors"

  function ciFieldCls(value: string, isValid: boolean) {
    if (!value.trim()) return baseCls + ' border-gray-200 focus:ring-blue-400'
    if (isValid) return baseCls + ' border-green-500 bg-green-50 focus:ring-green-400'
    return baseCls + ' border-red-400 bg-red-50 focus:ring-red-400'
  }

  const labelCls = "block text-xs font-medium text-gray-600 mb-1.5"
  const inputCls = baseCls + ' border-gray-200 focus:ring-blue-400'

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pb-16"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>
      <div className="w-full max-w-lg mt-8">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: '#f5c842' }}>
            <Ship size={28} style={{ color: '#0a1628' }} />
          </div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>SetSail</h1>
          <p className="text-white/50 text-sm mt-1">Portal examen practic</p>
        </div>

        {/* ── LOGIN ── */}
        {step === 'login' && (
          <div className="bg-white rounded-2xl p-6 shadow-2xl">
            <h2 className="font-bold text-gray-900 mb-1">Accesați sesiunea</h2>
            <p className="text-sm text-gray-400 mb-5">Cod sesiune + email-ul dvs. de contact</p>
            <div className="space-y-3">
              <div>
                <label className={labelCls}>Cod sesiune</label>
                <input className={inputCls} value={code}
                  onChange={e => setCode(e.target.value.toUpperCase())}
                  placeholder="ex: 29378D99" maxLength={20} />
              </div>
              <div>
                <label className={labelCls}>Adresa de email</label>
                <input className={inputCls} type="email" value={emailInput}
                  onChange={e => setEmailInput(e.target.value)}
                  placeholder="email@exemplu.ro"
                  onKeyDown={e => e.key === 'Enter' && login()} />
              </div>
            </div>
            {loginError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                {loginError}
              </div>
            )}
            <button onClick={login}
              className="w-full mt-4 py-3 rounded-xl text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ background: '#0a1628' }}>
              Accesează →
            </button>
          </div>
        )}

        {/* ── CONFIRM ── */}
        {step === 'confirm' && student && (
          <div className="space-y-4">

            {/* Date personale */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <h2 className="font-bold text-gray-900 mb-1">Date personale</h2>
              <p className="text-xs text-gray-400 mb-4">Verificați și completați informațiile</p>
            {student?.portal_status === 'signed' && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-700 flex items-center gap-2">
                <CheckCircle size={14} className="shrink-0" />
                Ați completat deja această fișă. Puteți modifica orice informație și salva din nou.
              </div>
            )}

              {/* Info fixă */}
              <div className="bg-gray-50 rounded-xl p-3 mb-5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Nume</span>
                  <span className="text-sm font-semibold text-gray-900">{student.full_name}</span>
                </div>
                {student.cnp && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">CNP</span>
                    <span className="text-xs font-mono text-gray-700">{student.cnp}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Clasa CAA</span>
                  <span className="text-xs font-medium text-gray-700">{student.class_caa}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Sesiune</span>
                  <span className="text-xs text-gray-700">
                    {new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })} · {session.locations?.name}
                  </span>
                </div>
              </div>

              {/* Upload CI + OCR */}
              <div className="mb-5">
                <label className={labelCls}>
                  <Camera size={13} className="inline mr-1.5" />
                  Fotografiați / Scanați Cartea de Identitate
                  <span className="ml-1 text-blue-500 font-normal">(completare automată)</span>
                </label>
                <label className={`
                  flex items-center justify-center gap-3 w-full px-4 py-4 rounded-xl border-2 border-dashed cursor-pointer transition-all
                  ${ocrStatus === 'loading' ? 'border-blue-300 bg-blue-50' :
                    ocrStatus === 'done' ? 'border-green-400 bg-green-50' :
                    ocrStatus === 'error' ? 'border-red-300 bg-red-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}
                `}>
                  {ocrStatus === 'loading' && (
                    <><Loader2 size={18} className="text-blue-500 animate-spin" />
                    <span className="text-sm text-blue-600 font-medium">Se citește CI-ul, vă rugați așteptați...</span></>
                  )}
                  {ocrStatus === 'done' && (
                    <><CheckCircle size={18} className="text-green-600" />
                    <span className="text-sm text-green-700 font-medium">CI citit cu succes! Verificați câmpurile completate.</span></>
                  )}
                  {ocrStatus === 'error' && (
                    <><AlertCircle size={18} className="text-red-500" />
                    <span className="text-sm text-red-600">Eroare la citire. Încercați din nou sau completați manual.</span></>
                  )}
                  {ocrStatus === 'idle' && (
                    <><Upload size={18} className="text-gray-400" />
                    <div>
                      <div className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca foto CI</div>
                      <div className="text-xs text-gray-400 mt-0.5">JPG, PNG, HEIC — față CI</div>
                    </div></>
                  )}
                  <input
                    ref={ciInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleCIUpload}
                    disabled={ocrStatus === 'loading'}
                  />
                </label>
                {ocrStatus === 'done' && (
                  <button
                    onClick={() => { setOcrStatus('idle'); if (ciInputRef.current) ciInputRef.current.click() }}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">
                    Înlocuiește cu alt CI
                  </button>
                )}
              </div>

              {/* Câmpuri CI — cu validare roșu/verde */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>
                    Serie CI *
                    {form.ci_series.trim() && (
                      ciSeriesValid
                        ? <span className="ml-1 text-green-600 font-semibold">✓</span>
                        : <span className="ml-1 text-red-500">✗</span>
                    )}
                  </label>
                  <input
                    className={ciFieldCls(form.ci_series, ciSeriesValid)}
                    value={form.ci_series}
                    placeholder="AB"
                    maxLength={2}
                    onChange={e => setForm(f => ({ ...f, ci_series: e.target.value.toUpperCase() }))}
                  />
                  {form.ci_series.trim() && !ciSeriesValid && (
                    <p className="text-xs text-red-500 mt-1">Exact 2 litere (ex: AB, CT, IF)</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    Număr CI *
                    {form.ci_number.trim() && (
                      ciNumberValid
                        ? <span className="ml-1 text-green-600 font-semibold">✓</span>
                        : <span className="ml-1 text-red-500">✗</span>
                    )}
                  </label>
                  <input
                    className={ciFieldCls(form.ci_number, ciNumberValid)}
                    value={form.ci_number}
                    placeholder="123456"
                    maxLength={6}
                    onChange={e => setForm(f => ({ ...f, ci_number: e.target.value.replace(/\D/g, '') }))}
                  />
                  {form.ci_number.trim() && !ciNumberValid && (
                    <p className="text-xs text-red-500 mt-1">Exact 6 cifre</p>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Data nașterii</label>
                  <input className={inputCls} value={form.birth_date} placeholder="dd.mm.yyyy"
                    onChange={e => setForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Adresă domiciliu</label>
                  <input className={inputCls} value={form.address} placeholder="Str. Exemplu nr. 1, Bl. X, Ap. Y"
                    onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
                </div>
                <div>
                  <label className={labelCls}>Județ</label>
                  <input className={inputCls} value={form.county} placeholder="ex: Constanța"
                    onChange={e => setForm(f => ({ ...f, county: e.target.value }))} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Email</label>
                    <input className={inputCls} type="email" value={form.email}
                      onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                  <div>
                    <label className={labelCls}>Telefon</label>
                    <input className={inputCls} type="tel" value={form.phone} placeholder="07XX XXX XXX"
                      onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
                  </div>
                </div>
              </div>
            </div>

            {/* Semnătură */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <h2 className="font-bold text-gray-900 mb-1">Semnătură</h2>
              <p className="text-xs text-gray-400 mb-3">Semnați în zona de mai jos cu degetul sau mouse-ul</p>

              <div className={`border-2 rounded-xl overflow-hidden mb-3 transition-all ${signatureSaved ? 'border-green-500' : 'border-dashed border-gray-200'} bg-white`}>
                <canvas ref={canvasRef} width={460} height={160}
                  className="w-full block" style={{ cursor: 'crosshair', touchAction: 'none' }}
                  onMouseDown={onMouseDown} onMouseMove={onMouseMove}
                  onMouseUp={() => { drawing.current = false }}
                  onMouseLeave={() => { drawing.current = false }}
                  onTouchStart={onTouchStart} onTouchMove={onTouchMove}
                  onTouchEnd={() => { drawing.current = false }} />
              </div>

              <div className="flex gap-2">
                <button onClick={clearCanvas}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  <RotateCcw size={13} /> Șterge
                </button>
                <button onClick={saveSignature} disabled={signatureSaved}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    signatureSaved
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}>
                  {signatureSaved
                    ? <><CheckCircle size={14} /> Semnătură salvată</>
                    : <><Check size={14} /> Salvează</>}
                </button>
              </div>
              {signatureSaved && (
                <p className="text-xs text-green-600 text-center mt-2 flex items-center justify-center gap-1">
                  <CheckCircle size={11} /> Semnătura a fost salvată în baza de date
                </p>
              )}
            </div>

            {/* Buton final */}
            <div>
              <button onClick={saveAll} disabled={saving || !canSave}
                className={`w-full py-4 rounded-2xl text-sm font-bold text-white shadow-xl transition-all ${
                  canSave ? 'opacity-100 hover:opacity-90' : 'opacity-50 cursor-not-allowed'
                }`}
                style={{ background: canSave ? '#0a1628' : '#6b7280' }}>
                {saving ? 'Se salvează...' : student?.portal_status === 'signed' ? '✓ Actualizează datele' : '✓ Salvează și finalizează'}
              </button>
              {!canSave && (
                <p className="text-amber-200 text-xs text-center mt-2 flex items-center justify-center gap-1.5">
                  <AlertCircle size={12} />
                  Seria și numărul CI sunt obligatorii pentru a continua
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#d1fae5' }}>
              <Check size={32} style={{ color: '#059669' }} />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Confirmat!</h2>
            <p className="text-sm text-gray-500 mb-1">Datele și semnătura au fost înregistrate.</p>
            <p className="text-sm font-semibold text-gray-900 mb-4">{student?.full_name}</p>
            <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
              Prezentați-vă la instructor pentru continuarea examinării practice.
            </div>
            <button
              onClick={() => { setStep('confirm'); setTimeout(() => initCanvas(), 200) }}
              className="mt-4 w-full py-2.5 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
              ← Înapoi la formular
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
