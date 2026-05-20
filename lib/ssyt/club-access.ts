// ============================================================================
// SSYT2026 - Sport Clubs beta gating
// ============================================================================
// Modulul "Club sportiv" este vizibil pe portalul participantului doar daca:
//   - season.sport_clubs_enabled = true  -> vizibil pentru toti
//   - sau participantId este in season.sport_clubs_beta_participant_ids
// ============================================================================

import { getPortalSupabase } from './portal-session'

export type SportClubsAccess = {
  enabledForAll: boolean
  betaIds: string[]
  hasAccess: boolean
}

export async function getSportClubsAccess(
  participantId: string,
  seasonId: string
): Promise<SportClubsAccess> {
  const supabase = getPortalSupabase()
  const { data, error } = await supabase
    .from('ssyt_seasons')
    .select('sport_clubs_enabled, sport_clubs_beta_participant_ids')
    .eq('id', seasonId)
    .maybeSingle()

  if (error || !data) {
    return { enabledForAll: false, betaIds: [], hasAccess: false }
  }

  const enabledForAll = Boolean(data.sport_clubs_enabled)
  const betaIds = (data.sport_clubs_beta_participant_ids ?? []) as string[]
  const hasAccess = enabledForAll || betaIds.includes(participantId)

  return { enabledForAll, betaIds, hasAccess }
}
