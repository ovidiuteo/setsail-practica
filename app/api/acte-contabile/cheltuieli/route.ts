import { NextRequest, NextResponse } from 'next/server'
import {
  canAccess, isEntity, listCheltuieli, insertCheltuiala, updateCheltuiala, deleteCheltuiala,
} from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// GET ?entity=&luna=&token=  → listă cheltuieli
export async function GET(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const luna = req.nextUrl.searchParams.get('luna')
  const token = req.nextUrl.searchParams.get('token')
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!luna) return NextResponse.json({ ok: false, error: 'missing luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  const items = await listCheltuieli(entity, luna)
  return NextResponse.json({ ok: true, items })
}

// POST → adaugă o cheltuială manuală
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, luna, data, descriere, suma } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!luna) return NextResponse.json({ ok: false, error: 'missing luna' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  const desc = String(descriere || '').slice(0, 300).trim()
  if (!desc) return NextResponse.json({ ok: false, error: 'Descriere obligatorie.' }, { status: 400 })
  const sumaNum = Number(suma)
  const dataVal = typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : null
  const row = await insertCheltuiala({
    entity, luna, data: dataVal, descriere: desc, suma: isNaN(sumaNum) ? 0 : sumaNum, sursa: 'manual',
  })
  return NextResponse.json({ ok: !!row, item: row })
}

// PATCH → bifează acoperit / editează
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })
  const { entity, token, id, acoperit, data, descriere, suma } = body
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  const patch: { acoperit?: boolean; data?: string | null; descriere?: string; suma?: number } = {}
  if (typeof acoperit === 'boolean') patch.acoperit = acoperit
  if (descriere !== undefined) patch.descriere = String(descriere).slice(0, 300)
  if (suma !== undefined) patch.suma = Number(suma) || 0
  if (data !== undefined) patch.data = (typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data)) ? data : null
  const res = await updateCheltuiala(entity, id, patch)
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}

// DELETE ?entity=&id=&token=
export async function DELETE(req: NextRequest) {
  const entity = req.nextUrl.searchParams.get('entity')
  const id = req.nextUrl.searchParams.get('id')
  const token = req.nextUrl.searchParams.get('token')
  if (!isEntity(entity)) return NextResponse.json({ ok: false, error: 'invalid entity' }, { status: 400 })
  if (!id) return NextResponse.json({ ok: false, error: 'missing id' }, { status: 400 })
  if (!(await canAccess(entity, token))) return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  const res = await deleteCheltuiala(entity, id)
  return NextResponse.json(res, { status: res.ok ? 200 : 400 })
}
