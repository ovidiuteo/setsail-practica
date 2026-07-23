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
  const { data, error } = await svc().from('variabile').select('*').order('denumire')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variabile: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  // Import în masă (dintr-un catalog) când vine b.bulk = [{cod,denumire,formula}]
  if (Array.isArray(b.bulk)) {
    const { data: existing } = await svc().from('variabile').select('formula')
    const have = new Set((existing || []).map((r: any) => r.formula))
    const rows = b.bulk
      .map((r: any) => ({ cod: clean(r.cod), denumire: clean(r.denumire), formula: clean(r.formula) }))
      .filter((r: any) => {
        if (!r.formula || have.has(r.formula)) return false
        have.add(r.formula) // evită dubluri și în interiorul batch-ului
        return true
      })
    if (!rows.length) return NextResponse.json({ inserted: 0, variabile: [] })
    const { data, error } = await svc().from('variabile').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ inserted: data?.length || 0, variabile: data || [] })
  }
  const { data, error } = await svc().from('variabile').insert({
    cod: clean(b.cod), denumire: clean(b.denumire), formula: clean(b.formula),
  }).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ variabila: data })
}

const EDITABLE = new Set(['cod', 'denumire', 'formula'])
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const upd: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(b)) if (EDITABLE.has(k)) upd[k] = clean(v)
  const { error } = await svc().from('variabile').update(upd).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('variabile').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
