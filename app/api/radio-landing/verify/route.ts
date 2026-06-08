import { NextRequest, NextResponse } from 'next/server'
import { verifyRadioToken, isAdminRequest } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  return NextResponse.json({ valid: isAdminRequest() || (await verifyRadioToken(token)) })
}
