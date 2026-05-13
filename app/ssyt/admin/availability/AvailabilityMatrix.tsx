'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/ssyt/supabase'

type Regatta = { id: string; name: string; short_name: string | null; start_date: string; end_date: string | null; event_type: string; status: string }
type Team = { id: string; name: string; short_name: string | null; color_primary: string | null }
type Membership = {
  id: string
  team_id: string
  participant_id: string
  membership_type: string
  participant: { id: string; full_name: string; first_name: string; last_name: string } | { id: string; full_name: string; first_name: string; last_name: string }[] | null
}
type Participation = {
  id: string
  regatta_id: string
  participant_id: string
  team_id: string
  confirmation_status: string
  attendance_type: string | null
}

const CONF_COLORS: Record<string, string> = {
  confirmed: '#10B981',
  tentative: '#3B82F6',
  pending: '#F59E0B',
  declined: '#EF4444',
}

const NEXT_STATE: Record<string, string> = {
  pending: 'confirmed',
  confirmed: 'declined',
  declined: 'tentative',
  tentative: 'pending',
}

function getParticipant(m: Membership) {
  if (Array.isArray(m.participant)) return m.participant[0] ?? null
  return m.participant
}

export default function AvailabilityMatrix({
  regattas, teams, memberships, participation,
}: {
  regattas: Regatta[]
  teams: Team[]
  memberships: Membership[]
  participation: Participation[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Lookup: regatta_id + participant_id → participation
  const partMap: Record<string, Participation> = {}
  for (const p of participation) {
    partMap[`${p.regatta_id}_${p.participant_id}`] = p
  }

  async function cycleStatus(regattaId: string, participantId: string, teamId: string) {
    const key = `${regattaId}_${participantId}`
    setBusy(key)
    const existing = partMap[key]

    if (!existing) {
      // Insert nou cu status confirmed (presupunere: admin click = vrea pe el)
      const { error } = await supabase.from('ssyt_regatta_participation').insert({
        regatta_id: regattaId,
        participant_id: participantId,
        team_id: teamId,
        confirmation_status: 'confirmed',
        attendance_type: 'core',
        confirmed_at: new Date().toISOString(),
      })
      if (error) alert(error.message)
    } else {
      const next = NEXT_STATE[existing.confirmation_status] || 'pending'
      const updates: any = { confirmation_status: next }
      if (next === 'confirmed') updates.confirmed_at = new Date().toISOString()
      const { error } = await supabase
        .from('ssyt_regatta_participation')
        .update(updates)
        .eq('id', existing.id)
      if (error) alert(error.message)
    }
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="rounded-lg overflow-x-auto" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
        <thead>
          <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <th className="text-left px-3 py-2 sticky left-0 z-10" style={{ background: '#f8f9fa', minWidth: 220 }}>
              <span className="uppercase tracking-wider text-gray-500 font-medium">Membru</span>
            </th>
            {regattas.map((r) => {
              const d = new Date(r.start_date)
              return (
                <th key={r.id} className="px-2 py-2 text-center" style={{ minWidth: 80 }}>
                  <Link href={`/ssyt/admin/regattas/${r.id}`} className="block hover:underline">
                    <div className="text-[10px] uppercase text-gray-400">{d.toLocaleString('ro-RO', { month: 'short' })}</div>
                    <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>
                      {d.getDate()}{r.end_date && new Date(r.end_date).getDate() !== d.getDate() ? `-${new Date(r.end_date).getDate()}` : ''}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[80px]" title={r.name}>
                      {r.short_name || r.name.split(' ').slice(0, 2).join(' ')}
                    </div>
                  </Link>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {teams.map((team) => {
            const teamMembers = memberships.filter((m) => m.team_id === team.id)
            return (
              <>
                <tr key={`hdr-${team.id}`} style={{ background: team.color_primary || '#4A5568' }}>
                  <td colSpan={regattas.length + 1} className="px-3 py-2 text-white font-semibold sticky left-0 z-10" style={{ background: team.color_primary || '#4A5568' }}>
                    <Link href={`/ssyt/admin/teams/${team.id}`} className="hover:underline">
                      {team.name}
                    </Link>
                    <span className="text-white/70 text-xs font-normal ml-2">({teamMembers.length} membri)</span>
                  </td>
                </tr>
                {teamMembers.map((m) => {
                  const p = getParticipant(m)
                  if (!p) return null
                  return (
                    <tr key={m.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: '#fff' }}>
                        <Link href={`/ssyt/admin/participants/${p.id}`} className="hover:underline" style={{ color: '#0a1628' }}>
                          {p.full_name}
                        </Link>
                        {m.membership_type === 'occasional' && (
                          <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(0,168,181,0.12)', color: '#00A8B5' }}>
                            occ
                          </span>
                        )}
                      </td>
                      {regattas.map((r) => {
                        const key = `${r.id}_${p.id}`
                        const part = partMap[key]
                        const status = part?.confirmation_status
                        const color = status ? CONF_COLORS[status] : null
                        const isBusy = busy === key
                        return (
                          <td key={r.id} className="text-center p-1">
                            <button
                              onClick={() => cycleStatus(r.id, p.id, team.id)}
                              disabled={isBusy}
                              className="w-12 h-8 rounded text-[10px] font-semibold uppercase transition hover:scale-105 disabled:opacity-50"
                              style={{
                                background: color || '#F3F4F6',
                                color: color ? '#fff' : '#9CA3AF',
                                border: color ? 'none' : '1px dashed #d1d5db',
                              }}
                              title={status || 'click pentru a adăuga'}
                            >
                              {isBusy ? '...' : (status ? status.slice(0, 3) : '+')}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </>
            )
          })}
        </tbody>
      </table>

      <div className="px-3 py-3 text-xs text-gray-500 border-t" style={{ background: '#f8f9fa' }}>
        💡 Click pe o celulă comută: <strong>+</strong> → confirmed → declined → tentative → pending → confirmed...
      </div>
    </div>
  )
}