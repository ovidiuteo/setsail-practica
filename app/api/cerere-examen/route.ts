import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { cererePdf } from '@/lib/cerere-radio-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cererea de examen radio, descărcată de cursant din portal.
// La prima descărcare se alocă un număr din registrul independent de cereri;
// la redescărcare se reia același număr (nu consumăm numere degeaba).

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

const START_KEY = 'cerere_radio_start_number'
const roDate = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

async function nextNumber(sb: any): Promise<number> {
  const [{ data: maxRow }, { data: setting }] = await Promise.all([
    sb.from('cerere_numbers').select('numar').order('numar', { ascending: false }).limit(1).maybeSingle(),
    sb.from('setsail_info').select('value').eq('key', START_KEY).maybeSingle(),
  ])
  const start = parseInt(String(setting?.value ?? '').trim(), 10)
  return Math.max((maxRow?.numar ?? 0) + 1, Number.isFinite(start) ? start : 1)
}

export async function POST(req: NextRequest) {
  const sb = svc()
  const { student_id, access_code } = await req.json().catch(() => ({}))
  if (!student_id || !access_code)
    return NextResponse.json({ error: 'date lipsă' }, { status: 400 })

  // Aceeași poartă ca la portal: cursantul trebuie să fie într-o sesiune cu acest cod
  const { data: st } = await sb.from('students')
    .select('*, sessions!session_id(access_code, session_date, course_start_date, class_caa)')
    .eq('id', student_id).maybeSingle()
  const sess: any = (st as any)?.sessions
  if (!st || !sess || String(sess.access_code) !== String(access_code))
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const isPrelungire = /prelungire/i.test(String((st as any).class_caa || ''))

  // Termenul de depunere e cu 7 zile înainte de începerea cursului. Cine descarcă
  // mai târziu primește tot numărul următor, dar cererea rămâne datată la termen.
  const cerereDay = (() => {
    const today = new Date(); today.setHours(12, 0, 0, 0)
    const start = sess.course_start_date || sess.session_date
    if (!start) return today
    const limit = new Date(start); limit.setHours(12, 0, 0, 0)
    limit.setDate(limit.getDate() - 7)
    return today > limit ? limit : today
  })()
  const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  // Alocă (sau reia) numărul de cerere
  let numar: number | null = null
  let dataCerere: string | null = null
  const { data: existing } = await sb.from('cerere_numbers').select('*').eq('student_id', student_id).maybeSingle()
  if (existing) {
    numar = existing.numar
    dataCerere = existing.data_cerere
    // dacă între timp cursantul a schimbat obținere ↔ prelungire, registrul urmează alegerea
    const tip = isPrelungire ? 'prelungire' : 'obtinere'
    if (existing.tip !== tip) await sb.from('cerere_numbers').update({ tip }).eq('numar', existing.numar)
  } else {
    for (let i = 0; i < 5 && numar === null; i++) {
      const candidate = await nextNumber(sb)
      const { data, error } = await sb.from('cerere_numbers').insert({
        numar: candidate,
        student_id,
        session_id: (st as any).session_id,
        student_nume: (st as any).full_name,
        tip: isPrelungire ? 'prelungire' : 'obtinere',
        data_cerere: isoDay(cerereDay),
      }).select().single()
      if (!error && data) { numar = data.numar; dataCerere = data.data_cerere }
      else if (error && !/duplicate|unique/i.test(error.message)) break
    }
  }

  const cerereDate = dataCerere ? roDate(new Date(dataCerere)) : roDate(cerereDay)
  const sessionDate = sess.session_date ? roDate(new Date(sess.session_date)) : ''

  try {
    const pdf = await cererePdf(st, {
      isPrelungire, sessionDate, cerereDate,
      cerereNr: numar ?? undefined,
    })
    const nume = String((st as any).full_name || 'cursant').replace(/[\\/:*?"<>|]+/g, ' ').trim()
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Cerere examen radio - ${nume}.pdf"`,
        'X-Cerere-Nr': String(numar ?? ''),
        'X-Cerere-Data': cerereDate,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Eroare la generarea cererii' }, { status: 500 })
  }
}
