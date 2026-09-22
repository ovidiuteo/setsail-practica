import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scopeForSession } from '@/lib/timeline-scope'
import { dinISO, ziISO } from '@/lib/catalog-zile'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Confirmările unei serii („Administrativ" din lista cu token).
// Itemurile sunt șabloane pe tipul de curs, deci se păstrează de la o serie la alta;
// starea (pending / confirmat / probleme), ora apăsării și nota sunt pe serie.
//   GET  ?session_id=&token=
//   POST { session_id, token, action: 'adauga'|'editeaza'|'sterge'|'stare'|'note'|'import', … }

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

// Reperele față de care se pune termenul unui item
const REPERE = [
  { key: 'start_curs', label: 'începutul cursului' },
  { key: 'final_teorie', label: 'sfârșitul teoriei' },
  { key: 'start_practica', label: 'începutul practicii' },
  { key: 'data_practica', label: 'data probei practice' },
] as const

function dataReper(sess: any, key: string): string | null {
  const startPractica = sess.practice_start_date || sess.session_date || null
  if (key === 'start_curs') return sess.course_start_date || null
  if (key === 'start_practica') return startPractica
  if (key === 'data_practica') return sess.session_date || null
  if (key === 'final_teorie') {
    // ultima zi de teorie = ziua dinaintea începerii practicii
    const d = dinISO(startPractica || '')
    return d ? ziISO(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1)) : null
  }
  return null
}

// Termenul unui item: reperul ± zile
function termen(sess: any, item: { zile: number | null; reper: string | null }): string | null {
  if (item.zile === null || item.zile === undefined || !item.reper) return null
  const baza = dinISO(dataReper(sess, item.reper) || '')
  if (!baza) return null
  return ziISO(new Date(baza.getFullYear(), baza.getMonth(), baza.getDate() + Number(item.zile)))
}

async function seria(sb: ReturnType<typeof svc>, sessionId: string, token: string) {
  const { data: s } = await sb.from('sessions')
    .select('id, roster_token, parent_session_id, class_caa, timeline_scope, session_type, is_clone, course_start_date, practice_start_date, session_date')
    .eq('id', sessionId).maybeSingle()
  if (!s || !token || (s as any).roster_token !== token) return null
  const principalId = (s as any).parent_session_id || (s as any).id
  const { data: principal } = await sb.from('sessions')
    .select('id, class_caa, timeline_scope, session_type, is_clone, course_start_date, practice_start_date, session_date')
    .eq('id', principalId).maybeSingle()
  const sess = (principal || s) as any
  return { sess, scope: scopeForSession(sess) || 'general' }
}

const txt = (v: unknown, max = 500) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

export async function GET(req: NextRequest) {
  const sb = svc()
  const sessionId = req.nextUrl.searchParams.get('session_id') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  const ctx = await seria(sb, sessionId, token)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const [{ data: sabloane }, { data: stari }] = await Promise.all([
    sb.from('checklist_sabloane').select('*').eq('scope', ctx.scope).order('ordine').order('created_at'),
    sb.from('checklist_stare').select('*').eq('session_id', ctx.sess.id),
  ])
  const stareBy = new Map((stari || []).map((s: any) => [s.sablon_id, s]))

  return NextResponse.json({
    scope: ctx.scope,
    repere: REPERE.map(r => ({ ...r, data: dataReper(ctx.sess, r.key) })),
    itemuri: (sabloane || []).map((it: any) => ({
      id: it.id, descriere: it.descriere, ordine: it.ordine, zile: it.zile, reper: it.reper,
      termen: termen(ctx.sess, it),
      stare: stareBy.get(it.id)?.stare || 'pending',
      stare_la: stareBy.get(it.id)?.stare_la || null,
      note: stareBy.get(it.id)?.note || '',
    })),
  })
}

export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  const ctx = await seria(sb, String(body.session_id || ''), String(body.token || ''))
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const reperValid = (v: unknown) => REPERE.some(r => r.key === v) ? String(v) : null
  const zileValid = (v: unknown) => v === null || v === undefined || v === '' ? null : Math.max(-365, Math.min(365, Math.trunc(Number(v)) || 0))

  if (body.action === 'adauga') {
    const descriere = txt(body.descriere)
    if (!descriere) return NextResponse.json({ error: 'Scrie descrierea itemului.' }, { status: 400 })
    const { data: ultim } = await sb.from('checklist_sabloane').select('ordine')
      .eq('scope', ctx.scope).order('ordine', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await sb.from('checklist_sabloane').insert({
      scope: ctx.scope, descriere, ordine: ((ultim as any)?.ordine || 0) + 1,
      zile: zileValid(body.zile), reper: reperValid(body.reper),
    }).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, item: data })
  }

  if (body.action === 'editeaza') {
    const upd: Record<string, unknown> = {}
    if (body.descriere !== undefined) upd.descriere = txt(body.descriere)
    if (body.zile !== undefined) upd.zile = zileValid(body.zile)
    if (body.reper !== undefined) upd.reper = reperValid(body.reper)
    if (!Object.keys(upd).length) return NextResponse.json({ error: 'nimic de schimbat' }, { status: 400 })
    const { error } = await sb.from('checklist_sabloane').update(upd)
      .eq('id', String(body.id || '')).eq('scope', ctx.scope)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'sterge') {
    // itemul dispare de la toate seriile de acest tip, împreună cu stările lui
    const { error } = await sb.from('checklist_sabloane').delete()
      .eq('id', String(body.id || '')).eq('scope', ctx.scope)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'stare' || body.action === 'note') {
    const sablonId = String(body.id || '')
    const acum = new Date().toISOString()
    const camp: Record<string, unknown> = { session_id: ctx.sess.id, sablon_id: sablonId, updated_at: acum }
    if (body.action === 'stare') {
      const stare = ['pending', 'confirmat', 'probleme'].includes(body.stare) ? body.stare : 'pending'
      camp.stare = stare
      // ora apăsării; la revenirea în „pending" ștampila dispare
      camp.stare_la = stare === 'pending' ? null : acum
    } else {
      camp.note = txt(body.note, 1000)
    }
    const { data, error } = await sb.from('checklist_stare').upsert(camp, { onConflict: 'session_id,sablon_id' }).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, stare: data })
  }

  // Aduce itemurile de la alt tip de curs (fără dubluri după descriere)
  if (body.action === 'import') {
    const dinScope = txt(body.scope, 60)
    if (!dinScope || dinScope === ctx.scope) return NextResponse.json({ error: 'Alege alt tip de curs.' }, { status: 400 })
    const [{ data: sursa }, { data: aleMele }] = await Promise.all([
      sb.from('checklist_sabloane').select('descriere, zile, reper, ordine').eq('scope', dinScope).order('ordine'),
      sb.from('checklist_sabloane').select('descriere, ordine').eq('scope', ctx.scope),
    ])
    const existente = new Set((aleMele || []).map((x: any) => x.descriere.toLowerCase()))
    let ordine = (aleMele || []).reduce((m: number, x: any) => Math.max(m, x.ordine || 0), 0)
    const noi = (sursa || []).filter((x: any) => !existente.has(String(x.descriere).toLowerCase()))
      .map((x: any) => ({ scope: ctx.scope, descriere: x.descriere, zile: x.zile, reper: x.reper, ordine: ++ordine }))
    if (!noi.length) return NextResponse.json({ ok: true, adaugate: 0 })
    const { error } = await sb.from('checklist_sabloane').insert(noi)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, adaugate: noi.length })
  }

  // Tipurile de curs de la care se poate importa, cu numărul de itemuri
  if (body.action === 'surse') {
    const { data } = await sb.from('checklist_sabloane').select('scope')
    const nr = new Map<string, number>()
    for (const r of (data || []) as any[]) if (r.scope !== ctx.scope) nr.set(r.scope, (nr.get(r.scope) || 0) + 1)
    return NextResponse.json({ surse: Array.from(nr, ([scope, itemuri]) => ({ scope, itemuri })) })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 })
}
