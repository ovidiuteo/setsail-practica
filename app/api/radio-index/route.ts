import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { scopeForSession } from '@/lib/timeline-scope'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Indexul seriilor de radio: o singură pagină cu token, de unde se intră în listele
// de cursanți. Tokenul e unul singur (în setsail_info) și nu expiră la adăugarea
// unei serii noi — seriile noi apar automat aici.

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // fără no-store, Next servea din cache lista veche și regenera tokenul la fiecare cerere
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } }
  )
}

const TOKEN_KEY = 'radio_index_token'
// Seriile trecute nu se mai deschid — arătăm doar ce e în lucru
const LIVE = ['draft', 'active', 'focus']

function newToken(): string {
  const b = new Uint8Array(12)
  crypto.getRandomValues(b)
  return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('')
}

export async function GET(req: NextRequest) {
  const sb = svc()
  const token = (req.nextUrl.searchParams.get('token') || '').trim()
  const { data: setting } = await sb.from('setsail_info').select('value').eq('key', TOKEN_KEY).maybeSingle()
  if (!token || !setting?.value || String(setting.value) !== token)
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  // Seriile încheiate nu mai apar: nici cele marcate „Finalizată", nici cele cu
  // examenul deja trecut (o ciornă veche rămasă nemarcată e tot o serie încheiată).
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const { data, error } = await sb.from('sessions')
    .select('id, class_caa, session_date, course_start_date, status, timeline_scope, is_clone, roster_token, locations(name)')
    .in('status', LIVE)
    .gte('session_date', todayIso)
    .order('session_date', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Doar seriile de radio, fără clone (clonele nu au listă proprie de cursanți)
  const radio = (data || []).filter((s: any) => scopeForSession(s) === 'radio_lrc' && !s.is_clone)

  // Seriile noi n-au încă token de listă — îl generăm acum, ca linkul să meargă din prima
  for (const s of radio as any[]) {
    if (!s.roster_token) {
      const t = newToken()
      const { error: e } = await sb.from('sessions').update({ roster_token: t }).eq('id', s.id)
      if (!e) s.roster_token = t
    }
  }

  // Câți cursanți are fiecare serie (interogări de id-uri, fără coloanele base64)
  const counts = await Promise.all((radio as any[]).map(async s => {
    const { data: ids } = await sb.from('students').select('id').eq('session_id', s.id)
    return [s.id, (ids || []).length] as [string, number]
  }))
  const countBy = new Map(counts)

  return NextResponse.json({
    sessions: (radio as any[]).map(s => ({
      id: s.id,
      class_caa: s.class_caa,
      session_date: s.session_date,
      course_start_date: s.course_start_date,
      status: s.status,
      location: (s.locations as any)?.name || null,
      roster_token: s.roster_token,
      students: countBy.get(s.id) ?? 0,
    })),
  })
}
