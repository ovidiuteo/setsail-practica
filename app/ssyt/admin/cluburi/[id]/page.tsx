import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Shield } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ClubEditor from './ClubEditor'

export const revalidate = 0

export default async function AdminClubDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const { data: club } = await supabase
    .from('ssyt_sport_clubs')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (!club) {
    notFound()
  }

  const [contactsRes, proceduresRes, templatesRes, appsRes] = await Promise.all([
    supabase
      .from('ssyt_club_contacts')
      .select('*')
      .eq('club_id', params.id)
      .order('display_order'),
    supabase
      .from('ssyt_club_procedures')
      .select('*')
      .eq('club_id', params.id)
      .order('step_no'),
    supabase
      .from('ssyt_club_document_templates')
      .select('id, title, description, is_required, display_order, updated_at')
      .eq('club_id', params.id)
      .order('display_order'),
    supabase
      .from('ssyt_club_applications')
      .select(
        'id, status, started_at, submitted_at, decided_at, admin_notes, participant:ssyt_participants(id, full_name, email)'
      )
      .eq('club_id', params.id)
      .order('started_at', { ascending: false }),
  ])

  return (
    <div className="px-8 py-8 max-w-6xl">
      <Link
        href="/ssyt/admin/cluburi"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-3 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Înapoi la cluburi
      </Link>

      <div className="mb-6">
        <h1
          className="text-3xl font-semibold tracking-tight"
          style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
        >
          <Shield size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          {club.name}
        </h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-gray-500">
          <span className="font-mono">{club.slug}</span>
          <span
            className="inline-block w-1 h-1 rounded-full"
            style={{ background: '#cbd5e1' }}
          ></span>
          {club.is_active ? (
            <span style={{ color: '#16a34a' }}>● Activ</span>
          ) : (
            <span style={{ color: '#94a3b8' }}>● Dezactivat</span>
          )}
        </div>
      </div>

      <ClubEditor
        club={club}
        contacts={contactsRes.data ?? []}
        procedures={proceduresRes.data ?? []}
        templates={templatesRes.data ?? []}
        applications={(appsRes.data ?? []).map((a: any) => ({
          id: a.id,
          status: a.status,
          started_at: a.started_at,
          submitted_at: a.submitted_at,
          decided_at: a.decided_at,
          admin_notes: a.admin_notes,
          participant: Array.isArray(a.participant) ? a.participant[0] ?? null : a.participant,
        }))}
      />
    </div>
  )
}
