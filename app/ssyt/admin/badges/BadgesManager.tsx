'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Award, Plus, Trash2, X, UserPlus, Users as UsersIcon, Star } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Badge = {
  id: string
  code: string
  name: string
  description: string | null
  color: string | null
  category: string
  points_value: number | null
  is_active: boolean
}

type Awarding = {
  id: string
  badge_id: string
  participant?: { id: string; full_name: string } | { id: string; full_name: string }[] | null
  team?: { id: string; name: string; color_primary: string | null } | { id: string; name: string; color_primary: string | null }[] | null
  regatta?: { id: string; name: string } | { id: string; name: string }[] | null
  awarded_at: string
  notes: string | null
}

const CATEGORY_LABELS: Record<string, string> = {
  achievement: 'Achievement',
  role_mastery: 'Role mastery',
  performance: 'Performance',
  special: 'Special',
}

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default function BadgesManager({
  badges, participants, teams, regattas, participantBadges, teamBadges,
}: {
  badges: Badge[]
  participants: { id: string; full_name: string }[]
  teams: { id: string; name: string; short_name: string | null; color_primary: string | null }[]
  regattas: { id: string; name: string }[]
  participantBadges: Awarding[]
  teamBadges: Awarding[]
}) {
  const router = useRouter()
  const [showNewBadge, setShowNewBadge] = useState(false)
  const [awardingBadge, setAwardingBadge] = useState<Badge | null>(null)

  async function deleteBadge(id: string) {
    if (!confirm('Ștergi acest badge? Toate atribuirile vor fi șterse și ele.')) return
    const { error } = await supabase.from('ssyt_badges').delete().eq('id', id)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  async function unawardParticipant(id: string) {
    if (!confirm('Retragi acest badge?')) return
    const { error } = await supabase.from('ssyt_participant_badges').delete().eq('id', id)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  async function unawardTeam(id: string) {
    if (!confirm('Retragi acest badge?')) return
    const { error } = await supabase.from('ssyt_team_badges').delete().eq('id', id)
    if (error) { alert(error.message); return }
    router.refresh()
  }

  const grouped: Record<string, Badge[]> = {}
  for (const b of badges) {
    if (!grouped[b.category]) grouped[b.category] = []
    grouped[b.category].push(b)
  }

  const countMap: Record<string, number> = {}
  for (const a of participantBadges) countMap[a.badge_id] = (countMap[a.badge_id] || 0) + 1
  for (const a of teamBadges) countMap[a.badge_id] = (countMap[a.badge_id] || 0) + 1

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button onClick={() => setShowNewBadge(true)} className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white" style={{ background: '#FF6B35' }}>
          <Plus size={14} /> Badge nou
        </button>
      </div>

      {showNewBadge && (
        <NewBadgeForm onClose={() => setShowNewBadge(false)} onSaved={() => { setShowNewBadge(false); router.refresh() }} />
      )}

      {awardingBadge && (
        <AwardModal
          badge={awardingBadge}
          participants={participants}
          teams={teams}
          regattas={regattas}
          onClose={() => setAwardingBadge(null)}
          onSaved={() => { setAwardingBadge(null); router.refresh() }}
        />
      )}

      {Object.keys(grouped).length === 0 ? (
        <div className="rounded-lg p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Award size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun badge creat.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">
                {CATEGORY_LABELS[category] || category}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((b) => (
                  <BadgeCard
                    key={b.id}
                    badge={b}
                    awardingsCount={countMap[b.id] || 0}
                    onAward={() => setAwardingBadge(b)}
                    onDelete={() => deleteBadge(b.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {(participantBadges.length > 0 || teamBadges.length > 0) && (
        <div className="mt-10">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Atribuiri recente</h2>
          <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <table className="w-full text-sm">
              <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Badge</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Atribuit la</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Context</th>
                  <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Data</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody>
                {participantBadges.slice(0, 15).map((a) => {
                  const badge = badges.find((b) => b.id === a.badge_id)
                  const participant = asObject(a.participant)
                  const regatta = asObject(a.regatta)
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td className="px-4 py-2">
                        <BadgePill badge={badge} />
                      </td>
                      <td className="px-4 py-2">
                        {participant ? (
                          <Link href={`/ssyt/admin/participants/${participant.id}`} className="hover:underline" style={{ color: '#0a1628' }}>
                            {participant.full_name}
                          </Link>
                        ) : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">
                        {regatta ? (
                          <Link href={`/ssyt/admin/regattas/${regatta.id}`} className="hover:underline">
                            {regatta.name}
                          </Link>
                        ) : <span className="italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500">{new Date(a.awarded_at).toLocaleDateString('ro-RO')}</td>
                      <td className="pr-4">
                        <button onClick={() => unawardParticipant(a.id)} className="text-gray-300 hover:text-red-600 p-1">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {teamBadges.slice(0, 15).map((a) => {
                  const badge = badges.find((b) => b.id === a.badge_id)
                  const team = asObject(a.team)
                  return (
                    <tr key={a.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td className="px-4 py-2">
                        <BadgePill badge={badge} />
                      </td>
                      <td className="px-4 py-2">
                        {team ? (
                          <Link href={`/ssyt/admin/teams/${team.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                            <span className="w-2 h-2 rounded-full" style={{ background: team.color_primary || '#4A5568' }}></span>
                            <span style={{ color: '#0a1628' }}>{team.name}</span>
                          </Link>
                        ) : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 italic">echipă</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{new Date(a.awarded_at).toLocaleDateString('ro-RO')}</td>
                      <td className="pr-4">
                        <button onClick={() => unawardTeam(a.id)} className="text-gray-300 hover:text-red-600 p-1">
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function BadgeCard({ badge, awardingsCount, onAward, onDelete }: { badge: Badge; awardingsCount: number; onAward: () => void; onDelete: () => void }) {
  return (
    <div className="rounded-lg p-4 transition hover:shadow-md" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-start gap-3 mb-3">
        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${badge.color}15` }}>
          {badge.name.split(' ')[0]}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm leading-tight" style={{ color: '#0a1628' }}>
            {badge.name.split(' ').slice(1).join(' ')}
          </h3>
          {badge.points_value !== null && badge.points_value > 0 && (
            <span className="text-[10px] uppercase tracking-wider text-gray-500">+{badge.points_value} pts</span>
          )}
        </div>
      </div>
      {badge.description && (
        <p className="text-xs text-gray-600 leading-relaxed mb-3">{badge.description}</p>
      )}
      <div className="flex items-center justify-between pt-2 border-t" style={{ borderColor: '#f3f4f6' }}>
        <span className="text-xs text-gray-500">
          <Star size={11} className="inline" /> {awardingsCount} atribuiri
        </span>
        <div className="flex items-center gap-1">
          <button onClick={onAward} className="text-xs px-2 py-1 rounded font-medium" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
            <UserPlus size={11} className="inline mr-0.5" /> Atribuie
          </button>
          <button onClick={onDelete} className="text-gray-300 hover:text-red-600 p-1">
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

function BadgePill({ badge }: { badge?: Badge }) {
  if (!badge) return <span className="text-xs text-gray-400">—</span>
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: `${badge.color}15`, color: badge.color || '#0a1628' }}>
      {badge.name}
    </span>
  )
}

function NewBadgeForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    color: '#FF6B35',
    category: 'achievement',
    points_value: 5,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function slugify(s: string) {
    return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  }

  async function save() {
    if (!form.name.trim()) { setError('Nume obligatoriu.'); return }
    setSaving(true)
    setError(null)
    const finalCode = form.code.trim() || slugify(form.name.trim())
    const { error: err } = await supabase.from('ssyt_badges').insert({
      code: finalCode,
      name: form.name,
      description: form.description || null,
      color: form.color,
      category: form.category,
      points_value: form.points_value,
      is_active: true,
    })
    setSaving(false)
    if (err) { setError(err.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Badge nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <input placeholder="Nume cu emoji (ex: 🏁 First Start)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
        <input placeholder="Code (slug, generat auto)" value={form.code} onChange={(e) => setForm({ ...form, code: slugify(e.target.value) })} className="px-3 py-2 border rounded-md text-sm font-mono" />
      </div>
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <div className="grid grid-cols-3 gap-3 mb-3">
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="achievement">achievement</option>
          <option value="role_mastery">role_mastery</option>
          <option value="performance">performance</option>
          <option value="special">special</option>
        </select>
        <input type="number" placeholder="Puncte" value={form.points_value} onChange={(e) => setForm({ ...form, points_value: Number(e.target.value) })} className="px-3 py-2 border rounded-md text-sm" />
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} className="h-10 w-full border rounded-md cursor-pointer" />
      </div>
      <button onClick={save} disabled={saving} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
      {error && <span className="ml-3 text-xs text-red-600">{error}</span>}
    </div>
  )
}

function AwardModal({
  badge, participants, teams, regattas, onClose, onSaved,
}: {
  badge: Badge
  participants: { id: string; full_name: string }[]
  teams: { id: string; name: string; short_name: string | null; color_primary: string | null }[]
  regattas: { id: string; name: string }[]
  onClose: () => void
  onSaved: () => void
}) {
  const [tab, setTab] = useState<'participant' | 'team'>('participant')
  const [participantId, setParticipantId] = useState('')
  const [teamId, setTeamId] = useState('')
  const [regattaId, setRegattaId] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    if (tab === 'participant') {
      if (!participantId) { setError('Alege un participant.'); setSaving(false); return }
      const { error: err } = await supabase.from('ssyt_participant_badges').insert({
        badge_id: badge.id,
        participant_id: participantId,
        regatta_id: regattaId || null,
        notes: notes || null,
      })
      if (err) { setError(err.message); setSaving(false); return }
    } else {
      if (!teamId) { setError('Alege o echipă.'); setSaving(false); return }
      const { error: err } = await supabase.from('ssyt_team_badges').insert({
        badge_id: badge.id,
        team_id: teamId,
        regatta_id: regattaId || null,
        notes: notes || null,
      })
      if (err) { setError(err.message); setSaving(false); return }
    }
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-lg p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold tracking-tight" style={{ color: '#0a1628' }}>Atribuie {badge.name}</h3>
            <p className="text-xs text-gray-500 mt-1">{badge.description}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="flex gap-2 mb-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <button
            onClick={() => setTab('participant')}
            className="px-3 py-2 text-sm font-medium transition"
            style={{ color: tab === 'participant' ? '#FF6B35' : '#6B7280', borderBottom: tab === 'participant' ? '2px solid #FF6B35' : '2px solid transparent', marginBottom: '-1px' }}
          >
            <UserPlus size={12} className="inline mr-1" /> Participant
          </button>
          <button
            onClick={() => setTab('team')}
            className="px-3 py-2 text-sm font-medium transition"
            style={{ color: tab === 'team' ? '#FF6B35' : '#6B7280', borderBottom: tab === 'team' ? '2px solid #FF6B35' : '2px solid transparent', marginBottom: '-1px' }}
          >
            <UsersIcon size={12} className="inline mr-1" /> Echipă
          </button>
        </div>

        {tab === 'participant' ? (
          <select value={participantId} onChange={(e) => setParticipantId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3">
            <option value="">— alege participant —</option>
            {participants.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
          </select>
        ) : (
          <select value={teamId} onChange={(e) => setTeamId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3">
            <option value="">— alege echipă —</option>
            {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}

        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Context regatta (opțional)</label>
        <select value={regattaId} onChange={(e) => setRegattaId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3">
          <option value="">— fără context regatta —</option>
          {regattas.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <textarea placeholder="Note (opțional)" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-4" />

        <div className="flex gap-2">
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}>
            {saving ? '...' : 'Atribuie badge'}
          </button>
          <button onClick={onClose} className="px-4 py-2 rounded-md text-sm font-medium text-gray-500 hover:text-gray-900">
            Anulează
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    </div>
  )
}