// ============================================================================
// CDS Landing — Cloudflare R2 upload (S3-compatible, egress-free).
// Falls back to Supabase Storage when R2 env vars are not configured.
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

export async function r2Upload(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = new AwsClient({
    accessKeyId: KEY!,
    secretAccessKey: SECRET!,
    service: 's3',
    region: 'auto',
  })
  const host = `${ACCOUNT}.r2.cloudflarestorage.com`
  const endpoint = `https://${host}/${BUCKET}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

  let res: Response
  try {
    res = await client.fetch(endpoint, {
      method: 'PUT',
      body: new Uint8Array(body),
      headers: {
        'content-type': contentType,
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
