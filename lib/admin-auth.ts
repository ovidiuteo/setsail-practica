import { createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE_NAME = 'admin-session'
const MAX_AGE_SEC = 60 * 60 * 24 * 30 // 30 zile

function secret(): string {
  const s = process.env.ADMIN_AUTH_SECRET
  if (!s || s.length < 16) {
    throw new Error('ADMIN_AUTH_SECRET missing or too short (need ≥16 chars)')
  }
  return s
}

function hmac(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('hex')
}

export function makeToken(): string {
  const ts = Date.now().toString()
  return `${ts}.${hmac(ts)}`
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false
  const [ts, sig] = token.split('.')
  if (!ts || !sig) return false

  const age = Date.now() - parseInt(ts, 10)
  if (isNaN(age) || age < 0 || age > MAX_AGE_SEC * 1000) return false

  const expected = hmac(ts)
  const a = Buffer.from(sig, 'hex')
  const b = Buffer.from(expected, 'hex')
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD
  if (!expected) return false
  const a = Buffer.from(input)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME
export const ADMIN_COOKIE_MAX_AGE = MAX_AGE_SEC
