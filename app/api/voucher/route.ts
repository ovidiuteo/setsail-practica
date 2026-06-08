import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { voucherToken, normalizeEmail } from '@/lib/voucher'
import { getVoucherConfig } from '@/lib/voucher-config'

export const dynamic = 'force-dynamic'

// Generează tokenul de voucher pentru un email. Doar admin (cookie de sesiune).
export async function POST(req: NextRequest) {
  if (!verifyToken(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const body = await req.json().catch(() => ({}))
  const email = normalizeEmail(body?.email || '')
  if (!email || email.indexOf('@') === -1) {
    return NextResponse.json({ ok: false, error: 'Email invalid.' }, { status: 400 })
  }
  const amount = (await getVoucherConfig()).amount
  return NextResponse.json({ ok: true, email, token: voucherToken(email), amount })
}
