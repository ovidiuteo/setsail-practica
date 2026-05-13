import Link from 'next/link'
import { Check } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import ApplyForm from './ApplyForm'

export const revalidate = 60

export default async function ApplyPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="py-20 text-center text-gray-500">Niciun sezon activ pentru aplicare.</div>
  }

  // Echipe disponibile pentru preferinta
  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, color_primary')
    .eq('season_id', season.id)
    .eq('status', 'active')
    .order('display_order')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="mb-10">
        <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight mb-3" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Aplică în program
        </h1>
        <p className="text-gray-600 text-lg leading-relaxed">
          Completează formularul de mai jos. După aplicare, te contactăm pentru o scurtă discuție și apoi îți comunicăm alocarea într-una din cele 4 echipe.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-10">
        <StepBadge num="1" label="Aplici" active />
        <StepBadge num="2" label="Discuție" />
        <StepBadge num="3" label="Alocare echipă" />
      </div>

      <div className="rounded-lg p-6 md:p-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <ApplyForm seasonId={season.id} teams={teams || []} />
      </div>

      <div className="mt-8 rounded-lg p-5 text-sm text-gray-600 leading-relaxed" style={{ background: '#f8f9fa', border: '1px solid #e5e7eb' }}>
        <strong style={{ color: '#0a1628' }}>Privacy:</strong> Datele tale sunt folosite exclusiv pentru gestionarea aplicării și a participării în programul SSYT.
        Nu le distribuim terților. Poți cere oricând ștergerea lor scriindu-ne la SetSail.
      </div>
    </div>
  )
}

function StepBadge({ num, label, active }: { num: string; label: string; active?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0"
        style={{
          background: active ? '#FF6B35' : '#f3f4f6',
          color: active ? '#fff' : '#9CA3AF',
        }}
      >
        {num}
      </div>
      <div>
        <div className="text-xs font-medium" style={{ color: active ? '#0a1628' : '#9CA3AF' }}>{label}</div>
      </div>
    </div>
  )
}