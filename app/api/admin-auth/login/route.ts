import { NextRequest, NextResponse } from 'next/server'
import { checkPassword, makeToken, ADMIN_COOKIE_NAME, ADMIN_COOKIE_MAX_AGE } from '@/lib/admin-auth'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (!password || !checkPassword(password)) {
    // mic delay anti-brute-force
    await new Promise((r) => setTimeout(r, 500))
    return NextResponse.json({ error: 'invalid' }, { status: 401 })
  }

  const token = makeToken()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_COOKIE_MAX_AGE,
  })
  return res
}
