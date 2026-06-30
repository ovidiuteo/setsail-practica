'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

const MONTHS = [
  { nr: 1,  abbr: 'IAN', label: 'Ianuarie',   icon: '❄️',  season: 'winter' },
  { nr: 2,  abbr: 'FEB', label: 'Februarie',  icon: '❄️',  season: 'winter' },
  { nr: 3,  abbr: 'MAR', label: 'Martie',     icon: '🌱',  season: 'spring' },
  { nr: 4,  abbr: 'APR', label: 'Aprilie',    icon: '🌸',  season: 'spring' },
  { nr: 5,  abbr: 'MAI', label: 'Mai',        icon: '🌿',  season: 'spring' },
  { nr: 6,  abbr: 'IUN', label: 'Iunie',      icon: '☀️',  season: 'summer' },
  { nr: 7,  abbr: 'IUL', label: 'Iulie',      icon: '🌞',  season: 'summer' },
  { nr: 8,  abbr: 'AUG', label: 'August',     icon: '🏖️',  season: 'summer' },
  { nr: 9,  abbr: 'SEP', label: 'Septembrie', icon: '🍂',  season: 'autumn' },
  { nr: 10, abbr: 'OCT', label: 'Octombrie',  icon: '🍁',  season: 'autumn' },
  { nr: 11, abbr: 'NOI', label: 'Noiembrie',  icon: '🍃',  season: 'autumn' },
  { nr: 12, abbr: 'DEC', label: 'Decembrie',  icon: '❄️',  season: 'winter' },
]

const SEASON_CLS: Record<string, string> = {
  spring: 'text-green-500',
  summer: 'text-yellow-500',
  autumn: 'text-orange-500',
  winter: 'text-blue-400',
}

const UTILITIES = [
  { key: 'energie', title: 'ENERGIE\nELECTRICĂ', supplier: 'Hidroelectrica', unit: 'kWh', hdr: 'bg-purple-100 text-purple-900', sup: 'text-purple-600', val: 'text-purple-900', idx: 'text-purple-400', dot: 'bg-purple-400' },
  { key: 'gaze',    title: 'GAZE\nNATURALE',    supplier: 'Engie',           unit: 'mc',  hdr: 'bg-teal-100 text-teal-900',   sup: 'text-teal-600',   val: 'text-teal-900',   idx: 'text-teal-400',   dot: 'bg-teal-400'   },
  { key: 'apa',     title: 'APĂ\nRECE',         supplier: 'ApaNova',         unit: 'mc',  hdr: 'bg-blue-100 text-blue-900',   sup: 'text-blue-600',   val: 'text-blue-900',   idx: 'text-blue-400',   dot: 'bg-blue-400'   },
  { key: 'gunoi',   title: 'GUNOI\nMENAJER',    supplier: 'Urban',           unit: 'pub', hdr: 'bg-green-100 text-green-900', sup: 'text-green-600',  val: 'text-green-900',  idx: 'text-green-400',  dot: 'bg-green-400'  },
  { key: 'internet',title: 'INTERNET\n/ TV',    supplier: 'Digi',            unit: 'Net/TV', hdr: 'bg-indigo-100 text-indigo-900', sup: 'text-indigo-600', val: 'text-indigo-900', idx: 'text-indigo-400', dot: 'bg-indigo-400' },
]

type UtilityKey = 'energie' | 'gaze' | 'apa' | 'gunoi' | 'internet'
type Row = { luna: number; [key: string]: string | number | null }

function InlineInput({ value, onCommit, className, placeholder }: {
  value: string; onCommit: (v: string) => void; className?: string; placeholder?: string
}) {
  const [draft, setDraft] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.select() }, [])
  return (
    <input
      ref={ref}
      value={draft}
      placeholder={placeholder}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => onCommit(draft)}
      onKeyDown={e => { if (e.key === 'Enter') { onCommit(draft); (e.target as HTMLInputElement).blur() } if (e.key === 'Escape') onCommit(value) }}
      className={`w-full text-center outline-none border-b border-blue-400 bg-transparent ${className}`}
    />
  )
}

export default function CasaBelvederePage() {
  const currentYear = new Date().getFullYear()
  const [an, setAn] = useState(currentYear)
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [unauthorized, setUnauthorized] = useState(false)
  const [editingCell, setEditingCell] = useState<{ luna: number; field: string } | null>(null)
  const [included, setIncluded] = useState<Record<UtilityKey, boolean>>({
    energie: true, gaze: true, apa: true, gunoi: true, internet: true,
  })

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
    setEditingCell(null)
    await fetch('/api/casa-belvedere', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ an, luna, field, value }),
    })
    setRows(prev => ({
      ...prev,
      [luna]: { ...(prev[luna] ?? { luna }), [field]: value === '' ? null : value },
    }))
    setSaving(s => { const n = new Set(s); n.delete(key); return n })
  }, [an])

  if (unauthorized) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <h1 className="text-xl font-bold text-gray-700">Acces restricționat</h1>
        <a href="/admin" className="mt-4 inline-block text-sm text-blue-600 hover:underline">→ Admin login</a>
      </div>
    </div>
  )

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  // Totals per utility (for footer row)
  const utilityTotals = UTILITIES.reduce((acc, u) => {
    acc[u.key] = MONTHS.reduce((sum, m) => {
      const v = parseFloat(String(rows[m.nr]?.[`${u.key}_valoare`] ?? ''))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotalLei = UTILITIES.reduce((sum, u) => included[u.key as UtilityKey] ? sum + utilityTotals[u.key] : sum, 0)
  const grandTotalEur = grandTotalLei / 5.25

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="text-3xl">🏠</span>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
                Casa Belvedere Drugan
              </h1>
            </div>
            <p className="text-sm text-gray-400 ml-12">
              Str. Vasile Burla nr. 28, Sector 6, București — Cheltuieli utilități
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <span className="text-xs text-gray-400">An:</span>
            {years.map(y => (
              <button key={y} onClick={() => setAn(y)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${an === y ? 'bg-gray-900 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse" style={{ minWidth: 620 }}>
              <thead>
                {/* Row 1: utility title + checkbox */}
                <tr>
                  <th className="bg-gray-50 border-b border-r border-gray-200 px-4 py-3 text-left w-28">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">LUNA · {an}</span>
                  </th>
                  {UTILITIES.map(u => (
                    <th key={u.key}
                      className={`${u.hdr} border-b border-r border-white/60 px-3 py-3 text-center transition-opacity ${!included[u.key as UtilityKey] ? 'opacity-40' : ''}`}>
                      <div className="text-[11px] font-bold tracking-wide leading-tight whitespace-pre-line mb-1.5">{u.title}</div>
                      <label className="flex items-center justify-center gap-1 cursor-pointer select-none">
                        <input type="checkbox" checked={included[u.key as UtilityKey]}
                          onChange={() => setIncluded(p => ({ ...p, [u.key as UtilityKey]: !p[u.key as UtilityKey] }))}
                          className="w-3 h-3 accent-gray-700 cursor-pointer" />
                        <span className="text-[9px] font-normal opacity-70">{included[u.key as UtilityKey] ? 'în total' : 'exclus'}</span>
                      </label>
                    </th>
                  ))}
                </tr>
                {/* Row 2: supplier */}
                <tr>
                  <th className="bg-gray-50 border-b border-r border-gray-100 px-4 py-1.5"></th>
                  {UTILITIES.map(u => (
                    <th key={u.key}
                      className={`border-b border-r border-gray-100 px-3 py-1.5 text-center bg-white transition-opacity ${!included[u.key as UtilityKey] ? 'opacity-40' : ''}`}>
                      <span className={`text-[11px] font-semibold ${u.sup}`}>{u.supplier}</span>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-gray-400 text-sm">
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
                    <tr key={m.nr} className={`hover:bg-slate-50 transition-colors ${isEven ? 'bg-gray-50/50' : ''}`}>
                      {/* Month cell */}
                      <td className="border-r border-gray-100 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg leading-none">{m.icon}</span>
                          <div>
                            <div className={`text-sm font-black tracking-wide ${SEASON_CLS[m.season]}`}>{m.abbr}</div>
                            <div className="text-[10px] text-gray-400 leading-tight">{m.label}</div>
                          </div>
                        </div>
                      </td>

                      {/* Utility cells */}
                      {UTILITIES.map(u => {
                        const vField = `${u.key}_valoare`
                        const iField = `${u.key}_index`
                        const valRaw = String(row[vField] ?? '')
                        const idxRaw = String(row[iField] ?? '')
                        const editingV = editingCell?.luna === m.nr && editingCell?.field === vField
                        const editingI = editingCell?.luna === m.nr && editingCell?.field === iField
                        const isSaving = saving.has(`${m.nr}-${vField}`) || saving.has(`${m.nr}-${iField}`)

                        return (
                          <td key={u.key}
                            className={`border-r border-gray-100 px-2 py-1.5 text-center transition-opacity ${!included[u.key as UtilityKey] ? 'opacity-30' : ''} ${isSaving ? 'opacity-60' : ''}`}>

                            {/* Value row */}
                            <div className="h-7 flex items-center justify-center"
                              onClick={() => !editingV && setEditingCell({ luna: m.nr, field: vField })}>
                              {editingV ? (
                                <InlineInput value={valRaw}
                                  onCommit={v => handleSave(m.nr, vField, v)}
                                  className={`text-base font-bold w-20 ${u.val}`}
                                  placeholder="0.00" />
                              ) : valRaw ? (
                                <span className={`text-base font-bold cursor-pointer ${u.val}`}>
                                  {valRaw} <span className="text-xs font-normal text-gray-400">lei</span>
                                </span>
                              ) : (
                                <span className="text-gray-200 text-sm cursor-pointer hover:text-gray-400 transition-colors">—</span>
                              )}
                            </div>

                            {/* Index row */}
                            <div className="h-5 flex items-center justify-center"
                              onClick={() => !editingI && setEditingCell({ luna: m.nr, field: iField })}>
                              {editingI ? (
                                <InlineInput value={idxRaw}
                                  onCommit={v => handleSave(m.nr, iField, v)}
                                  className={`text-xs w-20 ${u.idx}`}
                                  placeholder="index" />
                              ) : idxRaw ? (
                                <span className={`text-xs cursor-pointer ${u.idx}`}>
                                  {idxRaw} <span className="opacity-70">{u.unit}</span>
                                </span>
                              ) : (
                                <span className="text-gray-200 text-xs cursor-pointer hover:text-gray-300 transition-colors">· · ·</span>
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}

                {/* TOTAL footer row */}
                {!loading && (
                  <tr className="bg-gray-900 border-t-2 border-gray-700">
                    <td className="px-3 py-3">
                      <div className="text-xs font-black text-white tracking-widest uppercase">TOTAL</div>
                      <div className="text-[10px] text-gray-400 font-medium">{an}</div>
                    </td>
                    {UTILITIES.map(u => {
                      const total = utilityTotals[u.key]
                      const hasData = total > 0
                      return (
                        <td key={u.key}
                          className={`px-2 py-3 text-center transition-opacity ${!included[u.key as UtilityKey] ? 'opacity-30' : ''}`}>
                          {hasData ? (
                            <span className="text-base font-black text-white">
                              {total.toFixed(0)} <span className="text-xs font-normal text-gray-400">lei</span>
                            </span>
                          ) : (
                            <span className="text-gray-600 text-sm">—</span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Grand total banner */}
          {!loading && grandTotalLei > 0 && (
            <div className="bg-gray-800 px-6 py-4 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-400 uppercase tracking-widest">Total inclus în calcul · {an}</span>
                {!UTILITIES.every(u => included[u.key as UtilityKey]) && (
                  <span className="ml-2 text-[10px] text-gray-500">
                    ({UTILITIES.filter(u => !included[u.key as UtilityKey]).map(u => u.supplier).join(', ')} exclus)
                  </span>
                )}
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-2xl font-black text-white">{grandTotalLei.toFixed(0)} <span className="text-sm font-normal text-gray-400">lei</span></div>
                </div>
                <div className="text-right border-l border-gray-600 pl-6">
                  <div className="text-lg font-black text-gray-300">{grandTotalEur.toFixed(0)} <span className="text-sm font-normal text-gray-500">eur</span></div>
                  <div className="text-[10px] text-gray-600">1 EUR = 5,25 lei</div>
                </div>
              </div>
            </div>
          )}

          <div className="px-6 py-2.5 bg-gray-50 border-t border-gray-100">
            <p className="text-xs text-gray-400">Click pe valoare sau index pentru a edita · Enter sau click în afară pentru a salva</p>
          </div>
        </div>
      </div>
    </div>
  )
}
