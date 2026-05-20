import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Shield, ArrowRight } from 'lucide-react'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

export default async function PortalClubsListPage() {
  const session = (await getPortalSession())!
  const supabase = getPortalSupabase()

  // Daca exista aplicatie activa, redirect direct la /aplicare/[slug]
  const { data: activeApp } = await supabase
    .from('ssyt_club_applications')
    .select('id, club:ssyt_sport_clubs(slug)')
    .eq('participant_id', session.participantId)
    .in('status', ['started', 'submitted', 'approved'])
    .maybeSingle()

  if (activeApp) {
    const clubRel = Array.isArray(activeApp.club) ? activeApp.club[0] : activeApp.club
    const slug = (clubRel as { slug?: string } | null)?.slug
    if (slug) redirect(`/ssyt/portal/club/${slug}/aplicare`)
  }

  const { data: clubs } = await supabase
    .from('ssyt_sport_clubs')
    .select('id, slug, name, short_description, logo_url, address, website')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  return (
    <div>
      <div className="mb-6">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
        >
          <Shield size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Alege un club sportiv
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Pentru a participa la regatele oficiale din calendarul SSYT 2026, trebuie să fii legitimat la
          un club sportiv afiliat la Federația Română de Yachting. Vezi opțiunile de mai jos și alege
          una care ți se potrivește. Poți schimba clubul oricând până la prima regată.
        </p>
      </div>

      {(!clubs || clubs.length === 0) && (
        <div
          className="rounded-lg border border-dashed py-12 text-center"
          style={{ borderColor: '#cbd5e1', background: '#fff' }}
        >
          <p className="text-gray-500">
            Nu există cluburi configurate momentan. Revino mai târziu.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clubs?.map((club) => (
          <Link
            key={club.id}
            href={`/ssyt/portal/club/${club.slug}`}
            className="block rounded-lg border p-5 transition hover:shadow-md"
            style={{ borderColor: '#e2e8f0', background: '#fff' }}
          >
            {club.logo_url ? (
              <img
                src={club.logo_url}
                alt={club.name}
                className="w-16 h-16 mb-3 object-contain"
              />
            ) : (
              <div
                className="w-16 h-16 mb-3 rounded-lg flex items-center justify-center"
                style={{ background: '#f1f5f9' }}
              >
                <Shield size={28} style={{ color: '#94a3b8' }} />
              </div>
            )}

            <h2
              className="text-base font-semibold leading-tight mb-2"
              style={{ color: '#0a1628' }}
            >
              {club.name}
            </h2>

            {club.short_description && (
              <p className="text-sm text-gray-600 line-clamp-4 mb-3">{club.short_description}</p>
            )}

            {club.address && (
              <p className="text-xs text-gray-400 mb-3">📍 {club.address}</p>
            )}

            <span
              className="inline-flex items-center gap-1 text-sm font-medium"
              style={{ color: '#FF6B35' }}
            >
              Vezi detalii
              <ArrowRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
