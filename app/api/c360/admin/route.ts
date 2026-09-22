import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { svc360, seedDupaId, incarca360 } from '@/lib/c360'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Cursant 360 — admin.
//   GET  ?id=<student_id>                         -> Cursant360
//   POST { action:'obligatie', student_id, program, suma, moneda?, scadenta?, note? }
//   POST { action:'plata', student_id, obligatie_id?, suma, moneda?, platit_la?, metoda?, factura_nr?, note? }
//   POST { action:'sterge_obligatie' | 'sterge_plata', id }
//   POST { action:'notite', student_id, notes }

const admin = (req: NextRequest) => verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)
const txt = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max) || null
const MONEDE = ['EUR', 'RON']

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const id = req.nextUrl.searchParams.get('id') || ''
  const sb = svc360()
  const seed = await seedDupaId(sb, id)
  if (!seed) return NextResponse.json({ error: 'Cursantul nu a fost găsit.' }, { status: 404 })
  return NextResponse.json(await incarca360(sb, seed, { admin: true }))
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => ({}))
  const sb = svc360()
  const moneda = MONEDE.includes(String(b.moneda)) ? String(b.moneda) : 'EUR'
  const suma = Number(String(b.suma ?? '').replace(',', '.'))

  if (b.action === 'obligatie') {
    if (!b.student_id || !txt(b.program) || !(suma > 0)) return NextResponse.json({ error: 'Program și sumă obligatorii.' }, { status: 400 })
    const { error } = await sb.from('cursant_obligatii').insert({
      student_id: b.student_id, program: txt(b.program, 200), suma, moneda, scadenta: txt(b.scadenta, 10), note: txt(b.note),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'plata') {
    if (!b.student_id || !(suma > 0)) return NextResponse.json({ error: 'Suma este obligatorie.' }, { status: 400 })
    const { error } = await sb.from('cursant_plati').insert({
      student_id: b.student_id, obligatie_id: b.obligatie_id || null, suma, moneda,
      platit_la: txt(b.platit_la, 10) || new Date().toISOString().slice(0, 10),
      metoda: txt(b.metoda, 60), factura_nr: txt(b.factura_nr, 60), note: txt(b.note),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'sterge_obligatie' || b.action === 'sterge_plata') {
    const table = b.action === 'sterge_obligatie' ? 'cursant_obligatii' : 'cursant_plati'
    const { error } = await sb.from(table).delete().eq('id', b.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  if (b.action === 'notite') {
    const { error } = await sb.from('students').update({ notes: String(b.notes ?? '').slice(0, 5000) }).eq('id', b.student_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Acțiune necunoscută.' }, { status: 400 })
}
