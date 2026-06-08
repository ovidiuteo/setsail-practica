import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardToken, addLink, resolveLinkUrl } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Public (token-gated): persoana isi adauga singura un link pe dashboard-ul ei.
// Acces = token valid pentru slug-ul cerut (acelasi care da acces la pagina).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const slug = (body?.slug || '').toString()
  const token = body?.token ?? null
  const dash = await verifyDashboardToken(slug, token)
  if (!dash) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const title = (body?.title || '').toString().trim()
  const url = (body?.url || '').toString().trim()
  if (!title || !url) return NextResponse.json({ error: 'title and url required' }, { status: 400 })

  const link = await addLink(dash.id, {
    title, url,
    description: (body?.description ?? '').toString().trim() || null,
    icon: (body?.icon ?? '').toString().trim() || null,
  })
  if (!link) return NextResponse.json({ error: 'add failed' }, { status: 500 })

  return NextResponse.json({
    link: {
      id: link.id,
      title: link.title,
      description: link.description,
      url: resolveLinkUrl(link.url, dash.token),
      icon: link.icon,
    },
  })
}
