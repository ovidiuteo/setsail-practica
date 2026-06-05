import { NextRequest, NextResponse } from 'next/server'
import { cdsServiceClient, isEditor, CDS_BUCKET } from '@/lib/cds-landing/server'
import { optimizeToWebp } from '@/lib/cds-landing/images'
import { r2Enabled, r2Upload, r2KeyFromUrl, r2Delete } from '@/lib/cds-landing/r2'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs' // sharp needs the Node runtime

const MAX_SIZE = 12 * 1024 * 1024 // 12 MB raw input (optimized down to webp after)
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']

// --- delete the underlying object for a given image URL (R2 or Supabase) ---
function supabaseKeyFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${CDS_BUCKET}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  return decodeURIComponent(url.slice(i + marker.length))
}

async function deleteObjectByUrl(url: string): Promise<{ deleted: boolean; storage?: string }> {
  if (!url) return { deleted: false }
  const r2key = r2KeyFromUrl(url)
  if (r2key) {
    await r2Delete(r2key)
    return { deleted: true, storage: 'r2' }
  }
  const sbKey = supabaseKeyFromUrl(url)
  if (sbKey) {
    const sb = cdsServiceClient()
    const { error } = await sb.storage.from(CDS_BUCKET).remove([sbKey])
    if (error) throw new Error(error.message)
    return { deleted: true, storage: 'supabase' }
  }
  // external (Unsplash/pravatar) or /public CDN asset → nothing to delete
  return { deleted: false }
}

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
  const prevUrl = (form.get('prevUrl') as string) || ''

  // Optimize: resize per slot + convert to webp
  let optimized: Buffer
  try {
    optimized = await optimizeToWebp(Buffer.from(await file.arrayBuffer()), slot)
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: 'Procesare imagine eșuată: ' + (e?.message || 'eroare') }, { status: 400 })
  }

  const key = `${slot}/${Date.now()}-${Math.floor(Math.random() * 1e6)}.webp`

  // Store: prefer Cloudflare R2 (egress-free); fall back to Supabase Storage.
  let url: string
  let storage: string
  try {
    if (r2Enabled()) {
      url = await r2Upload(key, optimized, 'image/webp')
      storage = 'r2'
    } else {
      const sb = cdsServiceClient()
      const { error } = await sb.storage.from(CDS_BUCKET).upload(key, optimized, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '31536000',
      })
      if (error) throw new Error(error.message)
      url = sb.storage.from(CDS_BUCKET).getPublicUrl(key).data.publicUrl
      storage = 'supabase'
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Stocare eșuată.' }, { status: 500 })
  }

  // Best-effort cleanup of the replaced image so we don't leave orphans.
  if (prevUrl && prevUrl !== url) {
    try { await deleteObjectByUrl(prevUrl) } catch { /* ignore cleanup errors */ }
  }

  return NextResponse.json({ ok: true, url, storage })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!(await isEditor(body?.token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  const url = String(body?.url || '')
  if (!url) return NextResponse.json({ ok: true, deleted: false })
  try {
    const res = await deleteObjectByUrl(url)
    return NextResponse.json({ ok: true, ...res })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Ștergere eșuată.' }, { status: 500 })
  }
}
