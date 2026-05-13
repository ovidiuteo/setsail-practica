import Link from 'next/link'
import { Anchor, MapPin } from 'lucide-react'
import { supabase, getActiveSeason, getRegattasBySeason } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function PublicRegattasPage() {
  const season = await getActiveSeason()
  const regattas = season ? await getRegattasBySeason(season.id) : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season?.name || 'SSYT 2026'}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Regatte
        </h1>
        <p className="text-gray-600 mt-2">
          {regattas.length > 0
            ? `${regattas.length} evenimente programate în sezonul ${season?.year}.`
            : 'Evenimentele vor fi anunțate în curând.'}
        </p>
      </div>

      {regattas.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regattas.map((r: any) => (
            <RegattaCard key={r.id} regatta={r} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Anchor size={32} className="mx-auto mb-4 opacity-30" />
          <p>Niciun eveniment publicat.</p>
        </div>
      )}
    </div>
  )
}

function RegattaCard({ regatta }: { regatta: any }) {
  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const statusColors: Record<string, string> = {
    upcoming: '#3B82F6',
    live: '#EF4444',
    completed: '#10B981',
    cancelled: '#6B7280',
    draft: '#9CA3AF',
  }
  const color = eventTypeColors[regatta.event_type] || '#FF6B35'
  const statusColor = statusColors[regatta.status] || '#6B7280'

  const d1 = new Date(regatta.start_date)
  const d2 = regatta.end_date ? new Date(regatta.end_date) : null
  const day1 = d1.getDate()
  const day2 = d2 ? d2.getDate() : null
  const monthShort = d1.toLocaleString('ro-RO', { month: 'short' })

  return (
    <Link
      href={`/ssyt/regattas/${regatta.slug || regatta.id}`}
      className="block rounded-xl overflow-hidden hover:shadow-lg transition group"
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
    >
      <div className="flex">
        <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center text-white p-4" style={{ background: color }}>
          <span className="text-xs uppercase tracking-wide opacity-80">{monthShort}</span>
          <span className="text-3xl font-bold leading-none mt-1">
            {day1}{day2 && day2 !== day1 ? `-${day2}` : ''}
          </span>
          <span className="text-xs uppercase tracking-wide opacity-80 mt-1">{d1.getFullYear()}</span>
        </div>
        <div className="flex-1 p-5">
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-lg tracking-tight" style={{ color: '#0a1628' }}>{regatta.name}</h3>
            <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${statusColor}15`, color: statusColor }}>
              {regatta.status}
            </span>
          </div>

          {regatta.location && (
            <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-2">
              <MapPin size={12} />
              <span>{regatta.location}</span>
            </div>
          )}

          {regatta.description && (
            <p className="text-sm text-gray-600 line-clamp-2">{regatta.description}</p>
          )}

          <div className="flex items-center gap-3 mt-3 text-xs">
            <span className="uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: `${color}15`, color }}>
              {regatta.event_type}
            </span>
            {regatta.expected_races > 1 && (
              <span className="text-gray-500">{regatta.expected_races} curse</span>
            )}
            <span className="ml-auto font-medium text-gray-400 group-hover:text-gray-700 transition">Detalii →</span>
          </div>
        </div>
      </div>
    </Link>
  )
}