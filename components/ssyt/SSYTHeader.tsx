'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Anchor } from 'lucide-react'

const NAV = [
  { href: '/ssyt', label: 'Home' },
  { href: '/ssyt/program', label: 'Program' },
  { href: '/ssyt/teams', label: 'Echipe' },
  { href: '/ssyt/calendar', label: 'Calendar' },
  { href: '/ssyt/regattas', label: 'Regatte' },
  { href: '/ssyt/leaderboard', label: 'Leaderboard' },
  { href: '/ssyt/media', label: 'Media' },
]

export default function SSYTHeader() {
  const pathname = usePathname()

  return (
    <header
      className="sticky top-0 z-40 border-b"
      style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.08)' }}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Branding stratificat: SetSail (master) + SSYT2026 (sub-brand) */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 text-white/70 hover:text-white transition">
            <Anchor size={18} />
            <span className="text-xs font-medium tracking-wide uppercase">SetSail</span>
          </Link>
          <span className="text-white/30">/</span>
          <Link
            href="/ssyt"
            className="text-white font-semibold tracking-tight text-lg"
            style={{ letterSpacing: '-0.02em' }}
          >
            SSYT<span style={{ color: '#FF6B35' }}>2026</span>
          </Link>
        </div>

        {/* Nav desktop */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== '/ssyt' && pathname?.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className="px-3 py-1.5 rounded-md text-sm transition"
                style={{
                  color: active ? '#FF6B35' : 'rgba(255,255,255,0.7)',
                  background: active ? 'rgba(255,107,53,0.08)' : 'transparent',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* CTA dreapta */}
        <div className="flex items-center gap-2">
          <Link
            href="/ssyt/portal/login"
            className="hidden sm:inline-flex px-3 py-1.5 rounded-md text-sm text-white/70 hover:text-white transition"
          >
            Portal
          </Link>
          <Link
            href="/ssyt/apply"
            className="inline-flex px-4 py-2 rounded-md text-sm font-medium text-white hover:opacity-90 transition"
            style={{ background: '#FF6B35' }}
          >
            Aplică
          </Link>
        </div>
      </div>

      {/* Nav mobile (sub bara) */}
      <nav className="md:hidden border-t flex overflow-x-auto" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {NAV.map((item) => {
          const active = pathname === item.href || (item.href !== '/ssyt' && pathname?.startsWith(item.href))
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-4 py-2.5 text-xs whitespace-nowrap transition"
              style={{
                color: active ? '#FF6B35' : 'rgba(255,255,255,0.6)',
                borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent',
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </header>
  )
}
