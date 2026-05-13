import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import BoatNewForm from './BoatNewForm'

export default function NewBoatPage() {
  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/ssyt/admin/boats"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition mb-4"
      >
        <ArrowLeft size={14} />
        Toate ambarcațiunile
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
        Ambarcațiune nouă
      </h1>
      <p className="text-sm text-gray-500 mb-8">
        Înregistrează o ambarcațiune nouă în flotă. Datele tehnice pot fi populate ulterior din pagina detalii.
      </p>

      <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <BoatNewForm />
      </div>
    </div>
  )
}
