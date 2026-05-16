import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Anchor, MapPin } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

function getDynStatus(startDate: string, endDate: string | null) {
  const today = new Date(); today.setHours(0,0,0,0)
  const start = new Date(startDate); start.setHours(0,0,0,0)
  const end = endDate ? new Date(endDate) : start; end.setHours(0,0,0,0)
  if (today > end) return { state: 'past', label: 'TRECUT', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)' }
  if (today >= start && today <= end) return { state: 'ongoing', label: 'ONGOING', color: '#10B981', bg: 'rgba(16,185,129,0.15)' }
  const days = Math.ceil((start.getTime() - today.getTime()) / 86400000)
  if (days < 7) return { state: 'soon', label: 'SOON', color: '#FF6B35', bg: 'rgba(255,107,53,0.12)' }
  return { state: 'upcoming', label: 'UPCOMING', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' }
}

const myStatusConfig: Record<string, { label: string; color: string }> = {
  confirmed: { label: 'Disponibil', color: '#10B981' },
  tentative: { label: 'Nu știu', color: '#F59E0B' },
  declined: { label: 'Indisponibil', color: '#EF4444' },
}

export default async function PortalRegattasPage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login?next=/ssyt/portal/regattas')

  const supabase = getPortalSupabase()

  const { data: regattas } = await supabase
    .from('ssyt_regattas')
    .select('id, name, slug, start_date, end_date, event_type, location, description')
    .eq('season_id', session.seasonId)
    .order('start_date')

  const regIds = (regattas || []).map((r) => r.id)
  const { data: myPart } = regIds.length > 0
    ? await supabase
        .from('ssyt_regatta_participation')
        .select('regatta_id, confirmation_status, on_crewlist')
        .eq('participant_id', session.participantId)
        .in('regatta_id', regIds)
    : { data: [] }
  const myPartMap: Record<string, any> = {}
  for (const p of myPart || []) myPartMap[p.regatta_id] = p

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Regate sezon</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Regatte
        </h1>
        <p className="text-sm text-gray-500 mt-1">{(regattas || []).length} evenimente în sezon.</p>
      </div>

      <div className="space-y-3">
        {(regattas || []).map((r: any) => {
          const status = getDynStatus(r.start_date, r.end_date)
          const myPart = myPartMap[r.id]
          const myStatus = myPart?.confirmation_status
          const isPast = status.state === 'past'
          const d1 = new Date(r.start_date)
          const d2 = r.end_date ? new Date(r.end_date) : null

          return (
            <Link
              key={r.id}
              href={`/ssyt/portal/regattas/${r.slug}`}
              className="block rounded-lg overflow-hidden hover:shadow-md transition"
              style={{
                background: '#fff',
                border: status.state === 'ongoing' ? '2px solid #10B981' : '1px solid #e5e7eb',
                opacity: isPast ? 0.6 : 1,
                filter: isPast ? 'grayscale(40%)' : 'none',
              }}
            >
              <div className="flex">
                <div className="w-20 flex-shrink-0 flex flex-col items-center justify-center text-white p-3" style={{ background: status.state === 'past' ? '#9CA3AF' : '#FF6B35' }}>
                  <span className="text-[10px] uppercase tracking-wider opacity-80">{d1.toLocaleString('ro-RO', { month: 'short' })}</span>
                  <span className="text-2xl font-bold leading-none mt-0.5">
                    {d1.getDate()}{d2 && d2.getDate() !== d1.getDate() ? `-${d2.getDate()}` : ''}
                  </span>
                </div>
                <div className="flex-1 p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold" style={{ color: '#0a1628' }}>{r.name}</h3>
                      {r.location && (
                        <div className="text-xs text-gray-500 mt-0.5 inline-flex items-center gap-1">
                          <MapPin size={11} /> {r.location}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
                        {status.label}
                      </span>
                      {myStatus && myStatusConfig[myStatus] && !isPast && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{
                          background: `${myStatusConfig[myStatus].color}15`,
                          color: myStatusConfig[myStatus].color,
                        }}>
                          tu: {myStatusConfig[myStatus].label}
                        </span>
                      )}
                      {myPart?.on_crewlist && (
                        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>
                          ✓ crewlist
                        </span>
                      )}
                    </div>
                  </div>
                  {r.description && (
                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">{r.description}</p>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {(regattas || []).length === 0 && (
        <div className="rounded-lg p-8 text-center text-gray-400 italic" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Anchor size={24} className="mx-auto mb-2 opacity-30" />
          Niciun regatta în sezon.
        </div>
      )}
    </div>
  )
}
