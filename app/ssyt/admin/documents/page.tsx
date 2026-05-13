import Link from 'next/link'
import { FileText, ExternalLink, Anchor, User } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0

export default async function AdminDocumentsPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const [regattaDocsRes, participantDocsRes, docTypesRes] = await Promise.all([
    supabase
      .from('ssyt_regatta_documents')
      .select(`
        *,
        document_type:ssyt_document_types(name, code),
        regatta:ssyt_regattas(id, name, slug, season_id)
      `)
      .order('uploaded_at', { ascending: false }),
    supabase
      .from('ssyt_participant_documents')
      .select(`
        *,
        document_type:ssyt_document_types(name, code),
        participant:ssyt_participants(id, full_name)
      `)
      .order('uploaded_at', { ascending: false }),
    supabase.from('ssyt_document_types').select('*').eq('is_active', true).order('display_order'),
  ])

  // Filtrez doar documentele din sezonul curent
  const regattaDocs = (regattaDocsRes.data || []).filter((d: any) => d.regatta?.season_id === season.id)
  const participantDocs = participantDocsRes.data || []

  return (
    <div className="px-8 py-8 max-w-7xl">
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <FileText size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
            Documente
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {regattaDocs.length} documente regate + {participantDocs.length} documente participanți
          </p>
        </div>
      </div>

      <div className="rounded-lg p-4 mb-6 text-sm" style={{ background: 'rgba(59,130,246,0.08)', color: '#1E40AF' }}>
        💡 Documentele sunt gestionate per regatta (NoR, SI, crewlist) sau per participant (CI, certificat medical, asigurare).
        Editarea se face din pagina detalii a fiecărui obiect.
      </div>

      {/* Tipuri de documente disponibile */}
      <div className="mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Tipuri documente disponibile</h2>
        <div className="flex flex-wrap gap-2">
          {(docTypesRes.data || []).map((t: any) => (
            <span key={t.id} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium" style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}>
              <FileText size={11} className="text-gray-400" />
              {t.name}
              {t.is_required && <span className="text-[9px] uppercase px-1 rounded" style={{ background: '#FF6B35', color: '#fff' }}>required</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Documente regate */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
            <Anchor size={12} className="inline mr-1.5" />
            Documente regate ({regattaDocs.length})
          </h2>
          {regattaDocs.length === 0 ? (
            <div className="rounded-lg p-8 text-center text-gray-500 text-sm" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
              Niciun document încărcat pentru regate.
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Doc</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Regatta</th>
                    <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Vis</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {regattaDocs.map((d: any) => (
                    <tr key={d.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                      <td className="px-4 py-2">
                        <div className="font-medium text-xs" style={{ color: '#0a1628' }}>{d.name}</div>
                        <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                          {d.document_type?.name || d.custom_type_name || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {d.regatta ? (
                          <Link href={`/ssyt/admin/regattas/${d.regatta.id}`} className="hover:underline" style={{ color: '#0a1628' }}>
                            {d.regatta.name}
                          </Link>
                        ) : <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <VisibilityBadge visibility={d.visibility} />
                      </td>
                      <td className="pr-4 text-right">
                        {d.file_url && (
                          <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                            <ExternalLink size={12} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Documente participanți */}
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">
            <User size={12} className="inline mr-1.5" />
            Documente participanți ({participantDocs.length})
          </h2>
          {participantDocs.length === 0 ? (
            <div className="rounded-lg p-8 text-center text-gray-500 text-sm" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
              Niciun document încărcat pentru participanți (CI, certificat medical, asigurare).
            </div>
          ) : (
            <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <table className="w-full text-sm">
                <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Doc</th>
                    <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Participant</th>
                    <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Expiră</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {participantDocs.map((d: any) => {
                    const expired = d.expiry_date && new Date(d.expiry_date) < new Date()
                    const expSoon = d.expiry_date && !expired && new Date(d.expiry_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                    return (
                      <tr key={d.id} style={{ borderTop: '1px solid #e5e7eb' }}>
                        <td className="px-4 py-2">
                          <div className="font-medium text-xs" style={{ color: '#0a1628' }}>{d.name || d.document_type?.name}</div>
                          <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                            {d.document_type?.name || '—'}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {d.participant ? (
                            <Link href={`/ssyt/admin/participants/${d.participant.id}`} className="hover:underline" style={{ color: '#0a1628' }}>
                              {d.participant.full_name}
                            </Link>
                          ) : <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="px-4 py-2 text-center text-xs">
                          {d.expiry_date ? (
                            <span className={expired ? 'text-red-600 font-medium' : expSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                              {new Date(d.expiry_date).toLocaleDateString('ro-RO')}
                            </span>
                          ) : <span className="text-gray-400 italic">—</span>}
                        </td>
                        <td className="pr-4 text-right">
                          {d.file_url && (
                            <a href={d.file_url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-gray-700">
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function VisibilityBadge({ visibility }: { visibility: string }) {
  const colors: Record<string, string> = {
    public: '#10B981',
    members: '#3B82F6',
    admin: '#6B7280',
  }
  const c = colors[visibility] || '#6B7280'
  return (
    <span className="text-[9px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded" style={{ background: `${c}15`, color: c }}>
      {visibility}
    </span>
  )
}