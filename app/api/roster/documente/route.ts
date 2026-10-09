import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Documentele seriei, din lista cu token. Folosesc același sistem ca secțiunea de
// fișiere din admin: tipurile (descrierile) sunt pe categorie — ANCOM la radio, ANR
// în rest — deci se regăsesc la fiecare serie nouă, iar fișierele stau în Storage.
//   GET  ?session_id=&token=   -> { categorie, documente: [{ id, label, fisier }] }
//   POST { action: 'adauga'|'editeaza'|'sterge'|'sign'|'record'|'sterge_fisier', … }

const BUCKET = 'session-files'
const MAX_SIZE = 25 * 1024 * 1024
const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}
const txt = (v: unknown, max = 200) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
function extFor(name: string, mime: string): string {
  const m = (name || '').match(/\.([a-z0-9]+)$/i)
  if (m) return m[1].toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('wordprocessingml')) return 'docx'
  if (mime === 'image/png') return 'png'
  if (mime.includes('jpeg')) return 'jpg'
  return 'bin'
}
function valideaza(name: string, mime: string, size: number): string | null {
  if (!ALLOWED.includes(mime)) return 'Format acceptat: PDF, DOCX sau imagine.'
  if (size > MAX_SIZE) return `Fișierul depășește ${Math.round(MAX_SIZE / 1024 / 1024)} MB.`
  return null
}

// Seria + categoria de documente (ANCOM la radio, ANR în rest)
async function seria(sb: ReturnType<typeof svc>, sessionId: string, token: string) {
  const { data: s } = await sb.from('sessions')
    .select('id, roster_token, parent_session_id, class_caa')
    .eq('id', sessionId).maybeSingle()
  if (!s || !token || (s as any).roster_token !== token) return null
  const principalId = (s as any).parent_session_id || (s as any).id
  const { data: principal } = await sb.from('sessions').select('id, class_caa').eq('id', principalId).maybeSingle()
  const sess = (principal || s) as any
  return { sess, categorie: /radio|lrc/i.test(String(sess.class_caa || '')) ? 'ancom' : 'anr' }
}

export async function GET(req: NextRequest) {
  const sb = svc()
  const sessionId = req.nextUrl.searchParams.get('session_id') || ''
  const token = req.nextUrl.searchParams.get('token') || ''
  const ctx = await seria(sb, sessionId, token)
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const [{ data: tipuri }, { data: fisiere }] = await Promise.all([
    sb.from('session_file_types').select('id, label, ordine').eq('categorie', ctx.categorie).order('ordine'),
    sb.from('session_files').select('id, file_type_id, file_name, mime_type, size, storage_key, created_at')
      .eq('session_id', ctx.sess.id).order('created_at'),
  ])

  // linkuri semnate pentru previzualizare (o oră)
  const chei = (fisiere || []).map((f: any) => f.storage_key).filter(Boolean)
  const urls: Record<string, string> = {}
  if (chei.length) {
    const { data: semnate } = await sb.storage.from(BUCKET).createSignedUrls(chei, 3600)
    ;(semnate || []).forEach((s: any, i: number) => { if (s?.signedUrl) urls[chei[i]] = s.signedUrl })
  }
  const fisierPt = (tipId: string) => {
    const f = (fisiere || []).find((x: any) => x.file_type_id === tipId)
    return f ? { ...f, url: urls[f.storage_key] || null } : null
  }

  return NextResponse.json({
    categorie: ctx.categorie,
    documente: (tipuri || []).map((t: any) => ({ id: t.id, label: t.label, fisier: fisierPt(t.id) })),
    // fișiere urcate fără un tip anume (din admin, la „Diverse")
    diverse: (fisiere || []).filter((f: any) => !f.file_type_id).map((f: any) => ({ ...f, url: urls[f.storage_key] || null })),
  })
}

export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  const ctx = await seria(sb, String(body.session_id || ''), String(body.token || ''))
  if (!ctx) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  // ── descrierile (tipurile de document), comune tuturor seriilor din categorie ──
  if (body.action === 'adauga') {
    const label = txt(body.label)
    if (!label) return NextResponse.json({ error: 'Scrie descrierea documentului.' }, { status: 400 })
    const { data: ultim } = await sb.from('session_file_types').select('ordine')
      .eq('categorie', ctx.categorie).order('ordine', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await sb.from('session_file_types')
      .insert({ categorie: ctx.categorie, label, ordine: ((ultim as any)?.ordine || 0) + 1 }).select().maybeSingle()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, document: data })
  }

  if (body.action === 'editeaza') {
    const label = txt(body.label)
    if (!label) return NextResponse.json({ error: 'Descriere goală' }, { status: 400 })
    const { error } = await sb.from('session_file_types').update({ label })
      .eq('id', String(body.id || '')).eq('categorie', ctx.categorie)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // șterge descrierea (de la toate seriile din categorie) și fișierele urcate pe ea
  if (body.action === 'sterge') {
    const tipId = String(body.id || '')
    const { data: alese } = await sb.from('session_files').select('id, storage_key').eq('file_type_id', tipId)
    const chei = (alese || []).map((f: any) => f.storage_key).filter(Boolean)
    if (chei.length) await sb.storage.from(BUCKET).remove(chei)
    await sb.from('session_files').delete().eq('file_type_id', tipId)
    const { error } = await sb.from('session_file_types').delete().eq('id', tipId).eq('categorie', ctx.categorie)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  // ── fișierul seriei: urcat direct în Storage, cu URL semnat ──
  if (body.action === 'sign') {
    const name = String(body.file_name || ''), mime = String(body.mime_type || ''), size = Number(body.size || 0)
    const rau = valideaza(name, mime, size)
    if (rau) return NextResponse.json({ error: rau }, { status: 400 })
    const key = `${ctx.sess.id}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${extFor(name, mime)}`
    const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(key)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ key, token: data.token })
  }

  if (body.action === 'record') {
    const key = String(body.storage_key || '')
    if (!key.startsWith(`${ctx.sess.id}/`)) return NextResponse.json({ error: 'cheie invalidă' }, { status: 400 })
    const name = String(body.file_name || ''), mime = String(body.mime_type || ''), size = Number(body.size || 0)
    const rau = valideaza(name, mime, size)
    if (rau) return NextResponse.json({ error: rau }, { status: 400 })
    const tipId = String(body.file_type_id || '') || null

    // înlocuire: scoatem fișierul vechi de pe același tip
    if (tipId) {
      const { data: vechi } = await sb.from('session_files').select('id, storage_key')
        .eq('session_id', ctx.sess.id).eq('file_type_id', tipId)
      const chei = (vechi || []).map((f: any) => f.storage_key).filter(Boolean)
      if (chei.length) await sb.storage.from(BUCKET).remove(chei)
      if ((vechi || []).length) await sb.from('session_files').delete().in('id', (vechi || []).map((f: any) => f.id))
    }

    const { data, error } = await sb.from('session_files').insert({
      session_id: ctx.sess.id, file_type_id: tipId, label: name,
      storage_key: key, file_name: name, mime_type: mime, size,
    }).select().single()
    if (error) {
      await sb.storage.from(BUCKET).remove([key])
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    const { data: semnat } = await sb.storage.from(BUCKET).createSignedUrl(key, 3600)
    return NextResponse.json({ ok: true, fisier: { ...data, url: semnat?.signedUrl || null } })
  }

  if (body.action === 'sterge_fisier') {
    const { data: row } = await sb.from('session_files').select('storage_key')
      .eq('id', String(body.id || '')).eq('session_id', ctx.sess.id).maybeSingle()
    if ((row as any)?.storage_key) await sb.storage.from(BUCKET).remove([(row as any).storage_key])
    const { error } = await sb.from('session_files').delete()
      .eq('id', String(body.id || '')).eq('session_id', ctx.sess.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Acțiune necunoscută' }, { status: 400 })
}
