import Link from 'next/link'
import { Calendar, MapPin } from 'lucide-react'
import { getActiveSeason, getRegattasBySeason } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function CalendarPage() {
  const season = await getActiveSeason()
  const regattas = season ? await getRegattasBySeason(season.id) : []

  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season?.name || 'SSYT 2026'}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Calendar sezon
        </h1>
        <p className="text-gray-600 mt-2">
          {season?.start_date && season?.end_date
            ? `Sezonul rulează între ${formatDate(season.start_date)} și ${formatDate(season.end_date)}.`
            : 'Calendarul oficial al sezonului.'}
        </p>
      </div>

      {regattas.length > 0 ? (
        <div>
          {regattas.map((r, i) => (
            <TimelineItem
              key={r.id}
              regatta={r}
              isFirst={i === 0}
              isLast={i === regattas.length - 1}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Calendar size={32} className="mx-auto mb-4 opacity-30" />
          <p>Calendarul oficial va fi publicat în curând.</p>
        </div>
      )}
    </div>
  )
}

function TimelineItem({ regatta, isFirst, isLast }: { regatta: any; isFirst: boolean; isLast: boolean }) {
  const date = new Date(regatta.start_date)
  const monthShort = date.toLocaleString('ro-RO', { month: 'short' })
  const day = date.getDate()
  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const color = eventTypeColors[regatta.event_type] || '#FF6B35'

  return (
    <Link
      href={`/ssyt/regattas/${regatta.slug || regatta.id}`}
      className="flex gap-5 group"
    >
      {/* Coloana bulină: linie sus + bulină centrată + linie jos.
          Bulina e centrată pe verticală față de card (segmentele flex-1 egale).
          Fără linie deasupra primei / sub ultima (după ultimul eveniment). */}
      <div className="flex-shrink-0 w-14 flex flex-col items-center self-stretch">
        <div className="w-0.5 flex-1" style={{ background: isFirst ? 'transparent' : '#e5e7eb' }} />
        <div className="w-14 h-14 flex-shrink-0 rounded-full flex flex-col items-center justify-center text-white font-medium" style={{ background: color }}>
          <span className="text-[10px] uppercase opacity-90 leading-none">{monthShort}</span>
          <span className="text-lg font-semibold leading-none mt-0.5">{day}</span>
        </div>
        <div className="w-0.5 flex-1" style={{ background: isLast ? 'transparent' : '#e5e7eb' }} />
      </div>

      <div className="flex-1 py-2">
        <div className="rounded-lg p-5 hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <div className="flex items-start justify-between gap-3 mb-2">
            <h3 className="font-semibold text-lg text-gray-900">{regatta.name}</h3>
            <span className="text-xs uppercase tracking-wider px-2 py-1 rounded-full font-medium flex-shrink-0" style={{ background: `${color}15`, color }}>
              {regatta.event_type}
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

          <div className="mt-3 text-xs font-medium text-gray-400 group-hover:text-gray-700 transition">
            Vezi detalii →
          </div>
        </div>
      </div>
    </Link>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })
}
