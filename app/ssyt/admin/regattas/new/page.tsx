import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getActiveSeason } from '@/lib/ssyt/supabase'
import RegattaNewForm from './RegattaNewForm'

export default async function NewRegattaPage() {
  const season = await getActiveSeason()

  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/ssyt/admin/regattas"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
      >
        <ArrowLeft size={14} />
        Toate regatele
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        Regatta nouă
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Sezon: <span className="font-medium" style={{ color: '#0a1628' }}>{season?.name || '—'}</span>
      </p>

      {!season ? (
        <div className="rounded-lg p-8 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          Niciun sezon activ.
        </div>
      ) : (
        <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <RegattaNewForm seasonId={season.id} />
        </div>
      )}
    </div>
  )
}