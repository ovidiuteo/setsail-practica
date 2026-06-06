import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, importLinks } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: importa (copiaza) linkuri dintr-un alt dashboard in acesta
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const linkIds = Array.isArray(body?.linkIds) ? body.linkIds.map(String) : null
  if (!linkIds || linkIds.length === 0) return NextResponse.json({ error: 'linkIds required' }, { status: 400 })
  const links = await importLinks(params.id, linkIds)
  return NextResponse.json({ links })
}
