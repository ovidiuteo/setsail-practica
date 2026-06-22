'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Row = {
  id: string; full_name: string; cnp: string; birth_date: string
  address: string; city: string; county: string; has_ci: boolean; has_verso: boolean
}
type Verified = { corina: boolean; paula: boolean; ruxandra: boolean }

const FIELDS: { key: keyof Row; label: string; w?: string }[] = [
  { key: 'full_name', label: 'Nume și prenume', w: 'min-w-[180px]' },
  { key: 'cnp', label: 'CNP', w: 'min-w-[140px]' },
  { key: 'birth_date', label: 'Data nașterii', w: 'min-w-[110px]' },
  { key: 'address', label: 'Adresă', w: 'min-w-[200px]' },
  { key: 'city', label: 'Localitate', w: 'min-w-[120px]' },
  { key: 'county', label: 'Județ', w: 'min-w-[110px]' },
]
const VERIFIERS: { key: keyof Verified; label: string }[] = [
  { key: 'corina', label: 'Corina' }, { key: 'paula', label: 'Paula' }, { key: 'ruxandra', label: 'Ruxandra' },
]

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
  const [ciFor, setCiFor] = useState<Row | null>(null)
  const [tab, setTab] = useState<'list' | 'verify'>('list')

  const load = useCallback(async () => {
    const r = await fetch(`/api/roster?session_id=${id}&token=${encodeURIComponent(token)}`)
    if (r.status === 403) { setDenied(true); return }
    const j = await r.json()
    setRows(j.students || [])
    if (j.verified) setVerified(j.verified)
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
      <div className="max-w-6xl mx-auto">
        <div className="mb-4">
          <h1 className="text-xl font-bold text-gray-900">Cursanți — sesiune</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click pe o celulă pentru a edita, apoi confirmă cu ✓ (sau Enter). Apasă „CI" pentru imagini și date.
          </p>
        </div>

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

        {/* Taburi */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          {([['list', 'Listă'], ['verify', 'Verify by ID']] as const).map(([k, lbl]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {lbl}
            </button>
          ))}
        </div>

        {rows === null ? (
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
                  {FIELDS.map(f => <th key={f.key} className={`px-3 py-2.5 ${f.w || ''}`}>{f.label}</th>)}
                  <th className="px-3 py-2.5 text-center">CI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={row.id} className="hover:bg-gray-50/60">
                    <td className="px-3 py-2 text-gray-300 text-xs">{i + 1}</td>
                    {FIELDS.map(f => {
                      const editing = edit?.id === row.id && edit?.field === f.key
                      return (
                        <td key={f.key} className="px-3 py-2 align-middle">
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
                    <td className="px-3 py-2 text-center">
                      <button onClick={() => setCiFor(row)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${row.has_ci || row.has_verso ? 'border-green-200 text-green-700 bg-green-50 hover:bg-green-100' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                        {row.has_ci || row.has_verso ? 'CI ✓' : 'CI +'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {ciFor && (
        <CiModal sessionId={id} token={token} row={ciFor}
          onClose={() => setCiFor(null)}
          onRowUpdate={rowUpdate} />
      )}
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
    setForm({ full_name: c.full_name || '', cnp: c.cnp || '', birth_date: c.birth_date || '', address: c.address || '', city: c.city || '', county: c.county || '' })
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

function CiModal({ sessionId, token, row, onClose, onRowUpdate }: {
  sessionId: string; token: string; row: Row
  onClose: () => void; onRowUpdate: (id: string, partial: Partial<Row>) => void
}) {
  const [side, setSide] = useState<'recto' | 'verso'>('recto')
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

  const fetchImg = useCallback(async (s: 'recto' | 'verso') => {
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
      onRowUpdate(row.id, side === 'verso' ? { has_verso: true } : { has_ci: true })
    } catch (e: any) { alert('Salvare imagine eșuată: ' + e.message) }
    setBusy(false)
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
          <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-1">
            <button onClick={() => setSide('recto')} className={`px-3 py-1 text-xs ${side === 'recto' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Față</button>
            <button onClick={() => setSide('verso')} className={`px-3 py-1 text-xs ${side === 'verso' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Verso</button>
          </div>
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
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg ml-1">✕</button>
        </div>
      </div>

      {/* Imagine */}
      <div onClick={e => e.stopPropagation()} className="flex-1 overflow-auto flex items-start justify-center p-4">
        {img === undefined ? (
          <div className="text-gray-400 mt-20">Se încarcă…</div>
        ) : img === null ? (
          <div className="text-gray-400 mt-20 text-center">
            <p className="mb-3">Nicio imagine {side === 'verso' ? 'verso' : 'față'}.</p>
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
