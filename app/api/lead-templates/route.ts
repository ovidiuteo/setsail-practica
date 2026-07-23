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
const SOURCES = new Set(['sesiune', 'gmail', 'generat', 'manual'])

export async function GET() {
  const { data, error } = await svc().from('lead_templates').select('*').eq('activ', true).order('categorie').order('label')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data || [] })
}

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const row = {
    label: clean(b.label) || '(fără titlu)',
    categorie: clean(b.categorie) || 'general',
    subject: clean(b.subject),
    body_html: typeof b.body_html === 'string' ? b.body_html : null,
    body_text: typeof b.body_text === 'string' ? b.body_text : null,
    source: SOURCES.has(b.source) ? b.source : 'manual',
    source_id: clean(b.source_id) || null,
  }
  const { data, error } = await svc().from('lead_templates').insert(row).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data })
}

const EDITABLE = new Set(['label', 'categorie', 'subject', 'body_html', 'body_text', 'activ'])
export async function PATCH(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const upd: Record<string, any> = { updated_at: new Date().toISOString() }
  for (const [k, v] of Object.entries(b)) {
    if (!EDITABLE.has(k)) continue
    upd[k] = k === 'activ' ? !!v : (k === 'body_html' || k === 'body_text') ? (v == null ? null : String(v)) : clean(v)
  }
  const { error } = await svc().from('lead_templates').update(upd).eq('id', b.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await svc().from('lead_templates').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
