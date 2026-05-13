'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  UserPlus,
  Sailboat,
  Anchor,
  Trophy,
  FileText,
  Settings,
  Award,
  Image as ImageIcon,
  ClipboardList,
  CheckSquare,
  Shuffle,
  ChevronLeft,
} from 'lucide-react'

const NAV = [
  { href: '/ssyt/admin', label: 'Overview sezon', icon: LayoutDashboard },
  { href: '/ssyt/admin/teams', label: 'Echipe', icon: Users },
  { href: '/ssyt/admin/roster', label: 'Roster (drag-drop)', icon: Shuffle },
  { href: '/ssyt/admin/participants', label: 'Participanți', icon: UserPlus },
  { href: '/ssyt/admin/applications', label: 'Aplicări', icon: ClipboardList },
  { href: '/ssyt/admin/boats', label: 'Ambarcațiuni', icon: Sailboat },
  { href: '/ssyt/admin/regattas', label: 'Regatte', icon: Anchor },
  { href: '/ssyt/admin/availability', label: 'Disponibilități', icon: CheckSquare },
  { href: '/ssyt/admin/results', label: 'Rezultate', icon: Trophy },
  { href: '/ssyt/admin/badges', label: 'Badge-uri', icon: Award },
  { href: '/ssyt/admin/media', label: 'Media', icon: ImageIcon },
  { href: '/ssyt/admin/documents', label: 'Documente', icon: FileText },
  { href: '/ssyt/admin/settings', label: 'Setări SSYT', icon: Settings },
]

export default function AdminSidebar() {
  const pathname = usePathname()

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 z-30 flex flex-col items-center py-4"
      style={{ width: 56, background: '#0a1628', borderRight: '1px solid rgba(255,255,255,0.08)' }}
    >
      <Link
        href="/ssyt"
        title="Înapoi la SSYT public"
        className="w-10 h-10 rounded-md flex items-center justify-center mb-4 transition hover:bg-white/10"
        style={{ background: 'rgba(255,107,53,0.15)' }}
      >
        <ChevronLeft size={18} style={{ color: '#FF6B35' }} />
      </Link>

      <div className="w-8 h-px mb-4" style={{ background: 'rgba(255,255,255,0.1)' }}></div>

      <nav className="flex flex-col gap-1 flex-1">
        {NAV.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== '/ssyt/admin' && pathname?.startsWith(item.href))
          const Icon = item.icon

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className="group relative w-10 h-10 rounded-md flex items-center justify-center transition"
              style={{
                background: active ? 'rgba(255,107,53,0.15)' : 'transparent',
                color: active ? '#FF6B35' : 'rgba(255,255,255,0.6)',
              }}
            >
              <Icon size={18} />
              <span
                className="absolute left-full ml-3 px-2.5 py-1 rounded-md text-xs whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition z-50"
                style={{ background: '#0a1628', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      <div className="text-[9px] text-white/30 font-semibold tracking-wider mt-2">SSYT</div>
    </aside>
  )
}