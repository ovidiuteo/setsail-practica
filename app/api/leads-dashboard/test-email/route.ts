import { NextRequest, NextResponse } from 'next/server'
import { getAllLeads, isDashboardEditor } from '@/lib/leads-dashboard/server'
import { sendLeadEmail, mailConfigured } from '@/lib/mail'

export const dynamic = 'force-dynamic'

// Diagnostic: send a test notification using the most recent real lead.
// Token-gated (dashboard token or admin session). Returns the exact Resend result.
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!(await isDashboardEditor(token))) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!mailConfigured()) {
    return NextResponse.json({ ok: false, error: 'RESEND_API_KEY nu e setat (sau deploy-ul nu l-a preluat încă).' })
  }

  const { cds, radio } = await getAllLeads()
  const all = [
    ...cds.map((l: any) => ({ kind: 'CDS' as const, l })),
    ...radio.map((l: any) => ({ kind: 'Radio GMDSS' as const, l })),
  ].sort((a, b) => new Date(b.l.created_at).getTime() - new Date(a.l.created_at).getTime())

  if (!all.length) {
    // no real lead yet — send a synthetic one
    const res = await sendLeadEmail('CDS', { name: 'TEST notificare', phone: '0700000000', message: 'Email de test (nu există încă lead-uri reale).' })
    return NextResponse.json({ ...res, used: 'synthetic' })
  }

  const { kind, l } = all[0]
  const res = await sendLeadEmail(kind, {
    name: l.name, email: l.email, phone: l.phone, message: l.message,
    leadType: l.lead_type, voucher: l.voucher_code,
  })
  return NextResponse.json({ ...res, used: `ultimul lead (${kind})`, lead_name: l.name, created_at: l.created_at })
}
