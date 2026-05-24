'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, CheckCircle2, HelpCircle, XCircle, MinusCircle, UserCheck, UserX, Lock, ChevronDown, ChevronRight } from 'lucide-react'

export type CrewMember = {
  participantId: string
  fullName: string
  membershipType: string | null
  isSkipper: boolean
  status: string | null // 'confirmed' | 'tentative' | 'declined' | 'pending' | null
  onCrewlist: boolean
}

type Team = {
  id: string
  name: string
  short_name: string | null
  color_primary: string | null
}

type StatusKey = 'confirmed' | 'tentative' | 'declined' | 'unknown'

const STATUS_META: Record<StatusKey, { label: string; color: string; bg: string; icon: typeof CheckCircle2 }> = {
  confirmed: { label: 'Disponibili', color: '#10B981', bg: 'rgba(16,185,129,0.10)', icon: CheckCircle2 },
  tentative: { label: 'Indeciși', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', icon: HelpCircle },
  declined:  { label: 'Indisponibili', color: '#EF4444', bg: 'rgba(239,68,68,0.10)', icon: XCircle },
  unknown:   { label: 'Fără răspuns', color: '#6B7280', bg: 'rgba(107,114,128,0.10)', icon: MinusCircle },
}

function bucketFor(s: string | null): StatusKey {
  if (s === 'confirmed') return 'confirmed'
  if (s === 'tentative' || s === 'pending') return 'tentative'
  if (s === 'declined') return 'declined'
  return 'unknown'
}

function membershipLabel(t: string | null): string {
  if (t === 'core') return 'core'
  if (t === 'occasional') return 'ocazional'
  if (t === 'punctual') return 'one-time'
  return ''
}

function membershipColor(t: string | null): string {
  if (t === 'core') return '#FF6B35'
  if (t === 'occasional') return '#00A8B5'
  if (t === 'punctual') return '#a855f7'
  return '#94a3b8'
}

export default function TeamCrewSection({
  team,
  crew,
  regattaId,
  canEditCrewlist,
  regattaIsFrozen,
  meParticipantId,
}: {
  team: Team
  crew: CrewMember[]
  regattaId: string
  canEditCrewlist: boolean
  regattaIsFrozen: boolean
  meParticipantId: string
}) {
  const router = useRouter()
  const [list, setList] = useState<CrewMember[]>(crew)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(false)

  async function toggleCrewlist(memberId: string) {
    setError('')
    setBusyId(memberId)
    const res = await fetch('/api/ssyt/portal/regatta-crewlist-toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regatta_id: regattaId, participant_id: memberId }),
    })
    const json = await res.json().catch(() => ({}))
    setBusyId(null)
    if (!res.ok || !json.success) {
      setError(json.error || 'Eroare la toggle.')
      return
    }
    setList((arr) =>
      arr.map((m) =>
        m.participantId === memberId ? { ...m, onCrewlist: json.on_crewlist } : m
      )
    )
    router.refresh()
  }

  const grouped: Record<StatusKey, CrewMember[]> = {
    confirmed: [],
    tentative: [],
    declined: [],
    unknown: [],
  }
  for (const m of list) {
    grouped[bucketFor(m.status)].push(m)
  }

  const totalConfirmed = grouped.confirmed.length
  const onCrewlistCount = grouped.confirmed.filter((m) => m.onCrewlist).length

  const teamColor = team.color_primary || '#4A5568'

  return (
    <section
      className="rounded-lg overflow-hidden mb-6"
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-3 flex items-center justify-between gap-3 flex-wrap text-left transition hover:brightness-110"
        style={{ background: teamColor, color: '#fff' }}
        aria-expanded={open}
      >
        <div className="flex items-center gap-2 min-w-0">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          <Users size={16} />
          <h2 className="font-semibold tracking-tight">
            Echipa {team.short_name || team.name} — Crewlist participanți
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 opacity-90">
            <CheckCircle2 size={12} />
            <strong>{totalConfirmed}</strong> disponibili
          </span>
          <span className="inline-flex items-center gap-1 opacity-90">
            <UserCheck size={12} />
            <strong>{onCrewlistCount}</strong> pe crewlist
          </span>
          {regattaIsFrozen && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }}>
              <Lock size={11} /> Read-only
            </span>
          )}
        </div>
      </button>

      {!open && (
        <div className="px-5 py-2 text-xs text-gray-400 italic">
          Click pe bara colorată pentru a vedea lista membrilor.
        </div>
      )}

      {open && (
        <>
          <div className="px-5 py-3 text-xs text-gray-500 border-b" style={{ borderColor: '#f1f5f9' }}>
            {canEditCrewlist ? (
              <>
                Ca <strong>skipper / editor</strong> al echipei poți decide cine intră pe crewlist —
                click pe <UserCheck size={11} className="inline align-middle" /> lângă fiecare membru
                disponibil.
              </>
            ) : (
              <>
                Lista de mai jos arată cine din echipa ta este disponibil, indecis sau indisponibil
                pentru această regată. Doar skipper-ul sau editorii pot modifica crewlist-ul.
              </>
            )}
            {regattaIsFrozen && (
              <span className="block mt-1 italic text-amber-700">
                Regata este finalizată — statusurile sunt înghețate.
              </span>
            )}
          </div>

          {error && (
            <div className="mx-5 mt-3 px-3 py-2 text-sm rounded-md" style={{ background: '#fef2f2', color: '#dc2626' }}>
              {error}
            </div>
          )}

          <div className="p-5 space-y-4">
        {(['confirmed', 'tentative', 'declined', 'unknown'] as StatusKey[]).map((key) => {
          const members = grouped[key]
          if (members.length === 0) return null
          const meta = STATUS_META[key]
          const Icon = meta.icon
          return (
            <div key={key}>
              <div className="flex items-center gap-2 mb-2">
                <Icon size={13} style={{ color: meta.color }} />
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: meta.color }}>
                  {meta.label} <span className="text-gray-400 font-normal">({members.length})</span>
                </h3>
              </div>
              <ul className="space-y-1.5">
                {members.map((m) => {
                  const memColor = membershipColor(m.membershipType)
                  const memLabel = membershipLabel(m.membershipType)
                  const isMe = m.participantId === meParticipantId
                  const showToggle = key === 'confirmed' && canEditCrewlist && !regattaIsFrozen
                  return (
                    <li
                      key={m.participantId}
                      className="flex items-center gap-3 px-3 py-2 rounded-md"
                      style={{ background: meta.bg }}
                    >
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium" style={{ color: '#0a1628' }}>
                          {m.fullName}
                        </span>
                        {isMe && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(0,0,0,0.06)', color: '#475569' }}>
                            tu
                          </span>
                        )}
                        {m.isSkipper && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35' }}>
                            skipper
                          </span>
                        )}
                        {memLabel && (
                          <span
                            className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold"
                            style={{ background: memColor + '20', color: memColor }}
                          >
                            {memLabel}
                          </span>
                        )}
                        {m.onCrewlist && (
                          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: '#10B98120', color: '#10B981' }}>
                            <UserCheck size={9} /> pe crewlist
                          </span>
                        )}
                      </div>

                      {showToggle && (
                        <button
                          onClick={() => toggleCrewlist(m.participantId)}
                          disabled={busyId === m.participantId}
                          title={m.onCrewlist ? 'Scoate de pe crewlist' : 'Pune pe crewlist'}
                          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition disabled:opacity-50"
                          style={{
                            background: m.onCrewlist ? '#10B981' : '#fff',
                            color: m.onCrewlist ? '#fff' : '#10B981',
                            border: m.onCrewlist ? 'none' : '1px solid #10B981',
                          }}
                        >
                          {m.onCrewlist ? (
                            <>
                              <UserX size={11} /> Scoate
                            </>
                          ) : (
                            <>
                              <UserCheck size={11} /> Crewlist
                            </>
                          )}
                        </button>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )
        })}
          </div>
        </>
      )}
    </section>
  )
}
