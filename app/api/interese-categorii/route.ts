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
const GEN = new Set(['curs', 'expeditie', 'practica_suplimentara'])
const gen = (v: any) => (GEN.has(v) ? v : 'curs')

export async function GET() {
  const { data, error } = await svc().from('interese_categorii').select('*').order('nume')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categorii: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!clean(b.nume)) return NextResponse.json({ error: 'Nume gol' }, { status: 400 })
  const { data, error } = await svc().from('interese_categorii').insert({ nume: clean(b.nume), gen_baza: gen(b.gen_baza) }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categorie: data })
}

export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const upd: Record<string, any> = {}
  if (b.nume !== undefined) upd.nume = clean(b.nume)
  if (b.gen_baza !== undefined) upd.gen_baza = gen(b.gen_baza)
  const { error } = await svc().from('interese_categorii').update(upd).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  // dezasociază interesele care foloseau categoria
  await svc().from('interese').update({ categorie_id: null }).eq('categorie_id', id)
  const { error } = await svc().from('interese_categorii').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
