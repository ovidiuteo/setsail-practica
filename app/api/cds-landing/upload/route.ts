import { NextRequest, NextResponse } from 'next/server'
import { cdsServiceClient, isEditor, CDS_BUCKET } from '@/lib/cds-landing/server'
import { optimizeToWebp } from '@/lib/cds-landing/images'
import { r2Enabled, r2Upload } from '@/lib/cds-landing/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // sharp needs the Node runtime

const MAX_SIZE = 12 * 1024 * 1024 // 12 MB raw input (optimized down to webp after)
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
    return NextResponse.json({ ok: false, error: 'Imaginea depășește 12 MB.' }, { status: 400 })
  }

  const slot = ((form.get('slot') as string) || 'img').replace(/[^a-z0-9_-]/gi, '').slice(0, 40)

  // Optimize: resize per slot + convert to webp
  let optimized: Buffer
  try {
    optimized = await optimizeToWebp(Buffer.from(await file.arrayBuffer()), slot)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Procesare imagine eșuată: ' + (e?.message || 'eroare') }, { status: 400 })
  }

  const key = `${slot}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.webp`

  // Prefer Cloudflare R2 (egress-free); fall back to Supabase Storage if not configured.
  if (r2Enabled()) {
    try {
      const url = await r2Upload(key, optimized, 'image/webp')
      return NextResponse.json({ ok: true, url, storage: 'r2' })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'R2 upload eșuat.' }, { status: 500 })
    }
  }

  const sb = cdsServiceClient()
  const { error } = await sb.storage.from(CDS_BUCKET).upload(key, optimized, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '31536000',
  })
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const { data } = sb.storage.from(CDS_BUCKET).getPublicUrl(key)
  return NextResponse.json({ ok: true, url: data.publicUrl, storage: 'supabase' })
}
