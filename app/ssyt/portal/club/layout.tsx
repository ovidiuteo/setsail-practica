import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/ssyt/portal-session'
import { getSportClubsAccess } from '@/lib/ssyt/club-access'

export const dynamic = 'force-dynamic'

export default async function ClubGatedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login?next=/ssyt/portal/club')

  const access = await getSportClubsAccess(session.participantId, session.seasonId)
  if (!access.hasAccess) redirect('/ssyt/portal')

  return (
    <div className="max-w-5xl mx-auto px-6 py-6">
      {!access.enabledForAll && (
        <div
          className="mb-4 px-4 py-2 rounded-md text-xs flex items-center gap-2"
          style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}
        >
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: '#FF6B35' }} />
          Modulul „Club sportiv" este momentan în BETA. Doar tu și câțiva alți participanți selectați
          vedeți această secțiune până la lansarea oficială.
        </div>
      )}
      {children}
    </div>
  )
}
