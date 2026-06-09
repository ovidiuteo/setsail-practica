import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { r2Enabled, r2Upload } from '@/lib/r2'
import { authenticateUploader } from '@/lib/ssyt/upload-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

const ALLOWED_CONTEXTS = ['regatta_document', 'boat_file', 'team_photo', 'boat_resource', 'team_resource']
const PDF = 'application/pdf'
const IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_PDF = 25 * 1024 * 1024
const MAX_IMAGE = 12 * 1024 * 1024

function extFor(contentType: string, filename: string): string {
  switch (contentType) {
    case PDF: return 'pdf'
    case 'image/jpeg': return 'jpg'
    case 'image/png': return 'png'
    case 'image/webp': return 'webp'
    default: {
      const m = filename.match(/\.([a-z0-9]+)$/i)
      return m ? m[1].toLowerCase() : 'bin'
    }
  }
}

function rand(): string {
  return Math.random().toString(36).slice(2, 8)
}

export async function POST(req: NextRequest) {
  if (!r2Enabled()) {
    return NextResponse.json({ error: 'Stocarea R2 nu este configurată.' }, { status: 503 })
  }

  const uploader = await authenticateUploader(req)
  if (!uploader) return NextResponse.json({ error: 'Neautentificat.' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file') as File | null
  const context = (form?.get('context') as string | null) || ''
  const optimize = (form?.get('optimize') as string | null) === 'true'
  const regattaId = (form?.get('regatta_id') as string | null) || null
  const teamId = (form?.get('team_id') as string | null) || null
  const boatId = (form?.get('boat_id') as string | null) || null
  const participantId = (form?.get('participant_id') as string | null) || null

  if (!file) return NextResponse.json({ error: 'Lipsește fișierul.' }, { status: 400 })
  if (!ALLOWED_CONTEXTS.includes(context)) {
    return NextResponse.json({ error: 'Context invalid.' }, { status: 400 })
  }

  let contentType = file.type
  const isPdf = contentType === PDF
  const isImage = IMAGE_MIMES.includes(contentType)
  if (!isPdf && !isImage) {
    return NextResponse.json({ error: 'Tip fișier neacceptat (PDF, JPG, PNG sau WebP).' }, { status: 400 })
  }
  if (isPdf && file.size > MAX_PDF) {
    return NextResponse.json({ error: 'PDF-ul depășește 25 MB.' }, { status: 400 })
  }
  if (isImage && file.size > MAX_IMAGE) {
    return NextResponse.json({ error: 'Imaginea depășește 12 MB.' }, { status: 400 })
  }

  let buffer: Buffer = Buffer.from(await file.arrayBuffer())
  const originalName = file.name || `fisier.${extFor(contentType, '')}`

  // Optimizare doar pentru imagini (NU pentru PDF) și doar dacă e cerut explicit.
  if (isImage && optimize) {
    try {
      buffer = await sharp(buffer)
        .rotate()
        .resize(2400, 2400, { fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer()
      contentType = 'image/webp'
    } catch {
      // dacă optimizarea eșuează, urc fișierul original
    }
  }

  const ext = extFor(contentType, originalName)
  const key = `ssyt/${context}/${Date.now()}-${rand()}.${ext}`

  let url: string
  try {
    url = await r2Upload(key, buffer, contentType)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Upload R2 eșuat.' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: row, error: dbErr } = await supabase
    .from('ssyt_files')
    .insert({
      context,
      regatta_id: regattaId,
      team_id: teamId,
      boat_id: boatId,
      participant_id: participantId,
      filename: originalName,
      content_type: contentType,
      size_bytes: buffer.byteLength,
      r2_key: key,
      url,
      uploaded_by: uploader.uploadedBy,
      uploader_kind: uploader.kind,
    })
    .select('id, url, r2_key, content_type, size_bytes, filename')
    .maybeSingle()

  if (dbErr) {
    return NextResponse.json({ error: dbErr.message, url }, { status: 500 })
  }

  return NextResponse.json({
    id: row?.id,
    url,
    r2_key: key,
    content_type: contentType,
    size_bytes: buffer.byteLength,
    filename: originalName,
  })
}
