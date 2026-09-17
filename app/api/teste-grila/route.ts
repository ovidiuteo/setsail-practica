import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Teste grilă ANR (doar admin).
//   GET                                   -> { sectiuni, intrebari, config, structura }
//   POST { action:'save', id?, sectiune_id, intrebare, raspunsuri, explicatie?, imagine? }
//   POST { action:'imagine', nume, data (data URL) } -> { imagine } (în bucket-ul public grila-imagini)
//   POST { action:'delete', id }
//   POST { action:'import', sectiune_id, intrebari:[{ intrebare, raspunsuri, explicatie? }], sursa? }

type Raspuns = { text: string; corect: boolean }

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

const txt = (v: unknown, max = 2000) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Răspunsurile valide: text nevid, cel puțin două, exact unul corect
function curataRaspunsuri(v: unknown): Raspuns[] | string {
  const rs = (Array.isArray(v) ? v : [])
    .map((r: any) => ({ text: txt(r?.text, 1000), corect: r?.corect === true }))
    .filter(r => r.text)
  if (rs.length < 2) return 'Sunt necesare cel puțin două răspunsuri.'
  if (rs.filter(r => r.corect).length !== 1) return 'Marchează exact un răspuns corect.'
  return rs
}

export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const sb = svc()
  const [s, i, c, t] = await Promise.all([
    sb.from('grila_sectiuni').select('id, cod, nume, parent_id, categorii, ordine').order('ordine'),
    sb.from('grila_intrebari').select('id, sectiune_id, nr, intrebare, raspunsuri, explicatie, sursa, imagine, activ, updated_at')
      .order('nr', { ascending: true, nullsFirst: false }).order('created_at'),
    sb.from('grila_test_config').select('categorie, total, minim'),
    sb.from('grila_test_structura').select('categorie, sectiune_id, nr_intrebari'),
  ])
  const eroare = s.error || i.error || c.error || t.error
  if (eroare) return NextResponse.json({ error: eroare.message }, { status: 500 })
  return NextResponse.json({ sectiuni: s.data, intrebari: i.data, config: c.data, structura: t.data })
}

export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  const sb = svc()

  // Următorul număr din secțiune
  const urmatorulNr = async (sectiuneId: string) => {
    const { data } = await sb.from('grila_intrebari').select('nr').eq('sectiune_id', sectiuneId)
      .order('nr', { ascending: false, nullsFirst: false }).limit(1).maybeSingle()
    return ((data as { nr: number | null } | null)?.nr || 0) + 1
  }

  if (body.action === 'save') {
    const intrebare = txt(body.intrebare)
    if (!intrebare) return NextResponse.json({ error: 'Scrie întrebarea.' }, { status: 400 })
    const raspunsuri = curataRaspunsuri(body.raspunsuri)
    if (typeof raspunsuri === 'string') return NextResponse.json({ error: raspunsuri }, { status: 400 })
    const imagine = body.imagine ? txt(body.imagine, 200) : null
    const camp = { intrebare, raspunsuri, explicatie: txt(body.explicatie), imagine, updated_at: new Date().toISOString() }
    if (body.id) {
      const { data, error } = await sb.from('grila_intrebari').update({ ...camp, sectiune_id: String(body.sectiune_id || '') || undefined }).eq('id', String(body.id)).select().maybeSingle()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ intrebare: data })
    }
    const sectiuneId = String(body.sectiune_id || '')
    if (!sectiuneId) return NextResponse.json({ error: 'Alege secțiunea.' }, { status: 400 })
    const { data, error } = await sb.from('grila_intrebari')
      .insert({ ...camp, sectiune_id: sectiuneId, nr: await urmatorulNr(sectiuneId) }).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ intrebare: data })
  }

  if (body.action === 'imagine') {
    const m = /^data:(image\/(png|jpe?g|webp|gif));base64,(.+)$/.exec(String(body.data || ''))
    if (!m) return NextResponse.json({ error: 'Imagine invalidă (PNG, JPG, WEBP sau GIF).' }, { status: 400 })
    const buf = Buffer.from(m[3], 'base64')
    if (buf.length > 3 * 1024 * 1024) return NextResponse.json({ error: 'Imaginea are peste 3 MB.' }, { status: 400 })
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2]
    const baza = txt(body.nume, 80).replace(/\.[^.]+$/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'imagine'
    const nume = `${baza}-${Date.now().toString(36)}.${ext}`
    const { error } = await sb.storage.from('grila-imagini').upload(nume, buf, { contentType: m[1] })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ imagine: nume })
  }

  if (body.action === 'delete') {
    const { error } = await sb.from('grila_intrebari').delete().eq('id', String(body.id || ''))
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'import') {
    const sectiuneId = String(body.sectiune_id || '')
    if (!sectiuneId) return NextResponse.json({ error: 'Alege secțiunea.' }, { status: 400 })
    const lista = Array.isArray(body.intrebari) ? body.intrebari : []
    let nr = await urmatorulNr(sectiuneId)
    const randuri: any[] = []
    const erori: string[] = []
    lista.forEach((q: any, idx: number) => {
      const intrebare = txt(q?.intrebare)
      const raspunsuri = curataRaspunsuri(q?.raspunsuri)
      if (!intrebare) { erori.push(`rândul ${idx + 1}: lipsește întrebarea`); return }
      if (typeof raspunsuri === 'string') { erori.push(`rândul ${idx + 1}: ${raspunsuri}`); return }
      randuri.push({ sectiune_id: sectiuneId, nr: nr++, intrebare, raspunsuri, explicatie: txt(q?.explicatie), sursa: txt(body.sursa, 200) })
    })
    if (erori.length) return NextResponse.json({ error: 'Importul nu s-a făcut:\n' + erori.slice(0, 10).join('\n') }, { status: 400 })
    if (!randuri.length) return NextResponse.json({ error: 'Nicio întrebare de importat.' }, { status: 400 })
    const { data, error } = await sb.from('grila_intrebari').insert(randuri).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ intrebari: data })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 })
}
