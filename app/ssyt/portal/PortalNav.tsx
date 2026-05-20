'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { LucideIcon } from 'lucide-react'
import { Home, Users, CheckSquare, User, Anchor, Sailboat, Briefcase, Shield } from 'lucide-react'

type Tab = { href: string; label: string; icon: LucideIcon; exact?: boolean }

const BASE_TABS: Tab[] = [
  { href: '/ssyt/portal', label: 'Acasă', icon: Home, exact: true },
  { href: '/ssyt/portal/team', label: 'Echipa', icon: Users },
  { href: '/ssyt/portal/regattas', label: 'Regate', icon: Anchor },
  { href: '/ssyt/portal/availability', label: 'Disponibilități', icon: CheckSquare },
  { href: '/ssyt/portal/team-space', label: 'Spațiu echipă', icon: Briefcase },
  { href: '/ssyt/portal/boat-info', label: 'First 34.7', icon: Sailboat },
]
const CLUB_TAB: Tab = { href: '/ssyt/portal/club', label: 'Club sportiv', icon: Shield }
const PROFILE_TAB: Tab = { href: '/ssyt/portal/profile', label: 'Profil', icon: User }

export default function PortalNav({ showClubsTab = false }: { showClubsTab?: boolean }) {
  const pathname = usePathname()
  const TABS: Tab[] = showClubsTab
    ? [...BASE_TABS, CLUB_TAB, PROFILE_TAB]
    : [...BASE_TABS, PROFILE_TAB]

  return (
    <nav className="border-b overflow-x-auto" style={{ background: '#fff', borderColor: '#e5e7eb' }}>
      <div className="max-w-6xl mx-auto px-6 flex">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = tab.exact ? pathname === tab.href : pathname?.startsWith(tab.href)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition"
              style={{
                color: active ? '#FF6B35' : '#6B7280',
                borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <Icon size={14} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
