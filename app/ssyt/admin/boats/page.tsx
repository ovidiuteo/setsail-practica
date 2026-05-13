import Link from 'next/link'
import { Sailboat, Plus } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import BoatsManager from './BoatsManager'

export const revalidate = 0

export default async function AdminBoatsPage() {
  const { data: boats } = await supabase
    .from('ssyt_boats')
    .select(`
      *,
      teams:ssyt_teams(id, name, short_name, color_primary, status)
    `)
    .order('name')

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Flotă</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Ambarcațiuni
        </h1>
        <p className="text-sm text-gray-500 mt-1">{boats?.length ?? 0} bărci în baza de date</p>
      </div>

      <BoatsManager initialBoats={boats || []} />
    </div>
  )
}