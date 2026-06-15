import Link from 'next/link'
import { Settings, ExternalLink, PanelLeft } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import ProgramContentForm from './ProgramContentForm'
import SidebarOrderForm from './SidebarOrderForm'

export const revalidate = 0

export default async function AdminSettingsPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: content } = await supabase
    .from('ssyt_program_content')
    .select('*')
    .eq('season_id', season.id)
    .maybeSingle()

  return (
    <div className="px-8 py-8 max-w-4xl">
      <div className="mb-8 flex items-end justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
            {season.name}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            <Settings size={26} className="inline mr-2 align-middle" />
            Setări SSYT
          </h1>
          <p className="text-sm text-gray-500 mt-1">Configurări și conținut editorial pentru sezonul curent.</p>
        </div>
        <Link
          href="/ssyt/program"
          target="_blank"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm hover:bg-gray-50 transition"
          style={{ background: '#fff', border: '1px solid #e5e7eb', color: '#0a1628' }}
        >
          Vezi pagina publică
          <ExternalLink size={12} />
        </Link>
      </div>

      <div className="rounded-lg p-6 mb-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4 inline-flex items-center gap-1.5">
          <PanelLeft size={14} /> Ordine sidebar admin
        </h2>
        <SidebarOrderForm seasonId={season.id} initialOrder={(season as any).admin_sidebar_order} />
      </div>

      <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4">
          Conținut pagina <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">/ssyt/program</code>
        </h2>
        <ProgramContentForm seasonId={season.id} initial={content} />
      </div>
    </div>
  )
}