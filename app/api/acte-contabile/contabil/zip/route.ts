import { NextRequest, NextResponse } from 'next/server'
import { resolveContabilToken } from '@/lib/acte-contabile/server'
import { buildMonthZip } from '@/lib/acte-contabile/zip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ZIP cu toate fișierele lunii, via token de contabil
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const resolved = await resolveContabilToken(token)
  if (!resolved) return NextResponse.json({ ok: false, error: 'Token invalid.' }, { status: 401 })
  const { entity, luna } = resolved

  const content = await buildMonthZip(entity, luna)
  if (!content) return NextResponse.json({ ok: false, error: 'Nicio înregistrare pentru această lună.' }, { status: 404 })

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="acte-${entity}-${luna}.zip"`,
      'Content-Length': String(content.byteLength),
    },
  })
}
