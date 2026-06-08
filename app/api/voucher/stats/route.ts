import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { getBancomatStats, listVouchers } from '@/lib/voucher-stats'

export const dynamic = 'force-dynamic'

// Dashboard vouchere — doar admin (cookie de sesiune).
export async function GET() {
  if (!verifyToken(cookies().get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  const [bancomat, vouchers] = await Promise.all([getBancomatStats(), listVouchers()])
  return NextResponse.json({ ok: true, bancomat, vouchers })
}
