import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'
import { syncSkipper, esteEroare } from '@/lib/skipper-sync'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// POST { session_id, dry_run? } — sincronizarea din pagina de admin a sesiunii.
// Logica e în lib/skipper-sync, comună cu pagina cu token (/api/roster).
export async function POST(req: NextRequest) {
  if (!verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value))
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  if (!body?.session_id) return NextResponse.json({ error: 'lipsește sesiunea' }, { status: 400 })

  const r = await syncSkipper(svc(), body.session_id, { dryRun: body.dry_run === true })
  if (esteEroare(r)) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json(r)
}
