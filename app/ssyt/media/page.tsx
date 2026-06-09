import Link from 'next/link'
import { Image as ImageIcon, Camera } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import PreviewButton from '@/components/ssyt/FilePreview'

export const revalidate = 60

type SearchParams = { team?: string; regatta?: string; type?: string }

export default async function MediaPage({ searchParams }: { searchParams: SearchParams }) {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="py-20 text-center text-gray-500">Niciun sezon activ.</div>
  }

  let query = supabase
    .from('ssyt_media')
    .select(`
      *,
      team:ssyt_teams(id, name, short_name, color_primary, slug),
      regatta:ssyt_regattas(id, name, slug)
    `)
    .eq('season_id', season.id)
    .eq('visibility', 'public')
    .order('display_order')
    .order('taken_at', { ascending: false })

  if (searchParams.team) query = query.eq('team_id', searchParams.team)
  if (searchParams.regatta) query = query.eq('regatta_id', searchParams.regatta)
  if (searchParams.type) query = query.eq('media_type', searchParams.type)

  const { data: media } = await query

  // Filtre disponibile
  const [teamsRes, regattasRes] = await Promise.all([
    supabase.from('ssyt_teams').select('id, name, short_name, color_primary').eq('season_id', season.id).eq('status', 'active').order('display_order'),
    supabase.from('ssyt_regattas').select('id, name').eq('season_id', season.id).neq('status', 'draft').order('start_date'),
  ])

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Media
        </h1>
        <p className="text-gray-600">
          {media && media.length > 0
            ? `${media.length} ${media.length === 1 ? 'item' : 'items'} în galerie.`
            : 'Galeria va fi populată pe măsură ce sezonul progresează.'}
        </p>
      </div>

      {/* Filtre */}
      <div className="flex flex-wrap gap-2 mb-8">
        <FilterChip href="/ssyt/media" active={!searchParams.team && !searchParams.regatta && !searchParams.type} label="Toate" />
        {(teamsRes.data || []).map((t: any) => (
          <FilterChip
            key={t.id}
            href={`/ssyt/media?team=${t.id}`}
            active={searchParams.team === t.id}
            label={t.short_name || t.name}
            color={t.color_primary}
          />
        ))}
        {(regattasRes.data || []).map((r: any) => (
          <FilterChip
            key={r.id}
            href={`/ssyt/media?regatta=${r.id}`}
            active={searchParams.regatta === r.id}
            label={r.name}
          />
        ))}
      </div>

      {!media || media.length === 0 ? (
        <div className="rounded-xl p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ImageIcon size={32} className="mx-auto mb-4 opacity-30" />
          <p>Nicio imagine în galerie pentru filtrele alese.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {media.map((m: any) => (
            <MediaCard key={m.id} item={m} />
          ))}
        </div>
      )}
    </div>
  )
}

function FilterChip({ href, active, label, color }: { href: string; active: boolean; label: string; color?: string | null }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition"
      style={{
        background: active ? '#0a1628' : '#fff',
        color: active ? '#fff' : '#6B7280',
        border: active ? '1px solid #0a1628' : '1px solid #e5e7eb',
      }}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }}></span>}
      {label}
    </Link>
  )
}

function MediaCard({ item }: { item: any }) {
  return (
    <div className="rounded-lg overflow-hidden group" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="aspect-square bg-gray-100 relative overflow-hidden">
        {item.url && item.media_type === 'photo' ? (
          <>
            <img src={item.url} alt={item.caption || ''} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
            <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition">
              <PreviewButton url={item.url} title={item.caption} contentType="image/*" className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white bg-black/50 hover:bg-black/70 transition" />
            </span>
          </>
        ) : item.media_type === 'video' || item.media_type === 'reel' ? (
          <a href={item.url} target="_blank" rel="noopener noreferrer" className="w-full h-full flex items-center justify-center bg-black/80 text-white">
            <Camera size={32} />
            <span className="ml-2 text-sm">{item.media_type}</span>
          </a>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon size={28} className="text-gray-300" />
          </div>
        )}
      </div>

      <div className="p-3">
        {item.caption && (
          <p className="text-xs text-gray-700 mb-2 line-clamp-2">{item.caption}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {item.team && (
            <Link
              href={`/ssyt/teams/${item.team.slug || item.team.id}`}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <span className="w-2 h-2 rounded-full" style={{ background: item.team.color_primary || '#4A5568' }}></span>
              <span className="text-gray-600">{item.team.short_name || item.team.name}</span>
            </Link>
          )}
          {item.regatta && (
            <Link
              href={`/ssyt/regattas/${item.regatta.slug || item.regatta.id}`}
              className="text-gray-500 hover:text-gray-900 hover:underline truncate"
            >
              {item.regatta.name}
            </Link>
          )}
        </div>
        {item.credit && (
          <div className="mt-2 text-xs text-gray-400">© {item.credit}</div>
        )}
      </div>
    </div>
  )
}