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

// Citeste sesiunea curenta din cookie + valideaza in DB
export async function getPortalSession(): Promise<PortalSession | null> {
  const token = cookies().get(SESSION_COOKIE)?.value
  if (!token) return null

  const supabase = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: result } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(result) ? result[0] : result
  if (!row || !row.valid) return null

  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select('id, full_name, first_name, last_name, email, phone, photo_url, t_shirt_size, emergency_contact, dietary_restrictions, notes, date_of_birth, cnp')
    .eq('id', row.participant_id)
    .maybeSingle()

  if (!participant) return null

  return {
    participantId: row.participant_id,
    seasonId: row.season_id,
    participant,
  }
}

// Client cu service role pentru DB access in pagini portal
export function getPortalSupabase() {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
