// ============================================================================
// CDS Landing — server-side data access (service role). Never import in client.
// ============================================================================
import 'server-only'
import { cookies } from 'next/headers'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { mergeContent, type LandingContent } from './content'
import { verifyToken as verifyAdminCookieToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const CDS_BUCKET = 'cds-landing'

export function cdsServiceClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// --- content -------------------------------------------------------------
async function getRow() {
  const sb = cdsServiceClient()
  const { data } = await sb.from('cds_landing').select('content, admin_token, updated_at').eq('id', 1).maybeSingle()
  return data
}

export async function getLandingContent(): Promise<LandingContent> {
  const row = await getRow()
  return mergeContent(row?.content)
}

export async function saveLandingContent(content: any): Promise<void> {
  const sb = cdsServiceClient()
  await sb.from('cds_landing').update({ content, updated_at: new Date().toISOString() }).eq('id', 1)
}

// --- token ---------------------------------------------------------------
export async function getAdminToken(): Promise<string | null> {
  const row = await getRow()
  return row?.admin_token ?? null
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
