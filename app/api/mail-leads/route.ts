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
  const { data, error } = await svc().from('mail_leads').select('*').order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ leads: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const { data, error } = await svc().from('mail_leads').insert({
    nume: clean(b.nume), prenume: clean(b.prenume), email: clean(b.email), telefon: clean(b.telefon),
    rezumat: clean(b.rezumat), observatii: clean(b.observatii), sursa: clean(b.sursa) || 'import mail',
    extra: b.extra && typeof b.extra === 'object' ? b.extra : {},
    raw_email: clean(b.raw_email) || null,
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ lead: data })
}

const EDITABLE = new Set(['nume', 'prenume', 'email', 'telefon', 'rezumat', 'observatii', 'status', 'interes_id', 'interes_nume'])
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const upd: Record<string, any> = {}
  for (const [k, v] of Object.entries(b)) if (EDITABLE.has(k)) upd[k] = k === 'interes_id' ? (v || null) : (typeof v === 'string' ? v.trim() : v)
  if (!Object.keys(upd).length) return NextResponse.json({ error: 'nimic de actualizat' }, { status: 400 })
  const { error } = await svc().from('mail_leads').update(upd).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('mail_leads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
