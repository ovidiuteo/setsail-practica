import { NextRequest, NextResponse } from 'next/server'
import { insertNewsletter } from '@/lib/leads-dashboard/server'

export const dynamic = 'force-dynamic'

// Public newsletter signup (from landing footers).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (body?.website) return NextResponse.json({ ok: true }) // honeypot
  const res = await insertNewsletter(body?.email, body?.source)
  if (!res.ok) return NextResponse.json(res, { status: 400 })
  return NextResponse.json({ ok: true })
}
