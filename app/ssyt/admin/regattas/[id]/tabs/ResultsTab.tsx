'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Trophy, Trash2, X, Save } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

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
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{results.length} rezultate înregistrate</p>
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
          <p className="text-xs text-gray-400 mt-1">Adaugă rezultatele după regatta — scor oficial și intern SSYT.</p>
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

      {/* Recap */}
      {results.length > 0 && (
        <div className="mt-6 rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h3 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Recap & note</h3>
          {results.map((r: any) => (
            <div key={r.id} className="mb-3 pb-3 border-b last:border-0 last:mb-0 last:pb-0" style={{ borderColor: '#f3f4f6' }}>
              <div className="text-xs uppercase tracking-wider text-gray-400 mb-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: r.team?.color_primary }}></span>
                {r.team?.name}
              </div>
              <EditableField
                value={r.recap}
                onSave={(v) => updateField(r.id, 'recap', v)}
                placeholder="Adaugă recap..."
                type="textarea"
                multiline
                displayClassName="text-sm text-gray-700"
              />
            </div>
          ))}
        </div>
      )}
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