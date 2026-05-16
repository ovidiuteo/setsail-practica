import { redirect } from 'next/navigation'
import { Sailboat } from 'lucide-react'
import { getPortalSession, getPortalSupabase, canEditBoatType } from '@/lib/ssyt/portal-session'
import ResourceList from '@/components/ssyt/portal/ResourceList'

export const dynamic = 'force-dynamic'

export default async function PortalBoatInfoPage() {
  const session = await getPortalSession()
  if (!session) redirect('/ssyt/portal-login?next=/ssyt/portal/boat-info')

  const supabase = getPortalSupabase()

  const { data: resources } = await supabase
    .from('ssyt_boat_type_resources')
    .select('id, title, description, url, resource_type, text_content')
    .eq('boat_type', 'First 34.7')
    .order('display_order')
    .order('created_at', { ascending: false })

  const canEdit = await canEditBoatType(session.participantId)

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Resurse comune</p>
        <h1 className="text-3xl font-semibold tracking-tight flex items-center gap-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <Sailboat size={26} style={{ color: '#FF6B35' }} />
          Beneteau First 34.7
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Resurse generale despre tipul de barcă pe care navighează toate cele 4 echipe.
          Vizibile pentru toți participanții.
        </p>
      </div>

      {/* Despre First 34.7 */}
      <div className="rounded-lg p-6 mb-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Despre First 34.7</h2>
        <p className="text-gray-700 leading-relaxed text-sm">
          Beneteau First 34.7 este un velier de croazieră-regatta de 34 picioare, proiectat de Bruce Farr.
          Este o ambarcațiune echilibrată, rapidă și ușor de manevrat, popular pentru regate de
          coastă și open-water. Toate cele 4 echipe SSYT navighează pe bărci First 34.7 identice
          configurate pentru competiție, ceea ce face ca diferența între echipe să stea în
          tehnica de echipaj și strategie.
        </p>
      </div>

      {/* Resurse */}
      <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Resurse</h2>
        <ResourceList
          resources={resources || []}
          canEdit={canEdit}
          apiEndpoint="/api/ssyt/portal/boat-type-resources"
          emptyText="Nicio resursă încă. Adaugă manuale, tutoriale, link-uri către documente."
        />
      </div>
    </div>
  )
}
