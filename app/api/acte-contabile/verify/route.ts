import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, ENTITIES } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Gate pentru pagina publica: token (sau sesiune admin) valid pentru entitate?
export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const token = req.nextUrl.searchParams.get('token')
  if (!isEntity(entity)) return NextResponse.json({ valid: false }, { status: 400 })
  const valid = await canAccess(entity, token)
  return NextResponse.json({ valid, entity, meta: ENTITIES[entity] })
}
