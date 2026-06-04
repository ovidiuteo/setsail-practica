import { NextRequest, NextResponse } from 'next/server'
import { verifyLandingToken, isAdminRequest } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

// Gate for the editor page: is this token (or admin session) valid?
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  const valid = isAdminRequest() || (await verifyLandingToken(token))
  return NextResponse.json({ valid })
}
