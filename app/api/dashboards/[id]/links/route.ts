import { NextRequest, NextResponse } from 'next/server'
import { isAdminRequest, listLinks, addLink, reorderLinks } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Admin: linkurile unui dashboard
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const links = await listLinks(params.id)
  return NextResponse.json({ links })
}

// Admin: adauga link
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const title = (body?.title || '').toString().trim()
  const url = (body?.url || '').toString().trim()
  if (!title || !url) return NextResponse.json({ error: 'title and url required' }, { status: 400 })
  const link = await addLink(params.id, {
    title, url,
    description: body?.description ?? null,
    icon: body?.icon ?? null,
  })
  if (!link) return NextResponse.json({ error: 'add failed' }, { status: 500 })
  return NextResponse.json({ link })
}

// Admin: reordoneaza (orderedIds = lista de id-uri in noua ordine)
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => null)
  const ids = Array.isArray(body?.orderedIds) ? body.orderedIds.map(String) : null
  if (!ids) return NextResponse.json({ error: 'orderedIds required' }, { status: 400 })
  const ok = await reorderLinks(params.id, ids)
  return NextResponse.json({ ok })
}
