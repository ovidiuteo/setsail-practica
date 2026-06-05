'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import {
  Loader2, Upload, Trash2, RefreshCw, ShieldAlert, FileText, Download,
  Receipt, Landmark, FileSignature, ScrollText, Files, Search, Eye, X, FileSpreadsheet, CalendarDays,
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

// Lunile gestionate (sezon)
const LUNI = ['mai', 'iunie', 'iulie'] as const
const LUNA_LABEL = (m: string) => m.charAt(0).toUpperCase() + m.slice(1)
function currentLuna(): string {
  // getMonth: 0=ian … 4=mai, 5=iunie, 6=iulie. Clamp la sezonul gestionat.
  const idx = Math.min(Math.max(new Date().getMonth() - 4, 0), LUNI.length - 1)
  return LUNI[idx]
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

  function toggleMonth(m: string) {
    setMonths(prev => prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m])
  }

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
  const monthCounts = (docs || []).reduce((a, d) => { const m = lunaOf(d); a[m] = (a[m] || 0) + 1; return a }, {} as Record<string, number>)
  // Documentele din lunile selectate (baza pentru numărători categorii + afișare)
  const inMonths = (docs || []).filter(d => months.length === 0 || months.includes(lunaOf(d)))
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
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition">
            <RefreshCw size={14} /> Reîncarcă
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        <UploadBox entity={entity} token={token} onUploaded={d => setDocs(prev => [d, ...(prev || [])])} />

        {/* filtru luni */}
        <div className="flex items-center gap-2 flex-wrap mt-6 mb-3">
          <span className="flex items-center gap-1.5 text-xs font-medium text-slate-400 mr-1">
            <CalendarDays size={14} /> Luna:
          </span>
          {LUNI.map(m => {
            const active = months.includes(m)
            return (
              <button key={m} onClick={() => toggleMonth(m)}
                className={`px-3.5 py-1.5 rounded-full text-sm font-semibold transition ${active ? 'text-[#0a1628]' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}
                style={active ? { background: '#f5c842' } : {}}>
                {LUNA_LABEL(m)} ({monthCounts[m] || 0})
              </button>
            )
          })}
          <button onClick={() => setMonths([...LUNI])}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${months.length === LUNI.length ? 'bg-[#0a1628] text-white' : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
            Toate lunile
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
        ) : shown.length === 0 ? (
          <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
            {docs.length === 0 ? 'Niciun document încărcat încă.' : 'Niciun document pentru filtrul curent.'}
          </div>
        ) : (
          <div className="space-y-7">
            {visibleMonths.map(m => {
              const groupDocs = shown.filter(d => lunaOf(d) === m)
              if (groupDocs.length === 0) return null
              return (
                <section key={m}>
                  <div className="flex items-baseline gap-2 mb-2.5">
                    <h2 className="text-xl font-extrabold tracking-wide text-[#0a1628]">{m.toUpperCase()}</h2>
                    <span className="text-xs text-slate-400">{groupDocs.length} document{groupDocs.length === 1 ? '' : 'e'}</span>
                  </div>
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
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )
            })}
          </div>
        )}

        <p className="text-xs text-slate-400 text-center mt-6">
          Documentele sunt confidențiale. Acest link oferă acces complet — nu îl distribui în afara contabilității.
        </p>
      </main>

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

function DocRow({ d, entity, token, onPreview, onDeleted, onMonthChanged }: {
  d: Doc; entity: string; token: string | null
  onPreview: () => void; onDeleted: () => void; onMonthChanged: (luna: string) => void
}) {
  const [saving, setSaving] = useState(false)
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

function UploadBox({ entity, token, onUploaded }: { entity: string; token: string | null; onUploaded: (d: Doc) => void }) {
  const [categorie, setCategorie] = useState('factura')
  const [luna, setLuna] = useState(currentLuna())
  const [nume, setNume] = useState('')
  const [dataDoc, setDataDoc] = useState('')
  const [note, setNote] = useState('')
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
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
      <h2 className="font-semibold text-[#0a1628] mb-4 flex items-center gap-2">
        <Upload size={16} className="text-amber-500" /> Încarcă document nou
      </h2>
      <div className="grid sm:grid-cols-5 gap-3 mb-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Categorie</label>
          <select value={categorie} onChange={e => setCategorie(e.target.value)} className={inp}>
            {CATEGORII.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Lună</label>
          <select value={luna} onChange={e => setLuna(e.target.value)} className={inp}>
            {LUNI.map(m => <option key={m} value={m}>{LUNA_LABEL(m)}</option>)}
          </select>
        </div>
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
        {busy ? 'Se încarcă…' : 'Alege fișier (PDF, imagine, Excel) — max 20 MB'}
      </button>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
      {ok && <p className="text-sm text-emerald-600 mt-2">{ok}</p>}
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
