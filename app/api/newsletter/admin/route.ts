import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Lista de newsletter (doar admin): contactele strânse din landing + cele importate
// din seriile de curs (tabelul MySQL de pe setsail.ro).
//   GET                                      -> { contacte, serii }
//   POST { action:'import', text, sursa? }   -> adaugă/actualizează din text lipit (TSV/CSV)
//   POST { action:'editeaza', id, ... }      -> nume, prenume, serie, note
//   POST { action:'dezabonare', id, off }    -> scoate / repune pe listă
//   POST { action:'sterge', id }

function admin(req: NextRequest) {
  return verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)
}
function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

const txt = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
const emailValid = (e: string) => /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(e)

// Data seriei: acceptă 2026-09-21, 21.09.2026 sau 21/09/2026
function dataISO(v: unknown): string | null {
  const s = String(v ?? '').trim()
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  return null
}

// Un rând lipit din phpMyAdmin: email, nume, prenume, serie, data (separate prin TAB,
// punct-virgulă sau virgulă). Dacă e doar un email pe rând, merge și așa.
function parseRand(linie: string) {
  const brut = linie.includes('\t') ? linie.split('\t') : linie.split(/\s*[;,]\s*/)
  const campuri = brut.map(c => c.trim().replace(/^"|"$/g, ''))
  const email = (campuri.find(c => emailValid(c)) || '').toLowerCase()
  if (!email) return null
  const restul = campuri.filter(c => c.toLowerCase() !== email)
  const data = restul.map(dataISO).find(Boolean) || null
  const text = restul.filter(c => !dataISO(c))
  return {
    email: txt(email),
    nume: txt(text[0] || '') || null,
    prenume: txt(text[1] || '') || null,
    serie: txt(text[2] || '') || null,
    data_serie: data,
  }
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const sb = svc()
  const { data, error } = await sb.from('newsletter_subscribers')
    .select('id, email, nume, prenume, serie, data_serie, source, note, dezabonat_la, created_at')
    .order('data_serie', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const serii = Array.from(new Set((data || []).map((c: any) => c.serie).filter(Boolean)))
  return NextResponse.json({ contacte: data || [], serii })
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })
  const sb = svc()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })

  if (body.action === 'import') {
    const linii = String(body.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    const sursa = txt(body.sursa, 40) || 'import'
    const randuri = linii.map(parseRand).filter(Boolean) as ReturnType<typeof parseRand>[]
    if (!randuri.length) return NextResponse.json({ error: 'Nu am găsit niciun email în textul lipit.' }, { status: 400 })

    // același om poate apărea la mai multe serii — păstrăm seria cea mai recentă
    const perEmail = new Map<string, any>()
    for (const r of randuri as any[]) {
      const vechi = perEmail.get(r.email)
      if (!vechi || String(r.data_serie || '') > String(vechi.data_serie || '')) perEmail.set(r.email, r)
    }

    const { data: existente } = await sb.from('newsletter_subscribers').select('id, email, data_serie')
    const dupaEmail = new Map((existente || []).map((c: any) => [String(c.email).toLowerCase(), c]))

    let adaugate = 0, actualizate = 0
    for (const r of Array.from(perEmail.values())) {
      const are = dupaEmail.get(r.email)
      if (!are) {
        const { error } = await sb.from('newsletter_subscribers').insert({ ...r, source: sursa })
        if (!error) adaugate++
      } else if (String(r.data_serie || '') >= String(are.data_serie || '')) {
        // actualizăm doar dacă rândul nou e dintr-o serie cel puțin la fel de recentă
        const { error } = await sb.from('newsletter_subscribers')
          .update({ nume: r.nume, prenume: r.prenume, serie: r.serie, data_serie: r.data_serie }).eq('id', are.id)
        if (!error) actualizate++
      }
    }
    return NextResponse.json({ ok: true, adaugate, actualizate, randuri: perEmail.size })
  }

  const id = String(body.id || '')
  if (!id) return NextResponse.json({ error: 'lipsește contactul' }, { status: 400 })

  if (body.action === 'editeaza') {
    const upd: Record<string, unknown> = {}
    for (const c of ['nume', 'prenume', 'serie', 'note'] as const)
      if (body[c] !== undefined) upd[c] = txt(body[c], c === 'note' ? 500 : 200) || null
    if (body.data_serie !== undefined) upd.data_serie = dataISO(body.data_serie)
    if (!Object.keys(upd).length) return NextResponse.json({ error: 'nimic de schimbat' }, { status: 400 })
    const { error } = await sb.from('newsletter_subscribers').update(upd).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'dezabonare') {
    const { error } = await sb.from('newsletter_subscribers')
      .update({ dezabonat_la: body.off ? new Date().toISOString() : null }).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'sterge') {
    const { error } = await sb.from('newsletter_subscribers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 })
}
