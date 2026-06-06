import { NextRequest, NextResponse } from 'next/server'
import { getVisitStats, isEditor } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

// Editor: visit stats for the Leads tab.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isEditor(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const stats = await getVisitStats()
  return NextResponse.json(stats)
}
