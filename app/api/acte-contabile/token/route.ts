import { NextRequest, NextResponse } from 'next/server'
import { getEntityToken, regenerateEntityToken, isAdminRequest, isEntity } from '@/lib/acte-contabile/server'

export const dynamic = 'force-dynamic'

// Admin-only: citeste token-ul entitatii (?entity=ssa|ssy)
export async function GET(req: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const entity = req.nextUrl.searchParams.get('entity')
  if (!isEntity(entity)) return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
  const token = await getEntityToken(entity)
  return NextResponse.json({ token })
}

// Admin-only: regenereaza token-ul (invalideaza link-urile vechi)
export async function POST(req: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const entity = req.nextUrl.searchParams.get('entity')
  if (!isEntity(entity)) return NextResponse.json({ error: 'invalid entity' }, { status: 400 })
  const token = await regenerateEntityToken(entity)
  return NextResponse.json({ token })
}
