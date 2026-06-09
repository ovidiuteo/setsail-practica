// ============================================================================
// Generic Cloudflare R2 storage (S3-compatible, egress-free).
// Shared by CDS landing images and SSYT file hosting.
// ============================================================================
import 'server-only'
import { AwsClient } from 'aws4fetch'

const clean = (v?: string) => (v || '').trim()
// account id is 32 hex chars — strip any stray leading/trailing dots or spaces
const ACCOUNT = clean(process.env.R2_ACCOUNT_ID).replace(/^\.+|\.+$/g, '')
const KEY = clean(process.env.R2_ACCESS_KEY_ID)
const SECRET = clean(process.env.R2_SECRET_ACCESS_KEY)
const BUCKET = clean(process.env.R2_BUCKET).replace(/^\/+|\/+$/g, '')
const PUBLIC_BASE = clean(process.env.R2_PUBLIC_BASE_URL)

export function r2Enabled(): boolean {
  return Boolean(ACCOUNT && KEY && SECRET && BUCKET && PUBLIC_BASE)
}

function encodeKey(key: string): string {
  return key.split('/').map(encodeURIComponent).join('/')
}

export async function r2Upload(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = new AwsClient({
    accessKeyId: KEY!,
    secretAccessKey: SECRET!,
    service: 's3',
    region: 'auto',
  })
  const host = `${ACCOUNT}.r2.cloudflarestorage.com`
  const endpoint = `https://${host}/${BUCKET}/${encodeKey(key)}`

  const bytes = new Uint8Array(body)
  let res: Response
  try {
    res = await client.fetch(endpoint, {
      method: 'PUT',
      body: bytes,
      headers: {
        'content-type': contentType,
        'content-length': String(bytes.byteLength), // R2 requires Content-Length on PUT
        'cache-control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (e: any) {
    throw new Error(`R2 connect failed (host ${host}): ${e?.cause?.message || e?.message || String(e)}`)
  }

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`R2 upload failed (${res.status}): ${txt.slice(0, 300)}`)
  }

  return `${PUBLIC_BASE!.replace(/\/+$/, '')}/${key}`
}

// Returns the R2 object key if `url` is one of our R2 public URLs, else null.
export function r2KeyFromUrl(url: string): string | null {
  if (!PUBLIC_BASE || !url) return null
  const base = PUBLIC_BASE.replace(/\/+$/, '')
  if (!url.startsWith(base + '/')) return null
  return decodeURIComponent(url.slice(base.length + 1))
}

export async function r2Delete(key: string): Promise<void> {
  const client = new AwsClient({ accessKeyId: KEY!, secretAccessKey: SECRET!, service: 's3', region: 'auto' })
  const endpoint = `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${encodeKey(key)}`
  const res = await client.fetch(endpoint, { method: 'DELETE' })
  // S3 DELETE returns 204; treat 404 as already-gone (idempotent)
  if (!res.ok && res.status !== 404) {
    const txt = await res.text().catch(() => '')
    throw new Error(`R2 delete failed (${res.status}): ${txt.slice(0, 200)}`)
  }
}
