import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

async function requireAdmin(req: NextRequest, supabase: any): Promise<boolean> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return false
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return false
  const { data: adminRow } = await supabase.from('ssyt_admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  return !!adminRow
}

// PUT - editează o resursă de echipă (ssyt_team_boat_resources)
export async function PUT(req: NextRequest) {
  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id, title, description, url, resource_type, text_content } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })

  const updates: any = {}
  if (title !== undefined) updates.title = title
  if (description !== undefined) updates.description = description || null
  if (url !== undefined) updates.url = url || null
  if (resource_type !== undefined) updates.resource_type = resource_type || null
  if (text_content !== undefined) updates.text_content = text_content || null
  updates.updated_at = new Date().toISOString()

  const { error } = await supabase.from('ssyt_team_boat_resources').update(updates).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// DELETE - șterge o resursă de echipă
export async function DELETE(req: NextRequest) {
  const supabase = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
  if (!(await requireAdmin(req, supabase))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await req.json().catch(() => ({}))
  if (!id) return NextResponse.json({ error: 'id lipsă.' }, { status: 400 })

  const { error } = await supabase.from('ssyt_team_boat_resources').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
