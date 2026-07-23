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
  const { data, error } = await svc().from('interese').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ interese: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const { data, error } = await svc().from('interese').insert({
    nume: clean(b.nume),
    tip_program: clean(b.tip_program) || 'curs',
    source_type: clean(b.source_type) || null,
    source_id: b.source_id || null,
    fields: Array.isArray(b.fields) ? b.fields : [],
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ interes: data })
}

const EDITABLE = new Set(['nume', 'tip_program', 'fields'])
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const upd: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(b)) {
    if (!EDITABLE.has(k)) continue
    upd[k] = k === 'fields' ? (Array.isArray(v) ? v : []) : (typeof v === 'string' ? v.trim() : v)
  }
  const { error } = await svc().from('interese').update(upd).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('interese').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
