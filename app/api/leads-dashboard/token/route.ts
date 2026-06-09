import { NextResponse } from 'next/server'
import { getDashboardToken, regenerateDashboardToken, isAdminRequest } from '@/lib/leads-dashboard/server'

export const dynamic = 'force-dynamic'

// Admin-only (reuses /admin HMAC session): read the dashboard token.
export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ token: await getDashboardToken() })
}

// Admin-only: regenerate (invalidates old dashboard links).
export async function POST() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ token: await regenerateDashboardToken() })
}
