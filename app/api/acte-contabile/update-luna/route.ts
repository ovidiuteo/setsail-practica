import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, isLuna, updateDocMonth } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Realocă un document la altă lună (marcat ca modificat manual)
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })

  const { entity, token, id, luna } = body as { entity?: string; token?: string; id?: string; luna?: string }
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (!isLuna(luna)) return NextResponse.json({ ok: false, error: 'invalid luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const res = await updateDocMonth(entity, id, luna)
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
