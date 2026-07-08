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

async function tokenOk(sb: ReturnType<typeof svc>, token: string) {
  if (!token) return false
  const { data } = await sb.from('voucher_cadou_config').select('token').eq('id', 1).maybeSingle()
  return !!data?.token && data.token === token
}

// GET ?token= — validează tokenul paginii publice
export async function GET(req: NextRequest) {
  const sb = svc()
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!(await tokenOk(sb, token))) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  return NextResponse.json({ ok: true })
}

const TIPURI = new Set(['cds', 'motor', 'valoric'])

// POST — emite un voucher (înregistrează în listă) { token, tip, nume, prenume, observatii, sesiune, locatie, orar, suma }
export async function POST(req: NextRequest) {
  const sb = svc()
  const b = await req.json().catch(() => ({}))
  if (!(await tokenOk(sb, b?.token || ''))) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const tip = TIPURI.has(b?.tip) ? b.tip : 'cds'
  const clean = (v: any) => (typeof v === 'string' ? v.trim() : '')
  const { data, error } = await sb.from('voucher_cadou').insert({
    tip,
    nume: clean(b.nume), prenume: clean(b.prenume), observatii: clean(b.observatii),
    sesiune: clean(b.sesiune), locatie: clean(b.locatie), orar: clean(b.orar), suma: clean(b.suma),
  }).select('id').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, id: data.id })
}
