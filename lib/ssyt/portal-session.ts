import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

export type PortalSession = {
  participantId: string
  seasonId: string
  participant: any
}

export async function getPortalSession(): Promise<PortalSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null

  const supabase = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: result, error } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  if (error) return null
  const row = Array.isArray(result) ? result[0] : result
  if (!row || !row.valid) return null

  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select(
      'id, full_name, first_name, last_name, email, phone, photo_url, t_shirt_size, emergency_contact, dietary_restrictions, notes, date_of_birth, cnp, ' +
      'ci_seria, ci_numar, ci_emis_de, ci_emisa_la, ci_image_url, loc_nasterii, judet_nasterii, cetatenia, adresa_completa, signature_image_url'
    )
    .eq('id', row.participant_id)
    .maybeSingle()
  if (!participant) return null

  return { participantId: row.participant_id, seasonId: row.season_id, participant }
}

export function getPortalSupabase() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// Verifica daca participantul curent poate edita pt echipa sa
// Returns: { teamId, canEdit, isSkipper, membership }
export async function getMyTeamAndPerms(participantId: string): Promise<{
  teamId: string | null
  canEdit: boolean
  isSkipper: boolean
  isEditor: boolean
}> {
  const supabase = getPortalSupabase()
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('team_id, is_editor, team:ssyt_teams(id, skipper_id)')
    .eq('participant_id', participantId)
    .eq('status', 'active')
    .maybeSingle()

  if (!mem?.team_id) return { teamId: null, canEdit: false, isSkipper: false, isEditor: false }

  const isSkipper = (mem.team as any)?.skipper_id === participantId
  const isEditor = !!mem.is_editor
  return { teamId: mem.team_id, canEdit: isSkipper || isEditor, isSkipper, isEditor }
}

// Verifica daca participantul curent poate edita pe baza de team_id
export async function canEditTeam(participantId: string, teamId: string): Promise<boolean> {
  const supabase = getPortalSupabase()
  // Skipper?
  const { data: team } = await supabase.from('ssyt_teams').select('skipper_id').eq('id', teamId).maybeSingle()
  if (team?.skipper_id === participantId) return true
  // Editor flag pe membership?
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('is_editor')
    .eq('participant_id', participantId)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .maybeSingle()
  return !!mem?.is_editor
}

// Verifica daca poate edita boat type resources (oricine cu rol edit in vreo echipa)
export async function canEditBoatType(participantId: string): Promise<boolean> {
  const supabase = getPortalSupabase()
  // Skipper undeva?
  const { data: skippered } = await supabase.from('ssyt_teams').select('id').eq('skipper_id', participantId).limit(1)
  if (skippered && skippered.length > 0) return true
  // Editor undeva?
  const { data: editing } = await supabase
    .from('ssyt_team_memberships')
    .select('id')
    .eq('participant_id', participantId)
    .eq('status', 'active')
    .eq('is_editor', true)
    .limit(1)
  return !!(editing && editing.length > 0)
}
