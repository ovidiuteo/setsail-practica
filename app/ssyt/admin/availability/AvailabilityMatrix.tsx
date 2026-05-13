'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserCheck } from 'lucide-react'
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
  team_id: string | null
  confirmation_status: string
  attendance_type: string | null
  on_crewlist?: boolean
}
type UnallocatedParticipant = {
  id: string
  full_name: string
  first_name: string
  last_name: string
}

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#10B981',
  declined: '#EF4444',
  tentative: '#9CA3AF',
  pending: '#F59E0B',
}

const NEXT_STATE: Record<string, string> = {
  confirmed: 'declined',
  declined: 'tentative',
  tentative: 'CLEAR',
}

function getParticipant(m: Membership) {
  if (Array.isArray(m.participant)) return m.participant[0] ?? null
  return m.participant
}

export default function AvailabilityMatrix({
  regattas, teams, memberships, participation, unallocatedParticipants,
}: {
  regattas: Regatta[]
  teams: Team[]
  memberships: Membership[]
  participation: Participation[]
  unallocatedParticipants: UnallocatedParticipant[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const partMap: Record<string, Participation> = {}
  for (const p of participation) {
    partMap[`${p.regatta_id}_${p.participant_id}`] = p
  }

  async function cycleStatus(regattaId: string, participantId: string, teamId: string | null) {
    const key = `${regattaId}_${participantId}`
    setBusy(key)
    const existing = partMap[key]

    if (!existing) {
      const { error } = await supabase.from('ssyt_regatta_participation').insert({
        regatta_id: regattaId,
        participant_id: participantId,
        team_id: teamId,  // poate fi null pentru nealocati
        confirmation_status: 'confirmed',
        attendance_type: teamId ? 'core' : 'occasional',
        on_crewlist: false,
        confirmed_at: new Date().toISOString(),
      })
      if (error) alert(error.message)
    } else {
      const next = NEXT_STATE[existing.confirmation_status] || 'confirmed'
      if (next === 'CLEAR') {
        const { error } = await supabase
          .from('ssyt_regatta_participation')
          .delete()
          .eq('id', existing.id)
        if (error) alert(error.message)
      } else {
        const updates: any = { confirmation_status: next }
        if (next === 'confirmed') {
          updates.confirmed_at = new Date().toISOString()
        } else {
          updates.on_crewlist = false
        }
        const { error } = await supabase
          .from('ssyt_regatta_participation')
          .update(updates)
          .eq('id', existing.id)
        if (error) alert(error.message)
      }
    }
    setBusy(null)
    router.refresh()
  }

  async function toggleCrewlist(regattaId: string, participantId: string, teamId: string | null) {
    const key = `${regattaId}_${participantId}`
    const existing = partMap[key]

    if (!existing || existing.confirmation_status !== 'confirmed') {
      alert('Trebuie să fie disponibil (verde) ca să fie pus pe crewlist.')
      return
    }
    if (!existing.team_id) {
      alert('Participantul nu e alocat la nicio echipă/barcă. Selectează-l ad-hoc dintr-o barcă în tab "Bărci".')
      return
    }

    setBusy(key)
    const { error } = await supabase
      .from('ssyt_regatta_participation')
      .update({ on_crewlist: !existing.on_crewlist })
      .eq('id', existing.id)
    if (error) alert(error.message)
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
                <th key={r.id} className="px-2 py-2 text-center" style={{ minWidth: 100 }}>
                  <Link href={`/ssyt/admin/regattas/${r.id}`} className="block hover:underline">
                    <div className="text-[10px] uppercase text-gray-400">{d.toLocaleString('ro-RO', { month: 'short' })}</div>
                    <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>
                      {d.getDate()}{r.end_date && new Date(r.end_date).getDate() !== d.getDate() ? `-${new Date(r.end_date).getDate()}` : ''}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[100px]" title={r.name}>
                      {r.short_name || r.name.split(' ').slice(0, 2).join(' ')}
                    </div>
                  </Link>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {/* Sectiuni pe echipe */}
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
                    <ParticipantRow
                      key={m.id}
                      participantId={p.id}
                      participantName={p.full_name}
                      teamId={team.id}
                      isOccasional={m.membership_type === 'occasional'}
                      regattas={regattas}
                      partMap={partMap}
                      busy={busy}
                      onCycleStatus={cycleStatus}
                      onToggleCrewlist={toggleCrewlist}
                    />
                  )
                })}
              </>
            )
          })}

          {/* Sectiune Nealocati (la baza) */}
          {unallocatedParticipants.length > 0 && (
            <>
              <tr style={{ background: '#6B7280' }}>
                <td colSpan={regattas.length + 1} className="px-3 py-2 text-white font-semibold sticky left-0 z-10" style={{ background: '#6B7280' }}>
                  Nealocați
                  <span className="text-white/70 text-xs font-normal ml-2">({unallocatedParticipants.length} participanți fără echipă)</span>
                </td>
              </tr>
              {unallocatedParticipants.map((p) => (
                <ParticipantRow
                  key={`un-${p.id}`}
                  participantId={p.id}
                  participantName={p.full_name}
                  teamId={null}
                  isOccasional={false}
                  isUnallocated
                  regattas={regattas}
                  partMap={partMap}
                  busy={busy}
                  onCycleStatus={cycleStatus}
                  onToggleCrewlist={toggleCrewlist}
                />
              ))}
            </>
          )}
        </tbody>
      </table>

      <div className="px-3 py-3 text-xs text-gray-500 border-t space-y-1" style={{ background: '#f8f9fa' }}>
        <div>💡 <strong>Click pe pătrat</strong>: comută disponibilitatea (verde → roșu → gri → fără înregistrare → verde...).</div>
        <div>👤 <strong>Click pe iconul cap-de-om</strong>: pune/scoate de pe crewlist (doar dacă e disponibil și alocat la echipă).</div>
        <div className="pt-1 flex flex-wrap items-center gap-3">
          <span className="font-medium">Legendă:</span>
          <LegendItem color="#10B981" label="Disponibil" />
          <LegendItem color="#EF4444" label="Indisponibil" />
          <LegendItem color="#9CA3AF" label="Tentative" />
          <span className="inline-flex items-center gap-1 ml-2">
            <UserCheck size={14} style={{ color: '#10B981' }} />
            <span className="text-gray-600">Pe crewlist</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function ParticipantRow({
  participantId, participantName, teamId, isOccasional, isUnallocated, regattas, partMap, busy, onCycleStatus, onToggleCrewlist,
}: {
  participantId: string
  participantName: string
  teamId: string | null
  isOccasional: boolean
  isUnallocated?: boolean
  regattas: Regatta[]
  partMap: Record<string, Participation>
  busy: string | null
  onCycleStatus: (rId: string, pId: string, tId: string | null) => void
  onToggleCrewlist: (rId: string, pId: string, tId: string | null) => void
}) {
  return (
    <tr style={{ borderTop: '1px solid #f3f4f6' }}>
      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: '#fff' }}>
        <Link href={`/ssyt/admin/participants/${participantId}`} className="hover:underline" style={{ color: '#0a1628' }}>
          {participantName}
        </Link>
        {isOccasional && (
          <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(0,168,181,0.12)', color: '#00A8B5' }}>
            occ
          </span>
        )}
        {isUnallocated && (
          <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(107,114,128,0.15)', color: '#6B7280' }}>
            fără echipă
          </span>
        )}
      </td>
      {regattas.map((r) => {
        const key = `${r.id}_${participantId}`
        const part = partMap[key]
        const status = part?.confirmation_status
        const onCrewlist = part?.on_crewlist || false
        const isBusy = busy === key
        const isConfirmed = status === 'confirmed'

        return (
          <td key={r.id} className="p-1">
            <div className="flex items-center justify-center gap-1">
              <StatusCell
                status={status}
                onClick={() => onCycleStatus(r.id, participantId, teamId)}
                disabled={isBusy}
              />
              <CrewlistIcon
                onCrewlist={onCrewlist}
                isConfirmed={isConfirmed}
                hasTeam={!!part?.team_id}
                onClick={() => onToggleCrewlist(r.id, participantId, teamId)}
                disabled={isBusy || !isConfirmed || !part?.team_id}
              />
            </div>
          </td>
        )
      })}
    </tr>
  )
}

function StatusCell({ status, onClick, disabled }: { status: string | undefined; onClick: () => void; disabled: boolean }) {
  const color = status ? STATUS_COLORS[status] : null
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded transition hover:scale-105 disabled:opacity-50 flex items-center justify-center"
      style={{
        background: color || 'transparent',
        border: color ? 'none' : '1px dashed #d1d5db',
      }}
      title={status || 'Click pentru a adauga'}
    >
      {!color && <span className="text-gray-300 text-base leading-none">+</span>}
    </button>
  )
}

function CrewlistIcon({ onCrewlist, isConfirmed, hasTeam, onClick, disabled }: { onCrewlist: boolean; isConfirmed: boolean; hasTeam: boolean; onClick: () => void; disabled: boolean }) {
  const iconColor = onCrewlist ? '#10B981' : '#D1D5DB'
  let title = 'Click pentru a pune pe crewlist'
  if (!isConfirmed) title = 'Trebuie disponibil ca să poată fi pus pe crewlist'
  else if (!hasTeam) title = 'Trebuie alocat pe o barcă (din tab Bărci) pentru crewlist'
  else if (onCrewlist) title = 'Pe crewlist - click pentru a scoate'

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-6 h-6 rounded transition hover:bg-gray-100 disabled:cursor-not-allowed flex items-center justify-center"
      style={{ opacity: (!isConfirmed || !hasTeam) ? 0.4 : 1 }}
      title={title}
    >
      <UserCheck size={14} style={{ color: iconColor }} />
    </button>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="w-3 h-3 rounded" style={{ background: color }}></span>
      <span className="text-gray-600">{label}</span>
    </span>
  )
}