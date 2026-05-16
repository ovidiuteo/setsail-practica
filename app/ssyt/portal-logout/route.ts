import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (token) {
    const supabase = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    await supabase.from('ssyt_portal_sessions').delete().eq('token', token)
  }

  const response = NextResponse.json({ success: true })
  response.cookies.delete(SESSION_COOKIE)
  return response
}
