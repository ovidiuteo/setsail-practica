import Link from 'next/link'
import { BookOpen, Camera } from 'lucide-react'
import PhotoLightbox from './PhotoLightbox'

export type FeedPhoto = { id: string; url: string; caption: string | null }
export type TeamFeedEntry = {
  team: { id: string; name: string; short_name: string | null; color_primary: string | null; slug: string | null }
  journal: string
  photos: FeedPhoto[]
  isOwn: boolean
}

export default function RegattaTeamsFeed({ feed }: { feed: TeamFeedEntry[] }) {
  if (feed.length === 0) return null

  return (
    <div className="mt-6">
      <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
        Jurnale de bord & media de la echipe
      </h2>
      <div className="space-y-5">
        {feed.map((f) => {
          const color = f.team.color_primary || '#4A5568'
          const hasJournal = f.journal.trim().length > 0
          return (
            <div key={f.team.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              {/* Header echipa */}
              <div className="px-5 py-3 flex items-center justify-between" style={{ background: `${color}10`, borderBottom: '1px solid #e5e7eb' }}>
                <div className="inline-flex items-center gap-2 font-semibold" style={{ color: '#0a1628' }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <Link href={`/ssyt/teams/${f.team.slug || f.team.id}`} className="hover:underline">
                    {f.team.name}
                  </Link>
                </div>
                {f.isOwn && (
                  <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(255,107,53,0.15)', color: '#FF6B35' }}>
                    echipa ta
                  </span>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Jurnal */}
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5 inline-flex items-center gap-1.5">
                    <BookOpen size={11} /> Jurnal de bord
                  </div>
                  {hasJournal ? (
                    <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{f.journal}</div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">Fără jurnal.</p>
                  )}
                </div>

                {/* Poze */}
                {f.photos.length > 0 && (
                  <div>
                    <div className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-2 inline-flex items-center gap-1.5">
                      <Camera size={11} /> Poze <span className="text-gray-300 normal-case">· {f.photos.length}</span>
                    </div>
                    <PhotoLightbox photos={f.photos} />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
