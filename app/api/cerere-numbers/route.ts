import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Registru INDEPENDENT de numere pentru cererile de examen radio.
// Spre deosebire de `notification_numbers` (care sunt per sesiune), un număr de
// cerere se alocă per CURSANT, în momentul în care își descarcă cererea.

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const START_KEY = 'cerere_radio_start_number'

// Următorul număr liber: max(existent)+1, dar cel puțin numărul de pornire din setări
async function nextNumber(sb: ReturnType<typeof svc>): Promise<number> {
  const [{ data: maxRow }, { data: setting }] = await Promise.all([
    sb.from('cerere_numbers').select('numar').order('numar', { ascending: false }).limit(1).maybeSingle(),
    sb.from('setsail_info').select('value').eq('key', START_KEY).maybeSingle(),
  ])
  const start = parseInt(String((setting as any)?.value ?? '').trim(), 10)
  return Math.max(((maxRow as any)?.numar ?? 0) + 1, Number.isFinite(start) ? start : 1)
}

export async function GET() {
  const sb = svc()
  const [{ data, error }, { data: setting }] = await Promise.all([
    sb.from('cerere_numbers')
      .select('*, students(full_name), sessions(session_date, class_caa)')
      .order('numar', { ascending: false }),
    sb.from('setsail_info').select('value').eq('key', START_KEY).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    numbers: data || [],
    start_number: (setting as any)?.value ?? '',
    next: await nextNumber(sb),
  })
}

// POST — alocă (sau reia) numărul de cerere al unui cursant.
// Idempotent: dacă are deja un număr, îl întoarce pe acela, ca redescărcarea
// cererii să nu consume numere noi.
export async function POST(req: NextRequest) {
  const sb = svc()
  const b = await req.json().catch(() => ({}))
  const { student_id, session_id, tip } = b || {}
  if (!student_id) return NextResponse.json({ error: 'lipsește cursantul' }, { status: 400 })

  const { data: existing } = await sb.from('cerere_numbers')
    .select('*').eq('student_id', student_id).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, reused: true, numar: existing.numar, data_cerere: existing.data_cerere })

  const { data: st } = await sb.from('students').select('full_name, session_id').eq('id', student_id).maybeSingle()

  // Reîncercăm dacă între timp altcineva a luat același număr (index unic pe `numar`)
  for (let attempt = 0; attempt < 5; attempt++) {
    const numar = await nextNumber(sb)
    const { data, error } = await sb.from('cerere_numbers').insert({
      numar,
      student_id,
      session_id: session_id || (st as any)?.session_id || null,
      student_nume: (st as any)?.full_name || null,
      tip: tip === 'prelungire' ? 'prelungire' : 'obtinere',
    }).select().single()
    if (!error && data) return NextResponse.json({ ok: true, numar: data.numar, data_cerere: data.data_cerere })
    if (error && !/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Nu am putut aloca un număr liber.' }, { status: 500 })
}

// PATCH — setează numărul de pornire al registrului
export async function PATCH(req: NextRequest) {
  const sb = svc()
  const { start_number } = await req.json().catch(() => ({}))
  const v = String(start_number ?? '').trim()
  const { error } = await sb.from('setsail_info').upsert({ key: START_KEY, value: v }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const sb = svc()
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const { error } = await sb.from('cerere_numbers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
