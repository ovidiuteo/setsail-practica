// ============================================================================
// Bancomat — contoare (vizite / coduri generate / cashout) + log vouchere.
// Acces doar prin service role (RLS activ, fără policy-uri publice).
// ============================================================================
import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type BancomatKind = 'visit' | 'generate' | 'cashout'

function sb(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

export async function trackBancomat(kind: BancomatKind): Promise<void> {
  await sb().rpc('bancomat_track', { p_kind: kind })
}

// Un rând per email (tokenul e determinist); păstrează primul created_at.
export async function logVoucher(email: string, token: string, amount: number): Promise<void> {
  await sb().from('voucher_log').upsert(
    { email, token, amount },
    { onConflict: 'email', ignoreDuplicates: true },
  )
}

export async function markCashed(email: string): Promise<void> {
  await sb().from('voucher_log').update({ cashed: true, cashed_at: new Date().toISOString() }).eq('email', email)
}

export async function getBancomatStats(): Promise<{ visit: number; generate: number; cashout: number }> {
  const { data } = await sb().from('bancomat_stats').select('kind, count')
  const rows = (data || []) as { kind: string; count: number }[]
  const sum = (k: string) => rows.filter((r) => r.kind === k).reduce((a, r) => a + (r.count || 0), 0)
  return { visit: sum('visit'), generate: sum('generate'), cashout: sum('cashout') }
}

export type VoucherRow = {
  email: string; token: string; amount: number
  cashed: boolean; created_at: string; cashed_at: string | null
}
export async function listVouchers(): Promise<VoucherRow[]> {
  const { data } = await sb()
    .from('voucher_log')
    .select('email, token, amount, cashed, created_at, cashed_at')
    .order('created_at', { ascending: false })
  return (data || []) as VoucherRow[]
}
