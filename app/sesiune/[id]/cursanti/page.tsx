'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

type Row = {
  id: string; full_name: string; cnp: string; birth_date: string
  address: string; city: string; county: string; has_ci: boolean; has_verso: boolean
}

const FIELDS: { key: keyof Row; label: string; w?: string }[] = [
  { key: 'full_name', label: 'Nume și prenume', w: 'min-w-[180px]' },
  { key: 'cnp', label: 'CNP', w: 'min-w-[140px]' },
  { key: 'birth_date', label: 'Data nașterii', w: 'min-w-[110px]' },
  { key: 'address', label: 'Adresă', w: 'min-w-[200px]' },
  { key: 'city', label: 'Localitate', w: 'min-w-[120px]' },
  { key: 'county', label: 'Județ', w: 'min-w-[110px]' },
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

export default function RosterPage() {
  const { id } = useParams<{ id: string }>()
  const token = useSearchParams().get('token') || ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [denied, setDenied] = useState(false)
  const [edit, setEdit] = useState<{ id: string; field: keyof Row } | null>(null)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [ciFor, setCiFor] = useState<Row | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/roster?session_id=${id}&token=${encodeURIComponent(token)}`)
    if (r.status === 403) { setDenied(true); return }
    const j = await r.json()
    setRows(j.students || [])
  }, [id, token])
  useEffect(() => { load() }, [load])

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
    setRows(rs => (rs || []).map(x => x.id === sid ? { ...x, [field]: draft } : x))
    setEdit(null)
  }

  if (denied) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#cdd9e5', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Acces restricționat</h1><p style={{ color: '#8aa0b3', fontSize: 14 }}>Link invalid sau token lipsă.</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-xl font-bold text-gray-900">Cursanți — sesiune</h1>
          <p className="text-sm text-gray-500 mt-1">
            Click pe o celulă pentru a edita, apoi confirmă cu ✓ (sau Enter). Apasă „CI" pentru imagini.
          </p>
        </div>

        {rows === null ? (
          <div className="text-center text-gray-400 py-16">Se încarcă…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-16">Niciun cursant în sesiune.</div>
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
          onChanged={(side, has) => setRows(rs => (rs || []).map(x => x.id === ciFor.id ? { ...x, [side === 'verso' ? 'has_verso' : 'has_ci']: has } : x))} />
      )}
    </div>
  )
}

function CiModal({ sessionId, token, row, onClose, onChanged }: {
  sessionId: string; token: string; row: Row
  onClose: () => void; onChanged: (side: 'recto' | 'verso', has: boolean) => void
}) {
  const [side, setSide] = useState<'recto' | 'verso'>('recto')
  const [img, setImg] = useState<string | null | undefined>(undefined) // undefined=loading
  const [zoom, setZoom] = useState(1)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const fetchImg = useCallback(async (s: 'recto' | 'verso') => {
    setImg(undefined); setZoom(1)
    const r = await fetch(`/api/roster?session_id=${sessionId}&token=${encodeURIComponent(token)}&student_id=${row.id}&side=${s}`)
    const j = await r.json()
    setImg(j.image || null)
  }, [sessionId, token, row.id])
  useEffect(() => { fetchImg(side) }, [side, fetchImg])

  async function upload(file: File) {
    setBusy(true)
    try {
      const dataUrl = await downscale(file)
      const r = await fetch('/api/roster', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, token, student_id: row.id, side, imageData: dataUrl }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || 'eroare') }
      setImg(dataUrl); setZoom(1); onChanged(side, true)
    } catch (e: any) { alert('Upload eșuat: ' + e.message) }
    setBusy(false)
  }

  return (
    <div onClick={onClose} className="fixed inset-0 z-50 bg-black/80 flex flex-col">
      <div onClick={e => e.stopPropagation()} className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-900 text-gray-100">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-medium truncate">{row.full_name}</span>
          <div className="flex rounded-lg overflow-hidden border border-gray-700 ml-2">
            <button onClick={() => setSide('recto')} className={`px-3 py-1 text-xs ${side === 'recto' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Față</button>
            <button onClick={() => setSide('verso')} className={`px-3 py-1 text-xs ${side === 'verso' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-800'}`}>Verso</button>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} disabled={!img} title="Zoom -"
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">−</button>
          <span className="text-xs text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(5, +(z + 0.25).toFixed(2)))} disabled={!img} title="Zoom +"
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg disabled:opacity-40">+</button>
          <button onClick={() => setZoom(1)} disabled={!img} title="Mărime naturală"
            className="px-2.5 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs disabled:opacity-40">1:1</button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="px-3 h-8 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs disabled:opacity-50 ml-1">
            {busy ? 'Se încarcă…' : img ? 'Înlocuiește' : 'Încarcă'}
          </button>
          <button onClick={onClose} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-lg ml-1">✕</button>
        </div>
      </div>
      <div onClick={e => e.stopPropagation()} className="flex-1 overflow-auto flex items-start justify-center p-4">
        {img === undefined ? (
          <div className="text-gray-400 mt-20">Se încarcă…</div>
        ) : img === null ? (
          <div className="text-gray-400 mt-20 text-center">
            <p className="mb-3">Nicio imagine {side === 'verso' ? 'verso' : 'față'}.</p>
            <button onClick={() => fileRef.current?.click()} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm">Încarcă imagine</button>
          </div>
        ) : (
          <img src={img} alt="CI" style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
            className="shadow-2xl rounded transition-transform" />
        )}
      </div>
    </div>
  )
}
