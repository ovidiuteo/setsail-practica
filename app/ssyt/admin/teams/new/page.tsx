import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import TeamNewForm from './TeamNewForm'

export const revalidate = 0

export default async function NewTeamPage() {
  const season = await getActiveSeason()

  // Boats libere (fără echipă activă) + skipperi disponibili
  const [boatsRes, participantsRes] = await Promise.all([
    supabase
      .from('ssyt_boats')
      .select('id, name, model, teams:ssyt_teams(id, status)')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('ssyt_participants')
      .select('id, full_name')
      .in('status', ['active', 'accepted'])
      .order('full_name'),
  ])

  // Filtrez boats care nu sunt alocate echipei active
  const availableBoats = (boatsRes.data || []).filter(
    (b: any) => !(b.teams || []).some((t: any) => t.status === 'active')
  )

  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/ssyt/admin/teams"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
      >
        <ArrowLeft size={14} />
        Toate echipele
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        Echipă nouă
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Sezon: <span className="font-medium" style={{ color: '#0a1628' }}>{season?.name || '—'}</span>
      </p>

      {!season ? (
        <div className="rounded-lg p-8 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          Niciun sezon activ. Creează unul mai întâi din Setări.
        </div>
      ) : (
        <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <TeamNewForm
            seasonId={season.id}
            availableBoats={availableBoats}
            allBoats={boatsRes.data || []}
            participants={participantsRes.data || []}
          />
        </div>
      )}
    </div>
  )
}
