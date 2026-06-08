import { NextRequest, NextResponse } from 'next/server'
import { listLeads, insertLead, updateLead, deleteLead, isEditor } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body?.website) return NextResponse.json({ ok: true })
  const name = (body?.name || '').trim()
  const email = (body?.email || '').trim()
  const phone = (body?.phone || '').trim()
  if (!name && !email && !phone) {
    return NextResponse.json({ ok: false, error: 'Completează cel puțin numele și un contact.' }, { status: 400 })
  }
  const res = await insertLead({ name, email, phone, message: body?.message, leadType: body?.leadType })
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isEditor(token))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ leads: await listLeads() })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!(await isEditor(body?.token))) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (!body?.id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 })
  const res = await updateLead(body.id, { status: body.status, notes: body.notes })
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const id = req.nextUrl.searchParams.get('id')
  if (!(await isEditor(token))) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  if (!id) return NextResponse.json({ ok: false, error: 'id lipsă' }, { status: 400 })
  const res = await deleteLead(id)
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
