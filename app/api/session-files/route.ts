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

// UPLOAD
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ error: 'bad request' }, { status: 400 })
  const sessionId = String(form.get('session_id') || '')
  const fileTypeId = String(form.get('file_type_id') || '') || null
  const file = form.get('file') as File | null
  if (!sessionId || !file) return NextResponse.json({ error: 'lipsește sesiunea sau fișierul' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ error: 'Format acceptat: PDF, DOCX, sau imagine.' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fișierul depășește 25 MB.' }, { status: 400 })

  const sb = svc()
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
