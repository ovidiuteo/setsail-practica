import { NextRequest, NextResponse } from 'next/server'
import { resolveContabilToken, listDocsForMonth, ENTITIES } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Pagina contabilului: rezolvă token-ul → entitate + lună + documentele lunii (read-only)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const resolved = await resolveContabilToken(token)
  if (!resolved) return NextResponse.json({ ok: false, error: 'Token invalid sau expirat.' }, { status: 401 })
  const { entity, luna } = resolved
  const docs = await listDocsForMonth(entity, luna)
  return NextResponse.json({ ok: true, entity, luna, meta: ENTITIES[entity], docs })
}
