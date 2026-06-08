// ============================================================================
// Configurare bancomat — valori personalizabile per program de vouchere.
// Defaults în cod, suprascrise de rândul din voucher_config (jsonb).
// ============================================================================
import 'server-only'
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type VoucherConfig = {
  amount: number        // valoarea afișată pe bancnotă
  cutoff: string        // 'YYYY-MM-DD' — din această dată bancomatul e OUT OF ORDER (și data de expirare)
  pageTitle: string
  pageSubtitle: string
  ctaLabel: string      // textul butonului „cheltuie"
  spendUrl: string      // unde duce butonul (ex: /curs-radio-gmdss-lrc)
  banknoteDesc: string  // descrierea de pe bancnotă (înainte de „X EUR · exp …")
  outOfOrderText: string
}

export const DEFAULT_VOUCHER_CONFIG: VoucherConfig = {
  amount: 20,
  cutoff: '2026-06-17',
  pageTitle: 'Bancomatul de vouchere',
  pageSubtitle: 'Introdu adresa ta de email și retrage un voucher de 20 EUR pentru cursul Radio GMDSS / LRC. (Un voucher/email/pers)',
  ctaLabel: 'Achită parțial cursul Radio',
  spendUrl: '/curs-radio-gmdss-lrc',
  banknoteDesc: 'Curs Radio GMDSS / LRC · reducere',
  outOfOrderText: 'Programul de vouchere s-a încheiat. Revenim cu un nou program — mulțumim!',
}

function sb(): SupabaseClient {
  return createClient(URL, SERVICE, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) },
  })
}

function merge(db: any): VoucherConfig {
  const o = (db && typeof db === 'object') ? db : {}
  const out: any = { ...DEFAULT_VOUCHER_CONFIG }
  for (const k of Object.keys(DEFAULT_VOUCHER_CONFIG)) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== '') out[k] = o[k]
  }
  out.amount = Number(out.amount) || DEFAULT_VOUCHER_CONFIG.amount
  return out as VoucherConfig
}

export async function getVoucherConfig(): Promise<VoucherConfig> {
  try {
    const { data } = await sb().from('voucher_config').select('config').eq('id', 1).maybeSingle()
    return merge(data?.config)
  } catch {
    return { ...DEFAULT_VOUCHER_CONFIG }
  }
}

// Sanitizează + salvează doar câmpurile cunoscute.
export async function saveVoucherConfig(patch: Partial<VoucherConfig>): Promise<{ ok: boolean; error?: string; config?: VoucherConfig }> {
  const clean: any = {}
  const str = (v: any, max: number) => (typeof v === 'string' ? v.slice(0, max) : undefined)
  if (patch.amount !== undefined) { const n = Math.round(Number(patch.amount)); if (Number.isFinite(n) && n >= 0 && n <= 100000) clean.amount = n }
  if (patch.cutoff !== undefined) { const s = str(patch.cutoff, 10); if (s === '' || /^\d{4}-\d{2}-\d{2}$/.test(s || '')) clean.cutoff = s }
  if (patch.pageTitle !== undefined) clean.pageTitle = str(patch.pageTitle, 120)
  if (patch.pageSubtitle !== undefined) clean.pageSubtitle = str(patch.pageSubtitle, 400)
  if (patch.ctaLabel !== undefined) clean.ctaLabel = str(patch.ctaLabel, 80)
  if (patch.spendUrl !== undefined) clean.spendUrl = str(patch.spendUrl, 300)
  if (patch.banknoteDesc !== undefined) clean.banknoteDesc = str(patch.banknoteDesc, 160)
  if (patch.outOfOrderText !== undefined) clean.outOfOrderText = str(patch.outOfOrderText, 300)

  const client = sb()
  const { data: cur } = await client.from('voucher_config').select('config').eq('id', 1).maybeSingle()
  const next = { ...(cur?.config || {}), ...clean }
  const { error } = await client.from('voucher_config').upsert({ id: 1, config: next, updated_at: new Date().toISOString() })
  if (error) return { ok: false, error: error.message }
  return { ok: true, config: merge(next) }
}

// '2026-06-17' -> '17.06.2026'
export function formatCutoff(cutoff: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(cutoff || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : cutoff
}

// Bancomatul e închis din ziua `cutoff` (ora locală RO, UTC+3 vara).
export function isClosed(cutoff: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cutoff || '')) return false
  const t = new Date(cutoff + 'T00:00:00+03:00').getTime()
  return Number.isFinite(t) && Date.now() >= t
}
