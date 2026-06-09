import { NextRequest, NextResponse } from 'next/server'
import { getAllLeads, isDashboardEditor } from '@/lib/leads-dashboard/server'

export const dynamic = 'force-dynamic'

// Token-gated: returns CDS leads + Radio leads + newsletter subscribers.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isDashboardEditor(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await getAllLeads())
}
