'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

/* ─── constants ──────────────────────────────────────────────────── */

const MONTHS = [
  { nr: 1,  abbr: 'IAN', label: 'Ianuarie',   season: 'winter' },
  { nr: 2,  abbr: 'FEB', label: 'Februarie',  season: 'winter' },
  { nr: 3,  abbr: 'MAR', label: 'Martie',     season: 'spring' },
  { nr: 4,  abbr: 'APR', label: 'Aprilie',    season: 'spring' },
  { nr: 5,  abbr: 'MAI', label: 'Mai',        season: 'spring' },
  { nr: 6,  abbr: 'IUN', label: 'Iunie',      season: 'summer' },
  { nr: 7,  abbr: 'IUL', label: 'Iulie',      season: 'summer' },
  { nr: 8,  abbr: 'AUG', label: 'August',     season: 'summer' },
  { nr: 9,  abbr: 'SEP', label: 'Septembrie', season: 'autumn' },
  { nr: 10, abbr: 'OCT', label: 'Octombrie',  season: 'autumn' },
  { nr: 11, abbr: 'NOI', label: 'Noiembrie',  season: 'autumn' },
  { nr: 12, abbr: 'DEC', label: 'Decembrie',  season: 'winter' },
]

const SEASON_COLOR: Record<string, string> = {
  winter: '#1F5FFF',
  spring: '#5DB04A',
  summer: '#E0A800',
  autumn: '#B65A33',
}

// SVG season icons
function SeasonIcon({ season }: { season: string }) {
  const color = SEASON_COLOR[season]
  if (season === 'winter') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/>
      <line x1="5" y1="5" x2="19" y2="19"/><line x1="19" y1="5" x2="5" y2="19"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
      <circle cx="12" cy="2" r="1" fill={color}/><circle cx="12" cy="22" r="1" fill={color}/>
      <circle cx="2" cy="12" r="1" fill={color}/><circle cx="22" cy="12" r="1" fill={color}/>
    </svg>
  )
  if (season === 'spring') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M12 22V12"/><path d="M12 12C12 7 8 4 4 5c0 4 3 7 8 7z" fill={color} fillOpacity=".25"/>
      <path d="M12 12C12 7 16 4 20 5c0 4-3 7-8 7z" fill={color} fillOpacity=".25"/>
    </svg>
  )
  if (season === 'summer') return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" fill={color} fillOpacity=".3"/>
      <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
      <line x1="5.6" y1="5.6" x2="7.8" y2="7.8"/><line x1="16.2" y1="16.2" x2="18.4" y2="18.4"/>
      <line x1="18.4" y1="5.6" x2="16.2" y2="7.8"/><line x1="7.8" y1="16.2" x2="5.6" y2="18.4"/>
    </svg>
  )
  // autumn
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <path d="M21 3C9 3 3 12 3 21c3-1 6-3 8-6 0 5-2 8-5 9 9 0 15-6 15-21z" fill={color} fillOpacity=".25"/>
    </svg>
  )
}

const UTILITIES = [
  {
    key: 'energie', title: 'ENERGIE ELECTRICĂ', supplier: 'Hidroelectrica', unit: 'kWh',
    bg: '#E3D6F6', cellBg: '#F4F0FD', text: '#4A3284', accent: '#7C5BD0',
  },
  {
    key: 'gaze', title: 'GAZE NATURALE', supplier: 'Engie', unit: 'mc',
    bg: '#CDEAE5', cellBg: '#E8F7F4', text: '#1F6F66', accent: '#2A9D8F',
  },
  {
    key: 'apa', title: 'APĂ RECE', supplier: 'ApaNova', unit: 'mc',
    bg: '#D2E3F7', cellBg: '#EBF3FC', text: '#275189', accent: '#3E81D6',
  },
  {
    key: 'gunoi', title: 'GUNOI MENAJER', supplier: 'Urban', unit: '4 pers.',
    bg: '#D4EAD7', cellBg: '#EAF5EC', text: '#2E6B3C', accent: '#4CA45E',
  },
  {
    key: 'internet', title: 'INTERNET / TV', supplier: 'Digi', unit: '1 Gbps',
    bg: '#D6DAEC', cellBg: '#ECEEF6', text: '#2C3656', accent: '#46557F',
  },
]

type UtilityKey = 'energie' | 'gaze' | 'apa' | 'gunoi' | 'internet'
type Row = { luna: number; [key: string]: string | number | null }

/* ─── inline input ───────────────────────────────────────────────── */

function InlineInput({ value, onCommit, mono, style, placeholder }: {
  value: string; onCommit: (v: string) => void
  mono?: boolean; style?: React.CSSProperties; placeholder?: string
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
      onKeyDown={e => {
        if (e.key === 'Enter') { onCommit(draft); (e.target as HTMLInputElement).blur() }
        if (e.key === 'Escape') { onCommit(value); (e.target as HTMLInputElement).blur() }
      }}
      style={{
        fontFamily: mono ? "'JetBrains Mono', monospace" : "'Manrope', sans-serif",
        width: '100%', textAlign: 'center', outline: 'none', background: 'transparent',
        borderBottom: '1.5px solid rgba(0,0,0,0.25)', ...style,
      }}
    />
  )
}

/* ─── page ───────────────────────────────────────────────────────── */

export default function CasaBelvederePage() {
  const currentYear = new Date().getFullYear()
  const [an, setAn] = useState(currentYear)
  const [rows, setRows] = useState<Record<number, Row>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [unauthorized, setUnauthorized] = useState(false)
  const [editingCell, setEditingCell] = useState<{ luna: number; field: string } | null>(null)
  const [showIndex, setShowIndex] = useState(true)
  const [copied, setCopied] = useState(false)
  const [included, setIncluded] = useState<Record<UtilityKey, boolean>>({
    energie: true, gaze: true, apa: true, gunoi: true, internet: true,
  })

  const configLink = typeof window !== 'undefined'
    ? `${window.location.origin}/casa-belvedere`
    : '/casa-belvedere'

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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4F1EB' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontFamily: "'Manrope', sans-serif", color: '#2A2722' }}>Acces restricționat</h1>
        <a href="/admin" style={{ color: '#7C5BD0', fontSize: 14 }}>→ Admin login</a>
      </div>
    </div>
  )

  const years = Array.from({ length: 5 }, (_, i) => currentYear - 1 + i)

  // Totals per utility (all months)
  const utilityTotals = UTILITIES.reduce((acc, u) => {
    acc[u.key] = MONTHS.reduce((sum, m) => {
      const v = parseFloat(String(rows[m.nr]?.[`${u.key}_valoare`] ?? ''))
      return sum + (isNaN(v) ? 0 : v)
    }, 0)
    return acc
  }, {} as Record<string, number>)

  const grandTotalLei = UTILITIES.reduce((sum, u) =>
    included[u.key as UtilityKey] ? sum + utilityTotals[u.key] : sum, 0)
  const grandTotalEur = grandTotalLei / 5.25

  const pageStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: '#F4F1EB',
    padding: '32px 24px',
    fontFamily: "'Manrope', sans-serif",
    color: '#2A2722',
  }

  const cardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: 20,
    border: '1px solid #E6E1D8',
    overflow: 'hidden',
  }

  const monoFont = "'JetBrains Mono', monospace"

  return (
    <>
      {/* Load fonts */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap');
      `}</style>

      <div style={pageStyle}>
        <div style={{ maxWidth: 980, margin: '0 auto' }}>

          {/* ── Header (unchanged) ── */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                <span style={{ fontSize: 28 }}>🏠</span>
                <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: -0.5 }}>
                  Casa Belvedere Drugan
                </h1>
              </div>
              <p style={{ margin: 0, marginLeft: 40, fontSize: 13, color: '#8C8680' }}>
                Str. Vasile Burla nr. 28, Sector 6, București — Cheltuieli utilități
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <span style={{ fontSize: 12, color: '#8C8680' }}>An:</span>
              {years.map(y => (
                <button key={y} onClick={() => setAn(y)} style={{
                  padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                  fontFamily: "'Manrope', sans-serif", cursor: 'pointer', transition: 'all .15s',
                  background: an === y ? '#2A2722' : '#fff',
                  color: an === y ? '#fff' : '#2A2722',
                  border: an === y ? '1px solid #2A2722' : '1px solid #E6E1D8',
                }}>
                  {y}
                </button>
              ))}
            </div>
          </div>

          {/* ── Table card ── */}
          <div style={cardStyle}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  {/* Row 1: column titles */}
                  <tr>
                    <th style={{ width: 108, background: '#FAFAF8', borderBottom: '1px solid #E6E1D8', borderRight: '1px solid #E6E1D8', padding: '14px 16px', textAlign: 'left' }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: '#ABA69E', letterSpacing: 1, textTransform: 'uppercase' }}>
                        LUNA · {an}
                      </span>
                    </th>
                    {UTILITIES.map(u => (
                      <th key={u.key} style={{
                        background: u.bg, borderBottom: '1px solid #E6E1D8', borderRight: '1px solid #E6E1D8',
                        padding: '12px 10px 8px', textAlign: 'center',
                        opacity: included[u.key as UtilityKey] ? 1 : 0.4, transition: 'opacity .2s',
                      }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: u.text, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: 1.4, marginBottom: 2 }}>
                          {u.title}
                        </div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: u.accent, marginBottom: 6 }}>
                          {u.supplier}
                        </div>
                        {/* include/exclude checkbox */}
                        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, cursor: 'pointer' }}>
                          <input type="checkbox" checked={included[u.key as UtilityKey]}
                            onChange={() => setIncluded(p => ({ ...p, [u.key as UtilityKey]: !p[u.key as UtilityKey] }))}
                            style={{ width: 11, height: 11, accentColor: u.accent, cursor: 'pointer' }} />
                          <span style={{ fontSize: 9, color: u.text, opacity: 0.7 }}>
                            {included[u.key as UtilityKey] ? 'în total' : 'exclus'}
                          </span>
                        </label>
                      </th>
                    ))}
                    <th style={{
                      width: 116, background: '#FAFAF8', borderBottom: '1px solid #E6E1D8',
                      padding: '14px 12px', textAlign: 'center',
                    }}>
                      <span style={{ fontSize: 10, fontWeight: 800, color: '#2A2722', letterSpacing: 1, textTransform: 'uppercase' }}>
                        TOTAL
                      </span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '56px 0', color: '#ABA69E', fontSize: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                          <div style={{ width: 16, height: 16, border: '2px solid #D6DAEC', borderTopColor: '#7C5BD0', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          Se încarcă datele…
                        </div>
                        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
                      </td>
                    </tr>
                  ) : MONTHS.map((m, idx) => {
                    const row = rows[m.nr] ?? {}
                    const rowTotalLei = UTILITIES.reduce((sum, u) => {
                      if (!included[u.key as UtilityKey]) return sum
                      const v = parseFloat(String(row[`${u.key}_valoare`] ?? ''))
                      return sum + (isNaN(v) ? 0 : v)
                    }, 0)
                    const rowHasTotal = UTILITIES.some(u => included[u.key as UtilityKey] && row[`${u.key}_valoare`] != null && row[`${u.key}_valoare`] !== '')
                    const rowTotalEur = rowTotalLei / 5.25
                    const rowBg = idx % 2 === 1 ? '#FDFCFA' : '#fff'

                    return (
                      <tr key={m.nr} style={{ background: rowBg }}>
                        {/* Month cell */}
                        <td style={{ borderBottom: '1px solid #F0EDE8', borderRight: '1px solid #E6E1D8', padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <SeasonIcon season={m.season} />
                            <div>
                              <div style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 13, color: SEASON_COLOR[m.season], letterSpacing: 0.5 }}>
                                {m.abbr}
                              </div>
                              <div style={{ fontSize: 10, color: '#ABA69E', marginTop: 1 }}>{m.label}</div>
                            </div>
                          </div>
                        </td>

                        {/* Utility cells */}
                        {UTILITIES.map(u => {
                          const vField = `${u.key}_valoare`
                          const iField = `${u.key}_index`
                          const valRaw = String(row[vField] ?? '')
                          const idxRaw = String(row[iField] ?? '')
                          const editV = editingCell?.luna === m.nr && editingCell?.field === vField
                          const editI = editingCell?.luna === m.nr && editingCell?.field === iField
                          const isSaving = saving.has(`${m.nr}-${vField}`) || saving.has(`${m.nr}-${iField}`)

                          return (
                            <td key={u.key} style={{
                              background: u.cellBg, borderBottom: '1px solid rgba(0,0,0,0.06)',
                              borderRight: '1px solid #E6E1D8', padding: '8px 10px', textAlign: 'center',
                              opacity: (!included[u.key as UtilityKey] ? 0.3 : isSaving ? 0.6 : 1),
                              transition: 'opacity .2s',
                            }}>
                              {/* Value */}
                              <div style={{ minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => !editV && !editI && setEditingCell({ luna: m.nr, field: vField })}>
                                {editV ? (
                                  <InlineInput value={valRaw} onCommit={v => handleSave(m.nr, vField, v)}
                                    mono placeholder="0.00"
                                    style={{ fontSize: 15, fontWeight: 700, color: u.text }} />
                                ) : valRaw ? (
                                  <span style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: u.text, cursor: 'pointer' }}>
                                    {valRaw}&nbsp;<span style={{ fontSize: 10, fontWeight: 400, color: u.accent }}>lei</span>
                                  </span>
                                ) : (
                                  <span onClick={() => setEditingCell({ luna: m.nr, field: vField })}
                                    style={{ color: '#D4D0CA', fontSize: 14, cursor: 'pointer' }}>—</span>
                                )}
                              </div>

                              {/* Index */}
                              {showIndex && (
                                <div style={{ minHeight: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                  onClick={() => !editV && !editI && setEditingCell({ luna: m.nr, field: iField })}>
                                  {editI ? (
                                    <InlineInput value={idxRaw} onCommit={v => handleSave(m.nr, iField, v)}
                                      mono placeholder="index"
                                      style={{ fontSize: 11, color: u.accent }} />
                                  ) : idxRaw ? (
                                    <span style={{ fontFamily: monoFont, fontSize: 11, color: u.accent, cursor: 'pointer' }}>
                                      {idxRaw}&nbsp;<span style={{ opacity: 0.75 }}>{u.unit}</span>
                                    </span>
                                  ) : (
                                    <span onClick={() => setEditingCell({ luna: m.nr, field: iField })}
                                      style={{ color: '#D4D0CA', fontSize: 11, cursor: 'pointer', letterSpacing: 2 }}>···</span>
                                  )}
                                </div>
                              )}
                            </td>
                          )
                        })}

                        {/* Total column */}
                        <td style={{ borderBottom: '1px solid #F0EDE8', padding: '8px 12px', textAlign: 'center', background: rowBg }}>
                          {rowHasTotal ? (
                            <>
                              <div style={{ fontFamily: monoFont, fontSize: 15, fontWeight: 700, color: '#2A2722' }}>
                                {rowTotalLei.toFixed(0)}&nbsp;<span style={{ fontSize: 10, fontWeight: 400, color: '#ABA69E' }}>lei</span>
                              </div>
                              <div style={{ fontFamily: monoFont, fontSize: 11, color: '#8C8680', marginTop: 2 }}>
                                {rowTotalEur.toFixed(2)}&nbsp;<span style={{ opacity: 0.75 }}>eur</span>
                              </div>
                            </>
                          ) : (
                            <span style={{ color: '#D4D0CA', fontSize: 14 }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {/* Footer / TOTAL row */}
                  {!loading && (
                    <tr style={{ background: '#2A2722' }}>
                      <td style={{ padding: '14px 16px' }}>
                        <div style={{ fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                          TOTAL
                        </div>
                        <div style={{ fontSize: 10, color: '#6B6560', marginTop: 2 }}>{an}</div>
                      </td>
                      {UTILITIES.map(u => {
                        const total = utilityTotals[u.key]
                        return (
                          <td key={u.key} style={{
                            padding: '14px 10px', textAlign: 'center',
                            opacity: included[u.key as UtilityKey] ? 1 : 0.25, transition: 'opacity .2s',
                          }}>
                            {total > 0 ? (
                              <span style={{ fontFamily: monoFont, fontSize: 14, fontWeight: 700, color: '#fff' }}>
                                {total.toFixed(0)}&nbsp;<span style={{ fontSize: 10, fontWeight: 400, color: '#6B6560' }}>lei</span>
                              </span>
                            ) : (
                              <span style={{ color: '#4A4540', fontSize: 14 }}>—</span>
                            )}
                          </td>
                        )
                      })}
                      {/* Grand total cell */}
                      <td style={{ padding: '14px 12px', textAlign: 'center', background: '#1C1A16', borderRadius: '0 0 20px 0' }}>
                        {grandTotalLei > 0 ? (
                          <>
                            <div style={{ fontFamily: monoFont, fontSize: 16, fontWeight: 800, color: '#fff' }}>
                              {grandTotalLei.toFixed(0)}&nbsp;<span style={{ fontSize: 11, fontWeight: 400, color: '#6B6560' }}>lei</span>
                            </div>
                            <div style={{ fontFamily: monoFont, fontSize: 11, color: '#6B6560', marginTop: 3 }}>
                              {grandTotalEur.toFixed(2)}&nbsp;<span style={{ opacity: 0.75 }}>eur</span>
                            </div>
                          </>
                        ) : (
                          <span style={{ color: '#4A4540', fontSize: 14 }}>—</span>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Configurator card ── */}
          <div style={{ ...cardStyle, marginTop: 20, borderRadius: 16 }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EDE8' }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#ABA69E', letterSpacing: 1.5, textTransform: 'uppercase' }}>
                Configurator
              </span>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 0 }}>
              {/* Link field */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#8C8680', marginBottom: 6 }}>Link dashboard CBD</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input readOnly value={configLink} style={{
                    flex: 1, fontFamily: monoFont, fontSize: 12, color: '#7C5BD0',
                    background: '#F9F7FE', border: '1px solid #E3D6F6', borderRadius: 8,
                    padding: '8px 12px', outline: 'none',
                  }} />
                  <button onClick={() => { navigator.clipboard.writeText(configLink); setCopied(true); setTimeout(() => setCopied(false), 1800) }}
                    style={{
                      fontFamily: "'Manrope', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                      padding: '8px 16px', borderRadius: 8, cursor: 'pointer', border: 'none',
                      background: copied ? '#5DB04A' : '#7C5BD0', color: '#fff', transition: 'background .2s', whiteSpace: 'nowrap',
                    }}>
                    {copied ? '✓ COPIAT' : 'COPIAZĂ'}
                  </button>
                </div>
              </div>

              {/* Settings rows */}
              {[
                { label: 'An afișat', value: String(an), valueColor: '#2A2722' },
                { label: 'Monedă', value: 'RON · lei', valueColor: '#2A2722' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #F0EDE8' }}>
                  <span style={{ fontSize: 13, color: '#8C8680' }}>{s.label}</span>
                  <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 600, color: s.valueColor }}>→ {s.value}</span>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderTop: '1px solid #F0EDE8' }}>
                <span style={{ fontSize: 13, color: '#8C8680' }}>Coloană index</span>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  <span style={{ fontFamily: monoFont, fontSize: 13, fontWeight: 600, color: showIndex ? '#4CA45E' : '#ABA69E' }}>
                    → {showIndex ? 'Activă' : 'Ascunsă'}
                  </span>
                  <div onClick={() => setShowIndex(v => !v)} style={{
                    width: 34, height: 20, borderRadius: 10, cursor: 'pointer', transition: 'background .2s',
                    background: showIndex ? '#4CA45E' : '#D4D0CA', position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, left: showIndex ? 17 : 3, width: 14, height: 14,
                      background: '#fff', borderRadius: '50%', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
                    }} />
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: 16, fontSize: 11, color: '#C8C3BC' }}>
            Click pe orice celulă pentru editare · Enter sau click în afară pentru a salva
          </div>
        </div>
      </div>
    </>
  )
}
