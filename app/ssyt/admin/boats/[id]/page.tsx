import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sailboat } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import BoatDetailTabs from './BoatDetailTabs'

export const revalidate = 0

export default async function AdminBoatDetailPage({ params }: { params: { id: string } }) {
  const { data: boat } = await supabase
    .from('ssyt_boats')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!boat) notFound()

  // Paralel: toate datele necesare pentru taburi
  const [specsRes, equipmentRes, tasksRes, filesRes, resourcesRes, photosRes, teamsRes, participantsRes] = await Promise.all([
    supabase.from('ssyt_boat_specs').select('*').eq('boat_id', boat.id).maybeSingle(),
    supabase.from('ssyt_boat_equipment').select('*').eq('boat_id', boat.id).order('display_order'),
    supabase.from('ssyt_boat_tasks').select('*, assigned:assigned_to(id, full_name)').eq('boat_id', boat.id).order('display_order').order('due_date'),
    supabase.from('ssyt_boat_files').select('*').eq('boat_id', boat.id).order('display_order'),
    supabase.from('ssyt_boat_resources').select('*').eq('boat_id', boat.id).order('display_order'),
    supabase.from('ssyt_boat_photos').select('*').eq('boat_id', boat.id).order('display_order'),
    supabase.from('ssyt_teams').select(`
      id, name, short_name, color_primary, status, slogan,
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, full_name, email, photo_url),
      memberships:ssyt_team_memberships(
        id, membership_type, status,
        participant:ssyt_participants(id, full_name, email, photo_url)
      )
    `).eq('boat_id', boat.id),
    supabase.from('ssyt_participants').select('id, full_name').in('status', ['active', 'accepted']).order('full_name'),
  ])

  return (
    <div className="px-8 py-8 max-w-6xl">
      <Link
        href="/ssyt/admin/boats"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
      >
        <ArrowLeft size={14} />
        Toate ambarcațiunile
      </Link>

      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <div className="w-16 h-16 rounded-lg flex items-center justify-center" style={{ background: '#0a1628' }}>
          <Sailboat size={28} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            {boat.name}
          </h1>
          <p className="text-sm text-gray-500">
            {boat.model || 'Model necunoscut'}
            {boat.sail_number && <> · sail nr. <span className="font-mono">{boat.sail_number}</span></>}
          </p>
        </div>
      </div>

      <BoatDetailTabs
        boat={boat}
        specs={specsRes.data}
        equipment={equipmentRes.data || []}
        tasks={tasksRes.data || []}
        files={filesRes.data || []}
        resources={resourcesRes.data || []}
        photos={photosRes.data || []}
        teams={teamsRes.data || []}
        allParticipants={participantsRes.data || []}
      />
    </div>
  )
}
