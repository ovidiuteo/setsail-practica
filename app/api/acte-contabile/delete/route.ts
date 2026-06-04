import { NextRequest, NextResponse } from 'next/server'
import { canAccess, isEntity, deleteDoc } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Sterge un document (token sau admin). ?entity=ssa|ssy&id=<uuid>
export async function DELETE(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const token = req.nextUrl.searchParams.get('token')
  const id = req.nextUrl.searchParams.get('id')
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (!(await canAccess(entity, token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const res = await deleteDoc(entity, id)
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
