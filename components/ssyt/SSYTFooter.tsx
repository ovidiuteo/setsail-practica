'use client'
import Link from 'next/link'
import { Anchor } from 'lucide-react'

export default function SSYTFooter() {
  return (
    <footer className="mt-20 border-t" style={{ background: '#0a1628', borderColor: 'rgba(255,255,255,0.08)' }}>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 text-white mb-3">
              <Anchor size={18} />
              <span className="font-semibold tracking-tight">SSYT<span style={{ color: '#FF6B35' }}>2026</span></span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Sub-brand sportiv SetSail NauticSchool. Programul oficial de regatta pentru sezonul 2026.
            </p>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Program</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/ssyt/program" className="text-white/70 hover:text-white">Despre SSYT</Link></li>
              <li><Link href="/ssyt/teams" className="text-white/70 hover:text-white">Echipe</Link></li>
              <li><Link href="/ssyt/calendar" className="text-white/70 hover:text-white">Calendar</Link></li>
              <li><Link href="/ssyt/regattas" className="text-white/70 hover:text-white">Regatte</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">Participare</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/ssyt/apply" className="text-white/70 hover:text-white">Aplică</Link></li>
              <li><Link href="/ssyt/portal-login" className="text-white/70 hover:text-white">Login portal</Link></li>
              <li><Link href="/ssyt/leaderboard" className="text-white/70 hover:text-white">Leaderboard</Link></li>
              <li><Link href="/ssyt/media" className="text-white/70 hover:text-white">Media</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs uppercase tracking-wider text-white/40 font-medium mb-3">SetSail</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/" className="text-white/70 hover:text-white">SetSail NauticSchool</Link></li>
              <li><Link href="/admin" className="text-white/70 hover:text-white">Admin Practică</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t text-xs text-white/40 flex flex-wrap justify-between gap-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <span>© {new Date().getFullYear()} SetSail NauticSchool. SSYT2026.</span>
          <span>4 Teams · 5 Regattas · 1 Racing Season</span>
        </div>
      </div>
    </footer>
  )
}
