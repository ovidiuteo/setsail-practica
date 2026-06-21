import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function page(title: string, msg: string, code: number) {
  return new NextResponse(
    `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title><style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;
background:#04080d;color:#cfe2ee;font-family:system-ui,sans-serif;text-align:center;padding:24px}
div{max-width:420px}h1{font-size:20px;margin:0 0 8px}p{color:#7d97a8;font-size:14px;line-height:1.5}</style></head>
<body><div><h1>${title}</h1><p>${msg}</p></div></body></html>`,
    { status: code, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  )
}

export async function GET(req: NextRequest, { params }: { params: { slug: string } }) {
  const slug = params.slug
  const token = req.nextUrl.searchParams.get('token') || ''
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  const { data: sim } = await sb.from('simulators')
    .select('html, token, activ').eq('slug', slug).maybeSingle()

  if (!sim || !sim.activ) return page('Simulator indisponibil', 'Pagina nu există sau a fost dezactivată.', 404)
  if (!token || token !== sim.token) return page('Acces restricționat', 'Link invalid sau token lipsă. Verifică link-ul primit.', 403)

  return new NextResponse(sim.html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' },
  })
}
