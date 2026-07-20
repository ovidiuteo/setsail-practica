'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Users, GripVertical, Crown, Search, X, ArrowRightLeft } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type Team = {
  id: string
  name: string
  short_name: string | null
  color_primary: string | null
  slug: string | null
  skipper_id: string | null
  boat?: { name: string } | { name: string }[] | null
}

type Participant = {
  id: string
  full_name: string
  first_name: string
  last_name: string
  photo_url: string | null
  status: string
  email: string
}

type Membership = {
  id: string
  team_id: string
  participant_id: string
  membership_type: string
  status: string
}

const UNASSIGNED = 'UNASSIGNED'

function getBoatName(boat: Team['boat']): string | null {
  if (!boat) return null
  if (Array.isArray(boat)) return boat[0]?.name ?? null
  return boat.name ?? null
}

export default function RosterBoard({
  teams,
  participants,
  memberships: initialMemberships,
}: {
  teams: Team[]
  participants: Participant[]
  memberships: Membership[]
}) {
  const router = useRouter()
  const [memberships, setMemberships] = useState<Membership[]>(initialMemberships)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null)

  function showToast(msg: string, type: 'ok' | 'err' = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // Map participant_id -> team_id pentru lookup rapid
  const participantTeamMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const x of memberships) m[x.participant_id] = x.team_id
    return m
  }, [memberships])

  const membershipMap = useMemo(() => {
    const m: Record<string, Membership> = {}
    for (const x of memberships) m[x.participant_id] = x
    return m
  }, [memberships])

  // Sortare: skipper > core > occasional > alfabetic
  function sortParticipants(arr: Participant[], teamId: string | null) {
    const team = teamId ? teams.find((t) => t.id === teamId) : null
    const skipperId = team?.skipper_id

    return [...arr].sort((a, b) => {
      // 1. Skipper-ul echipei primul
      if (skipperId) {
        if (a.id === skipperId && b.id !== skipperId) return -1
        if (b.id === skipperId && a.id !== skipperId) return 1
      }

      // 2. Core inainte de occasional
      const aType = membershipMap[a.id]?.membership_type
      const bType = membershipMap[b.id]?.membership_type
      const typeRank = (t: string | undefined) => t === 'core' ? 0 : t === 'occasional' ? 1 : 2
      const rankDiff = typeRank(aType) - typeRank(bType)
      if (rankDiff !== 0) return rankDiff

      // 3. Alfabetic
      return a.full_name.localeCompare(b.full_name, 'ro')
    })
  }

  // Group participants by team, deja sortat
  const grouping = useMemo(() => {
    const result: Record<string, Participant[]> = { [UNASSIGNED]: [] }
    teams.forEach((t) => { result[t.id] = [] })

    for (const p of participants) {
      const tid = participantTeamMap[p.id]
      if (tid && result[tid]) {
        result[tid].push(p)
      } else {
        result[UNASSIGNED].push(p)
      }
    }

    // Aplic sortarea pe fiecare coloana
    for (const tid of Object.keys(result)) {
      const teamId = tid === UNASSIGNED ? null : tid
      result[tid] = sortParticipants(result[tid], teamId)
    }

    return result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participants, memberships, teams])

  const searchLower = search.trim().toLowerCase()
  function matchesSearch(p: Participant) {
    if (!searchLower) return true
    return p.full_name.toLowerCase().includes(searchLower) ||
           p.email.toLowerCase().includes(searchLower)
  }

  function onDragStart(e: React.DragEvent, participantId: string) {
    setDraggingId(participantId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', participantId)
  }

  function onDragEnd() {
    setDraggingId(null)
    setDragOverColumn(null)
  }

  function onDragOver(e: React.DragEvent, columnId: string) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverColumn !== columnId) setDragOverColumn(columnId)
  }

  function onDragLeave() {
    setDragOverColumn(null)
  }

  async function onDrop(e: React.DragEvent, targetColumnId: string) {
    e.preventDefault()
    const participantId = e.dataTransfer.getData('text/plain')
    setDraggingId(null)
    setDragOverColumn(null)
    if (!participantId) return

    const currentMembership = membershipMap[participantId]
    const currentTeamId = currentMembership?.team_id ?? UNASSIGNED

    if (currentTeamId === targetColumnId) return

    setBusy(true)

    try {
      if (targetColumnId === UNASSIGNED) {
        if (currentMembership) {
          const { error } = await supabase
            .from('ssyt_team_memberships')
            .delete()
            .eq('id', currentMembership.id)
          if (error) throw error
          setMemberships((prev) => prev.filter((m) => m.id !== currentMembership.id))
          showToast('Mutat la neasignați')
        }
        setBusy(false)
        router.refresh()
        return
      }

      // Persoana are deja un membership în echipa țintă (poate ascuns / 'left')?
      // UNIQUE(team_id, participant_id) → nu putem face insert nou; reactivăm.
      const { data: targetExisting } = await supabase
        .from('ssyt_team_memberships')
        .select('id, team_id, participant_id, membership_type, status')
        .eq('team_id', targetColumnId)
        .eq('participant_id', participantId)
        .maybeSingle()

      if (targetExisting) {
        // Un-hide: reactivăm membership-ul existent în loc de duplicate
        const { data: reactivated, error } = await supabase
          .from('ssyt_team_memberships')
          .update({ status: 'active' })
          .eq('id', targetExisting.id)
          .select('id, team_id, participant_id, membership_type, status')
          .single()
        if (error) throw error
        // Dacă venea dintr-o altă echipă activă, ștergem vechiul membership ca să nu fie dublu
        let removedId: string | null = null
        if (currentMembership && currentMembership.id !== targetExisting.id) {
          const { error: delErr } = await supabase.from('ssyt_team_memberships').delete().eq('id', currentMembership.id)
          if (delErr) throw delErr
          removedId = currentMembership.id
        }
        setMemberships((prev) => {
          const next = prev.filter((m) => m.id !== removedId && m.id !== (reactivated as Membership).id)
          next.push(reactivated as Membership)
          return next
        })
      } else if (currentMembership) {
        const { error } = await supabase
          .from('ssyt_team_memberships')
          .update({ team_id: targetColumnId })
          .eq('id', currentMembership.id)
        if (error) throw error
        setMemberships((prev) =>
          prev.map((m) => m.id === currentMembership.id ? { ...m, team_id: targetColumnId } : m)
        )
      } else {
        const { data, error } = await supabase
          .from('ssyt_team_memberships')
          .insert({
            team_id: targetColumnId,
            participant_id: participantId,
            membership_type: 'core',
            status: 'active',
          })
          .select('*')
          .single()
        if (error) throw error
        if (data) setMemberships((prev) => [...prev, data as Membership])
      }

      const targetTeam = teams.find((t) => t.id === targetColumnId)
      showToast(`Mutat în ${targetTeam?.name || 'echipă'}`)
      router.refresh()
    } catch (err: any) {
      showToast('Eroare: ' + (err?.message || 'unknown'), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function toggleMembershipType(participantId: string) {
    const m = membershipMap[participantId]
    if (!m) return
    // Ciclu: core -> occasional -> punctual -> core
    const next = m.membership_type === 'core'
      ? 'occasional'
      : m.membership_type === 'occasional'
        ? 'punctual'
        : 'core'
    setBusy(true)
    const { error } = await supabase
      .from('ssyt_team_memberships')
      .update({ membership_type: next })
      .eq('id', m.id)
    if (!error) {
      setMemberships((prev) => prev.map((x) => x.id === m.id ? { ...x, membership_type: next } : x))
      const label = next === 'punctual' ? 'one-time' : next
      showToast(`Schimbat la ${label}`)
      router.refresh()
    } else {
      showToast('Eroare: ' + error.message, 'err')
    }
    setBusy(false)
  }

  return (
    <div className="relative">
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută participant..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-md border"
            style={{ borderColor: '#e5e7eb', background: '#fff' }}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
              <X size={14} />
            </button>
          )}
        </div>
        <div className="text-xs text-gray-500">
          Total: <span className="font-medium" style={{ color: '#0a1628' }}>{participants.length}</span> participanți
        </div>
      </div>

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-white"
          style={{ background: toast.type === 'ok' ? '#10B981' : '#EF4444' }}
        >
          {toast.msg}
        </div>
      )}

      <div className="grid gap-4" style={{ gridTemplateColumns: `300px repeat(${teams.length}, minmax(220px, 1fr))` }}>
        <Column
          title="Neasignați"
          subtitle={`${grouping[UNASSIGNED].length} participanți`}
          headerStyle={{ background: '#6B7280' }}
          isDragOver={dragOverColumn === UNASSIGNED}
          onDragOver={(e) => onDragOver(e, UNASSIGNED)}
          onDragLeave={onDragLeave}
          onDrop={(e) => onDrop(e, UNASSIGNED)}
        >
          {grouping[UNASSIGNED].filter(matchesSearch).map((p) => (
            <ParticipantCard
              key={p.id}
              participant={p}
              isSkipperOf={null}
              membership={null}
              dragging={draggingId === p.id}
              onDragStart={(e) => onDragStart(e, p.id)}
              onDragEnd={onDragEnd}
              onToggleType={() => toggleMembershipType(p.id)}
            />
          ))}
          {grouping[UNASSIGNED].length === 0 && (
            <EmptyState text="Toți participanții sunt în echipe 🎉" />
          )}
        </Column>

        {teams.map((team) => {
          const isSkipperId = team.skipper_id
          const teamParticipants = grouping[team.id] || []
          const boatName = getBoatName(team.boat)
          return (
            <Column
              key={team.id}
              title={team.name}
              titleHref={`/ssyt/admin/teams/${team.id}`}
              subtitle={`${teamParticipants.length} membri${boatName ? ' · ' + boatName : ''}`}
              headerStyle={{ background: team.color_primary || '#4A5568' }}
              isDragOver={dragOverColumn === team.id}
              onDragOver={(e) => onDragOver(e, team.id)}
              onDragLeave={onDragLeave}
              onDrop={(e) => onDrop(e, team.id)}
            >
              {teamParticipants.filter(matchesSearch).map((p) => (
                <ParticipantCard
                  key={p.id}
                  participant={p}
                  isSkipperOf={p.id === isSkipperId ? team : null}
                  membership={membershipMap[p.id]}
                  dragging={draggingId === p.id}
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onDragEnd={onDragEnd}
                  onToggleType={() => toggleMembershipType(p.id)}
                />
              ))}
              {teamParticipants.length === 0 && (
                <EmptyState text="Trage un participant aici" />
              )}
            </Column>
          )
        })}
      </div>

      {busy && (
        <div className="fixed bottom-6 left-6 z-50 px-3 py-2 rounded-md text-xs text-white" style={{ background: '#0a1628' }}>
          Se sincronizează...
        </div>
      )}
    </div>
  )
}

function Column({
  title,
  titleHref,
  subtitle,
  headerStyle,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  children,
}: {
  title: string
  titleHref?: string
  subtitle: string
  headerStyle: React.CSSProperties
  isDragOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent) => void
  children: React.ReactNode
}) {
  return (
    <div
      className="rounded-lg overflow-hidden flex flex-col"
      style={{
        background: '#fff',
        border: isDragOver ? '2px solid #FF6B35' : '1px solid #e5e7eb',
        minHeight: 400,
        transition: 'border-color 0.15s',
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="p-3 text-white flex-shrink-0" style={headerStyle}>
        {titleHref ? (
          <Link href={titleHref} className="font-semibold text-sm hover:underline block truncate">{title}</Link>
        ) : (
          <div className="font-semibold text-sm truncate">{title}</div>
        )}
        <div className="text-xs text-white/80 truncate">{subtitle}</div>
      </div>
      <div className="p-2 flex-1 space-y-1.5 overflow-y-auto" style={{ background: isDragOver ? 'rgba(255,107,53,0.06)' : 'transparent', transition: 'background 0.15s' }}>
        {children}
      </div>
    </div>
  )
}

function ParticipantCard({
  participant,
  isSkipperOf,
  membership,
  dragging,
  onDragStart,
  onDragEnd,
  onToggleType,
}: {
  participant: Participant
  isSkipperOf: Team | null
  membership: Membership | null
  dragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onToggleType: () => void
}) {
  const initials = (participant.first_name?.[0] ?? '') + (participant.last_name?.[0] ?? '')
  const isSkipper = !!isSkipperOf

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="group flex items-center gap-2 p-2 rounded-md cursor-grab active:cursor-grabbing transition"
      style={{
        background: dragging ? 'rgba(255,107,53,0.1)' : (isSkipper ? 'rgba(255,107,53,0.04)' : '#fff'),
        border: isSkipper ? '1px solid rgba(255,107,53,0.3)' : '1px solid #e5e7eb',
        opacity: dragging ? 0.5 : 1,
      }}
    >
      <GripVertical size={12} className="text-gray-300 group-hover:text-gray-500 flex-shrink-0" />

      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-semibold flex-shrink-0"
        style={{ background: isSkipper ? '#FF6B35' : '#4A5568' }}
      >
        {initials.toUpperCase() || '?'}
      </div>

      <div className="flex-1 min-w-0">
        <Link
          href={`/ssyt/admin/participants/${participant.id}`}
          className="text-xs font-medium block truncate hover:underline"
          style={{ color: '#0a1628' }}
          onClick={(e) => e.stopPropagation()}
        >
          {participant.full_name}
        </Link>
        <div className="flex items-center gap-1 mt-0.5">
          {isSkipper && (
            <span title={`Skipper ${isSkipperOf!.short_name || isSkipperOf!.name}`} className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35' }}>
              <Crown size={8} /> skipper
            </span>
          )}
          {membership && !isSkipper && (() => {
            const t = membership.membership_type
            const bg = t === 'core' ? 'rgba(255,107,53,0.12)'
              : t === 'occasional' ? 'rgba(0,168,181,0.12)'
              : 'rgba(168,85,247,0.12)'
            const fg = t === 'core' ? '#FF6B35'
              : t === 'occasional' ? '#00A8B5'
              : '#a855f7'
            const label = t === 'punctual' ? 'one-time' : t
            return (
              <button
                onClick={(e) => { e.stopPropagation(); onToggleType() }}
                title="Click pentru toggle: core → ocazional → one-time → core"
                className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded hover:opacity-80 transition"
                style={{ background: bg, color: fg }}
              >
                <ArrowRightLeft size={8} />
                {label}
              </button>
            )
          })()}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8 text-xs text-gray-400 italic">
      {text}
    </div>
  )
}