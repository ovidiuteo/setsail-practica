'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, HelpCircle } from 'lucide-react'
import { useCurrentUser } from '@/lib/ssyt/useCurrentUser'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function PortalAvailabilityPage() {
  const { participant, loading } = useCurrentUser()
  const router = useRouter()
  const [teamId, setTeamId] = useState<string | null>(null)
  const [membershipType, setMembershipType] = useState('core')
  const [regattas, setRegattas] = useState<any[]>([])
  const [participations, setParticipations] = useState<Record<string, any>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  async function loadData() {
    if (!participant) { setDataLoading(false); return }
    const supabase = createSupabaseBrowserClient()
    const { data: mem } = await supabase
      .from('ssyt_team_memberships')
      .select('team_id, membership_type')
      .eq('participant_id', participant.id)
      .eq('status', 'active')
      .maybeSingle()
    setTeamId(mem?.team_id || null)
    setMembershipType(mem?.membership_type || 'core')

    const { data: seasons } = await supabase.from('ssyt_seasons').select('id').eq('status', 'active').limit(1)
    const seasonId = seasons?.[0]?.id

    const { data: regs } = await supabase
      .from('ssyt_regattas')
      .select('id, name, slug, start_date, end_date, event_type')
      .eq('season_id', seasonId)
      .order('start_date')
    setRegattas(regs || [])

    const regIds = (regs || []).map((r) => r.id)
    if (regIds.length > 0) {
      const { data: parts } = await supabase
        .from('ssyt_regatta_participation')
        .select('id, regatta_id, confirmation_status, on_crewlist, team_id')
        .eq('participant_id', participant.id)
        .in('regatta_id', regIds)
      const map: Record<string, any> = {}
      for (const p of parts || []) map[p.regatta_id] = p
      setParticipations(map)
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
        </p>
      </div>

      <div className="space-y-3">
        {regattas.map((r) => {
          const part = participations[r.id]
          const status = part?.confirmation_status
          const onCrewlist = part?.on_crewlist
          const d1 = new Date(r.start_date)
          const d2 = r.end_date ? new Date(r.end_date) : null
          const isBusy = busy === r.id

          return (
            <div key={r.id} className="rounded-lg p-4 flex items-center gap-4 flex-wrap" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="w-14 h-14 rounded-md flex flex-col items-center justify-center flex-shrink-0" style={{ background: '#0a1628', color: '#fff' }}>
                <div className="text-[10px] uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
                <div className="text-xl font-bold leading-none">{d1.getDate()}</div>
                {d2 && d2.getDate() !== d1.getDate() && (
                  <div className="text-[10px] mt-0.5">→{d2.getDate()}</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold" style={{ color: '#0a1628' }}>{r.name}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
                  <span className="ml-2 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]" style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}>
                    {r.event_type}
                  </span>
                </div>
                {onCrewlist && (
                  <div className="text-xs mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
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
