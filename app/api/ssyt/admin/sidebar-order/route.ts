import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: adminRow } = await supabase.from('ssyt_admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { season_id, order } = await req.json().catch(() => ({}))
  if (!season_id || !Array.isArray(order)) return NextResponse.json({ error: 'Parametri invalizi.' }, { status: 400 })

  const clean = order.filter((h) => typeof h === 'string')
  const { error } = await supabase.from('ssyt_seasons').update({ admin_sidebar_order: clean }).eq('id', season_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
