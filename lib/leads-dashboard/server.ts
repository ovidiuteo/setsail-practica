// ============================================================================
// Unified leads dashboard — server-side access (service role). Never client.
// Aggregates CDS leads + Radio leads + newsletter subscribers, gated by a token.
// ============================================================================
import 'server-only'
import { cookies } from 'next/headers'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { verifyToken as verifyAdminCookieToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function sb(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (i: any, init?: any) => fetch(i, { ...init, cache: 'no-store' }) },
  })
}

export function isAdminRequest(): boolean {
  return verifyAdminCookieToken(cookies().get(ADMIN_COOKIE_NAME)?.value)
}

// --- token ---------------------------------------------------------------
export async function getDashboardToken(): Promise<string | null> {
  const { data } = await sb().from('leads_dashboard').select('admin_token').eq('id', 1).maybeSingle()
  return data?.admin_token ?? null
}

export async function verifyDashboardToken(token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 16) return false
  const cur = await getDashboardToken()
  if (!cur || token.length !== cur.length) return false
  let d = 0
  for (let i = 0; i < token.length; i++) d |= token.charCodeAt(i) ^ cur.charCodeAt(i)
  return d === 0
}

export async function isDashboardEditor(token: string | null | undefined): Promise<boolean> {
  if (isAdminRequest()) return true
  return verifyDashboardToken(token)
}

export async function regenerateDashboardToken(): Promise<string> {
  const t = randomBytes(32).toString('hex')
  await sb().from('leads_dashboard').update({ admin_token: t }).eq('id', 1)
  return t
}

// --- data ----------------------------------------------------------------
export async function getAllLeads() {
  const c = sb()
  const [cds, radio, news] = await Promise.all([
    c.from('cds_leads').select('*').order('created_at', { ascending: false }),
    c.from('radio_leads').select('*').order('created_at', { ascending: false }),
    c.from('newsletter_subscribers').select('*').order('created_at', { ascending: false }),
  ])
  return {
    cds: cds.data ?? [],
    radio: radio.data ?? [],
    newsletter: news.data ?? [],
  }
}

const TABLE: Record<string, string> = {
  cds: 'cds_leads',
  radio: 'radio_leads',
  newsletter: 'newsletter_subscribers',
}

export async function updateLeadRow(kind: string, id: string, patch: { status?: string; notes?: string }) {
  const table = TABLE[kind]
  if (!table || table === 'newsletter_subscribers') return { ok: false, error: 'Operație invalidă.' }
  if (!id) return { ok: false, error: 'id lipsă' }
  const upd: any = {}
  if (patch.status) upd.status = patch.status
  if (patch.notes !== undefined) upd.notes = patch.notes
  if (!Object.keys(upd).length) return { ok: true }
  const { error } = await sb().from(table).update(upd).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function deleteLeadRow(kind: string, id: string) {
  const table = TABLE[kind]
  if (!table) return { ok: false, error: 'kind invalid' }
  if (!id) return { ok: false, error: 'id lipsă' }
  const { error } = await sb().from(table).delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

// --- visit stats (per landing) -------------------------------------------
async function statsFor(table: string) {
  const { data } = await sb().from(table).select('day, count').order('day', { ascending: false })
  const rows = (data || []) as { day: string; count: number }[]
  const total = rows.reduce((a, r) => a + (r.count || 0), 0)
  const todayStr = new Date().toISOString().slice(0, 10)
  const today = rows.find((r) => r.day === todayStr)?.count || 0
  const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
  const last7 = rows.filter((r) => r.day >= weekAgo).reduce((a, r) => a + (r.count || 0), 0)
  return { total, today, last7 }
}

export async function getVisits() {
  const [cds, radio] = await Promise.all([statsFor('cds_visit_stats'), statsFor('radio_visit_stats')])
  return { cds, radio }
}

export async function insertNewsletter(email: string, source?: string) {
  const e = (email || '').trim().toLowerCase()
  if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return { ok: false, error: 'Email invalid.' }
  const { error } = await sb()
    .from('newsletter_subscribers')
    .insert({ email: e.slice(0, 200), source: (source || 'newsletter').slice(0, 40) })
  // already subscribed → unique violation, treat as success
  if (error && !/duplicate|unique/i.test(error.message)) return { ok: false, error: error.message }
  return { ok: true }
}
