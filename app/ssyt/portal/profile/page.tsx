import { redirect } from 'next/navigation'
import { getPortalSession } from '@/lib/ssyt/portal-session'
import ProfileForm from './ProfileForm'

export const dynamic = 'force-dynamic'

export default async function PortalProfilePage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login')

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Profil</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Date personale
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Poți actualiza telefonul, fotografia și preferințele. Email-ul, numele și CNP-ul sunt gestionate de organizator.
        </p>
      </div>

      <ProfileForm initial={session.participant} />
    </div>
  )
}
