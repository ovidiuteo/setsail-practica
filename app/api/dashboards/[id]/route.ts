import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, updateDashboard, deleteDashboard } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: redenumeste / editeaza descrierea
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const fields: { name?: string; description?: string | null } = {}
  if (typeof body?.name === 'string') fields.name = body.name.trim()
  if (body?.description !== undefined) fields.description = body.description
  const dashboard = await updateDashboard(params.id, fields)
  if (!dashboard) return NextResponse.json({ error: 'update failed' }, { status: 500 })
  return NextResponse.json({ dashboard })
}

// Admin: sterge dashboard-ul (cu linkurile lui, cascade)
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const ok = await deleteDashboard(params.id)
  return NextResponse.json({ ok })
}
