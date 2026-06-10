import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, isLuna, getOrCreateContabilToken } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Proprietar (admin sau token entitate): obține link-ul read-only pentru contabil, pe o lună
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, luna } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!isLuna(luna)) return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const contabilToken = await getOrCreateContabilToken(entity, luna)
  return NextResponse.json({ ok: true, token: contabilToken })
}
