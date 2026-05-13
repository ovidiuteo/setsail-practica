'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Crown, X, UserPlus, Sailboat, Trash2 } from 'lucide-react'
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
  participant: { id: string; full_name: string; first_name: string; last_name: string } | { id: string; full_name: string; first_name: string; last_name: string }[] | null
}

const SLOTS_PER_BOAT = 10

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

function getParticipant(p: { participant: any }) {
  return asObject(p.participant)
}

function getBoat(t: Team) {
  return asObject(t.boat)
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
  const [pickerOpen, setPickerOpen] = useState<{ regattaId: string; teamId: string } | null>(null)
  const [busy, setBusy] = useState(false)

  // Lookup: regatta_id × team_id → array de Participations confirmate sortate skipper-first
  function getOccupants(regattaId: string, teamId: string, skipperId: string | null): Participation[] {
    const confirmed = participation.filter(
      (p) => p.regatta_id === regattaId && p.team_id === teamId && p.confirmation_status === 'confirmed'
    )
    // Skipper-ul primul
    return confirmed.sort((a, b) => {
      if (a.participant_id === skipperId && b.participant_id !== skipperId) return -1
      if (b.participant_id === skipperId && a.participant_id !== skipperId) return 1
      // Apoi core inainte de occasional
      const aOcc = a.attendance_type === 'occasional' ? 1 : 0
      const bOcc = b.attendance_type === 'occasional' ? 1 : 0
      if (aOcc !== bOcc) return aOcc - bOcc
      // Apoi alfabetic
      const pa = getParticipant(a)
      const pb = getParticipant(b)
      return (pa?.full_name || '').localeCompare(pb?.full_name || '', 'ro')
    })
  }

  // Participanții disponibili pentru un slot (pentru picker)
  // Critique: vrem persoanele care nu sunt deja confirmate la barca asta pe regatta asta
  function getAvailableForSlot(regattaId: string, teamId: string): { id: string; full_name: string; teamId: string | null; teamName: string | null; status: string }[] {
    // Toți participanții cu un membership activ
    const allMembers = memberships.map((m) => {
      const p = getParticipant(m)
      if (!p) return null
      return { participant_id: p.id, full_name: p.full_name, team_id: m.team_id }
    }).filter(Boolean) as { participant_id: string; full_name: string; team_id: string }[]

    // Cei deja confirmati la barca curenta
    const alreadyOnBoat = new Set(
      participation
        .filter((p) => p.regatta_id === regattaId && p.team_id === teamId && p.confirmation_status === 'confirmed')
        .map((p) => p.participant_id)
    )

    // Map team_id → name
    const teamNameMap: Record<string, string> = {}
    teams.forEach((t) => { teamNameMap[t.id] = t.short_name || t.name })

    return allMembers
      .filter((m) => !alreadyOnBoat.has(m.participant_id))
      .map((m) => {
        // Determin status-ul lui pe aceasta regatta
        const part = participation.find((p) => p.regatta_id === regattaId && p.participant_id === m.participant_id)
        return {
          id: m.participant_id,
          full_name: m.full_name,
          teamId: m.team_id,
          teamName: teamNameMap[m.team_id] || null,
          status: part?.confirmation_status || 'fără confirmare',
        }
      })
      // Sort: cei confirmati la alta barca primii, apoi tentative, apoi pending/fără, apoi declined
      .sort((a, b) => {
        const rank = (s: string) => s === 'confirmed' ? 0 : s === 'tentative' ? 1 : s === 'pending' ? 2 : s === 'fără confirmare' ? 3 : 4
        const diff = rank(a.status) - rank(b.status)
        if (diff !== 0) return diff
        return a.full_name.localeCompare(b.full_name, 'ro')
      })
  }

  async function addToBoat(regattaId: string, teamId: string, participantId: string) {
    setBusy(true)
    // Verific daca exista deja inregistrare (poate cu status diferit)
    const existing = participation.find(
      (p) => p.regatta_id === regattaId && p.participant_id === participantId
    )

    if (existing) {
      // Update: mut pe noua echipa, status confirmed, attendance occasional
      const { error } = await supabase
        .from('ssyt_regatta_participation')
        .update({
          team_id: teamId,
          confirmation_status: 'confirmed',
          attendance_type: 'occasional',
          confirmed_at: new Date().toISOString(),
          notes: 'Adaugat ad-hoc pe barca din vizualizare capacitate',
        })
        .eq('id', existing.id)
      if (error) { alert(error.message); setBusy(false); return }
    } else {
      // Insert nou
      const { error } = await supabase
        .from('ssyt_regatta_participation')
        .insert({
          regatta_id: regattaId,
          participant_id: participantId,
          team_id: teamId,
          confirmation_status: 'confirmed',
          attendance_type: 'occasional',
          confirmed_at: new Date().toISOString(),
          notes: 'Adaugat ad-hoc pe barca din vizualizare capacitate',
        })
      if (error) { alert(error.message); setBusy(false); return }
    }

    setBusy(false)
    setPickerOpen(null)
    router.refresh()
  }

  async function removeFromBoat(participationId: string, isOccasional: boolean) {
    if (!confirm(isOccasional ? 'Scoți acest participant ad-hoc de pe barcă?' : 'Marchezi participantul ca declined pentru această regatta?')) return
    setBusy(true)
    if (isOccasional) {
      // Pentru occasional adaugat ad-hoc, sterg complet
      const { error } = await supabase.from('ssyt_regatta_participation').delete().eq('id', participationId)
      if (error) { alert(error.message); setBusy(false); return }
    } else {
      // Pentru core, doar marchez declined
      const { error } = await supabase
        .from('ssyt_regatta_participation')
        .update({ confirmation_status: 'declined', confirmed_at: null })
        .eq('id', participationId)
      if (error) { alert(error.message); setBusy(false); return }
    }
    setBusy(false)
    router.refresh()
  }

  return (
    <div className="space-y-8">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs">
        <LegendBox color="#10B981" label="Membru core confirmat" />
        <LegendBox color="#7DD3FC" label="Ad-hoc / occasional" />
        <LegendBox color="#F3F4F6" label="Loc liber (click)" border />
      </div>

      {regattas.map((r) => {
        const d1 = new Date(r.start_date)
        const d2 = r.end_date ? new Date(r.end_date) : null
        return (
          <section key={r.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            {/* Header regatta */}
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

            {/* Bărci pentru această regatta */}
            <div>
              {teams.map((team) => {
                const boat = getBoat(team)
                const occupants = getOccupants(r.id, team.id, team.skipper_id)
                const skipper = team.skipper_id
                  ? memberships.find((m) => m.participant_id === team.skipper_id)
                  : null
                const skipperParticipant = skipper ? getParticipant(skipper) : null

                return (
                  <div key={team.id} className="flex items-stretch border-t" style={{ borderColor: '#e5e7eb' }}>
                    {/* Team header (stânga) */}
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
                        {occupants.length}/{SLOTS_PER_BOAT}
                      </div>
                    </div>

                    {/* 10 sloturi */}
                    <div className="flex-1 grid grid-cols-10 gap-1 p-2">
                      {Array.from({ length: SLOTS_PER_BOAT }).map((_, idx) => {
                        const occupant = occupants[idx]
                        if (occupant) {
                          const part = getParticipant(occupant)
                          const isSkipper = occupant.participant_id === team.skipper_id
                          const isOccasional = occupant.attendance_type === 'occasional'
                          return (
                            <SlotCard
                              key={`occ-${occupant.id}`}
                              occupant={occupant}
                              participant={part}
                              isSkipper={isSkipper}
                              isOccasional={isOccasional}
                              onRemove={() => removeFromBoat(occupant.id, isOccasional)}
                              disabled={busy}
                            />
                          )
                        }
                        return (
                          <button
                            key={`empty-${idx}`}
                            onClick={() => setPickerOpen({ regattaId: r.id, teamId: team.id })}
                            disabled={busy}
                            className="rounded p-1.5 text-xs flex items-center justify-center transition hover:bg-gray-200 disabled:opacity-50"
                            style={{ background: '#F3F4F6', border: '1px dashed #d1d5db', minHeight: 60 }}
                            title="Click pentru a adăuga un participant"
                          >
                            <UserPlus size={14} className="text-gray-400" />
                          </button>
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

      {/* Picker modal */}
      {pickerOpen && (
        <PickerModal
          available={getAvailableForSlot(pickerOpen.regattaId, pickerOpen.teamId)}
          regattaName={regattas.find((r) => r.id === pickerOpen.regattaId)?.name || ''}
          teamName={teams.find((t) => t.id === pickerOpen.teamId)?.name || ''}
          teamColor={teams.find((t) => t.id === pickerOpen.teamId)?.color_primary || '#4A5568'}
          onClose={() => setPickerOpen(null)}
          onSelect={(participantId) => addToBoat(pickerOpen.regattaId, pickerOpen.teamId, participantId)}
        />
      )}
    </div>
  )
}

function SlotCard({
  occupant, participant, isSkipper, isOccasional, onRemove, disabled,
}: {
  occupant: Participation
  participant: { id: string; full_name: string; first_name: string; last_name: string } | null
  isSkipper: boolean
  isOccasional: boolean
  onRemove: () => void
  disabled: boolean
}) {
  if (!participant) return <div className="rounded p-1.5 bg-gray-100"></div>

  const background = isOccasional ? '#7DD3FC' : '#10B981'
  const textColor = '#fff'
  const initials = (participant.first_name?.[0] || '') + (participant.last_name?.[0] || '')

  return (
    <div
      className="rounded p-1.5 relative group flex flex-col justify-center items-center text-center"
      style={{
        background,
        color: textColor,
        minHeight: 60,
        border: isSkipper ? '2px solid #FF6B35' : 'none',
      }}
      title={participant.full_name + (isSkipper ? ' (skipper)' : '') + (isOccasional ? ' (occasional)' : '')}
    >
      {isSkipper && (
        <Crown size={10} className="absolute top-0.5 left-0.5" style={{ color: '#FF6B35' }} />
      )}
      <Link
        href={`/ssyt/admin/participants/${participant.id}`}
        className="text-[10px] font-semibold uppercase opacity-90 hover:opacity-100"
        onClick={(e) => e.stopPropagation()}
      >
        {initials.toUpperCase() || '?'}
      </Link>
      <div className="text-[10px] leading-tight font-medium mt-0.5" style={{ wordBreak: 'break-word', lineHeight: '1.1' }}>
        {participant.last_name}
      </div>
      <div className="text-[9px] opacity-80 leading-none">
        {participant.first_name}
      </div>
      {!isSkipper && (
        <button
          onClick={onRemove}
          disabled={disabled}
          className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 hover:bg-black/20 rounded p-0.5 transition disabled:opacity-50"
          title={isOccasional ? 'Scoate de pe barcă' : 'Marchează ca declined'}
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

function PickerModal({
  available, regattaName, teamName, teamColor, onClose, onSelect,
}: {
  available: { id: string; full_name: string; teamId: string | null; teamName: string | null; status: string }[]
  regattaName: string
  teamName: string
  teamColor: string
  onClose: () => void
  onSelect: (participantId: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [showAll, setShowAll] = useState(false)

  const filtered = available.filter((p) =>
    !filter || p.full_name.toLowerCase().includes(filter.toLowerCase())
  )

  // Grupez: cei confirmati la alta barca + tentative au prioritate
  const preferred = filtered.filter((p) => ['confirmed', 'tentative', 'pending', 'fără confirmare'].includes(p.status))
  const others = filtered.filter((p) => p.status === 'declined')
  const list = showAll ? filtered : preferred

  const STATUS_COLORS: Record<string, string> = {
    confirmed: '#10B981',
    tentative: '#3B82F6',
    pending: '#F59E0B',
    'fără confirmare': '#9CA3AF',
    declined: '#EF4444',
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-lg w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b flex items-start justify-between" style={{ borderColor: '#e5e7eb' }}>
          <div>
            <h3 className="font-semibold tracking-tight" style={{ color: '#0a1628' }}>Adaugă pe barcă</h3>
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
                      Echipă curentă: {p.teamName || '—'}
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

          {!showAll && others.length > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="mt-3 w-full p-3 text-xs text-gray-500 hover:text-gray-900 italic"
            >
              + arată {others.length} participanți care au declinat această regatta
            </button>
          )}
        </div>

        <div className="p-3 border-t text-xs text-gray-500" style={{ borderColor: '#e5e7eb', background: '#f8f9fa' }}>
          💡 Persoana selectată va fi marcată ca <strong>occasional</strong> și apare cu culoare azur pe barcă.
        </div>
      </div>
    </div>
  )
}

function LegendBox({ color, label, border }: { color: string; label: string; border?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="w-4 h-4 rounded" style={{ background: color, border: border ? '1px dashed #d1d5db' : 'none' }}></span>
      <span className="text-gray-600">{label}</span>
    </span>
  )
}