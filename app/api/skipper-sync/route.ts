import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { fetchSkipperTableTsv, skipperGroupId } from '@/lib/skipper'
import { parseStudentsText } from '@/lib/import-parse'
import { CARRY_FIELDS, findPersonRows, ceaMaiRecenta, samePerson } from '@/lib/student-merge'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// POST { session_id } — citește grupa de pe skipper (linkul salvat pe sesiune,
// cu /full-table adăugat) și adaugă în sesiune cursanții care nu sunt deja acolo.
// Compararea se face pe email; pentru cei fără email pe skipper cădem pe CNP/nume,
// ca să nu-i adăugăm din nou la fiecare sincronizare.
export async function POST(req: NextRequest) {
  if (!verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { session_id } = await req.json().catch(() => ({}))
  if (!session_id) return NextResponse.json({ error: 'lipsește sesiunea' }, { status: 400 })

  const sb = svc()
  const { data: sess } = await sb.from('sessions')
    .select('id, skipper_url, class_caa').eq('id', session_id).maybeSingle()
  if (!sess) return NextResponse.json({ error: 'sesiune inexistentă' }, { status: 404 })
  if (!String(sess.skipper_url || '').trim())
    return NextResponse.json({ error: 'Sesiunea nu are „Link skipper" completat.' }, { status: 400 })

  let tsv: string
  try {
    tsv = await fetchSkipperTableTsv(sess.skipper_url as string)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Nu am putut citi grupa de pe skipper.' }, { status: 502 })
  }

  // Aceeași cale ca la importul de cursanți — tabelul are exact coloanele știute
  const deSkipper = parseStudentsText(tsv, (sess.class_caa as string) || 'C,D')
  if (!deSkipper.length)
    return NextResponse.json({ error: 'Nu am găsit niciun cursant în tabelul de pe skipper.' }, { status: 422 })

  const { data: existenti } = await sb.from('students')
    .select('id, full_name, email, cnp, order_in_session').eq('session_id', session_id)
  const inSesiune = existenti || []
  let order = inSesiune.reduce((m: number, s: any) => Math.max(m, s.order_in_session || 0), 0)

  const adaugati: string[] = []
  const existau: string[] = []
  const preluati: string[] = []   // aveau deja fișă în sistem, din altă serie

  for (const s of deSkipper) {
    if (inSesiune.some((e: any) => samePerson(e, s))) { existau.push(s.full_name); continue }

    const base: any = {
      session_id,
      full_name: s.full_name,
      cnp: s.cnp, birth_date: s.birth_date,
      address: s.address, city: s.city, county: s.county,
      email: s.email, phone: s.phone,
      ci_series: s.ci_series, ci_number: s.ci_number,
      class_caa: s.class_caa,
      order_in_session: ++order,
      only_sailing: false,
      portal_status: 'pending',
    }
    // Dacă persoana e deja în sistem (altă serie), îi preluăm datele și documentele
    const prev = ceaMaiRecenta(await findPersonRows(sb, s))
    if (prev) {
      for (const f of CARRY_FIELDS) {
        if (!String(base[f] ?? '').trim() && String(prev[f] ?? '').trim()) base[f] = prev[f]
      }
      preluati.push(s.full_name)
    }
    const { error } = await sb.from('students').insert(base)
    if (error) return NextResponse.json({ error: `${s.full_name}: ${error.message}` }, { status: 500 })
    adaugati.push(s.full_name)
  }

  return NextResponse.json({
    ok: true,
    grupa: skipperGroupId(sess.skipper_url as string),
    total_skipper: deSkipper.length,
    adaugati, existau, preluati,
  })
}
