import Link from 'next/link'
import { Plus, Image as ImageIcon } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import AdminMediaGallery from './AdminMediaGallery'

export const revalidate = 0

export default async function AdminMediaPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const [mediaRes, teamsRes, regattasRes] = await Promise.all([
    supabase
      .from('ssyt_media')
      .select(`
        *,
        team:ssyt_teams(id, name, short_name, color_primary),
        regatta:ssyt_regattas(id, name)
      `)
      .eq('season_id', season.id)
      .order('display_order')
      .order('taken_at', { ascending: false }),
    supabase.from('ssyt_teams').select('id, name, short_name, color_primary').eq('season_id', season.id).eq('status', 'active').order('display_order'),
    supabase.from('ssyt_regattas').select('id, name').eq('season_id', season.id).neq('status', 'draft').order('start_date'),
  ])

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Media
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {mediaRes.data?.length ?? 0} items totale. Media-urile public sunt vizibile la <Link href="/ssyt/media" target="_blank" className="underline">/ssyt/media</Link>.
          </p>
        </div>
      </div>

      <AdminMediaGallery
        seasonId={season.id}
        media={mediaRes.data || []}
        teams={teamsRes.data || []}
        regattas={regattasRes.data || []}
      />
    </div>
  )
}