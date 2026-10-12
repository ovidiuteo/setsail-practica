import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Registru INDEPENDENT de numere pentru contractele de prestări servicii cu
// instructorii. Un număr se alocă per contract, din fișa instructorului.
//   GET    ?student_id=        -> contractele acelui instructor + următorul număr
//   GET                        -> tot registrul
//   POST   { student_id, ... } -> alocă un număr nou și salvează contractul
//   PATCH  { id, ... }         -> modifică un contract
//   PATCH  { start_number }    -> numărul de pornire al registrului
//   DELETE { id }

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}
function admin(req: NextRequest) {
  return verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)
}

const START_KEY = 'contract_instructor_start_number'

// Următorul număr liber: max(existent)+1, dar cel puțin numărul de pornire
async function nextNumber(sb: ReturnType<typeof svc>): Promise<number> {
  const [{ data: maxRow }, { data: setting }] = await Promise.all([
    sb.from('contracte_instructor').select('numar').order('numar', { ascending: false }).limit(1).maybeSingle(),
    sb.from('setsail_info').select('value').eq('key', START_KEY).maybeSingle(),
  ])
  const start = parseInt(String((setting as any)?.value ?? '').trim(), 10)
  return Math.max(((maxRow as any)?.numar ?? 0) + 1, Number.isFinite(start) ? start : 1)
}

const txt = (v: unknown, max = 500) => String(v ?? '').trim().slice(0, max)
const dataSauNull = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : null)
const intSau = (v: unknown, implicit: number) => {
  const n = parseInt(String(v ?? '').replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : implicit
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = svc()
  const studentId = req.nextUrl.searchParams.get('student_id') || ''

  let q = sb.from('contracte_instructor')
    .select('*, students(full_name, session_id)')
    .order('numar', { ascending: false })
  if (studentId) q = q.eq('student_id', studentId)

  const [{ data, error }, { data: setting }] = await Promise.all([
    q,
    sb.from('setsail_info').select('value').eq('key', START_KEY).maybeSingle(),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({
    contracte: data || [],
    start_number: (setting as any)?.value ?? '',
    next: await nextNumber(sb),
  })
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = svc()
  const b = await req.json().catch(() => ({}))
  const studentId = txt(b.student_id, 60)
  if (!studentId) return NextResponse.json({ error: 'lipsește instructorul' }, { status: 400 })

  const { data: st } = await sb.from('students')
    .select('full_name, cnp, address, city, county').eq('id', studentId).maybeSingle()
  const domiciliuImplicit = [(st as any)?.address, (st as any)?.city, (st as any)?.county]
    .map((x: any) => String(x || '').trim()).filter(Boolean).join(', ')

  const randNou = {
    student_id: studentId,
    data_contract: dataSauNull(b.data_contract) || new Date().toISOString().slice(0, 10),
    nume: txt(b.nume, 200) || (st as any)?.full_name || '',
    domiciliu: txt(b.domiciliu) || domiciliuImplicit,
    cnp: txt(b.cnp, 20) || (st as any)?.cnp || '',
    perioada_start: dataSauNull(b.perioada_start),
    perioada_sfarsit: dataSauNull(b.perioada_sfarsit),
    tarif_teorie: intSau(b.tarif_teorie, 100),
    tarif_practica: intSau(b.tarif_practica, 500),
    note: txt(b.note, 2000),
  }

  // Reîncercăm dacă între timp altcineva a luat același număr (index unic pe `numar`)
  for (let i = 0; i < 5; i++) {
    const numar = await nextNumber(sb)
    const { data, error } = await sb.from('contracte_instructor')
      .insert({ ...randNou, numar }).select().single()
    if (!error && data) return NextResponse.json({ ok: true, contract: data })
    if (error && !/duplicate|unique/i.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  return NextResponse.json({ error: 'Nu am putut aloca un număr liber.' }, { status: 500 })
}

export async function PATCH(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = svc()
  const b = await req.json().catch(() => ({}))

  if (b.start_number !== undefined) {
    const { error } = await sb.from('setsail_info')
      .upsert({ key: START_KEY, value: txt(b.start_number, 10) }, { onConflict: 'key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const id = txt(b.id, 60)
  if (!id) return NextResponse.json({ error: 'lipsește contractul' }, { status: 400 })
  const upd: any = {}
  if (b.numar !== undefined) upd.numar = intSau(b.numar, 0)
  if (b.data_contract !== undefined) upd.data_contract = dataSauNull(b.data_contract)
  if (b.nume !== undefined) upd.nume = txt(b.nume, 200)
  if (b.domiciliu !== undefined) upd.domiciliu = txt(b.domiciliu)
  if (b.cnp !== undefined) upd.cnp = txt(b.cnp, 20)
  if (b.perioada_start !== undefined) upd.perioada_start = dataSauNull(b.perioada_start)
  if (b.perioada_sfarsit !== undefined) upd.perioada_sfarsit = dataSauNull(b.perioada_sfarsit)
  if (b.tarif_teorie !== undefined) upd.tarif_teorie = intSau(b.tarif_teorie, 100)
  if (b.tarif_practica !== undefined) upd.tarif_practica = intSau(b.tarif_practica, 500)
  if (b.note !== undefined) upd.note = txt(b.note, 2000)

  const { data, error } = await sb.from('contracte_instructor').update(upd).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, contract: data })
}

export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = svc()
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'lipsește contractul' }, { status: 400 })
  const { error } = await sb.from('contracte_instructor').delete().eq('id', String(id))
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
