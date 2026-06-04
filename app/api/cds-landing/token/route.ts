import { NextResponse } from 'next/server'
import { getAdminToken, regenerateAdminToken, isAdminRequest } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

// Admin-only (reuses /admin HMAC session): read the editor token
export async function GET() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const token = await getAdminToken()
  return NextResponse.json({ token })
}

// Admin-only: regenerate (invalidates old editor links)
export async function POST() {
  if (!isAdminRequest()) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const token = await regenerateAdminToken()
  return NextResponse.json({ token })
}
