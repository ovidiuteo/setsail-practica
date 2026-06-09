import { NextRequest, NextResponse } from 'next/server'
import { getAllLeads, isDashboardEditor, updateLeadRow, deleteLeadRow } from '@/lib/leads-dashboard/server'

export const dynamic = 'force-dynamic'

// Token-gated: returns CDS leads + Radio leads + newsletter subscribers.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isDashboardEditor(token))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await getAllLeads())
}

// Update a lead's status/notes (cds | radio).
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!(await isDashboardEditor(body?.token))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const res = await updateLeadRow(body?.kind, body?.id, { status: body?.status, notes: body?.notes })
  if (!res.ok) return NextResponse.json(res, { status: 400 })
  return NextResponse.json({ ok: true })
}

// Delete a row (cds | radio | newsletter).
export async function DELETE(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  if (!(await isDashboardEditor(sp.get('token')))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const res = await deleteLeadRow(sp.get('kind') || '', sp.get('id') || '')
  if (!res.ok) return NextResponse.json(res, { status: 400 })
  return NextResponse.json({ ok: true })
}
