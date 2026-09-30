import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function client() {
  return createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } })
}

// POST public - trimite/actualizează review-ul (matched pe email participant)
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const email = (body.email || '').trim().toLowerCase()
  if (!email) return NextResponse.json({ error: 'Lipsește emailul.' }, { status: 400 })

  const supabase = client()
  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select('id, full_name')
    .ilike('email', email)
    .maybeSingle()
  if (!participant) return NextResponse.json({ error: 'Nu am găsit un participant cu acest email.' }, { status: 404 })

  // answers: map question_id -> răspuns (limitat)
  let answers: Record<string, string> | null = null
  if (body.answers && typeof body.answers === 'object') {
    answers = {}
    for (const [k, v] of Object.entries(body.answers)) {
      if (v == null || v === '') continue
      answers[k] = v.toString().slice(0, 5000)
    }
    if (Object.keys(answers).length === 0) answers = null
  }

  const payload = {
    participant_id: participant.id,
    email,
    regattas_count: (body.regattas_count || '').toString().slice(0, 500) || null,
    training_count: (body.training_count || '').toString().slice(0, 500) || null,
    review_text: (body.review_text || '').toString().slice(0, 8000) || null,
    answers,
    updated_at: new Date().toISOString(),
  }

  // Un review per email — actualizează dacă există deja
  const { data: existing } = await supabase.from('ssyt_reviews').select('id').ilike('email', email).maybeSingle()
  if (existing) {
    const { error } = await supabase.from('ssyt_reviews').update(payload).eq('id', existing.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('ssyt_reviews').insert(payload)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
