import { Suspense } from 'react'
import Link from 'next/link'
import { Anchor } from 'lucide-react'
import PortalLoginForm from './PortalLoginForm'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Acces portal · SSYT2026',
  description: 'Conectează-te la portalul tău SSYT',
}

export default function PortalLoginPage() {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      <header className="px-6 py-4">
        <Link href="/ssyt" className="inline-flex items-center gap-2">
          <Anchor size={20} style={{ color: '#FF6B35' }} />
          <span className="font-bold tracking-tight" style={{ color: '#0a1628' }}>SSYT2026</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="rounded-lg p-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <h1 className="text-2xl font-bold tracking-tight mb-1" style={{ color: '#0a1628' }}>
              Bun venit în portal
            </h1>
            <p className="text-sm text-gray-500 mb-6">
              Introdu emailul tău și codul sezonului pentru a accesa portalul.
            </p>
            <Suspense fallback={<div className="text-sm text-gray-400">Se încarcă...</div>}>
              <PortalLoginForm />
            </Suspense>
          </div>
          <p className="text-center text-xs text-gray-400 mt-4">
            Nu ai acces? Contactează organizatorul SSYT.
          </p>
        </div>
      </main>
      <footer className="text-center text-xs text-gray-400 py-4">
        SetSail Yachting Teams · Sezon 2026
      </footer>
    </div>
  )
}
