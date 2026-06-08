import { NextRequest, NextResponse } from 'next/server'
import { getVisitStats, isEditor } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isEditor(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json(await getVisitStats())
}
