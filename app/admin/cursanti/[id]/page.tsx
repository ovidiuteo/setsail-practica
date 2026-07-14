'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  ArrowLeft, Save, ScanLine, Loader2, CheckCircle,
  AlertCircle, ExternalLink, Trash2, Copy, Check, X, FileText
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
  signature_pool: boolean; signature_random: string
  ci_verso_data: string; adeverinta_adresa_data: string; doc_type: string
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
  // RE-OCR CI
  const [reocrOpen, setReocrOpen] = useState(false)
  const [reocrLoading, setReocrLoading] = useState(false)
  const [reocrErr, setReocrErr] = useState(false)
  const [reocrDone, setReocrDone] = useState(false)
  const [reocrVals, setReocrVals] = useState<Record<string, string>>({})
  const [reocrApply, setReocrApply] = useState<Record<string, boolean>>({})
  const [reocrChanged, setReocrChanged] = useState<Record<string, boolean>>({})

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

  // Titlul tabului de browser: numele cursantului + data practicii
  useEffect(() => {
    if (!student) return
    const date = session?.session_date
      ? new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
      : ''
    document.title = date ? `${student.full_name} — ${date}` : student.full_name
  }, [student, session])

  async function save() {
    if (!student) return
    setSaving(true)
    const updates = { ...form }
    delete (updates as any).id
    delete (updates as any).created_at
    // Nu suprascriem campurile de semnatura random - sunt gestionate separat
    delete (updates as any).signature_random
    delete (updates as any).signature_pool_source_id
    delete (updates as any).signature_pool
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

  // === RE-OCR CI: reanalizează buletinul deja încărcat, cu atenție la diacritice ===
  const REOCR_FIELDS: { key: keyof Student; label: string }[] = [
    { key: 'full_name', label: 'Nume complet' },
    { key: 'cnp', label: 'CNP' },
    { key: 'birth_date', label: 'Data nașterii' },
    { key: 'ci_series', label: 'Serie CI' },
    { key: 'ci_number', label: 'Număr CI' },
    { key: 'expiry_date', label: 'Expirare CI' },
    { key: 'nationality', label: 'Cetățenie' },
    { key: 'address', label: 'Adresă' },
    { key: 'city', label: 'Localitate' },
    { key: 'county', label: 'Județ / Sector' },
    { key: 'country', label: 'Țară' },
  ]

  function openReocr() {
    setReocrOpen(true)
    setReocrDone(false); setReocrErr(false)
    setReocrVals({}); setReocrApply({}); setReocrChanged({})
    runReocr()
  }

  // Pre-completează câmpurile cu valorile curente (pt. editare manuală dacă OCR pică)
  function reocrPrefillCurrent() {
    const vals: Record<string, string> = {}, apply: Record<string, boolean> = {}, changed: Record<string, boolean> = {}
    for (const f of REOCR_FIELDS) { vals[f.key] = String((student as any)?.[f.key] || ''); apply[f.key] = false; changed[f.key] = false }
    setReocrVals(vals); setReocrApply(apply); setReocrChanged(changed)
  }

  async function runReocr() {
    if (!student?.ci_image_data) { reocrPrefillCurrent(); setReocrErr(true); return }
    setReocrLoading(true); setReocrErr(false); setReocrDone(false)
    try {
      const res = await fetch('/api/ocr-ci', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: student.ci_image_data, mediaType: 'image/jpeg', careful: true })
      })
      const json = await res.json()
      if (!json.success || !json.data) { reocrPrefillCurrent(); setReocrErr(true); setReocrLoading(false); return }
      const d = json.data
      const fullName = (d.last_name && d.first_name) ? d.last_name.toUpperCase() + ' ' + d.first_name.toUpperCase() : ''
      const sugg: Record<string, string> = {
        full_name: fullName, cnp: d.cnp || '', birth_date: d.birth_date || '', ci_series: d.ci_series || '',
        ci_number: d.ci_number || '', expiry_date: d.expiry_date || '', nationality: d.nationality || '',
        address: d.address || '', city: d.city || '', county: d.county || '', country: d.country || '',
      }
      const vals: Record<string, string> = {}, apply: Record<string, boolean> = {}, changed: Record<string, boolean> = {}
      for (const f of REOCR_FIELDS) {
        const cur = String((student as any)[f.key] || '')
        const s = sugg[f.key] || ''
        const isChanged = !!s && s !== cur
        changed[f.key] = isChanged
        vals[f.key] = s || cur          // prefill cu sugestia dacă există, altfel valoarea curentă
        apply[f.key] = isChanged        // bifat default doar dacă s-a schimbat
      }
      setReocrVals(vals); setReocrApply(apply); setReocrChanged(changed); setReocrDone(true)
    } catch { reocrPrefillCurrent(); setReocrErr(true) }
    setReocrLoading(false)
  }

  async function applyReocr() {
    const updates: any = {}
    for (const f of REOCR_FIELDS) {
      if (reocrApply[f.key]) updates[f.key] = (reocrVals[f.key] || '').trim()
    }
    if (Object.keys(updates).length) {
      await supabase.from('students').update(updates).eq('id', id)
      setStudent(s => s ? { ...s, ...updates } : s)
      setForm(f => ({ ...f, ...updates }))
    }
    setReocrOpen(false)
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
      <input ref={ciInputRef} type="file" accept="image/*,application/pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) { setPendingFile(e.target.files[0]); e.target.value = '' } }}
      />

      {/* Modal RE-OCR CI */}
      {reocrOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">RE-OCR Carte de identitate</h3>
                <p className="text-xs text-gray-400">Reanalizează cu atenție (diacritice); bifează ce modificări să se aplice. Câmpurile sunt și editabile manual.</p>
              </div>
              <button onClick={() => setReocrOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18}/></button>
            </div>
            <div className="p-5 overflow-y-auto">
              {student?.ci_image_data && (
                <img src={student.ci_image_data} alt="CI" className="w-full max-h-72 object-contain rounded-xl border border-gray-100 mb-4 bg-gray-50"/>
              )}
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <button onClick={runReocr} disabled={reocrLoading}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 disabled:opacity-50">
                  {reocrLoading ? <Loader2 size={12} className="animate-spin"/> : <ScanLine size={12}/>}
                  {reocrLoading ? 'Reanalizez...' : 'Reanalizează din nou'}
                </button>
                {reocrErr && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12}/> Eroare la citire — poți completa manual</span>}
                {reocrDone && !reocrErr && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle size={12}/> Reanalizat — verifică modificările evidențiate</span>}
              </div>

              {reocrLoading && !reocrDone && <div className="text-center text-gray-400 py-6 text-sm">Se reanalizează buletinul...</div>}

              {(reocrDone || reocrErr) && (
                <div className="space-y-2">
                  {REOCR_FIELDS.map(f => {
                    const changed = reocrChanged[f.key]
                    const cur = String((student as any)?.[f.key] || '')
                    return (
                      <div key={String(f.key)} className={`rounded-lg p-2.5 border ${changed ? 'border-amber-300 bg-amber-50' : 'border-gray-100'}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-600 flex items-center gap-1.5">
                            {f.label}
                            {changed && <span className="text-[10px] text-amber-600 font-semibold uppercase">modificat</span>}
                          </span>
                          <label className="flex items-center gap-1 text-[11px] text-gray-500 cursor-pointer select-none">
                            <input type="checkbox" checked={!!reocrApply[f.key]} onChange={e => setReocrApply(a => ({ ...a, [f.key]: e.target.checked }))}/>
                            aplică
                          </label>
                        </div>
                        <input value={reocrVals[f.key] ?? ''}
                          onChange={e => { const v = e.target.value; setReocrVals(s => ({ ...s, [f.key]: v })); setReocrApply(a => ({ ...a, [f.key]: true })) }}
                          className="w-full border border-gray-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"/>
                        {changed && <p className="text-[11px] text-gray-400 mt-1">era: <span className="line-through">{cur || '—'}</span></p>}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setReocrOpen(false)} className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">Anulează</button>
              <button onClick={applyReocr} disabled={!reocrDone && !reocrErr}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
                Salvează modificările bifate
              </button>
            </div>
          </div>
        </div>
      )}

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
            {/* Adeverință VHF (radio) */}
            <AdeverintaVhf student={student} session={session} />
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
                        {['A','B','C','D','C,D','Radio','Obtinere LRC','Prelungire LRC'].map(v => <option key={v} value={v}>{v.replace(',','+')}</option>)}
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

            {session?.access_code && (
              <a href={`/portal?cod=${session.access_code}&email=${encodeURIComponent(student.email || '')}`}
                target="_blank" rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium text-white mb-2"
                style={{ background: '#0a1628' }}>
                <ExternalLink size={13} /> Deschide portal cursant
              </a>
            )}

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
              <div className="flex items-center gap-1.5">
                {student.ci_image_data && (
                  <button onClick={openReocr} disabled={scanning}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-600 hover:bg-purple-50 transition-colors disabled:opacity-50"
                    title="Reanalizează buletinul deja încărcat (atenție la diacritice)">
                    <ScanLine size={11}/> RE-OCR CI
                  </button>
                )}
                <button onClick={() => ciInputRef.current?.click()} disabled={scanning}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition-colors disabled:opacity-50">
                  {scanning ? <Loader2 size={11} className="animate-spin"/> : <ScanLine size={11}/>}
                  {scanning ? 'Scanez...' : 'Scan CI'}
                </button>
              </div>
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

            {student.ci_verso_data && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Verso CI</p>
                <div className="relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.ci_verso_data}" style="max-width:100%;"/>`) }}>
                  <img src={student.ci_verso_data} alt="Verso CI" className="w-full object-cover" style={{ maxHeight: 160 }}/>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all"/>
                  </div>
                </div>
              </div>
            )}

            {student.adeverinta_adresa_data && (
              <div className="mt-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Adeverință adresă</p>
                <div className="relative group rounded-xl overflow-hidden border border-gray-100 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.adeverinta_adresa_data}" style="max-width:100%;"/>`) }}>
                  <img src={student.adeverinta_adresa_data} alt="Adeverință adresă" className="w-full object-cover" style={{ maxHeight: 160 }}/>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                    <ExternalLink size={20} className="text-white opacity-0 group-hover:opacity-100 transition-all"/>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Semnatura */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 text-sm">Semnătură</h3>
              <div className="flex items-center gap-2">
                {/* Buton Pool rdmz - mov */}
                <button
                  onClick={async () => {
                    const nv = !student.signature_pool
                    await supabase.from('students').update({ signature_pool: nv }).eq('id', student.id)
                    setStudent(s => s ? { ...s, signature_pool: nv } : s)
                  }}
                  title={student.signature_pool ? 'În pool — click pentru a scoate' : 'Adaugă semnătura în pool random'}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    student.signature_pool
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'border-purple-200 text-purple-600 hover:bg-purple-50'
                  }`}>
                  🟣 Pool rdmz
                </button>
                {/* Buton Alocă rndm - portocaliu */}
                <button
                  onClick={async () => {
                    // 1. Gasim grupul sesiunii curente (principal + clone)
                    const { data: allSessions } = await supabase
                      .from('sessions').select('id, parent_session_id, session_type')
                    const sess = allSessions?.find(s => s.id === student.session_id)
                    const principalId = sess?.session_type === 'principal'
                      ? sess.id : (sess?.parent_session_id || sess?.id)
                    const groupIds = (allSessions || [])
                      .filter(s => s.id === principalId || s.parent_session_id === principalId)
                      .map(s => s.id)

                    // 2. Gasim ID-urile surselor deja folosite in grup (via signature_pool_source_id)
                    const { data: usedInGroup } = await supabase
                      .from('students')
                      .select('signature_pool_source_id')
                      .in('session_id', groupIds)
                      .not('signature_pool_source_id', 'is', null)
                      .neq('id', student.id)
                    const usedSourceIds = new Set((usedInGroup || []).map(u => u.signature_pool_source_id))

                    // 3. Pool global - exclude cursantul curent, cei din grup si cei deja folositi
                    const { data: pool } = await supabase
                      .from('students')
                      .select('id, signature_data, session_id')
                      .eq('signature_pool', true)
                      .not('signature_data', 'is', null)
                      .neq('id', student.id)
                    if (!pool || pool.length === 0) { alert('Nicio semnătură în pool!'); return }

                    // 4. Filtrare: exclude surse deja folosite in grup SI cursanti din grup
                    const available = pool.filter(p =>
                      !usedSourceIds.has(p.id) &&
                      !groupIds.includes(p.session_id)
                    )
                    // Fallback 1: din afara grupului, chiar daca sursa e deja folosita in alt grup
                    const fallback1 = pool.filter(p => !groupIds.includes(p.session_id) && !usedSourceIds.has(p.id))
                    // Fallback 2: orice din afara grupului
                    const fallback2 = pool.filter(p => !groupIds.includes(p.session_id))
                    // Logica stricta: daca nu exista surse disponibile fara duplicat, nu alocam
                    if (available.length === 0) {
                      alert('Nu mai sunt semnături disponibile pentru această sesiune!\nToate semnăturile din pool au fost deja alocate altor cursanți din sesiune.')
                      return
                    }

                    const pick = available[Math.floor(Math.random() * available.length)]
                    await supabase.from('students').update({
                      signature_random: pick.signature_data,
                      signature_pool_source_id: pick.id
                    }).eq('id', student.id)
                    setStudent(s => s ? { ...s, signature_random: pick.signature_data } : s)
                  }}
                  title={student.signature_random ? 'Realocă (altă semnătură random din pool)' : 'Alocă semnătură random din pool'}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    student.signature_random
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'border-orange-300 text-orange-600 hover:bg-orange-50'
                  }`}>
                  🟠 Alocă rndm
                </button>
                {/* Buton Sterge rand - apare doar daca exista semnatura random */}
                {student.signature_random && (
                  <button
                    onClick={async () => {
                      await supabase.from('students').update({ signature_random: null, signature_pool_source_id: null }).eq('id', student.id)
                      setStudent(s => s ? { ...s, signature_random: null, signature_pool_source_id: null } : s)
                    }}
                    title="Șterge semnătura random alocată"
                    className="px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border border-red-200 text-red-500 hover:bg-red-50">
                    🗑 Șterge rand
                  </button>
                )}
              </div>
            </div>

            {/* Semnatura proprie (de pe portal) si/sau cea random alocata — afisate ambele daca exista */}
            {student.signature_data && (
              <div className="mb-3">
                <div className="rounded-xl border border-gray-100 p-3 bg-gray-50 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.signature_data}" style="max-width:400px;border:1px solid #ccc;padding:20px;background:#fff;"/>`) }}>
                  <img src={student.signature_data} alt="Semnătură" className="w-full object-contain" style={{ maxHeight: 80 }}/>
                </div>
                <p className="text-xs text-gray-400 text-center mt-2">Semnătură proprie (portal) · click pentru mărire</p>
              </div>
            )}
            {student.signature_random && (
              <div>
                <div className="rounded-xl border-2 border-orange-200 p-3 bg-orange-50 cursor-pointer"
                  onClick={() => { const w = window.open('', '_blank'); w?.document.write(`<img src="${student.signature_random}" style="max-width:400px;border:1px solid #ccc;padding:20px;background:#fff;"/>`) }}>
                  <img src={student.signature_random} alt="Semnătură random" className="w-full object-contain" style={{ maxHeight: 80 }}/>
                </div>
                <p className="text-xs text-orange-400 text-center mt-2">🟠 Semnătură alocată random — invizibilă pe portal</p>
              </div>
            )}
            {!student.signature_data && !student.signature_random && (
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

// ── Adeverință VHF (radiocomunicații) ────────────────────────────────────────
// Poziții ca fracțiuni din lățime/înălțime (template 1130x1072) — ușor de calibrat.
const VHF_TEXT = '#26268c'
function AdeverintaVhf({ student, session }: { student: Student; session: Session | null }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [f, setF] = useState({ nr: '', nume: '', domiciliu: '', seria: '', nrci: '', cnp: '', sesiune: '' })

  useEffect(() => {
    if (!open) return
    const domiciliu = [student.address, student.city, student.county].map(x => (x || '').trim()).filter(Boolean).join(', ')
    const ses = session?.session_date ? new Date(session.session_date).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' }) : ''
    setF({
      nr: String(4000 + Math.floor(Math.random() * 6000)), // 4 cifre, prima ≥ 4
      nume: (student.full_name || '').trim(),
      domiciliu,
      seria: (student.ci_series || '').trim(),
      nrci: (student.ci_number || '').trim(),
      cnp: (student.cnp || '').trim(),
      sesiune: ses,
    })
  }, [open, student, session])

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return
    let img = imgRef.current
    if (!img) { const im = new Image(); im.onload = () => { imgRef.current = im; draw() }; im.src = '/adeverinte/vhf.png'; return }
    const W = img.naturalWidth, H = img.naturalHeight
    cv.width = W; cv.height = H
    const ctx = cv.getContext('2d')!
    ctx.drawImage(img, 0, 0, W, H)
    const white = (x0: number, x1: number, by: number, pt = 0.034, pb = 0.004) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 * W, (by - pt) * H, (x1 - x0) * W, (pt + pb) * H)
    }
    const put = (t: string, x: number, by: number, size: number, align: CanvasTextAlign = 'left') => {
      if (!t) return; ctx.fillStyle = VHF_TEXT; ctx.font = `italic bold ${size * H}px Arial`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic'; ctx.fillText(t, x * W, by * H)
    }
    white(0.43, 0.63, 0.378); white(0.41, 0.91, 0.452); white(0.27, 0.93, 0.503)
    white(0.355, 0.445, 0.552); white(0.505, 0.60, 0.552); white(0.635, 0.92, 0.552)
    white(0.66, 0.93, 0.632)
    put(f.nr, 0.47, 0.375, 0.024, 'center')
    put(f.nume, 0.42, 0.450, 0.026)
    put(f.domiciliu, 0.29, 0.500, 0.020)
    put(f.seria, 0.37, 0.549, 0.020)
    put(f.nrci, 0.51, 0.549, 0.020)
    put(f.cnp, 0.62, 0.549, 0.022)
    put(f.sesiune, 0.69, 0.630, 0.020)
  }, [f])

  useEffect(() => { if (open) draw() }, [open, draw])

  const fileName = `adeverinta vhf ${(f.nume || '').trim()}`.trim()
  function saveJpg() {
    setBusy(true); const cv = canvasRef.current!
    cv.toBlob(b => { if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName + '.jpg'; a.click() } setBusy(false) }, 'image/jpeg', 0.95)
  }
  function savePdf() {
    setBusy(true); const cv = canvasRef.current!
    const url = cv.toDataURL('image/jpeg', 0.95)
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title>
<style>@page{size:A4 portrait;margin:10mm}*{margin:0}body{display:flex;justify-content:center}img{max-width:100%;max-height:100%;height:auto}</style></head>
<body><img src="${url}"><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`)
      w.document.close()
    }
    setBusy(false)
  }

  const inCls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
        <FileText size={13} /> Adeverință VHF
      </button>
      {open && (
        <div onClick={() => setOpen(false)} className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Adeverință VHF — {student.full_name}</h3>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="grid md:grid-cols-2 gap-4 p-5">
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="block text-xs text-gray-500 mb-1">Nr</span>
                    <input className={inCls} value={f.nr} onChange={e => setF(s => ({ ...s, nr: e.target.value }))} /></label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1">Sesiune</span>
                    <input className={inCls} value={f.sesiune} onChange={e => setF(s => ({ ...s, sesiune: e.target.value }))} placeholder="24-27 mai 2021" /></label>
                </div>
                <label className="block"><span className="block text-xs text-gray-500 mb-1">Dl/Dna (nume complet)</span>
                  <input className={inCls} value={f.nume} onChange={e => setF(s => ({ ...s, nume: e.target.value }))} /></label>
                <label className="block"><span className="block text-xs text-gray-500 mb-1">Domiciliat/ă</span>
                  <input className={inCls} value={f.domiciliu} onChange={e => setF(s => ({ ...s, domiciliu: e.target.value }))} /></label>
                <div className="grid grid-cols-3 gap-2">
                  <label className="block"><span className="block text-xs text-gray-500 mb-1">Serie CI</span>
                    <input className={inCls} value={f.seria} onChange={e => setF(s => ({ ...s, seria: e.target.value }))} /></label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1">Nr CI</span>
                    <input className={inCls} value={f.nrci} onChange={e => setF(s => ({ ...s, nrci: e.target.value }))} /></label>
                  <label className="block"><span className="block text-xs text-gray-500 mb-1">CNP</span>
                    <input className={inCls} value={f.cnp} onChange={e => setF(s => ({ ...s, cnp: e.target.value }))} /></label>
                </div>
                <div className="flex gap-2 pt-1">
                  <button onClick={savePdf} disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#dc2626' }}>Salvează PDF</button>
                  <button onClick={saveJpg} disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>Salvează JPG</button>
                </div>
                <p className="text-xs text-gray-400">Fișier: „{fileName}"</p>
              </div>
              <div className="self-start">
                <div className="text-xs text-gray-400 mb-1.5">Previzualizare</div>
                <canvas ref={canvasRef} className="w-full h-auto rounded-lg border border-gray-100" />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
