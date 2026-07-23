import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
const clean = (v: any) => (typeof v === 'string' ? v.trim() : '')

export async function GET() {
  const { data, error } = await svc().from('lead_statuses').select('*').order('sort_order').order('nume')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ statuses: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!clean(b.nume)) return NextResponse.json({ error: 'Nume gol' }, { status: 400 })
  const { data, error } = await svc().from('lead_statuses').insert({ nume: clean(b.nume), sort_order: Number(b.sort_order) || 99 }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: data })
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('lead_statuses').update({ nume: clean(b.nume) }).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('lead_statuses').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
