'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { parseStudentsText } from '@/lib/import-parse'

type Row = {
  id: string; full_name: string; email: string; cnp: string; birth_date: string
  address: string; city: string; county: string; obtinere_prelungire: string
  has_ci: boolean; has_verso: boolean
  doc_type: string
  has_adeverinta: boolean; has_cert_nastere: boolean
  has_signature: boolean; has_cerere: boolean; has_vhf: boolean
  cerere_nr: number | null; cerere_data: string | null
}

// Documentele unui cursant, adresabile după cheie (recto = fața actului)
type DocKey = 'recto' | 'verso' | 'domiciliu' | 'cert_nastere' | 'vhf' | 'semnatura' | 'cerere'
const DOC_FLAG: Record<DocKey, keyof Row> = {
  recto: 'has_ci', verso: 'has_verso', domiciliu: 'has_adeverinta',
  cert_nastere: 'has_cert_nastere', vhf: 'has_vhf', semnatura: 'has_signature', cerere: 'has_cerere',
}
const DOC_LABEL_FULL: Record<DocKey, string> = {
  recto: 'Act de identitate', verso: 'Verso CI nou', domiciliu: 'Adeverință domiciliu',
  cert_nastere: 'Certificat de naștere', vhf: 'Carnet VHF/LRC existent',
  semnatura: 'Semnătură', cerere: 'Cerere semnată',
}
// Eticheta scurtă din celula CI, după tipul actului ales de cursant
const DOC_SHORT: Record<string, string> = {
  ci_vechi: 'CI vechi', ci_nou: 'CI nou', ci_strain: 'ID străin', pasaport: 'Pass.',
}
// Coloanele care sunt doar o bifă — antet scurt, denumirea completă în tooltip
const CHECK_COLS: { key: DocKey; short: string; full: string }[] = [
  { key: 'verso', short: 'Verso', full: 'Verso CI nou' },
  { key: 'domiciliu', short: 'Domic', full: 'Adeverință domiciliu (CI nou)' },
  { key: 'cert_nastere', short: 'Nașt', full: 'Certificat de naștere' },
  { key: 'vhf', short: 'VHF', full: 'Carnetul VHF/LRC existent (la prelungire)' },
  { key: 'semnatura', short: 'Semnat', full: 'Semnătură încărcată' },
  { key: 'cerere', short: 'Cerere', full: 'Cerere semnată încărcată' },
]
// documentele de identitate · VHF (după obținere/prelungire) · semnătura / cererea
const DOC_COLS_ID = CHECK_COLS.slice(0, 3)
const VHF_COL = CHECK_COLS[3]
const DOC_COLS_END = CHECK_COLS.slice(4)

// Starea unei coloane de document pentru un cursant:
//   ok = încărcat · lipsa = necesar dar lipsește · na = nu e cazul · unknown = tipul actului nu e ales
type DocState = 'ok' | 'lipsa' | 'na' | 'unknown'
function docState(row: Row, key: DocKey): DocState {
  if (row[DOC_FLAG[key]]) return 'ok'          // încărcat, chiar dacă n-ar fi obligatoriu
  const t = row.doc_type
  if (key === 'semnatura') return row.has_cerere ? 'na' : 'lipsa'   // cererea semnată ține loc de semnătură
  if (key === 'cerere') return row.has_signature ? 'na' : 'lipsa'   // și invers
  if (key === 'recto') return 'lipsa'
  // carnetul VHF/LRC se cere doar la prelungirea valabilității
  if (key === 'vhf') return row.obtinere_prelungire === 'prelungire' ? 'lipsa'
    : row.obtinere_prelungire ? 'na' : 'unknown'
  if (!t) return 'unknown'
  if (key === 'verso' || key === 'domiciliu') return t === 'ci_nou' ? 'lipsa' : 'na'
  if (key === 'cert_nastere') return (t === 'ci_strain' || t === 'pasaport') ? 'lipsa' : 'na'
  return 'na'
}
// Cursantul e „în regulă" când are CNP și niciun document necesar nu lipsește
// (bifat sau N/A peste tot) — atunci coloanele de la CNP încolo se colorează verde.
function rowComplete(row: Row): boolean {
  if (!String(row.cnp || '').trim()) return false
  const keys: DocKey[] = ['recto', ...CHECK_COLS.map(c => c.key)]
  return keys.every(k => { const s = docState(row, k); return s === 'ok' || s === 'na' })
}

const DocCell = ({ state }: { state: DocState }) =>
  state === 'ok' ? <span className="text-green-600 font-semibold">✓</span>
  : state === 'na' ? <span className="text-green-600 text-[10px] font-semibold">N/A</span>
  : state === 'lipsa' ? <span className="text-red-500 font-bold">!</span>
  : <span className="text-gray-300">–</span>

const LRC_OPTS: [string, string][] = [['', '—'], ['obtinere', 'Obținere LRC'], ['prelungire', 'Prelungire LRC']]
const lrcLabel = (v: string) => LRC_OPTS.find(o => o[0] === v)?.[1] || '—'

// Select Obținere/Prelungire LRC — albastru bold, cu confirmare suplimentară la modificare
function LrcSelect({ value, onConfirm }: { value: string; onConfirm: (v: string) => void }) {
  return (
    <select value={value || ''}
      onChange={e => {
        const v = e.target.value
        if (v === (value || '')) return
        if (confirm(`Confirmi modificarea în „${lrcLabel(v)}"?`)) onConfirm(v)
        else e.target.value = value || '' // revine vizual dacă se anulează
      }}
      className="text-sm font-bold text-blue-600 bg-blue-50 border border-blue-200 rounded-lg px-2 py-1 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200">
      {LRC_OPTS.map(([v, l]) => <option key={v} value={v} className="font-normal text-gray-800">{l}</option>)}
    </select>
  )
}
type Verified = { corina: boolean; paula: boolean; ruxandra: boolean }

const FIELDS: { key: keyof Row; label: string; w?: string }[] = [
  { key: 'full_name', label: 'Nume și prenume', w: 'min-w-[180px]' },
  { key: 'email', label: 'Email', w: 'min-w-[200px]' },
  { key: 'cnp', label: 'CNP', w: 'min-w-[140px]' },
  { key: 'birth_date', label: 'Data nașterii', w: 'min-w-[110px]' },
  { key: 'address', label: 'Adresă', w: 'min-w-[200px]' },
  { key: 'city', label: 'Localitate', w: 'min-w-[120px]' },
  { key: 'county', label: 'Județ', w: 'min-w-[110px]' },
]
// Tabul „Lista cursanți" — doar identificarea persoanei; restul coloanelor sunt stări de documente
const PERSON_FIELDS = FIELDS
  .filter(f => ['full_name', 'email', 'cnp'].includes(f.key as string))
  // fără lățimi minime: coloanele se strâng la conținut, iar numele/emailul nu se rup
  // pe două rânduri (rânduri de aceeași înălțime, tabelul scrollează pe orizontală)
  .map(f => ({ ...f, w: 'whitespace-nowrap' }))

const roDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ro-RO') : ''

const VERIFIERS: { key: keyof Verified; label: string }[] = [
  { key: 'corina', label: 'Corina' }, { key: 'paula', label: 'Paula' }, { key: 'ruxandra', label: 'Ruxandra' },
]

// Titlul paginii/tab-ului: „Curs Radio 5-7 oct" (din clasa și datele sesiunii)
function sessionTitle(s: { class_caa?: string | null; session_date?: string | null; course_start_date?: string | null } | null): string {
  if (!s?.session_date) return 'Cursanți — sesiune'
  const luna = (d: Date) => d.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '')
  const end = new Date(s.session_date)
  const start = s.course_start_date ? new Date(s.course_start_date) : null
  let interval: string
  if (start && !isNaN(+start) && +start !== +end) {
    interval = start.getMonth() === end.getMonth()
      ? `${start.getDate()}-${end.getDate()} ${luna(end)}`
      : `${start.getDate()} ${luna(start)}-${end.getDate()} ${luna(end)}`
  } else {
    interval = `${end.getDate()} ${luna(end)}`
  }
  return `Curs ${(s.class_caa || '').trim()} ${interval}`.replace(/\s+/g, ' ').trim()
}

// Reduce o imagine la max 1800px lățime, JPEG 0.85
function downscale(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader()
    fr.onerror = () => reject(new Error('citire eșuată'))
    fr.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('imagine invalidă'))
      img.onload = () => {
        const max = 1800
        let { width, height } = img
        if (width > max) { height = Math.round(height * max / width); width = max }
        const c = document.createElement('canvas'); c.width = width; c.height = height
        c.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(c.toDataURL('image/jpeg', 0.85))
      }
      img.src = fr.result as string
    }
    fr.readAsDataURL(file)
  })
}
// Rotește o imagine (data URL) cu 90° (deg = 90 sau -90)
function rotate(src: string, deg: number): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.height; c.height = img.width
      const ctx = c.getContext('2d')!
      ctx.translate(c.width / 2, c.height / 2)
      ctx.rotate(deg * Math.PI / 180)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.src = src
  })
}
// Decupează o imagine după un dreptunghi relativ {x,y,w,h} în 0..1
function crop(src: string, r: { x: number; y: number; w: number; h: number }): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const sx = r.x * img.width, sy = r.y * img.height, sw = r.w * img.width, sh = r.h * img.height
      const c = document.createElement('canvas'); c.width = Math.max(1, sw); c.height = Math.max(1, sh)
      c.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.src = src
  })
}

export default function RosterPage() {
  const { id } = useParams<{ id: string }>()
  const token = useSearchParams().get('token') || ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [verified, setVerified] = useState<Verified>({ corina: false, paula: false, ruxandra: false })
  const [denied, setDenied] = useState(false)
  const [edit, setEdit] = useState<{ id: string; field: keyof Row } | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [ciFor, setCiFor] = useState<{ row: Row; doc: DocKey } | null>(null)
  const [tab, setTab] = useState<'cursanti' | 'adrese' | 'verify' | 'leaduri'>('cursanti')
  const [docsVisible, setDocsVisible] = useState(false)
  const [addOpen, setAddOpen] = useState<null | 'manual' | 'paste'>(null)
  const [title, setTitle] = useState('Cursanți — sesiune')
  const [notice, setNotice] = useState<string | null>(null)
  const [accessCode, setAccessCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedLanding, setCopiedLanding] = useState(false)
  const [visits, setVisits] = useState<{ today: number; overall: number; since: string | null } | null>(null)
  // originea se știe doar în browser — ținută în state ca să nu difere de HTML-ul de pe server
  const [leadsRefresh, setLeadsRefresh] = useState(0)
  const [origin, setOrigin] = useState('')
  useEffect(() => { setOrigin(window.location.origin) }, [])
  const [deleting, setDeleting] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/roster?session_id=${id}&token=${encodeURIComponent(token)}`)
    if (r.status === 403) { setDenied(true); return }
    const j = await r.json()
    setRows(j.students || [])
    if (j.verified) setVerified(j.verified)
    setDocsVisible(!!j.docs_visible)
    setAccessCode(j.access_code || '')
    setVisits(j.visits || null)
    if (j.session) {
      const t = sessionTitle(j.session)
      setTitle(t)
      document.title = t
    }
  }, [id, token])
  useEffect(() => { load() }, [load])

  const rowUpdate = (sid: string, partial: Partial<Row>) =>
    setRows(rs => (rs || []).map(x => x.id === sid ? { ...x, ...partial } : x))

  async function commit() {
    if (!edit) return
    const { id: sid, field } = edit
    setSaving(true)
    const r = await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id, token, student_id: sid, field, value: draft }),
    })
    setSaving(false)
    if (!r.ok) { alert('Salvare eșuată.'); return }
    rowUpdate(sid, { [field]: draft } as Partial<Row>)
    setEdit(null)
  }

  async function saveLrc(sid: string, v: string) {
    const r = await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id, token, student_id: sid, field: 'obtinere_prelungire', value: v }),
    })
    if (!r.ok) { alert('Salvare eșuată.'); return }
    rowUpdate(sid, { obtinere_prelungire: v } as Partial<Row>)
  }

  // Ștergere: întâi aflăm dacă persoana mai e înscrisă și în alte serii, ca să
  // spunem în confirmare exact ce urmează să se întâmple.
  async function removeRow(row: Row) {
    setDeleting(row.id)
    try {
      const u = await fetch(`/api/roster?session_id=${id}&token=${encodeURIComponent(token)}&student_id=${row.id}&action=usage`)
      const usage = u.ok ? await u.json() : { other_count: 0, other_sessions: [] }
      const alte: { session_date?: string | null; class_caa?: string | null }[] = usage.other_sessions || []
      const lista = alte.map(s => `• ${s.class_caa || 'sesiune'}${s.session_date ? ' — ' + new Date(s.session_date).toLocaleDateString('ro-RO') : ''}`).join('\n')
      const msg = usage.other_count > 0
        ? `${row.full_name} este înscris(ă) și în ${usage.other_count} altă/alte serii:\n${lista}\n\nSe șterge DOAR din această serie. Restul rămân neatinse. Continui?`
        : `${row.full_name} este doar în această serie.\n\nȘtergerea îl/o scoate COMPLET din sistem, împreună cu documentele încărcate. Continui?`
      if (!confirm(msg)) return

      const r = await fetch('/api/roster', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id, token, student_id: row.id }),
      })
      if (!r.ok) { alert('Ștergere eșuată.'); return }
      setRows(rs => (rs || []).filter(x => x.id !== row.id))
      setNotice(usage.other_count > 0
        ? `${row.full_name} a fost scos(ă) din această serie (rămâne în ${usage.other_count} altă/alte serii).`
        : `${row.full_name} a fost șters(ă) complet din sistem.`)
    } finally {
      setDeleting(null)
    }
  }

  // Linkul portalului: fără email = cel general al sesiunii; cu email = direct al cursantului
  const portalLink = (email?: string) => {
    const q = email ? `&email=${encodeURIComponent(email)}` : ''
    return `${origin}/portal?cod=${accessCode}${q}`
  }
  async function copyPortalLink() {
    try {
      await navigator.clipboard.writeText(portalLink())
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { alert(portalLink()) }
  }

  // Landing-ul de curs radio — datele lui se iau automat din seria care urmează
  const landingLink = () => `${origin}/curs-radio-gmdss-lrc`
  async function copyLandingLink() {
    try {
      await navigator.clipboard.writeText(landingLink())
      setCopiedLanding(true)
      setTimeout(() => setCopiedLanding(false), 1800)
    } catch { alert(landingLink()) }
  }

  async function toggleVerif(key: keyof Verified) {
    const next = { ...verified, [key]: !verified[key] }
    setVerified(next)
    await fetch('/api/roster', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: id, token, verified: next }),
    })
  }

  if (denied) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#cdd9e5', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Acces restricționat</h1><p style={{ color: '#8aa0b3', fontSize: 14 }}>Link invalid sau token lipsă.</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-500 mt-1">
              Click pe o celulă pentru a edita, apoi confirmă cu ✓ (sau Enter). Apasă „CI" pentru imagini și date.
            </p>
            {accessCode && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Portal cursant:</span>
                <code className="px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-700 break-all">{portalLink()}</code>
                <button onClick={copyPortalLink}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                  {copied ? 'Copiat ✓' : 'Copy link'}
                </button>
                <a href={portalLink()} target="_blank" rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
                  Deschide portal
                </a>
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-xs text-gray-400">Landing page:</span>
              <code className="px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs text-gray-700 break-all">{landingLink()}</code>
              {visits && (
                <span title={visits.since ? `Totalul repornește în ziua examenului seriei precedente (${new Date(visits.since).toLocaleDateString('ro-RO')})` : 'Toate vizitele'}
                  className="px-2 py-1 rounded-lg text-xs border border-emerald-200 bg-emerald-50 text-emerald-800 whitespace-nowrap">
                  Azi <b>{visits.today}</b> · Total <b>{visits.overall}</b>
                </span>
              )}
              <button onClick={copyLandingLink}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
                {copiedLanding ? 'Copiat ✓' : 'Copy link'}
              </button>
              <a href={landingLink()} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-xs font-medium border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100">
                Deschide landing page
              </a>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setAddOpen('manual')}
              className="px-3 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90" style={{ background: '#0a1628' }}>
              + Adaugă cursant
            </button>
            <button onClick={() => setAddOpen('paste')}
              className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">
              Importă din tabel
            </button>
          </div>
        </div>

        {notice && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm text-blue-900">
            <span className="flex-1 whitespace-pre-line">{notice}</span>
            <button onClick={() => setNotice(null)} className="text-blue-400 hover:text-blue-700 leading-none">×</button>
          </div>
        )}

        {/* Checkbox-uri verificare listă */}
        <div className="mb-5 flex flex-wrap gap-2">
          {VERIFIERS.map(v => (
            <label key={v.key}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm select-none transition-colors ${verified[v.key] ? 'border-green-300 bg-green-50 text-green-800' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
              <input type="checkbox" checked={verified[v.key]} onChange={() => toggleVerif(v.key)} className="accent-green-600" />
              Verificat lista {v.label}
            </label>
          ))}
        </div>

        {/* Documente (PV / Anexe) — doar dacă admin a activat vizibilitatea */}
        {docsVisible && <DocsSection sessionId={id} />}

        {/* Taburi */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          {([['cursanti', 'Lista cursanți'], ['adrese', 'Lista verificare adrese'], ['verify', 'Verify by ID'], ['leaduri', 'Leaduri radio']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {tab === 'leaduri' ? (
          <LeaduriTab key={`f-${leadsRefresh}`} sessionId={id} token={token} onEnrolled={() => { load(); setLeadsRefresh(n => n + 1) }} />
        ) : rows === null ? (
          <div className="text-center text-gray-400 py-16">Se încarcă…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-16">Niciun cursant în sesiune.</div>
        ) : tab === 'verify' ? (
          <VerifyTab sessionId={id} token={token} rows={rows} onRowUpdate={rowUpdate} />
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2.5 w-8">#</th>
                  {(tab === 'cursanti' ? PERSON_FIELDS : FIELDS).map(f => <th key={f.key} className={`px-3 py-2.5 ${f.w || ''}`}>{f.label}</th>)}
                  <th className="px-2 py-2.5 text-center whitespace-nowrap">CI</th>
                  {tab === 'cursanti' ? <>
                    {DOC_COLS_ID.map(c => (
                      <th key={c.key} title={c.full} className="px-1 py-2.5 text-center text-[10px] w-12 normal-case tracking-normal">{c.short}</th>
                    ))}
                    <th className="px-2 py-2.5 whitespace-nowrap">Obț. / Prel.</th>
                    <th title={VHF_COL.full} className="px-1 py-2.5 text-center text-[10px] w-12 normal-case tracking-normal">{VHF_COL.short}</th>
                    <th className="px-2 py-2.5 whitespace-nowrap">Cerere nr./data</th>
                    {DOC_COLS_END.map(c => (
                      <th key={c.key} title={c.full} className="px-1 py-2.5 text-center text-[10px] w-14 normal-case tracking-normal">{c.short}</th>
                    ))}
                  </> : (
                    <th className="px-2 py-2.5 min-w-[150px]">Obținere / Prelungire LRC</th>
                  )}
                  <th className="px-1 py-2.5 w-9"></th>
                  <th className="px-1 py-2.5 w-9"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => {
                  const ok = tab === 'cursanti' && rowComplete(row)
                  return (
                  <tr key={row.id} className={`hover:bg-gray-50/60 ${tab === 'cursanti' ? '[&>td]:py-1' : ''}`}>
                    <td className="px-3 py-2 text-gray-300 text-xs">{i + 1}</td>
                    {(tab === 'cursanti' ? PERSON_FIELDS : FIELDS).map(f => {
                      const editing = edit?.id === row.id && edit?.field === f.key
                      // de la CNP încolo, dacă e totul în regulă, fundal verde deschis
                      const green = ok && f.key === 'cnp'
                      return (
                        <td key={f.key} className={`${tab === 'cursanti' ? 'px-2 whitespace-nowrap' : 'px-3'} py-2 align-middle ${green ? 'bg-green-50' : ''}`}>
                          {editing ? (
                            <div className="flex items-center gap-1">
                              <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(null) }}
                                className="w-full min-w-0 px-2 py-1 rounded border border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 text-sm" />
                              <button onClick={commit} disabled={saving} title="Confirmă"
                                className="shrink-0 w-6 h-6 rounded bg-green-500 text-white text-xs hover:bg-green-600 disabled:opacity-50">✓</button>
                              <button onClick={() => setEdit(null)} title="Anulează"
                                className="shrink-0 w-6 h-6 rounded bg-gray-200 text-gray-600 text-xs hover:bg-gray-300">✕</button>
                            </div>
                          ) : (
                            <span onClick={() => { setEdit({ id: row.id, field: f.key }); setDraft((row[f.key] as string) || '') }}
                              className="block cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-blue-50 min-h-[1.4em] text-gray-800">
                              {(row[f.key] as string) || <span className="text-gray-300">—</span>}
                            </span>
                          )}
                        </td>
                      )
                    })}
                    {/* Actul de identitate: eticheta arată tipul ales, culoarea dacă e încărcat */}
                    <td className={`px-2 py-2 text-center ${ok ? 'bg-green-50' : ''}`}>
                      <button onClick={() => setCiFor({ row, doc: 'recto' })}
                        title={row.has_ci ? 'Vezi actul de identitate' : 'Încarcă actul de identitate'}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border whitespace-nowrap ${row.has_ci ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100'}`}>
                        {DOC_SHORT[row.doc_type] || (row.has_ci ? 'CI ✓' : 'CI +')}
                      </button>
                    </td>
                    {tab === 'cursanti' ? <>
                      {DOC_COLS_ID.map(c => (
                        <td key={c.key} className={`px-1 py-2 text-center ${ok ? 'bg-green-50' : ''}`}>
                          <button onClick={() => setCiFor({ row, doc: c.key })} title={c.full}
                            className="w-7 h-6 rounded hover:bg-gray-100">
                            <DocCell state={docState(row, c.key)} />
                          </button>
                        </td>
                      ))}
                      <td className={`px-2 py-2 ${ok ? 'bg-green-50' : ''}`}>
                        <LrcSelect value={row.obtinere_prelungire} onConfirm={v => saveLrc(row.id, v)} />
                      </td>
                      <td className={`px-1 py-2 text-center ${ok ? 'bg-green-50' : ''}`}>
                        <button onClick={() => setCiFor({ row, doc: VHF_COL.key })} title={VHF_COL.full}
                          className="w-7 h-6 rounded hover:bg-gray-100">
                          <DocCell state={docState(row, VHF_COL.key)} />
                        </button>
                      </td>
                      <td className={`px-2 py-2 whitespace-nowrap text-xs ${ok ? 'bg-green-50' : ''}`}>
                        {row.cerere_nr
                          ? <span className="text-gray-800">{row.cerere_nr}<span className="text-gray-400"> / {roDate(row.cerere_data)}</span></span>
                          : <span className="text-gray-300">–</span>}
                      </td>
                      {DOC_COLS_END.map(c => (
                        <td key={c.key} className={`px-1 py-2 text-center ${ok ? 'bg-green-50' : ''}`}>
                          <button onClick={() => setCiFor({ row, doc: c.key })} title={c.full}
                            className="w-8 h-6 rounded hover:bg-gray-100">
                            <DocCell state={docState(row, c.key)} />
                          </button>
                        </td>
                      ))}
                    </> : (
                      <td className="px-2 py-2">
                        <LrcSelect value={row.obtinere_prelungire} onConfirm={v => saveLrc(row.id, v)} />
                      </td>
                    )}
                    <td className="px-1 py-2 text-center">
                      <a href={portalLink(row.email)} target="_blank" rel="noopener noreferrer"
                        title="Deschide portalul cursantului"
                        className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50">
                        ↗
                      </a>
                    </td>
                    <td className="px-1 py-2 text-center">
                      <button onClick={() => removeRow(row)} disabled={deleting === row.id}
                        title="Șterge cursantul din serie"
                        className="w-7 h-7 rounded-lg text-gray-300 hover:text-red-600 hover:bg-red-50 disabled:opacity-40">
                        🗑
                      </button>
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Leadurile de pe landing, sub lista de cursanți — cei înscriși deja
            (după email) nu mai apar aici */}
        {tab === 'cursanti' && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-700 mb-1">Leaduri de pe landing</h2>
            <p className="text-xs text-gray-400 mb-3">
              Solicitări de pe pagina de curs care nu sunt încă în listă. Apasă „Înscrie" ca să treacă în serie.
            </p>
            <LeaduriTab key={`c-${leadsRefresh}`} sessionId={id} token={token} variant="compact"
              onEnrolled={() => { load(); setLeadsRefresh(n => n + 1) }} />
          </div>
        )}
      </div>

      {ciFor && (
        <CiModal sessionId={id} token={token} row={ciFor.row} doc={ciFor.doc}
          onClose={() => setCiFor(null)}
          onRowUpdate={rowUpdate} />
      )}

      {addOpen && (
        <AddStudentsModal sessionId={id} token={token} mode={addOpen}
          onClose={() => setAddOpen(null)}
          onSaved={info => {
            setAddOpen(null)
            const msgs = [
              info?.reused?.length && `Am preluat datele și documentele din sistem pentru: ${info.reused.join(', ')}.`,
              info?.skipped?.length && `Deja în această serie, nu au fost adăugați din nou: ${info.skipped.join(', ')}.`,
            ].filter(Boolean) as string[]
            setNotice(msgs.length ? msgs.join('\n') : null)
            load()
          }} />
      )}
    </div>
  )
}

// ── Modal: adaugă cursanți (manual, unul sau mai mulți) sau import din tabel ──
type NewRow = {
  last_name: string; first_name: string   // doar la adăugarea manuală
  full_name: string                        // vine din import / se compune la salvare
  email: string; cnp: string; birth_date: string
  address: string; city: string; county: string; obtinere_prelungire: string
}
const BLANK_NEW: NewRow = {
  last_name: '', first_name: '', full_name: '', email: '',
  cnp: '', birth_date: '', address: '', city: '', county: '', obtinere_prelungire: '',
}
// Adăugare manuală: strictul necesar
const MANUAL_FIELDS: { key: keyof NewRow; label: string; w: string }[] = [
  { key: 'last_name', label: 'Nume', w: 'min-w-[150px]' },
  { key: 'first_name', label: 'Prenume', w: 'min-w-[150px]' },
  { key: 'email', label: 'Email', w: 'min-w-[220px]' },
]
// Verificarea listei importate: toate coloanele recunoscute
const REVIEW_FIELDS: { key: keyof NewRow; label: string; w: string }[] = [
  { key: 'full_name', label: 'Nume și prenume', w: 'min-w-[190px]' },
  { key: 'email', label: 'Email', w: 'min-w-[200px]' },
  { key: 'cnp', label: 'CNP', w: 'min-w-[140px]' },
  { key: 'birth_date', label: 'Data nașterii', w: 'min-w-[110px]' },
  { key: 'address', label: 'Adresă', w: 'min-w-[200px]' },
  { key: 'city', label: 'Localitate', w: 'min-w-[120px]' },
  { key: 'county', label: 'Județ', w: 'min-w-[110px]' },
]

function AddStudentsModal({ sessionId, token, mode, onClose, onSaved }: {
  sessionId: string; token: string; mode: 'manual' | 'paste'
  onClose: () => void; onSaved: (info?: { reused?: string[]; skipped?: string[] }) => void
}) {
  // 'manual' = formular simplu; 'paste' = lipire tabel; 'review' = verificarea listei importate
  const [step, setStep] = useState<'manual' | 'paste' | 'review'>(mode)
  const [rows, setRows] = useState<NewRow[]>([{ ...BLANK_NEW }])
  const [paste, setPaste] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const set = (i: number, k: keyof NewRow, v: string) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [k]: v } : r))
  const addRow = () => setRows(rs => [...rs, { ...BLANK_NEW }])
  const delRow = (i: number) => setRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : [{ ...BLANK_NEW }])

  // Numele final: din import vine întreg, la adăugarea manuală se compune „NUME PRENUME"
  const nameOf = (r: NewRow) =>
    (r.full_name.trim() || `${r.last_name.trim()} ${r.first_name.trim()}`.trim()).toUpperCase()
  const validRows = rows.filter(r => nameOf(r))

  function doParse() {
    const parsed = parseStudentsText(paste)
    if (!parsed.length) { setNote('Nu am recunoscut niciun cursant în textul lipit.'); return }
    const dataLines = paste.trim().split('\n').filter(l => l.trim()).length
    setRows(parsed.map(p => ({
      ...BLANK_NEW,
      full_name: p.full_name, email: p.email, cnp: p.cnp, birth_date: p.birth_date,
      address: p.address, city: p.city, county: p.county,
    })))
    const faraEmail = parsed.filter(p => !p.email).length
    setNote([
      `Am interpretat ${parsed.length} cursanți`,
      parsed.length < dataLines - 1 ? ` din ${dataLines} linii — verifică dacă lipsește cineva` : '',
      faraEmail ? `. Atenție: ${faraEmail} fără email.` : '. Verifică datele, apoi salvează.',
    ].join(''))
    setStep('review')
  }

  async function save() {
    if (!validRows.length) { setNote('Completează cel puțin numele unui cursant.'); return }
    setSaving(true)
    const payload = validRows.map(r => ({ ...r, full_name: nameOf(r) }))
    const r = await fetch('/api/roster', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, students: payload }),
    })
    const j = await r.json().catch(() => ({}))
    setSaving(false)
    if (!r.ok) { setNote('Salvare eșuată: ' + (j.error || 'eroare')); return }
    onSaved({ reused: j.reused || [], skipped: j.skipped || [] })
  }

  const cell = 'w-full px-2 py-1 rounded border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Adaugă cursanți</h3>
            <p className="text-xs text-gray-400 mt-0.5">Completează manual (unul sau mai mulți) sau lipește un tabel din Excel.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        <div className="px-5 pt-3 flex gap-1 border-b border-gray-100">
          {([['manual', 'Manual'], ['paste', 'Din tabel (copy/paste)']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => { setStep(k); setNote(null); if (k === 'manual') setRows([{ ...BLANK_NEW }]) }}
              className={`px-3 py-2 text-sm font-medium -mb-px border-b-2 ${(step === k || (step === 'review' && k === 'paste')) ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {note && <div className="mx-5 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">{note}</div>}

        <div className="flex-1 overflow-auto p-5">
          {step === 'paste' ? (
            <>
              <p className="text-xs text-gray-500 mb-2">
                Lipește tabelul cu tot cu rândul de titluri (Nume, <b>Email</b>, CNP, Data nașterii, Adresă, Localitate, Sector/Județ…).
                Coloanele sunt recunoscute după denumirea din titlu, în orice ordine.
              </p>
              <textarea value={paste} onChange={e => setPaste(e.target.value)} rows={12}
                placeholder="Lipește aici tabelul copiat din Excel…"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-200" />
              <button onClick={doParse} disabled={!paste.trim()}
                className="mt-2 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#1d4ed8' }}>
                Interpretează tabelul
              </button>
            </>
          ) : (
            (() => {
              const cols = step === 'manual' ? MANUAL_FIELDS : REVIEW_FIELDS
              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                        <th className="px-2 py-2 w-8">#</th>
                        {cols.map(f => <th key={f.key} className={`px-2 py-2 ${f.w}`}>{f.label}</th>)}
                        <th className="px-2 py-2 min-w-[150px]">Obținere / Prelungire</th>
                        <th className="px-2 py-2 w-8"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="px-2 py-1 text-xs text-gray-400">{i + 1}</td>
                          {cols.map(f => (
                            <td key={f.key} className="px-2 py-1">
                              <input value={r[f.key]} onChange={e => set(i, f.key, e.target.value)}
                                type={f.key === 'email' ? 'email' : 'text'}
                                className={`${cell}${f.key === 'email' && !r.email ? ' border-amber-300 bg-amber-50' : ''}`} />
                            </td>
                          ))}
                          <td className="px-2 py-1">
                            <select value={r.obtinere_prelungire} onChange={e => set(i, 'obtinere_prelungire', e.target.value)} className={cell + ' cursor-pointer'}>
                              {LRC_OPTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <button onClick={() => delRow(i)} title="Șterge rândul" className="text-gray-300 hover:text-red-500">×</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <button onClick={addRow} className="mt-3 text-sm text-blue-600 hover:text-blue-800">+ încă un cursant</button>
                </div>
              )
            })()
          )}
        </div>

        <div className="flex items-center justify-between gap-2 px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {validRows.length} cursanți de adăugat
            {validRows.filter(r => !r.email.trim()).length > 0 && step !== 'paste' &&
              <span className="text-amber-600"> · {validRows.filter(r => !r.email.trim()).length} fără email</span>}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Renunță</button>
            <button onClick={save} disabled={saving || step === 'paste'}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
              {saving ? 'Se salvează…' : 'Salvează cursanții'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DocsSection({ sessionId }: { sessionId: string }) {
  const [stamp, setStamp] = useState(false)
  const [signs, setSigns] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function gen(endpoint: string, tip: 'obtinere' | 'prelungire', format: 'docx' | 'pdf', filename: string) {
    const key = `${endpoint}-${tip}-${format}`
    setBusy(key)
    try {
      const res = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, tip, format, stampila: stamp, semnatura: signs }),
      })
      if (!res.ok) throw new Error(await res.text())
      if (format === 'pdf') {
        const html = await res.text()
        const w = window.open('', '_blank')
        if (w) { w.document.write(html); w.document.close(); setTimeout(() => { w.document.title = w.document.querySelector('title')?.textContent || 'Document'; w.print() }, 800) }
      } else {
        const blob = await res.blob()
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
      }
    } catch (e: any) { alert('Eroare la generare: ' + (e.message || e)) }
    setBusy(null)
  }

  const groups: { tip: 'obtinere' | 'prelungire'; label: string }[] = [
    { tip: 'obtinere', label: 'Obținere LRC' },
    { tip: 'prelungire', label: 'Prelungire LRC' },
  ]

  return (
    <div className="mb-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="font-semibold text-sm text-gray-900">Documente (PV / Anexe)</h2>
        <div className="flex gap-1.5">
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium select-none ${stamp ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
            <input type="checkbox" checked={stamp} onChange={e => setStamp(e.target.checked)} className="accent-blue-600" />
            {stamp ? 'CU ștampilă' : 'Fără ștampilă'}
          </label>
          <label className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-xs font-medium select-none ${signs ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-gray-200 bg-gray-50 text-gray-500'}`}>
            <input type="checkbox" checked={signs} onChange={e => setSigns(e.target.checked)} className="accent-blue-600" />
            {signs ? 'CU semnături' : 'Fără semnături'}
          </label>
        </div>
      </div>
      <div className="space-y-3">
        {groups.map(g => (
          <div key={g.tip}>
            <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">{g.label}</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              <DocBtn label="PV DOCX" busy={busy === `/api/generate-pv-radio-${g.tip}-docx`} onClick={() => gen('/api/generate-pv-radio', g.tip, 'docx', `PV ${g.tip} ${sessionId}.docx`)} variant="blue" />
              <DocBtn label="PV PDF" busy={busy === `/api/generate-pv-radio-${g.tip}-pdf`} onClick={() => gen('/api/generate-pv-radio', g.tip, 'pdf', '')} variant="red" />
              <DocBtn label="Anexă DOCX" busy={busy === `/api/generate-anexa-pv-${g.tip}-docx`} onClick={() => gen('/api/generate-anexa-pv', g.tip, 'docx', `Anexa ${g.tip} ${sessionId}.docx`)} variant="blue" />
              <DocBtn label="Anexă PDF" busy={busy === `/api/generate-anexa-pv-${g.tip}-pdf`} onClick={() => gen('/api/generate-anexa-pv', g.tip, 'pdf', '')} variant="red" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DocBtn({ label, onClick, busy, variant }: { label: string; onClick: () => void; busy: boolean; variant: 'blue' | 'red' }) {
  const bg = variant === 'blue' ? '#1d4ed8' : '#dc2626'
  return (
    <button onClick={onClick} disabled={busy}
      className="flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
      style={{ background: bg }}>
      {busy ? '...' : label}
    </button>
  )
}

// Leadurile de pe landing-ul de radio — aceeași listă ca „Toate" din editorul
// landing-ului, fără cele arhivate. Doar pentru citire.
const LEAD_STATUS_STYLE: Record<string, string> = {
  nou: 'bg-blue-50 text-blue-700', contactat: 'bg-amber-50 text-amber-700',
  inscris: 'bg-emerald-50 text-emerald-700', respins: 'bg-gray-100 text-gray-500',
}
const LEAD_STATUSES = ['nou', 'contactat', 'inscris', 'respins', 'arhivat']
const GROUP_LABEL: Record<string, string> = { next: 'Următoarea serie', past: 'Serii trecute', future: 'Serii viitoare' }
type SessionOpt = { id: string; label: string; group: string }

function LeaduriTab({ sessionId, token, variant = 'full', onEnrolled }: {
  sessionId: string; token: string
  variant?: 'full' | 'compact'   // sub lista de cursanți arătăm doar esențialul
  onEnrolled?: () => void
}) {
  const [leads, setLeads] = useState<any[] | null>(null)
  const [sessions, setSessions] = useState<SessionOpt[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const j = await fetch(`/api/roster?session_id=${sessionId}&token=${encodeURIComponent(token)}&action=leads`)
      .then(r => r.json()).catch(() => null)
    setLeads(j?.leads || [])
    setSessions(j?.sessions || [])
  }, [sessionId, token])
  useEffect(() => { load() }, [load])

  async function patchLead(id: string, body: any) {
    setLeads(ls => (ls || []).map(l => l.id === id ? { ...l, ...body } : l))
    await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, lead_id: id, ...body }),
    })
  }
  async function enroll(l: any) {
    if (!confirm(`Îl înscrii pe „${l.name || l.email}" în această serie?`)) return
    setBusy(l.id)
    const r = await fetch('/api/roster', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, enroll_lead_id: l.id }),
    })
    setBusy(null)
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert('Înscriere eșuată: ' + (j.error || 'eroare')); return }
    await load()
    onEnrolled?.()
  }
  async function removeLead(l: any) {
    if (!confirm(`Ștergi definitiv leadul „${l.name || l.email}"?`)) return
    setLeads(ls => (ls || []).filter(x => x.id !== l.id))
    await fetch('/api/roster', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, lead_id: l.id }),
    })
  }

  if (leads === null) return <div className="text-center text-gray-400 py-8">Se încarcă…</div>
  if (!leads.length) return <div className="text-center text-gray-400 py-8">Niciun lead neînscris.</div>
  const full = variant === 'full'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
            <th className="px-3 py-2.5 w-8">#</th>
            <th className="px-3 py-2.5">Data</th>
            <th className="px-3 py-2.5">Nume</th>
            <th className="px-3 py-2.5">Tip</th>
            <th className="px-3 py-2.5">Contact</th>
            {full && <th className="px-3 py-2.5">Mesaj</th>}
            <th className="px-3 py-2.5">Status</th>
            {full && <th className="px-3 py-2.5 min-w-[170px]">Înscris la</th>}
            <th className="px-3 py-2.5"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {leads.map((l, i) => (
            <tr key={l.id} className="hover:bg-gray-50/60 align-middle">
              <td className="px-3 py-2 text-gray-300 text-xs">{i + 1}</td>
              <td className="px-3 py-2 text-gray-400 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('ro-RO')}</td>
              <td className="px-3 py-2 font-medium text-gray-800 whitespace-nowrap">{l.name || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{l.lead_type || '—'}</td>
              <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">
                {l.phone && <div><a href={`tel:${l.phone}`} className="hover:text-blue-600">{l.phone}</a></div>}
                {l.email && <div><a href={`mailto:${l.email}`} className="hover:text-blue-600">{l.email}</a></div>}
              </td>
              {full && <td className="px-3 py-2 text-xs text-gray-500 max-w-[220px]">{l.message || '—'}</td>}
              <td className="px-3 py-2">
                {full ? (
                  <select value={l.status || 'nou'} onChange={e => patchLead(l.id, { status: e.target.value })}
                    className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer capitalize ${LEAD_STATUS_STYLE[l.status] || 'bg-gray-100 text-gray-600'}`}>
                    {LEAD_STATUSES.map(s => <option key={s} value={s} className="bg-white text-gray-800">{s}</option>)}
                  </select>
                ) : (
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${LEAD_STATUS_STYLE[l.status] || 'bg-gray-100 text-gray-600'}`}>{l.status}</span>
                )}
              </td>
              {full && (
                <td className="px-3 py-2">
                  <select value={l.participare_session_id || ''} onChange={e => patchLead(l.id, { participare_session_id: e.target.value || null })}
                    className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white cursor-pointer max-w-[190px]">
                    <option value="">— fără —</option>
                    {['next', 'past', 'future'].map(g => {
                      const opts = sessions.filter(s => s.group === g)
                      if (!opts.length) return null
                      return <optgroup key={g} label={GROUP_LABEL[g]}>{opts.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</optgroup>
                    })}
                  </select>
                </td>
              )}
              <td className="px-3 py-2 text-right whitespace-nowrap">
                <button onClick={() => enroll(l)} disabled={busy === l.id}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-green-300 bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">
                  {busy === l.id ? '…' : 'Înscrie'}
                </button>
                {full && (
                  <button onClick={() => removeLead(l)} title="Șterge leadul"
                    className="ml-1 w-7 h-7 rounded-lg text-red-300 hover:text-red-600 hover:bg-red-50">🗑</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function VerifyTab({ sessionId, token, rows, onRowUpdate }: {
  sessionId: string; token: string; rows: Row[]
  onRowUpdate: (id: string, partial: Partial<Row>) => void
}) {
  const [index, setIndex] = useState(0)
  const [form, setForm] = useState<Record<string, string>>({})
  const [dirty, setDirty] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [ci, setCi] = useState<string | null | undefined>(undefined)
  const [editOpen, setEditOpen] = useState(false)
  const wantId = useRef<string>('')
  const cur = rows[index]

  const fetchCi = useCallback(async (id: string) => {
    setCi(undefined); setZoom(1); wantId.current = id
    const r = await fetch(`/api/roster?session_id=${sessionId}&token=${encodeURIComponent(token)}&student_id=${id}&side=recto`)
    const j = await r.json()
    if (wantId.current === id) setCi(j.image || null)
  }, [sessionId, token])

  // La schimbarea cursantului: reîncarcă formularul + imaginea
  useEffect(() => {
    const c = rows[index]; if (!c) return
    // din FIELDS, ca formularul să nu rămână în urmă când se adaugă o coloană
    setForm(Object.fromEntries(FIELDS.map(f => [f.key, (c[f.key] as string) || ''])))
    setDirty(false); fetchCi(c.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index])

  async function saveCurrent() {
    if (!dirty || !cur) return
    await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, student_id: cur.id, fields: form }),
    })
    onRowUpdate(cur.id, form as Partial<Row>)
    setDirty(false)
  }
  async function goto(i: number) {
    if (i === index || i < 0 || i >= rows.length) return
    await saveCurrent(); setIndex(i)
  }
  async function saveLrc(v: string) {
    if (!cur) return
    await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, student_id: cur.id, field: 'obtinere_prelungire', value: v }),
    })
    onRowUpdate(cur.id, { obtinere_prelungire: v } as Partial<Row>)
  }

  // Navigare cu tastele sus/jos (cu salvare), dacă nu suntem într-un input / modal
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (editOpen) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowDown') { e.preventDefault(); goto(index + 1) }
      if (e.key === 'ArrowUp') { e.preventDefault(); goto(index - 1) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!cur) return null
  const isFirst = index === 0, isLast = index === rows.length - 1

  return (
    <div className="flex flex-col lg:flex-row gap-4">
      {/* Listă nume */}
      <div className="lg:w-56 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="max-h-[80vh] overflow-y-auto py-1">
          {rows.map((r, i) => (
            <button key={r.id} onClick={() => goto(i)}
              className={`w-full text-left px-3 py-2 text-sm truncate border-l-2 ${i === index ? 'bg-blue-50 text-blue-700 font-medium border-blue-500' : 'text-gray-700 hover:bg-gray-50 border-transparent'}`}>
              <span className="text-gray-300 text-xs mr-1.5">{i + 1}</span>{r.full_name}
            </button>
          ))}
        </div>
      </div>

      {/* Date cursant */}
      <div className="md:w-72 shrink-0 bg-white rounded-xl shadow-sm border border-gray-100 p-4 self-start">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-400">{index + 1} / {rows.length}</span>
          {dirty && <span className="text-xs font-medium text-amber-600">● nesalvat</span>}
        </div>
        <div className="space-y-3">
          {FIELDS.map(f => (
            <label key={f.key} className="block">
              <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">{f.label}</span>
              <input value={form[f.key] || ''} onChange={e => { setForm(s => ({ ...s, [f.key]: e.target.value })); setDirty(true) }}
                className="w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </label>
          ))}
          <div className="pt-3 mt-1 border-t border-gray-100">
            <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">Obținere / Prelungire LRC</span>
            <LrcSelect value={cur.obtinere_prelungire || ''} onConfirm={saveLrc} />
          </div>
        </div>
      </div>

      {/* CI mare + zoom */}
      <div className="flex-1 min-w-0 bg-white rounded-xl shadow-sm border border-gray-100 p-3 flex flex-col">
        <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={!ci} title="Zoom -"
              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-lg disabled:opacity-40">−</button>
            <span className="text-xs text-gray-500 w-11 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} disabled={!ci} title="Zoom +"
              className="w-8 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-lg disabled:opacity-40">+</button>
            <button onClick={() => setZoom(1)} disabled={!ci} title="Pe lățime"
              className="px-2.5 h-8 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 text-xs disabled:opacity-40">Lățime</button>
          </div>
          <button onClick={() => setEditOpen(true)}
            className="px-3 h-8 rounded-lg text-xs font-medium border border-blue-200 text-blue-600 hover:bg-blue-50">✂ Editează / Crop CI</button>
        </div>

        <div className="flex-1 overflow-auto bg-gray-50 rounded-lg border border-gray-100 min-h-[320px] flex items-start justify-center">
          {ci === undefined ? (
            <div className="text-gray-400 mt-20">Se încarcă…</div>
          ) : ci === null ? (
            <div className="text-gray-400 mt-20 text-center">
              <p className="mb-3">Fără imagine CI.</p>
              <button onClick={() => setEditOpen(true)} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Adaugă CI</button>
            </div>
          ) : (
            <img src={ci} alt="CI" style={{ width: `${zoom * 100}%` }} className="max-w-none block" />
          )}
        </div>

        {/* Săgeți navigare sub CI */}
        <div className="flex items-center justify-center gap-4 mt-3">
          {!isFirst && (
            <button onClick={() => goto(index - 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">▲ Anterior</button>
          )}
          <span className="text-xs text-gray-400 truncate max-w-[40%]">{cur.full_name}</span>
          {!isLast && (
            <button onClick={() => goto(index + 1)} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">▼ Următor</button>
          )}
        </div>
      </div>

      {editOpen && (
        <CiModal sessionId={sessionId} token={token} row={cur}
          onClose={() => { setEditOpen(false); fetchCi(cur.id) }}
          onRowUpdate={onRowUpdate} />
      )}
    </div>
  )
}

function CiModal({ sessionId, token, row, doc, onClose, onRowUpdate }: {
  sessionId: string; token: string; row: Row
  doc?: DocKey                 // fără doc = actul de identitate, cu taburi față/verso
  onClose: () => void; onRowUpdate: (id: string, partial: Partial<Row>) => void
}) {
  const [side, setSide] = useState<DocKey>(doc || 'recto')
  const isCi = !doc || doc === 'recto'
  const [img, setImg] = useState<string | null | undefined>(undefined) // undefined=loading, null=none
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [cropMode, setCropMode] = useState(false)
  const [sel, setSel] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const drag = useRef<{ x: number; y: number } | null>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  // date cursant
  const [showFields, setShowFields] = useState(false)
  const [form, setForm] = useState<Record<string, string>>({})
  const [savingF, setSavingF] = useState(false)

  const fetchImg = useCallback(async (s: DocKey) => {
    setImg(undefined); setZoom(1); setDirty(false); setCropMode(false); setSel(null)
    const r = await fetch(`/api/roster?session_id=${sessionId}&token=${encodeURIComponent(token)}&student_id=${row.id}&side=${s}`)
    const j = await r.json()
    setImg(j.image || null)
  }, [sessionId, token, row.id])
  useEffect(() => { fetchImg(side) }, [side, fetchImg])
  useEffect(() => {
    setForm({ full_name: row.full_name || '', cnp: row.cnp || '', birth_date: row.birth_date || '', address: row.address || '', city: row.city || '', county: row.county || '' })
  }, [row])

  async function persistImage(dataUrl: string) {
    setBusy(true)
    try {
      const r = await fetch('/api/roster', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, token, student_id: row.id, side, imageData: dataUrl }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'eroare') }
      setImg(dataUrl); setDirty(false); setZoom(1)
      onRowUpdate(row.id, { [DOC_FLAG[side]]: true } as Partial<Row>)
    } catch (e: any) { alert('Salvare imagine eșuată: ' + e.message) }
    setBusy(false)
  }
  async function removeDoc() {
    if (!confirm(`Ștergi documentul „${DOC_LABEL_FULL[side]}" al cursantului ${row.full_name}?`)) return
    setBusy(true)
    const r = await fetch('/api/roster', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, student_id: row.id, doc: side }),
    })
    setBusy(false)
    if (!r.ok) { alert('Ștergere eșuată.'); return }
    setImg(null); setDirty(false)
    onRowUpdate(row.id, { [DOC_FLAG[side]]: false } as Partial<Row>)
  }
  async function onPick(file: File) {
    setBusy(true)
    try { const d = await downscale(file); setImg(d); setDirty(true); setZoom(1); setCropMode(false); setSel(null) }
    catch (e: any) { alert('Eroare imagine: ' + e.message) }
    setBusy(false)
  }
  async function doRotate(deg: number) {
    if (!img) return
    setBusy(true); const d = await rotate(img, deg); setImg(d); setDirty(true); setZoom(1); setBusy(false)
  }
  async function applyCrop() {
    if (!img || !sel || sel.w < 0.02 || sel.h < 0.02) { setCropMode(false); setSel(null); return }
    setBusy(true); const d = await crop(img, sel); setImg(d); setDirty(true); setCropMode(false); setSel(null); setZoom(1); setBusy(false)
  }

  function relFromEvent(e: React.PointerEvent) {
    const el = imgRef.current; if (!el) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  function onDown(e: React.PointerEvent) { if (!cropMode) return; const p = relFromEvent(e); drag.current = p; setSel({ x: p.x, y: p.y, w: 0, h: 0 }) }
  function onMove(e: React.PointerEvent) {
    if (!cropMode || !drag.current) return
    const p = relFromEvent(e), s = drag.current
    setSel({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) })
  }
  function onUp() { drag.current = null }

  async function saveFields() {
    setSavingF(true)
    const r = await fetch('/api/roster', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, student_id: row.id, fields: form }),
    })
    setSavingF(false)
    if (!r.ok) { alert('Salvare date eșuată.'); return }
    onRowUpdate(row.id, form as Partial<Row>)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      {/* Toolbar */}
      <div onClick={e => e.stopPropagation()} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-900 text-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate max-w-[40vw]">{row.full_name}</span>
          {isCi ? (
            <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-1">
              <button onClick={() => setSide('recto')} className={`px-3 py-1 text-xs ${side === 'recto' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Față</button>
              <button onClick={() => setSide('verso')} className={`px-3 py-1 text-xs ${side === 'verso' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Verso</button>
            </div>
          ) : (
            <span className="ml-1 px-2 py-1 rounded-lg bg-gray-800 text-xs text-gray-300">{DOC_LABEL_FULL[side]}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* rotate + crop */}
          <button onClick={() => doRotate(-90)} disabled={!img || cropMode} title="Rotește stânga" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">⟲</button>
          <button onClick={() => doRotate(90)} disabled={!img || cropMode} title="Rotește dreapta" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 disabled:opacity-40">⟳</button>
          {!cropMode ? (
            <button onClick={() => { setCropMode(true); setSel(null); setZoom(1) }} disabled={!img} title="Decupează" className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs disabled:opacity-40">✂ Crop</button>
          ) : (
            <>
              <button onClick={applyCrop} className="px-2.5 h-8 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs">Aplică</button>
              <button onClick={() => { setCropMode(false); setSel(null) }} className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs">Renunță</button>
            </>
          )}
          <span className="w-px h-5 bg-gray-700 mx-0.5" />
          {/* zoom */}
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={!img || cropMode} title="Zoom -" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">−</button>
          <span className="text-xs text-gray-400 w-11 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} disabled={!img || cropMode} title="Zoom +" className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">+</button>
          <button onClick={() => setZoom(1)} disabled={!img || cropMode} title="Mărime naturală" className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs disabled:opacity-40">1:1</button>
          <span className="w-px h-5 bg-gray-700 mx-0.5" />
          {/* replace / save */}
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onPick(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy} className="px-3 h-8 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xs disabled:opacity-50">{img ? 'Înlocuiește' : 'Încarcă'}</button>
          {dirty && <button onClick={() => img && persistImage(img)} disabled={busy} className="px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50">{busy ? 'Se salvează…' : 'Salvează imaginea'}</button>}
          {img && !dirty && <button onClick={removeDoc} disabled={busy} title="Șterge documentul" className="px-3 h-8 rounded-lg bg-red-700 hover:bg-red-600 text-white text-xs disabled:opacity-50">Șterge</button>}
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg ml-1">✕</button>
        </div>
      </div>

      {/* Imagine */}
      <div onClick={e => e.stopPropagation()} className="flex-1 overflow-auto flex items-start justify-center p-4">
        {img === undefined ? (
          <div className="text-gray-400 mt-20">Se încarcă…</div>
        ) : img === null ? (
          <div className="text-gray-400 mt-20 text-center">
            <p className="mb-3">Nu e încărcat: {DOC_LABEL_FULL[side].toLowerCase()}.</p>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Încarcă imagine</button>
          </div>
        ) : cropMode ? (
          <div className="relative inline-block max-w-full select-none touch-none"
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
            <img ref={imgRef} src={img} alt="CI" className="max-w-full max-h-[75vh] object-contain pointer-events-none" draggable={false} />
            {sel && sel.w > 0 && (
              <div className="absolute border-2 border-blue-400 bg-blue-400/20 pointer-events-none"
                style={{ left: `${sel.x * 100}%`, top: `${sel.y * 100}%`, width: `${sel.w * 100}%`, height: `${sel.h * 100}%` }} />
            )}
            <div className="absolute top-2 left-2 text-xs bg-black/60 text-white px-2 py-1 rounded pointer-events-none">Trage pentru a selecta zona, apoi „Aplică"</div>
          </div>
        ) : (
          <img src={img} alt="CI" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }} className="shadow-2xl rounded transition-transform" />
        )}
      </div>

      {/* Date cursant (dropdown) */}
      <div onClick={e => e.stopPropagation()} className="bg-gray-900 text-gray-100 border-t border-gray-800">
        <button onClick={() => setShowFields(s => !s)} className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-800">
          <span className="font-medium">Date cursant</span>
          <span className={`transition-transform ${showFields ? 'rotate-180' : ''}`}>▾</span>
        </button>
        {showFields && (
          <div className="px-4 pb-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {FIELDS.map(f => (
                <label key={f.key} className="block">
                  <span className="block text-[11px] uppercase tracking-wide text-gray-400 mb-1">{f.label}</span>
                  <input value={form[f.key] || ''} onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50" />
                </label>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={saveFields} disabled={savingF} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm disabled:opacity-50">
                {savingF ? 'Se salvează…' : 'Salvează modificări'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
