'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

const MONTHS = [
  { nr: 1,  label: 'Ianuarie',   icon: '❄️',  season: 'winter'  },
  { nr: 2,  label: 'Februarie',  icon: '❄️',  season: 'winter'  },
  { nr: 3,  label: 'Martie',     icon: '🌸',  season: 'spring'  },
  { nr: 4,  label: 'Aprilie',    icon: '🌸',  season: 'spring'  },
  { nr: 5,  label: 'Mai',        icon: '🌸',  season: 'spring'  },
  { nr: 6,  label: 'Iunie',      icon: '☀️',  season: 'summer'  },
  { nr: 7,  label: 'Iulie',      icon: '☀️',  season: 'summer'  },
  { nr: 8,  label: 'August',     icon: '☀️',  season: 'summer'  },
  { nr: 9,  label: 'Septembrie', icon: '🍂',  season: 'autumn'  },
  { nr: 10, label: 'Octombrie',  icon: '🍂',  season: 'autumn'  },
  { nr: 11, label: 'Noiembrie',  icon: '🍂',  season: 'autumn'  },
  { nr: 12, label: 'Decembrie',  icon: '❄️',  season: 'winter'  },
]

const SEASON_CLS: Record<string, string> = {
  spring: 'text-green-400  font-bold',
  summer: 'text-yellow-400 font-bold',
  autumn: 'text-orange-500 font-bold',
  winter: 'text-blue-400   font-bold',
}

const UTILITIES = [
  {
    key: 'energie',
    title: 'ENERGIE ELECTRICĂ',
    supplier: 'Hidroelectrica',
    hdr: 'bg-purple-200 text-purple-900',
    sup: 'bg-purple-100 text-purple-700',
    val: 'bg-purple-50',
    idx: 'bg-purple-50/60',
    border: 'border-purple-200',
  },
  {
    key: 'gaze',
    title: 'GAZE NATURALE',
    supplier: 'Engie',
    hdr: 'bg-teal-200 text-teal-900',
    sup: 'bg-teal-100 text-teal-700',
    val: 'bg-teal-50',
    idx: 'bg-teal-50/60',
    border: 'border-teal-200',
  },
  {
    key: 'apa',
    title: 'APĂ RECE',
    supplier: 'ApaNova',
    hdr: 'bg-blue-200 text-blue-900',
    sup: 'bg-blue-100 text-blue-700',
    val: 'bg-blue-50',
    idx: 'bg-blue-50/60',
    border: 'border-blue-200',
  },
  {
    key: 'gunoi',
    title: 'GUNOI MENAJER',
    supplier: 'Urban',
    hdr: 'bg-green-200 text-green-900',
    sup: 'bg-green-100 text-green-700',
    val: 'bg-green-50',
    idx: 'bg-green-50/60',
    border: 'border-green-200',
  },
  {
    key: 'internet',
    title: 'INTERNET / TV',
    supplier: 'Digi',
    hdr: 'bg-indigo-300 text-indigo-900',
    sup: 'bg-indigo-100 text-indigo-800',
    val: 'bg-indigo-50',
    idx: 'bg-indigo-50/60',
    border: 'border-indigo-200',
  },
]

type Row = { luna: number; [key: string]: string | number | null }
type Editing = { luna: number; field: string; value: string } | null

function EditableCell({
  value, luna, field, bg, saving, onSave,
}: {
  value: string | null; luna: number; field: string; bg: string; saving: boolean
  onSave: (luna: number, field: string, val: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function start() {
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 30)
  }
  function commit() {
    setEditing(false)
    if (draft !== (value ?? '')) onSave(luna, field, draft)
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className={`w-full text-center text-xs px-1 py-1 outline-none border border-blue-400 rounded focus:ring-2 focus:ring-blue-300 ${bg}`}
        style={{ minWidth: 60 }}
      />
    )
  }

  return (
    <div
      onClick={start}
      className={`w-full text-center text-xs px-1 py-1.5 cursor-pointer rounded hover:brightness-95 transition-all select-none ${bg} ${saving ? 'opacity-50' : ''}`}
      style={{ minWidth: 60 }}
      title="Click pentru editare"
    >
      {value ? <span className="text-gray-700 font-medium">{value}</span> : <span className="text-gray-300">—</span>}
    </div>
  )
}

export default function CasaBelvederePage() {
  const currentYear = new Date().getFullYear()
  const [an, setAn] = useState(currentYear)
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [unauthorized, setUnauthorized] = useState(false)

  async function loadData(year: number) {
    setLoading(true)
    const r = await fetch(`/api/casa-belvedere?an=${year}`)
    if (r.status === 401) { setUnauthorized(true); setLoading(false); return }
    const { data } = await r.json()
    const map: Record<number, Row> = {}
    for (const row of (data as Row[])) map[row.luna] = row
    setRows(map)
    setLoading(false)
  }

  useEffect(() => { loadData(an) }, [an])

  const handleSave = useCallback(async (luna: number, field: string, value: string) => {
    const key = `${luna}-${field}`
    setSaving(s => new Set(s).add(key))
    await fetch('/api/casa-belvedere', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ an, luna, field, value }),
    })
    setRows(prev => ({
      ...prev,
      [luna]: { ...(prev[luna] ?? { luna }), [field]: value || null },
    }))
    setSaving(s => { const n = new Set(s); n.delete(key); return n })
  }, [an])

  if (unauthorized) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-gray-700">Acces restricționat</h1>
        <p className="text-gray-400 mt-1 text-sm">Trebuie să fii autentificat ca administrator.</p>
        <a href="/admin" className="mt-4 inline-block text-sm text-blue-600 hover:underline">→ Admin login</a>
      </div>
    </div>
  )

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-6">
      {/* Header */}
      <div className="max-w-7xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🏠</span>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                Casa Belvedere Drugan
              </h1>
            </div>
            <p className="text-sm text-gray-400 ml-12">
              Str. Vasile Burla nr. 28, Sector 6, București &mdash; Cheltuieli utilități
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">An:</span>
            <div className="flex gap-1">
              {years.map(y => (
                <button
                  key={y}
                  onClick={() => setAn(y)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    an === y
                      ? 'bg-gray-900 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 900 }}>
              <thead>
                {/* Row 1: utility titles */}
                <tr>
                  <th className="bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left w-36">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Lună / {an}</span>
                  </th>
                  {UTILITIES.map(u => (
                    <th
                      key={u.key}
                      colSpan={2}
                      className={`${u.hdr} border-b border-r border-white/40 px-2 py-3 text-center`}
                    >
                      <div className="text-xs font-bold tracking-wide leading-tight">{u.title}</div>
                    </th>
                  ))}
                </tr>
                {/* Row 2: supplier + val/idx sub-headers */}
                <tr>
                  <th className="bg-gray-50 border-b border-r border-gray-200 px-4 py-2"></th>
                  {UTILITIES.map(u => (
                    <>
                      <th key={`${u.key}-sup`} colSpan={2} className={`${u.sup} border-b border-r border-white/40 px-2 py-1.5 text-center`}>
                        <div className="text-[11px] font-semibold">{u.supplier}</div>
                      </th>
                    </>
                  ))}
                </tr>
                {/* Row 3: Valoare / Index */}
                <tr>
                  <th className="bg-gray-50 border-b border-r border-gray-100 px-4 py-2"></th>
                  {UTILITIES.map(u => (
                    <>
                      <th key={`${u.key}-val-h`} className={`${u.val} border-b border-r border-gray-100 px-2 py-2 text-center`}>
                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Valoare</span>
                      </th>
                      <th key={`${u.key}-idx-h`} className={`${u.idx} border-b border-r border-gray-100 px-2 py-2 text-center`}>
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Index</span>
                      </th>
                    </>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="py-12 text-center text-gray-400 text-sm">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-300 border-t-transparent rounded-full animate-spin" />
                        Se încarcă datele…
                      </div>
                    </td>
                  </tr>
                ) : MONTHS.map((m, idx) => {
                  const row = rows[m.nr] ?? {}
                  const isEven = idx % 2 === 1
                  return (
                    <tr key={m.nr} className={`hover:bg-blue-50/30 transition-colors ${isEven ? 'bg-gray-50/40' : ''}`}>
                      {/* Month cell */}
                      <td className="border-r border-gray-100 px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-base leading-none" role="img" aria-label={m.season}>{m.icon}</span>
                          <span className={`text-sm ${SEASON_CLS[m.season]}`}>{m.label}</span>
                        </div>
                      </td>
                      {UTILITIES.map(u => (
                        <>
                          <td key={`${u.key}-val`} className={`border-r border-${u.border.split('-')[1]}-100 px-1 py-1`}>
                            <EditableCell
                              value={String(row[`${u.key}_valoare`] ?? '')}
                              luna={m.nr}
                              field={`${u.key}_valoare`}
                              bg={u.val}
                              saving={saving.has(`${m.nr}-${u.key}_valoare`)}
                              onSave={handleSave}
                            />
                          </td>
                          <td key={`${u.key}-idx`} className="border-r border-gray-100 px-1 py-1">
                            <EditableCell
                              value={String(row[`${u.key}_index`] ?? '')}
                              luna={m.nr}
                              field={`${u.key}_index`}
                              bg={u.idx}
                              saving={saving.has(`${m.nr}-${u.key}_index`)}
                              onSave={handleSave}
                            />
                          </td>
                        </>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
            <p className="text-xs text-gray-400">Click pe orice celulă pentru a edita • Enter sau click în afară pentru a salva</p>
            <p className="text-xs text-gray-300">Modificările se salvează automat în baza de date</p>
          </div>
        </div>
      </div>
    </div>
  )
}
