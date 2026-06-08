import { NextRequest, NextResponse } from 'next/server'
import { getRadioContent, saveRadioContent, isEditor } from '@/lib/radio-landing/server'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json({ content: await getRadioContent() })
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  if (!(await isEditor(body?.token))) {
    return NextResponse.json({ ok: false, error: 'Acces refuzat.' }, { status: 401 })
  }
  if (!body?.content || typeof body.content !== 'object') {
    return NextResponse.json({ ok: false, error: 'Conținut invalid.' }, { status: 400 })
  }
  await saveRadioContent(body.content)
  return NextResponse.json({ ok: true })
}
