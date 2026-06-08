import { NextRequest, NextResponse } from 'next/server'
import { voucherToken, normalizeEmail, VOUCHER_AMOUNT_EUR } from '@/lib/voucher'
import { trackBancomat, logVoucher } from '@/lib/voucher-stats'

export const dynamic = 'force-dynamic'

// Endpoint PUBLIC — „bancomatul" de vouchere. Oricine introduce un email
// primește tokenul derivat (valabil doar pentru acel email la înscriere).
// Nu stochează nimic; tokenul se recalculează din email.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  // honeypot anti-bot: dacă e completat câmpul ascuns, ignorăm tăcut.
  if (typeof body?.website === 'string' && body.website.trim() !== '') {
    return NextResponse.json({ ok: false, error: 'Email invalid.' }, { status: 400 })
  }
  const email = normalizeEmail(body?.email || '')
  if (!email || email.indexOf('@') === -1 || email.indexOf('.') === -1) {
    return NextResponse.json({ ok: false, error: 'Introdu o adresă de email validă.' }, { status: 400 })
  }
  const token = voucherToken(email)
  // contor „coduri generate" (apăsare Enter) + log în lista de vouchere; best-effort.
  try { await trackBancomat('generate') } catch {}
  try { await logVoucher(email, token, VOUCHER_AMOUNT_EUR) } catch {}
  return NextResponse.json({ ok: true, email, token, amount: VOUCHER_AMOUNT_EUR })
}
