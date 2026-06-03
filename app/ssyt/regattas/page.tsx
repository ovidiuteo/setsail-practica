import Link from 'next/link'
import { Anchor, MapPin, Image as ImageIcon } from 'lucide-react'
import { supabase, getActiveSeason, getRegattasBySeason } from '@/lib/ssyt/supabase'

export const dynamic = 'force-dynamic'

export default async function PublicRegattasPage() {
  const season = await getActiveSeason()
  const regattas = season ? await getRegattasBySeason(season.id) : []

  // Regate care au cel puțin o poză publică (pentru link-ul „Vezi poze" la cele trecute)
  const regattaIdsWithPhotos = new Set<string>()
  if (regattas.length > 0) {
    const { data: photoRows } = await supabase
      .from('ssyt_media')
      .select('regatta_id')
      .eq('media_type', 'photo')
      .eq('visibility', 'public')
      .in('regatta_id', regattas.map((r: any) => r.id))
    for (const row of photoRows || []) {
      if (row.regatta_id) regattaIdsWithPhotos.add(row.regatta_id as string)
    }
  }

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
            <RegattaCard key={r.id} regatta={r} hasPhotos={regattaIdsWithPhotos.has(r.id)} />
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

// Calculează status dinamic în funcție de data curentă
function getDynamicStatus(startDate: string, endDate: string | null): {
  state: 'past' | 'ongoing' | 'soon' | 'upcoming'
  label: string
  color: string
  bg: string
  subText: string | null
} {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = endDate ? new Date(endDate) : start
  end.setHours(0, 0, 0, 0)

  // PAST
  if (today > end) {
    return { state: 'past', label: 'TRECUT', color: '#9CA3AF', bg: 'rgba(156,163,175,0.12)', subText: null }
  }

  // ONGOING (azi între start și end, inclusiv)
  if (today >= start && today <= end) {
    return { state: 'ongoing', label: 'ONGOING', color: '#10B981', bg: 'rgba(16,185,129,0.15)', subText: 'în desfășurare' }
  }

  // Calcul zile până la start
  const msPerDay = 1000 * 60 * 60 * 24
  const daysUntil = Math.ceil((start.getTime() - today.getTime()) / msPerDay)

  // Sub-text comun pentru SOON și UPCOMING
  let subText: string
  if (daysUntil === 0) subText = 'azi'
  else if (daysUntil === 1) subText = 'mâine'
  else if (daysUntil < 30) subText = `în ${daysUntil} zile`
  else if (daysUntil < 60) subText = `într-o lună`
  else {
    const months = Math.floor(daysUntil / 30)
    subText = `în ${months} luni`
  }

  // SOON: less than a week (1-6 zile) → portocaliu
  if (daysUntil > 0 && daysUntil < 7) {
    return { state: 'soon', label: 'SOON', color: '#FF6B35', bg: 'rgba(255,107,53,0.12)', subText }
  }

  // UPCOMING: 7+ zile → albastru
  return { state: 'upcoming', label: 'UPCOMING', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', subText }
}

function RegattaCard({ regatta, hasPhotos = false }: { regatta: any; hasPhotos?: boolean }) {
  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const eventColor = eventTypeColors[regatta.event_type] || '#FF6B35'

  const status = getDynamicStatus(regatta.start_date, regatta.end_date)
  const isPast = status.state === 'past'

  const d1 = new Date(regatta.start_date)
  const d2 = regatta.end_date ? new Date(regatta.end_date) : null
  const day1 = d1.getDate()
  const day2 = d2 ? d2.getDate() : null
  const monthShort = d1.toLocaleString('ro-RO', { month: 'short' })

  // Past events: gri + opacitate redusa, nu mai sunt clickable — dar daca au poze, link „Vezi poze"
  if (isPast) {
    return (
      <div
        className="group relative block rounded-xl overflow-hidden cursor-not-allowed"
        style={{ background: '#fff', border: '1px solid #e5e7eb' }}
      >
        <div style={{ opacity: 0.55, filter: 'grayscale(60%)' }}>
          <CardContent regatta={regatta} status={status} eventColor="#9CA3AF" monthShort={monthShort} day1={day1} day2={day2} d1={d1} disabled />
        </div>
        {hasPhotos && (
          <Link
            href={`/ssyt/media?regatta=${regatta.id}`}
            title="Vezi poze"
            className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2 py-1.5 rounded-full text-xs font-medium text-white transition cursor-pointer hover:opacity-90"
            style={{ background: '#0a1628' }}
          >
            <ImageIcon size={13} />
            <span className="hidden group-hover:inline whitespace-nowrap">Vezi poze</span>
          </Link>
        )}
      </div>
    )
  }

  return (
    <Link
      href={`/ssyt/regattas/${regatta.slug || regatta.id}`}
      className="block rounded-xl overflow-hidden hover:shadow-lg transition group"
      style={{
        background: '#fff',
        border: status.state === 'ongoing' ? '2px solid #10B981' : '1px solid #e5e7eb',
      }}
    >
      <CardContent regatta={regatta} status={status} eventColor={eventColor} monthShort={monthShort} day1={day1} day2={day2} d1={d1} />
    </Link>
  )
}

function CardContent({
  regatta, status, eventColor, monthShort, day1, day2, d1, disabled = false,
}: {
  regatta: any
  status: ReturnType<typeof getDynamicStatus>
  eventColor: string
  monthShort: string
  day1: number
  day2: number | null
  d1: Date
  disabled?: boolean
}) {
  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const realEventColor = eventTypeColors[regatta.event_type] || '#FF6B35'

  return (
    <div className="flex">
      <div className="w-24 flex-shrink-0 flex flex-col items-center justify-center text-white p-4" style={{ background: eventColor }}>
        <span className="text-xs uppercase tracking-wide opacity-80">{monthShort}</span>
        <span className="text-3xl font-bold leading-none mt-1">
          {day1}{day2 && day2 !== day1 ? `-${day2}` : ''}
        </span>
        <span className="text-xs uppercase tracking-wide opacity-80 mt-1">{d1.getFullYear()}</span>
      </div>
      <div className="flex-1 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-lg tracking-tight" style={{ color: '#0a1628' }}>{regatta.name}</h3>
          <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
            <span
              className="text-xs uppercase tracking-wider px-2 py-1 rounded-full font-medium"
              style={{ background: status.bg, color: status.color }}
            >
              {status.label}
            </span>
            {status.subText && (
              <span className="text-[11px] text-gray-500 mt-0.5">{status.subText}</span>
            )}
          </div>
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
          <span className="uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: `${realEventColor}15`, color: realEventColor }}>
            {regatta.event_type}
          </span>
          {regatta.expected_races > 1 && (
            <span className="text-gray-500">{regatta.expected_races} curse</span>
          )}
          {!disabled && (
            <span className="ml-auto font-medium text-gray-400 group-hover:text-gray-700 transition">Detalii →</span>
          )}
        </div>
      </div>
    </div>
  )
}
