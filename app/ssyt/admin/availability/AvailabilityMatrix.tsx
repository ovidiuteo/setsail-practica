'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { UserCheck, Lock, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Regatta = { id: string; name: string; short_name: string | null; start_date: string; end_date: string | null; event_type: string; status: string }

function isRegattaFrozen(r: Regatta): boolean {
  if (r.status === 'completed' || r.status === 'cancelled') return true
  if (r.end_date) {
    const end = new Date(r.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) return true
  }
  return false
}
type Team = { id: string; name: string; short_name: string | null; color_primary: string | null }
type Membership = {
  id: string
  team_id: string
  participant_id: string
  membership_type: string
  punctual_anchor_regatta_id?: string | null
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
  regattas, teams, memberships, hiddenMemberships = [], participation, unallocatedParticipants,
}: {
  regattas: Regatta[]
  teams: Team[]
  memberships: Membership[]
  hiddenMemberships?: Membership[]
  participation: Participation[]
  unallocatedParticipants: UnallocatedParticipant[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const partMap: Record<string, Participation> = {}
  for (const p of participation) {
    partMap[`${p.regatta_id}_${p.participant_id}`] = p
  }

  const frozenIds = new Set(regattas.filter(isRegattaFrozen).map((r) => r.id))

  // Map: regattaId → end timestamp (pt anchor lookup)
  const regattaEndTs: Record<string, number> = {}
  for (const r of regattas) {
    const d = r.end_date || r.start_date
    if (d) regattaEndTs[r.id] = new Date(d).getTime()
  }

  // Pentru fiecare member punctual: setul regatelor locked (post-anchor)
  const punctualLockMap: Record<string, Set<string>> = {} // participantId → Set<regattaId>
  for (const m of memberships) {
    if (m.membership_type !== 'punctual') continue
    const anchorId = m.punctual_anchor_regatta_id
    if (!anchorId) continue
    const anchorEnd = regattaEndTs[anchorId]
    if (!anchorEnd) continue
    const locked = new Set<string>()
    for (const r of regattas) {
      const startTs = new Date(r.start_date).getTime()
      if (startTs > anchorEnd) locked.add(r.id)
    }
    punctualLockMap[m.participant_id] = locked
  }

  function isLockedFor(participantId: string, regattaId: string): boolean {
    return punctualLockMap[participantId]?.has(regattaId) ?? false
  }

  // Participanti cu membership activ, pe echipe (pentru detectarea orfanilor)
  const activeByTeam: Record<string, Set<string>> = {}
  for (const m of memberships) {
    ;(activeByTeam[m.team_id] ||= new Set()).add(m.participant_id)
  }

  // Placeholder-uri (orfani) per echipa: membership-uri marcate 'left' prin butonul Hide.
  // Daca persoana a fost realocata activ in aceeasi echipa, nu mai e placeholder acolo.
  // Pastram patratelele (istoric prezenta) prin participant_id.
  const orphansByTeam: Record<string, string[]> = {}
  const allOrphanIds = new Set<string>()
  for (const team of teams) {
    const seen: string[] = []
    const seenSet = new Set<string>()
    for (const m of hiddenMemberships) {
      if (m.team_id !== team.id) continue
      if (activeByTeam[team.id]?.has(m.participant_id)) continue // realocat activ aici
      if (seenSet.has(m.participant_id)) continue
      seenSet.add(m.participant_id)
      seen.push(m.participant_id)
    }
    if (seen.length > 0) {
      orphansByTeam[team.id] = seen
      seen.forEach((id) => allOrphanIds.add(id))
    }
  }

  // Nealocati afisati: excludem orfanii (apar deja ca placeholder in echipa lor)
  const visibleUnallocated = unallocatedParticipants.filter((p) => !allOrphanIds.has(p.id))

  async function cycleStatus(regattaId: string, participantId: string, teamId: string | null) {
    if (isLockedFor(participantId, regattaId)) return // one-time post-anchor
    const frozen = frozenIds.has(regattaId)
    if (frozen) {
      // Regata trecuta — permis, dar cu confirmare (corectie istoric)
      if (!confirm('Această regată a trecut. Modifici statusul istoric (ex: a bifat că vine dar nu a venit)?')) return
    }
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
    if (frozenIds.has(regattaId)) return
    if (isLockedFor(participantId, regattaId)) return
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

  // Hide: ocazional/one-time → mutat la nealocati (status 'left'), randul ramane placeholder anonim
  async function hideMember(membershipId: string, name: string) {
    if (!confirm(`Ascunzi pe ${name}? Va fi mutat la nealocați. Rândul rămâne ca placeholder anonim, cu istoricul prezenței (pătrățelele).`)) return
    setBusy(`hide-${membershipId}`)
    const { error } = await supabase.from('ssyt_team_memberships').update({ status: 'left' }).eq('id', membershipId)
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
              const frozen = frozenIds.has(r.id)
              return (
                <th
                  key={r.id}
                  className="px-2 py-2 text-center"
                  style={{ minWidth: 100, opacity: frozen ? 0.5 : 1 }}
                  title={frozen ? 'Regată finalizată — editabil doar cu confirmare' : undefined}
                >
                  <Link href={`/ssyt/admin/regattas/${r.id}`} className="block hover:underline">
                    <div className="text-[10px] uppercase text-gray-400 flex items-center justify-center gap-1">
                      {d.toLocaleString('ro-RO', { month: 'short' })}
                      {frozen && <Lock size={9} />}
                    </div>
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
            const orphans = orphansByTeam[team.id] || []
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
                  const isOccasional = m.membership_type === 'occasional'
                  const isPunctual = m.membership_type === 'punctual'
                  return (
                    <ParticipantRow
                      key={m.id}
                      participantId={p.id}
                      participantName={p.full_name}
                      teamId={team.id}
                      membershipId={m.id}
                      canHide={isOccasional || isPunctual}
                      isOccasional={isOccasional}
                      isPunctual={isPunctual}
                      lockedRegattaIds={punctualLockMap[p.id]}
                      regattas={regattas}
                      partMap={partMap}
                      busy={busy}
                      frozenIds={frozenIds}
                      onCycleStatus={cycleStatus}
                      onToggleCrewlist={toggleCrewlist}
                      onHide={hideMember}
                    />
                  )
                })}
                {/* Placeholder-uri: membri ascunsi (orfani) — anonimi, doar istoric */}
                {orphans.map((pid, idx) => (
                  <ParticipantRow
                    key={`ph-${team.id}-${pid}`}
                    participantId={pid}
                    participantName={`Crew ascuns #${idx + 1}`}
                    teamId={team.id}
                    isPlaceholder
                    isOccasional={false}
                    regattas={regattas}
                    partMap={partMap}
                    busy={busy}
                    frozenIds={frozenIds}
                    onCycleStatus={cycleStatus}
                    onToggleCrewlist={toggleCrewlist}
                  />
                ))}
              </>
            )
          })}

          {/* Sectiune Nealocati (la baza) */}
          {visibleUnallocated.length > 0 && (
            <>
              <tr style={{ background: '#6B7280' }}>
                <td colSpan={regattas.length + 1} className="px-3 py-2 text-white font-semibold sticky left-0 z-10" style={{ background: '#6B7280' }}>
                  Nealocați
                  <span className="text-white/70 text-xs font-normal ml-2">({visibleUnallocated.length} participanți fără echipă)</span>
                </td>
              </tr>
              {visibleUnallocated.map((p) => (
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
                  frozenIds={frozenIds}
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
        <div>🙈 <strong>Hide</strong> (ocazional/one-time): mută persoana la nealocați; rândul rămâne ca placeholder anonim, cu istoricul.</div>
        <div>🔒 <strong>Regate trecute</strong>: editabile doar cu confirmare (corecție istoric).</div>
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
  participantId, participantName, teamId, membershipId, canHide, isOccasional, isPunctual, isUnallocated, isPlaceholder, lockedRegattaIds, regattas, partMap, busy, frozenIds, onCycleStatus, onToggleCrewlist, onHide,
}: {
  participantId: string
  participantName: string
  teamId: string | null
  membershipId?: string
  canHide?: boolean
  isOccasional: boolean
  isPunctual?: boolean
  isUnallocated?: boolean
  isPlaceholder?: boolean
  lockedRegattaIds?: Set<string>
  regattas: Regatta[]
  partMap: Record<string, Participation>
  busy: string | null
  frozenIds: Set<string>
  onCycleStatus: (rId: string, pId: string, tId: string | null) => void
  onToggleCrewlist: (rId: string, pId: string, tId: string | null) => void
  onHide?: (membershipId: string, name: string) => void
}) {
  return (
    <tr style={{ borderTop: '1px solid #f3f4f6', background: isPlaceholder ? '#fafafa' : undefined }}>
      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: isPlaceholder ? '#fafafa' : '#fff' }}>
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            {isPlaceholder ? (
              <span className="text-gray-400 italic inline-flex items-center gap-1">
                <EyeOff size={11} /> {participantName}
              </span>
            ) : (
              <Link href={`/ssyt/admin/participants/${participantId}`} className="hover:underline" style={{ color: '#0a1628' }}>
                {participantName}
              </Link>
            )}
            {isOccasional && (
              <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(0,168,181,0.12)', color: '#00A8B5' }}>
                occ
              </span>
            )}
            {isPunctual && (
              <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                1×
              </span>
            )}
            {isUnallocated && (
              <span className="ml-1.5 text-[9px] uppercase tracking-wider px-1 py-0.5 rounded" style={{ background: 'rgba(107,114,128,0.15)', color: '#6B7280' }}>
                fără echipă
              </span>
            )}
          </div>
          {canHide && membershipId && onHide && (
            <button
              onClick={() => onHide(membershipId, participantName)}
              disabled={busy === `hide-${membershipId}`}
              className="flex-shrink-0 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
              title="Ascunde: mută la nealocați, păstrează istoricul ca placeholder anonim"
            >
              <EyeOff size={11} /> hide
            </button>
          )}
        </div>
      </td>
      {regattas.map((r) => {
        const key = `${r.id}_${participantId}`
        const part = partMap[key]
        const status = part?.confirmation_status
        const onCrewlist = part?.on_crewlist || false
        const isBusy = busy === key
        const isConfirmed = status === 'confirmed'
        const frozen = frozenIds.has(r.id)
        const lockedPunctual = lockedRegattaIds?.has(r.id) ?? false

        // Status: editabil chiar si pe regate trecute (cu confirm), dar nu pe lock punctual.
        // Pentru placeholder: doar celule cu participare existenta (nu adaugam istoric nou gol).
        const statusDisabled = isBusy || lockedPunctual || (isPlaceholder && !part)
        // Crewlist: read-only pe regate trecute si placeholder
        const crewlistDisabled = isBusy || frozen || lockedPunctual || isPlaceholder || !isConfirmed || !part?.team_id

        const cellTitle = lockedPunctual
          ? 'One-time — regată ulterioară regatei membrului'
          : frozen
            ? 'Regată trecută — click cu confirmare'
            : undefined

        return (
          <td
            key={r.id}
            className="p-1"
            style={{ opacity: (frozen || lockedPunctual) ? 0.5 : 1 }}
            title={cellTitle}
          >
            <div className="flex items-center justify-center gap-1">
              <StatusCell
                status={status}
                onClick={() => onCycleStatus(r.id, participantId, teamId)}
                disabled={statusDisabled}
              />
              <CrewlistIcon
                onCrewlist={onCrewlist}
                isConfirmed={isConfirmed}
                hasTeam={!!part?.team_id}
                onClick={() => onToggleCrewlist(r.id, participantId, teamId)}
                disabled={crewlistDisabled}
                hidden={isPlaceholder}
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

function CrewlistIcon({ onCrewlist, isConfirmed, hasTeam, onClick, disabled, hidden }: { onCrewlist: boolean; isConfirmed: boolean; hasTeam: boolean; onClick: () => void; disabled: boolean; hidden?: boolean }) {
  if (hidden) return <span className="w-6 h-6 inline-block" />
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
