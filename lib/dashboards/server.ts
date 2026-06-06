// ============================================================================
// Dashboards individuale — server-side data access (service role).
// Niciodata importat in client.
// Fiecare persoana (Corina, Paula, Ovidiu, Ruxi) are o pagina /dashboard/[slug]
// accesibila cu token regenerabil. Linkurile sunt configurate din /admin.
// Un link poate contine placeholder-ul {token}, inlocuit cu token-ul curent al
// dashboard-ului la randare (asa, regenerarea token-ului actualizeaza linkul).
// ============================================================================
import 'server-only'
import { cookies } from 'next/headers'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { verifyToken as verifyAdminCookieToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY
  || process.env.SUPABASE_SERVICE_KEY
  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type Dashboard = {
  id: string
  name: string
  slug: string
  token: string
  description: string | null
  created_at: string
  updated_at: string
}

export type DashboardLink = {
  id: string
  dashboard_id: string
  title: string
  description: string | null
  url: string
  icon: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export function dashboardsServiceClient(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Next.js intercepteaza fetch-ul supabase-js si cache-uieste raspunsul dupa URL.
    // Fortam no-store ca sa citim mereu date proaspete (altfel un query cachuit
    // poate intoarce date vechi dupa insert/update/reorder).
    global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

// --- admin cookie guard (reuses the /admin HMAC session) -----------------
export function isAdminRequest(): boolean {
  const c = cookies().get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminCookieToken(c)
}

function newToken(): string {
  return randomBytes(32).toString('hex')
}

// Inlocuieste {token} (si %7Btoken%7D) cu token-ul curent al dashboard-ului
export function resolveLinkUrl(url: string, token: string): string {
  return url.replace(/\{token\}/g, token).replace(/%7Btoken%7D/gi, token)
}

// --- dashboards ----------------------------------------------------------
export async function listDashboards(): Promise<Dashboard[]> {
  const sb = dashboardsServiceClient()
  const { data } = await sb.from('dashboards').select('*').order('name')
  return (data as Dashboard[]) ?? []
}

export async function getDashboardBySlug(slug: string): Promise<Dashboard | null> {
  const sb = dashboardsServiceClient()
  const { data } = await sb.from('dashboards').select('*').eq('slug', slug).maybeSingle()
  return (data as Dashboard) ?? null
}

export async function getDashboardById(id: string): Promise<Dashboard | null> {
  const sb = dashboardsServiceClient()
  const { data } = await sb.from('dashboards').select('*').eq('id', id).maybeSingle()
  return (data as Dashboard) ?? null
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'dashboard'
}

export async function createDashboard(name: string, description?: string | null): Promise<Dashboard | null> {
  const sb = dashboardsServiceClient()
  const base = slugify(name)
  // slug unic: incrementeaza sufix daca exista deja
  let slug = base
  for (let i = 2; i < 100; i++) {
    const { data: exists } = await sb.from('dashboards').select('id').eq('slug', slug).maybeSingle()
    if (!exists) break
    slug = `${base}-${i}`
  }
  const { data } = await sb.from('dashboards')
    .insert({ name, slug, token: newToken(), description: description ?? null })
    .select().single()
  return (data as Dashboard) ?? null
}

export async function updateDashboard(id: string, fields: { name?: string; description?: string | null }): Promise<Dashboard | null> {
  const sb = dashboardsServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.name !== undefined) patch.name = fields.name
  if (fields.description !== undefined) patch.description = fields.description
  const { data } = await sb.from('dashboards').update(patch).eq('id', id).select().single()
  return (data as Dashboard) ?? null
}

export async function deleteDashboard(id: string): Promise<boolean> {
  const sb = dashboardsServiceClient()
  const { error } = await sb.from('dashboards').delete().eq('id', id)
  return !error
}

export async function regenerateDashboardToken(id: string): Promise<string | null> {
  const sb = dashboardsServiceClient()
  const token = newToken()
  const { data } = await sb.from('dashboards')
    .update({ token, updated_at: new Date().toISOString() })
    .eq('id', id).select('token').single()
  return (data as { token: string } | null)?.token ?? null
}

export async function verifyDashboardToken(slug: string, token: string | null | undefined): Promise<Dashboard | null> {
  if (!token || typeof token !== 'string' || token.length < 16) return null
  const dash = await getDashboardBySlug(slug)
  if (!dash) return null
  const current = dash.token
  if (token.length !== current.length) return null
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ current.charCodeAt(i)
  return diff === 0 ? dash : null
}

// --- links ---------------------------------------------------------------
export async function listLinks(dashboardId: string): Promise<DashboardLink[]> {
  const sb = dashboardsServiceClient()
  const { data } = await sb.from('dashboard_links')
    .select('*').eq('dashboard_id', dashboardId)
    .order('sort_order').order('created_at')
  return (data as DashboardLink[]) ?? []
}

export async function addLink(dashboardId: string, fields: {
  title: string; url: string; description?: string | null; icon?: string | null
}): Promise<DashboardLink | null> {
  const sb = dashboardsServiceClient()
  // pune linkul la final
  const { data: last } = await sb.from('dashboard_links')
    .select('sort_order').eq('dashboard_id', dashboardId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1
  const { data } = await sb.from('dashboard_links').insert({
    dashboard_id: dashboardId,
    title: fields.title,
    url: fields.url,
    description: fields.description ?? null,
    icon: fields.icon ?? null,
    sort_order: nextOrder,
  }).select().single()
  return (data as DashboardLink) ?? null
}

export async function updateLink(linkId: string, fields: {
  title?: string; url?: string; description?: string | null; icon?: string | null
}): Promise<DashboardLink | null> {
  const sb = dashboardsServiceClient()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (fields.title !== undefined) patch.title = fields.title
  if (fields.url !== undefined) patch.url = fields.url
  if (fields.description !== undefined) patch.description = fields.description
  if (fields.icon !== undefined) patch.icon = fields.icon
  const { data } = await sb.from('dashboard_links').update(patch).eq('id', linkId).select().single()
  return (data as DashboardLink) ?? null
}

export async function deleteLink(linkId: string): Promise<boolean> {
  const sb = dashboardsServiceClient()
  const { error } = await sb.from('dashboard_links').delete().eq('id', linkId)
  return !error
}

// Reordoneaza: primeste lista de id-uri in noua ordine
export async function reorderLinks(dashboardId: string, orderedIds: string[]): Promise<boolean> {
  const sb = dashboardsServiceClient()
  const now = new Date().toISOString()
  const updates = orderedIds.map((id, idx) =>
    sb.from('dashboard_links').update({ sort_order: idx, updated_at: now })
      .eq('id', id).eq('dashboard_id', dashboardId),
  )
  const results = await Promise.all(updates)
  return results.every(r => !r.error)
}

// Importa linkuri dintr-un alt dashboard (copie) in dashboard-ul tinta.
// Linkurile cu {token} se vor randa cu token-ul propriu al fiecarui dashboard.
export async function importLinks(targetDashboardId: string, linkIds: string[]): Promise<DashboardLink[]> {
  if (linkIds.length === 0) return []
  const sb = dashboardsServiceClient()
  const { data: src } = await sb.from('dashboard_links').select('*').in('id', linkIds)
  const sources = (src as DashboardLink[]) ?? []
  if (sources.length === 0) return []

  const { data: last } = await sb.from('dashboard_links')
    .select('sort_order').eq('dashboard_id', targetDashboardId)
    .order('sort_order', { ascending: false }).limit(1).maybeSingle()
  let nextOrder = ((last as { sort_order: number } | null)?.sort_order ?? -1) + 1

  // pastreaza ordinea selectiei
  const byId = new Map(sources.map(s => [s.id, s]))
  const rows = linkIds.map(id => byId.get(id)).filter(Boolean).map(s => ({
    dashboard_id: targetDashboardId,
    title: s!.title,
    url: s!.url,
    description: s!.description,
    icon: s!.icon,
    sort_order: nextOrder++,
  }))
  const { data } = await sb.from('dashboard_links').insert(rows).select()
  return (data as DashboardLink[]) ?? []
}
