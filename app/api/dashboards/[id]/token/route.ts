import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, regenerateDashboardToken } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: regenereaza token-ul (invalideaza linkul vechi al paginii)
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const token = await regenerateDashboardToken(params.id)
  if (!token) return NextResponse.json({ error: 'regenerate failed' }, { status: 500 })
  return NextResponse.json({ token })
}
