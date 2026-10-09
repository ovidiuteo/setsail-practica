import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Notele cursantului de la cursul B/A. Aceeași poartă ca la cererea de examen:
// cursantul trebuie să fie într-o serie cu codul de acces trimis.
//   GET  ?student_id=&access_code=        -> { note: { cheie: text } }
//   POST { student_id, access_code, cheie, text }

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

async function cursant(sb: ReturnType<typeof svc>, studentId: string, accessCode: string) {
  if (!studentId || !accessCode) return null
  const { data: st } = await sb.from('students')
    .select('id, sessions!session_id(access_code)').eq('id', studentId).maybeSingle()
  const cod = String((st as any)?.sessions?.access_code || '')
  if (!st || cod.toUpperCase() !== String(accessCode).toUpperCase()) return null
  return st as any
}

export async function GET(req: NextRequest) {
  const sb = svc()
  const sp = req.nextUrl.searchParams
  const st = await cursant(sb, sp.get('student_id') || '', sp.get('access_code') || '')
  if (!st) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { data } = await sb.from('curs_b_note').select('cheie, text').eq('student_id', st.id)
  const note: Record<string, string> = {}
  for (const n of (data || []) as any[]) note[n.cheie] = n.text || ''
  return NextResponse.json({ note })
}

export async function POST(req: NextRequest) {
  const sb = svc()
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Cerere invalidă' }, { status: 400 })
  const st = await cursant(sb, String(body.student_id || ''), String(body.access_code || ''))
  if (!st) return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const cheie = String(body.cheie || '').slice(0, 80)
  if (!cheie) return NextResponse.json({ error: 'lipsește subiectul' }, { status: 400 })
  const text = String(body.text ?? '').slice(0, 20000)

  const { error } = await sb.from('curs_b_note')
    .upsert({ student_id: st.id, cheie, text, updated_at: new Date().toISOString() }, { onConflict: 'student_id,cheie' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
