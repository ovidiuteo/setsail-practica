'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Plus, Users, Trash2, X, Check } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

const CONF_OPTIONS = [
  { value: 'pending', label: 'pending' },
  { value: 'confirmed', label: 'confirmat' },
  { value: 'declined', label: 'refuzat' },
  { value: 'tentative', label: 'tentative' },
]

const CONF_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#10B981',
  declined: '#EF4444',
  tentative: '#3B82F6',
}

export default function CrewlistTab({
  regattaId, participation, teams, allParticipants, roles, onChange,
}: {
  regattaId: string
  participation: any[]
  teams: any[]
  allParticipants: any[]
  roles: any[]
  onChange: () => void
}) {
  const [showAddForTeam, setShowAddForTeam] = useState<string | null>(null)

  // Group by team
  const byTeam: Record<string, any[]> = {}
  for (const p of participation) {
    const tid = p.team_id
    if (!byTeam[tid]) byTeam[tid] = []
    byTeam[tid].push(p)
  }

  async function updateField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const updates: any = { [field]: cleanValue }
    if (field === 'confirmation_status' && value === 'confirmed') {
      updates.confirmed_at = new Date().toISOString()
    }
    const { error } = await supabase.from('ssyt_regatta_participation').update(updates).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest participant din crewlist?')) return
    const { error } = await supabase.from('ssyt_regatta_participation').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  return (
    <div className="space-y-5">
      {teams.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Users size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nu există echipe active în sezon.</p>
        </div>
      ) : (
        teams.map((team) => {
          const teamParts = byTeam[team.id] || []
          const isAdding = showAddForTeam === team.id

          return (
            <div key={team.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              {/* Team header */}
              <div className="p-4 flex items-center justify-between" style={{ background: team.color_primary || '#4A5568' }}>
                <Link href={`/ssyt/admin/teams/${team.id}`} className="flex items-center gap-3 text-white hover:underline">
                  <div className="w-9 h-9 rounded bg-white/15 flex items-center justify-center font-bold text-sm">
                    {team.short_name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <div className="font-semibold">{team.name}</div>
                    {team.boat && <div className="text-xs text-white/70">{team.boat.name}</div>}
                  </div>
                </Link>
                <div className="flex items-center gap-3">
                  <span className="text-white/80 text-sm">{teamParts.length} membri</span>
                  <button
                    onClick={() => setShowAddForTeam(isAdding ? null : team.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs bg-white/15 hover:bg-white/25 text-white font-medium"
                  >
                    <Plus size={12} /> Adaugă
                  </button>
                </div>
              </div>

              {/* Add form */}
              {isAdding && (
                <AddParticipantForm
                  regattaId={regattaId}
                  teamId={team.id}
                  allParticipants={allParticipants}
                  roles={roles}
                  existing={teamParts.map((p: any) => p.participant_id)}
                  onClose={() => setShowAddForTeam(null)}
                  onSaved={() => { setShowAddForTeam(null); onChange() }}
                />
              )}

              {/* Members table */}
              {teamParts.length > 0 ? (
                <table className="w-full text-sm">
                  <thead style={{ background: '#f8f9fa', borderTop: '1px solid #e5e7eb' }}>
                    <tr>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Membru</th>
                      <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Rol</th>
                      <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
                      <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Confirmare</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamParts.map((p: any) => (
                      <tr key={p.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td className="px-4 py-3">
                          <Link href={`/ssyt/admin/participants/${p.participant_id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                            {p.participant?.full_name}
                          </Link>
                          {p.is_substitute && <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(0,168,181,0.12)', color: '#00A8B5' }}>substitut</span>}
                        </td>
                        <td className="px-4 py-3">
                          <EditableField
                            value={p.role_id}
                            onSave={(v) => updateField(p.id, 'role_id', v === '' ? '' : v)}
                            type="select"
                            options={roles.map((r: any) => ({ value: r.id, label: r.name_ro }))}
                            formatDisplay={(v) => roles.find((r: any) => r.id === v)?.name_ro || 'fără rol'}
                            placeholder="fără rol"
                          />
                        </td>
                        <td className="px-4 py-3 text-center text-xs">
                          <EditableField
                            value={p.attendance_type}
                            onSave={(v) => updateField(p.id, 'attendance_type', v)}
                            type="select"
                            options={[
                              { value: 'core', label: 'core' },
                              { value: 'occasional', label: 'occasional' },
                            ]}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{
                            background: `${CONF_COLORS[p.confirmation_status]}15`,
                            color: CONF_COLORS[p.confirmation_status],
                          }}>
                            <EditableField
                              value={p.confirmation_status}
                              onSave={(v) => updateField(p.id, 'confirmation_status', v)}
                              type="select"
                              options={CONF_OPTIONS}
                              formatDisplay={(v) => CONF_OPTIONS.find(o => o.value === v)?.label || String(v)}
                            />
                          </span>
                        </td>
                        <td className="pr-4">
                          <button onClick={() => remove(p.id)} className="text-gray-300 hover:text-red-600 p-1">
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400 italic" style={{ borderTop: '1px solid #e5e7eb' }}>
                  Niciun membru adăugat pentru această regatta.
                </div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}

function AddParticipantForm({
  regattaId, teamId, allParticipants, roles, existing, onClose, onSaved,
}: {
  regattaId: string; teamId: string; allParticipants: any[]; roles: any[]; existing: string[]
  onClose: () => void; onSaved: () => void
}) {
  const [participantId, setParticipantId] = useState('')
  const [roleId, setRoleId] = useState('')
  const [attendanceType, setAttendanceType] = useState('core')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const available = allParticipants.filter((p: any) => !existing.includes(p.id))

  async function save() {
    if (!participantId) return
    setSaving(true)
    setError(null)
    const { error: err } = await supabase.from('ssyt_regatta_participation').insert({
      regatta_id: regattaId,
      team_id: teamId,
      participant_id: participantId,
      role_id: roleId || null,
      attendance_type: attendanceType,
      confirmation_status: 'pending',
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end" style={{ background: 'rgba(255,107,53,0.04)', borderTop: '1px solid #FF6B35' }}>
      <div>
        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Participant *</label>
        <select value={participantId} onChange={(e) => setParticipantId(e.target.value)} className="w-full px-2 py-1.5 border rounded-md text-sm">
          <option value="">— alege —</option>
          {available.map((p: any) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Rol</label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className="w-full px-2 py-1.5 border rounded-md text-sm">
          <option value="">— fără —</option>
          {roles.map((r: any) => <option key={r.id} value={r.id}>{r.name_ro}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Tip</label>
        <select value={attendanceType} onChange={(e) => setAttendanceType(e.target.value)} className="w-full px-2 py-1.5 border rounded-md text-sm">
          <option value="core">core</option>
          <option value="occasional">occasional</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button onClick={save} disabled={saving || !participantId} className="px-3 py-1.5 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
          <Check size={14} className="inline" /> Adaugă
        </button>
        <button onClick={onClose} className="px-2 py-1.5 text-gray-500 hover:text-gray-900"><X size={14} /></button>
      </div>
      {error && <div className="col-span-full text-xs text-red-600">{error}</div>}
    </div>
  )
}