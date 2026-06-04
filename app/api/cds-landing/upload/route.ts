import { NextRequest, NextResponse } from 'next/server'
import { cdsServiceClient, isEditor, CDS_BUCKET } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

const MAX_SIZE = 6 * 1024 * 1024 // 6 MB
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null)
  if (!form) return NextResponse.json({ ok: false, error: 'Cerere invalidă.' }, { status: 400 })

  const token = (form.get('token') as string) || null
  if (!(await isEditor(token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }

  const file = form.get('file') as File | null
  if (!file) return NextResponse.json({ ok: false, error: 'Lipsește fișierul.' }, { status: 400 })
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ ok: false, error: 'Format acceptat: JPG, PNG, WEBP, AVIF.' }, { status: 400 })
  }
  if (file.size > MAX_SIZE) {
    return NextResponse.json({ ok: false, error: 'Imaginea depășește 6 MB.' }, { status: 400 })
  }

  const slot = ((form.get('slot') as string) || 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)
  const ext = file.type.split('/')[1].replace('jpeg', 'jpg')
  const path = `${slot}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.${ext}`

  const buffer = Buffer.from(await file.arrayBuffer())
  const sb = cdsServiceClient()
  const { error } = await sb.storage.from(CDS_BUCKET).upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const { data } = sb.storage.from(CDS_BUCKET).getPublicUrl(path)
  return NextResponse.json({ ok: true, url: data.publicUrl })
}
