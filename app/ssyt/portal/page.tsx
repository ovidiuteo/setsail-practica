'use client'
import { useEffect, useState } from 'react'
import { Check, X, HelpCircle } from 'lucide-react'
import { useCurrentUser } from '@/lib/ssyt/useCurrentUser'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function PortalAvailabilityPage() {
  const { participant, loading } = useCurrentUser()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [teamColor, setTeamColor] = useState<string>('#00A8B5')
  const [membershipType, setMembershipType] = useState('core')
  const [regattas, setRegattas] = useState<any[]>([])
  const [participations, setParticipations] = useState<Record<string, any>>({})
  // Status colegi: regattaId → array de { participant_id, full_name, status }
  const [teammatesByRegatta, setTeammatesByRegatta] = useState<Record<string, any[]>>({})
  const [allTeammates, setAllTeammates] = useState<any[]>([])  // toți colegii pentru "fără răspuns"
  const [busy, setBusy] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  async function loadData() {
    if (!participant) { setDataLoading(false); return }
    const supabase = createSupabaseBrowserClient()

    // Echipa
    const { data: mem } = await supabase
      .from('ssyt_team_memberships')
      .select(`
        team_id, membership_type,
        team:ssyt_teams(id, name, short_name, color_primary)
      `)
      .eq('participant_id', participant.id)
      .eq('status', 'active')
      .maybeSingle()
    const tId = mem?.team_id || null
    setTeamId(tId)
    setMembershipType(mem?.membership_type || 'core')
    const t = Array.isArray(mem?.team) ? mem?.team[0] : mem?.team
    setTeamName(t?.name || null)
    setTeamColor(t?.color_primary || '#00A8B5')

    // Regate
    const { data: seasons } = await supabase.from('ssyt_seasons').select('id').eq('status', 'active').limit(1)
    const seasonId = seasons?.[0]?.id

    const { data: regs } = await supabase
      .from('ssyt_regattas')
      .select('id, name, slug, start_date, end_date, event_type')
      .eq('season_id', seasonId)
      .order('start_date')
    setRegattas(regs || [])

    const regIds = (regs || []).map((r) => r.id)
    if (regIds.length === 0) { setDataLoading(false); return }

    // Disponibilitățile proprii
    const { data: parts } = await supabase
      .from('ssyt_regatta_participation')
      .select('id, regatta_id, confirmation_status, on_crewlist, team_id')
      .eq('participant_id', participant.id)
      .in('regatta_id', regIds)
    const map: Record<string, any> = {}
    for (const p of parts || []) map[p.regatta_id] = p
    setParticipations(map)

    // Colegii de echipă (toți cu același team_id)
    if (tId) {
      const { data: tmMemberships } = await supabase
        .from('ssyt_team_memberships')
        .select(`
          participant_id,
          participant:ssyt_participants(id, full_name, first_name, last_name)
        `)
        .eq('team_id', tId)
        .eq('status', 'active')

      const teammates = (tmMemberships || []).map((m: any) => {
        const p = Array.isArray(m.participant) ? m.participant[0] : m.participant
        return p ? { id: p.id, full_name: p.full_name, first_name: p.first_name, last_name: p.last_name } : null
      }).filter(Boolean) as any[]
      setAllTeammates(teammates)

      // Disponibilitatea fiecărui coleg pentru fiecare regatta
      const teammateIds = teammates.map((t) => t.id)
      if (teammateIds.length > 0) {
        const { data: allParts } = await supabase
          .from('ssyt_regatta_participation')
          .select('regatta_id, participant_id, confirmation_status')
          .in('regatta_id', regIds)
          .in('participant_id', teammateIds)

        const byRegatta: Record<string, any[]> = {}
        for (const rId of regIds) byRegatta[rId] = []
        for (const p of allParts || []) {
          if (!byRegatta[p.regatta_id]) byRegatta[p.regatta_id] = []
          const tm = teammates.find((t) => t.id === p.participant_id)
          if (tm) {
            byRegatta[p.regatta_id].push({
              ...tm,
              status: p.confirmation_status,
            })
          }
        }
        setTeammatesByRegatta(byRegatta)
      }
    }

    setDataLoading(false)
  }

  useEffect(() => {
    if (!loading) loadData()
  }, [participant, loading])

  async function setStatus(regattaId: string, status: 'confirmed' | 'declined' | 'tentative') {
    if (!participant) return
    setBusy(regattaId)
    const supabase = createSupabaseBrowserClient()
    const existing = participations[regattaId]

    if (existing) {
      const updates: any = { confirmation_status: status }
      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString()
      } else {
        updates.on_crewlist = false
      }
      const { error } = await supabase.from('ssyt_regatta_participation').update(updates).eq('id', existing.id)
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.from('ssyt_regatta_participation').insert({
        regatta_id: regattaId,
        participant_id: participant.id,
        team_id: teamId,
        confirmation_status: status,
        attendance_type: membershipType,
        on_crewlist: false,
        confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      })
      if (error) alert(error.message)
    }
    setBusy(null)
    await loadData()
  }

  if (loading || dataLoading) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-400">Se încarcă...</div>
  }

  if (!participant) {
    return <div className="max-w-6xl mx-auto px-6 py-8 text-sm text-gray-500">Profil ne-asociat.</div>
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Disponibilități</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Marchează-ți prezența
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Pentru fiecare regatta, marchează dacă ești disponibil, indisponibil sau încă nu știi.
          {teamName && <> Sub fiecare regatta vezi și răspunsurile colegilor din echipa <strong>{teamName}</strong>.</>}
        </p>
      </div>

      <div className="space-y-4">
        {regattas.map((r) => {
          const part = participations[r.id]
          const status = part?.confirmation_status
          const onCrewlist = part?.on_crewlist
          const d1 = new Date(r.start_date)
          const d2 = r.end_date ? new Date(r.end_date) : null
          const isBusy = busy === r.id

          // Calculez grupurile de colegi
          const teammates = teammatesByRegatta[r.id] || []
          const teammateIds = new Set(teammates.map((t) => t.id))
          const confirmed = teammates.filter((t) => t.status === 'confirmed' && t.id !== participant.id)
          const tentative = teammates.filter((t) => t.status === 'tentative' && t.id !== participant.id)
          const declined = teammates.filter((t) => t.status === 'declined' && t.id !== participant.id)
          // Fără răspuns: colegi care nu apar în participation
          const noResponse = allTeammates.filter((tm) => !teammateIds.has(tm.id) && tm.id !== participant.id)

          return (
            <div key={r.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              {/* Header colorat */}
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
                <div className="flex items-center gap-2 flex-shrink-0">
                  <StatusButton active={status === 'confirmed'} onClick={() => setStatus(r.id, 'confirmed')} disabled={isBusy} color="#10B981" icon={<Check size={16} />} label="Disponibil" />
                  <StatusButton active={status === 'tentative'} onClick={() => setStatus(r.id, 'tentative')} disabled={isBusy} color="#F59E0B" icon={<HelpCircle size={16} />} label="Nu știu" />
                  <StatusButton active={status === 'declined'} onClick={() => setStatus(r.id, 'declined')} disabled={isBusy} color="#EF4444" icon={<X size={16} />} label="Indisponibil" />
                </div>
              </div>

              {/* Sectiuni colegi */}
              {allTeammates.length > 1 && (
                <div className="p-4 space-y-2 text-sm">
                  <TeammateGroup color="#10B981" emoji="🟢" label="Participă" people={confirmed} />
                  <TeammateGroup color="#F59E0B" emoji="🟡" label="Indecisi" people={tentative} />
                  <TeammateGroup color="#EF4444" emoji="🔴" label="Indisponibili" people={declined} />
                  <TeammateGroup color="#9CA3AF" emoji="⚪" label="Fără răspuns" people={noResponse} />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function StatusButton({ active, onClick, disabled, color, icon, label }: { active: boolean; onClick: () => void; disabled: boolean; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button onClick={onClick} disabled={disabled} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50" style={{ background: active ? color : '#fff', color: active ? '#fff' : color, border: `2px solid ${color}` }} title={label}>
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function TeammateGroup({ color, emoji, label, people }: { color: string; emoji: string; label: string; people: any[] }) {
  if (people.length === 0) {
    return (
      <div className="flex items-baseline gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color, minWidth: 110 }}>
          {emoji} {label}:
        </span>
        <span className="text-xs text-gray-300 italic">—</span>
      </div>
    )
  }
  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className="text-xs font-semibold uppercase tracking-wider flex-shrink-0" style={{ color, minWidth: 110 }}>
        {emoji} {label}:
      </span>
      <span className="text-sm text-gray-700">
        {people.map((p, idx) => (
          <span key={p.id}>
            {p.full_name}{idx < people.length - 1 && ', '}
          </span>
        ))}
        <span className="text-xs text-gray-400 ml-1">({people.length})</span>
      </span>
    </div>
  )
}