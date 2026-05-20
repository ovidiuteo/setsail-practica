import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ArrowLeft, Shield, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import ApplicationFlow from './ApplicationFlow'

export const dynamic = 'force-dynamic'

const STATUS_BADGES: Record<string, { label: string; bg: string; fg: string; icon: typeof Clock }> = {
  started:    { label: 'Aplicație în curs',     bg: '#dbeafe', fg: '#1e40af', icon: Clock },
  submitted:  { label: 'Aplicație trimisă',     bg: '#fef3c7', fg: '#92400e', icon: Clock },
  approved:   { label: 'Aplicație acceptată ✓', bg: '#dcfce7', fg: '#166534', icon: CheckCircle2 },
  rejected:   { label: 'Aplicație respinsă',    bg: '#fee2e2', fg: '#991b1b', icon: XCircle },
  cancelled:  { label: 'Aplicație anulată',     bg: '#f1f5f9', fg: '#475569', icon: XCircle },
}

export default async function PortalClubApplicationPage({
  params,
}: {
  params: { slug: string }
}) {
  const session = (await getPortalSession())!
  const supabase = getPortalSupabase()

  const { data: club } = await supabase
    .from('ssyt_sport_clubs')
    .select('id, slug, name, logo_url, is_active')
    .eq('slug', params.slug)
    .maybeSingle()

  if (!club) notFound()

  const { data: application } = await supabase
    .from('ssyt_club_applications')
    .select('id, status, started_at, submitted_at, decided_at, admin_notes')
    .eq('participant_id', session.participantId)
    .eq('club_id', club.id)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!application) {
    redirect(`/ssyt/portal/club/${club.slug}`)
  }

  const [templatesRes, contactsRes, proceduresRes] = await Promise.all([
    supabase
      .from('ssyt_club_document_templates')
      .select('id, title, description, is_required, display_order')
      .eq('club_id', club.id)
      .order('display_order'),
    supabase
      .from('ssyt_club_contacts')
      .select('id, contact_type, name, email, label, display_order')
      .eq('club_id', club.id)
      .order('display_order'),
    supabase
      .from('ssyt_club_procedures')
      .select('id, step_no, title, description_md, optional_link')
      .eq('club_id', club.id)
      .order('step_no'),
  ])

  const badge = STATUS_BADGES[application.status] ?? STATUS_BADGES.started
  const BadgeIcon = badge.icon

  return (
    <div>
      <Link
        href={`/ssyt/portal/club/${club.slug}`}
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Înapoi la pagina clubului
      </Link>

      <div
        className="rounded-lg border p-5 mb-4 flex items-start gap-4 flex-wrap"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        {club.logo_url ? (
          <img src={club.logo_url} alt={club.name} className="w-14 h-14 object-contain" />
        ) : (
          <div
            className="w-14 h-14 rounded-lg flex items-center justify-center"
            style={{ background: '#f1f5f9' }}
          >
            <Shield size={22} style={{ color: '#94a3b8' }} />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
          >
            Aplicația ta la {club.name}
          </h1>
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
              style={{ background: badge.bg, color: badge.fg }}
            >
              <BadgeIcon size={12} />
              {badge.label}
            </span>
            {application.submitted_at && (
              <span className="text-xs text-gray-500">
                trimisă: {new Date(application.submitted_at).toLocaleDateString('ro-RO')}
              </span>
            )}
          </div>

          {application.admin_notes && (
            <div
              className="mt-3 text-sm rounded-md px-3 py-2"
              style={{ background: '#f0f9ff', color: '#0c4a6e', border: '1px solid #bae6fd' }}
            >
              <strong>Notă de la club:</strong> {application.admin_notes}
            </div>
          )}
        </div>
      </div>

      <ApplicationFlow
        applicationId={application.id}
        applicationStatus={application.status}
        clubSlug={club.slug}
        templates={templatesRes.data ?? []}
        contacts={contactsRes.data ?? []}
        procedures={proceduresRes.data ?? []}
      />
    </div>
  )
}
