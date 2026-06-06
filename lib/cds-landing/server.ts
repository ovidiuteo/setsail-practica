// ============================================================================
// CDS Landing — server-side data access (service role). Never import in client.
// ============================================================================
import 'server-only'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { mergeContent, type LandingContent } from './content'
import { verifyToken as verifyAdminCookieToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const CDS_BUCKET = 'cds-landing'
const CONTENT_TAG = 'cds-landing-content'

// Admin / write client — ALWAYS fresh (opts out of Next.js fetch Data Cache).
// Used for the editor, all writes, leads and token reads.
export function cdsServiceClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }),
    },
  })
}

// Cached read client for the PUBLIC page — the content fetch is cached in the
// Next.js Data Cache (revalidate 300s) and tagged, so a busy/poller-hit page
// does NOT re-read the DB on every request. Busted instantly on save.
function cdsCachedClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) => {
        const { cache, ...rest } = init || {} // can't combine `cache` with `next`
        void cache
        return fetch(input, { ...rest, next: { revalidate: 300, tags: [CONTENT_TAG] } })
      },
    },
  })
}

// --- content -------------------------------------------------------------
// PUBLIC page read: cached + tagged, selects ONLY `content` (never the token).
export async function getLandingContentCached(): Promise<LandingContent> {
  const sb = cdsCachedClient()
  const { data } = await sb.from('cds_landing').select('content').eq('id', 1).maybeSingle()
  return mergeContent(data?.content)
}

// Admin/API read: always fresh, selects ONLY `content`.
export async function getLandingContent(): Promise<LandingContent> {
  const sb = cdsServiceClient()
  const { data } = await sb.from('cds_landing').select('content').eq('id', 1).maybeSingle()
  return mergeContent(data?.content)
}

export async function saveLandingContent(content: any): Promise<void> {
  const sb = cdsServiceClient()
  await sb.from('cds_landing').update({ content, updated_at: new Date().toISOString() }).eq('id', 1)
  // Bust the public page cache so edits appear immediately despite ISR.
  try { revalidateTag(CONTENT_TAG) } catch { /* outside request context */ }
  try { revalidatePath('/curs-yachting-cds') } catch { /* outside request context */ }
}

// --- token ---------------------------------------------------------------
// Selects ONLY `admin_token`, always fresh — never on the public render path.
export async function getAdminToken(): Promise<string | null> {
  const sb = cdsServiceClient()
  const { data } = await sb.from('cds_landing').select('admin_token').eq('id', 1).maybeSingle()
  return data?.admin_token ?? null
}

export async function verifyLandingToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 16) return false
  const current = await getAdminToken()
  if (!current) return false
  // constant-time-ish compare
  if (token.length !== current.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ current.charCodeAt(i)
  return diff === 0
}

export async function regenerateAdminToken(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const sb = cdsServiceClient()
  await sb.from('cds_landing').update({ admin_token: token }).eq('id', 1)
  return token
}

// --- admin cookie guard (reuses the /admin HMAC session) -----------------
export function isAdminRequest(): boolean {
  const c = cookies().get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminCookieToken(c)
}

// --- visit stats ---------------------------------------------------------
export async function trackVisit(): Promise<void> {
  const sb = cdsServiceClient()
  await sb.rpc('cds_track_visit')
}

export async function getVisitStats() {
  const sb = cdsServiceClient()
  const { data } = await sb
    .from('cds_visit_stats')
    .select('day, count')
    .order('day', { ascending: false })
  const rows = (data || []) as { day: string; count: number }[]
  const total = rows.reduce((a, r) => a + (r.count || 0), 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = rows.find((r) => r.day === todayStr)?.count || 0
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  const last7 = rows.filter((r) => r.day >= weekAgo).reduce((a, r) => a + (r.count || 0), 0)
  return { total, today, last7, daily: rows.slice(0, 14) }
}

// Editor access = valid landing token OR a logged-in /admin session
export async function isEditor(token: string | null | undefined): Promise<boolean> {
  if (isAdminRequest()) return true
  return verifyLandingToken(token)
}

// --- leads ---------------------------------------------------------------
export type Lead = {
  id: string
  created_at: string
  name: string | null
  email: string | null
  phone: string | null
  message: string | null
  source: string
  status: string
  notes: string | null
}

export async function listLeads(): Promise<Lead[]> {
  const sb = cdsServiceClient()
  const { data } = await sb.from('cds_leads').select('*').order('created_at', { ascending: false })
  return (data ?? []) as Lead[]
}

export async function insertLead(payload: { name?: string; email?: string; phone?: string; message?: string }) {
  const sb = cdsServiceClient()
  const { error } = await sb.from('cds_leads').insert({
    name: (payload.name || '').slice(0, 200) || null,
    email: (payload.email || '').slice(0, 200) || null,
    phone: (payload.phone || '').slice(0, 60) || null,
    message: (payload.message || '').slice(0, 2000) || null,
    source: 'landing-cds',
  })
  return { ok: !error, error: error?.message }
}

export async function updateLead(id: string, patch: { status?: string; notes?: string }) {
  const sb = cdsServiceClient()
  const upd: any = {}
  if (patch.status) upd.status = patch.status
  if (patch.notes !== undefined) upd.notes = patch.notes
  const { error } = await sb.from('cds_leads').update(upd).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function deleteLead(id: string) {
  const sb = cdsServiceClient()
  const { error } = await sb.from('cds_leads').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}
