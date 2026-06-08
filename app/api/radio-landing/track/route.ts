import { NextResponse } from 'next/server'
import { trackVisit } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function POST() {
  try { await trackVisit() } catch {}
  return NextResponse.json({ ok: true })
}
