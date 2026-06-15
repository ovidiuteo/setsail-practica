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
  Wallet,
  UserCog,
  Shield,
  BarChart3,
} from 'lucide-react'

export type NavItem = { href: string; label: string; icon: any }

export const ADMIN_NAV: NavItem[] = [
  { href: '/ssyt/admin', label: 'Overview sezon', icon: LayoutDashboard },
  { href: '/ssyt/admin/teams', label: 'Echipe', icon: Users },
  { href: '/ssyt/admin/roster', label: 'Roster (drag-drop)', icon: Shuffle },
  { href: '/ssyt/admin/participants', label: 'Participanți', icon: UserPlus },
  { href: '/ssyt/admin/users', label: 'Useri și conturi', icon: UserCog },
  { href: '/ssyt/admin/applications', label: 'Aplicări', icon: ClipboardList },
  { href: '/ssyt/admin/boats', label: 'Ambarcațiuni', icon: Sailboat },
  { href: '/ssyt/admin/regattas', label: 'Regatte', icon: Anchor },
  { href: '/ssyt/admin/availability', label: 'Disponibilități', icon: CheckSquare },
  { href: '/ssyt/admin/stats', label: 'Statistici portal', icon: BarChart3 },
  { href: '/ssyt/admin/financial', label: 'Situație financiară', icon: Wallet },
  { href: '/ssyt/admin/results', label: 'Rezultate', icon: Trophy },
  { href: '/ssyt/admin/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/ssyt/admin/badges', label: 'Badge-uri', icon: Award },
  { href: '/ssyt/admin/media', label: 'Media', icon: ImageIcon },
  { href: '/ssyt/admin/documents', label: 'Documente', icon: FileText },
  { href: '/ssyt/admin/cluburi', label: 'Cluburi sportive', icon: Shield },
  { href: '/ssyt/admin/settings', label: 'Setări SSYT', icon: Settings },
]

// Ordonează NAV pe baza unei liste salvate de href-uri.
// Item-urile salvate vin primele (în ordinea lor); cele noi/nesalvate rămân la final, în ordinea default.
export function orderNav(saved?: string[] | null): NavItem[] {
  if (!Array.isArray(saved) || saved.length === 0) return ADMIN_NAV
  const byHref = new Map(ADMIN_NAV.map((n) => [n.href, n]))
  const result: NavItem[] = []
  const used = new Set<string>()
  for (const href of saved) {
    const item = byHref.get(href)
    if (item && !used.has(href)) { result.push(item); used.add(href) }
  }
  for (const item of ADMIN_NAV) {
    if (!used.has(item.href)) result.push(item)
  }
  return result
}
