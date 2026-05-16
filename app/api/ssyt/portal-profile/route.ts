import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

// WHITELIST de campuri editabile din portal
// Toate celelalte (email, full_name, cnp, date_of_birth) sunt IGNORATE
const ALLOWED_FIELDS = ['phone', 'photo_url', 'dietary_restrictions', 'emergency_contact', 't_shirt_size']

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  // Validez sesiunea
  const { data: result } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(result) ? result[0] : result
  if (!row || !row.valid) return NextResponse.json({ error: 'Sesiune invalidă' }, { status: 401 })

  const body = await req.json()

  // Filtrez doar campurile permise
  const updates: any = {}
  for (const key of ALLOWED_FIELDS) {
    if (key in body) {
      updates[key] = body[key] || null
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Niciun câmp valid de actualizat.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('ssyt_participants')
    .update(updates)
    .eq('id', row.participant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
