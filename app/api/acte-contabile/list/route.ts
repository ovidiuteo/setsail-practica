import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, listDocs } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Listeaza documentele entitatii cu URL-uri semnate (token sau admin)
export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const token = req.nextUrl.searchParams.get('token')
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const docs = await listDocs(entity)
  return NextResponse.json({ ok: true, docs })
}
