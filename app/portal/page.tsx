'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Ship, RotateCcw, Check, Upload, Loader2, CheckCircle, AlertCircle, Camera, ChevronDown, ChevronUp, FileText, RadioTower, AlertTriangle, Video, MessageCircle, Users, ExternalLink, Download, NotebookPen } from 'lucide-react'
import CIImageEditor from '@/components/CIImageEditor'
import PracticeBooking from '@/components/PracticeBooking'
import { scopeForSession } from '@/lib/timeline-scope'
import { urlAbsolut } from '@/lib/url-absolut'

type Step = 'login' | 'confirm' | 'done'

// Un link pe un rând: iconiță, titlu și adresa
function LinkRand({ r }: { r: { url: string; titlu: string; fundal: string; icon: React.ReactNode } }) {
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer"
      className="flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all">
      <span className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: r.fundal }}>
        {r.icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-800">{r.titlu}</span>
        <span className="block text-xs text-gray-400 truncate">{r.url.replace(/^https?:\/\//, '')}</span>
      </span>
      <ExternalLink size={15} className="shrink-0 text-gray-300" />
    </a>
  )
}

// Semnul YouTube: dreptunghi rotunjit cu triunghiul de redare (alb pe fundalul roșu al pătratului)
function IconYouTube({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path fill="#fff" d="M10 8.5l6 3.5-6 3.5v-7z" />
      <rect x="2.5" y="5" width="19" height="14" rx="4" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

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
  // Cererea semnată / poza semnăturii trec prin același editor ca actele de identitate
  const [editFile, setEditFile] = useState<{ file: File; kind: 'cerere' | 'semnatura' } | null>(null)
  const [signatureSaved, setSignatureSaved] = useState(false)
  const [existingSignature, setExistingSignature] = useState<string | null>(null)
  const [scannedFields, setScannedFields] = useState<Set<string>>(new Set())
  const [examSubmitted, setExamSubmitted] = useState(false)
  const [examAcces, setExamAcces] = useState('')   // excepția pusă pe acest cursant: deschis / închis
  const [examNota, setExamNota] = useState<number | null>(null)   // punctajul la grilă, din 20
  const [examRezultatePublic, setExamRezultatePublic] = useState(false)
  const [areCaiet, setAreCaiet] = useState(false)  // caietul de curs B/A, deschis din configurator
  // Tip act detectat din OCR: ci_vechi | ci_nou | pasaport
  const [docType, setDocType] = useState<'' | 'ci_vechi' | 'ci_nou' | 'ci_strain' | 'pasaport'>('')
  const [showDetails, setShowDetails] = useState(false)   // dropdown "Date completate"
  const [classCaa, setClassCaa] = useState('')            // Clasa CAA editabila
  const [versoStatus, setVersoStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [adevStatus, setAdevStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [certNasStatus, setCertNasStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  // Certificat LRC — doar la prelungire (sesiuni radio)
  const [lrcStatus, setLrcStatus] = useState<'idle' | 'saving' | 'scanning' | 'done' | 'error'>('idle')
  const [lrc, setLrc] = useState({ numar: '', emis_la: '', expira_la: '' })
  // Cerere de examen (radio) — înlocuiește semnătura cu pixul
  const [cerereBusy, setCerereBusy] = useState(false)
  const [cerereNr, setCerereNr] = useState('')
  const [cerereData, setCerereData] = useState('')
  const [cerereSemnStatus, setCerereSemnStatus] = useState<'idle' | 'saving' | 'done'>('idle')
  const [cerereSemnBusy, setCerereSemnBusy] = useState(false)
  const [cererePreview, setCererePreview] = useState<string | null>(null)
  const [sigPhotoStatus, setSigPhotoStatus] = useState<'idle' | 'saving' | 'done'>('idle')

  // Verifica daca acest cursant a finalizat deja examenul (status submitted/graded)
  useEffect(() => {
    if (!student?.id) { setExamSubmitted(false); setExamNota(null); return }
    let cancelled = false
    supabase.from('radio_exam_answers').select('status, grila_score').eq('student_id', student.id)
      .then(({ data }) => {
        if (cancelled) return
        const gata = (data || []).find((a: any) => a.status === 'submitted' || a.status === 'graded')
        setExamSubmitted(!!gata)
        setExamNota(gata ? Number((gata as any).grila_score ?? 0) : null)
      })
    return () => { cancelled = true }
  }, [student?.id])

  // Caietul de curs B/A: apare doar cursanților aleși în configurator
  useEffect(() => {
    if (!student?.id) { setAreCaiet(false); return }
    let anulat = false
    supabase.from('setsail_info').select('key, value').in('key', ['curs_b_caiet_vizibil', 'curs_b_caiet_studenti'])
      .then(({ data }) => {
        if (anulat) return
        const v: Record<string, string> = {}
        for (const r of (data || []) as any[]) v[r.key] = r.value || ''
        try {
          const lista: string[] = JSON.parse(v.curs_b_caiet_studenti || '[]')
          setAreCaiet(v.curs_b_caiet_vizibil === '1' && lista.includes(student.id))
        } catch { setAreCaiet(false) }
      })
    return () => { anulat = true }
  }, [student?.id])

  // Excepția de acces la examen, pusă de examinator pe cursantul ăsta
  useEffect(() => {
    if (!student?.id || !session?.id) { setExamAcces(''); setExamRezultatePublic(false); return }
    let cancelled = false
    supabase.from('radio_exams').select('acces_individual, rezultate_publice').eq('session_id', session.id).maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setExamAcces(String(((data as any)?.acces_individual || {})[student.id] || ''))
        setExamRezultatePublic(!!(data as any)?.rezultate_publice)
      })
    return () => { cancelled = true }
  }, [student?.id, session?.id])

  const [form, setForm] = useState({
    phone: '', birth_date: '', ci_series: '', ci_number: '',
    address: '', county: '', city: '', country: 'Romania', email: '', cnp: '', full_name: '', expiry_date: '', nationality: ''
  })

  // Linkurile seriei arătate cursantului — fiecare apare doar dacă e completat în sesiune
  const resurse = ([
    { cheie: 'zoom_url', titlu: 'Zoom — cursul online', fundal: '#2d8cff', icon: <Video size={17} className="text-white" />, iconMare: <Video size={30} className="text-white" /> },
    { cheie: 'whatsapp_url', titlu: 'Grup WhatsApp al seriei', fundal: '#25d366', icon: <MessageCircle size={17} className="text-white" />, iconMare: <MessageCircle size={30} className="text-white" /> },
    { cheie: 'arhiva_video_url', titlu: 'Arhivă video', fundal: '#ff0000', icon: <IconYouTube size={17} />, iconMare: <IconYouTube size={30} /> },
    { cheie: 'materiale_url', titlu: 'Manuale | prezentări | teste grilă', fundal: '#0a1628', icon: <Ship size={17} className="text-white" />, iconMare: <Ship size={30} className="text-white" /> },
    { cheie: 'comunitate_url', titlu: 'SetSail — Toți într-o barcă · comunitate absolvenți SetSail', fundal: '#25d366', icon: <Users size={17} className="text-white" />, iconMare: <Users size={30} className="text-white" /> },
  ] as const)
    .map(r => ({ ...r, url: urlAbsolut((session as any)?.[r.cheie]) }))
    .filter(r => r.url)

  // Adresa de corespondență pentru materialele de curs
  type TipLivrare = 'sala' | 'domiciliu' | 'easybox' | 'alta'
  const [livrare, setLivrare] = useState<{ tip: TipLivrare | null; adresa: string; contact: string; telefon: string; email: string }>(
    { tip: null, adresa: '', contact: '', telefon: '', email: '' })
  const [livrareSalvata, setLivrareSalvata] = useState(false)   // badge „Date salvate"
  const [adresaDesfasurata, setAdresaDesfasurata] = useState(false)

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
  // Serie CI = 2 litere; pașaport = PASS și numărul are exact 9 cifre (poate începe cu 0)
  const estePasaport = form.ci_series.trim() === 'PASS'
  const ciSeriesValid = /^([A-Z]{2}|PASS)$/.test(form.ci_series.trim())
  const ciNumberValid = estePasaport ? /^\d{9}$/.test(form.ci_number.trim()) : /^\d{6,9}$/.test(form.ci_number.trim())
  const canSave = ciSeriesValid && ciNumberValid

  // Optiuni pentru Clasa CAA, in functie de tipul practicii sesiunii.
  // value = exact ce salvam in DB (convenția existentă), label = ce vede cursantul.
  const examScope = session ? scopeForSession(session) : null
  const classOptions: Array<{ value: string; label: string }> =
    examScope === 'radio_lrc'
      ? [{ value: 'Obtinere LRC', label: 'Obținere LRC' }, { value: 'Prelungire LRC', label: 'Prelungire LRC' }]
    : examScope === 'practica_ba'
      ? [{ value: 'B', label: 'B' }, { value: 'A', label: 'A' }]
      : [{ value: 'C', label: 'C' }, { value: 'D', label: 'D' }, { value: 'B', label: 'B' }, { value: 'C,D', label: 'C+D' }]
  // Pentru CI nou / pasaport adresa nu vine din scan → o cerem explicit sus
  // Documentele fără adresă pe față: adresa se completează manual, deasupra
  const addressAbove = docType === 'ci_nou' || docType === 'pasaport' || docType === 'ci_strain'
  // Certificatul de naștere e necesar pentru CNP la documentele străine / pașaport
  const needsCertNastere = docType === 'ci_strain' || docType === 'pasaport'
  // Certificatul LRC existent se cere doar la prelungirea valabilității (sesiuni radio)
  const needsLrcCert = examScope === 'radio_lrc' && /prelungire/i.test(classCaa)
  // La radio nu se semnează pe ecran: se semnează cererea de examen
  const isRadioSession = examScope === 'radio_lrc'
  // Programarea pe intervale e doar la cursurile C/D de la Snagov
  const isSnagovCourse = examScope === 'curs_cd_snagov'
  // Cursantul a ales între obținere și prelungire? (dacă nu, clasa e doar „Radio")
  // De asta depinde tipul cererii, deci fără alegere nu se poate genera.
  const lrcChosen = /obtinere|obținere|prelungire/i.test(classCaa)
  // Datele pe care le cere textul cererii de examen. Fără ele documentul ar ieși
  // cu linii punctate, așa că blocăm descărcarea până sunt completate.
  // Adresa completă scrisă de cursant ține loc de dovada adresei la CI model nou
  const adresaCompleta = ['address', 'city', 'county'].every(k => String((form as any)[k] || '').trim())
  const cerereMissing: string[] = (() => {
    if (!isRadioSession) return []
    const out: string[] = []
    const need: [keyof typeof form, string][] = [
      ['full_name', 'nume și prenume'], ['address', 'adresă'], ['city', 'localitate'],
      ['county', 'sector/județ'], ['phone', 'telefon'], ['email', 'email'],
    ]
    for (const [k, label] of need) if (!String(form[k] || '').trim()) out.push(label)
    if (!lrcChosen) out.push('obținere sau prelungire LRC (sus, la „Clasa CAA")')

    // Actele de identitate — ce anume e obligatoriu depinde de tipul actului ales
    if (!docType) out.push('tipul actului de identitate')
    else {
      if (!student?.ci_image_data) out.push(docType === 'pasaport' ? 'poza pașaportului' : 'poza actului de identitate')
      // CI model nou: adresa nu e tipărită pe act, de aceea cerem versoul sau
      // adeverința de domiciliu. Dacă adresa e deja completată, cererea iese
      // corect și doar cu fața actului.
      if (docType === 'ci_nou' && !adresaCompleta) {
        if (!student?.ci_verso_data) out.push('verso CI')
        if (!student?.adeverinta_adresa_data) out.push('adeverință domiciliu')
      }
      if (docType === 'ci_strain' || docType === 'pasaport') {
        if (!student?.certificat_nastere_data) out.push('certificat de naștere')
      }
    }
    if (/prelungire/i.test(classCaa)) {
      if (!form.ci_series.trim()) out.push('serie CI')
      if (!form.ci_number.trim()) out.push('număr CI')
      if (!form.cnp.trim()) out.push('CNP')
      if (!lrc.numar.trim()) out.push('nr. certificat LRC')
      if (!lrc.emis_la.trim()) out.push('data emiterii certificatului LRC')
    }
    return out
  })()

  // Sunt toate datele din "Date completate" completate? (pt. culoarea dropdownului)
  const detailVals = [
    form.full_name, form.cnp, form.birth_date, form.address, form.city,
    form.county, form.country, form.expiry_date, form.nationality, form.ci_series, form.ci_number,
    form.phone, form.email,
  ]
  const detailsComplete = detailVals.every(v => String(v || '').trim() !== '')
  // Actul scanat + toate datele completate: secțiunea de date (și semnătura) coboară la baza paginii, pliate
  // Prelungirea se poate cere doar pentru certificatele care expiră între data
  // examenului și șase luni după ea
  const fereastraPrelungire = (() => {
    const d = session?.session_date
    if (!isRadioSession || !d) return null
    const zi = (x: Date) => `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`
    const examen = new Date(d)
    const peste6 = new Date(d); peste6.setMonth(peste6.getMonth() + 6)
    return { de_la: zi(examen), pana_la: zi(peste6) }
  })()
  // Certificatul încărcat se încadrează în fereastra de prelungire?
  const problemaPrelungire: string | null = (() => {
    if (!needsLrcCert || !session?.session_date) return null
    const m = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})/.exec(String(lrc.expira_la || '').trim())
    if (!m) return null
    const expira = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]))
    const examen = new Date(session.session_date); examen.setHours(0, 0, 0, 0)
    const limita = new Date(examen); limita.setMonth(limita.getMonth() + 6)
    if (expira < examen) return 'Brevetul a expirat deja. Alegeți Obținere.'
    if (expira > limita) return 'Brevetul are un termen de valabilitate mai lung de 6 luni. Reveniți la cursul radio SetSail mai aproape de data de expirare.'
    return null
  })()
  const dateGata = detailsComplete && !!student?.ci_image_data
  // Cursul a început? (materialele sunt deja pe drum, adresa nu mai e de completat)
  const cursInceput = (() => {
    const d = session?.course_start_date || session?.session_date
    if (!d) return false
    const start = new Date(d); start.setHours(0, 0, 0, 0)
    return new Date() >= start
  })()
  const livrareRezumat = ({
    sala: 'mă prezint în sală', easybox: 'Easybox Sameday',
    domiciliu: 'la domiciliu', alta: 'altă adresă',
  } as Record<string, string>)[String(livrare.tip || '')] || 'completată'
  // Adresa stă sus la începutul unei serii noi, până la sfârșitul primei zile de curs.
  // La cursurile lungi (C/D Snagov, C/D/S București–Limanu) e vizibilă tot acest timp;
  // la cele intensive apare cu 7 zile înainte de curs. La radio nu mai urcă deloc.
  const fereastraAdresa = (() => {
    if (isRadioSession) return false
    const d = session?.course_start_date || session?.session_date
    if (!d) return false
    const start = new Date(d); start.setHours(0, 0, 0, 0)
    const panaLa = new Date(start); panaLa.setHours(23, 59, 59, 999)
    const acum = new Date()
    if (acum > panaLa) return false
    if (examScope === 'intensiv_cds_limanu') {
      const deLa = new Date(start); deLa.setDate(deLa.getDate() - 7)
      return acum >= deLa
    }
    return true
  })()
  // Strânsă sub „Date personale" după ce e completată și cursul a început,
  // în afara ferestrei de la începutul seriei
  const adresaStransa = (livrareSalvata || !!livrare.tip) && cursInceput && !fereastraAdresa
  const [dateDesfasurate, setDateDesfasurate] = useState(false)
  const [semnaturaDesfasurata, setSemnaturaDesfasurata] = useState(false)
  const ascundeDate = dateGata && !dateDesfasurate
  const semnaturaGata = !!existingSignature || signatureSaved
  const ascundeSemnatura = dateGata && semnaturaGata && !semnaturaDesfasurata

  // Titlul paginii după completare: numele cursantului și seria
  const numeCursant = String(student?.full_name || '')
    .toLowerCase()
    .replace(/(^|[\s\-])([a-zăâîșț])/g, (_m, sep, c) => sep + c.toUpperCase())
  const locSerie = (() => {
    const scope = session ? scopeForSession(session) : ''
    if (scope === 'practica_cds_limanu') return 'București/Limanu'
    if (scope === 'intensiv_cds_limanu') return 'Limanu'
    if (scope === 'curs_cd_snagov') return 'București/Snagov'
    return String(session?.locations?.name || '').trim()
  })()
  const sesiuneRezumat = (() => {
    const zi = (d, cuAn) => {
      if (!d) return ''
      const [y, m, dd] = String(d).slice(0, 10).split('-').map(Number)
      if (!y || !m || !dd) return ''
      return new Date(y, m - 1, dd).toLocaleDateString('ro-RO',
        cuAn ? { day: 'numeric', month: 'long', year: 'numeric' } : { day: 'numeric', month: 'long' })
    }
    const start = zi(session?.course_start_date, false)
    const final = zi(session?.session_date, true)
    const perioada = start && final ? start + ' – ' + final : (final || start)
    return [perioada, locSerie].filter(Boolean).join(' · ')
  })()

  // Avertisment cand cursantul schimba email-ul (afecteaza accesul la portal)
  const emailChanged = !!student && form.email.trim().toLowerCase() !== String(student.email || '').trim().toLowerCase()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const c = params.get('cod')
    if (c) setCode(c.toUpperCase())
    const e = params.get('email')
    if (e) setEmailInput(e)
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

    // Gasim TOATE sesiunile cu acest access_code (principal + clone partajate)
    const { data: sessions } = await supabase
      .from('sessions')
      .select('*, locations(name), instructors(full_name)')
      .eq('access_code', code.toUpperCase().trim())

    if (!sessions || sessions.length === 0) { setLoginError('Codul sesiunii nu a fost găsit.'); return }

    // Sesiunea principala (pentru afisare date)
    const s = sessions.find((s:any) => s.session_type === 'principal' && !s.parent_session_id)
      || sessions.find((s:any) => s.session_type === 'principal')
      || sessions[0]

    if (s.status === 'draft') { setLoginError('Sesiunea nu este activă încă. Contactați instructorul.'); return }
    if (s.status === 'completed') { setLoginError('Această sesiune a fost finalizată și nu mai acceptă conexiuni.'); return }

    // Cauta cursantul in TOATE sesiunile cu acest cod, plus sesiunea de absenti
    // a principalei (poate avea alt access_code). Au acces si cei de la sailing
    // (only_sailing) si absentii — isi pot completa/actualiza datele.
    const sessionIds = sessions.map((s:any) => s.id)
    const { data: absentSessions } = await supabase
      .from('sessions')
      .select('id')
      .eq('parent_session_id', s.id)
      .eq('session_type', 'absent')
    for (const a of absentSessions || []) {
      if (!sessionIds.includes(a.id)) sessionIds.push(a.id)
    }

    const { data: matches } = await supabase
      .from('students')
      .select('*')
      .in('session_id', sessionIds)
      .ilike('email', emailInput.trim())

    // La email duplicat preferam profilul activ, apoi sailing, apoi absent
    const rank = (x: any) =>
      x.portal_status === 'absent' ? 2 : x.only_sailing ? 1 : 0
    const st = (matches || []).sort((a: any, b: any) => rank(a) - rank(b))[0]

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
    setLivrare({
      tip: (st.livrare_tip as any) || null,
      adresa: st.livrare_adresa || '',
      // implicit datele cursantului, modificabile
      contact: st.livrare_contact || st.full_name || '',
      telefon: st.livrare_telefon || st.phone || '',
      email: st.livrare_email || st.email || emailInput.trim(),
    })
    setLivrareSalvata(!!st.livrare_tip)
    setExistingSignature(st.signature_data || null)
    setDocType(st.doc_type || '')
    setClassCaa(st.class_caa || '')
    setVersoStatus(st.ci_verso_data ? 'done' : 'idle')
    setAdevStatus(st.adeverinta_adresa_data ? 'done' : 'idle')
    setCertNasStatus(st.certificat_nastere_data ? 'done' : 'idle')
    setLrcStatus(st.lrc_certificat_data ? 'done' : 'idle')
    setLrc({ numar: st.lrc_numar || '', emis_la: st.lrc_emis_la || '', expira_la: st.lrc_expira_la || '' })
    setCerereSemnStatus(st.cerere_semnata_data ? 'done' : 'idle')
    setSigPhotoStatus(st.signature_data ? 'done' : 'idle')
    // numarul de cerere deja alocat (ca sa-l vada si cand revine in portal)
    supabase.from('cerere_numbers').select('numar, data_cerere').eq('student_id', st.id).maybeSingle()
      .then(({ data: cn }: any) => {
        if (!cn) return
        setCerereNr(String(cn.numar))
        const d = new Date(cn.data_cerere)
        setCerereData(`${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`)
      })
    try {
      localStorage.setItem(
        `setsail_portal_${code.toUpperCase().trim()}`,
        JSON.stringify({ email: st.email, student_id: st.id })
      )
    } catch {}
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


  // Salveaza clasa CAA aleasa de cursant
  async function updateClass(value: string) {
    setClassCaa(value)
    if (!student?.id) return
    await supabase.from('students').update({ class_caa: value }).eq('id', student.id)
    setStudent((prev: any) => prev ? { ...prev, class_caa: value } : prev)
  }

  // Descarca cererea de examen; la prima descarcare se aloca numarul de cerere
  async function downloadCerere() {
    if (!student?.id || !session?.access_code) return
    setCerereBusy(true)
    try {
      const r = await fetch('/api/cerere-examen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, access_code: session.access_code }),
      })
      if (!r.ok) {
        const j = await r.json().catch(() => ({}))
        alert('Nu am putut genera cererea: ' + (j.error || 'eroare'))
        return
      }
      setCerereNr(r.headers.get('X-Cerere-Nr') || '')
      setCerereData(r.headers.get('X-Cerere-Data') || '')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Cerere examen radio - ${(form.full_name || 'cursant').trim()}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e: any) {
      alert('Eroare: ' + (e?.message || e))
    }
    setCerereBusy(false)
  }

  // Cererea salvata e PDF: browserele nu o arata dintr-un data: URL, dar dintr-un
  // blob: da — asa o putem deschide intr-un modal, nu doar descarca.
  function deschideCerere(dataUrl: string) {
    try {
      const b64 = String(dataUrl).split(',')[1] || ''
      const bin = atob(b64)
      const buf = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i)
      const url = URL.createObjectURL(new Blob([buf], { type: 'application/pdf' }))
      setCererePreview(url)
    } catch {
      window.open(dataUrl, '_blank')
    }
  }
  function inchideCerere() {
    if (cererePreview) URL.revokeObjectURL(cererePreview)
    setCererePreview(null)
  }

  // Cererea cu semnatura cursantului pusa de noi pe ea: primeste numar, se salveaza
  // ca document (tine loc de scanul cererii semnate) si se descarca.
  async function genereazaCerereSemnata() {
    if (!student?.id || !session?.access_code) return
    setCerereSemnBusy(true)
    try {
      const r = await fetch('/api/cerere-examen', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: student.id, access_code: session.access_code, semnata: true }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j.error) { alert('Nu am putut genera cererea semnată: ' + (j.error || 'eroare')); return }
      setCerereNr(String(j.numar || ''))
      setCerereData(j.data || '')
      setCerereSemnStatus('done')
      setStudent((prev: any) => prev ? { ...prev, cerere_semnata_data: j.pdf } : prev)
      const a = document.createElement('a')
      a.href = j.pdf
      a.download = j.filename || 'Cerere examen radio semnata.pdf'
      a.click()
    } catch (e: any) {
      alert('Eroare: ' + (e?.message || e))
    }
    setCerereSemnBusy(false)
  }

  // Curata o poza de semnatura facuta pe hartie: prag adaptiv -> trasee inchise
  // pe fundal alb curat, exact ca semnatura desenata pe canvas (asa functioneaza
  // si recolorarea in albastru de pe documentele oficiale).
  function cleanSignaturePhoto(dataUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onerror = () => reject(new Error('imagine invalidă'))
      img.onload = () => {
        const max = 900
        let { width, height } = img
        if (width > max) { height = Math.round(height * max / width); width = max }
        const c = document.createElement('canvas'); c.width = width; c.height = height
        const ctx = c.getContext('2d')!
        // fundal alb inainte de desenare: imaginile cu transparenta ar da altfel pixeli negri
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height)
        ctx.drawImage(img, 0, 0, width, height)
        const im = ctx.getImageData(0, 0, width, height)
        const d = im.data
        const n = width * height
        const lum = new Float32Array(n)
        let sum = 0
        for (let p = 0; p < n; p++) {
          const i = p * 4
          const l = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
          lum[p] = l; sum += l
        }
        const avg = sum / n
        // Praguri relative (merg si pe hartie galbuie sau in umbra), calculate in
        // ambele polaritati: semnatura poate fi inchisa pe fond deschis SAU invers
        // (poze in negativ). Cerneala e intotdeauna MINORITARA — o alegem pe aceea.
        const darkThr = avg * 0.75, lightThr = avg * 1.25
        let darkCount = 0, lightCount = 0
        for (let p = 0; p < n; p++) {
          if (lum[p] < darkThr) darkCount++
          else if (lum[p] > lightThr) lightCount++
        }
        const inkIsLight = lightCount > 0 && lightCount < darkCount
        for (let p = 0; p < n; p++) {
          const isInk = inkIsLight ? lum[p] > lightThr : lum[p] < darkThr
          const i = p * 4
          d[i] = d[i + 1] = d[i + 2] = isInk ? 20 : 255
          d[i + 3] = 255
        }
        ctx.putImageData(im, 0, 0)
        resolve(c.toDataURL('image/png'))
      }
      img.src = dataUrl
    })
  }

  // Poza cu semnatura de pe hartie -> curatata -> salvata ca semnatura oficiala,
  // deci apare automat pe cerere la urmatoarea descarcare.
  async function saveSignatureFromDataUrl(dataUrl: string) {
    if (!student?.id) return
    setSigPhotoStatus('saving')
    try {
      const cleaned = await cleanSignaturePhoto(dataUrl)
      await supabase.from('students').update({ signature_data: cleaned }).eq('id', student.id)
      setExistingSignature(cleaned)
      setSignatureSaved(true)
      setSigPhotoStatus('done')
    } catch {
      setSigPhotoStatus('idle')
      alert('Nu am putut procesa poza. Încercați din nou.')
    }
  }

  // Salveaza un camp al certificatului LRC (editabil manual de cursant)
  async function saveLrcField(field: 'numar' | 'emis_la' | 'expira_la', value: string) {
    setLrc(v => ({ ...v, [field]: value }))
    if (student?.id) await supabase.from('students').update({ ['lrc_' + field]: value }).eq('id', student.id)
  }

  // Upload certificat LRC: comprima, salveaza, apoi incearca sa citeasca nr./datele prin OCR
  async function handleLrcUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !student?.id) return
    setLrcStatus('saving')
    try {
      const dataUrl: string = await new Promise((res, rej) => {
        const fr = new FileReader()
        fr.onerror = () => rej(new Error('citire eșuată'))
        fr.onload = () => res(String(fr.result))
        fr.readAsDataURL(file)
      })
      const compressed = await compressImage(dataUrl)
      await supabase.from('students').update({ lrc_certificat_data: compressed }).eq('id', student.id)
      setStudent((s: any) => ({ ...s, lrc_certificat_data: compressed }))

      // OCR pe imaginea originala (necomprimata) — mai lizibila
      setLrcStatus('scanning')
      const r = await fetch('/api/ocr-lrc', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType: file.type || 'image/jpeg' }),
      })
      const j = await r.json().catch(() => null)
      if (r.ok && j?.success && j.data) {
        const d = j.data
        // completam doar campurile pe care OCR-ul chiar le-a gasit
        const upd: any = {}
        if (d.numar) upd.lrc_numar = d.numar
        if (d.emis_la) upd.lrc_emis_la = d.emis_la
        if (d.expira_la) upd.lrc_expira_la = d.expira_la
        if (Object.keys(upd).length) {
          await supabase.from('students').update(upd).eq('id', student.id)
          setLrc(v => ({
            numar: d.numar || v.numar,
            emis_la: d.emis_la || v.emis_la,
            expira_la: d.expira_la || v.expira_la,
          }))
        }
      }
      setLrcStatus('done')
    } catch {
      setLrcStatus('error')
    }
  }

  // Salveaza o imagine deja editata (decupata/rotita) intr-o coloana de document
  async function saveExtraFromDataUrl(
    dataUrl: string,
    column: 'ci_verso_data' | 'adeverinta_adresa_data' | 'certificat_nastere_data' | 'cerere_semnata_data',
    setStatus: (s: 'idle' | 'saving' | 'done') => void
  ) {
    if (!student?.id) return
    setStatus('saving')
    try {
      const compressed = await compressImage(dataUrl)
      await supabase.from('students').update({ [column]: compressed }).eq('id', student.id)
      setStudent((prev: any) => prev ? { ...prev, [column]: compressed } : prev)
      setStatus('done')
    } catch (err) {
      console.error('Upload error:', err)
      setStatus('idle')
    }
  }

  // Cererea semnata poate veni si ca PDF (scanere, semnatura electronica): atunci
  // nu trece prin editorul de imagini, se salveaza asa cum e.
  async function salveazaPdf(
    file: File,
    column: 'cerere_semnata_data',
    setStatus: (s: 'idle' | 'saving' | 'done') => void
  ) {
    if (!student?.id) return
    if (file.size > 6 * 1024 * 1024) {
      alert('Fișierul PDF e prea mare (peste 6 MB). Scanați la o rezoluție mai mică sau trimiteți o poză.')
      return
    }
    setStatus('saving')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onerror = () => reject(new Error('citire eșuată'))
        fr.onload = () => resolve(String(fr.result))
        fr.readAsDataURL(file)
      })
      await supabase.from('students').update({ [column]: dataUrl }).eq('id', student.id)
      setStudent((prev: any) => prev ? { ...prev, [column]: dataUrl } : prev)
      setStatus('done')
    } catch (err) {
      console.error('Upload PDF error:', err)
      setStatus('idle')
      alert('Nu am putut salva PDF-ul. Încercați din nou.')
    }
  }
  const estePdf = (f: File) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)

  // Upload simplu (verso CI / adeverinta adresa / certificat nastere) — comprima + salveaza in coloana
  async function handleExtraUpload(
    e: React.ChangeEvent<HTMLInputElement>,
    column: 'ci_verso_data' | 'adeverinta_adresa_data' | 'certificat_nastere_data' | 'cerere_semnata_data',
    setStatus: (s: 'idle' | 'saving' | 'done') => void
  ) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !student?.id) return
    setStatus('saving')
    try {
      const dataUrl: string = await new Promise((resolve, reject) => {
        const r = new FileReader()
        r.onload = () => resolve(r.result as string)
        r.onerror = reject
        r.readAsDataURL(file)
      })
      const compressed = await compressImage(dataUrl)
      await supabase.from('students').update({ [column]: compressed }).eq('id', student.id)
      setStudent((prev: any) => prev ? { ...prev, [column]: compressed } : prev)
      setStatus('done')
    } catch (err) {
      console.error('Upload error:', err)
      setStatus('idle')
    }
  }

  // Comprima imaginea la max 800px lățime, sub 500KB base64
  // Reduce calitatea iterativ pana atinge target-ul
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

  async function handleCIUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    if (ciInputRef.current) ciInputRef.current.value = ''
  }

  async function processImageForOCR(dataUrl: string, mediaType: string) {
    setOcrStatus('loading')
    // Comprima imaginea la 800px/500KB si salveaza direct in Supabase
    // Comprima imaginea INAINTE de OCR si salveaza in DB
    let compressedImg = dataUrl
    if (student?.id) {
      compressedImg = await compressImage(dataUrl)
      const sizeKB = Math.round(compressedImg.length / 1024)
      console.log(`Salvare CI: ${sizeKB}KB in Supabase`)
      await supabase.from('students').update({ ci_image_data: compressedImg }).eq('id', student.id)
    }
    try {
      // Trimite imaginea originala la OCR (mai clara)
      const res = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType: mediaType || 'image/jpeg' })
      })
      const json = await res.json()
      if (!res.ok || !json.success) { setOcrStatus('error'); return }
      const d = json.data
      // Detectam tipul actului: preferam ce zice OCR-ul, altfel heuristica
      let detected: 'ci_vechi' | 'ci_nou' | 'ci_strain' | 'pasaport'
      if (['ci_vechi', 'ci_nou', 'ci_strain', 'pasaport'].includes(d.doc_type)) {
        detected = d.doc_type
      } else if (d.ci_series === 'PP' || d.ci_series === 'PASS' || /pasaport|passport/i.test(String(d.doc_type || ''))) {
        detected = 'pasaport'
      } else if (/strain|străin|foreign/i.test(String(d.doc_type || ''))
        || (d.country && !/^(romania|românia|rou|ro)$/i.test(String(d.country).trim()))) {
        // act emis de alt stat — CNP-ul românesc lipsește, se ia din certificatul de naștere
        detected = 'ci_strain'
      } else {
        // CI fara adresa pe fata => model nou (adresa e pe verso)
        detected = d.address ? 'ci_vechi' : 'ci_nou'
      }
      setDocType(detected)
      // pașaportul are seria PASS (OCR-ul poate întoarce „PP")
      if (detected === 'pasaport') d.ci_series = 'PASS'
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
      // Salveaza datele OCR - ci_image_data e deja comprimat in DB, folosim compressedImg pentru state
      const ocrSave: any = {
        ci_image_data: compressedImg,  // imaginea comprimata pentru state local
        doc_type: detected,
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
      // Actualizeaza studentul in state
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

  // „Aceeași adresă ca domiciliul" completează câmpul cu adresa din acte; restul se scriu de mână
  function alegeLivrare(tip: TipLivrare) {
    setLivrare(v => {
      // al doilea click pe aceeași opțiune o deselectează
      const nou = v.tip === tip
        ? { ...v, tip: null as TipLivrare | null, adresa: '' }
        : {
            tip: tip as TipLivrare | null,
            adresa: tip === 'domiciliu'
              ? [form.address, form.city, form.county].map(x => String(x || '').trim()).filter(Boolean).join(', ')
              : tip === 'sala' ? '' : (v.tip === 'domiciliu' ? '' : v.adresa),
            contact: v.contact || form.full_name || '',
            telefon: v.telefon || form.phone || '',
            email: v.email || form.email || '',
          }
      salveazaLivrareDate(nou)
      return nou
    })
  }

  async function salveazaLivrareDate(v: { tip: TipLivrare | null; adresa: string; contact: string; telefon: string; email: string }) {
    if (!student?.id) return
    const date = {
      livrare_tip: v.tip,
      livrare_adresa: v.adresa.trim(),
      livrare_contact: v.contact.trim(),
      livrare_telefon: v.telefon.trim(),
      livrare_email: v.email.trim(),
    }
    const { error } = await supabase.from('students').update(date).eq('id', student.id)
    if (error) return
    setStudent((prev: any) => prev ? { ...prev, ...date } : prev)
    setLivrareSalvata(!!v.tip)
  }
  // la ieșirea din câmp (fără buton de salvare)
  const salveazaLivrare = () => { salveazaLivrareDate(livrare) }

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
      ...(livrare.tip ? {
        livrare_tip: livrare.tip,
        livrare_adresa: livrare.adresa.trim(),
        livrare_contact: livrare.contact.trim(),
        livrare_telefon: livrare.telefon.trim(),
        livrare_email: livrare.email.trim(),
      } : {}),
      ...(classCaa.trim() ? { class_caa: classCaa.trim() } : {}),
      ...(docType ? { doc_type: docType } : {}),
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
      onConfirm={(dataUrl, mediaType) => {
        setPendingFile(null)
        processImageForOCR(dataUrl, mediaType)
      }}
      onCancel={() => setPendingFile(null)}
    />
  )

  // Același editor (rotire + decupare + previzualizare) pentru cererea semnată și semnătură
  if (editFile) return (
    <CIImageEditor
      file={editFile.file}
      title={editFile.kind === 'cerere' ? 'Cererea semnată' : 'Poza semnăturii'}
      hint={editFile.kind === 'cerere'
        ? <>Rotiți și decupați cererea → <b>Apply Crop</b> → <b>Salvează</b></>
        : <>Decupați strict semnătura, fără marginile foii → <b>Apply Crop</b> → <b>Salvează</b></>}
      confirmLabel="Salvează"
      onConfirm={dataUrl => {
        const kind = editFile.kind
        setEditFile(null)
        if (kind === 'cerere') saveExtraFromDataUrl(dataUrl, 'cerere_semnata_data', setCerereSemnStatus)
        else saveSignatureFromDataUrl(dataUrl)
      }}
      onCancel={() => setEditFile(null)}
    />
  )

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-4 pb-16"
      style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>

      {/* Cererea semnată, pe tot ecranul */}
      {cererePreview && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col p-3" onClick={inchideCerere}>
          <div className="flex items-center justify-between gap-2 mb-2 shrink-0" onClick={e => e.stopPropagation()}>
            <span className="text-sm font-semibold text-white">Cererea de examen semnată</span>
            <div className="flex gap-2">
              <a href={cererePreview} download="Cerere examen radio semnata.pdf"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-medium hover:bg-white/20">
                <Download size={13} /> Descarcă
              </a>
              <button onClick={inchideCerere}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-gray-800 text-xs font-medium">
                Închide
              </button>
            </div>
          </div>
          <div className="flex-1 bg-white rounded-xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <iframe src={cererePreview} title="Cererea semnată" className="w-full h-full" />
          </div>
          <p className="text-[11px] text-white/60 text-center mt-2 shrink-0">
            Dacă documentul nu se vede pe telefon, apăsați „Descarcă".
          </p>
        </div>
      )}

      <div className="w-full max-w-lg mt-8">

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-3" style={{ background: '#f5c842' }}>
            {isRadioSession
              ? <RadioTower size={28} style={{ color: '#0a1628' }} />
              : <Ship size={28} style={{ color: '#0a1628' }} />}
          </div>
          {dateGata && step === 'confirm' ? (<>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>{numeCursant}</h1>
            {sesiuneRezumat && <p className="text-white/60 text-sm mt-1">Sesiune: {sesiuneRezumat}</p>}
          </>) : (<>
            <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'Georgia, serif' }}>SetSail</h1>
            <p className="text-white/50 text-sm mt-1">
              {isRadioSession ? 'Portal curs GMDSS/LRC' : 'Portal examen practic'}
            </p>
          </>)}
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
          <div className="flex flex-col gap-4">

            {/* Alegerea obținere / prelungire, singură sus de tot cât timp lipsește:
                de ea depinde tipul cererii de examen, deci nu poate fi sărită. */}
            {isRadioSession && (!lrcChosen || !docType) && (
              <div className="order-[-20] bg-white rounded-2xl p-5 shadow-2xl border-2 border-pink-300 space-y-4">
                {!lrcChosen && (
                  <div>
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-pink-600" /> Alegeți tipul cererii
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      Obținerea unui certificat nou sau prelungirea valabilității celui pe care îl aveți —
                      de asta depinde cererea de examen.
                    </p>
                    <div className="grid grid-cols-2 gap-2 items-start">
                      {classOptions.map(o => (
                        <div key={o.value}>
                          <button type="button" onClick={() => updateClass(o.value)}
                            className="w-full py-3 rounded-xl text-sm font-semibold border-2 border-pink-300 text-pink-800 bg-pink-50 hover:bg-pink-100 transition-colors">
                            {o.label}
                          </button>
                          {/* prelungirea se cere doar dacă certificatul expiră în fereastra examenului */}
                          {/prelungire/i.test(o.value) && fereastraPrelungire && (
                            <p className="text-[11px] text-red-600 mt-1 leading-tight">
                              Doar dacă data expirării certificatului este între {fereastraPrelungire.de_la} și {fereastraPrelungire.pana_la}.
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!docType && (
                  <div>
                    <h2 className="font-bold text-gray-900 flex items-center gap-2">
                      <AlertTriangle size={16} className="text-pink-600" /> Tipul actului de identitate
                    </h2>
                    <p className="text-xs text-gray-500 mt-1 mb-3">
                      De el depind documentele pe care vi le cerem mai jos. Se completează singur la scanarea actului.
                    </p>
                    <select
                      value={docType}
                      onChange={async e => {
                        const v = e.target.value as typeof docType
                        setDocType(v)
                        if (student?.id) await supabase.from('students').update({ doc_type: v || null }).eq('id', student.id)
                      }}
                      className="w-full px-3 py-2.5 rounded-xl border-2 border-pink-300 bg-pink-50 text-sm text-pink-900 font-medium focus:outline-none focus:ring-2 focus:ring-pink-300">
                      <option value="">— alegeți tipul —</option>
                      <option value="ci_vechi">Carte de identitate (model vechi)</option>
                      <option value="ci_nou">Carte de identitate (model nou)</option>
                      <option value="ci_strain">Act de identitate străin</option>
                      <option value="pasaport">Pașaport românesc</option>
                    </select>
                  </div>
                )}
              </div>
            )}

            {/* Date personale */}
            <div className={'bg-white rounded-2xl p-6 shadow-2xl ' + (dateGata ? 'order-[90]' : '')}>
              {dateGata ? (
                <button type="button" onClick={() => setDateDesfasurate(v => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="font-bold text-gray-900">Date personale</span>
                    <span className="text-xs text-gray-400">act de identitate și date — complet</span>
                  </span>
                  {dateDesfasurate ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
              ) : (<>
                <h2 className="font-bold text-gray-900 mb-1">Date personale</h2>
                <p className="text-xs text-gray-400 mb-3">Incarcati act identitate si semnati</p>
              </>)}
              <div className={ascundeDate ? 'hidden' : dateGata ? 'mt-4' : ''}>
            {student?.portal_status === 'signed' && (
              <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 flex items-center gap-2">
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
                  {/* La radio, de această alegere depinde tipul cererii de examen:
                      roz cât timp e nealeasă (clasa e doar „Radio"), verde după alegere */}
                  <select
                    value={classOptions.some(o => o.value === classCaa) ? classCaa : ''}
                    onChange={e => updateClass(e.target.value)}
                    className={`text-xs font-medium rounded-lg px-2 py-1 border focus:outline-none focus:ring-2 cursor-pointer transition-colors ${
                      !isRadioSession ? 'text-gray-800 bg-white border-gray-300 focus:ring-blue-400'
                      : lrcChosen ? 'text-green-800 bg-green-50 border-green-400 focus:ring-green-300'
                      : 'text-pink-800 bg-pink-100 border-pink-400 focus:ring-pink-300'}`}>
                    <option value="" disabled>{classCaa || 'Alege…'}</option>
                    {classOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {isRadioSession && !lrcChosen && (
                  <p className="text-[11px] text-pink-700 text-right -mt-1">
                    Alegeți obținere sau prelungire — de asta depinde cererea de examen.
                  </p>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-400">Sesiune</span>
                  <span className="text-xs text-gray-700">
                    {new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })} · {session.locations?.name}
                  </span>
                </div>
              </div>

              {/* Upload CI + OCR */}
              <div className="mb-5">
                <label className={labelCls + ' mb-0'}>
                  <Camera size={13} className="inline mr-1.5" />
                  Fotografiați / Scanați Cartea de Identitate
                </label>
                <p className="text-xs text-amber-600 font-medium mb-1.5">Atenție! Nu PDF. Recomandăm screenshot + upload.</p>
                <div className="flex gap-3">
                  {/* Dropzone — formă de CI (landscape) */}
                  <label className={`
                    flex flex-col items-center justify-center text-center gap-2 flex-1 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all aspect-[856/540]
                    ${ocrStatus === 'loading' ? 'border-blue-300 bg-blue-50' :
                      ocrStatus === 'done' ? 'border-green-400 bg-green-50' :
                      ocrStatus === 'error' ? 'border-red-300 bg-red-50' :
                      'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}
                  `}>
                    {ocrStatus === 'loading' && (
                      <><Loader2 size={22} className="text-blue-500 animate-spin" />
                      <span className="text-xs text-blue-600 font-medium">Se citește CI-ul, așteptați...</span></>
                    )}
                    {ocrStatus === 'done' && (
                      <><CheckCircle size={22} className="text-green-600" />
                      <span className="text-xs text-green-700 font-medium">CI citit! Verificați câmpurile.</span></>
                    )}
                    {ocrStatus === 'error' && (
                      <><AlertCircle size={22} className="text-red-500" />
                      <span className="text-xs text-red-600">Eroare la citire. Încercați din nou.</span></>
                    )}
                    {ocrStatus === 'idle' && (
                      student?.ci_image_data
                        ? <><CheckCircle size={24} className="text-green-600" />
                          <span className="text-sm text-green-700 font-medium">Act identitate încărcat ✓ (apăsați pentru a înlocui)</span></>
                        : <><Upload size={24} className="text-gray-400" />
                          <div>
                            <div className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca foto CI</div>
                            <div className="text-xs text-gray-400 mt-0.5">JPG, PNG, HEIC — față CI</div>
                          </div></>
                    )}
                    <input
                      ref={ciInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCIUpload}
                      disabled={ocrStatus === 'loading'}
                    />
                  </label>
                  {/* Preview document încărcat */}
                  <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-[856/540] overflow-hidden flex items-center justify-center">
                    {student?.ci_image_data
                      ? <img src={student.ci_image_data} alt="Document încărcat" className="w-full h-full object-contain" />
                      : <span className="text-xs text-gray-300 px-2 text-center">Previzualizare document</span>}
                  </div>
                </div>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={handleCIUpload} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleCIUpload} />
                    </label>
                  </div>
                {ocrStatus === 'done' && (
                  <button
                    onClick={() => { setOcrStatus('idle'); if (ciInputRef.current) ciInputRef.current.click() }}
                    className="mt-2 text-xs text-blue-500 hover:text-blue-700 underline">
                    Vă rugăm upload CI — ANR verifică corectitudinea numelui (cratime, diacritice) și a CNP-ului față de documentul scanat.
                  </button>
                )}
              </div>

              {/* ── Tipul documentului: detectat la scanare, dar corectabil manual ── */}
              <div className="mb-5">
                <label className={labelCls}>Tipul actului de identitate</label>
                <select
                  value={docType}
                  onChange={async e => {
                    const v = e.target.value as typeof docType
                    setDocType(v)
                    if (student?.id) await supabase.from('students').update({ doc_type: v || null }).eq('id', student.id)
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                  <option value="">— alegeți tipul —</option>
                  <option value="ci_vechi">Carte de identitate (model vechi)</option>
                  <option value="ci_nou">Carte de identitate (model nou)</option>
                  <option value="ci_strain">Act de identitate străin</option>
                  <option value="pasaport">Pașaport românesc</option>
                </select>
                <p className="text-xs text-gray-400 mt-1">
                  Se completează automat la scanare. Dacă nu e corect, alegeți dumneavoastră — de el depind documentele cerute mai jos.
                </p>
              </div>

              {/* ── Certificat de naștere (act străin / pașaport — pentru CNP) ── */}
              {needsCertNastere && (
                <div className="space-y-3 mb-5">
                  <p className="text-xs text-gray-500">
                    {docType === 'ci_strain'
                      ? 'Actul de identitate străin nu conține CNP-ul românesc. Încărcați certificatul de naștere.'
                      : 'Pașaportul nu conține CNP-ul complet. Încărcați certificatul de naștere.'}
                  </p>
                  <label className={`flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    certNasStatus === 'done' ? 'border-green-400 bg-green-50' :
                    certNasStatus === 'saving' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {certNasStatus === 'saving' ? <><Loader2 size={16} className="text-blue-500 animate-spin"/><span className="text-sm text-blue-600 font-medium">Se salvează...</span></>
                     : certNasStatus === 'done' ? <><CheckCircle size={16} className="text-green-600"/><span className="text-sm text-green-700 font-medium">Certificat de naștere încărcat ✓ (apăsați pentru a înlocui)</span></>
                     : <><Upload size={16} className="text-gray-400"/><span className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca/poza CERTIFICATUL DE NAȘTERE</span></>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleExtraUpload(e, 'certificat_nastere_data', setCertNasStatus)} />
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleExtraUpload(e, 'certificat_nastere_data', setCertNasStatus)} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleExtraUpload(e, 'certificat_nastere_data', setCertNasStatus)} />
                    </label>
                  </div>
                </div>
              )}

              {/* ── Verso CI + adeverință (doar pentru CI nou) ── */}
              {docType === 'ci_nou' && (
                <div className="space-y-3 mb-5">
                  <p className="text-xs text-gray-500">
                    Cartea de identitate nouă are adresa, emitentul și codul pe <strong>verso</strong>. Încărcați versoul și o adeverință de adresă.
                    {isRadioSession && adresaCompleta && (
                      <> <span className="text-green-700">Adresa fiind completată mai sus, cererea de examen se poate genera și fără ele.</span></>
                    )}
                  </p>
                  <label className={`flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    versoStatus === 'done' ? 'border-green-400 bg-green-50' :
                    versoStatus === 'saving' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {versoStatus === 'saving' ? <><Loader2 size={16} className="text-blue-500 animate-spin"/><span className="text-sm text-blue-600 font-medium">Se salvează...</span></>
                     : versoStatus === 'done' ? <><CheckCircle size={16} className="text-green-600"/><span className="text-sm text-green-700 font-medium">Verso CI încărcat ✓ (apăsați pentru a înlocui)</span></>
                     : <><Upload size={16} className="text-gray-400"/><span className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca VERSO CI</span></>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleExtraUpload(e, 'ci_verso_data', setVersoStatus)} />
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleExtraUpload(e, 'ci_verso_data', setVersoStatus)} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleExtraUpload(e, 'ci_verso_data', setVersoStatus)} />
                    </label>
                  </div>
                  <label className={`flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    adevStatus === 'done' ? 'border-green-400 bg-green-50' :
                    adevStatus === 'saving' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {adevStatus === 'saving' ? <><Loader2 size={16} className="text-blue-500 animate-spin"/><span className="text-sm text-blue-600 font-medium">Se salvează...</span></>
                     : adevStatus === 'done' ? <><CheckCircle size={16} className="text-green-600"/><span className="text-sm text-green-700 font-medium">Adeverință adresă încărcată ✓ (apăsați pentru a înlocui)</span></>
                     : <><Upload size={16} className="text-gray-400"/><span className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca/poza adeverința adresă</span></>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleExtraUpload(e, 'adeverinta_adresa_data', setAdevStatus)} />
                  </label>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={e => handleExtraUpload(e, 'adeverinta_adresa_data', setAdevStatus)} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleExtraUpload(e, 'adeverinta_adresa_data', setAdevStatus)} />
                    </label>
                  </div>
                </div>
              )}

              {/* Adresă domiciliu — manuală pentru CI nou / pașaport (nu vine din scan) */}
              {addressAbove && (
                <div className="space-y-3 mb-5">
                  <div>
                    <label className={labelCls}>Adresă domiciliu (stradă, număr, bloc, apartament)</label>
                    <p className="text-[11px] text-red-600 -mt-1 mb-1">Scrieți adresa EXACT ca în actul de identitate — va fi folosită pe brevet/diplomă.</p>
                    <input className={fieldCls('address')} value={form.address} placeholder="Str. Exemplu nr. 1, Bl. X, Ap. Y"
                      onChange={e => { setForm(f=>({...f,address:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('address');return n}) }} />
                  </div>
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
                </div>
              )}

              {/* ── Dropdown "Date completate" (mai îngust; verde=complet / orange=lipsesc) ── */}
              <div className={`w-3/5 border rounded-xl overflow-hidden transition-colors ${detailsComplete ? 'border-green-300 bg-green-50' : 'border-orange-300 bg-orange-50'}`}>
                <button type="button" onClick={() => setShowDetails(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-black/5 transition-colors">
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">Date completate</span>
                    <span className="block text-xs text-gray-500">{detailsComplete ? 'Toate datele sunt completate' : 'Verificați și completați informațiile'}</span>
                  </span>
                  {showDetails ? <ChevronUp size={18} className="text-gray-400 shrink-0"/> : <ChevronDown size={18} className="text-gray-400 shrink-0"/>}
                </button>
                {showDetails && (
                  <div className="px-4 pb-4 pt-2 space-y-3 border-t border-gray-100">
                    {ocrStatus === 'done' && (
                      <div className="flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-green-500 bg-green-50 inline-block"/><span className="text-gray-500">Din CI</span></span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-50/30 inline-block"/><span className="text-gray-500">Completat manual</span></span>
                        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded border-2 border-red-300 bg-red-50/40 inline-block"/><span className="text-gray-500">Lipsă</span></span>
                      </div>
                    )}

                    {/* Serie + Număr */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>
                          Serie CI / Tip doc *
                          {form.ci_series.trim() && (ciSeriesValid ? <span className="ml-1 text-green-600 font-semibold">✓</span> : <span className="ml-1 text-red-500">✗</span>)}
                        </label>
                        <input className={ciFieldCls(form.ci_series, ciSeriesValid)} value={form.ci_series} placeholder="AB sau PASS" maxLength={4}
                          onChange={e => setForm(f => ({ ...f, ci_series: e.target.value.toUpperCase() }))} />
                        {form.ci_series.trim() && !ciSeriesValid && (<p className="text-xs text-red-500 mt-1">2 litere (ex: AB, IF) sau PASS pentru pașaport</p>)}
                      </div>
                      <div>
                        <label className={labelCls}>
                          Număr CI / Pașaport *
                          {form.ci_number.trim() && (ciNumberValid ? <span className="ml-1 text-green-600 font-semibold">✓</span> : <span className="ml-1 text-red-500">✗</span>)}
                        </label>
                        <input className={ciFieldCls(form.ci_number, ciNumberValid)} value={form.ci_number} placeholder="123456 / 1234567 / 058339673" maxLength={9}
                          onChange={e => setForm(f => ({ ...f, ci_number: e.target.value.replace(/\D/g, '') }))} />
                        {form.ci_number.trim() && !ciNumberValid && (<p className="text-xs text-red-500 mt-1">{estePasaport ? '9 cifre pentru pașaport (poate începe cu 0)' : '6-7 cifre (CI) sau 9 cifre (pașaport)'}</p>)}
                      </div>
                    </div>

                    {/* Nume / Prenume */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Nume (din CI)</label>
                        <input className={fieldCls('full_name', form.full_name.split(' ')[0])} value={form.full_name.split(' ')[0] || ''} placeholder="POPESCU"
                          onChange={e => { const parts = form.full_name.split(' '); parts[0] = e.target.value.toUpperCase(); setForm(f => ({ ...f, full_name: parts.join(' ') })); setScannedFields(s => { const n = new Set(s); n.delete('full_name'); return n }) }} />
                      </div>
                      <div>
                        <label className={labelCls}>Prenume (din CI)</label>
                        <input className={fieldCls('full_name', form.full_name.split(' ').slice(1).join(' '))} value={form.full_name.split(' ').slice(1).join(' ') || ''} placeholder="ION GABRIEL"
                          onChange={e => { const parts = form.full_name.split(' '); setForm(f => ({ ...f, full_name: ((parts[0]||'')+' '+e.target.value.toUpperCase()).trim() })); setScannedFields(s => { const n = new Set(s); n.delete('full_name'); return n }) }} />
                      </div>
                    </div>

                    {/* CNP + Data nașterii */}
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

                    {/* Adresă (doar dacă nu e deja cerută sus) */}
                    {!addressAbove && (
                      <>
                        <div>
                          <label className={labelCls}>Adresă domiciliu (stradă, număr, bloc, apartament)</label>
                    <p className="text-[11px] text-red-600 -mt-1 mb-1">Scrieți adresa EXACT ca în actul de identitate — va fi folosită pe brevet/diplomă.</p>
                          <input className={fieldCls('address')} value={form.address} placeholder="Str. Exemplu nr. 1, Bl. X, Ap. Y"
                            onChange={e => { setForm(f=>({...f,address:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('address');return n}) }} />
                        </div>
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
                      </>
                    )}

                    {/* Țară + Expirare CI */}
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

                    {/* Cetățenie */}
                    <div>
                      <label className={labelCls}>Cetățenie</label>
                      <input className={fieldCls('nationality')} value={form.nationality} placeholder="ROU"
                        onChange={e => { setForm(f=>({...f,nationality:e.target.value.toUpperCase()})); setScannedFields(s=>{const n=new Set(s);n.delete('nationality');return n}) }} />
                    </div>

                    {/* Telefon + Email — aceleași câmpuri ca la „Confirmă telefon și email";
                        folosesc aceeași stare, deci se sincronizează în timp real */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={labelCls}>Telefon</label>
                        <input className={fieldCls('phone')} type="tel" value={form.phone} placeholder="07XX XXX XXX"
                          onChange={e => { setForm(f=>({...f,phone:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('phone');return n}) }} />
                      </div>
                      <div>
                        <label className={labelCls}>Email</label>
                        <input className={fieldCls('email')} type="email" value={form.email}
                          onChange={e => { setForm(f=>({...f,email:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('email');return n}) }} />
                      </div>
                    </div>
                    {emailChanged && (
                      <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
                        <AlertCircle size={14} className="shrink-0 mt-0.5" />
                        <span>Modificarea adresei de email <strong>va duce la modificarea datelor de accesare portal</strong> (veți folosi noul email la următoarea autentificare).</span>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button onClick={async () => { await autoSave(); }}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors">
                        <Check size={12}/> Salvează date
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            </div>

            {/* ── Certificat LRC existent — doar la prelungirea valabilității ── */}
            {needsLrcCert && (
              <div className="bg-white rounded-2xl p-6 shadow-2xl">
                <h2 className="font-bold text-gray-900 mb-1">Certificat LRC actual</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Pentru prelungirea valabilității avem nevoie de certificatul dumneavoastră GMDSS/LRC existent.
                  Numărul și datele se completează automat din scanare — verificați-le și corectați dacă e cazul.
                  {fereastraPrelungire && (
                    <span className="text-red-600"> Prelungirea se face doar dacă certificatul expiră între {fereastraPrelungire.de_la} și {fereastraPrelungire.pana_la}.</span>
                  )}
                </p>

                <label className={`flex items-center justify-center gap-3 w-full px-4 py-3.5 rounded-xl border-2 border-dashed cursor-pointer transition-all mb-4 ${
                  lrcStatus === 'done' ? 'border-green-400 bg-green-50' :
                  lrcStatus === 'error' ? 'border-red-300 bg-red-50' :
                  (lrcStatus === 'saving' || lrcStatus === 'scanning') ? 'border-blue-300 bg-blue-50' :
                  'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                  {lrcStatus === 'saving' ? <><Loader2 size={16} className="text-blue-500 animate-spin"/><span className="text-sm text-blue-600 font-medium">Se salvează...</span></>
                   : lrcStatus === 'scanning' ? <><Loader2 size={16} className="text-blue-500 animate-spin"/><span className="text-sm text-blue-600 font-medium">Se citesc datele de pe certificat...</span></>
                   : lrcStatus === 'done' ? <><CheckCircle size={16} className="text-green-600"/><span className="text-sm text-green-700 font-medium">Certificat LRC încărcat ✓ (apăsați pentru a înlocui)</span></>
                   : lrcStatus === 'error' ? <><Upload size={16} className="text-red-400"/><span className="text-sm text-red-600 font-medium">Încărcare eșuată — încercați din nou</span></>
                   : <><Upload size={16} className="text-gray-400"/><span className="text-sm text-gray-600 font-medium">Apăsați pentru a încărca/scana CERTIFICATUL LRC</span></>}
                  <input type="file" accept="image/*" className="hidden" onChange={handleLrcUpload} />
                </label>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={handleLrcUpload} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleLrcUpload} />
                    </label>
                  </div>

                <div className="grid sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Nr. certificat</label>
                    <input value={lrc.numar} onChange={e => setLrc(v => ({ ...v, numar: e.target.value }))}
                      onBlur={e => saveLrcField('numar', e.target.value)}
                      placeholder="ex. 12345"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className={labelCls}>Emis la</label>
                    <input value={lrc.emis_la} onChange={e => setLrc(v => ({ ...v, emis_la: e.target.value }))}
                      onBlur={e => saveLrcField('emis_la', e.target.value)}
                      placeholder="zz.ll.aaaa"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
                  </div>
                  <div>
                    <label className={labelCls}>Expiră la</label>
                    <input value={lrc.expira_la} onChange={e => setLrc(v => ({ ...v, expira_la: e.target.value }))}
                      onBlur={e => saveLrcField('expira_la', e.target.value)}
                      placeholder="zz.ll.aaaa"
                      className={`w-full px-3 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        problemaPrelungire ? 'border-red-400 ring-1 ring-red-200 focus:ring-red-200' : 'border-gray-200 focus:ring-blue-200'}`} />
                  </div>
                </div>

                {/* Data expirării nu se încadrează în fereastra de prelungire */}
                {problemaPrelungire && (
                  <div className="mt-3 rounded-xl border-2 border-red-300 bg-red-50 px-4 py-3 flex gap-3 items-start flex-wrap">
                    <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                    <p className="flex-1 min-w-[12rem] text-sm text-red-700 font-medium">{problemaPrelungire}</p>
                    {/* comută pe loc între obținere și prelungire */}
                    <div className="flex rounded-lg overflow-hidden border border-red-300 shrink-0">
                      {classOptions.map(o => {
                        const ales = classCaa === o.value
                        return (
                          <button key={o.value} type="button" onClick={() => updateClass(o.value)}
                            className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                              ales ? 'bg-red-600 text-white' : 'bg-white text-red-700 hover:bg-red-100'}`}>
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {student?.lrc_certificat_data && (
                  <div className="mt-4 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
                    <img src={student.lrc_certificat_data} alt="Certificat LRC" className="w-full max-h-64 object-contain" />
                  </div>
                )}
              </div>
            )}

            {/* ── Linkuri utile (doar cele completate în sesiune) ── */}
            {(resurse.length > 0 || (examScope === 'practica_ba' && areCaiet && session?.access_code)) && (
              <div className={'bg-white rounded-2xl p-6 shadow-2xl ' + (dateGata ? 'order-[-10]' : '')}>
                <h2 className="font-bold text-gray-900 mb-1">Linkuri utile</h2>
                <p className="text-xs text-gray-400 mb-4">Cursul online, materialele și grupurile seriei.</p>

                {/* Zoom sus, pe toată lățimea */}
                <div className="space-y-2">
                  {resurse.filter(r => r.cheie === 'zoom_url').map(r => (
                    <LinkRand key={r.cheie} r={r} />
                  ))}
                </div>

                {/* Grupurile de WhatsApp și arhiva video — pătrate mari, pe un rând,
                    împărțind lățimea între ele */}
                {(() => {
                  const mari = (['whatsapp_url', 'comunitate_url', 'arhiva_video_url'] as const)
                    .map(cheie => resurse.find(x => x.cheie === cheie)).filter(Boolean) as typeof resurse
                  // la clasa B/A, lângă grupuri stă și caietul de curs
                  const caiet = examScope === 'practica_ba' && areCaiet && session?.access_code
                  if (!mari.length && !caiet) return null
                  const cate = mari.length + (caiet ? 1 : 0)
                  const trei = cate >= 3
                  return (
                    <div className="grid gap-2 mt-2" style={{ gridTemplateColumns: `repeat(${Math.min(cate, 3)}, minmax(0, 1fr))` }}>
                      {mari.map(r => (
                        <a key={r.cheie} href={r.url} target="_blank" rel="noopener noreferrer"
                          className={`flex flex-col items-center justify-center text-center gap-2 rounded-xl border-2 border-gray-200 hover:border-green-400 hover:bg-green-50/40 transition-all ${
                            trei ? 'p-3 min-h-[8rem]' : 'p-4 min-h-[9rem]'}`}>
                          <span className={`shrink-0 rounded-2xl flex items-center justify-center ${trei ? 'w-12 h-12' : 'w-14 h-14'}`}
                            style={{ background: r.fundal }}>
                            {r.iconMare}
                          </span>
                          <span className={`font-medium text-gray-800 leading-tight ${trei ? 'text-xs' : 'text-sm'}`}>{r.titlu}</span>
                        </a>
                      ))}
                      {caiet && (
                        <a href={`/portal/curs-b?cod=${session.access_code}`}
                          className={`flex flex-col items-center justify-center text-center gap-2 rounded-xl border-2 border-sky-200 hover:border-sky-400 hover:bg-sky-50/60 transition-all ${
                            trei ? 'p-3 min-h-[8rem]' : 'p-4 min-h-[9rem]'}`}>
                          <span className={`shrink-0 rounded-2xl flex items-center justify-center ${trei ? 'w-12 h-12' : 'w-14 h-14'}`}
                            style={{ background: '#7dd3fc' }}>
                            <NotebookPen size={trei ? 24 : 30} className="text-sky-900" />
                          </span>
                          <span className={`font-medium text-gray-800 leading-tight ${trei ? 'text-xs' : 'text-sm'}`}>Curs B/A</span>
                        </a>
                      )}
                    </div>
                  )
                })()}

                {/* Restul — manualele — dedesubt */}
                <div className="space-y-2 mt-2">
                  {resurse.filter(r => !['zoom_url', 'whatsapp_url', 'comunitate_url', 'arhiva_video_url'].includes(r.cheie)).map(r => (
                    <LinkRand key={r.cheie} r={r} />
                  ))}
                </div>
              </div>
            )}

            {/* Examenul de radio, cât timp e deschis — sus, ca să nu stea ascuns
                în folderul de date personale */}
            {(student?.class_caa || '').toLowerCase().match(/radio|lrc/) && examSubmitted && examAcces !== 'deschis' ? (
              examRezultatePublic && examNota !== null ? (
                examNota >= 15 ? (
                  <div className="order-[-40] rounded-2xl p-5 shadow-2xl bg-green-50 border-2 border-green-300 flex items-center gap-2 text-sm text-green-800">
                    <CheckCircle size={16} className="shrink-0" />
                    <span><strong>Test finalizat</strong> — rezultat examen {examNota}/20. Admis. Felicitări!</span>
                  </div>
                ) : (
                  <div className="order-[-40] rounded-2xl p-5 shadow-2xl bg-red-50 border-2 border-red-300 flex items-start gap-2 text-sm text-red-800">
                    <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                    <span>
                      <strong>Test finalizat</strong> — rezultat examen {examNota}/20. Respins. Vă rugăm să vă reînscrieți
                      la curs prin email <a href="mailto:office@setsail.ro" className="underline">office@setsail.ro</a>
                    </span>
                  </div>
                )
              ) : (
                <div className="order-[-40] rounded-2xl p-5 shadow-2xl bg-purple-50 border-2 border-purple-200 flex items-center gap-2 text-sm text-purple-700">
                  <CheckCircle size={16} className="shrink-0" />
                  <span><strong>Test finalizat</strong> — examenul a fost trimis. Nu mai poate fi accesat.</span>
                </div>
              )
            ) : (student?.class_caa || '').toLowerCase().match(/radio|lrc/)
              // activ = îl văd toți; altfel, doar cui i l-a deschis examinatorul anume
              && session?.radio_exam_status !== 'draft' && examAcces !== 'inchis'
              && (session?.radio_exam_status === 'active' || examAcces === 'deschis') ? (
              <a href={`/portal/examen?cod=${session.access_code}`}
                className="order-[-40] rounded-2xl p-5 shadow-2xl bg-purple-50 border-2 border-purple-300 hover:bg-purple-100 transition-colors flex items-center gap-3 text-sm text-purple-800">
                <span className="text-xl leading-none">📻</span>
                <span><strong>Examinare Radio LRC disponibilă</strong> — apăsați aici pentru a începe examenul.</span>
              </a>
            ) : null}

            {/* Mesajul de la verificarea dosarului, când l-am făcut vizibil din listă */}
            {student?.verify_nota_vizibila && String(student?.verify_nota || '').trim()
              // nota se arată doar cât timp e ceva de rezolvat (galben sau roșu)
              && (student.verify_stare === 'atentie' || student.verify_stare === 'problema') && (
              <div className={`${dateGata ? 'order-[-5]' : ''} rounded-2xl p-5 shadow-2xl border-2 border-fuchsia-400 ${
                student.verify_stare === 'problema' ? 'bg-red-50' : 'bg-amber-50'}`}>
                <h2 className={`font-bold flex items-center gap-2 ${
                  student.verify_stare === 'problema' ? 'text-red-800' : 'text-amber-800'}`}>
                  <AlertTriangle size={16} /> De completat / de corectat
                </h2>
                <p className={`text-sm mt-1 whitespace-pre-line ${
                  student.verify_stare === 'problema' ? 'text-red-700' : 'text-amber-800'}`}>
                  {student.verify_nota}
                </p>
                <p className="text-[11px] text-gray-500 mt-2">
                  Mesaj de la echipa SetSail, după verificarea dosarului dumneavoastră.
                </p>
              </div>
            )}

            {/* ── Adresa de corespondență pentru materialele de curs ──
                La radio și la clasa B/A nu se trimit materiale, deci secțiunea nici nu apare.
                În rest, după ce e completată și cursul a început, se strânge sub
                „Date personale", ca să nu încarce pagina. */}
            {!isRadioSession && examScope !== 'practica_ba' && (
            <div className={'bg-white rounded-2xl p-6 shadow-2xl ' + (adresaStransa ? 'order-[92]' : '')}>
              {adresaStransa ? (
                <button type="button" onClick={() => setAdresaDesfasurata(v => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="font-bold text-gray-900">Adresa de corespondență</span>
                    <span className="text-xs text-gray-400">{livrareRezumat}</span>
                  </span>
                  {adresaDesfasurata ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
              ) : (<>
                <div className="flex items-start justify-between gap-3 mb-1">
                  <h2 className="font-bold text-gray-900">Adresă de corespondență materiale de curs</h2>
                  {livrareSalvata && (
                    <span className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-green-700 bg-green-50 border border-green-200">
                      <CheckCircle size={13} /> Date salvate
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">Unde trimitem materialele. Datele de contact sunt ale dumneavoastră — le puteți modifica.</p>
              </>)}

              <div className={adresaStransa && !adresaDesfasurata ? 'hidden' : adresaStransa ? 'mt-4' : ''}>

              <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4 ${adresaStransa ? 'text-xs' : ''}`}>
                {([
                  { tip: 'sala', titlu: 'Nu e nevoie, mă prezint în sală' },
                  { tip: 'easybox', titlu: 'Easybox Sameday' },
                  { tip: 'domiciliu', titlu: 'Aceeași adresă ca domiciliul' },
                  { tip: 'alta', titlu: 'Altă adresă' },
                ] as const).map(o => {
                  const ales = livrare.tip === o.tip
                  const verde = o.tip === 'sala'
                  return (
                    <button key={o.tip} type="button" onClick={() => alegeLivrare(o.tip)}
                      className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 font-medium transition-all ${
                        adresaStransa ? 'px-2 py-2 text-xs' : 'px-3 py-3 text-sm'} ${
                        ales
                          ? (verde ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-500 bg-blue-50 text-blue-700')
                          : (verde ? 'border-green-500 text-green-700 hover:bg-green-50/60' : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50/40')}`}>
                      {o.tip === 'easybox' && (
                        <span className="px-2 py-0.5 rounded-md text-[11px] font-extrabold tracking-tight text-white" style={{ background: '#e62e2d' }}>sameday</span>
                      )}
                      <span className="text-center leading-tight">{o.titlu}</span>
                    </button>
                  )
                })}
              </div>

              {/* „Mă prezint în sală": nu mai cerem adresă */}
              {livrare.tip === 'sala' && (
                <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-5 text-center">
                  <p className="font-semibold text-green-800">Mulțumim, vă așteptăm la bord!</p>
                </div>
              )}

              {livrare.tip && livrare.tip !== 'sala' && (
                <div className="space-y-3">
                  <div>
                    <label className={labelCls}>
                      {livrare.tip === 'easybox' ? 'Easybox ales (localitate, stradă, denumirea locker-ului)' : 'Adresa de livrare'}
                    </label>
                    <textarea rows={2} value={livrare.adresa}
                      onChange={e => setLivrare(v => ({ ...v, adresa: e.target.value }))}
                      onBlur={salveazaLivrare}
                      placeholder={livrare.tip === 'easybox' ? 'ex. Easybox Kaufland Băneasa, Șos. București-Ploiești 44, București' : 'stradă, număr, bloc, scară, apartament, localitate, județ'}
                      className={inputCls} />
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className={labelCls}>Persoană de contact curier</label>
                      <input value={livrare.contact} onChange={e => setLivrare(v => ({ ...v, contact: e.target.value }))}
                        onBlur={salveazaLivrare} placeholder="nume și prenume" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Telefon</label>
                      <input value={livrare.telefon} onChange={e => setLivrare(v => ({ ...v, telefon: e.target.value }))}
                        onBlur={salveazaLivrare} placeholder="07XX XXX XXX" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Email</label>
                      <input value={livrare.email} onChange={e => setLivrare(v => ({ ...v, email: e.target.value }))}
                        onBlur={salveazaLivrare} placeholder="email@exemplu.ro" className={inputCls} />
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
            )}

            {/* ── Radio: cerere de examen în locul semnăturii cu pixul ── */}
            {isRadioSession && (
              <div className="bg-white rounded-2xl p-6 shadow-2xl">
                <h2 className="font-bold text-gray-900 mb-1">Cererea de examen</h2>
                <p className="text-xs text-gray-400 mb-4">
                  Descărcați cererea, semnați-o, apoi încărcați-o înapoi. Alternativ, puteți încărca doar
                  o poză cu semnătura dumneavoastră pe hârtie — o așezăm noi pe cerere.
                </p>

                {/* Avertisment: fără datele de mai sus cererea ar ieși cu linii punctate */}
                {cerereMissing.length > 0 && (
                  <div className="mb-3 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
                    <p className="text-sm font-semibold text-amber-800 flex items-center gap-2">
                      <AlertTriangle size={15} /> Sunt necesare datele personale completate
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Completați mai sus: <b>{cerereMissing.join(', ')}</b>. Cererea nu poate fi generată fără aceste date.
                    </p>
                  </div>
                )}

                {/* 1. Descarcă */}
                <button onClick={downloadCerere} disabled={cerereBusy || cerereMissing.length > 0}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                  style={{ background: '#0a1628' }}>
                  {cerereBusy ? <><Loader2 size={15} className="animate-spin" /> Se pregătește cererea…</>
                    : <><FileText size={15} /> 1. Descarcă cererea de examen</>}
                </button>
                {/* Cine și-a încărcat semnătura primește cererea gata semnată, fără print și scan */}
                {existingSignature && (
                  <button onClick={genereazaCerereSemnata} disabled={cerereSemnBusy || cerereMissing.length > 0}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed mb-2"
                    style={{ background: '#1d4ed8' }}>
                    {cerereSemnBusy ? <><Loader2 size={15} className="animate-spin" /> Se generează…</>
                      : <><FileText size={15} /> Generează cererea semnată</>}
                  </button>
                )}
                {cerereNr && (
                  <p className="text-xs text-green-700 text-center mb-4 flex items-center justify-center gap-1">
                    <CheckCircle size={11} /> Cererea dumneavoastră: <b>nr. {cerereNr}</b> din {cerereData}
                  </p>
                )}
                {!cerereNr && <div className="mb-4" />}

                {/* 2a. Cererea semnată, scanată — dropzone + previzualizare, ca la actele de identitate */}
                <div className="flex gap-3 mb-3">
                  <label className={`flex flex-col items-center justify-center text-center gap-2 flex-1 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all aspect-[210/297] ${
                    cerereSemnStatus === 'done' ? 'border-green-400 bg-green-50' :
                    cerereSemnStatus === 'saving' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {cerereSemnStatus === 'saving' ? <><Loader2 size={20} className="text-blue-500 animate-spin"/><span className="text-xs text-blue-600 font-medium">Se salvează...</span></>
                     : cerereSemnStatus === 'done' ? <><CheckCircle size={22} className="text-green-600"/><span className="text-xs text-green-700 font-medium">Cerere semnată încărcată ✓<br/>(apăsați pentru a înlocui)</span></>
                     : <><Upload size={22} className="text-gray-400"/><span className="text-xs text-gray-600 font-medium">2. Încărcați cererea SEMNATĂ (poză, scan sau PDF)</span></>}
                    <input type="file" accept="image/*,application/pdf,.pdf" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; estePdf(f) ? salveazaPdf(f, 'cerere_semnata_data', setCerereSemnStatus) : setEditFile({ file: f, kind: 'cerere' }) }} />
                  </label>
                  <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-[210/297] overflow-hidden flex items-center justify-center">
                    {!student?.cerere_semnata_data
                      ? <span className="text-xs text-gray-300 px-2 text-center">Previzualizare cerere</span>
                      : String(student.cerere_semnata_data).startsWith('data:application/pdf')
                        // cererea generată de noi e PDF, nu poză
                        ? <button type="button" onClick={() => deschideCerere(student.cerere_semnata_data)}
                            className="flex flex-col items-center gap-2 text-center px-3">
                            <FileText size={28} className="text-blue-600" />
                            <span className="text-xs text-blue-700 font-medium underline">Vezi cererea semnată</span>
                          </button>
                        : <img src={student.cerere_semnata_data} alt="Cererea semnată" className="w-full h-full object-contain" />}
                  </div>
                </div>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier sau PDF
                      <input type="file" accept="image/*,application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (!f) return; estePdf(f) ? salveazaPdf(f, 'cerere_semnata_data', setCerereSemnStatus) : setEditFile({ file: f, kind: 'cerere' }) }} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditFile({ file: f, kind: 'cerere' }) }} />
                    </label>
                  </div>

                <div className="flex items-center gap-3 my-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">sau</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* 2b. Doar semnătura, pe care o așezăm noi pe cerere */}
                <div className="flex gap-3">
                  <label className={`flex flex-col items-center justify-center text-center gap-2 flex-1 p-3 rounded-xl border-2 border-dashed cursor-pointer transition-all aspect-[3/1] ${
                    sigPhotoStatus === 'done' ? 'border-green-400 bg-green-50' :
                    sigPhotoStatus === 'saving' ? 'border-blue-300 bg-blue-50' :
                    'border-gray-200 hover:border-blue-300 hover:bg-blue-50/50'}`}>
                    {sigPhotoStatus === 'saving' ? <><Loader2 size={18} className="text-blue-500 animate-spin"/><span className="text-xs text-blue-600 font-medium">Se procesează...</span></>
                     : sigPhotoStatus === 'done' ? <><CheckCircle size={18} className="text-green-600"/><span className="text-xs text-green-700 font-medium">Semnătură încărcată ✓<br/>(apăsați pentru a înlocui)</span></>
                     : <><Upload size={18} className="text-gray-400"/><span className="text-xs text-gray-600 font-medium">Încărcați o POZĂ cu semnătura de pe hârtie</span></>}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditFile({ file: f, kind: 'semnatura' }) }} />
                  </label>
                  <div className="flex-1 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 aspect-[3/1] overflow-hidden flex items-center justify-center p-1">
                    {existingSignature
                      ? <img src={existingSignature} alt="Semnătura înregistrată" className="w-full h-full object-contain" />
                      : <span className="text-xs text-gray-300 px-2 text-center">Previzualizare semnătură</span>}
                  </div>
                </div>
                  <div className="flex gap-2 mt-1.5">
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Upload size={13} /> Alege fișier din telefon
                      <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditFile({ file: f, kind: 'semnatura' }) }} />
                    </label>
                    <label className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer">
                      <Camera size={13} /> Fă o poză
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditFile({ file: f, kind: 'semnatura' }) }} />
                    </label>
                  </div>

                {/* Reîncărcare explicită — dacă semnătura a ieșit prost la procesare */}
                {sigPhotoStatus === 'done' && (
                  <label className="mt-2 flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl border-2 border-amber-400 text-amber-700 bg-amber-50/50 hover:bg-amber-50 cursor-pointer transition-all">
                    <RotateCcw size={14} />
                    <span className="text-sm font-medium">Înlocuiește semnătura</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setEditFile({ file: f, kind: 'semnatura' }) }} />
                  </label>
                )}
                <p className="text-xs text-gray-400 mt-2">
                  Semnați cu pixul pe o foaie albă și fotografiați doar semnătura. Decupați-o în editor, o curățăm automat
                  și o așezăm pe cerere, sub numele dumneavoastră.
                </p>
              </div>
            )}

            {/* Programare la practică — doar la cursurile C/D (Snagov) */}
            {isSnagovCourse && student?.id && session?.access_code && (
              <PracticeBooking studentId={student.id} accessCode={session.access_code} />
            )}

            {/* Semnătură (canvas) — nu la radio, unde se semnează pe cerere */}
            {!isRadioSession && (
            <div className={'bg-white rounded-2xl p-6 shadow-2xl ' + (dateGata ? 'order-[95]' : '')}>
              {dateGata && semnaturaGata ? (
                <button type="button" onClick={() => setSemnaturaDesfasurata(v => !v)}
                  className="w-full flex items-center justify-between gap-2 text-left">
                  <span className="flex items-center gap-2">
                    <CheckCircle size={16} className="text-green-600" />
                    <span className="font-bold text-gray-900">Semnătură</span>
                    <span className="text-xs text-gray-400">salvată</span>
                  </span>
                  {semnaturaDesfasurata ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
              ) : (<>
                <h2 className="font-bold text-gray-900 mb-1">Semnătură</h2>
                <p className="text-xs text-gray-400 mb-3">Semnați în zona de mai jos cu degetul sau mouse-ul</p>
              </>)}
              <div className={ascundeSemnatura ? 'hidden' : (dateGata && semnaturaGata) ? 'mt-4' : ''}>

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
              </div>
            </div>
            )}

            {/* Confirmă telefon / email + finalizare */}
            <div className="bg-white rounded-2xl p-6 shadow-2xl">
              <h2 className="font-bold text-gray-900 mb-1">Confirmă telefon și email</h2>
              <p className="text-xs text-gray-400 mb-3">Folosim aceste date pentru a vă contacta legat de examen.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Telefon</label>
                  <input className={fieldCls('phone')} type="tel" value={form.phone} placeholder="07XX XXX XXX"
                    onChange={e => { setForm(f=>({...f,phone:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('phone');return n}) }} />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input className={fieldCls('email')} type="email" value={form.email}
                    onChange={e => { setForm(f=>({...f,email:e.target.value})); setScannedFields(s=>{const n=new Set(s);n.delete('email');return n}) }} />
                </div>
              </div>
              {emailChanged && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>Modificarea adresei de email <strong>va duce la modificarea datelor de accesare portal</strong> (veți folosi noul email la următoarea autentificare).</span>
                </div>
              )}

              <div className="mt-5">
                <button onClick={saveAll} disabled={saving}
                  className={`w-full py-3.5 rounded-xl text-sm font-bold shadow-lg transition-all ${saving ? 'opacity-60 cursor-not-allowed' : 'hover:opacity-90'}`}
                  style={student?.portal_status === 'signed'
                    ? { background: '#93c5fd', color: '#1e3a8a' }
                    : { background: '#86efac', color: '#14532d' }}>
                  {saving ? 'Se salvează...' : student?.portal_status === 'signed' ? '✓ Actualizează datele' : '✓ Salvează și finalizează'}
                </button>
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
            {session?.radio_exam_status === 'active' && (student?.class_caa || '').toLowerCase().match(/radio|lrc/) && (
              <a href={`/portal/examen?cod=${session.access_code}`}
                className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-700 hover:bg-purple-100 transition-colors flex items-center gap-2 text-left">
                <span className="text-base leading-none">📻</span>
                <span><strong>Examinare Radio LRC disponibilă</strong> — apasă aici pentru a începe examenul.</span>
              </a>
            )}
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