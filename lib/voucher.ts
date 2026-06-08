// ============================================================================
// Voucher token — cod determinist derivat din adresa de email (server-only).
// Tokenul NU se stochează: se recalculează din email și se compară.
// Valoarea (20 EUR) e fixă și e doar afișaj pe banknotă.
// ============================================================================
import 'server-only'
import { createHmac } from 'node:crypto'

const SECRET =
  process.env.VOUCHER_SECRET ||
  process.env.ADMIN_AUTH_SECRET ||
  'setsail-voucher-default-secret-change-me'

// Alfabet fără caractere ambigue (fără 0/O/1/I)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const VOUCHER_AMOUNT_EUR = 20

export function normalizeEmail(email: string | null | undefined): string {
  return (email || '').trim().toLowerCase()
}

// Păstrează doar A-Z și 0-9 (fără regex, ca să evităm probleme de build SWC).
function canon(s: string | null | undefined): string {
  const u = (s || '').toUpperCase()
  let out = ''
  for (let i = 0; i < u.length; i++) {
    const ch = u[i]
    if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9')) out += ch
  }
  return out
}

// Generează tokenul (ex: SS-AB7K-9MQ2) din email.
export function voucherToken(email: string | null | undefined): string {
  const norm = normalizeEmail(email)
  if (!norm || norm.indexOf('@') === -1) return ''
  const digest = createHmac('sha256', SECRET).update('voucher:' + norm).digest()
  let body = ''
  for (let i = 0; i < 8; i++) body += ALPHABET[digest[i] % ALPHABET.length]
  return 'SS-' + body.slice(0, 4) + '-' + body.slice(4, 8)
}

// Verifică dacă un cod introdus se potrivește cu emailul (tolerant la liniuțe/spații/caz).
export function verifyVoucher(
  email: string | null | undefined,
  code: string | null | undefined,
): boolean {
  if (!email || !code) return false
  const expected = canon(voucherToken(email))
  const given = canon(code)
  if (!expected || expected.length !== given.length) return false
  let diff = 0
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ given.charCodeAt(i)
  }
  return diff === 0
}
