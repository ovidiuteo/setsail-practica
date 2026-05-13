import Link from 'next/link'
import { Anchor } from 'lucide-react'
import { getActiveSeason, getTeamsBySeason } from '@/lib/ssyt/supabase'

export const revalidate = 60

export default async function TeamsPage() {
  const season = await getActiveSeason()
  const teams = season ? await getTeamsBySeason(season.id) : []

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season?.name || 'SSYT 2026'}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Echipe
        </h1>
        <p className="text-gray-600 mt-2 max-w-2xl">
          {teams.length > 0
            ? `${teams.length} echipe înscrise în sezonul ${season?.year}. Fiecare echipă navighează un Beneteau First 34.7 și concurează pentru titlul SSYT.`
            : 'Echipele sezonului vor fi anunțate în curând.'}
        </p>
      </div>

      {teams.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map((t) => {
            const color = t.color_primary || '#4A5568'
            return (
              <Link
                key={t.id}
                href={`/ssyt/teams/${t.slug || t.id}`}
                className="block rounded-xl overflow-hidden hover:shadow-lg transition group"
                style={{ background: '#fff', border: '1px solid #e5e7eb' }}
              >
                <div className="h-32 flex items-center justify-center relative" style={{ background: color }}>
                  <span className="text-white font-bold text-2xl tracking-tight">{t.short_name || t.name}</span>
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-lg text-gray-900 mb-1">{t.name}</h3>
                  {t.slogan && <p className="text-sm text-gray-500 italic mb-3">"{t.slogan}"</p>}

                  <div className="space-y-1.5 text-sm">
                    {t.skipper && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="text-xs uppercase tracking-wide text-gray-400 font-medium">Skipper</span>
                        <span>{t.skipper.full_name}</span>
                      </div>
                    )}
                    {t.boat && (
                      <div className="flex items-center gap-2 text-gray-600">
                        <Anchor size={12} className="text-gray-400" />
                        <span>{t.boat.name} · {t.boat.model}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 text-xs font-medium text-gray-400 group-hover:text-gray-700 transition">
                    Vezi echipa →
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl p-16 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Anchor size={32} className="mx-auto mb-4 opacity-30" />
          <p>Nicio echipă publicată momentan.</p>
        </div>
      )}
    </div>
  )
}
