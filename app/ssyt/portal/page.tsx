import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

export default async function PortalHome() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login')

  const { participant, seasonId } = session
  const supabase = getPortalSupabase()

  // Echipa
  const { data: membership } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id, membership_type')
    .eq('participant_id', participant.id)
    .eq('status', 'active')
    .maybeSingle()

  let team: any = null
  let boat: any = null
  if (membership?.team_id) {
    const { data: t } = await supabase
      .from('ssyt_teams')
      .select('id, name, short_name, color_primary, slug, boat_id, skipper_id')
      .eq('id', membership.team_id)
      .maybeSingle()
    team = t
    if (t?.boat_id) {
      const { data: b } = await supabase.from('ssyt_boats').select('id, name').eq('id', t.boat_id).maybeSingle()
      boat = b
    }
  }

  // Regate viitoare
  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, short_name, slug, start_date, end_date, event_type, status')
    .eq('season_id', seasonId)
    .gte('start_date', new Date().toISOString().split('T')[0])
    .order('start_date')
    .limit(3)

  // Disponibilitati
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

      {regattas && regattas.length > 0 ? (
        <div className="space-y-3">
          {regattas.map((r) => {
            const part = partMap[r.id]
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
