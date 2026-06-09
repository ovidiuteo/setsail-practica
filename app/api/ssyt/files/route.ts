import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { r2Delete, r2KeyFromUrl } from '@/lib/r2'
import { authenticateUploader } from '@/lib/ssyt/upload-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// DELETE — șterge un fișier găzduit: din R2 + rândul de evidență.
// Acceptă { id } (rândul ssyt_files) sau { url } (un URL public R2).
export async function DELETE(req: NextRequest) {
  const uploader = await authenticateUploader(req)
  if (!uploader) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const { id, url } = await req.json().catch(() => ({ id: null, url: null }))
  if (!id && !url) return NextResponse.json({ error: 'Lipsește id sau url.' }, { status: 400 })

  const supabase = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })

  let r2Key: string | null = null
  let rowId: string | null = id || null

  if (id) {
    const { data: row } = await supabase.from('ssyt_files').select('id, r2_key').eq('id', id).maybeSingle()
    if (row) { r2Key = row.r2_key; rowId = row.id }
  } else if (url) {
    const { data: row } = await supabase.from('ssyt_files').select('id, r2_key').eq('url', url).maybeSingle()
    if (row) { r2Key = row.r2_key; rowId = row.id }
    else r2Key = r2KeyFromUrl(url) // poate exista doar pe R2, fără rând de evidență
  }

  // Șterge din R2 (best-effort, idempotent)
  if (r2Key) {
    try { await r2Delete(r2Key) } catch (e: any) {
      return NextResponse.json({ error: e?.message || 'Ștergere R2 eșuată.' }, { status: 500 })
    }
  }

  // Șterge rândul de evidență dacă există
  if (rowId) {
    await supabase.from('ssyt_files').delete().eq('id', rowId)
  }

  return NextResponse.json({ success: true })
}
