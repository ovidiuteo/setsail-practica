import type { Metadata } from 'next'
import SSYTHeader from '@/components/ssyt/SSYTHeader'
import SSYTFooter from '@/components/ssyt/SSYTFooter'

export const metadata: Metadata = {
  title: 'SSYT 2026 — SetSail Yachting Teams',
  description: '4 Teams. 5 Regattas. 1 Racing Season. Programul sportiv SetSail pentru sezonul 2026 la Marea Neagră.',
  openGraph: {
    title: 'SSYT 2026 — SetSail Yachting Teams',
    description: '4 Teams. 5 Regattas. 1 Racing Season.',
    type: 'website',
  },
}

export default function SSYTLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#f8f9fa' }}>
      <SSYTHeader />
      <main className="flex-1">{children}</main>
      <SSYTFooter />
    </div>
  )
}
