import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: request.headers } })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl
  const pathname = url.pathname

  // Rute care necesita autentificare
  if (pathname.startsWith('/ssyt/portal') && !user) {
    return NextResponse.redirect(new URL('/ssyt/login?next=' + encodeURIComponent(pathname), request.url))
  }

  // Rute admin
  if (pathname.startsWith('/ssyt/admin')) {
    if (!user) {
      return NextResponse.redirect(new URL('/ssyt/login?next=' + encodeURIComponent(pathname), request.url))
    }
    // Verific daca e admin
    const { data: adminRow } = await supabase
      .from('ssyt_admin_users')
      .select('level')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!adminRow) {
      // Nu e admin → portal
      return NextResponse.redirect(new URL('/ssyt/portal', request.url))
    }
  }

  // Daca user e logat si vine pe /ssyt/login sau /ssyt/signup → redirect spre portal sau admin
  if (user && (pathname === '/ssyt/login' || pathname === '/ssyt/signup')) {
    const { data: adminRow } = await supabase
      .from('ssyt_admin_users')
      .select('level')
      .eq('user_id', user.id)
      .maybeSingle()
    const redirectTo = adminRow ? '/ssyt/admin' : '/ssyt/portal'
    return NextResponse.redirect(new URL(redirectTo, request.url))
  }

  return response
}

export const config = {
  matcher: [
    '/ssyt/portal/:path*',
    '/ssyt/admin/:path*',
    '/ssyt/login',
    '/ssyt/signup',
  ],
}