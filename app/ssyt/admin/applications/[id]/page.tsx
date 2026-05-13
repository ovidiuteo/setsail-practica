import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Mail, Phone, Calendar } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import ApplicationDecisionForm from './ApplicationDecisionForm'

export const revalidate = 0

export default async function AdminApplicationDetailPage({ params }: { params: { id: string } }) {
  const { data: application } = await supabase
    .from('ssyt_applications')
    .select(`
      *,
      preferred_team:ssyt_teams!ssyt_applications_preferred_team_id_fkey(id, name, short_name, color_primary),
      created_participant:ssyt_participants!ssyt_applications_created_participant_id_fkey(id, full_name)
    `)
    .eq('id', params.id)
    .maybeSingle()

  if (!application) notFound()

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select('id, name, short_name, color_primary')
    .eq('season_id', application.season_id)
    .eq('status', 'active')
    .order('display_order')

  return (
    <div className="px-8 py-8 max-w-4xl">
      <Link href="/ssyt/admin/applications" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4">
        <ArrowLeft size={14} />
        Toate aplicările
      </Link>

      <div className="flex items-start gap-4 mb-8">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold text-xl flex-shrink-0" style={{ background: '#0a1628' }}>
          {application.first_name?.[0]}{application.last_name?.[0]}
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            {application.first_name} {application.last_name}
          </h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
            <span className="inline-flex items-center gap-1"><Mail size={11} /> {application.email}</span>
            {application.phone && <span className="inline-flex items-center gap-1"><Phone size={11} /> {application.phone}</span>}
            <span className="inline-flex items-center gap-1"><Calendar size={11} /> Aplicat {new Date(application.submitted_at).toLocaleDateString('ro-RO')}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stânga - detalii aplicare */}
        <div className="lg:col-span-2 space-y-4">
          {application.date_of_birth && (
            <Section title="Data nașterii">{new Date(application.date_of_birth).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}</Section>
          )}

          {application.sailing_experience && (
            <Section title="Experiență sailing"><Multiline text={application.sailing_experience} /></Section>
          )}

          {application.regatta_experience && (
            <Section title="Experiență regatta"><Multiline text={application.regatta_experience} /></Section>
          )}

          {application.preferred_roles && application.preferred_roles.length > 0 && (
            <Section title="Roluri preferate">
              <div className="flex flex-wrap gap-2">
                {application.preferred_roles.map((r: string) => (
                  <span key={r} className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>{r}</span>
                ))}
              </div>
            </Section>
          )}

          {application.availability_notes && (
            <Section title="Disponibilitate"><Multiline text={application.availability_notes} /></Section>
          )}

          {application.motivation && (
            <Section title="Motivație"><Multiline text={application.motivation} /></Section>
          )}
        </div>

        {/* Dreapta - decizie */}
        <div>
          <ApplicationDecisionForm application={application} teams={teams || []} />
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-2">{title}</h3>
      <div className="text-sm text-gray-700">{children}</div>
    </div>
  )
}

function Multiline({ text }: { text: string }) {
  return <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
}