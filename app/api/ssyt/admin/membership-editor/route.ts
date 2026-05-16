import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Toggle flag is_editor pe un membership de team (admin-only)
export async function POST(req: NextRequest) {
  const { membership_id, is_editor } = await req.json()
  if (!membership_id || typeof is_editor !== 'boolean') {
    return NextResponse.json({ error: 'Parametri invalizi' }, { status: 400 })
  }

  // Verific token admin Supabase Auth
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token)
  if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminRow } = await supabase.from('ssyt_admin_users').select('level').eq('user_id', user.id).maybeSingle()
  if (!adminRow) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Update
  const { error } = await supabase
    .from('ssyt_team_memberships')
    .update({ is_editor })
    .eq('id', membership_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, is_editor })
}
