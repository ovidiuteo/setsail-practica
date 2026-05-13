import { redirect } from 'next/navigation'
import { getCurrentUser, createSupabaseServerClient } from '@/lib/ssyt/supabase-server'
import ProfileForm from './ProfileForm'

export const dynamic = 'force-dynamic'

export default async function PortalProfilePage() {
  const { user, participant } = await getCurrentUser()
  if (!user) redirect('/ssyt/login')
  if (!participant) redirect('/ssyt/portal')

  // Reiau profilul cu toate campurile
  const supabase = createSupabaseServerClient()
  const { data: full } = await supabase
    .from('ssyt_participants')
    .select('id, first_name, last_name, email, phone, photo_url, notes, dietary_restrictions, emergency_contact, t_shirt_size')
    .eq('id', participant.id)
    .maybeSingle()

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Profil</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Date personale
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Actualizează datele tale. Email-ul nu poate fi schimbat direct (contactează organizatorul).
        </p>
      </div>

      <ProfileForm initial={full || {}} userEmail={user.email || ''} />
    </div>
  )
}
