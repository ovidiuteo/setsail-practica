import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// GET ?token= — listă review-uri (read-only), validat cu review_view_token
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token') || ''
  if (!token) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })

  const sb = client()
  const { data: season } = await sb
    .from('ssyt_seasons')
    .select('id')
    .not('review_view_token', 'is', null)
    .eq('review_view_token', token)
    .maybeSingle()
  if (!season) return NextResponse.json({ error: 'Token invalid.' }, { status: 401 })

  const [{ data: reviews }, { data: questions }] = await Promise.all([
    sb.from('ssyt_reviews')
      .select('id, email, review_text, answers, created_at, updated_at, participant:ssyt_participants(full_name)')
      .order('updated_at', { ascending: false }),
    sb.from('ssyt_review_questions').select('id, label, section, follow_up, position').order('position').order('created_at'),
  ])

  const rows = (reviews || []).map((r: any) => ({
    ...r,
    participant_name: (Array.isArray(r.participant) ? r.participant[0] : r.participant)?.full_name || null,
    participant: undefined,
  }))

  return NextResponse.json({ reviews: rows, questions: questions || [] })
}
