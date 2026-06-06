import { NextRequest, NextResponse } from 'next/server'
import { verifyDashboardToken, listLinks, resolveLinkUrl } from '@/lib/dashboards/server'

export const dynamic = 'force-dynamic'

// Public: verifica token-ul si returneaza dashboard-ul + linkurile (cu {token} rezolvat)
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug') || ''
  const token = req.nextUrl.searchParams.get('token')
  const dash = await verifyDashboardToken(slug, token)
  if (!dash) return NextResponse.json({ valid: false }, { status: 200 })

  const links = await listLinks(dash.id)
  return NextResponse.json({
    valid: true,
    dashboard: { name: dash.name, slug: dash.slug, description: dash.description },
    links: links.map(l => ({
      id: l.id,
      title: l.title,
      description: l.description,
      url: resolveLinkUrl(l.url, dash.token),
      icon: l.icon,
    })),
  })
}
