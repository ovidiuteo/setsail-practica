import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, listDashboards, createDashboard } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: lista tuturor dashboard-urilor
export async function GET() {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const dashboards = await listDashboards()
  return NextResponse.json({ dashboards })
}

// Admin: creeaza un dashboard nou
export async function POST(req: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const name = (body?.name || '').toString().trim()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })
  const dashboard = await createDashboard(name, body?.description ?? null)
  if (!dashboard) return NextResponse.json({ error: 'create failed' }, { status: 500 })
  return NextResponse.json({ dashboard })
}
