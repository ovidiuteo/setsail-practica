import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Anchor, MapPin, Calendar } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import RegattaDetailTabs from './RegattaDetailTabs'

export const revalidate = 0

export default async function AdminRegattaDetailPage({ params }: { params: { id: string } }) {
  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!regatta) notFound()

  const [racesRes, participationRes, resultsRes, documentsRes, mediaRes, teamsRes, participantsRes, rolesRes, docTypesRes, journalsRes] = await Promise.all([
    supabase.from('ssyt_races').select('*').eq('regatta_id', regatta.id).order('race_number'),
    supabase.from('ssyt_regatta_participation').select(`
      *,
      participant:ssyt_participants(id, full_name, photo_url),
      team:ssyt_teams(id, name, short_name, color_primary),
      role:ssyt_roles(id, code, name_ro)
    `).eq('regatta_id', regatta.id),
    supabase.from('ssyt_results').select(`*, team:ssyt_teams(id, name, short_name, color_primary)`).eq('regatta_id', regatta.id).order('ssyt_internal_place'),
    supabase.from('ssyt_regatta_documents').select('*, document_type:ssyt_document_types(name, code)').eq('regatta_id', regatta.id).order('uploaded_at', { ascending: false }),
    supabase.from('ssyt_media').select('*, team:ssyt_teams(id, name, short_name)').eq('regatta_id', regatta.id).order('display_order'),
    supabase.from('ssyt_teams').select('id, name, short_name, color_primary, boat:ssyt_boats(name)').eq('status', 'active').order('display_order'),
    supabase.from('ssyt_participants').select('id, full_name').in('status', ['active', 'accepted']).order('full_name'),
    supabase.from('ssyt_roles').select('*').eq('is_active', true).order('display_order'),
    supabase.from('ssyt_document_types').select('*').eq('is_active', true).order('display_order'),
    supabase.from('ssyt_team_regatta_journal').select('id, team_id, content, updated_at, team:ssyt_teams(id, name, short_name, color_primary)').eq('regatta_id', regatta.id),
  ])

  const eventTypeColors: Record<string, string> = {
    regatta: '#FF6B35',
    training: '#00A8B5',
    briefing: '#6B7280',
    social: '#9CA3AF',
  }
  const headerColor = eventTypeColors[regatta.event_type] || '#FF6B35'

  return (
    <div className="px-8 py-8 max-w-6xl">
      <Link href="/ssyt/admin/regattas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4">
        <ArrowLeft size={14} />
        Toate regatele
      </Link>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8 flex-wrap">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: headerColor }}>
          <Anchor size={28} className="text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
              {regatta.name}
            </h1>
            <StatusBadge status={regatta.status} />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} />
              {formatDateRange(regatta.start_date, regatta.end_date)}
            </span>
            {regatta.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} />
                {regatta.location}
              </span>
            )}
            <span className="text-xs uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: `${headerColor}15`, color: headerColor }}>
              {regatta.event_type}
            </span>
          </div>
        </div>
      </div>

      <RegattaDetailTabs
        regatta={regatta}
        races={racesRes.data || []}
        participation={participationRes.data || []}
        results={resultsRes.data || []}
        documents={documentsRes.data || []}
        media={mediaRes.data || []}
        teams={teamsRes.data || []}
        allParticipants={participantsRes.data || []}
        roles={rolesRes.data || []}
        docTypes={docTypesRes.data || []}
        journals={journalsRes.data || []}
      />
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    upcoming: '#3B82F6',
    live: '#EF4444',
    completed: '#10B981',
    cancelled: '#6B7280',
    draft: '#9CA3AF',
  }
  const c = colors[status] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}

function formatDateRange(start: string, end: string | null) {
  const d1 = new Date(start)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' }
  if (!end || end === start) return d1.toLocaleDateString('ro-RO', opts)
  const d2 = new Date(end)
  if (d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear()) {
    return `${d1.getDate()} – ${d2.getDate()} ${d1.toLocaleString('ro-RO', { month: 'long' })} ${d1.getFullYear()}`
  }
  return `${d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })} – ${d2.toLocaleDateString('ro-RO', opts)}`
}