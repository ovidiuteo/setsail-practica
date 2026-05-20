import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

const BUCKET = 'ssyt-participant-uploads'
const MAX_SIZE = 5 * 1024 * 1024
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

function extFromMime(mime: string): string {
  switch (mime) {
    case 'image/jpeg':
      return 'jpg'
    case 'image/png':
      return 'png'
    case 'image/webp':
      return 'webp'
    default:
      return 'bin'
  }
}

export async function POST(req: NextRequest) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Neautentificat.' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  if (!file) {
    return NextResponse.json({ ok: false, error: 'Lipsește fișierul.' }, { status: 400 })
  }
  if (!ALLOWED_MIMES.includes(file.type)) {
    return NextResponse.json(
      { ok: false, error: 'Tip fișier neacceptat (folosește JPG, PNG sau WebP).' },
      { status: 400 }
    )
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'Fișierul depășește 5 MB.' }, { status: 400 })
  }

  const supabase = getPortalSupabase()

  // Sterg poza anterioara daca exista
  const { data: prev } = await supabase
    .from('ssyt_participants')
    .select('ci_image_url')
    .eq('id', session.participantId)
    .maybeSingle()

  if (prev?.ci_image_url) {
    await supabase.storage.from(BUCKET).remove([prev.ci_image_url])
  }

  const ext = extFromMime(file.type)
  const path = `${session.participantId}/ci-${Date.now()}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true })

  if (uploadErr) {
    return NextResponse.json({ ok: false, error: uploadErr.message }, { status: 500 })
  }

  const { error: dbErr } = await supabase
    .from('ssyt_participants')
    .update({ ci_image_url: path })
    .eq('id', session.participantId)

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]) // rollback
    return NextResponse.json({ ok: false, error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, path })
}

export async function DELETE() {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Neautentificat.' }, { status: 401 })

  const supabase = getPortalSupabase()

  const { data: prev } = await supabase
    .from('ssyt_participants')
    .select('ci_image_url')
    .eq('id', session.participantId)
    .maybeSingle()

  if (prev?.ci_image_url) {
    await supabase.storage.from(BUCKET).remove([prev.ci_image_url])
  }

  const { error } = await supabase
    .from('ssyt_participants')
    .update({ ci_image_url: null })
    .eq('id', session.participantId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
