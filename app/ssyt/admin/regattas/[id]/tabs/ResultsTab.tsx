'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Trophy, Trash2, X, Save, ClipboardPaste, ListOrdered } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

type ParsedRow = {
  place: number | null
  raceScores: number[]
  total: number
  net: number
  teamId: string | null
  teamName: string | null
}

// Parsează clasamentul general lipit (tab/space separat).
// Scorurile (R1..Rn, Total, Net) sunt zecimale "1.0" — locul și nr. velă sunt întregi, deci se ignoră.
function parseClassification(text: string, teams: any[]): { rows: ParsedRow[]; fleetSize: number; raceCount: number } {
  const matchers = teams.map((t) => ({
    id: t.id,
    name: t.name,
    names: [t.name, t.boat?.name, t.short_name].filter(Boolean).map((s: string) => s.toLowerCase()),
  }))
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const rows: ParsedRow[] = []
  let fleetSize = 0
  for (const line of lines) {
    const decimals = (line.match(/\d+\.\d+/g) || []).map(Number)
    if (decimals.length < 3) continue // nu e rând de date (header etc.)
    fleetSize++
    const placeMatch = line.match(/^(\d+)\b/)
    const place = placeMatch ? Number(placeMatch[1]) : null
    const net = decimals[decimals.length - 1]
    const total = decimals[decimals.length - 2]
    const raceScores = decimals.slice(0, decimals.length - 2)
    let teamId: string | null = null
    let teamName: string | null = null
    for (const m of matchers) {
      if (m.names.some((n: string) => new RegExp(`\\b${escapeRegex(n)}\\b`, 'i').test(line))) {
        teamId = m.id
        teamName = m.name
        break
      }
    }
    rows.push({ place, raceScores, total, net, teamId, teamName })
  }
  const raceCount = rows.reduce((mx, r) => Math.max(mx, r.raceScores.length), 0)
  return { rows, fleetSize, raceCount }
}

export default function ResultsTab({
  regattaId, results, teams, onChange,
}: {
  regattaId: string; results: any[]; teams: any[]; onChange: () => void
}) {
  const [showNew, setShowNew] = useState(false)

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const { error } = await supabase.from('ssyt_results').update({ [field]: cleanValue }).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function toggleFlag(id: string, field: 'is_dnf' | 'is_dns' | 'is_dsq' | 'is_dnc', current: boolean) {
    const { error } = await supabase.from('ssyt_results').update({ [field]: !current }).eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest rezultat?')) return
    const { error } = await supabase.from('ssyt_results').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  // Teams care nu au inca rezultat
  const teamsWithResult = new Set(results.map((r: any) => r.team_id))
  const teamsToAdd = teams.filter((t: any) => !teamsWithResult.has(t.id))

  return (
    <div className="space-y-8">
      <ImportSection regattaId={regattaId} teams={teams} onChange={onChange} />

      <OurBoatsClassification results={results} />

      {/* Editor manual (oficial + SSYT intern) */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500">Editor manual rezultate</h3>
          {teamsToAdd.length > 0 && (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
              <Plus size={14} /> Adaugă rezultat
            </button>
          )}
        </div>

        {showNew && <NewResultForm regattaId={regattaId} teams={teamsToAdd} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />}

        {results.length === 0 ? (
          <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            <Trophy size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Niciun rezultat înregistrat.</p>
            <p className="text-xs text-gray-400 mt-1">Importă clasamentul mai sus, sau adaugă manual.</p>
          </div>
        ) : (
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <table className="w-full text-sm">
              <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500" colSpan={3}>Oficial</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: '#FF6B35' }} colSpan={2}>SSYT intern</th>
                  <th className="text-center px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                  <th className="w-8"></th>
                </tr>
                <tr style={{ background: '#f8f9fa', borderTop: '1px solid #f3f4f6' }}>
                  <th></th>
                  <th className="text-center px-2 py-1 text-[10px] uppercase text-gray-400">Loc</th>
                  <th className="text-center px-2 py-1 text-[10px] uppercase text-gray-400">Clasă</th>
                  <th className="text-center px-2 py-1 text-[10px] uppercase text-gray-400">Pts</th>
                  <th className="text-center px-2 py-1 text-[10px] uppercase text-gray-400">Loc</th>
                  <th className="text-center px-2 py-1 text-[10px] uppercase text-gray-400">Pts</th>
                  <th></th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r: any) => (
                  <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                    <td className="px-4 py-3">
                      <Link href={`/ssyt/admin/teams/${r.team?.id}`} className="inline-flex items-center gap-2 hover:underline">
                        <span className="w-3 h-3 rounded-full" style={{ background: r.team?.color_primary || '#4A5568' }}></span>
                        <span className="font-medium" style={{ color: '#0a1628' }}>{r.team?.name}</span>
                      </Link>
                    </td>
                    <td className="px-2 py-3 text-center font-semibold" style={{ color: '#0a1628' }}>
                      <EditableField value={r.official_place} onSave={(v) => updateField(r.id, 'official_place', v)} type="number" placeholder="—" />
                    </td>
                    <td className="px-2 py-3 text-center text-xs text-gray-600">
                      <EditableField value={r.official_class} onSave={(v) => updateField(r.id, 'official_class', v)} placeholder="ORC..." />
                    </td>
                    <td className="px-2 py-3 text-center text-xs text-gray-600">
                      <EditableField value={r.official_points} onSave={(v) => updateField(r.id, 'official_points', v)} type="number" placeholder="—" />
                    </td>
                    <td className="px-2 py-3 text-center font-semibold" style={{ color: '#FF6B35' }}>
                      <EditableField value={r.ssyt_internal_place} onSave={(v) => updateField(r.id, 'ssyt_internal_place', v)} type="number" placeholder="—" />
                    </td>
                    <td className="px-2 py-3 text-center text-xs font-medium" style={{ color: '#FF6B35' }}>
                      <EditableField value={r.ssyt_internal_points} onSave={(v) => updateField(r.id, 'ssyt_internal_points', v)} type="number" placeholder="—" />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-1">
                        <FlagButton label="DNF" active={r.is_dnf} onClick={() => toggleFlag(r.id, 'is_dnf', r.is_dnf)} />
                        <FlagButton label="DNS" active={r.is_dns} onClick={() => toggleFlag(r.id, 'is_dns', r.is_dns)} />
                        <FlagButton label="DSQ" active={r.is_dsq} onClick={() => toggleFlag(r.id, 'is_dsq', r.is_dsq)} />
                      </div>
                    </td>
                    <td className="pr-4">
                      <button onClick={() => remove(r.id)} className="text-gray-300 hover:text-red-600 p-1"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function ImportSection({ regattaId, teams, onChange }: { regattaId: string; teams: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parsed = useMemo(() => (text.trim() ? parseClassification(text, teams) : null), [text, teams])
  const matched = parsed ? parsed.rows.filter((r) => r.teamId) : []

  async function doImport() {
    if (matched.length === 0) return
    setSaving(true)
    setError(null)
    const payload = matched.map((r) => ({
      regatta_id: regattaId,
      team_id: r.teamId,
      race_scores: r.raceScores,
      total_points: r.total,
      net_points: r.net,
      official_place: r.place,
      official_total_boats: parsed!.fleetSize,
      published_at: new Date().toISOString(),
    }))
    const { error: err } = await supabase
      .from('ssyt_results')
      .upsert(payload, { onConflict: 'regatta_id,team_id' })
    setSaving(false)
    if (err) { setError(err.message); return }
    setText('')
    setOpen(false)
    onChange()
  }

  return (
    <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <ClipboardPaste size={13} /> Import clasament general
        </h3>
        <button onClick={() => setOpen((o) => !o)} className="text-xs font-medium" style={{ color: '#FF6B35' }}>
          {open ? 'Închide' : 'Deschide import'}
        </button>
      </div>

      {open && (
        <div className="mt-4">
          <p className="text-xs text-gray-500 mb-2">
            Lipește tabelul clasamentului general (din softul de regatta / PDF). Detectăm automat bărcile noastre după nume
            și extragem scorurile per cursă (R1, R2…), Total și Net. Scorurile trebuie să aibă zecimale (ex. <code>1.0</code>).
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder={'1\tROU 998\tHope\tMihnea SANDU\t...\t1.0\t1.0\t1.0\t1.0\t1.0\t\t5.0\t4.0\n...'}
            className="w-full px-3 py-2 border rounded-md text-xs font-mono resize-y"
            style={{ borderColor: '#d1d5db' }}
          />

          {parsed && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-2">
                Detectat: <strong>{parsed.fleetSize}</strong> bărci în flotă, <strong>{parsed.raceCount}</strong> curse.
                Bărcile noastre găsite: <strong>{matched.length}</strong> din {teams.length}.
              </div>
              {matched.length > 0 ? (
                <div className="rounded-lg overflow-hidden mb-3" style={{ border: '1px solid #e5e7eb' }}>
                  <table className="w-full text-xs">
                    <thead style={{ background: '#f8f9fa' }}>
                      <tr>
                        <th className="text-left px-3 py-2 text-[10px] uppercase text-gray-400">Echipă</th>
                        <th className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">Loc flotă</th>
                        {Array.from({ length: parsed.raceCount }, (_, i) => (
                          <th key={i} className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">R{i + 1}</th>
                        ))}
                        <th className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">Total</th>
                        <th className="text-center px-2 py-2 text-[10px] uppercase font-semibold" style={{ color: '#FF6B35' }}>Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {matched.map((r, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #f3f4f6' }}>
                          <td className="px-3 py-2 font-medium" style={{ color: '#0a1628' }}>{r.teamName}</td>
                          <td className="px-2 py-2 text-center text-gray-600">{r.place ?? '—'}</td>
                          {Array.from({ length: parsed.raceCount }, (_, i) => (
                            <td key={i} className="px-2 py-2 text-center text-gray-600">{r.raceScores[i] ?? '—'}</td>
                          ))}
                          <td className="px-2 py-2 text-center text-gray-600">{r.total}</td>
                          <td className="px-2 py-2 text-center font-semibold" style={{ color: '#FF6B35' }}>{r.net}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-amber-600 mb-3">Nicio barcă de-a noastră găsită în text. Verifică numele echipelor/bărcilor.</p>
              )}

              <button
                onClick={doImport}
                disabled={saving || matched.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50"
                style={{ background: '#FF6B35' }}
              >
                <Save size={14} /> {saving ? 'Se importă...' : `Importă ${matched.length} ${matched.length === 1 ? 'barcă' : 'bărci'}`}
              </button>
              {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OurBoatsClassification({ results }: { results: any[] }) {
  const withScores = results.filter((r: any) => Array.isArray(r.race_scores) && r.race_scores.length > 0)
  if (withScores.length === 0) return null

  const raceCount = withScores.reduce((mx: number, r: any) => Math.max(mx, r.race_scores.length), 0)
  const ranked = [...withScores].sort((a: any, b: any) => {
    const na = a.net_points ?? Infinity
    const nb = b.net_points ?? Infinity
    return na - nb
  })

  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-3" style={{ background: 'rgba(255,107,53,0.06)', borderBottom: '1px solid #e5e7eb' }}>
        <h3 className="text-sm font-medium uppercase tracking-wider inline-flex items-center gap-1.5" style={{ color: '#FF6B35' }}>
          <ListOrdered size={14} /> Clasament bărcile noastre (această regatta)
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th className="text-center px-3 py-2 text-[10px] uppercase text-gray-400 w-10">#</th>
              <th className="text-left px-3 py-2 text-[10px] uppercase text-gray-400">Echipă</th>
              <th className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">Loc flotă</th>
              {Array.from({ length: raceCount }, (_, i) => (
                <th key={i} className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">R{i + 1}</th>
              ))}
              <th className="text-center px-2 py-2 text-[10px] uppercase text-gray-400">Total</th>
              <th className="text-center px-2 py-2 text-[10px] uppercase font-semibold" style={{ color: '#FF6B35' }}>Net</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map((r: any, idx: number) => (
              <tr key={r.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                <td className="px-3 py-2.5 text-center font-bold" style={{ color: '#0a1628' }}>{idx + 1}</td>
                <td className="px-3 py-2.5">
                  <Link href={`/ssyt/admin/teams/${r.team?.id}`} className="inline-flex items-center gap-2 hover:underline">
                    <span className="w-3 h-3 rounded-full" style={{ background: r.team?.color_primary || '#4A5568' }}></span>
                    <span className="font-medium" style={{ color: '#0a1628' }}>{r.team?.name}</span>
                  </Link>
                </td>
                <td className="px-2 py-2.5 text-center text-gray-600">{r.official_place ?? '—'}</td>
                {Array.from({ length: raceCount }, (_, i) => (
                  <td key={i} className="px-2 py-2.5 text-center text-gray-600">{r.race_scores[i] ?? '—'}</td>
                ))}
                <td className="px-2 py-2.5 text-center text-gray-600">{r.total_points ?? '—'}</td>
                <td className="px-2 py-2.5 text-center font-bold" style={{ color: '#FF6B35' }}>{r.net_points ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-5 py-2 text-[11px] text-gray-400" style={{ borderTop: '1px solid #f3f4f6' }}>
        Rang după Net (mai mic = mai bine). „Loc flotă" = poziția în clasamentul general complet.
      </div>
    </div>
  )
}

function FlagButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition"
      style={{
        background: active ? '#EF4444' : 'transparent',
        color: active ? '#fff' : '#9CA3AF',
        border: '1px solid',
        borderColor: active ? '#EF4444' : '#E5E7EB',
      }}
    >
      {label}
    </button>
  )
}

function NewResultForm({ regattaId, teams, onClose, onSaved }: { regattaId: string; teams: any[]; onClose: () => void; onSaved: () => void }) {
  const [teamId, setTeamId] = useState('')
  const [officialPlace, setOfficialPlace] = useState('')
  const [internalPlace, setInternalPlace] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (!teamId) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_results').insert({
      regatta_id: regattaId,
      team_id: teamId,
      official_place: officialPlace ? Number(officialPlace) : null,
      ssyt_internal_place: internalPlace ? Number(internalPlace) : null,
      published_at: new Date().toISOString(),
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Rezultat nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 items-end">
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Echipă *</label>
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm">
            <option value="">— alege —</option>
            {teams.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Loc oficial</label>
          <input type="number" value={officialPlace} onChange={(e) => setOfficialPlace(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Loc SSYT</label>
          <input type="number" value={internalPlace} onChange={(e) => setInternalPlace(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
      </div>
      <button onClick={save} disabled={saving || !teamId} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        <Save size={14} className="inline" /> {saving ? '...' : 'Adaugă'}
      </button>
      <p className="text-xs text-gray-500 mt-2">Detaliile suplimentare (puncte, clasă, recap) le editezi după.</p>
      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  )
}
