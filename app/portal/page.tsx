'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ship, RotateCcw, Check, Upload, Loader2, CheckCircle, AlertCircle, Camera } from 'lucide-react'
import CIImageEditor from '@/components/CIImageEditor'

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
  const [pendingFile, setPendingFile] = useState<File|null>(null)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [existingSignature, setExistingSignature] = useState<string | null>(null)
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set())

  const [form, setForm] = useState({
    phone: '', birth_date: '', ci_series: '', ci_number: '',
    address: '', county: '', city: '', country: 'Romania', email: '', cnp: '', full_name: '', expiry_date: '', nationality: ''
  })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const hasDrawn = useRef(false)
  const ciInputRef = useRef<HTMLInputElement>(null)

  const baseCls = "w-full rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 border-2 bg-white transition-colors"

  function ciFieldCls(value: string, isValid: boolean) {
    if (!value.trim()) return baseCls + ' border-gray-200 focus:ring-blue-400'
    if (isValid) return baseCls + ' border-green-500 bg-green-50 focus:ring-green-400'
    return baseCls + ' border-red-400 bg-red-50 focus:ring-red-400'
  }

  const labelCls = "block text-xs font-medium text-gray-600 mb-1.5"
  const inputCls = baseCls + ' border-gray-200 focus:ring-blue-400'

  function fieldCls(key: string, value?: string) {
    const val = value ?? (form as any)[key] ?? ''
    if (!val.trim()) return baseCls + ' border-red-300 bg-red-50/40 focus:ring-red-300'
    if (scannedFields.has(key)) return baseCls + ' border-green-500 bg-green-50 focus:ring-green-400'
    return baseCls + ' border-blue-300 bg-blue-50/30 focus:ring-blue-400'
  }



  // Validare CI
  const ciSeriesValid = /^[A-Z]{2}$/.test(form.ci_series.trim()) // PP pentru pasaport, sau serie CI
  const ciNumberValid = /^\d{6,9}$/.test(form.ci_number.trim()) // 6-7 pentru CI, 9 pentru pasaport
  const canSave = ciSeriesValid && ciNumberValid

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('cod')
    if (c) setCode(c.toUpperCase())
  }, [])

  // Incarca semnatura existenta in canvas dupa ce step devine confirm
  useEffect(() => {
    if (step !== 'confirm') return
    // Asteptam ca canvas-ul sa fie montat
    const timer = setTimeout(() => {
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
      if (existingSignature) {
        const img = new Image()
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
          setSignatureSaved(true)
        }
        img.src = existingSignature
      } else {
        setSignatureSaved(false)
      }
    }, 200)
    return () => clearTimeout(timer)
  }, [step, existingSignature])

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
      cnp: st.cnp || '',
      full_name: st.full_name || '',
      expiry_date: st.expiry_date || '',
      nationality: st.nationality || '',
      city: st.city || '',
      country: st.country || 'Romania',
    })
    setExistingSignature(st.signature_data || null)
    setStep('confirm')
  }

  // Canvas semnătură
  function initCanvas(existingSig?: string) {
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
    // Daca exista semnatura anterioara, o afisam
    if (existingSig) {
      const img = new Image()
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      img.src = existingSig
      setSignatureSaved(true)
    }
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

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    hasDrawn.current = false
    setSignatureSaved(false)
  }

  async function saveSignature() {
    if (!hasDrawn.current) return
    const canvas = canvasRef.current!
    const sig = canvas.toDataURL('image/png')
    await supabase.from('students').update({ signature_data: sig }).eq('id', student.id)
    setSignatureSaved(true)
  }

  // OCR via server-side API
  async function autoSave(extraData?: any) {
    if (!student?.id) return
    const data: any = {
      phone: form.phone,
      birth_date: form.birth_date,
      ci_series: form.ci_series.trim().toUpperCase(),
      ci_number: form.ci_number.trim(),
      cnp: form.cnp.trim(),
      address: form.address,
      county: form.county,
      email: form.email,
      expiry_date: form.expiry_date.trim(),
      nationality: form.nationality.trim(),
      city: form.city.trim(),
      country: form.country.trim() || 'Romania',
      ...(form.full_name.trim() ? { full_name: form.full_name.trim() } : {}),
      ...extraData,
    }
    await supabase.from('students').update(data).eq('id', student.id)
  }


  async function handleCIUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    if (ciInputRef.current) ciInputRef.current.value = ''
  }

  async function processImageForOCR(dataUrl: string, mediaType: string) {
    setOcrStatus('loading')
    // Salvam imaginea direct in Supabase INAINTE de OCR (evitam limita Vercel 4.5MB)
    if (student?.id) {
      await supabase.from('students').update({ ci_image_data: dataUrl }).eq('id', student.id)
    }
    try {
      const res = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType: mediaType || 'image/jpeg' })
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setOcrStatus('error'); return }
      const d = json.data
      const fullNameFromCI = (d.last_name && d.first_name)
        ? d.last_name.toUpperCase() + ' ' + d.first_name.toUpperCase() : ''
      setForm(f => ({
        ...f,
        ...(d.ci_series   ? { ci_series: d.ci_series }     : {}),
        ...(d.ci_number   ? { ci_number: d.ci_number }     : {}),
        ...(d.cnp         ? { cnp: d.cnp }                 : {}),
        ...(d.birth_date  ? { birth_date: d.birth_date }   : {}),
        ...(d.address     ? { address: d.address }         : {}),
        ...(d.county      ? { county: d.county }           : {}),
        ...(d.expiry_date ? { expiry_date: d.expiry_date } : {}),
        ...(d.nationality ? { nationality: d.nationality } : {}),
        ...(d.city       ? { city: d.city }           : {}),
        ...(d.country    ? { country: d.country }     : {}),
        ...(fullNameFromCI ? { full_name: fullNameFromCI } : {}),
      }))
      // Salveaza datele OCR (imaginea e deja salvata)
      const ocrSave: any = {
        ci_image_data: dataUrl,  // suprascrie cu aceeasi imagine (confirmare)
        ...(d.ci_series    ? { ci_series: d.ci_series }     : {}),
        ...(d.ci_number    ? { ci_number: d.ci_number }     : {}),
        ...(d.cnp          ? { cnp: d.cnp }                 : {}),
        ...(d.birth_date   ? { birth_date: d.birth_date }   : {}),
        ...(d.address      ? { address: d.address }         : {}),
        ...(d.county       ? { county: d.county }           : {}),
        ...(d.expiry_date  ? { expiry_date: d.expiry_date } : {}),
        ...(d.nationality  ? { nationality: d.nationality } : {}),
        ...(d.city         ? { city: d.city }               : {}),
        ...(d.country      ? { country: d.country }         : {}),
        ...(fullNameFromCI ? { full_name: fullNameFromCI }  : {}),
      }
      await supabase.from('students').update(ocrSave).eq('id', student.id)
      // Actualizeaza studentul in state cu imaginea noua
      setStudent((prev: any) => prev ? { ...prev, ...ocrSave } : prev)
      // Marcam campurile venite din scan
      const sf = new Set<string>()
      if (d.ci_series)   sf.add('ci_series')
      if (d.ci_number)   sf.add('ci_number')
      if (d.cnp)         sf.add('cnp')
      if (d.birth_date)  sf.add('birth_date')
      if (d.address)     sf.add('address')
      if (d.city)        sf.add('city')
      if (d.county)      sf.add('county')
      if (d.expiry_date) sf.add('expiry_date')
      if (d.nationality) sf.add('nationality')
      if (d.country)     sf.add('country')
      if (fullNameFromCI) sf.add('full_name')
      setScannedFields(sf)
      setOcrStatus('done')
    } catch (err) {
      console.error('OCR error:', err)
      setOcrStatus('error')
    }
  }

  async function saveAll() {
    setSaving(true)

    // Salvează semnătura dacă există
    let sigData: string | null = null
    if (hasDrawn.current) {
      sigData = canvasRef.current!.toDataURL('image/png')
    }


    const updateData: any = {
      portal_status: 'signed',
      signed_at: new Date().toISOString(),
      phone: form.phone,
      birth_date: form.birth_date,
      ci_series: form.ci_series.trim().toUpperCase(),
      ci_number: form.ci_number.trim(),
      cnp: form.cnp.trim(),
      address: form.address,
      county: form.county,
      email: form.email,
      expiry_date: form.expiry_date.trim(),
      nationality: form.nationality.trim(),
      city: form.city.trim(),
      country: form.country.trim() || 'Romania',
      id_document: `${form.ci_series.trim().toUpperCase()} ${form.ci_number.trim()}`,
    }
    if (sigData) updateData.signature_data = sigData
    if (form.full_name.trim()) updateData.full_name = form.full_name.trim()

    await supabase.from('students').update(updateData).eq('id', student.id)
    setStep('done')
    setSaving(false)
  }
  // Stiluri câmpuri CI cu validare vizuală

  function SaveDataButton({ onSave }: { onSave: () => Promise<void> }) {
    const [st, setSt] = useState<'idle'|'saving'|'saved'>('idle')
    return (
      <button onClick={async()=>{
        setSt('saving')
        await onSave()
        setSt('saved')
        setTimeout(()=>setSt('idle'), 2500)
      }} disabled={st==='saving'}
        className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium transition-all border ${
          st==='saved' ? 'border-green-400 text-green-600 bg-green-50'
          : st==='saving' ? 'border-gray-200 text-gray-400'
          : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
        {st==='saved' ? <><Check size={12}/> Salvat!</>
         : st==='saving' ? <>⏳ Salvez...</>
         : <><Check size={12}/> Salvează date</>}
      </button>
    )
  }

  if (pendingFile) return (
    <CIImageEditor
      file={pendingFile}
      onConfirm={(dataUrl, mediaType) => { setPendingFile(null); setOcrStatus('loading'); fetch('/api/ocr-ci', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({imageData:dataUrl,mediaType})}).then(r=>r.json()).then(json=>{if(json.success&&json.data){const d=json.data;const fn=(d.last_name&&d.first_name)?d.last_name.toUpperCase()+' '+d.first_name.toUpperCase():'';setForm(f=>({...f,...(d.ci_series?{ci_series:d.ci_series}:{}),...(d.ci_number?{ci_number:d.ci_number}:{}),...(d.cnp?{cnp:d.cnp}:{}),...(d.birth_date?{birth_date:d.birth_date}:{}),...(d.address?{address:d.address}:{}),...(d.county?{county:d.county}:{}),...(d.expiry_date?{expiry_date:d.expiry_date}:{}),...(d.nationality?{nationality:d.nationality}:{}),...(fn?{full_name:fn}:{})}));setOcrStatus('done')}else{setOcrStatus('error')}}).catch(()=>setOcrStatus('error')) }}
      onCancel={() => setPendingFile(null)}
    />
  )

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
              <p className="text-xs text-gray-400 mb-2">Verificați și completați informațiile</p>
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
              <span className="text-base leading-none">⚠️</span>
              <span><strong>Diacriticele și cratima din CI contează la nume</strong> — scrieți exact cum apare în cartea de identitate (ex: Răzvan-Andrei, Căpățână).</span>
            </div>
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
                    accept="image/*,application/pdf"
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

              {/* Câmpuri CI / Pașaport — cu validare */}
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelCls}>
                    Serie CI / Tip doc *
                    {form.ci_series.trim() && (
                      ciSeriesValid
                        ? <span className="ml-1 text-green-600 font-semibold">✓</span>
                        : <span className="ml-1 text-red-500">✗</span>
                    )}
                  </label>
                  <input
                    className={ciFieldCls(form.ci_series, ciSeriesValid)}
                    value={form.ci_series}
                    placeholder="AB sau PP"
                    maxLength={2}
                    onChange={e => setForm(f => ({ ...f, ci_series: e.target.value.toUpperCase() }))}
                  />
                  {form.ci_series.trim() && !ciSeriesValid && (
                    <p className="text-xs text-red-500 mt-1">2 litere (ex: AB, IF) sau PP pentru pașaport</p>
                  )}
                </div>
                <div>
                  <label className={labelCls}>
                    Număr CI / Pașaport *
                    {form.ci_number.trim() && (
                      ciNumberValid
                        ? <span className="ml-1 text-green-600 font-semibold">✓</span>
                        : <span className="ml-1 text-red-500">✗</span>
                    )}
                  </label>
                  <input
                    className={ciFieldCls(form.ci_number, ciNumberValid)}
                    value={form.ci_number}
                    placeholder="123456 / 1234567 / 058339673"
                    maxLength={7}
                    onChange={e => setForm(f => ({ ...f, ci_number: e.target.value.replace(/\D/g, '') }))}
                  />
                  {form.ci_number.trim() && !ciNumberValid && (
                    <p className="text-xs text-red-500 mt-1">6-7 cifre (CI) sau 9 cifre (pașaport)</p>
                  )}
                </div>
              </div>

              {/* Helper: indicator camp */}
              <div className="space-y-3">
                {ocrStatus === 'done' && (
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50 inline-block"/><span className="text-white/60">Din CI</span></span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-50/30 inline-block"/><span className="text-white/60">Completat manual</span></span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-red-300 bg-red-50/40 inline-block"/><span className="text-white/60">Lipsă</span></span>
                  </div>
                )}

                {/* Nume / Prenume */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Nume (din CI)</label>
                    <input className={fieldCls('full_name', form.full_name.split(' ')[0])}
                      value={form.full_name.split(' ')[0] || ''} placeholder="POPESCU"
                      onChange={e => {
                        const parts = form.full_name.split(' ')
                        parts[0] = e.target.value.toUpperCase()
                        setForm(f => ({ ...f, full_name: parts.join(' ') }))
                        setScannedFields(s => { const n = new Set(s); n.delete('full_name'); return n })
                      }} />
                  </div>
                  <div>
                    <label className={labelCls}>Prenume (din CI)</label>
                    <input className={fieldCls('full_name', form.full_name.split(' ').slice(1).join(' '))}
                      value={form.full_name.split(' ').slice(1).join(' ') || ''} placeholder="ION GABRIEL"
                      onChange={e => {
                        const parts = form.full_name.split(' ')
                        setForm(f => ({ ...f, full_name: ((parts[0]||'')+' '+e.target.value.toUpperCase()).trim() }))
                        setScannedFields(s => { const n = new Set(s); n.delete('full_name'); return n })
                      }} />
                  </div>
                </div>

                {/* CNP + Data nasterii */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>CNP</label>
                    <input className={fieldCls('cnp')} value={form.cnp} placeholder="1234567890123" maxLength={13}
                      onChange={e => { setForm(f=>({...f,cnp:e.target.value.replace(/\D/g,'')})); setScannedFields(s=>{const n=new Set(s);n.delete('cnp');return n}) }} />
                  </div>
                  <div>
                    <label className={labelCls}>Data nașterii</label>
                    <input className={fieldCls('birth_date')} value={form.birth_date} placeholder="dd.mm.yyyy"
                      onChange={e => { setForm(f=>({...f,birth_date:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('birth_date');return n}) }} />
                  </div>
                </div>

                {/* Adresa */}
                <div>
                  <label className={labelCls}>Adresă domiciliu (stradă, număr, bloc, apartament)</label>
                  <input className={fieldCls('address')} value={form.address} placeholder="Str. Exemplu nr. 1, Bl. X, Ap. Y"
                    onChange={e => { setForm(f=>({...f,address:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('address');return n}) }} />
                </div>

                {/* Localitate + Judet */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Localitate</label>
                    <input className={fieldCls('city')} value={form.city} placeholder="ex: București"
                      onChange={e => { setForm(f=>({...f,city:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('city');return n}) }} />
                  </div>
                  <div>
                    <label className={labelCls}>Județ / Sector</label>
                    <input className={fieldCls('county')} value={form.county} placeholder="ex: Sector 3 / Ilfov"
                      onChange={e => { setForm(f=>({...f,county:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('county');return n}) }} />
                  </div>
                </div>

                {/* Tara + Expirare CI */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Țară</label>
                    <input className={fieldCls('country')} value={form.country} placeholder="Romania"
                      onChange={e => { setForm(f=>({...f,country:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('country');return n}) }} />
                  </div>
                  <div>
                    <label className={labelCls}>Data expirării CI</label>
                    <input className={fieldCls('expiry_date')} value={form.expiry_date} placeholder="dd.mm.yyyy"
                      onChange={e => { setForm(f=>({...f,expiry_date:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('expiry_date');return n}) }} />
                  </div>
                </div>

                {/* Cetatenie */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Cetățenie</label>
                    <input className={fieldCls('nationality')} value={form.nationality} placeholder="ROU"
                      onChange={e => { setForm(f=>({...f,nationality:e.target.value.toUpperCase()})); setScannedFields(s=>{const n=new Set(s);n.delete('nationality');return n}) }} />
                  </div>
                  <div>
                    <label className={labelCls}>Email</label>
                    <input className={fieldCls('email')} type="email" value={form.email}
                      onChange={e => { setForm(f=>({...f,email:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('email');return n}) }} />
                  </div>
                </div>

                {/* Telefon */}
                <div>
                  <label className={labelCls}>Telefon</label>
                  <input className={fieldCls('phone')} type="tel" value={form.phone} placeholder="07XX XXX XXX"
                    onChange={e => { setForm(f=>({...f,phone:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('phone');return n}) }} />
                </div>
              </div>
              {/* Buton Salvează date - compact, dreapta */}
              <div className="flex justify-end mt-3">
                <button onClick={async () => { await autoSave(); }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  <Check size={12}/> Salvează date
                </button>
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
                <button onClick={saveSignature}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                    signatureSaved
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-200'
                  }`}>
                  {signatureSaved
                    ? <><CheckCircle size={14} /> Salvată ✓ (apasă din nou pentru a înlocui)</>
                    : <><Check size={14} /> Salvează</>}
                </button>
              </div>
              {signatureSaved && (
                <p className="text-xs text-green-600 text-center mt-2 flex items-center justify-center gap-1">
                  <CheckCircle size={11} /> Semnătura a fost salvată în baza de date
                </p>
              )}

              {/* Buton final Salvează și finalizează */}
              <div className="mt-4">
                <button onClick={saveAll} disabled={saving || !canSave}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold text-white shadow-lg transition-all ${
                    canSave ? 'opacity-100 hover:opacity-90' : 'opacity-50 cursor-not-allowed'
                  }`}
                  style={{ background: canSave ? '#0a1628' : '#6b7280' }}>
                  {saving ? 'Se salvează...' : student?.portal_status === 'signed' ? '✓ Actualizează datele' : '✓ Salvează și finalizează'}
                </button>
                {!canSave && (
                  <p className="text-amber-600 text-xs text-center mt-2 flex items-center justify-center gap-1.5">
                    <AlertCircle size={12} />
                    Seria și numărul CI sunt obligatorii
                  </p>
                )}
              </div>
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