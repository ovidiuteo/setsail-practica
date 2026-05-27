import { NextRequest, NextResponse } from 'next/server'

const COOKIE_NAME = 'admin-session'

// Light verification (no Node crypto in Edge runtime). Full HMAC check happens
// on each protected route too if needed. Here we just gate on presence + age.
async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return false
  const age = Date.now() - parseInt(ts, 10)
  if (isNaN(age) || age < 0 || age > 30 * 24 * 3600 * 1000) return false

  const secret = process.env.ADMIN_AUTH_SECRET
  if (!secret) return false

  // Web Crypto HMAC for Edge runtime
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const macBuf = await crypto.subtle.sign('HMAC', key, enc.encode(ts))
  const expected = Array.from(new Uint8Array(macBuf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  }
  return diff === 0
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Permite explicit ruta de login + API-ul de auth
  if (
    pathname === '/admin/login' ||
    pathname.startsWith('/api/admin-auth/')
  ) {
    return NextResponse.next()
  }

  const token = req.cookies.get(COOKIE_NAME)?.value
  const ok = await isValidSession(token)
  if (ok) return NextResponse.next()

  // /admin/* fără auth → redirect la login
  if (pathname.startsWith('/admin')) {
    const url = req.nextUrl.clone()
    url.pathname = '/admin/login'
    url.searchParams.set('from', pathname)
    return NextResponse.redirect(url)
  }

  // /api/gmail-templates* fără auth → 401 JSON
  if (pathname.startsWith('/api/gmail-templates')) {
    return new NextResponse(
      JSON.stringify({ error: 'unauthorized' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*', '/api/gmail-templates/:path*', '/api/gmail-templates'],
}
