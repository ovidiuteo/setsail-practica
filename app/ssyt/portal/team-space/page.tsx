import { redirect } from 'next/navigation'
import { Users, AlertCircle } from 'lucide-react'
import { getPortalSession, getPortalSupabase, getMyTeamAndPerms } from '@/lib/ssyt/portal-session'
import TeamSpaceTabs from './TeamSpaceTabs'

export const dynamic = 'force-dynamic'

export default async function PortalTeamSpacePage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login?next=/ssyt/portal/team-space')

  const { teamId, canEdit, isSkipper, isEditor } = await getMyTeamAndPerms(session.participantId)
  const supabase = getPortalSupabase()

  if (!teamId) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="rounded-lg p-8 text-center" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <AlertCircle size={28} className="mx-auto mb-3 text-gray-400" />
          <p className="text-sm text-gray-500">Nu ești alocat la o echipă încă. Contactează organizatorul.</p>
        </div>
      </div>
    )
  }

  // Date echipa
  const { data: team } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, color_primary, slug, boat_id')
    .eq('id', teamId)
    .maybeSingle()

  // Resurse diverse (gestionate de admin pe barca echipei) — read-only pentru echipă
  let boatResourcesAdmin: any[] = []
  if (team?.boat_id) {
    const { data: br } = await supabase
      .from('ssyt_boat_resources')
      .select('id, title, description, url, category')
      .eq('boat_id', team.boat_id)
      .order('display_order')
      .order('created_at', { ascending: false })
    boatResourcesAdmin = (br || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      url: r.url,
      resource_type: r.category,
      text_content: null,
    }))
  }

  // Membri echipa cu nume
  const { data: memberships } = await supabase
    .from('ssyt_team_memberships')
    .select('participant_id, participants:ssyt_participants(id, full_name, first_name)')
    .eq('team_id', teamId)
    .eq('status', 'active')
  const teamMembers = (memberships || [])
    .map((m: any) => m.participants)
    .filter(Boolean)
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'ro'))

  // Note
  const { data: notes } = await supabase.from('ssyt_team_notes').select('content').eq('team_id', teamId).maybeSingle()

  // To-do team + boat
  const { data: todos } = await supabase
    .from('ssyt_team_todos')
    .select('id, scope, title, description, assignee_type, assignee_participant, is_done, done_at, done_by_participant, created_by_participant, created_at')
    .eq('team_id', teamId)
    .order('display_order')
    .order('created_at')

  // Resurse private barca echipa
  const { data: boatResources } = await supabase
    .from('ssyt_team_boat_resources')
    .select('id, title, description, url, resource_type, text_content')
    .eq('team_id', teamId)
    .order('display_order')
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Spațiu echipă</p>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-3" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <span className="w-10 h-10 rounded-md flex items-center justify-center text-white font-bold" style={{ background: team?.color_primary || '#4A5568' }}>
            {team?.short_name?.[0] || 'T'}
          </span>
          {team?.name}
        </h1>
        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
          <Users size={12} /> {teamMembers.length} membri ·
          <span>Rolul tău: {isSkipper ? '👑 Skipper' : isEditor ? '🛡️ Editor' : 'Crew'}</span>
          {!canEdit && <span className="text-xs italic">(doar citire)</span>}
        </p>
      </div>

      <TeamSpaceTabs
        teamId={teamId}
        canEdit={canEdit}
        currentParticipantId={session.participantId}
        teamMembers={teamMembers}
        initialNotes={notes?.content || ''}
        initialTodos={(todos || []) as any}
        initialResources={(boatResources || []) as any}
        boatResourcesAdmin={boatResourcesAdmin}
      />
    </div>
  )
}
