import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAdminRequest } from '@/lib/dashboards/server'

const sb = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false }, global: { fetch: (i: any, o?: any) => fetch(i, { ...o, cache: 'no-store' }) } }
)

export async function GET(req: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const an = parseInt(req.nextUrl.searchParams.get('an') || String(new Date().getFullYear()))
  const { data } = await sb().from('casa_belvedere_utilitati').select('*').eq('an', an).order('luna')
  return NextResponse.json({ data: data ?? [] })
}

export async function PATCH(req: NextRequest) {
  if (!isAdminRequest()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await req.json()
  const { an, luna, field, value } = body
  if (!an || !luna || !field) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: existing } = await sb()
    .from('casa_belvedere_utilitati').select('id').eq('an', an).eq('luna', luna).maybeSingle()

  if (existing) {
    await sb().from('casa_belvedere_utilitati')
      .update({ [field]: value === '' ? null : value, updated_at: new Date().toISOString() })
      .eq('an', an).eq('luna', luna)
  } else {
    await sb().from('casa_belvedere_utilitati')
      .insert({ an, luna, [field]: value === '' ? null : value })
  }
  return NextResponse.json({ ok: true })
}
