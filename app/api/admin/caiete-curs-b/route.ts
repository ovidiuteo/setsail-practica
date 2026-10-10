import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Caietele de lucru de la cursul B/A, pentru admin: ce a scris fiecare cursant
// la fiecare subiect.
//   GET ?session_id=   -> { cursanti: [{id, full_name, class_caa, serie}], note: { student_id: { cheie: text } } }

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

export async function GET(req: NextRequest) {
  if (!verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const sessionId = req.nextUrl.searchParams.get('session_id') || ''
  if (!sessionId) return NextResponse.json({ error: 'lipsește seria' }, { status: 400 })

  const sb = svc()

  // Toată familia seriei: principala + clonele + absenții, ca să nu pierd cursanți
  const { data: sess } = await sb.from('sessions')
    .select('id, parent_session_id, session_date, session_type, class_caa')
    .eq('id', sessionId).maybeSingle()
  if (!sess) return NextResponse.json({ error: 'seria nu există' }, { status: 404 })
  const principalId = (sess as any).parent_session_id || sessionId
  const { data: rude } = await sb.from('sessions')
    .select('id, session_type, class_caa').eq('parent_session_id', principalId)
  const grupe = [principalId, ...((rude || []) as any[]).map(r => r.id)]
  const tipuri: Record<string, string> = { [principalId]: 'principal' }
  for (const r of (rude || []) as any[]) tipuri[r.id] = r.session_type || ''

  const { data: sts } = await sb.from('students')
    .select('id, full_name, class_caa, session_id, only_sailing')
    .in('session_id', grupe)
    .order('full_name')

  const cursanti = ((sts || []) as any[])
    .filter(s => !s.only_sailing)
    .map(s => ({
      id: s.id,
      full_name: s.full_name || '',
      class_caa: s.class_caa || '',
      grupa: tipuri[s.session_id] || '',
    }))

  const note: Record<string, Record<string, string>> = {}
  if (cursanti.length) {
    const { data: nt } = await sb.from('curs_b_note')
      .select('student_id, cheie, text, updated_at')
      .in('student_id', cursanti.map(c => c.id))
    for (const n of (nt || []) as any[]) {
      if (!note[n.student_id]) note[n.student_id] = {}
      note[n.student_id][n.cheie] = n.text || ''
    }
  }

  return NextResponse.json({ cursanti, note })
}
