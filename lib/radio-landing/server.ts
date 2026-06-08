// ============================================================================
// Radio GMDSS/LRC Landing — server-side data access (service role).
// ============================================================================
import 'server-only'
import { cookies } from 'next/headers'
import { revalidatePath, revalidateTag } from 'next/cache'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { mergeContent, type RadioContent } from './content'
import { verifyToken as verifyAdminCookieToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const CONTENT_TAG = 'radio-landing-content'
export const RADIO_PATH = '/curs-radio-gmdss-lrc'

export function radioServiceClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}
function radioCachedClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input: any, init?: any) => {
        const { cache, ...rest } = init || {}
        void cache
        return fetch(input, { ...rest, next: { revalidate: 300, tags: [CONTENT_TAG] } })
      },
    },
  })
}

// --- content -------------------------------------------------------------
export async function getRadioContentCached(): Promise<RadioContent> {
  const sb = radioCachedClient()
  const { data } = await sb.from('radio_landing').select('content').eq('id', 1).maybeSingle()
  return mergeContent(data?.content)
}
export async function getRadioContent(): Promise<RadioContent> {
  const sb = radioServiceClient()
  const { data } = await sb.from('radio_landing').select('content').eq('id', 1).maybeSingle()
  return mergeContent(data?.content)
}
export async function saveRadioContent(content: any): Promise<void> {
  const sb = radioServiceClient()
  await sb.from('radio_landing').update({ content, updated_at: new Date().toISOString() }).eq('id', 1)
  try { revalidateTag(CONTENT_TAG) } catch {}
  try { revalidatePath(RADIO_PATH) } catch {}
}

// --- token ---------------------------------------------------------------
export async function getAdminToken(): Promise<string | null> {
  const sb = radioServiceClient()
  const { data } = await sb.from('radio_landing').select('admin_token').eq('id', 1).maybeSingle()
  return data?.admin_token ?? null
}
export async function verifyRadioToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 16) return false
  const current = await getAdminToken()
  if (!current || token.length !== current.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ current.charCodeAt(i)
  return diff === 0
}
export async function regenerateAdminToken(): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const sb = radioServiceClient()
  await sb.from('radio_landing').update({ admin_token: token }).eq('id', 1)
  return token
}

export function isAdminRequest(): boolean {
  return verifyAdminCookieToken(cookies().get(ADMIN_COOKIE_NAME)?.value)
}
export async function isEditor(token: string | null | undefined): Promise<boolean> {
  if (isAdminRequest()) return true
  return verifyRadioToken(token)
}

// --- visits --------------------------------------------------------------
export async function trackVisit(): Promise<void> {
  const sb = radioServiceClient()
  await sb.rpc('radio_track_visit')
}
export async function getVisitStats() {
  const sb = radioServiceClient()
  const { data } = await sb.from('radio_visit_stats').select('day, count').order('day', { ascending: false })
  const rows = (data || []) as { day: string; count: number }[]
  const total = rows.reduce((a, r) => a + (r.count || 0), 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = rows.find((r) => r.day === todayStr)?.count || 0
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  const last7 = rows.filter((r) => r.day >= weekAgo).reduce((a, r) => a + (r.count || 0), 0)
  return { total, today, last7 }
}

// --- leads ---------------------------------------------------------------
export type Lead = {
  id: string; created_at: string; name: string | null; email: string | null
  phone: string | null; message: string | null; source: string; status: string; notes: string | null
}
export async function listLeads(): Promise<Lead[]> {
  const sb = radioServiceClient()
  const { data } = await sb.from('radio_leads').select('*').order('created_at', { ascending: false })
  return (data ?? []) as Lead[]
}
export async function insertLead(p: { name?: string; email?: string; phone?: string; message?: string }) {
  const sb = radioServiceClient()
  const { error } = await sb.from('radio_leads').insert({
    name: (p.name || '').slice(0, 200) || null,
    email: (p.email || '').slice(0, 200) || null,
    phone: (p.phone || '').slice(0, 60) || null,
    message: (p.message || '').slice(0, 2000) || null,
    source: 'landing-radio',
  })
  return { ok: !error, error: error?.message }
}
export async function updateLead(id: string, patch: { status?: string; notes?: string }) {
  const sb = radioServiceClient()
  const upd: any = {}
  if (patch.status) upd.status = patch.status
  if (patch.notes !== undefined) upd.notes = patch.notes
  const { error } = await sb.from('radio_leads').update(upd).eq('id', id)
  return { ok: !error, error: error?.message }
}
export async function deleteLead(id: string) {
  const sb = radioServiceClient()
  const { error } = await sb.from('radio_leads').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}
