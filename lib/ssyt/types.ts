// ============================================================================
// SSYT2026 - TypeScript Types
// ============================================================================
// Tipuri pentru toate tabelele si enums din schema SSYT.
// Generate manual pentru rapiditate; cand schema se stabilizeaza, putem rula
// `supabase gen types typescript` pentru a regenera automat.
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export type SeasonStatus = 'planning' | 'active' | 'completed' | 'archived'
export type TeamStatus = 'active' | 'inactive' | 'archived'
export type ParticipantStatus = 'applied' | 'accepted' | 'waitlist' | 'active' | 'inactive' | 'rejected'
export type MembershipType = 'core' | 'occasional'
export type MembershipStatus = 'active' | 'inactive' | 'left'
export type EventType = 'regatta' | 'training' | 'briefing' | 'social'
export type RegattaStatus = 'draft' | 'upcoming' | 'live' | 'completed' | 'cancelled'
export type RaceStatus = 'scheduled' | 'completed' | 'abandoned' | 'postponed'
export type ConfirmationStatus = 'pending' | 'confirmed' | 'declined' | 'tentative'
export type AvailabilityStatus = 'available' | 'unavailable' | 'maybe'
export type BadgeCategory = 'achievement' | 'role_mastery' | 'performance' | 'special'
export type MediaType = 'photo' | 'video' | 'reel' | 'document'
export type Visibility = 'public' | 'members' | 'admin'
export type DocumentStatus = 'pending' | 'uploaded' | 'approved' | 'rejected'

export type FieldVisibility = {
  full_name?: Visibility
  nickname?: Visibility
  photo_url?: Visibility
  email?: Visibility
  phone?: Visibility
  date_of_birth?: Visibility
  cnp?: Visibility
  sailing_experience?: Visibility
  [key: string]: Visibility | undefined
}

// ---------------------------------------------------------------------------
// INTERFACES
// ---------------------------------------------------------------------------

export type Season = {
  id: string
  name: string
  short_name: string | null
  year: number
  description: string | null
  start_date: string | null
  end_date: string | null
  status: SeasonStatus
  scoring_config: Record<string, unknown>
  created_at: string
  updated_at: string
}

export type Boat = {
  id: string
  name: string
  model: string | null
  sail_number: string | null
  hull_color: string | null
  capacity: number
  photo_url: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export type Participant = {
  id: string
  student_id: string | null
  first_name: string
  last_name: string
  full_name: string
  nickname: string | null
  email: string
  phone: string | null
  date_of_birth: string | null
  cnp: string | null
  sailing_experience: string | null
  regatta_experience: string | null
  motivation: string | null
  photo_url: string | null
  auth_user_id: string | null
  status: ParticipantStatus
  applied_at: string
  accepted_at: string | null
  field_visibility: FieldVisibility
  consent_public_profile: boolean
  consent_gdpr: boolean
  consent_gdpr_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type Team = {
  id: string
  season_id: string
  name: string
  short_name: string | null
  slug: string | null
  logo_url: string | null
  flag_url: string | null
  color_primary: string | null
  color_secondary: string | null
  slogan: string | null
  description: string | null
  boat_id: string | null
  skipper_id: string | null
  status: TeamStatus
  display_order: number
  created_at: string
  updated_at: string
  // Relations (optional, populated by joins)
  boat?: Boat | null
  skipper?: Participant | null
  memberships?: TeamMembership[]
}

export type TeamMembership = {
  id: string
  team_id: string
  participant_id: string
  membership_type: MembershipType
  status: MembershipStatus
  start_date: string
  end_date: string | null
  preferred_role_ids: string[] | null
  notes: string | null
  created_at: string
  updated_at: string
  participant?: Participant
  team?: Team
}

export type Role = {
  id: string
  code: string
  name_ro: string
  name_en: string | null
  description: string | null
  icon: string | null
  position_on_boat: string | null
  display_order: number
  is_active: boolean
}

export type Badge = {
  id: string
  code: string
  name: string
  description: string | null
  icon_url: string | null
  color: string | null
  category: BadgeCategory
  points_value: number
  is_active: boolean
  created_at: string
}

export type Regatta = {
  id: string
  season_id: string
  name: string
  short_name: string | null
  slug: string | null
  description: string | null
  event_type: EventType
  location: string | null
  marina: string | null
  start_date: string
  end_date: string | null
  start_time: string | null
  briefing_time: string | null
  briefing_location: string | null
  vhf_channel: string | null
  emergency_contact: string | null
  race_committee: string | null
  expected_races: number
  notice_of_race_url: string | null
  sailing_instructions_url: string | null
  official_results_url: string | null
  external_event_url: string | null
  points_multiplier: number
  status: RegattaStatus
  visibility: Visibility
  cover_photo_url: string | null
  display_order: number
  created_at: string
  updated_at: string
  races?: Race[]
}

export type Race = {
  id: string
  regatta_id: string
  race_number: number
  name: string | null
  race_type: string | null
  start_time: string | null
  course_description: string | null
  wind_speed_knots: number | null
  wind_direction: string | null
  status: RaceStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export type Availability = {
  id: string
  participant_id: string
  regatta_id: string
  status: AvailabilityStatus
  notes: string | null
  declared_by: string | null
  declared_at: string
  updated_at: string
}

export type RegattaParticipation = {
  id: string
  regatta_id: string
  team_id: string
  participant_id: string
  role_id: string | null
  secondary_role_id: string | null
  attendance_type: MembershipType
  is_substitute: boolean
  replaces_participant_id: string | null
  confirmation_status: ConfirmationStatus
  confirmed_at: string | null
  declined_reason: string | null
  added_by: string | null
  approved_by: string | null
  approved_at: string | null
  notes: string | null
  display_order: number
  created_at: string
  updated_at: string
  participant?: Participant
  team?: Team
  role?: Role
}

export type Result = {
  id: string
  regatta_id: string
  team_id: string
  official_place: number | null
  official_class: string | null
  official_total_boats: number | null
  official_points: number | null
  ssyt_internal_place: number | null
  ssyt_internal_points: number | null
  is_dnf: boolean
  is_dns: boolean
  is_dsq: boolean
  is_dnc: boolean
  notes: string | null
  proof_url: string | null
  recap: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  team?: Team
  regatta?: Regatta
}

export type Application = {
  id: string
  season_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  date_of_birth: string | null
  sailing_experience: string | null
  regatta_experience: string | null
  preferred_roles: string[] | null
  availability_notes: string | null
  motivation: string | null
  preferred_team_id: string | null
  source: string | null
  student_id: string | null
  status: string
  reviewed_by: string | null
  reviewed_at: string | null
  decision_notes: string | null
  created_participant_id: string | null
  consent_gdpr: boolean
  consent_gdpr_at: string | null
  submitted_at: string
  updated_at: string
}

// ---------------------------------------------------------------------------
// VIEW types
// ---------------------------------------------------------------------------

export type SeasonLeaderboardRow = {
  season_id: string
  season_name: string
  team_id: string
  team_name: string
  color_primary: string | null
  logo_url: string | null
  regattas_completed: number
  total_official_points: number
  total_ssyt_points: number
  wins_internal: number
  podiums_internal: number
}
