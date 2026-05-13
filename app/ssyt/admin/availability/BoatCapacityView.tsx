'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, X, UserPlus, Sailboat, UserCheck } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Regatta = { id: string; name: string; short_name: string | null; start_date: string; end_date: string | null; event_type: string; status: string }
type Team = {
  id: string
  name: string
  short_name: string | null
  color_primary: string | null
  display_order: number
  skipper_id: string | null
  boat?: { id: string; name: string; capacity: number | null } | { id: string; name: string; capacity: number | null }[] | null
}
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
  participant: { id: string; full_name: string; first_name: string; last_name: string } | { id: string; full_name: string; first_name: string; last_name: string }[] | null
}
type UnallocatedParticipant = { id: string; full_name: string; first_name: string; last_name: string }

const SLOTS_PER_BOAT = 10

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}
function getParticipant(p: { participant: any }) { return asObject(p.participant) }
function getMembershipParticipant(m: Membership) { return asObject(m.participant) }
function getBoat(t: Team) { return asObject(t.boat) }

type Slot = {
  kind: 'core' | 'occasional' | 'tentative' | 'empty'
  participantId?: string
  participantName?: string
  firstName?: string
  lastName?: string
  participationId?: string
  status?: string
  onCrewlist?: boolean
  isSkipper?: boolean
}

export default function BoatCapacityView({
  regattas, teams, memberships, participation, unallocatedParticipants,
}: {
  regattas: Regatta[]
  teams: Team[]
  memberships: Membership[]
  participation: Participation[]
  unallocatedParticipants: UnallocatedParticipant[]
}) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState<{ regattaId: string; teamId: string; replaceParticipationId?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function buildSlots(regattaId: string, team: Team): Slot[] {
    const slots: Slot[] = []
    const coreMembers = memberships.filter((m) => m.team_id === team.id)
    const coreIds = new Set(coreMembers.map((m) => getMembershipParticipant(m)?.id).filter(Boolean))

    for (const m of coreMembers) {
      const p = getMembershipParticipant(m)
      if (!p) continue
      const part = participation.find((x) => x.regatta_id === regattaId && x.participant_id === p.id)
      const status = part?.confirmation_status

      if (status === 'declined') continue

      if (status === 'confirmed') {
        slots.push({
          kind: 'core',
          participantId: p.id, participantName: p.full_name, firstName: p.first_name, lastName: p.last_name,
          participationId: part?.id, status: 'confirmed', onCrewlist: part?.on_crewlist || false,
          isSkipper: p.id === team.skipper_id,
        })
      } else if (status === 'tentative') {
        slots.push({
          kind: 'tentative',
          participantId: p.id, participantName: p.full_name, firstName: p.first_name, lastName: p.last_name,
          participationId: part?.id, status: 'tentative', onCrewlist: false,
          isSkipper: p.id === team.skipper_id,
        })
      } else if (p.id === team.skipper_id) {
        slots.push({
          kind: 'core',
          participantId: p.id, participantName: p.full_name, firstName: p.first_name, lastName: p.last_name,
          participationId: part?.id, status: 'confirmed', onCrewlist: part?.on_crewlist || false,
          isSkipper: true,
        })
      }
    }

    // Occasionals: participation cu team_id = aceasta echipa + status confirmed + nu sunt core
    const occParticipations = participation.filter(
      (x) => x.regatta_id === regattaId && x.team_id === team.id && !coreIds.has(x.participant_id) && x.confirmation_status === 'confirmed'
    )
    for (const occ of occParticipations) {
      const p = getParticipant(occ)
      if (!p) continue
      slots.push({
        kind: 'occasional',
        participantId: p.id, participantName: p.full_name, firstName: p.first_name, lastName: p.last_name,
        participationId: occ.id, status: 'confirmed', onCrewlist: occ.on_crewlist || false,
        isSkipper: false,
      })
    }

    slots.sort((a, b) => {
      if (a.isSkipper && !b.isSkipper) return -1
      if (b.isSkipper && !a.isSkipper) return 1
      const rank = (s: Slot) => {
        if (s.kind === 'core' && s.status === 'confirmed') return 0
        if (s.kind === 'occasional') return 1
        if (s.kind === 'tentative') return 2
        return 3
      }
      const diff = rank(a) - rank(b)
      if (diff !== 0) return diff
      return (a.participantName || '').localeCompare(b.participantName || '', 'ro')
    })

    while (slots.length < SLOTS_PER_BOAT) {
      slots.push({ kind: 'empty' })
    }
    return slots.slice(0, SLOTS_PER_BOAT)
  }

  // Picker cu prioritizare:
  // 1. Nealocati confirmed pentru regatta (bulina verde)
  // 2. Nealocati tentative pentru regatta (bulina galbena)
  // 3. Membri alte echipe confirmed
  // 4. Membri alte echipe tentative
  // 5. Restul (fara confirmare, declined)
  function getAvailableForSlot(regattaId: string, teamId: string, excludeParticipationId?: string) {
    const teamNameMap: Record<string, string> = {}
    teams.forEach((t) => { teamNameMap[t.id] = t.short_name || t.name })

    // Cei deja pe aceasta barca cu confirmed
    const alreadyOnBoat = new Set<string>()
    participation.forEach((x) => {
      if (x.regatta_id === regattaId && x.team_id === teamId && x.confirmation_status === 'confirmed' && x.id !== excludeParticipationId) {
        alreadyOnBoat.add(x.participant_id)
      }
    })
    memberships.filter((m) => m.team_id === teamId).forEach((m) => {
      const p = getMembershipParticipant(m)
      if (p) {
        const part = participation.find((x) => x.regatta_id === regattaId && x.participant_id === p.id)
        if (part?.confirmation_status === 'confirmed' && part.id !== excludeParticipationId) {
          alreadyOnBoat.add(p.id)
        }
      }
    })

    type Candidate = {
      id: string
      full_name: string
      teamId: string | null
      teamName: string | null
      status: string
      category: 'unallocated' | 'other_team'
      priorityRank: number
    }
    const candidates: Candidate[] = []

    // 1. Nealocatii
    for (const u of unallocatedParticipants) {
      if (alreadyOnBoat.has(u.id)) continue
      const part = participation.find((p) => p.regatta_id === regattaId && p.participant_id === u.id)
      const status = part?.confirmation_status || 'fără'
      let rank = 99
      if (status === 'confirmed') rank = 0       // top: nealocat disponibil
      else if (status === 'tentative') rank = 1  // nealocat indecis
      else if (status === 'fără') rank = 4
      else if (status === 'declined') rank = 5

      candidates.push({
        id: u.id, full_name: u.full_name,
        teamId: null, teamName: 'Nealocat',
        status, category: 'unallocated', priorityRank: rank,
      })
    }

    // 2. Membrii altor echipe
    const allMembers = memberships.map((m) => {
      const p = getMembershipParticipant(m)
      if (!p) return null
      return { participant_id: p.id, full_name: p.full_name, team_id: m.team_id }
    }).filter(Boolean) as { participant_id: string; full_name: string; team_id: string }[]

    for (const m of allMembers) {
      if (alreadyOnBoat.has(m.participant_id)) continue
      const part = participation.find((p) => p.regatta_id === regattaId && p.participant_id === m.participant_id)
      const status = part?.confirmation_status || 'fără'
      let rank = 99
      if (m.team_id === teamId) {
        // Membri ai echipei dar fara confirmare confirmed (rezervi - cei tentative sau fără)
        if (status === 'tentative') rank = 1.5
        else if (status === 'fără') rank = 2
        else if (status === 'declined') rank = 5
      } else {
        // Alte echipe
        if (status === 'confirmed') rank = 2.5
        else if (status === 'tentative') rank = 3
        else if (status === 'fără') rank = 4
        else if (status === 'declined') rank = 5
      }

      candidates.push({
        id: m.participant_id, full_name: m.full_name,
        teamId: m.team_id, teamName: teamNameMap[m.team_id] || '—',
        status, category: 'other_team', priorityRank: rank,
      })
    }

    return candidates.sort((a, b) => {
      if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank
      return a.full_name.localeCompare(b.full_name, 'ro')
    })
  }

  async function addToBoat(regattaId: string, teamId: string, participantId: string, replaceParticipationId?: string) {
    setBusy(true)
    const existing = participation.find(
      (p) => p.regatta_id === regattaId && p.participant_id === participantId
    )

    if (existing) {
      const updates: any = {
        team_id: teamId,
        on_crewlist: true,
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
        attendance_type: 'occasional',
      }
      const { error } = await supabase.from('ssyt_regatta_participation').update(updates).eq('id', existing.id)
      if (error) { alert(error.message); setBusy(false); return }
    } else {
      const { error } = await supabase.from('ssyt_regatta_participation').insert({
        regatta_id: regattaId,
        participant_id: participantId,
        team_id: teamId,
        confirmation_status: 'confirmed',
        attendance_type: 'occasional',
        on_crewlist: true,
        confirmed_at: new Date().toISOString(),
      })
      if (error) { alert(error.message); setBusy(false); return }
    }
    setBusy(false)
    setPickerOpen(null)
    router.refresh()
  }

  async function toggleCrewlist(slot: Slot) {
    if (!slot.participationId || slot.status !== 'confirmed') return
    setBusy(true)
    const { error } = await supabase
      .from('ssyt_regatta_participation')
      .update({ on_crewlist: !slot.onCrewlist })
      .eq('id', slot.participationId)
    if (error) { alert(error.message); setBusy(false); return }
    setBusy(false)
    router.refresh()
  }

  async function removeOccasional(participationId: string) {
    if (!confirm('Scoți participantul ad-hoc de pe această barcă?')) return
    setBusy(true)
    // In loc sa stergem, il scoate de pe barca: team_id = null + on_crewlist = false
    // Asta pastreaza istoricul de disponibilitate
    const { error } = await supabase
      .from('ssyt_regatta_participation')
      .update({ team_id: null, on_crewlist: false, attendance_type: 'occasional' })
      .eq('id', participationId)
    if (error) { alert(error.message); setBusy(false); return }
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      <div className="rounded-lg p-3 text-xs" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div className="font-medium uppercase tracking-wider text-gray-500 mb-2">Legendă</div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <LegendItem bg="#10B981" border="#10B981" label="Disponibil + pe crewlist" />
          <LegendItem bg="#10B981" border="#D1D5DB" label="Disponibil + neînscris" />
          <LegendItem bg="#7DD3FC" border="#10B981" label="Ad-hoc + pe crewlist" />
          <LegendItem bg="#7DD3FC" border="#D1D5DB" label="Ad-hoc + neînscris" />
          <LegendItem bg="#FEF3C7" border="#D1D5DB" label="Tentative (click → ad-hoc)" />
          <LegendItem bg="#F3F4F6" border="#D1D5DB" dashed label="Loc liber" />
        </div>
      </div>

      {regattas.map((r) => {
        const d1 = new Date(r.start_date)
        const d2 = r.end_date ? new Date(r.end_date) : null
        return (
          <section key={r.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3" style={{ background: '#0a1628', color: '#fff' }}>
              <div>
                <Link href={`/ssyt/admin/regattas/${r.id}`} className="font-semibold tracking-tight hover:underline">
                  {r.name}
                </Link>
                <div className="text-xs text-white/60 mt-0.5">
                  {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}
                  {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
                </div>
              </div>
              <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: 'rgba(255,107,53,0.2)', color: '#FF6B35' }}>
                {r.event_type}
              </span>
            </div>

            <div>
              {teams.map((team) => {
                const boat = getBoat(team)
                const slots = buildSlots(r.id, team)
                const onCrewlistCount = slots.filter((s) => s.onCrewlist).length
                return (
                  <div key={team.id} className="flex items-stretch border-t" style={{ borderColor: '#e5e7eb' }}>
                    <div className="w-40 flex-shrink-0 p-3 flex flex-col justify-center" style={{ background: team.color_primary || '#4A5568', color: '#fff' }}>
                      {boat ? (
                        <Link href={`/ssyt/admin/boats/${boat.id}`} className="font-semibold text-sm hover:underline truncate inline-flex items-center gap-1.5">
                          <Sailboat size={12} />
                          {boat.name}
                        </Link>
                      ) : (
                        <span className="font-semibold text-sm truncate">{team.short_name || team.name}</span>
                      )}
                      <Link href={`/ssyt/admin/teams/${team.id}`} className="text-xs text-white/70 hover:underline mt-0.5 truncate">
                        Team {team.short_name || team.name}
                      </Link>
                      <div className="text-xs text-white/60 mt-1">Crewlist: {onCrewlistCount}/{SLOTS_PER_BOAT}</div>
                    </div>

                    <div className="flex-1 grid grid-cols-10 gap-1 p-2">
                      {slots.map((slot, idx) => {
                        if (slot.kind === 'empty') {
                          return (
                            <button
                              key={`empty-${idx}`}
                              onClick={() => setPickerOpen({ regattaId: r.id, teamId: team.id })}
                              disabled={busy}
                              className="rounded p-1.5 text-xs flex items-center justify-center transition hover:bg-gray-200 disabled:opacity-50"
                              style={{ background: '#F3F4F6', border: '1px dashed #d1d5db', minHeight: 70 }}
                              title="Loc liber - click pentru a adăuga"
                            >
                              <UserPlus size={14} className="text-gray-400" />
                            </button>
                          )
                        }
                        if (slot.kind === 'tentative') {
                          return (
                            <TentativeSlot
                              key={`t-${slot.participantId}-${idx}`}
                              slot={slot}
                              onClick={() => setPickerOpen({ regattaId: r.id, teamId: team.id, replaceParticipationId: slot.participationId })}
                              disabled={busy}
                            />
                          )
                        }
                        return (
                          <FilledSlot
                            key={`s-${slot.participantId}-${idx}`}
                            slot={slot}
                            onToggleCrewlist={() => toggleCrewlist(slot)}
                            onRemoveOccasional={() => slot.participationId && removeOccasional(slot.participationId)}
                            disabled={busy}
                          />
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}

      {pickerOpen && (
        <PickerModal
          available={getAvailableForSlot(pickerOpen.regattaId, pickerOpen.teamId, pickerOpen.replaceParticipationId)}
          regattaName={regattas.find((r) => r.id === pickerOpen.regattaId)?.name || ''}
          teamName={teams.find((t) => t.id === pickerOpen.teamId)?.name || ''}
          teamColor={teams.find((t) => t.id === pickerOpen.teamId)?.color_primary || '#4A5568'}
          isReplacingTentative={!!pickerOpen.replaceParticipationId}
          onClose={() => setPickerOpen(null)}
          onSelect={(participantId) => addToBoat(pickerOpen.regattaId, pickerOpen.teamId, participantId, pickerOpen.replaceParticipationId)}
        />
      )}
    </div>
  )
}

function FilledSlot({ slot, onToggleCrewlist, onRemoveOccasional, disabled }: { slot: Slot; onToggleCrewlist: () => void; onRemoveOccasional: () => void; disabled: boolean }) {
  const background = slot.kind === 'occasional' ? '#7DD3FC' : '#10B981'
  const textColor = slot.kind === 'occasional' ? '#0a1628' : '#fff'
  const borderColor = slot.onCrewlist ? '#10B981' : '#D1D5DB'
  const initials = (slot.firstName?.[0] || '') + (slot.lastName?.[0] || '')

  return (
    <div
      className="rounded relative group flex flex-col justify-center items-center text-center p-1"
      style={{ background, color: textColor, minHeight: 70, border: `3px solid ${borderColor}` }}
      title={(slot.participantName || '') + (slot.isSkipper ? ' · skipper' : '') + (slot.kind === 'occasional' ? ' · occasional' : '') + (slot.onCrewlist ? ' · pe crewlist' : ' · neînscris')}
    >
      {slot.isSkipper && (<Crown size={11} className="absolute top-0.5 left-0.5" style={{ color: '#FF6B35' }} />)}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleCrewlist() }}
        disabled={disabled}
        className="absolute top-0.5 right-0.5 rounded p-0.5 transition hover:bg-black/15 disabled:opacity-50"
        title={slot.onCrewlist ? 'Pe crewlist — click pentru a scoate' : 'Click pentru a pune pe crewlist'}
      >
        <UserCheck size={12} style={{ color: slot.onCrewlist ? (slot.kind === 'occasional' ? '#10B981' : '#fff') : (slot.kind === 'occasional' ? '#6B7280' : 'rgba(255,255,255,0.5)') }} fill={slot.onCrewlist ? 'currentColor' : 'none'} />
      </button>
      <div className="text-[10px] font-semibold uppercase opacity-90 mt-2">{initials.toUpperCase() || '?'}</div>
      <div className="text-[10px] leading-tight font-medium mt-0.5" style={{ wordBreak: 'break-word', lineHeight: '1.1' }}>{slot.lastName}</div>
      <div className="text-[9px] opacity-80 leading-none">{slot.firstName}</div>
      {slot.kind === 'occasional' && !slot.isSkipper && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveOccasional() }}
          disabled={disabled}
          className="absolute bottom-0.5 right-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded p-0.5 transition disabled:opacity-50"
          title="Scoate de pe această barcă"
        >
          <X size={9} style={{ color: textColor }} />
        </button>
      )}
    </div>
  )
}

function TentativeSlot({ slot, onClick, disabled }: { slot: Slot; onClick: () => void; disabled: boolean }) {
  const initials = (slot.firstName?.[0] || '') + (slot.lastName?.[0] || '')
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded relative flex flex-col justify-center items-center text-center p-1 transition hover:opacity-90 disabled:opacity-50"
      style={{ background: '#FEF3C7', color: '#92400E', minHeight: 70, border: '2px solid #D1D5DB', cursor: 'pointer' }}
      title={`${slot.participantName} — tentative. Click pentru a selecta altcineva ad-hoc.`}
    >
      <div className="text-[10px] font-semibold uppercase opacity-80 mt-1">{initials.toUpperCase() || '?'}</div>
      <div className="text-[10px] leading-tight font-medium mt-0.5" style={{ wordBreak: 'break-word', lineHeight: '1.1' }}>{slot.lastName}</div>
      <div className="text-[9px] opacity-80 leading-none">{slot.firstName}</div>
      <div className="text-[8px] uppercase tracking-wider opacity-60 mt-0.5">tentative</div>
    </button>
  )
}

function PickerModal({
  available, regattaName, teamName, teamColor, isReplacingTentative, onClose, onSelect,
}: {
  available: { id: string; full_name: string; teamId: string | null; teamName: string | null; status: string; category: 'unallocated' | 'other_team'; priorityRank: number }[]
  regattaName: string
  teamName: string
  teamColor: string
  isReplacingTentative: boolean
  onClose: () => void
  onSelect: (participantId: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [showDeclined, setShowDeclined] = useState(false)

  const filtered = available.filter((p) =>
    !filter || p.full_name.toLowerCase().includes(filter.toLowerCase())
  )
  const preferred = filtered.filter((p) => p.status !== 'declined')
  const declined = filtered.filter((p) => p.status === 'declined')
  const list = showDeclined ? filtered : preferred

  const unallocated = list.filter((p) => p.category === 'unallocated')
  const otherTeams = list.filter((p) => p.category === 'other_team')

  const STATUS_COLORS: Record<string, string> = {
    confirmed: '#10B981',
    tentative: '#F59E0B',
    'fără': '#D1D5DB',
    declined: '#EF4444',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h3 className="font-semibold tracking-tight" style={{ color: '#0a1628' }}>
              {isReplacingTentative ? 'Înlocuiește tentative' : 'Adaugă pe barcă'}
            </h3>
            <p className="text-xs text-gray-500 mt-1">
              <span style={{ color: teamColor, fontWeight: 600 }}>{teamName}</span> · {regattaName}
            </p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        <div className="p-4 border-b" style={{ borderColor: '#e5e7eb' }}>
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Caută participant..."
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {list.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400 italic">Niciun participant disponibil.</div>
          ) : (
            <>
              {/* Sectiune nealocati (prioritar) */}
              {unallocated.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 sticky top-0" style={{ background: 'rgba(16,185,129,0.08)' }}>
                    🎯 Nealocați (prioritar) — {unallocated.length}
                  </div>
                  <div className="space-y-1 mb-3">
                    {unallocated.map((p) => <PickerCard key={p.id} p={p} onSelect={onSelect} statusColors={STATUS_COLORS} />)}
                  </div>
                </>
              )}
              {/* Sectiune alte echipe */}
              {otherTeams.length > 0 && (
                <>
                  <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-gray-500 sticky top-0" style={{ background: '#f8f9fa' }}>
                    Din alte echipe / membri actuali — {otherTeams.length}
                  </div>
                  <div className="space-y-1">
                    {otherTeams.map((p) => <PickerCard key={p.id} p={p} onSelect={onSelect} statusColors={STATUS_COLORS} />)}
                  </div>
                </>
              )}
            </>
          )}

          {!showDeclined && declined.length > 0 && (
            <button
              onClick={() => setShowDeclined(true)}
              className="mt-3 w-full p-3 text-xs text-gray-500 hover:text-gray-900 italic"
            >
              + arată {declined.length} participanți care au declinat
            </button>
          )}
        </div>

        <div className="p-3 border-t text-xs text-gray-500" style={{ borderColor: '#e5e7eb', background: '#f8f9fa' }}>
          💡 Prioritate: nealocații disponibili 🟢, apoi cei indecisi 🟡. Adăugat ad-hoc → azur + pe crewlist.
        </div>
      </div>
    </div>
  )
}

function PickerCard({ p, onSelect, statusColors }: { p: any; onSelect: (id: string) => void; statusColors: Record<string, string> }) {
  const statusDot = statusColors[p.status] || '#D1D5DB'
  return (
    <button
      onClick={() => onSelect(p.id)}
      className="w-full text-left p-3 rounded-md hover:bg-gray-50 transition flex items-center gap-3"
      style={{ border: '1px solid #e5e7eb' }}
    >
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: statusDot }} title={p.status}></span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: '#0a1628' }}>{p.full_name}</div>
        <div className="text-xs text-gray-500 mt-0.5">
          {p.category === 'unallocated' ? 'Nealocat' : `Echipa: ${p.teamName}`}
        </div>
      </div>
      <span
        className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ background: `${statusDot}15`, color: statusDot }}
      >
        {p.status}
      </span>
    </button>
  )
}

function LegendItem({ bg, border, label, dashed }: { bg: string; border: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-5 h-5 rounded" style={{ background: bg, border: `2px ${dashed ? 'dashed' : 'solid'} ${border}` }}></span>
      <span className="text-gray-700">{label}</span>
    </span>
  )
}