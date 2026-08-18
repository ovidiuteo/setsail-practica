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
import { verifyVoucher } from '@/lib/voucher'
import { scopeForSession } from '@/lib/timeline-scope'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
// pe Vercel cheia e SUPABASE_SERVICE_ROLE_KEY, local e SUPABASE_SERVICE_KEY
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
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
  voucher_code: string | null; voucher_valid: boolean
  participare_session_id: string | null
}
export async function listLeads(): Promise<Lead[]> {
  const sb = radioServiceClient()
  const { data } = await sb.from('radio_leads').select('*').order('created_at', { ascending: false })
  const rows = (data ?? []) as any[]
  return rows.map((l) => ({ ...l, voucher_valid: verifyVoucher(l.email, l.voucher_code) })) as Lead[]
}
export async function insertLead(p: { name?: string; email?: string; phone?: string; message?: string; leadType?: string; voucherCode?: string }) {
  const sb = radioServiceClient()
  const { error } = await sb.from('radio_leads').insert({
    name: (p.name || '').slice(0, 200) || null,
    email: (p.email || '').slice(0, 200) || null,
    phone: (p.phone || '').slice(0, 60) || null,
    message: (p.message || '').slice(0, 2000) || null,
    lead_type: (p.leadType || '').slice(0, 40) || null,
    voucher_code: (p.voucherCode || '').slice(0, 40).toUpperCase() || null,
    source: 'landing-radio',
  })
  return { ok: !error, error: error?.message }
}
export async function updateLead(id: string, patch: { status?: string; notes?: string; participareSessionId?: string | null }) {
  const sb = radioServiceClient()
  const upd: any = {}
  if (patch.status) upd.status = patch.status
  if (patch.notes !== undefined) upd.notes = patch.notes
  if (patch.participareSessionId !== undefined) upd.participare_session_id = patch.participareSessionId || null
  const { error } = await sb.from('radio_leads').update(upd).eq('id', id)
  return { ok: !error, error: error?.message }
}

// Seriile de radio pentru dropdownul „Participare”, în ordinea cerută:
// întâi seria care urmează, apoi cele trecute (cea mai recentă prima),
// apoi eventualele serii de după cea următoare.
export type RadioSessionOption = {
  id: string; label: string; session_date: string | null; course_start_date: string | null; group: 'next' | 'past' | 'future'
}
export async function listRadioSessions(): Promise<RadioSessionOption[]> {
  const sb = radioServiceClient()
  const { data } = await sb.from('sessions')
    .select('id, class_caa, session_date, course_start_date, status, timeline_scope, session_type, is_clone, locations(name)')
    .order('session_date', { ascending: true })

  const today = new Date()
  const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const radio = (data || []).filter((s: any) =>
    scopeForSession(s) === 'radio_lrc' && s.session_type === 'principal' && !s.is_clone)

  const startOf = (s: any) => String(s.course_start_date || s.session_date || '').slice(0, 10)
  const upcoming = radio.filter((s: any) => startOf(s) > iso)          // nu au început încă
  const past = radio.filter((s: any) => startOf(s) <= iso).reverse()   // cea mai recentă prima

  const label = (s: any) => {
    const end = s.session_date ? new Date(s.session_date) : null
    const d = end ? end.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
    const loc = (s.locations as any)?.name
    return `${(s.class_caa || 'Radio').trim()} · ${d}${loc ? ` · ${loc}` : ''}`
  }
  const map = (s: any, group: RadioSessionOption['group']) => ({
    id: s.id, label: label(s), session_date: s.session_date, course_start_date: s.course_start_date, group,
  })

  return [
    ...upcoming.slice(0, 1).map((s: any) => map(s, 'next')),
    ...past.map((s: any) => map(s, 'past')),
    ...upcoming.slice(1).map((s: any) => map(s, 'future')),
  ]
}
export async function deleteLead(id: string) {
  const sb = radioServiceClient()
  const { error } = await sb.from('radio_leads').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}
