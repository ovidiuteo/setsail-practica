'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertCircle } from 'lucide-react'
import { useCurrentUser } from '@/lib/ssyt/useCurrentUser'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function PortalHome() {
  const { user, participant, loading } = useCurrentUser()
  const [team, setTeam] = useState<any>(null)
  const [boat, setBoat] = useState<any>(null)
  const [regattas, setRegattas] = useState<any[]>([])
  const [participations, setParticipations] = useState<Record<string, any>>({})
  const [signupReqStatus, setSignupReqStatus] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (loading) return
    if (!user) return

    async function load() {
      if (!user) return
      const supabase = createSupabaseBrowserClient()

      if (!participant) {
        const { data: req } = await supabase
          .from('ssyt_signup_requests')
          .select('status')
          .eq('user_id', user.id)
          .maybeSingle()
        setSignupReqStatus(req?.status || null)
        setDataLoading(false)
        return
      }

      // Echipa
      const { data: membership } = await supabase
        .from('ssyt_team_memberships')
        .select(`
          membership_type,
          team:ssyt_teams(id, name, short_name, color_primary, skipper_id, boat:ssyt_boats(id, name))
        `)
        .eq('participant_id', participant.id)
        .eq('status', 'active')
        .maybeSingle()

      const teamObj = Array.isArray(membership?.team) ? membership?.team[0] : membership?.team
      setTeam(teamObj)
      if (teamObj) {
        const boatObj = Array.isArray(teamObj.boat) ? teamObj.boat[0] : teamObj.boat
        setBoat(boatObj)
      }

      // Regate urmatoare
      const { data: seasons } = await supabase.from('ssyt_seasons').select('id').eq('status', 'active').limit(1)
      const seasonId = seasons?.[0]?.id

      const { data: regs } = await supabase
        .from('ssyt_regattas')
        .select('id, name, short_name, slug, start_date, end_date, event_type, status')
        .eq('season_id', seasonId)
        .gte('start_date', new Date().toISOString().split('T')[0])
        .order('start_date')
        .limit(3)
      setRegattas(regs || [])

      // Disponibilitati
      const regIds = (regs || []).map((r) => r.id)
      if (regIds.length > 0) {
        const { data: parts } = await supabase
          .from('ssyt_regatta_participation')
          .select('regatta_id, confirmation_status, on_crewlist')
          .eq('participant_id', participant.id)
          .in('regatta_id', regIds)
        const map: Record<string, any> = {}
        for (const p of parts || []) map[p.regatta_id] = p
        setParticipations(map)
      }
      setDataLoading(false)
    }

    load()
  }, [user, participant, loading])

  if (loading || dataLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="text-sm text-gray-400">Se încarcă...</div>
      </div>
    )
  }

  if (!participant) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-lg p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#0a1628' }}>
            Contul tău așteaptă aprobare
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {signupReqStatus === 'pending'
              ? 'Cererea ta a fost trimisă către organizatorul SSYT. Vei fi notificat când e aprobată.'
              : 'Contul tău nu e încă legat de un profil de participant. Contactează organizatorul.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Acasă</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Salut, {participant.first_name}!
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {team ? <>Ești în echipa <strong style={{ color: team.color_primary || '#0a1628' }}>{team.name}</strong>{boat && <>, ambarcațiune <strong>{boat.name}</strong></>}.</> : 'Nu ești încă alocat la o echipă.'}
        </p>
      </div>

      {team && (
        <Link href="/ssyt/portal/team" className="block mb-6 rounded-lg p-5 hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold" style={{ background: team.color_primary || '#4A5568' }}>
              {team.short_name?.[0] || team.name[0]}
            </div>
            <div className="flex-1">
              <div className="font-semibold" style={{ color: '#0a1628' }}>{team.name}</div>
              {boat && <div className="text-xs text-gray-500">⛵ {boat.name}</div>}
            </div>
            <span className="text-xs uppercase tracking-wider text-gray-400">vezi detalii →</span>
          </div>
        </Link>
      )}

      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Regate următoare</h2>

      {regattas.length > 0 ? (
        <div className="space-y-3">
          {regattas.map((r) => {
            const part = participations[r.id]
            const status = part?.confirmation_status
            const onCrewlist = part?.on_crewlist
            const d1 = new Date(r.start_date)
            const d2 = r.end_date ? new Date(r.end_date) : null
            return (
              <div key={r.id} className="rounded-lg p-4 flex items-center gap-4 flex-wrap" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="w-12 h-12 rounded-md flex flex-col items-center justify-center" style={{ background: '#0a1628', color: '#fff' }}>
                  <div className="text-xs uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
                  <div className="text-lg font-bold leading-none">{d1.getDate()}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/ssyt/regattas/${r.slug}`} className="font-semibold hover:underline" style={{ color: '#0a1628' }}>
                    {r.name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5">
                    {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}
                    {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={status} />
                  {onCrewlist && <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>pe crewlist</span>}
                </div>
              </div>
            )
          })}
          <Link href="/ssyt/portal/availability" className="inline-block mt-2 text-sm hover:underline" style={{ color: '#FF6B35' }}>
            Vezi toate regatele și editează disponibilitatea →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg p-8 text-center text-gray-400 italic" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          Niciun regatta în viitor.
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status?: string }) {
  const config: Record<string, { color: string; label: string }> = {
    confirmed: { color: '#10B981', label: 'Disponibil' },
    declined: { color: '#EF4444', label: 'Indisponibil' },
    tentative: { color: '#F59E0B', label: 'Tentative' },
    pending: { color: '#9CA3AF', label: 'În așteptare' },
  }
  const c = status ? config[status] : null
  if (!c) return <span className="text-xs text-gray-400 italic">— fără răspuns</span>
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c.color}15`, color: c.color }}>
      {c.label}
    </span>
  )
}
