import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { Shield, ArrowLeft, Globe, Phone, MapPin } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'
import ApplyButton from './ApplyButton'

export const dynamic = 'force-dynamic'

export default async function PortalClubDetailPage({ params }: { params: { slug: string } }) {
  const session = (await getPortalSession())!
  const supabase = getPortalSupabase()

  const { data: club } = await supabase
    .from('ssyt_sport_clubs')
    .select(
      'id, slug, name, short_description, description_md, logo_url, address, website, phone, is_active'
    )
    .eq('slug', params.slug)
    .maybeSingle()

  if (!club || !club.is_active) notFound()

  // Daca participantul are deja aplicatie activa la ALT club, redirecteaza
  const { data: activeApp } = await supabase
    .from('ssyt_club_applications')
    .select('id, club_id, club:ssyt_sport_clubs(slug, name)')
    .eq('participant_id', session.participantId)
    .in('status', ['started', 'submitted', 'approved'])
    .maybeSingle()

  const hasActiveAtThisClub = activeApp?.club_id === club.id
  const activeClubRel = Array.isArray(activeApp?.club) ? activeApp?.club?.[0] : activeApp?.club
  const activeAtOther =
    activeApp && !hasActiveAtThisClub
      ? {
          slug: (activeClubRel as { slug?: string } | null)?.slug,
          name: (activeClubRel as { name?: string } | null)?.name,
        }
      : null

  if (hasActiveAtThisClub) {
    redirect(`/ssyt/portal/club/${params.slug}/aplicare`)
  }

  return (
    <div>
      <Link
        href="/ssyt/portal/club"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Înapoi la cluburi
      </Link>

      <div className="rounded-lg border p-6 mb-4" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
        <div className="flex items-start gap-4 mb-4">
          {club.logo_url ? (
            <img
              src={club.logo_url}
              alt={club.name}
              className="w-20 h-20 object-contain shrink-0"
            />
          ) : (
            <div
              className="w-20 h-20 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: '#f1f5f9' }}
            >
              <Shield size={32} style={{ color: '#94a3b8' }} />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h1
              className="text-2xl font-semibold tracking-tight"
              style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
            >
              {club.name}
            </h1>
            {club.short_description && (
              <p className="text-sm text-gray-600 mt-1">{club.short_description}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-500">
              {club.address && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} /> {club.address}
                </span>
              )}
              {club.phone && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} /> {club.phone}
                </span>
              )}
              {club.website && (
                <a
                  href={club.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 underline hover:text-orange-600"
                >
                  <Globe size={12} /> {club.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          </div>
        </div>

        {club.description_md && (
          <article className="prose prose-sm max-w-none mt-4 text-gray-700 whitespace-pre-wrap">
            {club.description_md}
          </article>
        )}
      </div>

      {activeAtOther && activeAtOther.slug && (
        <div
          className="rounded-md px-4 py-3 mb-4 text-sm"
          style={{ background: '#fef3c7', color: '#92400e', border: '1px solid #fde68a' }}
        >
          Ai deja o aplicație activă la <strong>{activeAtOther.name}</strong>. Pentru a aplica aici,
          anulează mai întâi aplicația curentă din{' '}
          <Link
            href={`/ssyt/portal/club/${activeAtOther.slug}/aplicare`}
            className="underline font-medium"
          >
            pagina ei
          </Link>
          .
        </div>
      )}

      <ApplyButton clubSlug={club.slug} clubName={club.name} disabled={!!activeAtOther} />
    </div>
  )
}
