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

// Helper pentru afisare debug pe pagina
export async function getPortalSessionWithDebug(): Promise<{ session: PortalSession | null; debug: any }> {
  const debug: any = {}

  const cookieStore = cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  debug.cookie_present = !!token
  debug.cookie_value_preview = token ? token.substring(0, 15) + '...' : null
  debug.env_url_set = !!URL
  debug.env_service_set = !!SERVICE
  debug.env_url_preview = URL ? URL.substring(0, 30) + '...' : 'MISSING'
  debug.env_service_preview = SERVICE ? SERVICE.substring(0, 15) + '...' : 'MISSING'

  if (!token) {
    debug.error = 'no_cookie'
    return { session: null, debug }
  }

  if (!URL || !SERVICE) {
    debug.error = 'env_vars_missing'
    return { session: null, debug }
  }

  try {
    const supabase = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: result, error } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })

    debug.rpc_error = error?.message || null
    debug.rpc_raw_result = result
    debug.rpc_result_type = Array.isArray(result) ? 'array' : typeof result

    if (error) {
      debug.error = 'rpc_failed'
      return { session: null, debug }
    }

    const row = Array.isArray(result) ? result[0] : result
    debug.parsed_row = row

    if (!row || !row.valid) {
      debug.error = 'invalid_session'
      return { session: null, debug }
    }

    const { data: participant, error: pErr } = await supabase
      .from('ssyt_participants')
      .select('id, full_name, first_name, last_name, email, phone, photo_url, t_shirt_size, emergency_contact, dietary_restrictions, notes, date_of_birth, cnp')
      .eq('id', row.participant_id)
      .maybeSingle()

    debug.participant_fetch_error = pErr?.message || null
    debug.participant_found = !!participant

    if (!participant) {
      debug.error = 'participant_not_found'
      return { session: null, debug }
    }

    return {
      session: {
        participantId: row.participant_id,
        seasonId: row.season_id,
        participant,
      },
      debug,
    }
  } catch (e: any) {
    debug.error = 'exception'
    debug.exception_message = e.message
    debug.exception_stack = e.stack
    return { session: null, debug }
  }
}

// Versiune normala (pentru pagini fara debug)
export async function getPortalSession(): Promise<PortalSession | null> {
  const { session } = await getPortalSessionWithDebug()
  return session
}

export function getPortalSupabase() {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
