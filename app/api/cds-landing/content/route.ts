import { NextRequest, NextResponse } from 'next/server'
import { getLandingContent, saveLandingContent, isEditor } from '@/lib/cds-landing/server'

export const dynamic = 'force-dynamic'

// Public: read current content (no token, no secrets)
export async function GET() {
  const content = await getLandingContent()
  return NextResponse.json({ content })
}

// Editor: save full content document
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!(await isEditor(body?.token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  if (!body?.content || typeof body.content !== 'object') {
    return NextResponse.json({ ok: false, error: 'Conținut invalid.' }, { status: 400 })
  }
  await saveLandingContent(body.content)
  return NextResponse.json({ ok: true })
}
