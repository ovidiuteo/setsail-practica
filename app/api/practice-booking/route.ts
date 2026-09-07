import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { configFromSession, buildSlots, slotCapacity } from '@/lib/practice-slots'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Programarea cursantului la un interval de practică.
// Aceeași poartă ca la portal: cursantul trebuie să fie într-o sesiune cu acest cod.

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
}

const SESSION_COLS = 'access_code, session_date, practice_booking_enabled, practice_start_date, practice_slot_minutes, ' +
  'practice_start_hour, practice_end_hour, practice_boats, practice_per_boat, practice_per_slot'

async function gate(sb: any, studentId: string, accessCode: string) {
  const { data: st } = await sb.from('students')
    .select(`id, session_id, full_name, sessions!session_id(${SESSION_COLS})`)
    .eq('id', studentId).maybeSingle()
  const sess: any = st?.sessions
  if (!st || !sess || String(sess.access_code) !== String(accessCode)) return null
  return { student: st, session: sess }
}

// Starea intervalelor: câte locuri sunt luate în fiecare și unde e programat cursantul
async function slotState(sb: any, sessionId: string, sess: any, studentId: string) {
  const cfg = configFromSession(sess)
  const slots = buildSlots(cfg)
  const capacity = slotCapacity(cfg)

  const { data: rows } = await sb.from('practice_bookings')
    .select('student_id, slot_from, slot_to, students!student_id(full_name)')
    .eq('session_id', sessionId)

  const taken = new Map<string, number>()
  let mine: { from: string; to: string } | null = null
  for (const b of rows || []) {
    taken.set(b.slot_from, (taken.get(b.slot_from) || 0) + 1)
    if (b.student_id === studentId) mine = { from: b.slot_from, to: b.slot_to }
  }

  return {
    config: cfg,
    capacity,
    date: cfg.date,
    slots: slots.map(s => ({ ...s, taken: taken.get(s.from) || 0, full: (taken.get(s.from) || 0) >= capacity })),
    mine,
  }
}

export async function GET(req: NextRequest) {
  const sb = svc()
  const sp = req.nextUrl.searchParams
  const studentId = sp.get('student_id') || ''
  const accessCode = sp.get('access_code') || ''
  const ok = await gate(sb, studentId, accessCode)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  return NextResponse.json(await slotState(sb, ok.student.session_id, ok.session, studentId))
}

export async function POST(req: NextRequest) {
  const sb = svc()
  const { student_id, access_code, slot_from } = await req.json().catch(() => ({}))
  const ok = await gate(sb, student_id, access_code)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const cfg = configFromSession(ok.session)
  if (!cfg.enabled) return NextResponse.json({ error: 'Programarea nu este deschisă.' }, { status: 400 })
  if (!cfg.date) return NextResponse.json({ error: 'Ziua de practică nu e stabilită încă.' }, { status: 400 })

  const slot = buildSlots(cfg).find(s => s.from === slot_from)
  if (!slot) return NextResponse.json({ error: 'Interval invalid.' }, { status: 400 })

  // Verificăm capacitatea chiar înainte de scriere (două persoane pot apăsa simultan)
  const { data: existing } = await sb.from('practice_bookings')
    .select('student_id').eq('session_id', ok.student.session_id).eq('slot_from', slot.from)
  const others = (existing || []).filter((b: any) => b.student_id !== student_id)
  if (others.length >= slotCapacity(cfg))
    return NextResponse.json({ error: 'Intervalul tocmai s-a ocupat. Alegeți altul.' }, { status: 409 })

  // Un cursant are un singur interval — schimbarea îl mută, nu adaugă
  const { error } = await sb.from('practice_bookings').upsert({
    session_id: ok.student.session_id, student_id,
    slot_date: cfg.date, slot_from: slot.from, slot_to: slot.to,
  }, { onConflict: 'session_id,student_id' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(await slotState(sb, ok.student.session_id, ok.session, student_id))
}

export async function DELETE(req: NextRequest) {
  const sb = svc()
  const { student_id, access_code } = await req.json().catch(() => ({}))
  const ok = await gate(sb, student_id, access_code)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const { error } = await sb.from('practice_bookings')
    .delete().eq('session_id', ok.student.session_id).eq('student_id', student_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(await slotState(sb, ok.student.session_id, ok.session, student_id))
}
