import Link from 'next/link'
import { Anchor } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      <header className="px-6 py-4">
        <Link href="/ssyt" className="inline-flex items-center gap-2">
          <Anchor size={20} style={{ color: '#FF6B35' }} />
          <span className="font-bold tracking-tight" style={{ color: '#0a1628' }}>SSYT2026</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {children}
      </main>
      <footer className="text-center text-xs text-gray-400 py-4">
        SetSail Yachting Teams · Sezon 2026
      </footer>
    </div>
  )
}
