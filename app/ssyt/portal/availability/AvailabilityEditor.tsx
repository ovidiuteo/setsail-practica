'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, HelpCircle, Users, Lock } from 'lucide-react'

type Regatta = { id: string; name: string; slug: string; start_date: string; end_date: string | null; event_type: string }
type Participation = { id?: string; regatta_id: string; confirmation_status: string; on_crewlist?: boolean; team_id?: string | null }
type TeamParticipation = { regatta_id: string; participant_id: string; confirmation_status: string }
type TeamMember = { id: string; full_name: string; first_name: string }

export default function AvailabilityEditor({
  participantId, teamId, teamColor, membershipType, punctualAnchorEndDate, regattas, initialParticipations,
  teamMembers, teamParticipations,
}: {
  participantId: string
  teamId: string | null
  teamColor: string
  membershipType: string
  punctualAnchorEndDate: string | null
  regattas: Regatta[]
  initialParticipations: Participation[]
  teamMembers: TeamMember[]
  teamParticipations: TeamParticipation[]
}) {
  const isPunctual = membershipType === 'punctual'
  const anchorEndTs = punctualAnchorEndDate ? new Date(punctualAnchorEndDate).getTime() : null

  function isLockedForPunctual(regattaStart: string): boolean {
    if (!isPunctual || !anchorEndTs) return false
    return new Date(regattaStart).getTime() > anchorEndTs
  }
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  // Map participations proprii per regatta
  const myPartMap: Record<string, Participation> = {}
  for (const p of initialParticipations) myPartMap[p.regatta_id] = p

  // Map nume per participant_id pentru lookup rapid
  const memberMap: Record<string, TeamMember> = {}
  for (const m of teamMembers) memberMap[m.id] = m

  // Calculez per regatta listele de nume pe categorii
  const teamDetailsByRegatta = useMemo(() => {
    const out: Record<string, {
      confirmed: TeamMember[]
      tentative: TeamMember[]
      declined: TeamMember[]
      pending: TeamMember[]
    }> = {}

    for (const r of regattas) {
      out[r.id] = { confirmed: [], tentative: [], declined: [], pending: [] }
    }

    // Statusurile cunoscute
    const knownStatus: Record<string, Record<string, string>> = {}  // regatta_id -> participant_id -> status
    for (const r of regattas) knownStatus[r.id] = {}
    for (const tp of teamParticipations) {
      if (knownStatus[tp.regatta_id]) {
        knownStatus[tp.regatta_id][tp.participant_id] = tp.confirmation_status
      }
    }

    // Pentru fiecare regatta, iterez prin toți membrii echipei
    for (const r of regattas) {
      for (const member of teamMembers) {
        const status = knownStatus[r.id]?.[member.id] || 'pending'
        if (status === 'confirmed') out[r.id].confirmed.push(member)
        else if (status === 'tentative') out[r.id].tentative.push(member)
        else if (status === 'declined') out[r.id].declined.push(member)
        else out[r.id].pending.push(member)
      }
    }

    return out
  }, [regattas, teamMembers, teamParticipations])

  async function setStatus(regattaId: string, status: 'confirmed' | 'declined' | 'tentative') {
    setBusy(regattaId)
    const res = await fetch('/api/ssyt/portal-availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regatta_id: regattaId, status }),
    })
    const data = await res.json()
    setBusy(null)
    if (!res.ok) {
      alert(data.error || 'Eroare la salvare.')
      return
    }
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {isPunctual && (
        <div
          className="rounded-md px-4 py-2.5 text-xs flex items-center gap-2"
          style={{ background: 'rgba(168,85,247,0.10)', color: '#7e22ce', border: '1px solid rgba(168,85,247,0.3)' }}
        >
          <Lock size={13} />
          <span>
            Ești membru <strong>one-time</strong>. Poți modifica disponibilitatea doar pentru regata
            la care ai fost adăugat. Regatele ulterioare sunt înghețate la statusul implicit
            <em> indecis</em> — contactează skipper-ul dacă vrei să te alăturăm și la alte regate.
          </span>
        </div>
      )}
      {regattas.map((r) => {
        const part = myPartMap[r.id]
        const status = part?.confirmation_status
        const onCrewlist = part?.on_crewlist
        const d1 = new Date(r.start_date)
        const d2 = r.end_date ? new Date(r.end_date) : null
        const isBusy = busy === r.id
        const details = teamDetailsByRegatta[r.id]
        const lockedForPunctual = isLockedForPunctual(r.start_date)

        return (
          <div key={r.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            {/* Header colorat cu titlu + buttons */}
            <div className="p-4 flex items-center gap-4 flex-wrap" style={{ background: teamColor, color: '#fff' }}>
              <div className="w-14 h-14 rounded-md flex flex-col items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,255,255,0.2)', color: '#fff' }}>
                <div className="text-[10px] uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
                <div className="text-xl font-bold leading-none">{d1.getDate()}</div>
                {d2 && d2.getDate() !== d1.getDate() && (
                  <div className="text-[10px] mt-0.5">→{d2.getDate()}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-lg tracking-tight">{r.name}</div>
                <div className="text-xs text-white/80 mt-0.5">
                  {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
                  <span className="ml-2 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                    {r.event_type}
                  </span>
                </div>
                {onCrewlist && (
                  <div className="text-xs mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)', color: '#fff' }}>
                    ✓ Ești pe crewlist
                  </div>
                )}
              </div>

              {/* Stats badges */}
              {details && teamMembers.length > 0 && (
                <div className="flex items-center gap-2 text-xs flex-shrink-0">
                  <div className="flex items-center gap-1 mr-1 opacity-70">
                    <Users size={12} />
                    <span>{teamMembers.length}</span>
                  </div>
                  <StatPill count={details.confirmed.length} bg="#10B981" label="confirmați" />
                  <StatPill count={details.tentative.length} bg="#F59E0B" label="nu știu" />
                  <StatPill count={details.declined.length} bg="#EF4444" label="indisponibili" />
                  <StatPill count={details.pending.length} bg="rgba(255,255,255,0.25)" label="fără răspuns" />
                </div>
              )}

              {/* Butoane status (disabled pentru one-time pe regate post-anchor) */}
              <div
                className="flex items-center gap-2 flex-shrink-0"
                title={lockedForPunctual ? 'One-time — nu poți modifica pentru regatele de după regata ta' : undefined}
                style={{ opacity: lockedForPunctual ? 0.4 : 1 }}
              >
                {lockedForPunctual && <Lock size={13} className="text-white/80" />}
                <StatusButton active={status === 'confirmed'} onClick={() => setStatus(r.id, 'confirmed')} disabled={isBusy || lockedForPunctual} color="#10B981" icon={<Check size={16} />} label="Disponibil" />
                <StatusButton active={status === 'tentative'} onClick={() => setStatus(r.id, 'tentative')} disabled={isBusy || lockedForPunctual} color="#F59E0B" icon={<HelpCircle size={16} />} label="Nu știu" />
                <StatusButton active={status === 'declined'} onClick={() => setStatus(r.id, 'declined')} disabled={isBusy || lockedForPunctual} color="#EF4444" icon={<X size={16} />} label="Indisponibil" />
              </div>
            </div>

            {/* Liste nume pe categorii (sub header-ul colorat, in card alb) */}
            {details && teamMembers.length > 0 && (
              <div className="px-4 py-3 space-y-1.5 text-xs" style={{ background: '#f8f9fa', borderTop: '1px solid #e5e7eb' }}>
                <NameList color="#10B981" label="Confirmați" members={details.confirmed} currentId={participantId} />
                <NameList color="#F59E0B" label="Indeciși" members={details.tentative} currentId={participantId} />
                <NameList color="#EF4444" label="Indisponibili" members={details.declined} currentId={participantId} />
                <NameList color="#6B7280" label="Fără răspuns" members={details.pending} currentId={participantId} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function NameList({ color, label, members, currentId }: { color: string; label: string; members: TeamMember[]; currentId: string }) {
  if (members.length === 0) {
    return (
      <div className="text-gray-400 italic">
        <span className="font-semibold" style={{ color }}>{label}:</span> <span>—</span>
      </div>
    )
  }
  return (
    <div className="text-gray-700 leading-snug">
      <span className="font-semibold" style={{ color }}>{label} ({members.length}):</span>{' '}
      {members.map((m, idx) => (
        <span key={m.id}>
          <span style={m.id === currentId ? { fontWeight: 600, color: '#0a1628' } : undefined}>
            {m.full_name}{m.id === currentId && ' (tu)'}
          </span>
          {idx < members.length - 1 && ', '}
        </span>
      ))}
    </div>
  )
}

function StatPill({ count, bg, label, textColor = '#fff' }: { count: number; bg: string; label: string; textColor?: string }) {
  return (
    <span
      className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full font-semibold text-[11px]"
      style={{ background: bg, color: textColor }}
      title={`${count} ${label}`}
    >
      {count}
    </span>
  )
}

function StatusButton({ active, onClick, disabled, color, icon, label }: { active: boolean; onClick: () => void; disabled: boolean; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
      style={{
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `2px solid ${color}`,
      }}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
