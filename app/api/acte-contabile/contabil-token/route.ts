import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, isLuna, getOrCreateContabilToken, regenerateContabilToken, LUNA_TOATE } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Proprietar (admin sau token entitate): obține link-ul read-only pentru contabil, pe o lună
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, luna, regenerate } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  // „toate" = superlink-ul cu toate lunile entității
  if (!isLuna(luna) && luna !== LUNA_TOATE) {
    return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  }
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const contabilToken = regenerate
    ? await regenerateContabilToken(entity, luna)
    : await getOrCreateContabilToken(entity, luna)
  return NextResponse.json({ ok: true, token: contabilToken })
}
