import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'
const BUCKET = 'ssyt-team-media'
const MAX_SIZE = 10 * 1024 * 1024
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

// POST - upload poză nouă (multipart: file, team_id, regatta_id, caption?)
// Scrie în ssyt_media (vizibilitate public) ca să apară și în galeria /ssyt/media + admin.
export async function POST(req: NextRequest) {
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
  if (file.size > MAX_SIZE) return NextResponse.json({ error: 'Fișierul depășește 10 MB.' }, { status: 400 })

  if (!(await canEditTeam(pid, teamId, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // season_id pentru consistență cu galeria publică (filtrată pe season activ)
  const { data: regatta } = await supabase
    .from('ssyt_regattas')
    .select('season_id')
    .eq('id', regattaId)
    .maybeSingle()
  if (!regatta) return NextResponse.json({ error: 'Regata nu există.' }, { status: 404 })

  const ext = extFromMime(file.type)
  const path = `${teamId}/${regattaId}/${Date.now()}-${Math.round(file.size % 100000)}.${ext}`
  const arrayBuffer = await file.arrayBuffer()

  const { error: uploadErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, arrayBuffer, { contentType: file.type, upsert: false })
  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = pub.publicUrl

  const { data: inserted, error: dbErr } = await supabase
    .from('ssyt_media')
    .insert({
      season_id: regatta.season_id,
      team_id: teamId,
      regatta_id: regattaId,
      media_type: 'photo',
      visibility: 'public',
      url: publicUrl,
      storage_path: path,
      caption,
      uploaded_by: pid,
    })
    .select('id, url, caption, created_at')
    .maybeSingle()

  if (dbErr) {
    await supabase.storage.from(BUCKET).remove([path]) // rollback
    return NextResponse.json({ error: dbErr.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, media: inserted })
}

// DELETE - șterge o poză de echipă (body: { id })
// Doar poze încărcate prin portal (au storage_path în bucket-ul nostru) și doar de editorii echipei.
export async function DELETE(req: NextRequest) {
  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const { id } = await req.json().catch(() => ({ id: null }))
  if (!id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })

  const { data: row } = await supabase
    .from('ssyt_media')
    .select('id, team_id, storage_path')
    .eq('id', id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Poza nu există.' }, { status: 404 })
  if (!row.storage_path)
    return NextResponse.json({ error: 'Poză adăugată din admin — șterge-o din panoul admin.' }, { status: 403 })
  if (!row.team_id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (!(await canEditTeam(pid, row.team_id, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await supabase.storage.from(BUCKET).remove([row.storage_path])
  const { error } = await supabase.from('ssyt_media').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
