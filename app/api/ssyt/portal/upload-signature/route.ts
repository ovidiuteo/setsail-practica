import { NextRequest, NextResponse } from 'next/server'
import { getPortalSession, getPortalSupabase } from '@/lib/ssyt/portal-session'

export const dynamic = 'force-dynamic'

const BUCKET = 'ssyt-participant-uploads'
const MAX_SIZE = 2 * 1024 * 1024
const DATA_URL_PREFIX = 'data:image/png;base64,'

export async function POST(req: NextRequest) {
  const session = await getPortalSession()
  if (!session) return NextResponse.json({ ok: false, error: 'Neautentificat.' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const dataUrl: string | undefined = body?.dataUrl

  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith(DATA_URL_PREFIX)) {
    return NextResponse.json(
      { ok: false, error: 'Date PNG invalide.' },
      { status: 400 }
    )
  }

  const base64 = dataUrl.slice(DATA_URL_PREFIX.length)
  const buffer = Buffer.from(base64, 'base64')

  if (buffer.length > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'Semnătura depășește 2 MB.' }, { status: 400 })
  }

  const supabase = getPortalSupabase()

  const { data: prev } = await supabase
    .from('ssyt_participants')
    .select('signature_image_url')
    .eq('id', session.participantId)
    .maybeSingle()

  if (prev?.signature_image_url) {
    await supabase.storage.from(BUCKET).remove([prev.signature_image_url])
  }

  const path = `${session.participantId}/signature-${Date.now()}.png`

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: 'image/png', upsert: true })

  if (uploadErr) {
    return NextResponse.json({ ok: false, error: uploadErr.message }, { status: 500 })
  }

  const { error: dbErr } = await supabase
    .from('ssyt_participants')
    .update({ signature_image_url: path })
    .eq('id', session.participantId)

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path])
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
    .select('signature_image_url')
    .eq('id', session.participantId)
    .maybeSingle()

  if (prev?.signature_image_url) {
    await supabase.storage.from(BUCKET).remove([prev.signature_image_url])
  }

  const { error } = await supabase
    .from('ssyt_participants')
    .update({ signature_image_url: null })
    .eq('id', session.participantId)

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
