import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const SESSION_COOKIE = 'ssyt_portal_session'
const SESSION_DAYS = 30

export async function POST(req: NextRequest) {
  try {
    const { email, keyword } = await req.json()
    if (!email || !keyword) {
      return NextResponse.json({ success: false, error: 'Email și cod sesiune sunt obligatorii.' }, { status: 400 })
    }

    const supabase = createClient(URL, SERVICE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Verific email + keyword
    const { data: result, error: loginErr } = await supabase.rpc('ssyt_portal_login', {
      p_email: email,
      p_keyword: keyword,
    })
    if (loginErr) return NextResponse.json({ success: false, error: loginErr.message }, { status: 500 })

    const row = Array.isArray(result) ? result[0] : result
    if (!row || !row.success) {
      let msg = 'Email sau cod sesiune incorect.'
      if (row?.reason === 'invalid_keyword') msg = 'Cod de sesiune invalid.'
      if (row?.reason === 'email_not_found_or_blocked') msg = 'Email-ul nu este înregistrat sau accesul a fost blocat.'
      return NextResponse.json({ success: false, error: msg }, { status: 401 })
    }

    // Generez token securizat (32 bytes base64url)
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

    // Salvez sesiunea în DB
    const { error: insertErr } = await supabase.from('ssyt_portal_sessions').insert({
      participant_id: row.participant_id,
      season_id: row.season_id,
      token,
      expires_at: expiresAt.toISOString(),
      ip_address: req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip'),
      user_agent: req.headers.get('user-agent'),
    })
    if (insertErr) return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 })

    // Set cookie HttpOnly
    const response = NextResponse.json({ success: true, name: row.full_name })
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_DAYS * 24 * 60 * 60,
    })
    return response
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || 'Eroare server.' }, { status: 500 })
  }
}
