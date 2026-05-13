import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ParticipantNewForm from './ParticipantNewForm'

export const revalidate = 0

export default async function NewParticipantPage() {
  // Echipe disponibile pentru asignare directa la creare
  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, color_primary')
    .eq('status', 'active')
    .order('display_order')

  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/ssyt/admin/participants"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
      >
        <ArrowLeft size={14} />
        Toți participanții
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        Participant nou
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Adaugă manual un participant în baza de date. Pentru aplicări spontane, folosește formularul public din <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/ssyt/apply</code>.
      </p>

      <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <ParticipantNewForm teams={teams || []} />
      </div>
    </div>
  )
}
