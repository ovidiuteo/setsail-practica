import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Enabled, r2Upload, r2Delete, r2KeyFromUrl } from '@/lib/r2'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!
const SESSION_COOKIE = 'ssyt_portal_session'
const PDF = 'application/pdf'
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PDF = 25 * 1024 * 1024
const MAX_IMAGE = 12 * 1024 * 1024

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

function extFor(ct: string, name: string): string {
  if (ct === PDF) return 'pdf'
  if (ct === 'image/jpeg') return 'jpg'
  if (ct === 'image/png') return 'png'
  if (ct === 'image/webp') return 'webp'
  const m = name.match(/\.([a-z0-9]+)$/i)
  return m ? m[1].toLowerCase() : 'bin'
}

// POST - echipa încarcă un fișier de barcă (multipart: file, team_id, name?, category?)
export async function POST(req: NextRequest) {
  if (!r2Enabled()) return NextResponse.json({ error: 'Stocarea R2 nu este configurată.' }, { status: 503 })
  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  const teamId = form?.get('team_id') as string | null
  const name = (form?.get('name') as string | null) || null
  const category = (form?.get('category') as string | null) || null

  if (!file) return NextResponse.json({ error: 'Lipsește fișierul.' }, { status: 400 })
  if (!teamId) return NextResponse.json({ error: 'team_id lipsă.' }, { status: 400 })

  const ct = file.type
  const isPdf = ct === PDF
  const isImage = IMAGE_MIMES.includes(ct)
  if (!isPdf && !isImage) return NextResponse.json({ error: 'Tip fișier neacceptat (PDF/JPG/PNG/WebP).' }, { status: 400 })
  if (isPdf && file.size > MAX_PDF) return NextResponse.json({ error: 'PDF-ul depășește 25 MB.' }, { status: 400 })
  if (isImage && file.size > MAX_IMAGE) return NextResponse.json({ error: 'Imaginea depășește 12 MB.' }, { status: 400 })

  if (!(await canEditTeam(pid, teamId, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: team } = await supabase.from('ssyt_teams').select('boat_id').eq('id', teamId).maybeSingle()
  if (!team?.boat_id) return NextResponse.json({ error: 'Echipa nu are barcă alocată.' }, { status: 400 })

  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = extFor(ct, file.name || '')
  const key = `ssyt/boat_file/${teamId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  let url: string
  try {
    url = await r2Upload(key, buffer, ct)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload R2 eșuat.' }, { status: 500 })
  }

  const { data: row, error } = await supabase
    .from('ssyt_boat_files')
    .insert({
      boat_id: team.boat_id,
      team_id: teamId,
      source: 'portal',
      name: name || file.name || `fisier.${ext}`,
      category,
      file_url: url,
      mime_type: ct,
      file_size_bytes: buffer.byteLength,
      uploaded_by: pid,
    })
    .select('id, name, file_url, mime_type, category')
    .maybeSingle()

  if (error) {
    await r2Delete(key).catch(() => {})
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, file: row })
}

// DELETE - echipa șterge un fișier propriu (body: { id })
export async function DELETE(req: NextRequest) {
  const supabase = client()
  const pid = await getParticipant(req, supabase)
  if (!pid) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })

  const { data: row } = await supabase
    .from('ssyt_boat_files')
    .select('id, team_id, source, file_url')
    .eq('id', id)
    .maybeSingle()
  if (!row) return NextResponse.json({ error: 'Fișierul nu există.' }, { status: 404 })
  if (row.source !== 'portal' || !row.team_id)
    return NextResponse.json({ error: 'Doar fișierele echipei pot fi șterse din portal.' }, { status: 403 })
  if (!(await canEditTeam(pid, row.team_id, supabase)))
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const key = r2KeyFromUrl(row.file_url || '')
  if (key) await r2Delete(key).catch(() => {})
  const { error } = await supabase.from('ssyt_boat_files').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
