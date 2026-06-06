import { NextResponse } from 'next/server'
import { trackVisit } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

// Public visit beacon — fired once per browser session from the landing page.
export async function POST() {
  try {
    await trackVisit()
  } catch {
    /* never block the page on a counter */
  }
  return NextResponse.json({ ok: true })
}
