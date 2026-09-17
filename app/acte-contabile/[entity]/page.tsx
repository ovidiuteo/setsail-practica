'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Loader2, Upload, Trash2, RefreshCw, ShieldAlert, FileText, Download,
  Receipt, Landmark, FileSignature, ScrollText, Files, Search, Eye, X, FileSpreadsheet, CalendarDays,
  ChevronDown, ChevronUp, Wallet, ReceiptText, Check, AlertCircle, FolderArchive, Plus,
  Copy, ExternalLink, Link2,
} from 'lucide-react'

type Doc = {
  id: string
  entity: string
  categorie: string
  nume: string | null
  data_doc: string | null
  luna: string | null
  luna_manuala: boolean
  file_name: string | null
  file_type: string | null
  file_size: number | null
  note: string | null
  created_at: string
  url: string | null
}

type Cheltuiala = {
  id: string
  entity: string
  luna: string
  data: string | null
  descriere: string
  suma: number
  acoperit: boolean
  sursa: 'extras' | 'manual'
  source_doc_id: string | null
  factura_doc_id: string | null
  created_at: string
}

// Lunile calendaristice (RO)
const LUNI = [
  'ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie',
] as const
const LUNA_LABEL = (m: string) => m.charAt(0).toUpperCase() + m.slice(1)
function currentLuna(): string {
  // getMonth: 0=ianuarie … 11=decembrie
  return LUNI[new Date().getMonth()]
}

// Poziții obligatorii lunare (PDF) — afișate în panoul mov de checklist
const SLOTS: { key: string; label: string; icon: any }[] = [
  { key: 'extras_cont',   label: 'Extras de cont',       icon: Wallet },
  { key: 'sumar_facturi', label: 'Sumar lunar facturi',  icon: ReceiptText },
]
const SLOT_KEYS = SLOTS.map(s => s.key)

// Praguri pe lună raportat la data de azi (an curent). past27 → afișat default; past30 → colorat roșu/verde.
function monthDateInfo(m: string): { past27: boolean; past30: boolean } {
  const now = new Date()
  const idx = (LUNI as readonly string[]).indexOf(m)
  if (idx < 0) return { past27: false, past30: false }
  const y = now.getFullYear()
  const daysInMonth = new Date(y, idx + 1, 0).getDate()
  const d27 = new Date(y, idx, Math.min(27, daysInMonth), 0, 0, 0)
  const d30 = new Date(y, idx, Math.min(30, daysInMonth), 0, 0, 0)
  return { past27: now >= d27, past30: now >= d30 }
}

const CATEGORII: { key: string; label: string; icon: any }[] = [
  { key: 'factura',  label: 'Facturi',          icon: FileText },
  { key: 'chitanta', label: 'Chitanțe',         icon: Receipt },
  { key: 'extras',   label: 'Extrase bancare',  icon: Landmark },
  { key: 'contract', label: 'Contracte',        icon: FileSignature },
  { key: 'bon',      label: 'Bonuri fiscale',   icon: ScrollText },
  { key: 'altele',   label: 'Altele',           icon: Files },
]
const CAT_LABEL = (k: string) => CATEGORII.find(c => c.key === k)?.label || k

function fmtSize(n: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

function docKind(d: { file_type: string | null; file_name: string | null }): 'pdf' | 'image' | 'other' {
  const t = (d.file_type || '').toLowerCase()
  const n = (d.file_name || '').toLowerCase()
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if (t.startsWith('image/') || /\.(jpe?g|png|webp|avif|heic|gif)$/.test(n)) return 'image'
  return 'other'
}

export default function ActeContabilePage({ params }: { params: { entity: string } }) {
  const entity = params.entity
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [meta, setMeta] = useState<{ label: string; full: string } | null>(null)
  const [docs, setDocs] = useState<Doc[] | null>(null)
  const [filter, setFilter] = useState<string>('all')
  const [q, setQ] = useState('')
  const [preview, setPreview] = useState<Doc | null>(null)
  const [months, setMonths] = useState<string[]>([currentLuna()])
  const [showAllMonths, setShowAllMonths] = useState(false)
  // „Contracte" = secțiune separată: contractele pentru facturile emise, care nu
  // sunt încă în sistem. Doar la SSY. Păstrată în URL (?view=contracte).
  const [view, setView] = useState<'acte' | 'contracte'>('acte')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('view') === 'contracte') setView('contracte')
  }, [])
  function schimbaView(v: 'acte' | 'contracte') {
    setView(v)
    const u = new URL(window.location.href)
    if (v === 'contracte') u.searchParams.set('view', 'contracte'); else u.searchParams.delete('view')
    window.history.replaceState(null, '', u.toString())
  }

  function toggleMonth(m: string) {
    setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

  // Implicit: luna precedentă, curentă și următoare (+ orice lună deja selectată)
  const ci = new Date().getMonth()
  const nearby = [(ci + 11) % 12, ci, (ci + 1) % 12].map(i => LUNI[i])
  const monthButtons = showAllMonths
    ? [...LUNI]
    : LUNI.filter(m => nearby.includes(m) || months.includes(m))

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    ;(async () => {
      const v = await fetch(`/api/acte-contabile/verify?entity=${entity}&token=${encodeURIComponent(t || '')}`)
        .then(r => r.json()).catch(() => ({ valid: false }))
      if (!v.valid) { setPhase('denied'); return }
      setMeta(v.meta || null)
      setPhase('ready')
    })()
  }, [entity])

  // Titlul tab-ului de browser
  useEffect(() => {
    document.title = `Acte contabile ${(meta?.label || entity || '').toString().toUpperCase()}`
  }, [meta, entity])

  const load = useCallback(async () => {
    const json = await fetch(`/api/acte-contabile/list?entity=${entity}&token=${encodeURIComponent(token || '')}`)
      .then(r => r.json()).catch(() => null)
    setDocs(json?.docs || [])
  }, [entity, token])

  useEffect(() => { if (phase === 'ready') load() }, [phase, load])

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-[#0a1628] mb-2">Acces refuzat</h1>
          <p className="text-slate-500 text-sm">Token invalid sau lipsă. Link-ul corect se găsește în panoul de administrare → <span className="font-medium">Configurare → Acte contabile</span>.</p>
        </div>
      </div>
    )
  }

  const lunaOf = (d: Doc) => d.luna || currentLuna()
  // Pozițiile speciale (Extras de cont / Sumar facturi) trăiesc doar în panoul de checklist
  const slotDocs = (docs || []).filter(d => SLOT_KEYS.includes(d.categorie))
  const normalDocs = (docs || []).filter(d => !SLOT_KEYS.includes(d.categorie))
  const monthCounts = normalDocs.reduce((a, d) => { const m = lunaOf(d); a[m] = (a[m] || 0) + 1; return a }, {} as Record<string, number>)
  // Documentele din lunile selectate (baza pentru numărători categorii + afișare)
  const inMonths = normalDocs.filter(d => months.length === 0 || months.includes(lunaOf(d)))
  const counts = inMonths.reduce((a, d) => { a[d.categorie] = (a[d.categorie] || 0) + 1; return a }, {} as Record<string, number>)
  const ql = q.trim().toLowerCase()
  const shown = inMonths
    .filter(d => filter === 'all' || d.categorie === filter)
    .filter(d => !ql || [d.nume, d.file_name, d.note].some(s => (s || '').toLowerCase().includes(ql)))
  const visibleMonths = LUNI.filter(m => (months.length === 0 || months.includes(m)))

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      {/* top bar */}
      <header className="sticky top-0 z-30 bg-[#0a1628] text-white">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ background: '#f5c842' }}>
              <FileText size={18} style={{ color: '#0a1628' }} />
            </div>
            <div>
              <h1 className="font-bold leading-tight">Acte contabile — {meta?.label || entity.toUpperCase()}</h1>
              <p className="text-xs text-white/50">{meta?.full || ''}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entity === 'ssy' && (
              <button onClick={() => schimbaView(view === 'contracte' ? 'acte' : 'contracte')}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-medium transition ${
                  view === 'contracte' ? 'text-[#0a1628]' : 'bg-white/10 hover:bg-white/20'}`}
                style={view === 'contracte' ? { background: '#f5c842' } : {}}>
                {view === 'contracte' ? <><X size={14} /> Închide contracte</> : <><FileSignature size={14} /> Contracte</>}
              </button>
            )}
            <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition">
              <RefreshCw size={14} /> Reîncarcă
            </button>
          </div>
        </div>
      </header>

      {view === 'contracte' && entity === 'ssy' ? (
        <main className="max-w-5xl mx-auto px-5 py-6">
          <ContractePanel entity={entity} token={token} />
        </main>
      ) : (
      <main className="max-w-5xl mx-auto px-5 py-6">
        <UploadBox entity={entity} token={token} onUploaded={d => setDocs(prev => [d, ...(prev || [])])} />

        {/* filtru luni */}
        <div className="flex items-center gap-2 flex-wrap mt-6 mb-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
            <CalendarDays size={14} /> Luna:
          </span>
          {monthButtons.map(m => {
            const active = months.includes(m)
            return (
              <button key={m} onClick={() => toggleMonth(m)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${active ? 'text-[#0a1628]' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                style={active ? { background: '#f5c842' } : {}}>
                {LUNA_LABEL(m)} ({monthCounts[m] || 0})
              </button>
            )
          })}

          <span className="w-px h-5 bg-slate-200 mx-1" />

          <button onClick={() => setMonths([currentLuna()])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${months.length === 1 && months[0] === currentLuna() ? 'bg-[#0a1628] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            Luna curentă
          </button>
          <button onClick={() => { setMonths([...LUNI]); setShowAllMonths(true) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${months.length === LUNI.length ? 'bg-[#0a1628] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            Toate lunile
          </button>
          <button onClick={() => setShowAllMonths(v => !v)}
            className="px-3 py-1.5 rounded-full text-xs font-medium text-slate-500 border border-slate-200 hover:bg-slate-50 transition">
            {showAllMonths ? 'Vezi mai puține' : 'Vezi toate lunile'}
          </button>
        </div>

        {/* filtre categorie + cautare */}
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === 'all' ? 'bg-[#0a1628] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
              Toate ({docs?.length || 0})
            </button>
            {CATEGORII.map(c => (
              <button key={c.key} onClick={() => setFilter(c.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === c.key ? 'bg-[#0a1628] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>
                {c.label} ({counts[c.key] || 0})
              </button>
            ))}
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Caută…"
              className="pl-8 pr-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#f5c842] bg-white" />
          </div>
        </div>

        {docs === null ? (
          <div className="text-center text-slate-400 py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : (() => {
          // O secțiune pentru fiecare lună selectată (cu panoul de extrase/facturi), chiar dacă nu are documente
          const sectionMonths = visibleMonths.length ? visibleMonths : [currentLuna()]
          if (sectionMonths.length === 0) {
            return (
              <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
                {normalDocs.length === 0 ? 'Niciun document încărcat încă.' : 'Niciun document pentru filtrul curent.'}
              </div>
            )
          }
          return (
            <div className="space-y-7">
              {sectionMonths.map(m => (
                <MonthSection key={m} m={m} entity={entity} token={token}
                  groupDocs={shown.filter(d => lunaOf(d) === m)}
                  monthSlotDocs={slotDocs.filter(d => lunaOf(d) === m)}
                  monthHasFiles={normalDocs.some(d => lunaOf(d) === m) || slotDocs.some(d => lunaOf(d) === m)}
                  setDocs={setDocs} setPreview={setPreview}
                />
              ))}
            </div>
          )
        })()}

        <p className="text-xs text-slate-400 text-center mt-6">
          Documentele sunt confidențiale. Acest link oferă acces complet — nu îl distribui în afara contabilității.
        </p>
      </main>
      )}

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function PreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const kind = docKind(doc)
  const title = doc.nume || doc.file_name || 'document'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-[#0a1628] truncate">{title}</div>
            <div className="text-xs text-slate-400 truncate">
              {CAT_LABEL(doc.categorie)}{doc.file_name ? ` · ${doc.file_name}` : ''}{doc.file_size ? ` · ${fmtSize(doc.file_size)}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" download={doc.file_name || undefined}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#0a1628] transition"
                style={{ background: '#f5c842' }}>
                <Download size={15} /> Descarcă
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 transition" title="Închide">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* body */}
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[50vh]">
          {!doc.url ? (
            <div className="text-slate-400 text-sm p-10">Documentul nu este disponibil.</div>
          ) : kind === 'pdf' ? (
            <iframe src={doc.url} title={title} className="w-full h-[80vh] bg-white" />
          ) : kind === 'image' ? (
            <img src={doc.url} alt={title} className="max-w-full max-h-[80vh] object-contain" />
          ) : (
            <div className="text-center p-10">
              <FileSpreadsheet size={48} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-sm mb-4">Previzualizarea nu este disponibilă pentru acest tip de fișier.</p>
              <a href={doc.url} target="_blank" rel="noreferrer" download={doc.file_name || undefined}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0a1628] transition"
                style={{ background: '#f5c842' }}>
                <Download size={15} /> Descarcă fișierul
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MonthSection({ m, entity, token, groupDocs, monthSlotDocs, monthHasFiles, setDocs, setPreview }: {
  m: string; entity: string; token: string | null
  groupDocs: Doc[]; monthSlotDocs: Doc[]; monthHasFiles: boolean
  setDocs: (u: (prev: Doc[] | null) => Doc[] | null) => void
  setPreview: (d: Doc) => void
}) {
  const [chelt, setChelt] = useState<Cheltuiala[] | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const hasExtras = monthSlotDocs.some(d => d.categorie === 'extras_cont')

  const loadChelt = useCallback(async () => {
    const j = await fetch(`/api/acte-contabile/cheltuieli?entity=${entity}&luna=${m}&token=${encodeURIComponent(token || '')}`)
      .then(r => r.json()).catch(() => null)
    setChelt(j?.items || [])
  }, [entity, m, token])
  useEffect(() => { loadChelt() }, [loadChelt])

  const analyzeExtras = useCallback(async () => {
    setAnalyzing(true)
    try {
      const j = await fetch('/api/acte-contabile/cheltuieli/analiza', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity, token, luna: m }),
      }).then(r => r.json())
      if (j.ok) setChelt(prev => {
        const manual = (prev || []).filter(x => x.sursa === 'manual')
        return [...j.items, ...manual]
      })
      else alert(j.error || 'Analiza extrasului a eșuat.')
    } catch { alert('Conexiune eșuată la analiză.') }
    finally { setAnalyzing(false) }
  }, [entity, token, m])

  return (
    <section>
      <div className="flex items-center justify-between gap-3 mb-2.5">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl font-extrabold tracking-wide text-[#0a1628]">{m.toUpperCase()}</h2>
          <span className="text-xs text-slate-400">{groupDocs.length} document{groupDocs.length === 1 ? '' : 'e'}</span>
        </div>
        <div className="flex items-center gap-2">
          <ContabilLinkButton entity={entity} token={token} month={m} />
          {monthHasFiles && <DownloadMonthButton entity={entity} token={token} month={m} />}
        </div>
      </div>

      <MonthChecklist month={m} entity={entity} token={token} slotDocs={monthSlotDocs}
        onPreview={d => setPreview(d)}
        onAdd={d => setDocs(prev => [d, ...(prev || [])])}
        onRemove={id => setDocs(prev => (prev || []).filter(x => x.id !== id))}
        onExtrasUploaded={analyzeExtras}
      />

      {(hasExtras || (chelt && chelt.length > 0)) && (
        <CheltuieliPanel entity={entity} token={token} month={m} items={chelt} setItems={setChelt}
          analyzing={analyzing} hasExtras={hasExtras} onReanalyze={analyzeExtras}
          docs={groupDocs} onPreview={d => setPreview(d)}
          onDocAdded={d => setDocs(prev => [d, ...(prev || [])])} />
      )}

      <SectionAddDoc entity={entity} token={token} month={m}
        onAdd={d => setDocs(prev => [d, ...(prev || [])])} />

      {groupDocs.length === 0 ? (
        <div className="text-center text-slate-400 py-8 bg-white rounded-xl border border-slate-200 text-sm">
          Niciun document în această lună.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 text-left">
                <th className="px-4 py-3">Document</th>
                <th className="px-4 py-3">Categorie</th>
                <th className="px-4 py-3 whitespace-nowrap">Lună</th>
                <th className="px-4 py-3 whitespace-nowrap">Data act</th>
                <th className="px-4 py-3 whitespace-nowrap">Încărcat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {groupDocs.map(d => (
                <DocRow key={d.id} d={d} entity={entity} token={token}
                  onPreview={() => setPreview(d)}
                  onDeleted={() => setDocs(prev => (prev || []).filter(x => x.id !== d.id))}
                  onMonthChanged={(luna) => setDocs(prev => (prev || []).map(x => x.id === d.id ? { ...x, luna, luna_manuala: true } : x))}
                  onReplaced={(updated) => setDocs(prev => (prev || []).map(x => x.id === d.id ? { ...x, ...updated } : x))}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function CheltuieliPanel({ entity, token, month, items, setItems, analyzing, hasExtras, onReanalyze, docs, onPreview, onDocAdded }: {
  entity: string; token: string | null; month: string
  items: Cheltuiala[] | null; setItems: (u: (prev: Cheltuiala[] | null) => Cheltuiala[] | null) => void
  analyzing: boolean; hasExtras: boolean; onReanalyze: () => void
  docs: Doc[]; onPreview: (d: Doc) => void; onDocAdded: (d: Doc) => void
}) {
  const [doarNeacoperite, setDoarNeacoperite] = useState(true)
  const [adding, setAdding] = useState(false)
  const [facturaPentru, setFacturaPentru] = useState<Cheltuiala | null>(null)

  // Factura încărcată pentru o cheltuială: documentul intră în lună, iar cheltuiala e bifată și legată de el
  async function facturaIncarcata(c: Cheltuiala, d: Doc) {
    onDocAdded(d)
    setItems(prev => (prev || []).map(x => x.id === c.id ? { ...x, acoperit: true, factura_doc_id: d.id } : x))
    setFacturaPentru(null)
    const ok = await patch(c.id, { acoperit: true, factura_doc_id: d.id })
    if (!ok) alert('Factura s-a încărcat, dar cheltuiala nu a putut fi bifată. Bifeaz-o manual.')
  }
  const [nd, setNd] = useState({ data: '', descriere: '', suma: '' })

  const fmtRon = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  async function patch(id: string, body: any) {
    const res = await fetch('/api/acte-contabile/cheltuieli', {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, token, id, ...body }),
    }).then(r => r.json()).catch(() => null)
    return res?.ok
  }

  async function toggle(c: Cheltuiala) {
    setItems(prev => (prev || []).map(x => x.id === c.id ? { ...x, acoperit: !c.acoperit } : x))
    const ok = await patch(c.id, { acoperit: !c.acoperit })
    if (!ok) setItems(prev => (prev || []).map(x => x.id === c.id ? { ...x, acoperit: c.acoperit } : x))
  }

  async function remove(c: Cheltuiala) {
    if (!confirm('Ștergi această cheltuială?')) return
    setItems(prev => (prev || []).filter(x => x.id !== c.id))
    await fetch(`/api/acte-contabile/cheltuieli?entity=${entity}&id=${c.id}&token=${encodeURIComponent(token || '')}`, { method: 'DELETE' }).catch(() => {})
  }

  async function saveField(c: Cheltuiala, field: 'descriere' | 'suma' | 'data', value: string) {
    const val = field === 'suma' ? (Number(value.replace(',', '.')) || 0) : value
    if ((c as any)[field] === val) return
    setItems(prev => (prev || []).map(x => x.id === c.id ? { ...x, [field]: val } : x))
    await patch(c.id, { [field]: val })
  }

  async function addManual() {
    const descriere = nd.descriere.trim()
    if (!descriere) return
    const res = await fetch('/api/acte-contabile/cheltuieli', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, token, luna: month, data: nd.data || null, descriere, suma: Number(nd.suma.replace(',', '.')) || 0 }),
    }).then(r => r.json()).catch(() => null)
    if (res?.ok && res.item) {
      setItems(prev => [...(prev || []), res.item])
      setNd({ data: '', descriere: '', suma: '' })
      setAdding(false)
    } else alert(res?.error || 'Adăugarea a eșuat.')
  }

  const all = items || []
  const neacoperite = all.filter(c => !c.acoperit)
  const totalSuma = all.reduce((s, c) => s + Number(c.suma), 0)
  const neacoperitaSuma = neacoperite.reduce((s, c) => s + Number(c.suma), 0)
  const shown = doarNeacoperite ? neacoperite : all

  return (
    <div className="mb-3 rounded-xl border border-sky-200 bg-sky-50/60 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-sky-100 flex-wrap">
        <div className="flex items-center gap-2 font-semibold text-sky-900">
          <Wallet size={16} /> Cheltuieli din extras
          {analyzing && <span className="flex items-center gap-1 text-xs font-normal text-sky-600"><Loader2 size={12} className="animate-spin" /> se analizează…</span>}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-500">
            {all.length} chelt. · neacoperite <b className="text-red-600">{neacoperite.length}</b> ({fmtRon(neacoperitaSuma)} lei) · total {fmtRon(totalSuma)} lei
          </span>
          {hasExtras && (
            <button onClick={onReanalyze} disabled={analyzing}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-sky-200 text-sky-700 bg-white hover:bg-sky-50 disabled:opacity-60">
              {analyzing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Re-analizează
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 cursor-pointer">
          <input type="checkbox" checked={doarNeacoperite} onChange={e => setDoarNeacoperite(e.target.checked)} />
          Doar neacoperite
        </label>
        <button onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 bg-white hover:bg-slate-50">
          {adding ? <X size={13} /> : <Plus size={13} />} {adding ? 'Renunță' : 'Adaugă cheltuială'}
        </button>
      </div>

      {adding && (
        <div className="px-4 pb-3 flex items-end gap-2 flex-wrap">
          <input type="date" value={nd.data} onChange={e => setNd(s => ({ ...s, data: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white" />
          <input placeholder="Descriere" value={nd.descriere} onChange={e => setNd(s => ({ ...s, descriere: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white flex-1 min-w-40" />
          <input placeholder="Sumă" value={nd.suma} onChange={e => setNd(s => ({ ...s, suma: e.target.value }))}
            className="border border-slate-200 rounded-lg px-2 py-1.5 text-sm bg-white w-24" />
          <button onClick={addManual} className="px-3 py-1.5 rounded-lg text-sm font-medium text-[#0a1628]" style={{ background: '#f5c842' }}>Adaugă</button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm text-slate-400">
          {all.length === 0
            ? (hasExtras ? (analyzing ? 'Se extrag cheltuielile…' : 'Nicio cheltuială extrasă. Apasă „Re-analizează”.') : 'Încarcă extrasul de cont pentru a extrage cheltuielile.')
            : 'Toate cheltuielile sunt acoperite. 🎉'}
        </div>
      ) : (
        <div className="bg-white border-t border-sky-100">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 text-left">
                <th className="px-3 py-2 w-10 text-center">Bon/<br />factură</th>
                <th className="px-3 py-2">Operațiune</th>
                <th className="px-3 py-2 whitespace-nowrap">Data</th>
                <th className="px-3 py-2 text-right whitespace-nowrap">Sumă (lei)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shown.map(c => (
                <tr key={c.id} className={c.acoperit ? 'bg-green-50/50' : ''}>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={c.acoperit} onChange={() => toggle(c)}
                      className="w-4 h-4 cursor-pointer accent-green-600" title="Bifează dacă există bon/factură" />
                  </td>
                  <td className="px-3 py-2">
                    <input defaultValue={c.descriere} onBlur={e => saveField(c, 'descriere', e.target.value)}
                      className={`w-full bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-300 rounded px-1.5 py-1 text-sm focus:outline-none ${c.acoperit ? 'line-through text-slate-400' : 'text-[#0a1628]'}`} />
                    {c.sursa === 'manual' && <span className="text-[10px] text-slate-400 ml-1">(manual)</span>}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input type="date" defaultValue={c.data || ''} onBlur={e => saveField(c, 'data', e.target.value)}
                      className="bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-300 rounded px-1 py-1 text-xs text-slate-500 focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <input defaultValue={fmtRon(Number(c.suma))} onBlur={e => saveField(c, 'suma', e.target.value)}
                      className="w-24 text-right bg-transparent border border-transparent hover:border-slate-200 focus:border-sky-300 rounded px-1 py-1 text-sm font-medium text-[#0a1628] focus:outline-none" />
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    {(() => {
                      const factura = c.factura_doc_id ? docs.find(d => d.id === c.factura_doc_id) : undefined
                      if (factura) return (
                        <button onClick={() => onPreview(factura)} title={factura.file_name || 'Factura'}
                          className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded-lg text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100">
                          <FileText size={12} /> Factura
                        </button>
                      )
                      if (!c.acoperit) return (
                        <button onClick={() => setFacturaPentru(c)}
                          className="inline-flex items-center gap-1 px-2 py-1 mr-1 rounded-lg text-xs font-medium text-[#0a1628] hover:brightness-95"
                          style={{ background: '#f5c842' }}>
                          <Upload size={12} /> Adaugă factură
                        </button>
                      )
                      return null
                    })()}
                    <button onClick={() => remove(c)} className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 align-middle" title="Șterge">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {facturaPentru && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto"
          onClick={e => { if (e.target === e.currentTarget) setFacturaPentru(null) }}>
          <div className="w-full max-w-3xl my-10">
            <div className="bg-[#0a1628] text-white rounded-t-2xl px-5 py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs text-white/60">Factură / bon pentru cheltuiala</div>
                <div className="font-semibold truncate">{facturaPentru.descriere}</div>
                <div className="text-xs text-white/70">
                  {facturaPentru.data ? new Date(facturaPentru.data).toLocaleDateString('ro-RO') + ' · ' : ''}{fmtRon(Number(facturaPentru.suma))} lei · {LUNA_LABEL(month)}
                </div>
              </div>
              <button onClick={() => setFacturaPentru(null)} className="text-white/60 hover:text-white"><X size={18} /></button>
            </div>
            <UploadBox entity={entity} token={token} fixedLuna={month} compact
              initial={{
                categorie: 'factura',
                nume: facturaPentru.descriere,
                dataDoc: facturaPentru.data || '',
                note: `Cheltuială din extras: ${facturaPentru.descriere} — ${fmtRon(Number(facturaPentru.suma))} lei`,
              }}
              onUploaded={d => facturaIncarcata(facturaPentru, d)} />
          </div>
        </div>
      )}
    </div>
  )
}

function ContabilLinkButton({ entity, token, month }: { entity: string; token: string | null; month: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [url, setUrl] = useState('')
  const [copied, setCopied] = useState(false)

  async function fetchToken(regenerate: boolean): Promise<string | null> {
    const j = await fetch('/api/acte-contabile/contabil-token', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, token, luna: month, regenerate }),
    }).then(r => r.json()).catch(() => null)
    if (j?.ok && j.token) {
      const origin = typeof window !== 'undefined' ? window.location.origin : ''
      return `${origin}/acte-contabile/contabil/${j.token}`
    }
    alert(j?.error || 'Nu am putut genera link-ul.')
    return null
  }

  async function ensureLink() {
    if (url) { setOpen(o => !o); return }
    setBusy(true)
    const u = await fetchToken(false)
    if (u) { setUrl(u); setOpen(true) }
    setBusy(false)
  }

  async function regenerate() {
    if (!confirm('Regenerezi link-ul? Link-ul vechi trimis contabilului nu va mai funcționa.')) return
    setRegenerating(true)
    const u = await fetchToken(true)
    if (u) { setUrl(u); setCopied(false) }
    setRegenerating(false)
  }

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="relative">
      <button onClick={ensureLink} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-violet-200 text-violet-700 bg-white hover:bg-violet-50 transition disabled:opacity-60"
        title="Link read-only pentru contabil (doar această lună)">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />} Link pt contabil
      </button>
      {open && url && (
        <div className="absolute left-0 top-full mt-2 z-40 w-[min(92vw,420px)] bg-white border border-slate-200 rounded-xl shadow-lg p-3">
          <div className="text-xs font-medium text-slate-500 mb-1.5">Link read-only — {LUNA_LABEL(month)} (doar vizualizare + descărcare)</div>
          <input readOnly value={url} onFocus={e => e.currentTarget.select()}
            className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-xs text-slate-600 bg-slate-50 mb-2" />
          <div className="flex items-center gap-2">
            <button onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50">
              {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />} {copied ? 'Copiat' : 'Copiază'}
            </button>
            <a href={url} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-[#0a1628]" style={{ background: '#f5c842' }}>
              <ExternalLink size={14} /> Deschide
            </a>
            <button onClick={regenerate} disabled={regenerating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 disabled:opacity-60"
              title="Generează un link nou și invalidează-l pe cel vechi">
              {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerează
            </button>
            <button onClick={() => setOpen(false)} className="ml-auto p-1.5 rounded-lg text-slate-400 hover:bg-slate-50"><X size={14} /></button>
          </div>
        </div>
      )}
    </div>
  )
}

function DownloadMonthButton({ entity, token, month }: { entity: string; token: string | null; month: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function download() {
    setBusy(true); setErr('')
    try {
      const res = await fetch(`/api/acte-contabile/zip?entity=${entity}&luna=${month}&token=${encodeURIComponent(token || '')}`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        setErr(j?.error || 'Descărcare eșuată.')
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `acte-${entity}-${month}.zip`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch { setErr('Conexiune eșuată.') }
    finally { setBusy(false) }
  }

  return (
    <div className="flex flex-col items-end">
      <button onClick={download} disabled={busy}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-[#0a1628] hover:opacity-90 transition disabled:opacity-60"
        style={{ background: '#f5c842' }} title="Descarcă toate fișierele lunii ca ZIP">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <FolderArchive size={14} />}
        {busy ? 'Se arhivează…' : 'Descarcă toată luna'}
      </button>
      {err && <span className="text-[11px] text-red-600 mt-1">{err}</span>}
    </div>
  )
}

function MonthChecklist({ month, entity, token, slotDocs, onPreview, onAdd, onRemove, onExtrasUploaded }: {
  month: string; entity: string; token: string | null; slotDocs: Doc[]
  onPreview: (d: Doc) => void; onAdd: (d: Doc) => void; onRemove: (id: string) => void
  onExtrasUploaded?: () => void
}) {
  const { past27, past30 } = monthDateInfo(month)
  const [open, setOpen] = useState(past27)

  return (
    <div className="mb-3 rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-purple-100/60 transition">
        <span className="flex items-center gap-2 font-semibold text-purple-900">
          <FileText size={16} /> Extrase cont și facturi
          {!past27 && <span className="text-[11px] font-normal text-purple-400">(se activează pe 27)</span>}
        </span>
        <span className="text-purple-500">{open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 grid sm:grid-cols-2 gap-3">
          {SLOTS.map(slot => (
            <SlotCard key={slot.key} slot={slot} month={month} entity={entity} token={token}
              doc={slotDocs.find(d => d.categorie === slot.key) || null}
              past30={past30}
              onPreview={onPreview} onAdd={onAdd} onRemove={onRemove}
              onAfterUpload={slot.key === 'extras_cont' ? onExtrasUploaded : undefined} />
          ))}
        </div>
      )}
    </div>
  )
}

function SlotCard({ slot, month, entity, token, doc, past30, onPreview, onAdd, onRemove, onAfterUpload }: {
  slot: { key: string; label: string; icon: any }; month: string; entity: string; token: string | null
  doc: Doc | null; past30: boolean
  onPreview: (d: Doc) => void; onAdd: (d: Doc) => void; onRemove: (id: string) => void
  onAfterUpload?: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)
  const Icon = slot.icon
  const uploaded = !!doc

  // Culoare: după 30 → roșu (lipsă) / verde (încărcat); altfel neutru
  const tone = past30
    ? (uploaded ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300')
    : 'bg-white border-purple-100'

  async function upload(file: File) {
    setBusy(true); setErr('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('entity', entity)
    fd.append('token', token || '')
    fd.append('categorie', slot.key)
    fd.append('luna', month)
    fd.append('nume', slot.label)
    try {
      const res = await fetch('/api/acte-contabile/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'Upload eșuat.'); return }
      // înlocuiește fișierul anterior (o singură poziție/lună)
      if (doc) {
        await fetch(`/api/acte-contabile/delete?entity=${entity}&id=${doc.id}&token=${encodeURIComponent(token || '')}`, { method: 'DELETE' }).catch(() => {})
        onRemove(doc.id)
      }
      onAdd(json.doc)
      onAfterUpload?.()
    } catch { setErr('Conexiune eșuată.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  async function remove() {
    if (!doc) return
    if (!confirm(`Ștergi „${slot.label}” pentru ${LUNA_LABEL(month)}?`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/acte-contabile/delete?entity=${entity}&id=${doc.id}&token=${encodeURIComponent(token || '')}`, { method: 'DELETE' }).then(r => r.json())
      if (res.ok) onRemove(doc.id)
    } finally { setBusy(false) }
  }

  return (
    <div className={`rounded-lg border p-3 ${tone}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-[#0a1628]">
          <Icon size={15} className="text-purple-500" /> {slot.label}
        </span>
        {past30 && (
          uploaded
            ? <span className="flex items-center gap-1 text-[11px] font-medium text-green-700"><Check size={12} /> Încărcat</span>
            : <span className="flex items-center gap-1 text-[11px] font-medium text-red-600"><AlertCircle size={12} /> Lipsă</span>
        )}
      </div>

      {doc ? (
        <div className="text-xs text-slate-500 mb-2 truncate">{doc.file_name || 'document.pdf'}</div>
      ) : (
        <div className="text-xs text-slate-400 mb-2 italic">Neîncărcat</div>
      )}

      <input ref={fileRef} type="file" accept=".pdf,application/pdf" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />

      <div className="flex items-center gap-1.5 flex-wrap">
        {doc?.url && (
          <button onClick={() => onPreview(doc)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-[#0a1628]" style={{ background: '#f5c842' }} title="Previzualizează">
            <Eye size={13} /> Vezi
          </button>
        )}
        {doc?.url && (
          <a href={doc.url} target="_blank" rel="noreferrer" download={doc.file_name || undefined}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" title="Descarcă">
            <Download size={13} /> Descarcă
          </a>
        )}
        <button onClick={() => fileRef.current?.click()} disabled={busy}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-60">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} {uploaded ? 'Înlocuiește' : 'Încarcă PDF'}
        </button>
        {doc && (
          <button onClick={remove} disabled={busy}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border border-slate-100 text-red-400 hover:text-red-600 hover:bg-red-50" title="Șterge">
            <Trash2 size={13} />
          </button>
        )}
      </div>
      {err && <p className="text-[11px] text-red-600 mt-1.5">{err}</p>}
    </div>
  )
}

function DocRow({ d, entity, token, onPreview, onDeleted, onMonthChanged, onReplaced }: {
  d: Doc; entity: string; token: string | null
  onPreview: () => void; onDeleted: () => void; onMonthChanged: (luna: string) => void
  onReplaced: (doc: Doc) => void
}) {
  const [saving, setSaving] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const luna = d.luna || currentLuna()

  async function changeMonth(next: string) {
    if (next === luna && d.luna) return
    setSaving(true)
    try {
      const res = await fetch('/api/acte-contabile/update-luna', {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity, token, id: d.id, luna: next }),
      })
      const json = await res.json()
      if (json.ok) onMonthChanged(next)
      else alert(json.error || 'Schimbarea lunii a eșuat.')
    } finally { setSaving(false) }
  }

  async function replaceFile(file: File) {
    setReplacing(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('entity', entity)
    fd.append('token', token || '')
    fd.append('id', d.id)
    try {
      const res = await fetch('/api/acte-contabile/replace', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.ok) onReplaced(json.doc)
      else alert(json.error || 'Înlocuirea fișierului a eșuat.')
    } catch { alert('Conexiune eșuată.') }
    finally { setReplacing(false); if (fileRef.current) fileRef.current.value = '' }
  }

  return (
    <tr className={`align-top transition-colors ${d.luna_manuala ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-slate-50'}`}>
      <td className="px-4 py-3">
        <div className="font-medium text-[#0a1628]">{d.nume || d.file_name || 'document'}</div>
        {d.nume && d.file_name && <div className="text-xs text-slate-400">{d.file_name}</div>}
        {d.note && <div className="text-xs text-slate-400 mt-0.5 italic">{d.note}</div>}
        {d.file_size ? <div className="text-[11px] text-slate-300 mt-0.5">{fmtSize(d.file_size)}</div> : null}
        {/* Acțiuni — sub denumire, ușor accesibile */}
        <div className="flex items-center gap-2 mt-2">
          {d.url && (
            <button onClick={onPreview}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0a1628] hover:opacity-90 transition"
              style={{ background: '#f5c842' }} title="Previzualizează">
              <Eye size={14} /> Vezi
            </button>
          )}
          {d.url && (
            <a href={d.url} target="_blank" rel="noreferrer" download={d.file_name || undefined}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition" title="Descarcă / deschide">
              <Download size={14} /> Descarcă
            </a>
          )}
          <input ref={fileRef} type="file" className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,.webp,.avif,.heic,.xls,.xlsx,.csv,application/pdf,image/*"
            onChange={e => { const f = e.target.files?.[0]; if (f) replaceFile(f) }} />
          <button onClick={() => fileRef.current?.click()} disabled={replacing}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition disabled:opacity-60" title="Înlocuiește fișierul (păstrează denumirea și luna)">
            {replacing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Înlocuiește
          </button>
          <DeleteButton entity={entity} token={token} id={d.id} onDeleted={onDeleted} />
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">{CAT_LABEL(d.categorie)}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <select value={luna} disabled={saving} onChange={e => changeMonth(e.target.value)}
            className={`text-xs font-medium rounded-lg px-2 py-1 border cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#f5c842] ${d.luna_manuala ? 'bg-yellow-100 border-yellow-200 text-yellow-800' : 'bg-white border-slate-200 text-slate-600'}`}>
            {LUNI.map(m => <option key={m} value={m}>{LUNA_LABEL(m)}</option>)}
          </select>
          {saving && <Loader2 size={12} className="animate-spin text-slate-400" />}
        </div>
        {d.luna_manuala && <div className="text-[10px] text-yellow-600 mt-1">mutat manual</div>}
      </td>
      <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
        {d.data_doc ? new Date(d.data_doc).toLocaleDateString('ro-RO') : '—'}
      </td>
      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
        {new Date(d.created_at).toLocaleDateString('ro-RO')}
      </td>
    </tr>
  )
}

// ── Contracte SSY ───────────────────────────────────────────────────────────
// Pentru facturi emise de SSY care nu sunt în sistem: factura încărcată sau
// textul lipit e interpretat cu AI, datele sunt editabile, apoi DOCX.
type ContractSsy = {
  nr: string; data: string; beneficiar_tip: 'pf' | 'pj'
  beneficiar_nume: string; beneficiar_adresa: string; beneficiar_cnp: string
  beneficiar_cui: string; beneficiar_reg_com: string; beneficiar_reprezentant: string
  eveniment: string; perioada_start: string; perioada_end: string
  suma: number; moneda: 'RON' | 'EUR'; plata: string
}
type FacturaCitita = { emisa_de_ssy: boolean; furnizor: string; serie: string; numar: string; data: string; descriere: string }

// Etichetă + câmp. Definit în afara panoului: o componentă declarată în
// interiorul altei componente se re-creează la fiecare tastă și câmpul pierde focusul.
function Camp({ label, children, lat }: { label: string; children: React.ReactNode; lat?: boolean }) {
  return (
    <label className={`block ${lat ? 'sm:col-span-2' : ''}`}>
      <span className="block text-[11px] text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  )
}

type ContractSalvat = ContractSsy & {
  id: string; factura: FacturaCitita | null; sursa: string; created_at: string; updated_at: string
}

const API_CONTRACT = '/api/acte-contabile/contract'
const ziRo = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '—'
}
const sumaRo = (n: number) => n.toLocaleString('ro-RO', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })

async function descarcaContract(entity: string, token: string | null, data: ContractSsy) {
  const res = await fetch(API_CONTRACT, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity, token, action: 'generate', data }),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); throw new Error(j.error || 'Generarea a eșuat.') }
  const blob = await res.blob()
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `Contract ${data.nr || 'SSY'} - ${data.beneficiar_nume}.docx`.replace(/[\\/:*?"<>|]+/g, ' ')
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 30000)
}

// Deschide contractul ca pagină de tipărit. Fereastra se deschide imediat, la click
// (altfel browserul o blochează după așteptarea salvării), apoi primește conținutul.
async function tiparesteContract(entity: string, token: string | null, data: ContractSsy, cuStampila: boolean, w: Window | null) {
  if (!w) throw new Error('Browserul a blocat fereastra nouă. Permite pop-up-urile pentru acest site.')
  const res = await fetch(API_CONTRACT, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ entity, token, action: 'pdf', data, cu_stampila: cuStampila }),
  })
  if (!res.ok) { const j = await res.json().catch(() => ({})); w.close(); throw new Error(j.error || 'Generarea PDF a eșuat.') }
  const html = await res.text()
  w.document.open(); w.document.write(html); w.document.close()
  setTimeout(() => { try { w.focus(); w.print() } catch { /* fereastra închisă */ } }, 700)
}

function fereastraPdf(): Window | null {
  const w = window.open('', '_blank')
  if (w) w.document.write('<p style="font-family:Arial,sans-serif;color:#64748b;padding:24px">Se generează contractul…</p>')
  return w
}

function ContractePanel({ entity, token }: { entity: string; token: string | null }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [citind, setCitind] = useState<null | 'fisier' | 'text'>(null)
  const [f, setF] = useState<ContractSsy | null>(null)
  const [factura, setFactura] = useState<FacturaCitita | null>(null)
  const [sursa, setSursa] = useState<string>('')
  const [perioadaImplicita, setPerioadaImplicita] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState<null | 'salvez' | 'docx' | 'pdf' | 'pdf-gol'>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  // Contractul deschis din listă / deja salvat (null = încă nesalvat)
  const [id, setId] = useState<string | null>(null)
  const [modificat, setModificat] = useState(false)
  const [salvatLa, setSalvatLa] = useState<string | null>(null)
  // Lista contractelor salvate (se deschide din titlu)
  const [lista, setLista] = useState(false)
  const [contracte, setContracte] = useState<ContractSalvat[] | null>(null)
  const [cauta, setCauta] = useState('')
  const [randBusy, setRandBusy] = useState<string | null>(null)

  const incarcaLista = useCallback(async () => {
    try {
      const res = await fetch(API_CONTRACT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity, token, action: 'list' }),
      })
      const j = await res.json().catch(() => ({}))
      if (res.ok && j.ok) setContracte(j.contracte)
    } catch { /* lista rămâne cum era */ }
  }, [entity, token])
  useEffect(() => { incarcaLista() }, [incarcaLista])

  // Fișierul pleacă spre API ca base64 în JSON. Pozele se micșorează în browser
  // (o poză de telefon ar trece de limita de 4,5 MB a cererii pe Vercel).
  async function pregatesteFisier(fl: File): Promise<{ base64: string; mime: string }> {
    const esteImg = fl.type.startsWith('image/')
    if (esteImg) {
      const url = URL.createObjectURL(fl)
      try {
        const img = await new Promise<HTMLImageElement>((ok, fail) => {
          const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = url
        })
        const max = 2000
        const k = Math.min(1, max / Math.max(img.width, img.height))
        const c = document.createElement('canvas')
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
        const durl = c.toDataURL('image/jpeg', 0.88)
        return { base64: durl.split(',')[1], mime: 'image/jpeg' }
      } finally { URL.revokeObjectURL(url) }
    }
    if (fl.size > 3 * 1024 * 1024) throw new Error('PDF-ul are peste 3 MB. Folosește un PDF mai mic sau lipește textul facturii.')
    const buf = new Uint8Array(await fl.arrayBuffer())
    let bin = ''
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + 0x8000)))
    return { base64: btoa(bin), mime: 'application/pdf' }
  }

  async function interpreteaza(mod: 'fisier' | 'text') {
    setErr(null); setCitind(mod)
    try {
      const payload: any = { entity, token, action: 'extract' }
      let s = ''
      if (mod === 'fisier') {
        if (!file) { setErr('Alege factura.'); return }
        payload.file = await pregatesteFisier(file)
        s = `factura „${file.name}"`
      } else {
        if (!text.trim()) { setErr('Lipește textul facturii sau datele contractului.'); return }
        payload.text = text
        s = 'textul importat'
      }
      const res = await fetch(API_CONTRACT, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { setErr(j.error || (res.status === 413 ? 'Fișierul e prea mare.' : 'Nu am putut interpreta datele.')); return }
      setF(j.propunere); setFactura(j.factura); setPerioadaImplicita(!!j.perioada_implicita)
      setSursa(s); setId(null); setModificat(true); setSalvatLa(null)
    } catch (e: any) {
      setErr(e?.message || 'Conexiune eșuată.')
    } finally { setCitind(null) }
  }

  // Formular gol, fără factură: data de azi și perioada implicită
  function manual() {
    const azi = new Date()
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const start = new Date(azi.getFullYear(), azi.getMonth(), azi.getDate() + 7)
    let end = new Date(start.getFullYear(), 9, 30)
    if (start > end) end = new Date(start.getFullYear() + 1, 9, 30)
    setF({
      nr: '', data: iso(azi), beneficiar_tip: 'pf', beneficiar_nume: '', beneficiar_adresa: '',
      beneficiar_cnp: '', beneficiar_cui: '', beneficiar_reg_com: '', beneficiar_reprezentant: '',
      eveniment: 'Eveniment nautic', perioada_start: iso(start), perioada_end: iso(end),
      suma: 0, moneda: 'RON', plata: 'Plata se va efectua pe baza facturii fiscale emise de SC Set Sail Yachting SRL.',
    })
    setFactura(null); setSursa('completare manuală'); setPerioadaImplicita(true); setErr(null)
    setId(null); setModificat(true); setSalvatLa(null)
  }

  function poatePleca() {
    return !f || !modificat || confirm('Contractul are modificări nesalvate. Renunți la ele?')
  }

  function contractNou() {
    if (!poatePleca()) return
    setF(null); setFactura(null); setText(''); setFile(null); setSursa(''); setErr(null)
    setId(null); setModificat(false); setSalvatLa(null); setLista(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  function deschide(c: ContractSalvat) {
    if (!poatePleca()) return
    const { id: cid, factura: fc, sursa: sc, created_at: _c, updated_at, ...date } = c
    setF(date); setFactura(fc); setSursa(sc || 'contract salvat'); setPerioadaImplicita(false)
    setId(cid); setModificat(false); setSalvatLa(updated_at); setErr(null); setLista(false)
  }

  const set = <K extends keyof ContractSsy>(k: K, v: ContractSsy[K]) => {
    setF(x => x ? { ...x, [k]: v } : x); setModificat(true)
  }

  async function salveaza(): Promise<boolean> {
    if (!f) return false
    if (!f.beneficiar_nume.trim()) { alert('Completează beneficiarul.'); return false }
    const res = await fetch(API_CONTRACT, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entity, token, action: 'save', id, data: f, ...(id ? {} : { factura, sursa }) }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || !j.ok) { alert(j.error || 'Salvarea a eșuat.'); return false }
    const c: ContractSalvat = j.contract
    setId(c.id); setModificat(false); setSalvatLa(c.updated_at)
    setContracte(xs => xs ? [c, ...xs.filter(x => x.id !== c.id)] : [c])
    return true
  }

  async function butonSalveaza() {
    setBusy('salvez')
    try { await salveaza() } catch { alert('Conexiune eșuată.') } finally { setBusy(null) }
  }

  // Generarea salvează întâi contractul, ca documentul emis să fie mereu în listă
  async function genereaza() {
    if (!f) return
    setBusy('docx')
    try {
      if ((modificat || !id) && !(await salveaza())) return
      await descarcaContract(entity, token, f)
    } catch (e: any) { alert(e?.message || 'Conexiune eșuată.') }
    finally { setBusy(null) }
  }

  async function genereazaPdf(cuStampila: boolean) {
    if (!f) return
    if (!f.beneficiar_nume.trim()) { alert('Completează beneficiarul.'); return }
    const w = fereastraPdf()
    setBusy(cuStampila ? 'pdf' : 'pdf-gol')
    try {
      if ((modificat || !id) && !(await salveaza())) { w?.close(); return }
      await tiparesteContract(entity, token, f, cuStampila, w)
    } catch (e: any) { w?.close(); alert(e?.message || 'Conexiune eșuată.') }
    finally { setBusy(null) }
  }

  async function docxDinLista(c: ContractSalvat) {
    setRandBusy(c.id)
    try { await descarcaContract(entity, token, c) } catch (e: any) { alert(e?.message || 'Conexiune eșuată.') }
    finally { setRandBusy(null) }
  }

  async function sterge(c: ContractSalvat) {
    if (!confirm(`Ștergi contractul ${c.nr || 'fără număr'} — ${c.beneficiar_nume}?`)) return
    setRandBusy(c.id)
    try {
      const res = await fetch(API_CONTRACT, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entity, token, action: 'delete', id: c.id }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) { alert(j.error || 'Ștergerea a eșuat.'); return }
      setContracte(xs => (xs || []).filter(x => x.id !== c.id))
      if (id === c.id) { setId(null); setModificat(true); setSalvatLa(null) }
    } catch { alert('Conexiune eșuată.') }
    finally { setRandBusy(null) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]'
  const q = cauta.trim().toLowerCase()
  const vizibile = (contracte || []).filter(c => !q
    || [c.nr, c.beneficiar_nume, c.beneficiar_cui, c.beneficiar_cnp, c.eveniment].some(v => (v || '').toLowerCase().includes(q)))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <button onClick={() => { if (lista) setLista(false); else { setLista(true); incarcaLista() } }}
            title={lista ? 'Înapoi la contract' : 'Lista contractelor salvate'}
            className="group text-lg font-bold text-[#0a1628] flex items-center gap-2 hover:text-[#1a3a6b]">
            <FileSignature size={18} /> Contracte SSY
            {contracte && (
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 group-hover:bg-[#f5c842] group-hover:text-[#0a1628]">
                {contracte.length}
              </span>
            )}
            {lista ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
          </button>
          <p className="text-sm text-slate-500 mt-0.5">
            {lista
              ? 'Contractele salvate. Click pe un contract ca să-l deschizi și să-l modifici.'
              : 'Contract de prestări servicii pentru facturile emise de Set Sail Yachting. Încarcă factura sau lipește textul ei — datele se completează singure și le poți corecta.'}
          </p>
        </div>
        {lista && (
          <button onClick={contractNou}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-[#0a1628]"
            style={{ background: '#f5c842' }}>
            <Plus size={14} /> Contract nou
          </button>
        )}
      </div>

      {lista && (
        <div className="bg-white rounded-xl border border-slate-200">
          <div className="p-3 border-b border-slate-100">
            <div className="relative max-w-sm">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={cauta} onChange={e => setCauta(e.target.value)} placeholder="Caută după număr, beneficiar, CUI…"
                className={`${inp} pl-8`} />
            </div>
          </div>
          {contracte === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Se încarcă…
            </div>
          ) : vizibile.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              {contracte.length ? 'Niciun contract nu corespunde căutării.' : 'Niciun contract salvat încă.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-slate-400 border-b border-slate-100">
                    <th className="px-3 py-2 font-medium">Nr.</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Beneficiar</th>
                    <th className="px-3 py-2 font-medium">Perioada</th>
                    <th className="px-3 py-2 font-medium text-right">Valoare</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {vizibile.map(c => (
                    <tr key={c.id} onClick={() => deschide(c)}
                      className={`border-b border-slate-50 last:border-0 cursor-pointer hover:bg-amber-50/60 ${id === c.id ? 'bg-amber-50' : ''}`}>
                      <td className="px-3 py-2 font-medium text-[#0a1628] whitespace-nowrap">{c.nr || '—'}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">{ziRo(c.data)}</td>
                      <td className="px-3 py-2">
                        <div className="text-[#0a1628]">{c.beneficiar_nume}</div>
                        <div className="text-[11px] text-slate-400">
                          {c.beneficiar_tip === 'pj' ? (c.beneficiar_cui ? `CUI ${c.beneficiar_cui}` : 'Firmă') : 'Persoană fizică'}
                          {c.factura?.numar ? ` · factura ${[c.factura.serie, c.factura.numar].filter(Boolean).join(' ')}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                        {c.perioada_start === c.perioada_end ? ziRo(c.perioada_start) : `${ziRo(c.perioada_start)} – ${ziRo(c.perioada_end)}`}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-right text-[#0a1628]">{sumaRo(c.suma)} {c.moneda}</td>
                      <td className="px-3 py-2 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                        <button onClick={() => docxDinLista(c)} disabled={randBusy === c.id} title="Descarcă DOCX"
                          className="p-1.5 rounded-md text-slate-500 hover:text-[#0a1628] hover:bg-slate-100 disabled:opacity-50">
                          {randBusy === c.id ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                        <button onClick={() => sterge(c)} disabled={randBusy === c.id} title="Șterge contractul"
                          className="p-1.5 rounded-md text-red-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-50">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!lista && !f && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            {/* Încărcare factură */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
              <div className="font-semibold text-sm text-[#0a1628] mb-1 flex items-center gap-1.5"><Upload size={15} /> Încarcă factura</div>
              <p className="text-xs text-slate-400 mb-3">PDF sau poză (JPG, PNG, WEBP).</p>
              <input ref={fileRef} type="file" accept="application/pdf,.pdf,image/jpeg,image/png,image/webp"
                onChange={e => setFile(e.target.files?.[0] || null)}
                className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-medium mb-3" />
              <button onClick={() => interpreteaza('fisier')} disabled={!!citind || !file}
                className="mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0a1628] disabled:opacity-50"
                style={{ background: '#f5c842' }}>
                {citind === 'fisier' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Interpretează factura
              </button>
            </div>

            {/* Import text */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col">
              <div className="font-semibold text-sm text-[#0a1628] mb-1 flex items-center gap-1.5"><ScrollText size={15} /> Importă text</div>
              <p className="text-xs text-slate-400 mb-3">Lipește textul facturii sau datele contractului (client, sumă, dată, eveniment…).</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={6}
                placeholder={'ex. Factura SSY 1176 din 09.09.2026\nClient: AGHIDENT CERAM SRL, CIF 27697229, J2010010973401\nStr. Echinoctiului nr. 79, Corp A, Sector 5, București\nServicii conf. contract SSY631/09.09.2026 — 1313,55 lei'}
                className={`${inp} font-mono text-xs mb-3`} />
              <button onClick={() => interpreteaza('text')} disabled={!!citind || !text.trim()}
                className="mt-auto flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0a1628] disabled:opacity-50"
                style={{ background: '#f5c842' }}>
                {citind === 'text' ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />} Interpretează textul
              </button>
            </div>
          </div>

          {citind && (
            <div className="flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
              <Loader2 size={16} className="animate-spin" /> Interpretez datele…
            </div>
          )}
          {err && (
            <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0 mt-0.5" /> {err}
            </div>
          )}
          <p className="text-xs text-slate-400 text-center">
            sau <button onClick={manual} className="underline hover:text-slate-600">completează contractul manual</button>
          </p>
        </>
      )}

      {!lista && f && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="text-xs text-slate-500 flex items-center gap-2 flex-wrap">
              <span>Date din {sursa}</span>
              {id && !modificat && salvatLa && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">
                  <Check size={11} /> salvat {new Date(salvatLa).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              {modificat && (
                <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">nesalvat</span>
              )}
            </div>
            <button onClick={contractNou} className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800">
              <Plus size={12} /> Contract nou
            </button>
          </div>

          {factura && !factura.emisa_de_ssy && (
            <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>Datele par ale unei facturi emise <b>către</b> Set Sail Yachting{factura.furnizor ? ` de ${factura.furnizor}` : ''}, nu de ea. Verifică beneficiarul înainte să generezi contractul.</span>
            </div>
          )}
          {factura && (factura.serie || factura.numar || factura.descriere) && (
            <div className="text-xs text-slate-500">
              Factura {[factura.serie, factura.numar].filter(Boolean).join(' ') || '—'}
              {factura.data ? ` · ${ziRo(factura.data)}` : ''}
              {factura.descriere ? ` · ${factura.descriere}` : ''}
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Camp label="Nr. contract"><input className={inp} value={f.nr} placeholder="ex. SSY631" onChange={e => set('nr', e.target.value)} /></Camp>
            <Camp label="Data contractului"><input type="date" className={inp} value={f.data} onChange={e => set('data', e.target.value)} /></Camp>
          </div>

          <div className="rounded-xl border border-slate-100 p-3 space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <span className="text-slate-400">Beneficiar:</span>
              {(['pf', 'pj'] as const).map(t => (
                <label key={t} className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={f.beneficiar_tip === t} onChange={() => set('beneficiar_tip', t)} />
                  {t === 'pf' ? 'Persoană fizică' : 'Firmă'}
                </label>
              ))}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <Camp label={f.beneficiar_tip === 'pj' ? 'Denumire firmă' : 'Nume și prenume'} lat>
                <input className={inp} value={f.beneficiar_nume} onChange={e => set('beneficiar_nume', e.target.value)} />
              </Camp>
              <Camp label={f.beneficiar_tip === 'pj' ? 'Sediu' : 'Domiciliu'} lat>
                <input className={inp} value={f.beneficiar_adresa} onChange={e => set('beneficiar_adresa', e.target.value)} />
              </Camp>
              {f.beneficiar_tip === 'pj' ? (<>
                <Camp label="Cod fiscal (CUI)"><input className={inp} value={f.beneficiar_cui} onChange={e => set('beneficiar_cui', e.target.value)} /></Camp>
                <Camp label="Nr. Registrul Comerțului"><input className={inp} value={f.beneficiar_reg_com} onChange={e => set('beneficiar_reg_com', e.target.value)} /></Camp>
                <Camp label="Reprezentată prin (opțional)" lat><input className={inp} value={f.beneficiar_reprezentant} onChange={e => set('beneficiar_reprezentant', e.target.value)} /></Camp>
              </>) : (
                <Camp label="CNP"><input className={inp} value={f.beneficiar_cnp} onChange={e => set('beneficiar_cnp', e.target.value)} /></Camp>
              )}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <Camp label="Evenimentul (obiectul contractului)" lat>
              <input className={inp} value={f.eveniment} onChange={e => set('eveniment', e.target.value)} />
            </Camp>
            <Camp label="Perioada — de la"><input type="date" className={inp} value={f.perioada_start} onChange={e => set('perioada_start', e.target.value)} /></Camp>
            <Camp label="până la"><input type="date" className={inp} value={f.perioada_end} onChange={e => set('perioada_end', e.target.value)} /></Camp>
          </div>
          {perioadaImplicita && (
            <p className="text-[11px] text-slate-400 -mt-2">Fără perioadă specificată: de la o săptămână după data contractului până la 30 octombrie.</p>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Camp label="Valoarea contractului">
              <input type="number" step="0.01" className={inp} value={f.suma || ''} onChange={e => set('suma', Number(e.target.value) || 0)} />
            </Camp>
            <Camp label="Moneda">
              <select className={inp} value={f.moneda} onChange={e => set('moneda', e.target.value as 'RON' | 'EUR')}>
                <option value="RON">RON</option><option value="EUR">EUR (echivalent în RON)</option>
              </select>
            </Camp>
            <Camp label="Modul de plată" lat>
              <textarea rows={2} className={inp} value={f.plata} onChange={e => set('plata', e.target.value)} />
            </Camp>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 flex-wrap">
            <button onClick={contractNou} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Renunță</button>
            <button onClick={genereaza} disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0a1628] disabled:opacity-60"
              style={{ background: '#f5c842' }}>
              {busy === 'docx' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Generează DOCX
            </button>
            <button onClick={() => genereazaPdf(false)} disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-pink-500 hover:bg-pink-600 disabled:opacity-60">
              {busy === 'pdf-gol' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />} PDF fără ștampilă/semnătură
            </button>
            <button onClick={() => genereazaPdf(true)} disabled={!!busy}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
              {busy === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />} PDF semnat și ștampilat
            </button>
            <button onClick={butonSalveaza} disabled={!!busy || (!!id && !modificat)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-[#0a1628] text-[#0a1628] bg-white hover:bg-slate-50 disabled:opacity-50">
              {busy === 'salvez' ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {id && !modificat ? 'Salvat' : 'Salvează'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function UploadBox({ entity, token, onUploaded, fixedLuna, compact, initial }: {
  entity: string; token: string | null; onUploaded: (d: Doc) => void
  fixedLuna?: string; compact?: boolean
  // valori precompletate (ex. factura pentru o cheltuială din extras)
  initial?: { categorie?: string; nume?: string; dataDoc?: string; note?: string }
}) {
  const [categorie, setCategorie] = useState(initial?.categorie || 'factura')
  const [luna, setLuna] = useState(fixedLuna || currentLuna())
  const [nume, setNume] = useState(initial?.nume || '')
  const [dataDoc, setDataDoc] = useState(initial?.dataDoc || '')
  const [note, setNote] = useState(initial?.note || '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const fileRef = useRef<HTMLInputElement | null>(null)

  async function upload(file: File) {
    setBusy(true); setErr(''); setOk('')
    const fd = new FormData()
    fd.append('file', file)
    fd.append('entity', entity)
    fd.append('token', token || '')
    fd.append('categorie', categorie)
    fd.append('luna', luna)
    fd.append('nume', nume)
    fd.append('data_doc', dataDoc)
    fd.append('note', note)
    try {
      const res = await fetch('/api/acte-contabile/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'Upload eșuat.'); return }
      onUploaded(json.doc)
      setOk(`„${json.doc.file_name || 'document'}” încărcat.`)
      setNume(''); setDataDoc(''); setNote('')
      setTimeout(() => setOk(''), 3000)
    } catch { setErr('Conexiune eșuată.') }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = '' }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842] bg-white'

  return (
    <div className={compact ? 'bg-white rounded-xl border border-slate-200 p-4' : 'bg-white rounded-2xl border border-slate-200 shadow-sm p-5'}>
      {!compact && (
        <h2 className="font-semibold text-[#0a1628] mb-4 flex items-center gap-2">
          <Upload size={16} className="text-amber-500" /> Încarcă document nou
        </h2>
      )}
      <div className={`grid ${fixedLuna ? 'sm:grid-cols-4' : 'sm:grid-cols-5'} gap-3 mb-3`}>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Categorie</label>
          <select value={categorie} onChange={e => setCategorie(e.target.value)} className={inp}>
            {CATEGORII.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        {!fixedLuna && (
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Lună</label>
            <select value={luna} onChange={e => setLuna(e.target.value)} className={inp}>
              {LUNI.map(m => <option key={m} value={m}>{LUNA_LABEL(m)}</option>)}
            </select>
          </div>
        )}
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-slate-500 mb-1">Denumire (opțional)</label>
          <input value={nume} onChange={e => setNume(e.target.value)} placeholder="ex: Factura furnizor X" className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Data actului</label>
          <input type="date" value={dataDoc} onChange={e => setDataDoc(e.target.value)} className={inp} />
        </div>
      </div>
      <div className="mb-4">
        <label className="block text-xs font-medium text-slate-500 mb-1">Notă (opțional)</label>
        <input value={note} onChange={e => setNote(e.target.value)} placeholder="ex: achitată, de verificat TVA…" className={inp} />
      </div>

      <input ref={fileRef} type="file" className="hidden"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.avif,.heic,.xls,.xlsx,.csv,application/pdf,image/*"
        onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
      <button onClick={() => fileRef.current?.click()} disabled={busy}
        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-[#0a1628] transition disabled:opacity-60"
        style={{ background: '#f5c842' }}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        {busy ? 'Se încarcă…' : (fixedLuna ? `Alege fișier pentru ${LUNA_LABEL(fixedLuna)} — max 20 MB` : 'Alege fișier (PDF, imagine, Excel) — max 20 MB')}
      </button>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {ok && <p className="text-sm text-emerald-600 mt-2">{ok}</p>}
    </div>
  )
}

function SectionAddDoc({ entity, token, month, onAdd }: {
  entity: string; token: string | null; month: string; onAdd: (d: Doc) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-3">
      <button onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition">
        {open ? <X size={14} /> : <Plus size={14} />} {open ? 'Renunță' : `Adaugă document în ${LUNA_LABEL(month)}`}
      </button>
      {open && (
        <div className="mt-2">
          <UploadBox entity={entity} token={token} fixedLuna={month} compact
            onUploaded={d => onAdd(d)} />
        </div>
      )}
    </div>
  )
}

function DeleteButton({ entity, token, id, onDeleted }: { entity: string; token: string | null; id: string; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!confirm('Ștergi definitiv acest document?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/acte-contabile/delete?entity=${entity}&id=${id}&token=${encodeURIComponent(token || '')}`, { method: 'DELETE' })
      const json = await res.json()
      if (json.ok) onDeleted()
      else alert(json.error || 'Ștergere eșuată.')
    } finally { setBusy(false) }
  }
  return (
    <button onClick={remove} disabled={busy}
      className="p-1.5 rounded-lg border border-slate-100 text-red-300 hover:text-red-500 hover:bg-red-50 transition" title="Șterge">
      {busy ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
    </button>
  )
}
