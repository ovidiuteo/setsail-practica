import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const BUCKET = 'session-files'
const MAX_SIZE = 25 * 1024 * 1024 // 25 MB
const ALLOWED = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/msword', // doc
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
]

function admin(req: NextRequest): boolean {
  return verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)
}
function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
function extFor(name: string, mime: string): string {
  const m = (name || '').match(/\.([a-z0-9]+)$/i)
  if (m) return m[1].toLowerCase()
  if (mime === 'application/pdf') return 'pdf'
  if (mime.includes('wordprocessingml')) return 'docx'
  if (mime === 'image/png') return 'png'
  if (mime.includes('jpeg')) return 'jpg'
  return 'bin'
}

// LISTĂ — fișierele unei sesiuni, cu link-uri semnate (1h)
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'no session_id' }, { status: 400 })
  const sb = svc()
  const { data, error } = await sb.from('session_files')
    .select('*').eq('session_id', sessionId).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const rows = data || []
  const keys = rows.map((r: any) => r.storage_key)
  let urls: Record<string, string> = {}
  if (keys.length) {
    const { data: signed } = await sb.storage.from(BUCKET).createSignedUrls(keys, 3600)
    for (let i = 0; i < (signed || []).length; i++) {
      if (signed![i]?.signedUrl) urls[keys[i]] = signed![i].signedUrl
    }
  }
  return NextResponse.json({ files: rows.map((r: any) => ({ ...r, url: urls[r.storage_key] || null })) })
}

// Verificari comune (format + marime), indiferent pe ce cale vine fisierul
function valideaza(name: string, mime: string, size: number): string | null {
  if (!ALLOWED.includes(mime)) return 'Format acceptat: PDF, DOCX, sau imagine.'
  if (size > MAX_SIZE) return `Fișierul depășește ${Math.round(MAX_SIZE / 1024 / 1024)} MB.`
  return null
}

// UPLOAD
// Fisierele NU mai trec prin functia Vercel (limita ei de body e 4,5 MB): clientul
// cere un URL semnat de upload, trimite fisierul direct in Supabase Storage, apoi
// ne anunta ca sa salvam randul din session_files.
//   { action: 'sign',   session_id, file_name, mime_type, size } -> { key, token }
//   { action: 'record', session_id, file_type_id, storage_key, file_name, mime_type, size }
// Multipart-ul vechi ramane pentru fisiere mici / compatibilitate.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const sb = svc()

  if ((req.headers.get('content-type') || '').includes('application/json')) {
    const body = await req.json().catch(() => ({}))
    const sessionId = String(body.session_id || '')
    if (!sessionId) return NextResponse.json({ error: 'lipsește sesiunea' }, { status: 400 })

    if (body.action === 'sign') {
      const name = String(body.file_name || '')
      const mime = String(body.mime_type || '')
      const size = Number(body.size || 0)
      const rau = valideaza(name, mime, size)
      if (rau) return NextResponse.json({ error: rau }, { status: 400 })
      const key = `${sessionId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${extFor(name, mime)}`
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(key)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ key, token: data.token })
    }

    if (body.action === 'record') {
      const key = String(body.storage_key || '')
      // cheia trebuie sa fie una emisa de noi, pentru sesiunea asta
      if (!key.startsWith(`${sessionId}/`)) return NextResponse.json({ error: 'cheie invalidă' }, { status: 400 })
      const name = String(body.file_name || '')
      const mime = String(body.mime_type || '')
      const size = Number(body.size || 0)
      const rau = valideaza(name, mime, size)
      if (rau) return NextResponse.json({ error: rau }, { status: 400 })
      const { data, error } = await sb.from('session_files').insert({
        session_id: sessionId, file_type_id: body.file_type_id || null, label: name,
        storage_key: key, file_name: name, mime_type: mime, size,
      }).select().single()
      if (error) {
        await sb.storage.from(BUCKET).remove([key]).catch(() => {})
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(key, 3600)
      return NextResponse.json({ file: { ...data, url: signed?.signedUrl || null } })
    }

    return NextResponse.json({ error: 'acțiune necunoscută' }, { status: 400 })
  }

  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const sessionId = String(form.get('session_id') || '')
  const fileTypeId = String(form.get('file_type_id') || '') || null
  const file = form.get('file') as File | null
  if (!sessionId || !file) return NextResponse.json({ error: 'lipsește sesiunea sau fișierul' }, { status: 400 })
  const rau = valideaza(file.name, file.type, file.size)
  if (rau) return NextResponse.json({ error: rau }, { status: 400 })

  const key = `${sessionId}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${extFor(file.name, file.type)}`
  const buf = Buffer.from(await file.arrayBuffer())
  const { error: upErr } = await sb.storage.from(BUCKET).upload(key, buf, { contentType: file.type, upsert: false })
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data, error } = await sb.from('session_files').insert({
    session_id: sessionId, file_type_id: fileTypeId, label: file.name,
    storage_key: key, file_name: file.name, mime_type: file.type, size: file.size,
  }).select().single()
  if (error) {
    await sb.storage.from(BUCKET).remove([key]).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  const { data: signed } = await sb.storage.from(BUCKET).createSignedUrl(key, 3600)
  return NextResponse.json({ file: { ...data, url: signed?.signedUrl || null } })
}

// DELETE — { id }
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'no id' }, { status: 400 })
  const sb = svc()
  const { data: row } = await sb.from('session_files').select('storage_key').eq('id', id).single()
  if (row?.storage_key) await sb.storage.from(BUCKET).remove([row.storage_key]).catch(() => {})
  const { error } = await sb.from('session_files').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
