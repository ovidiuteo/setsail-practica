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
  team_id: string
  confirmation_status: string
  attendance_type: string | null
  on_crewlist?: boolean
  participant: { id: string; full_name: string; first_name: string; last_name: string } | { id: string; full_name: string; first_name: string; last_name: string }[] | null
}

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
  regattas, teams, memberships, participation,
}: {
  regattas: Regatta[]
  teams: Team[]
  memberships: Membership[]
  participation: Participation[]
}) {
  const router = useRouter()
  const [pickerOpen, setPickerOpen] = useState<{ regattaId: string; teamId: string; replaceParticipationId?: string } | null>(null)
  const [busy, setBusy] = useState(false)

  function buildSlots(regattaId: string, team: Team): Slot[] {
    const slots: Slot[] = []
    const coreMembers = memberships.filter((m) => m.team_id === team.id)
    const coreIds = new Set(coreMembers.map((m) => getMembershipParticipant(m)?.id).filter(Boolean))

    // 1. Membrii core: doar cei confirmed sau tentative apar
    for (const m of coreMembers) {
      const p = getMembershipParticipant(m)
      if (!p) continue
      const part = participation.find((x) => x.regatta_id === regattaId && x.participant_id === p.id)
      const status = part?.confirmation_status

      // Skip pe declined - nu apar in barci
      if (status === 'declined') continue

      // Skipper-ul intotdeauna apare (chiar daca nu are inregistrare)
      // Pentru ceilalti, daca status e undefined ii sarim
      if (status === 'confirmed') {
        slots.push({
          kind: 'core',
          participantId: p.id,
          participantName: p.full_name,
          firstName: p.first_name,
          lastName: p.last_name,
          participationId: part?.id,
          status: 'confirmed',
          onCrewlist: part?.on_crewlist || false,
          isSkipper: p.id === team.skipper_id,
        })
      } else if (status === 'tentative') {
        slots.push({
          kind: 'tentative',
          participantId: p.id,
          participantName: p.full_name,
          firstName: p.first_name,
          lastName: p.last_name,
          participationId: part?.id,
          status: 'tentative',
          onCrewlist: false,
          isSkipper: p.id === team.skipper_id,
        })
      } else if (p.id === team.skipper_id) {
        // Skipper fara inregistrare - tot apare (default confirmed)
        slots.push({
          kind: 'core',
          participantId: p.id,
          participantName: p.full_name,
          firstName: p.first_name,
          lastName: p.last_name,
          participationId: part?.id,
          status: 'confirmed',
          onCrewlist: part?.on_crewlist || false,
          isSkipper: true,
        })
      }
      // Altfel (status null/pending pentru non-skipper) - nu il afisez, ramane slot gol
    }

    // 2. Occasionals: participation cu team_id = aceasta echipa + status confirmed
    const occParticipations = participation.filter(
      (x) => x.regatta_id === regattaId && x.team_id === team.id && !coreIds.has(x.participant_id) && x.confirmation_status === 'confirmed'
    )
    for (const occ of occParticipations) {
      const p = getParticipant(occ)
      if (!p) continue
      slots.push({
        kind: 'occasional',
        participantId: p.id,
        participantName: p.full_name,
        firstName: p.first_name,
        lastName: p.last_name,
        participationId: occ.id,
        status: 'confirmed',
        onCrewlist: occ.on_crewlist || false,
        isSkipper: false,
      })
    }

    // Sortare: skipper > core verde > occasional azur > tentative galben
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

    // Umplem cu sloturi goale pana la 10
    while (slots.length < SLOTS_PER_BOAT) {
      slots.push({ kind: 'empty' })
    }
    return slots.slice(0, SLOTS_PER_BOAT)
  }

  function getAvailableForSlot(regattaId: string, teamId: string, excludeParticipationId?: string) {
    const allMembers = memberships.map((m) => {
      const p = getMembershipParticipant(m)
      if (!p) return null
      return { participant_id: p.id, full_name: p.full_name, team_id: m.team_id }
    }).filter(Boolean) as { participant_id: string; full_name: string; team_id: string }[]

    // Cei deja pe aceasta barca cu status confirmed (vizibili in slot)
    const alreadyOnBoat = new Set<string>()
    participation.forEach((x) => {
      if (x.regatta_id === regattaId && x.team_id === teamId && x.confirmation_status === 'confirmed') {
        if (x.id !== excludeParticipationId) {
          alreadyOnBoat.add(x.participant_id)
        }
      }
    })
    // Si membrii core ai echipei cu status confirmed (deja vizibili)
    memberships.filter((m) => m.team_id === teamId).forEach((m) => {
      const p = getMembershipParticipant(m)
      if (p) {
        const part = participation.find((x) => x.regatta_id === regattaId && x.participant_id === p.id)
        if (part?.confirmation_status === 'confirmed' && part.id !== excludeParticipationId) {
          alreadyOnBoat.add(p.id)
        }
      }
    })

    const teamNameMap: Record<string, string> = {}
    teams.forEach((t) => { teamNameMap[t.id] = t.short_name || t.name })

    return allMembers
      .filter((m) => !alreadyOnBoat.has(m.participant_id))
      .map((m) => {
        const part = participation.find((p) => p.regatta_id === regattaId && p.participant_id === m.participant_id)
        return {
          id: m.participant_id,
          full_name: m.full_name,
          teamId: m.team_id,
          teamName: teamNameMap[m.team_id] || null,
          status: part?.confirmation_status || 'fără',
          isOnCrewlistOtherTeam: part?.on_crewlist && part.team_id !== teamId,
          otherTeamName: part?.on_crewlist && part.team_id !== teamId ? teamNameMap[part.team_id] : null,
        }
      })
      .sort((a, b) => {
        const rank = (p: typeof a) => {
          if (p.status === 'confirmed') return 0
          if (p.status === 'tentative') return 1
          if (p.status === 'declined') return 3
          return 2
        }
        const diff = rank(a) - rank(b)
        if (diff !== 0) return diff
        return a.full_name.localeCompare(b.full_name, 'ro')
      })
  }

  async function addToBoat(regattaId: string, teamId: string, participantId: string, replaceParticipationId?: string) {
    setBusy(true)

    // Daca inlocuim un tentative existent (peste care selectam ad-hoc)
    // Nu il stergem - il lasam ca tentative dar adaugam separatul ca occasional
    // (asta inseamna ca tentative-ul persista in baza de date)

    const existing = participation.find(
      (p) => p.regatta_id === regattaId && p.participant_id === participantId
    )

    if (existing) {
      const isOriginalTeam = existing.team_id === teamId
      const updates: any = {
        team_id: teamId,
        on_crewlist: true,
        confirmation_status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      }
      if (!isOriginalTeam) {
        updates.attendance_type = 'occasional'
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
    const { error } = await supabase.from('ssyt_regatta_participation').delete().eq('id', participationId)
    if (error) { alert(error.message); setBusy(false); return }
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
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
        <div className="mt-2 text-gray-500">
          💡 Click pe iconița <UserCheck size={11} className="inline" /> din slot verde/azur pentru a comuta crewlist.
          Click pe slot galben sau gri pentru a selecta un participant ad-hoc.
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
                      <Link href={`/ssyt/admin/teams/${team.id}`} className="font-semibold text-sm hover:underline truncate">
                        {team.short_name || team.name}
                      </Link>
                      {boat && (
                        <Link href={`/ssyt/admin/boats/${boat.id}`} className="text-xs text-white/70 hover:underline mt-0.5 inline-flex items-center gap-1">
                          <Sailboat size={10} /> {boat.name}
                        </Link>
                      )}
                      <div className="text-xs text-white/60 mt-1">
                        Crewlist: {onCrewlistCount}/{SLOTS_PER_BOAT}
                      </div>
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
                              title="Loc liber - click pentru a adăuga ad-hoc"
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

function FilledSlot({
  slot, onToggleCrewlist, onRemoveOccasional, disabled,
}: {
  slot: Slot
  onToggleCrewlist: () => void
  onRemoveOccasional: () => void
  disabled: boolean
}) {
  // Background dupa kind
  const background = slot.kind === 'occasional' ? '#7DD3FC' : '#10B981'
  const textColor = slot.kind === 'occasional' ? '#0a1628' : '#fff'

  // Border: verde daca pe crewlist, gri daca nu
  const borderColor = slot.onCrewlist ? '#10B981' : '#D1D5DB'
  const borderWidth = 3

  const initials = (slot.firstName?.[0] || '') + (slot.lastName?.[0] || '')

  return (
    <div
      className="rounded relative group flex flex-col justify-center items-center text-center p-1"
      style={{
        background,
        color: textColor,
        minHeight: 70,
        border: `${borderWidth}px solid ${borderColor}`,
      }}
      title={
        (slot.participantName || '') +
        (slot.isSkipper ? ' · skipper' : '') +
        (slot.kind === 'occasional' ? ' · occasional' : '') +
        (slot.onCrewlist ? ' · pe crewlist' : ' · neînscris')
      }
    >
      {slot.isSkipper && (
        <Crown size={11} className="absolute top-0.5 left-0.5" style={{ color: '#FF6B35' }} />
      )}

      <button
        onClick={(e) => { e.stopPropagation(); onToggleCrewlist() }}
        disabled={disabled}
        className="absolute top-0.5 right-0.5 rounded p-0.5 transition hover:bg-black/15 disabled:opacity-50"
        title={slot.onCrewlist ? 'Pe crewlist — click pentru a scoate' : 'Click pentru a pune pe crewlist'}
      >
        <UserCheck
          size={12}
          style={{ color: slot.onCrewlist ? (slot.kind === 'occasional' ? '#10B981' : '#fff') : (slot.kind === 'occasional' ? '#6B7280' : 'rgba(255,255,255,0.5)') }}
          fill={slot.onCrewlist ? 'currentColor' : 'none'}
        />
      </button>

      <div className="text-[10px] font-semibold uppercase opacity-90 mt-2">
        {initials.toUpperCase() || '?'}
      </div>
      <div className="text-[10px] leading-tight font-medium mt-0.5" style={{ wordBreak: 'break-word', lineHeight: '1.1' }}>
        {slot.lastName}
      </div>
      <div className="text-[9px] opacity-80 leading-none">
        {slot.firstName}
      </div>

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
      style={{
        background: '#FEF3C7',  // galben pal
        color: '#92400E',
        minHeight: 70,
        border: '2px solid #D1D5DB',  // gri
        cursor: 'pointer',
      }}
      title={`${slot.participantName} — tentative. Click pentru a selecta ad-hoc peste el.`}
    >
      <div className="text-[10px] font-semibold uppercase opacity-80 mt-1">
        {initials.toUpperCase() || '?'}
      </div>
      <div className="text-[10px] leading-tight font-medium mt-0.5" style={{ wordBreak: 'break-word', lineHeight: '1.1' }}>
        {slot.lastName}
      </div>
      <div className="text-[9px] opacity-80 leading-none">
        {slot.firstName}
      </div>
      <div className="text-[8px] uppercase tracking-wider opacity-60 mt-0.5">tentative</div>
    </button>
  )
}

function PickerModal({
  available, regattaName, teamName, teamColor, isReplacingTentative, onClose, onSelect,
}: {
  available: { id: string; full_name: string; teamId: string | null; teamName: string | null; status: string; isOnCrewlistOtherTeam?: boolean; otherTeamName?: string | null }[]
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

  const STATUS_COLORS: Record<string, string> = {
    confirmed: '#10B981',
    tentative: '#F59E0B',
    pending: '#F59E0B',
    'fără': '#D1D5DB',
    declined: '#EF4444',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h3 className="font-semibold tracking-tight" style={{ color: '#0a1628' }}>
              {isReplacingTentative ? 'Înlocuiește tentative' : 'Adaugă ad-hoc pe barcă'}
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
            <div className="text-center py-8 text-sm text-gray-400 italic">
              Niciun participant disponibil.
            </div>
          ) : (
            <div className="space-y-1">
              {list.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className="w-full text-left p-3 rounded-md hover:bg-gray-50 transition flex items-center gap-3"
                  style={{ border: '1px solid #e5e7eb' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm" style={{ color: '#0a1628' }}>{p.full_name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Echipă: {p.teamName || '—'}
                      {p.isOnCrewlistOtherTeam && (
                        <span className="ml-2 text-amber-600">⚠ deja pe crewlist {p.otherTeamName}</span>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                    style={{ background: `${STATUS_COLORS[p.status]}15`, color: STATUS_COLORS[p.status] }}
                  >
                    {p.status}
                  </span>
                </button>
              ))}
            </div>
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
          💡 Adăugat ad-hoc → apare azur cu chenar verde (pe crewlist).
          {isReplacingTentative && ' Tentative-ul original rămâne în matricea Membri, dar nu mai apare pe această barcă.'}
        </div>
      </div>
    </div>
  )
}

function LegendItem({ bg, border, label, dashed }: { bg: string; border: string; label: string; dashed?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="w-5 h-5 rounded"
        style={{
          background: bg,
          border: `2px ${dashed ? 'dashed' : 'solid'} ${border}`,
        }}
      ></span>
      <span className="text-gray-700">{label}</span>
    </span>
  )
}