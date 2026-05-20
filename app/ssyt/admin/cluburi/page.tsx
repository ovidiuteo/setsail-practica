import Link from 'next/link'
import { Shield, Plus } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import ClubsManager from './ClubsManager'

export const revalidate = 0

export default async function AdminClubsPage() {
  const season = await getActiveSeason()

  const { data: clubs } = await supabase
    .from('ssyt_sport_clubs')
    .select('id, slug, name, short_description, logo_url, display_order, is_active, created_at')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true })

  const clubIds = (clubs ?? []).map((c) => c.id)
  let appsCounts: Record<string, { active: number; total: number }> = {}

  if (clubIds.length > 0) {
    const { data: apps } = await supabase
      .from('ssyt_club_applications')
      .select('club_id, status')
      .in('club_id', clubIds)

    appsCounts = (apps ?? []).reduce((acc: Record<string, { active: number; total: number }>, a) => {
      const k = a.club_id as string
      if (!acc[k]) acc[k] = { active: 0, total: 0 }
      acc[k].total += 1
      if (['started', 'submitted', 'approved'].includes(a.status as string)) {
        acc[k].active += 1
      }
      return acc
    }, {})
  }

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          {season && (
            <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
              {season.name}
            </p>
          )}
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
          >
            <Shield size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Cluburi sportive
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {clubs?.length || 0} cluburi configurate. Participanții pot adera la un singur club activ
            la un moment dat. Ordinea din listă (`display_order`) controlează cum apar în portal.
          </p>
        </div>

        <Link
          href="/ssyt/admin/cluburi/nou"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Plus size={16} />
          Adaugă club
        </Link>
      </div>

      <ClubsManager clubs={clubs ?? []} appsCounts={appsCounts} />
    </div>
  )
}
