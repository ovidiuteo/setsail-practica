'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Save, ScanLine, Loader2, CheckCircle,
  AlertCircle, ExternalLink, Trash2, Copy, Check
} from 'lucide-react'
import CIImageEditor from '@/components/CIImageEditor'

type Student = {
  id: string; full_name: string; cnp: string; email: string; phone: string
  birth_date: string; ci_series: string; ci_number: string; ci_image_data: string
  address: string; county: string; city: string; country: string
  class_caa: string; portal_status: string; signed_at: string; session_id: string
  order_in_session: number; communication_target: boolean
  expiry_date: string; nationality: string; signature_data: string
  original_session_id: string; allocated_session_id: string
}

type Session = {
  id: string; session_date: string; session_type: string; access_code: string
  locations: { name: string; county: string } | null
  boats: { name: string } | null
}

const FIELDS: { key: keyof Student; label: string; type?: string; full?: boolean }[] = [
  { key: 'full_name',   label: 'Nume complet',        full: true },
  { key: 'cnp',        label: 'CNP',                  type: 'tel' },
  { key: 'email',      label: 'Email',                type: 'email', full: true },
  { key: 'phone',      label: 'Telefon',              type: 'tel' },
  { key: 'birth_date', label: 'Data nașterii',        type: 'text' },
  { key: 'ci_series',  label: 'Serie CI' },
  { key: 'ci_number',  label: 'Număr CI',             type: 'tel' },
  { key: 'expiry_date',label: 'Expirare CI' },
  { key: 'nationality',label: 'Cetățenie' },
  { key: 'address',    label: 'Adresă',               full: true },
  { key: 'city',       label: 'Localitate' },
  { key: 'county',     label: 'Județ / Sector' },
  { key: 'country',    label: 'Țară' },
  { key: 'class_caa',  label: 'Clasa CAA' },
]

export default function CursantAdminPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [student, setStudent] = useState<Student | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [form, setForm] = useState<Partial<Student>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanStatus, setScanStatus] = useState<'idle' | 'ok' | 'error'>('idle')
  const [copied, setCopied] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [imgKey, setImgKey] = useState(Date.now())
  const ciInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function load() {
      const { data: st } = await supabase.from('students').select('*').eq('id', id).single()
      if (!st) { router.push('/admin/cursanti'); return }
      setStudent(st)
      setForm(st)
      const { data: sess } = await supabase.from('sessions')
        .select('id, session_date, session_type, access_code, locations(name, county), boats(name)')
        .eq('id', st.session_id).single()
      setSession(sess as any)
      setLoading(false)
    }
    load()
  }, [id])

  async function save() {
    if (!student) return
    setSaving(true)
    const updates = { ...form }
    delete (updates as any).id
    delete (updates as any).created_at
    await supabase.from('students').update(updates).eq('id', student.id)
    setStudent({ ...student, ...form } as Student)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    setSaving(false)
  }

  // Comprima imaginea la 800px latime, sub 500KB — dupa OCR, inainte de salvare
  function compressImage(dataUrl: string): Promise<string> {
    return new Promise(resolve => {
      const img = new Image()
      img.onload = () => {
        // Pas 1: scale la 800px latime (proportional cu height)
        const MAX_W = 800
        const scale = Math.min(1, MAX_W / img.width)
        const w = Math.round(img.width * scale)
        const h = Math.round(img.height * scale)
        const tmp = document.createElement('canvas')
        tmp.width = w; tmp.height = h
        tmp.getContext('2d')!.drawImage(img, 0, 0, w, h)
        // Pas 2: verifica la calitate 0.85 - daca e sub 450KB, gata
        let result = tmp.toDataURL('image/jpeg', 0.85)
        const sizeAt85 = Math.round(result.length / 1024)
        if (sizeAt85 <= 450) {
          console.log(`CI: ${w}x${h}px @ Q0.85 → ${sizeAt85}KB ✅`)
          resolve(result); return
        }
        // Pas 3: scade calitatea iterativ pana sub 450KB
        const qualities = [0.75, 0.65, 0.55, 0.45, 0.35]
        for (const q of qualities) {
          result = tmp.toDataURL('image/jpeg', q)
          const sizeKB = Math.round(result.length / 1024)
          console.log(`CI: ${w}x${h}px @ Q${q} → ${sizeKB}KB`)
          if (sizeKB <= 450) { console.log('✅'); break }
        }
        resolve(result)
      }
      img.src = dataUrl
    })
  }

  async function processOCR(dataUrl: string, mediaType: string) {
    setScanning(true)
    setScanStatus('idle')
    try {
      const res = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType })
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const fullName = (d.last_name && d.first_name)
          ? d.last_name.toUpperCase() + ' ' + d.first_name.toUpperCase() : ''
        // Comprima imaginea dupa OCR, inainte de salvare in DB
        const compressedImg = await compressImage(dataUrl)
        const updates: Partial<Student> = { ci_image_data: compressedImg }
        if (d.ci_series)   updates.ci_series = d.ci_series
        if (d.ci_number)   updates.ci_number = d.ci_number
        if (d.cnp)         updates.cnp = d.cnp
        if (d.birth_date)  updates.birth_date = d.birth_date
        if (d.address)     updates.address = d.address
        if (d.city)        updates.city = d.city
        if (d.county)      updates.county = d.county
        if (d.expiry_date) updates.expiry_date = d.expiry_date
        if (d.nationality) updates.nationality = d.nationality
        if (d.country)     updates.country = d.country
        if (fullName)      updates.full_name = fullName
        setForm(f => ({ ...f, ...updates }))
        await supabase.from('students').update(updates).eq('id', id)
        // Re-fetch din DB pentru a garanta ca avem imaginea corecta
        const { data: fresh } = await supabase.from('students').select('*').eq('id', id).single()
        if (fresh) setStudent(fresh)
        else setStudent(s => s ? { ...s, ...updates } : s)
        setForm(f => ({ ...f, ...updates }))
        setImgKey(Date.now()) // forteaza re-render imagine
        setScanStatus('ok')
      } else { setScanStatus('error') }
    } catch { setScanStatus('error') }
    setScanning(false)
  }

  async function deleteStudent() {
    await supabase.from('students').delete().eq('id', id)
    router.push(session ? `/admin/sesiuni/${session.id}` : '/admin/cursanti')
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  const inp = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
  const lbl = "block text-xs font-medium text-gray-500 mb-1.5"

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <Loader2 size={24} className="animate-spin text-gray-400"/>
    </div>
  )
  if (!student) return null

  const ps = { pending: { label: 'Neconectat', color: '#9ca3af' }, signed: { label: 'Semnat', color: '#16a34a' }, absent: { label: 'Absent', color: '#dc2626' } }
  const portalStatus = ps[student.portal_status as keyof typeof ps] || ps.pending

  return (
    <div className="min-h-screen bg-gray-50">
      {pendingFile && (
        <CIImageEditor
          file={pendingFile}
          onConfirm={(dataUrl, mediaType) => { setPendingFile(null); processOCR(dataUrl, mediaType) }}
          onCancel={() => setPendingFile(null)}
        />
      )}
      <input ref={ciInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); e.target.value = '' } }}
      />

      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={session ? `/admin/sesiuni/${session.id}` : '/admin/cursanti'}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
              <ArrowLeft size={18}/>
            </Link>
            <div>
              <h1 className="font-bold text-gray-900 text-lg leading-tight">{student.full_name}</h1>
              {session && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {' · '}{session.locations?.name}
                  {session.session_type === 'clone' && <span className="ml-1 text-blue-400">⎇</span>}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Portal link */}
            {session && (
              <a href={`/portal?cod=${session.access_code}&email=${encodeURIComponent(student.email || '')}`}
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                <ExternalLink size={13}/> Deschide portal
              </a>
            )}
            {/* Save */}
            <button onClick={save} disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-60 transition-all"
              style={{ background: saved ? '#16a34a' : '#0a1628' }}>
              {saved ? <><Check size={14}/> Salvat!</> : saving ? <><Loader2 size={14} className="animate-spin"/> Salvez...</> : <><Save size={14}/> Salvează</>}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-3 gap-6">
        {/* LEFT: Date personale */}
        <div className="col-span-2 space-y-6">

          {/* Date de baza */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-semibold text-gray-900 mb-5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>
              Date personale
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {FIELDS.map(f => (
                <div key={f.key} className={f.full ? 'col-span-2' : ''}>
                  <label className={lbl}>{f.label}</label>
                  <div className="relative">
                    {f.key === 'class_caa' ? (
                      <select className={inp} value={form[f.key] as string || ''}
                        onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}>
                        {['A','B','C','D','C,D','Radio'].map(v => <option key={v} value={v}>{v.replace(',','+')}</option>)}
                      </select>
                    ) : (
                      <input className={inp + ' pr-8'} type={f.type || 'text'}
                        value={form[f.key] as string || ''}
                        onChange={e => setForm(p => ({ ...p, [f.key]: f.key === 'full_name' ? e.target.value.toUpperCase() : e.target.value }))}
                        onBlur={f.key === 'cnp' || f.key === 'email' ? save : undefined}
                      />
                    )}
                    {(f.key === 'email' || f.key === 'phone') && form[f.key] && (
                      <button onClick={() => copyToClipboard(form[f.key] as string, f.key)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-gray-100 text-gray-400 transition-colors">
                        {copied === f.key ? <Check size={12} className="text-green-500"/> : <Copy size={12}/>}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* RIGHT: Status + CI + Semnatura */}
        <div className="space-y-5">

          {/* Status */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Status portal</h3>
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: portalStatus.color }}/>
              <span className="font-medium text-sm" style={{ color: portalStatus.color }}>{portalStatus.label}</span>
              {student.signed_at && (
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(student.signed_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                  {' '}{new Date(student.signed_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {/* Communication target */}
            <div className="flex items-center justify-between py-3 border-t border-gray-50">
              <div>
                <div className="text-xs font-medium text-gray-700">Comunicare</div>
                <div className="text-xs text-gray-400">Email / WhatsApp</div>
              </div>
              <button onClick={async () => {
                const nv = !form.communication_target
                await supabase.from('students').update({ communication_target: nv }).eq('id', id)
                setForm(f => ({ ...f, communication_target: nv }))
              }}
                className={`w-11 h-6 rounded-full transition-all relative ${form.communication_target ? 'bg-green-500' : 'bg-gray-200'}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${form.communication_target ? 'left-6' : 'left-1'}`}/>
              </button>
            </div>

            {/* Clasa */}
            <div className="flex items-center justify-between py-3 border-t border-gray-50">
              <span className="text-xs font-medium text-gray-700">Clasa CAA</span>
              <span className="text-xs font-mono font-bold text-gray-900">{(student.class_caa || '').replace(',', '+')}</span>
            </div>
          </div>

          {/* CI */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Carte de identitate</h3>
              <button onClick={() => ciInputRef.current?.click()} disabled={scanning}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                {scanning ? <Loader2 size={11} className="animate-spin"/> : <ScanLine size={11}/>}
                {scanning ? 'Scanez...' : 'Scan CI'}
              </button>
            </div>

            {scanStatus === 'ok' && <p className="text-xs text-green-600 flex items-center gap-1 mb-3"><CheckCircle size={12}/> Date extrase cu succes</p>}
            {scanStatus === 'error' && <p className="text-xs text-red-500 flex items-center gap-1 mb-3"><AlertCircle size={12}/> Eroare la citire</p>}

            {student.ci_series && student.ci_number ? (
              <div className="font-mono text-sm font-bold px-3 py-2 rounded-lg text-center mb-3" style={{ background: '#dcfce7', color: '#166534' }}>
                {student.ci_series} {student.ci_number}
              </div>
            ) : (
              <div className="text-xs text-center py-2 mb-3 rounded-lg border-2 border-dashed border-red-200 text-red-400">
                Serie / Număr lipsă
              </div>
            )}

            {student.ci_image_data ? (
              <div>
                <div className="relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.ci_image_data}" style="max-width:100%;"/>`) }}>
                  <img key={imgKey} src={student.ci_image_data} alt="CI" className="w-full object-cover" style={{ maxHeight: 160 }}/>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all"/>
                  </div>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Click pentru mărire</p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-red-200 p-6 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors"
                onClick={() => ciInputRef.current?.click()}>
                <ScanLine size={24} className="mx-auto mb-2 text-red-300"/>
                <p className="text-xs text-red-400">CI nescanat</p>
                <p className="text-xs text-gray-400 mt-1">Click pentru scanare</p>
              </div>
            )}
          </div>

          {/* Semnatura */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Semnătură</h3>
            {student.signature_data ? (
              <div>
                <div className="rounded-xl border border-gray-100 p-3 bg-gray-50 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.signature_data}" style="max-width:400px;border:1px solid #ccc;padding:20px;background:#fff;"/>`) }}>
                  <img src={student.signature_data} alt="Semnătură" className="w-full object-contain" style={{ maxHeight: 80 }}/>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Click pentru mărire</p>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-red-200 p-6 text-center">
                <p className="text-xs text-red-400">Nesemnat</p>
                <p className="text-xs text-gray-400 mt-1">
                  Cursantul trebuie să acceseze portalul
                </p>
              </div>
            )}
          </div>

          {/* Actiuni */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-900 text-sm mb-4">Acțiuni</h3>
            <div className="space-y-2">
              {session && (
                <a href={`/portal?cod=${session.access_code}&email=${encodeURIComponent(student.email || '')}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                  <ExternalLink size={13}/> Deschide portal cursant
                </a>
              )}
              <button onClick={save} disabled={saving}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-white transition-colors"
                style={{ background: '#0a1628' }}>
                <Save size={13}/> Salvează modificările
              </button>
              {!showDeleteConfirm ? (
                <button onClick={() => setShowDeleteConfirm(true)}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs border border-red-200 text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={13}/> Șterge cursantul
                </button>
              ) : (
                <div className="border border-red-200 rounded-xl p-3 bg-red-50">
                  <p className="text-xs text-red-700 mb-2 font-medium">Sigur vrei să ștergi?</p>
                  <div className="flex gap-2">
                    <button onClick={deleteStudent}
                      className="flex-1 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium">Șterge</button>
                    <button onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 py-1.5 rounded-lg border border-gray-200 text-gray-500 text-xs">Anulează</button>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}