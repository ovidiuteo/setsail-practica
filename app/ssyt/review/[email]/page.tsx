import Link from 'next/link'
import { getPortalSupabase } from '@/lib/ssyt/portal-session'
import ReviewForm from '@/components/ssyt/ReviewForm'

export const dynamic = 'force-dynamic'

export default async function ReviewPersonPage({ params }: { params: { email: string } }) {
  const email = decodeURIComponent(params.email).trim().toLowerCase()
  const supabase = getPortalSupabase()

  const { data: participant } = await supabase
    .from('ssyt_participants')
    .select('id, full_name, first_name')
    .ilike('email', email)
    .maybeSingle()

  if (!participant) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-2" style={{ color: '#0a1628' }}>Nu te-am găsit ⚓</h1>
        <p className="text-gray-600">Nu am găsit un participant cu adresa <strong>{email}</strong>.</p>
        <Link href="/ssyt/review" className="inline-block mt-4 text-sm font-medium" style={{ color: '#FF6B35' }}>
          ← Încearcă din nou cu altă adresă
        </Link>
      </div>
    )
  }

  const { data: existing } = await supabase
    .from('ssyt_reviews')
    .select('regattas_count, training_count, q_experienta, q_placut_schimbat, q_echipa, review_text')
    .ilike('email', email)
    .maybeSingle()

  const firstName = participant.first_name || participant.full_name?.split(' ')[0] || ''

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      {/* Mesaj de bun venit */}
      <div className="rounded-2xl p-6 md:p-8 mb-8 text-white" style={{ background: '#0a1628' }}>
        <p className="text-lg font-semibold mb-3">Ahoy, {firstName}, 👋</p>
        <p className="text-white/85 leading-relaxed">
          Mulțumim pentru participarea la <strong>SSYT 2026</strong> și pentru că ne acorzi timp să răspunzi
          la întrebări și să lași un review.
        </p>
        <p className="mt-3 font-medium" style={{ color: '#FF6B35' }}>Fair Winds Always! ⛵</p>
      </div>

      {existing && (
        <div className="rounded-lg p-3 mb-5 text-xs" style={{ background: 'rgba(16,185,129,0.08)', color: '#065F46' }}>
          Ai completat deja acest formular — poți actualiza răspunsurile de mai jos.
        </div>
      )}

      <ReviewForm email={email} initial={existing || undefined} />
    </div>
  )
}
