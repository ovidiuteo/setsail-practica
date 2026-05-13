'use client'
import Link from 'next/link'
import { Anchor, LogIn, User } from 'lucide-react'
import { useCurrentUser } from '@/lib/ssyt/useCurrentUser'

export default function SSYTHeader() {
  const { user, isAdmin, loading } = useCurrentUser()

  return (
    <header className="border-b" style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/ssyt" className="inline-flex items-center gap-2 text-white">
          <Anchor size={20} style={{ color: '#FF6B35' }} />
          <span className="font-bold tracking-tight">SSYT2026</span>
        </Link>

        <nav className="hidden md:flex items-center gap-5 text-sm">
          <Link href="/ssyt/teams" className="text-white/70 hover:text-white transition">Echipe</Link>
          <Link href="/ssyt/regattas" className="text-white/70 hover:text-white transition">Regate</Link>
          <Link href="/ssyt/calendar" className="text-white/70 hover:text-white transition">Calendar</Link>
          <Link href="/ssyt/leaderboard" className="text-white/70 hover:text-white transition">Leaderboard</Link>
          <Link href="/ssyt/media" className="text-white/70 hover:text-white transition">Media</Link>
          <Link href="/ssyt/program" className="text-white/70 hover:text-white transition">Program</Link>
          <Link href="/ssyt/apply" className="px-3 py-1.5 rounded-md font-medium text-white text-sm transition hover:opacity-90" style={{ background: '#FF6B35' }}>
            Aplică
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {loading ? (
            <span className="text-xs text-white/40">...</span>
          ) : user ? (
            <>
              {isAdmin && (
                <Link href="/ssyt/admin" className="text-xs uppercase tracking-wider text-white/60 hover:text-white">
                  Admin
                </Link>
              )}
              <Link href="/ssyt/portal" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white transition hover:opacity-90" style={{ background: 'rgba(255,255,255,0.1)' }}>
                <User size={14} /> Portal
              </Link>
            </>
          ) : (
            <Link href="/ssyt/login" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white transition hover:opacity-90" style={{ background: 'rgba(255,255,255,0.1)' }}>
              <LogIn size={14} /> Login
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}
