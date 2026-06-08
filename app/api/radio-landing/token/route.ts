import { NextResponse } from 'next/server'
import { getAdminToken, regenerateAdminToken, isAdminRequest } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ token: await getAdminToken() })
}
export async function POST() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ token: await regenerateAdminToken() })
}
