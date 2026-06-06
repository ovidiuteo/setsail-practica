import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, updateLink, deleteLink } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: editeaza un link
export async function PATCH(req: NextRequest, { params }: { params: { linkId: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const fields: { title?: string; url?: string; description?: string | null; icon?: string | null } = {}
  if (typeof body?.title === 'string') fields.title = body.title.trim()
  if (typeof body?.url === 'string') fields.url = body.url.trim()
  if (body?.description !== undefined) fields.description = body.description
  if (body?.icon !== undefined) fields.icon = body.icon
  const link = await updateLink(params.linkId, fields)
  if (!link) return NextResponse.json({ error: 'update failed' }, { status: 500 })
  return NextResponse.json({ link })
}

// Admin: sterge un link
export async function DELETE(_req: NextRequest, { params }: { params: { linkId: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const ok = await deleteLink(params.linkId)
  return NextResponse.json({ ok })
}
