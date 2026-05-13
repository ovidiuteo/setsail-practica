// ============================================================================
// SSYT2026 - Supabase client + helpers
// ============================================================================
// Refoloseste clientul global din lib/supabase.ts dar adauga helpere
// tipizate pentru entitatile SSYT.
// ============================================================================

import { supabase } from '../supabase'
import type {
  Season,
  Team,
  Regatta,
  Participant,
  Application,
  SeasonLeaderboardRow,
} from './types'

export { supabase }

// ---------------------------------------------------------------------------
// SEZON CURENT - helper rapid
// ---------------------------------------------------------------------------

export async function getActiveSeason(): Promise<Season | null> {
  const { data, error } = await supabase
    .from('ssyt_seasons')
    .select('*')
    .in('status', ['planning', 'active'])
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error('[ssyt] getActiveSeason error:', error)
    return null
  }
  return data as Season | null
}

// ---------------------------------------------------------------------------
// ECHIPE
// ---------------------------------------------------------------------------

export async function getTeamsBySeason(seasonId: string): Promise<Team[]> {
  const { data, error } = await supabase
    .from('ssyt_teams')
    .select(`
      *,
      boat:ssyt_boats(*),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, first_name, last_name, full_name, nickname, photo_url)
    `)
    .eq('season_id', seasonId)
    .eq('status', 'active')
    .order('display_order')

  if (error) {
    console.error('[ssyt] getTeamsBySeason error:', error)
    return []
  }
  return (data ?? []) as Team[]
}

export async function getTeamBySlug(seasonId: string, slug: string): Promise<Team | null> {
  const { data, error } = await supabase
    .from('ssyt_teams')
    .select(`
      *,
      boat:ssyt_boats(*),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(id, first_name, last_name, full_name, nickname, photo_url),
      memberships:ssyt_team_memberships(
        *,
        participant:ssyt_participants(id, first_name, last_name, full_name, nickname, photo_url, field_visibility)
      )
    `)
    .eq('season_id', seasonId)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[ssyt] getTeamBySlug error:', error)
    return null
  }
  return data as Team | null
}

// ---------------------------------------------------------------------------
// REGATTE
// ---------------------------------------------------------------------------

export async function getRegattasBySeason(seasonId: string): Promise<Regatta[]> {
  const { data, error } = await supabase
    .from('ssyt_regattas')
    .select('*, races:ssyt_races(*)')
    .eq('season_id', seasonId)
    .neq('status', 'draft')
    .order('start_date')

  if (error) {
    console.error('[ssyt] getRegattasBySeason error:', error)
    return []
  }
  return (data ?? []) as Regatta[]
}

export async function getRegattaBySlug(seasonId: string, slug: string): Promise<Regatta | null> {
  const { data, error } = await supabase
    .from('ssyt_regattas')
    .select('*, races:ssyt_races(*)')
    .eq('season_id', seasonId)
    .eq('slug', slug)
    .maybeSingle()

  if (error) {
    console.error('[ssyt] getRegattaBySlug error:', error)
    return null
  }
  return data as Regatta | null
}

// ---------------------------------------------------------------------------
// LEADERBOARD
// ---------------------------------------------------------------------------

export async function getSeasonLeaderboard(seasonId: string): Promise<SeasonLeaderboardRow[]> {
  const { data, error } = await supabase
    .from('ssyt_season_leaderboard')
    .select('*')
    .eq('season_id', seasonId)

  if (error) {
    console.error('[ssyt] getSeasonLeaderboard error:', error)
    return []
  }
  return (data ?? []) as SeasonLeaderboardRow[]
}

// ---------------------------------------------------------------------------
// APLICARI
// ---------------------------------------------------------------------------

export async function submitApplication(payload: Partial<Application>): Promise<{ ok: boolean; id?: string; error?: string }> {
  const { data, error } = await supabase
    .from('ssyt_applications')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    console.error('[ssyt] submitApplication error:', error)
    return { ok: false, error: error.message }
  }
  return { ok: true, id: data.id }
}

// ---------------------------------------------------------------------------
// VIZIBILITATE CAMP - filtreaza datele unui participant in functie de
// nivelul accesului (public, members, admin)
// ---------------------------------------------------------------------------

export type ViewerLevel = 'public' | 'members' | 'admin'

export function filterParticipantByVisibility(
  participant: Participant,
  viewer: ViewerLevel
): Partial<Participant> {
  const levels: Record<ViewerLevel, number> = { public: 0, members: 1, admin: 2 }
  const viewerLevel = levels[viewer]

  const out: Partial<Participant> = { id: participant.id }
  const vis = participant.field_visibility ?? {}

  const allow = (field: keyof Participant) => {
    const requiredVis = vis[field as string] ?? 'admin'
    const requiredLevel = levels[requiredVis as ViewerLevel] ?? 2
    return viewerLevel >= requiredLevel
  }

  if (allow('full_name')) {
    out.full_name = participant.full_name
    out.first_name = participant.first_name
    out.last_name = participant.last_name
  }
  if (allow('nickname')) out.nickname = participant.nickname
  if (allow('photo_url')) out.photo_url = participant.photo_url
  if (allow('email')) out.email = participant.email
  if (allow('phone')) out.phone = participant.phone
  if (allow('date_of_birth')) out.date_of_birth = participant.date_of_birth
  if (allow('cnp')) out.cnp = participant.cnp
  if (allow('sailing_experience')) out.sailing_experience = participant.sailing_experience

  return out
}
