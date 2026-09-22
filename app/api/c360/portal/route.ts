import { NextRequest, NextResponse } from 'next/server'
import { svc360, seedDupaCod, incarca360 } from '@/lib/c360'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Portal 360 — intrarea permanentă a cursantului: codul seriei + emailul.
//   POST { cod, email } -> Cursant360 (fără notițe interne, CNP/CI mascate)

export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => ({}))
  const cod = String(b.cod ?? '').slice(0, 40)
  const email = String(b.email ?? '').slice(0, 200)
  if (!cod.trim() || !email.trim()) return NextResponse.json({ error: 'Introdu codul seriei și emailul.' }, { status: 400 })
  const sb = svc360()
  const seed = await seedDupaCod(sb, cod, email)
  if (!seed) return NextResponse.json({ error: 'Nu am găsit un cursant cu acest cod și email.' }, { status: 404 })
  const data = await incarca360(sb, seed, { admin: false })
  return NextResponse.json(data)
}
