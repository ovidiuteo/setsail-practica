import Link from 'next/link'
import { Anchor, Calendar, Clock, Users, AlertCircle } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getCurrentUser, createSupabaseServerClient } from '@/lib/ssyt/supabase-server'

export const dynamic = 'force-dynamic'

export default async function PortalHome() {
  const { user, participant } = await getCurrentUser()
  if (!user) redirect('/ssyt/login')

  const supabase = createSupabaseServerClient()

  // Daca participantul nu e legat de user, arat mesaj
  if (!participant) {
    // Caut signup request
    const { data: signupReq } = await supabase
      .from('ssyt_signup_requests')
      .select('status, full_name')
      .eq('user_id', user.id)
      .maybeSingle()

    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="rounded-lg p-8 text-center" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <AlertCircle size={32} className="mx-auto mb-3 text-amber-500" />
          <h2 className="text-xl font-semibold mb-2" style={{ color: '#0a1628' }}>
            Contul tău așteaptă aprobare
          </h2>
          <p className="text-sm text-gray-500 max-w-md mx-auto">
            {signupReq?.status === 'pending'
              ? 'Cererea ta a fost trimisă către organizatorul SSYT. Vei fi notificat când e aprobată și legată de profilul tău.'
              : 'Contul tău nu e încă legat de un profil de participant. Contactează organizatorul.'}
          </p>
        </div>
      </div>
    )
  }

  // Iau echipa lui
  const { data: membership } = await supabase
    .from('ssyt_team_memberships')
    .select(`
      id, membership_type,
      team:ssyt_teams(id, name, short_name, color_primary, skipper_id, boat:ssyt_boats(id, name))
    `)
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  const team = Array.isArray(membership?.team) ? membership?.team[0] : membership?.team
  const boat = team && (Array.isArray(team.boat) ? team.boat[0] : team.boat)

  // Iau regate sezonului
  const { data: seasons } = await supabase.from('ssyt_seasons').select('id').eq('status', 'active').limit(1)
  const seasonId = seasons?.[0]?.id

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, short_name, slug, start_date, end_date, event_type, status')
    .eq('season_id', seasonId)
    .gte('start_date', new Date().toISOString().split('T')[0])
    .order('start_date')
    .limit(3)

  // Iau disponibilitatea participantului pentru regate
  const regattaIds = (regattas || []).map((r) => r.id)
  const { data: participations } = regattaIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('regatta_id, confirmation_status, on_crewlist')
        .eq('participant_id', participant.id)
        .in('regatta_id', regattaIds)
    : { data: [] }

  const partMap: Record<string, any> = {}
  for (const p of participations || []) partMap[p.regatta_id] = p

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

      {/* Echipa quick card */}
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

      {/* Regate urmatoare */}
      <div className="mb-4">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Regate următoare</h2>
      </div>

      {regattas && regattas.length > 0 ? (
        <div className="space-y-3">
          {regattas.map((r) => {
            const part = partMap[r.id]
            const status = part?.confirmation_status
            const onCrewlist = part?.on_crewlist
            const d1 = new Date(r.start_date)
            const d2 = r.end_date ? new Date(r.end_date) : null
            return (
              <div key={r.id} className="rounded-lg p-4 flex items-center gap-4" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="w-12 h-12 rounded-md flex flex-col items-center justify-center" style={{ background: '#0a1628', color: '#fff' }}>
                  <div className="text-xs uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
                  <div className="text-lg font-bold leading-none">{d1.getDate()}</div>
                </div>
                <div className="flex-1">
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
