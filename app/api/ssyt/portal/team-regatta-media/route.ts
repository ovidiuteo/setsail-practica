import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { r2Enabled, r2Upload, r2Delete, r2KeyFromUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'
const LEGACY_BUCKET = 'ssyt-team-media' // poze vechi rămase pe Supabase Storage
const MAX_SIZE = 12 * 1024 * 1024
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp']

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

async function getParticipant(req: NextRequest, supabase: any): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  const { data } = await supabase.rpc('ssyt_portal_validate_session', { p_token: token })
  const row = Array.isArray(data) ? data[0] : data
  return row?.valid ? row.participant_id : null
}

async function canEditTeam(pid: string, teamId: string, supabase: any): Promise<boolean> {
  const { data: team } = await supabase.from('ssyt_teams').select('skipper_id').eq('id', teamId).maybeSingle()
  if (team?.skipper_id === pid) return true
  const { data: mem } = await supabase
    .from('ssyt_team_memberships')
    .select('is_editor')
    .eq('participant_id', pid)
    .eq('team_id', teamId)
    .eq('status', 'active')
    .maybeSingle()
  return !!mem?.is_editor
}

// POST - upload poză nouă pe Cloudflare R2 (multipart: file, team_id, regatta_id, caption?)
// Scrie în ssyt_media (vizibilitate public) + un rând de evidență în ssyt_files.
export async function POST(req: NextRequest) {
  if (!r2Enabled()) return NextResponse.json({ error: 'Stocarea R2 nu este configurată.' }, { status: 503 })

  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const formData = await req.formData().catch(() => null)
  const file = formData?.get('file') as File | null
  const teamId = formData?.get('team_id') as string | null
  const regattaId = formData?.get('regatta_id') as string | null
  const caption = (formData?.get('caption') as string | null) || null

  if (!file) return NextResponse.json({ error: 'Lipsește fișierul.' }, { status: 400 })
  if (!teamId || !regattaId) return NextResponse.json({ error: 'team_id / regatta_id lipsă.' }, { status: 400 })
  if (!ALLOWED_MIMES.includes(file.type))
    return NextResponse.json({ error: 'Tip fișier neacceptat (JPG, PNG sau WebP).' }, { status: 400 })
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fișierul depășește 12 MB.' }, { status: 400 })

  if (!(await canEditTeam(pid, teamId, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('season_id')
    .eq('id', regattaId)
    .maybeSingle()
  if (!regatta) return NextResponse.json({ error: 'Regata nu există.' }, { status: 404 })

  // Optimizare imagine → webp
  let buffer: Buffer = Buffer.from(await file.arrayBuffer())
  let contentType = file.type
  try {
    buffer = await sharp(buffer)
      .rotate()
      .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer()
    contentType = 'image/webp'
  } catch {
    // urc originalul dacă optimizarea eșuează
  }

  const ext = contentType === 'image/webp' ? 'webp' : (file.type === 'image/png' ? 'png' : 'jpg')
  const key = `ssyt/team_photo/${teamId}/${regattaId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  let publicUrl: string
  try {
    publicUrl = await r2Upload(key, buffer, contentType)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload R2 eșuat.' }, { status: 500 })
  }

  const { data: inserted, error: dbErr } = await supabase
    .from('ssyt_media')
    .insert({
      season_id: regatta.season_id,
      team_id: teamId,
      regatta_id: regattaId,
      media_type: 'photo',
      visibility: 'public',
      url: publicUrl,
      storage_path: key, // stocăm cheia R2 aici pentru ștergere
      caption,
      uploaded_by: pid,
    })
    .select('id, url, caption, created_at')
    .maybeSingle()

  if (dbErr) {
    await r2Delete(key).catch(() => {})
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  // Evidență (best-effort)
  await supabase.from('ssyt_files').insert({
    context: 'team_photo',
    regatta_id: regattaId,
    team_id: teamId,
    participant_id: pid,
    filename: file.name || `poza.${ext}`,
    content_type: contentType,
    size_bytes: buffer.byteLength,
    r2_key: key,
    url: publicUrl,
    uploaded_by: pid,
    uploader_kind: 'portal',
  })

  return NextResponse.json({ success: true, media: inserted })
}

// DELETE - șterge o poză de echipă (body: { id })
// Gestionează atât pozele noi (R2) cât și cele vechi (Supabase Storage).
export async function DELETE(req: NextRequest) {
  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const { id } = await req.json().catch(() => ({ id: null }))
  if (!id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })

  const { data: row } = await supabase
    .from('ssyt_media')
    .select('id, team_id, storage_path, url')
    .eq('id', id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Poza nu există.' }, { status: 404 })
  if (!row.storage_path)
    return NextResponse.json({ error: 'Poză adăugată din admin — șterge-o din panoul admin.' }, { status: 403 })
  if (!row.team_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await canEditTeam(pid, row.team_id, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // R2 dacă URL-ul e public R2, altfel Supabase Storage (poze vechi)
  const r2Key = r2KeyFromUrl(row.url || '')
  if (r2Key) {
    await r2Delete(r2Key).catch(() => {})
    await supabase.from('ssyt_files').delete().eq('r2_key', r2Key)
  } else {
    await supabase.storage.from(LEGACY_BUCKET).remove([row.storage_path])
  }

  const { error } = await supabase.from('ssyt_media').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
