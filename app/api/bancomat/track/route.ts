import { NextRequest, NextResponse } from 'next/server'
import { trackBancomat, markCashed, type BancomatKind } from '@/lib/voucher-stats'

export const dynamic = 'force-dynamic'

const ALLOWED: BancomatKind[] = ['visit', 'cashout']

// Tracking public pentru bancomat: vizite și apăsări de Cashout Credit.
// (codurile generate se contorizează server-side în /api/voucher/public)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const kind = body?.kind as BancomatKind
  if (!ALLOWED.includes(kind)) return NextResponse.json({ ok: false }, { status: 400 })
  try {
    await trackBancomat(kind)
    if (kind === 'cashout' && typeof body?.email === 'string' && body.email.indexOf('@') !== -1) {
      await markCashed(body.email.trim().toLowerCase())
    }
  } catch {}
  return NextResponse.json({ ok: true })
}
