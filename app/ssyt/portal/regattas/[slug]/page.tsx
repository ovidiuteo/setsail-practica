import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, MapPin, Calendar, ExternalLink, FileText, Users, AlertCircle } from 'lucide-react'
import { getPortalSession, getPortalSupabase, canEditBoatType, getMyTeamAndPerms } from '@/lib/ssyt/portal-session'
import RegattaDocsList from './RegattaDocsList'
import TeamCrewSection, { type CrewMember } from './TeamCrewSection'

function isRegattaFrozen(end_date: string | null, status: string | null): boolean {
  if (status === 'completed' || status === 'cancelled') return true
  if (end_date) {
    const end = new Date(end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) return true
  }
  return false
}

// Heuristic: extrage orașul din "adresa_completa" — ignoră coduri poștale
// și prefixe "Sector X" (în București ordinea poate fi inversă: "..., București, Sector 1")
function cityFromAddress(addr: string | null): string | null {
  if (!addr) return null
  const parts = addr.split(',').map((s) => s.trim()).filter(Boolean)
  if (parts.length === 0) return null
  // Pornesc de la ultima parte și merg înapoi, omițând părți care nu sunt orașul:
  //   - "Sector X" / "Sect. X"
  //   - cod poștal pur numeric
  //   - "jud. Foo" / "județul Foo"
  for (let i = parts.length - 1; i >= 0; i--) {
    const part = parts[i]
    if (/^sect(or)?\.?\s*\d+/i.test(part)) continue
    if (/^\d+$/.test(part)) continue
    if (/^jud(ețul)?\.?\s+/i.test(part)) continue
    return part
  }
  return parts[parts.length - 1]
}

export const dynamic = 'force-dynamic'

function getDynStatus(startDate: string, endDate: string | null) {
  const today = new Date(); today.setHours(0,0,0,0)
  const start = new Date(startDate); start.setHours(0,0,0,0)
  const end = endDate ? new Date(endDate) : start; end.setHours(0,0,0,0)
  if (today > end) return { label: 'TRECUT', color: '#9CA3AF', bg: 'rgba(156,163,175,0.2)' }
  if (today >= start && today <= end) return { label: 'ONGOING', color: '#10B981', bg: 'rgba(16,185,129,0.2)' }
  const days = Math.ceil((start.getTime() - today.getTime()) / 86400000)
  if (days < 7) return { label: 'SOON', color: '#FF6B35', bg: 'rgba(255,107,53,0.2)' }
  return { label: 'UPCOMING', color: '#3B82F6', bg: 'rgba(59,130,246,0.2)' }
}

export default async function PortalRegattaDetailPage({ params }: { params: { slug: string } }) {
  const session = await getPortalSession()
  if (!session) redirect(`/ssyt/portal-login?next=/ssyt/portal/regattas/${params.slug}`)

  const supabase = getPortalSupabase()

  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('*')
    .eq('season_id', session.seasonId)
    .eq('slug', params.slug)
    .maybeSingle()

  if (!regatta) notFound()

  // Documente
  const { data: docs } = await supabase
    .from('ssyt_regatta_documents')
    .select(`
      id, name, description, file_url, document_type_id,
      doc_type:ssyt_document_types(id, name, code)
    `)
    .eq('regatta_id', regatta.id)
    .order('uploaded_at', { ascending: false })

  const { data: docTypes } = await supabase
    .from('ssyt_document_types')
    .select('id, name, code')
    .eq('is_active', true)
    .order('display_order')

  // Statusul personal
  const { data: myPart } = await supabase
    .from('ssyt_regatta_participation')
    .select('confirmation_status, on_crewlist')
    .eq('regatta_id', regatta.id)
    .eq('participant_id', session.participantId)
    .maybeSingle()

  const canEdit = await canEditBoatType(session.participantId)

  // Verific dacă userul curent e punctual și regata e ulterioară anchor-ului → lock pentru self
  const { data: myMembership } = await supabase
    .from('ssyt_team_memberships')
    .select('membership_type, punctual_anchor_regatta_id')
    .eq('participant_id', session.participantId)
    .eq('status', 'active')
    .maybeSingle()

  let isPunctualLockedHere = false
  if (myMembership?.membership_type === 'punctual' && myMembership.punctual_anchor_regatta_id) {
    const { data: anchor } = await supabase
      .from('ssyt_regattas')
      .select('end_date, start_date')
      .eq('id', myMembership.punctual_anchor_regatta_id)
      .maybeSingle()
    const anchorEnd = anchor?.end_date || anchor?.start_date
    if (anchorEnd && new Date(regatta.start_date).getTime() > new Date(anchorEnd).getTime()) {
      isPunctualLockedHere = true
    }
  }

  // Echipa cursantului + crew pentru regata curentă
  const { teamId, isSkipper, isEditor } = await getMyTeamAndPerms(session.participantId)
  let teamData: { id: string; name: string; short_name: string | null; color_primary: string | null } | null = null
  let crew: CrewMember[] = []
  if (teamId) {
    const { data: team } = await supabase
      .from('ssyt_teams')
      .select('id, name, short_name, color_primary, skipper_id')
      .eq('id', teamId)
      .maybeSingle()
    if (team) {
      teamData = {
        id: team.id,
        name: team.name,
        short_name: team.short_name,
        color_primary: team.color_primary,
      }

      const { data: members } = await supabase
        .from('ssyt_team_memberships')
        .select(
          'id, participant_id, membership_type, ' +
          'participant:ssyt_participants(id, full_name, email, phone, adresa_completa)'
        )
        .eq('team_id', teamId)
        .eq('status', 'active')

      const memberIds = (members ?? []).map((m: any) => m.participant_id).filter(Boolean)

      let partsByParticipant: Record<string, { confirmation_status: string | null; on_crewlist: boolean }> = {}
      if (memberIds.length > 0) {
        const { data: parts } = await supabase
          .from('ssyt_regatta_participation')
          .select('participant_id, confirmation_status, on_crewlist')
          .eq('regatta_id', regatta.id)
          .in('participant_id', memberIds)
        for (const p of parts ?? []) {
          partsByParticipant[p.participant_id as string] = {
            confirmation_status: p.confirmation_status as string | null,
            on_crewlist: !!p.on_crewlist,
          }
        }
      }

      crew = (members ?? []).map((m: any) => {
        const part = partsByParticipant[m.participant_id]
        const participantObj = Array.isArray(m.participant) ? m.participant[0] : m.participant
        return {
          participantId: m.participant_id,
          fullName: participantObj?.full_name || '—',
          email: participantObj?.email ?? null,
          phone: participantObj?.phone ?? null,
          city: cityFromAddress(participantObj?.adresa_completa ?? null),
          membershipType: m.membership_type,
          isSkipper: team.skipper_id === m.participant_id,
          status: part?.confirmation_status ?? null,
          onCrewlist: part?.on_crewlist ?? false,
        }
      })
      // Sortare: skipper primul, apoi alfabetic
      crew.sort((a, b) => {
        if (a.isSkipper && !b.isSkipper) return -1
        if (!a.isSkipper && b.isSkipper) return 1
        return a.fullName.localeCompare(b.fullName, 'ro')
      })
    }
  }

  const regattaIsFrozen = isRegattaFrozen(regatta.end_date, regatta.status)
  const canEditCrewlist = (isSkipper || isEditor) && !regattaIsFrozen

  const status = getDynStatus(regatta.start_date, regatta.end_date)
  const d1 = new Date(regatta.start_date)
  const d2 = regatta.end_date ? new Date(regatta.end_date) : null

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <Link href="/ssyt/portal/regattas" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4">
        <ArrowLeft size={14} /> Toate regatele
      </Link>

      {/* Hero */}
      <div className="rounded-2xl overflow-hidden mb-6" style={{ background: '#0a1628' }}>
        <div className="p-6 md:p-8">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full font-medium" style={{ background: status.bg, color: status.color }}>
              {status.label}
            </span>
            <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full font-medium text-white" style={{ background: 'rgba(255,107,53,0.85)' }}>
              {regatta.event_type}
            </span>
            {myPart?.confirmation_status && (
              <span className="text-xs uppercase tracking-wider px-2.5 py-1 rounded-full font-medium" style={{
                background: myPart.confirmation_status === 'confirmed' ? 'rgba(16,185,129,0.25)' :
                  myPart.confirmation_status === 'tentative' ? 'rgba(245,158,11,0.25)' :
                  'rgba(239,68,68,0.25)',
                color: '#fff',
              }}>
                tu: {myPart.confirmation_status === 'confirmed' ? 'Disponibil' : myPart.confirmation_status === 'tentative' ? 'Nu știu' : 'Indisponibil'}
              </span>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3" style={{ letterSpacing: '-0.02em' }}>
            {regatta.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-white/70 text-sm">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={14} />
              {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
              {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
            </span>
            {regatta.location && (
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> {regatta.location}</span>
            )}
          </div>
          <div className="mt-4">
            {isPunctualLockedHere ? (
              <span
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
                style={{ background: 'rgba(168,85,247,0.20)', color: '#e9d5ff', border: '1px solid rgba(168,85,247,0.4)' }}
                title="Ești membru one-time. Regata ta era cea anterioară — nu mai poți modifica disponibilitatea pentru regatele de după."
              >
                🔒 One-time — disponibilitatea înghețată
              </span>
            ) : (
              <Link href="/ssyt/portal/availability" className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md text-white font-medium hover:opacity-90 transition" style={{ background: '#FF6B35' }}>
                Editează disponibilitatea →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Echipa + Crewlist */}
      {teamData && (
        <TeamCrewSection
          team={teamData}
          crew={crew}
          regattaId={regatta.id}
          canEditCrewlist={canEditCrewlist}
          regattaIsFrozen={regattaIsFrozen}
          meParticipantId={session.participantId}
        />
      )}

      {/* Description */}
      {regatta.description && (
        <div className="rounded-lg p-5 mb-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <p className="text-gray-700 text-sm leading-relaxed">{regatta.description}</p>
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {regatta.marina && <InfoCard label="Marina" value={regatta.marina} />}
        {regatta.start_time && <InfoCard label="Ora start" value={regatta.start_time} />}
        {regatta.briefing_location && <InfoCard label="Briefing" value={regatta.briefing_location} />}
        {regatta.vhf_channel && <InfoCard label="VHF" value={regatta.vhf_channel} />}
      </div>

      {/* External links */}
      {(regatta.notice_of_race_url || regatta.sailing_instructions_url || regatta.external_event_url) && (
        <div className="mb-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-2">Link-uri externe</h2>
          <div className="flex flex-wrap gap-2">
            {regatta.notice_of_race_url && <ExtLink href={regatta.notice_of_race_url} label="Notice of Race" />}
            {regatta.sailing_instructions_url && <ExtLink href={regatta.sailing_instructions_url} label="Sailing Instructions" />}
            {regatta.external_event_url && <ExtLink href={regatta.external_event_url} label="Site eveniment" />}
          </div>
        </div>
      )}

      {/* Documente */}
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-1 flex items-center gap-1.5">
          <FileText size={12} /> Documente regatta
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          NOR, proteste, schiță, sediță tehnică, anunțuri speciale, taxă etc.
        </p>
        <RegattaDocsList
          docs={(docs || []) as any}
          docTypes={(docTypes || []) as any}
          regattaId={regatta.id}
          canEdit={canEdit}
        />
      </div>
    </div>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg p-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-0.5">{label}</div>
      <div className="font-medium text-sm" style={{ color: '#0a1628' }}>{value}</div>
    </div>
  )
}

function ExtLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium hover:bg-gray-50 transition" style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}>
      {label}
      <ExternalLink size={11} className="text-gray-400" />
    </a>
  )
}
