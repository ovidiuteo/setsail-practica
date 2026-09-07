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

// Starea intervalelor: câte locuri sunt luate în fiecare, unde e programat
// cursantul și ce cereri de urgență îl privesc.
async function slotState(sb: any, sessionId: string, sess: any, studentId: string) {
  const cfg = configFromSession(sess)
  const slots = buildSlots(cfg)
  const capacity = slotCapacity(cfg)

  const [{ data: rows }, { data: reqs }] = await Promise.all([
    sb.from('practice_bookings').select('student_id, slot_from, slot_to').eq('session_id', sessionId),
    sb.from('practice_swap_requests')
      .select('id, requester_id, slot_date, slot_from, slot_to, status, accepted_by, students!requester_id(full_name)')
      .eq('session_id', sessionId).order('created_at', { ascending: false }),
  ])

  const taken = new Map<string, number>()
  let mine: { from: string; to: string } | null = null
  for (const b of rows || []) {
    taken.set(b.slot_from, (taken.get(b.slot_from) || 0) + 1)
    if (b.student_id === studentId) mine = { from: b.slot_from, to: b.slot_to }
  }

  // Cererea mea (dacă am trimis una) și cererile la care trebuie să răspund:
  // sunt colegul care ocupă un loc în intervalul cerut și n-am răspuns încă.
  const all = (reqs || []) as any[]
  const myRequest = all.find(r => r.requester_id === studentId && r.status !== 'cancelled') || null
  const openForMe = all.filter(r =>
    r.status === 'pending' && r.requester_id !== studentId && mine && r.slot_from === mine.from)

  let incoming: any = null
  if (openForMe.length) {
    const { data: answered } = await sb.from('practice_swap_responses')
      .select('request_id').eq('student_id', studentId)
      .in('request_id', openForMe.map(r => r.id))
    const done = new Set((answered || []).map((a: any) => a.request_id))
    const r = openForMe.find(x => !done.has(x.id))
    if (r) incoming = {
      id: r.id, from: r.slot_from, to: r.slot_to, date: r.slot_date,
      requester: r.students?.full_name || 'Un coleg',
    }
  }

  return {
    config: cfg,
    capacity,
    date: cfg.date,
    slots: slots.map(s => ({ ...s, taken: taken.get(s.from) || 0, full: (taken.get(s.from) || 0) >= capacity })),
    mine,
    myRequest: myRequest && {
      id: myRequest.id, from: myRequest.slot_from, to: myRequest.slot_to,
      status: myRequest.status, date: myRequest.slot_date,
    },
    incoming,
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
  const body = await req.json().catch(() => ({}))
  const { student_id, access_code, slot_from, action } = body
  const ok = await gate(sb, student_id, access_code)
  if (!ok) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const sessionId = ok.student.session_id

  // ── Cerere de urgență pentru un interval plin ──
  if (action === 'swap_request') {
    const cfg = configFromSession(ok.session)
    const slot = buildSlots(cfg).find(s => s.from === slot_from)
    if (!slot || !cfg.date) return NextResponse.json({ error: 'Interval invalid.' }, { status: 400 })

    const { data: inSlot } = await sb.from('practice_bookings')
      .select('student_id').eq('session_id', sessionId).eq('slot_from', slot.from)
    if ((inSlot || []).some((b: any) => b.student_id === student_id))
      return NextResponse.json({ error: 'Sunteți deja în acest interval.' }, { status: 400 })
    if ((inSlot || []).length < slotCapacity(cfg))
      return NextResponse.json({ error: 'Intervalul are locuri libere — alegeți-l direct.' }, { status: 400 })

    // O singură cerere deschisă per cursant
    await sb.from('practice_swap_requests').update({ status: 'cancelled', resolved_at: new Date().toISOString() })
      .eq('session_id', sessionId).eq('requester_id', student_id).eq('status', 'pending')
    const { error } = await sb.from('practice_swap_requests').insert({
      session_id: sessionId, requester_id: student_id,
      slot_date: cfg.date, slot_from: slot.from, slot_to: slot.to,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(await slotState(sb, sessionId, ok.session, student_id))
  }

  // ── Răspunsul colegului la o cerere de urgență ──
  if (action === 'swap_answer') {
    const { request_id, answer, new_slot_from } = body
    const { data: r } = await sb.from('practice_swap_requests')
      .select('*').eq('id', request_id).eq('session_id', sessionId).maybeSingle()
    if (!r || r.status !== 'pending')
      return NextResponse.json({ error: 'Cererea nu mai este activă.' }, { status: 409 })

    // „Nu, am programul fix" — se înregistrează refuzul, ceilalți rămân în așteptare
    if (answer === 'no') {
      await sb.from('practice_swap_responses')
        .upsert({ request_id, student_id, answer: 'no' }, { onConflict: 'request_id,student_id' })
      return NextResponse.json(await slotState(sb, sessionId, ok.session, student_id))
    }

    // „Da, pot alege alt interval" — colegul se mută, solicitantul îi ia locul
    const cfg = configFromSession(ok.session)
    const target = buildSlots(cfg).find(s => s.from === new_slot_from)
    if (!target) return NextResponse.json({ error: 'Alegeți intervalul în care vă mutați.' }, { status: 400 })
    if (target.from === r.slot_from)
      return NextResponse.json({ error: 'Alegeți un interval diferit de cel cedat.' }, { status: 400 })

    const { data: inTarget } = await sb.from('practice_bookings')
      .select('student_id').eq('session_id', sessionId).eq('slot_from', target.from)
    if ((inTarget || []).filter((b: any) => b.student_id !== student_id).length >= slotCapacity(cfg))
      return NextResponse.json({ error: 'Intervalul ales tocmai s-a ocupat. Alegeți altul.' }, { status: 409 })

    // colegul se mută, apoi solicitantul intră pe locul eliberat
    const up1 = await sb.from('practice_bookings').upsert({
      session_id: sessionId, student_id, slot_date: cfg.date, slot_from: target.from, slot_to: target.to,
    }, { onConflict: 'session_id,student_id' })
    if (up1.error) return NextResponse.json({ error: up1.error.message }, { status: 500 })

    const up2 = await sb.from('practice_bookings').upsert({
      session_id: sessionId, student_id: r.requester_id,
      slot_date: r.slot_date, slot_from: r.slot_from, slot_to: r.slot_to,
    }, { onConflict: 'session_id,student_id' })
    if (up2.error) return NextResponse.json({ error: up2.error.message }, { status: 500 })

    await Promise.all([
      sb.from('practice_swap_responses')
        .upsert({ request_id, student_id, answer: 'yes' }, { onConflict: 'request_id,student_id' }),
      sb.from('practice_swap_requests')
        .update({ status: 'accepted', accepted_by: student_id, resolved_at: new Date().toISOString() })
        .eq('id', request_id),
    ])
    return NextResponse.json(await slotState(sb, sessionId, ok.session, student_id))
  }

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
