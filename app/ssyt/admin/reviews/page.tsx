import Link from 'next/link'
import { MessageSquareQuote } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 0
export const dynamic = 'force-dynamic'

export default async function AdminReviewsPage() {
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: reviews } = await admin
    .from('ssyt_reviews')
    .select(`
      id, email, regattas_count, training_count, q_experienta, q_placut_schimbat, q_echipa, review_text, created_at, updated_at,
      participant:ssyt_participants(id, full_name)
    `)
    .order('updated_at', { ascending: false })

  const rows = (reviews || []).map((r: any) => ({
    ...r,
    participant: Array.isArray(r.participant) ? r.participant[0] : r.participant,
  }))

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>SSYT 2026</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <MessageSquareQuote size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Reviews
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {rows.length} {rows.length === 1 ? 'răspuns' : 'răspunsuri'} de la participanți ·
          formular public: <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/ssyt/review</code>
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <MessageSquareQuote size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun review încă.</p>
          <p className="text-xs text-gray-400 mt-1">Trimite participanților linkul <code>/ssyt/review</code> (își introduc emailul).</p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((r: any) => (
            <div key={r.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-2" style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <div className="font-semibold" style={{ color: '#0a1628' }}>
                  {r.participant ? (
                    <Link href={`/ssyt/admin/participants/${r.participant.id}`} className="hover:underline">{r.participant.full_name}</Link>
                  ) : r.email}
                  <span className="ml-2 text-xs font-normal text-gray-400">{r.email}</span>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.updated_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="p-5 space-y-3 text-sm">
                <Field label="Regate / Antrenamente" value={[r.regattas_count && `${r.regattas_count} regate`, r.training_count && `${r.training_count} antrenamente`].filter(Boolean).join(' · ') || null} />
                <Field label="Experiența generală" value={r.q_experienta} />
                <Field label="Ce i-a plăcut / ce ar schimba" value={r.q_placut_schimbat} />
                <Field label="Colaborarea în echipă" value={r.q_echipa} />
                {r.review_text && (
                  <div className="rounded-lg p-3 mt-1" style={{ background: 'rgba(255,107,53,0.06)', border: '1px solid rgba(255,107,53,0.2)' }}>
                    <div className="text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: '#FF6B35' }}>Review</div>
                    <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{r.review_text}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-0.5">{label}</div>
      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  )
}
