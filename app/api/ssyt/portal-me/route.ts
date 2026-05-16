import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return NextResponse.json({ loggedIn: false })

  const supabase = createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: result, error } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  if (error) return NextResponse.json({ loggedIn: false })

  const row = Array.isArray(result) ? result[0] : result
  if (!row || !row.valid) return NextResponse.json({ loggedIn: false })

  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select('id, first_name, full_name')
    .eq('id', row.participant_id)
    .maybeSingle()

  if (!participant) return NextResponse.json({ loggedIn: false })

  return NextResponse.json({
    loggedIn: true,
    firstName: participant.first_name,
    fullName: participant.full_name,
  })
}
