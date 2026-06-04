// ============================================================================
// Acte contabile — server-side data access (service role). Never import in client.
// Doua entitati: SSA (Set Sail Advertising) si SSY (Set Sail Yachting).
// Acces prin token regenerabil (distribuit contabilului) SAU sesiune /admin.
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

export const ACTE_BUCKET = 'acte-contabile'
export const SIGNED_URL_TTL = 60 * 60 // 1h

export type Entity = 'ssa' | 'ssy'

export const ENTITIES: Record<Entity, { label: string; full: string }> = {
  ssa: { label: 'SSA', full: 'Set Sail Advertising' },
  ssy: { label: 'SSY', full: 'Set Sail Yachting' },
}

export function isEntity(v: unknown): v is Entity {
  return v === 'ssa' || v === 'ssy'
}

export function acteServiceClient(): SupabaseClient {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// --- token ---------------------------------------------------------------
export async function getEntityToken(entity: Entity): Promise<string | null> {
  const sb = acteServiceClient()
  const { data } = await sb.from('acte_contabile_tokens').select('token').eq('entity', entity).maybeSingle()
  return data?.token ?? null
}

export async function verifyEntityToken(entity: Entity, token: string | null | undefined): Promise<boolean> {
  if (!token || typeof token !== 'string' || token.length < 16) return false
  const current = await getEntityToken(entity)
  if (!current) return false
  if (token.length !== current.length) return false
  let diff = 0
  for (let i = 0; i < token.length; i++) diff |= token.charCodeAt(i) ^ current.charCodeAt(i)
  return diff === 0
}

export async function regenerateEntityToken(entity: Entity): Promise<string> {
  const token = randomBytes(32).toString('hex')
  const sb = acteServiceClient()
  await sb.from('acte_contabile_tokens')
    .upsert({ entity, token, updated_at: new Date().toISOString() }, { onConflict: 'entity' })
  return token
}

// --- admin cookie guard (reuses the /admin HMAC session) -----------------
export function isAdminRequest(): boolean {
  const c = cookies().get(ADMIN_COOKIE_NAME)?.value
  return verifyAdminCookieToken(c)
}

// Acces = sesiune admin SAU token valid pentru entitatea ceruta
export async function canAccess(entity: Entity, token: string | null | undefined): Promise<boolean> {
  if (isAdminRequest()) return true
  return verifyEntityToken(entity, token)
}

// --- documente -----------------------------------------------------------
export type ActDoc = {
  id: string
  entity: Entity
  categorie: string
  nume: string | null
  data_doc: string | null
  file_path: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  note: string | null
  created_at: string
}

export type ActDocWithUrl = ActDoc & { url: string | null }

export async function listDocs(entity: Entity): Promise<ActDocWithUrl[]> {
  const sb = acteServiceClient()
  const { data } = await sb.from('acte_contabile_documente')
    .select('*')
    .eq('entity', entity)
    .order('created_at', { ascending: false })
  const docs = (data ?? []) as ActDoc[]
  if (docs.length === 0) return []

  // URL-uri semnate in bulk
  const paths = docs.map(d => d.file_path)
  const { data: signed } = await sb.storage.from(ACTE_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL)
  const urlByPath = new Map<string, string>()
  signed?.forEach(s => { if (s.path && s.signedUrl) urlByPath.set(s.path, s.signedUrl) })

  return docs.map(d => ({ ...d, url: urlByPath.get(d.file_path) ?? null }))
}

export async function insertDoc(doc: {
  entity: Entity
  categorie: string
  nume: string | null
  data_doc: string | null
  file_path: string
  file_name: string | null
  file_type: string | null
  file_size: number | null
  note: string | null
}): Promise<ActDoc | null> {
  const sb = acteServiceClient()
  const { data } = await sb.from('acte_contabile_documente').insert(doc).select().single()
  return (data as ActDoc) ?? null
}

export async function deleteDoc(entity: Entity, id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = acteServiceClient()
  const { data: row } = await sb.from('acte_contabile_documente')
    .select('file_path')
    .eq('id', id).eq('entity', entity)
    .maybeSingle()
  if (!row) return { ok: false, error: 'Document inexistent.' }

  await sb.storage.from(ACTE_BUCKET).remove([(row as { file_path: string }).file_path])
  const { error } = await sb.from('acte_contabile_documente').delete().eq('id', id).eq('entity', entity)
  return { ok: !error, error: error?.message }
}
