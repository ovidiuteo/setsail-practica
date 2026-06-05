// ============================================================================
// CDS Landing — Cloudflare R2 upload (S3-compatible, egress-free).
// Falls back to Supabase Storage when R2 env vars are not configured.
// ============================================================================
import 'server-only'
import { AwsClient } from 'aws4fetch'

const ACCOUNT = process.env.R2_ACCOUNT_ID
const KEY = process.env.R2_ACCESS_KEY_ID
const SECRET = process.env.R2_SECRET_ACCESS_KEY
const BUCKET = process.env.R2_BUCKET
const PUBLIC_BASE = process.env.R2_PUBLIC_BASE_URL

export function r2Enabled(): boolean {
  return Boolean(ACCOUNT && KEY && SECRET && BUCKET && PUBLIC_BASE)
}

export async function r2Upload(key: string, body: Buffer, contentType: string): Promise<string> {
  const client = new AwsClient({ accessKeyId: KEY!, secretAccessKey: SECRET! })
  const endpoint = `https://${ACCOUNT}.r2.cloudflarestorage.com/${BUCKET}/${key
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`

  const res = await client.fetch(endpoint, {
    method: 'PUT',
    body: new Uint8Array(body),
    headers: {
      'content-type': contentType,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`R2 upload failed (${res.status}): ${txt.slice(0, 200)}`)
  }

  return `${PUBLIC_BASE!.replace(/\/+$/, '')}/${key}`
}
