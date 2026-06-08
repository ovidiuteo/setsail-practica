import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { getVoucherConfig, saveVoucherConfig } from '@/lib/voucher-config'

export const dynamic = 'force-dynamic'

function authed(): boolean {
  return verifyToken(cookies().get(ADMIN_COOKIE_NAME)?.value)
}

// Citește configurarea bancomatului (admin).
export async function GET() {
  if (!authed()) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({ ok: true, config: await getVoucherConfig() })
}

// Salvează configurarea bancomatului (admin).
export async function POST(req: NextRequest) {
  if (!authed()) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const res = await saveVoucherConfig(body || {})
  if (!res.ok) return NextResponse.json({ ok: false, error: res.error }, { status: 500 })
  return NextResponse.json({ ok: true, config: res.config })
}
