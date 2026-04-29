'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ship, Calendar, Users, Settings, FileText, Anchor } from 'lucide-react'

const nav = [
  { href: '/admin', label: 'Dashboard', icon: Anchor },
  { href: '/admin/sesiuni', label: 'Sesiuni Practică', icon: Calendar },
  { href: '/admin/cursanti', label: 'Cursanți', icon: Users },
  { href: '/admin/configurare', label: 'Configurare', icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside style={{ background: '#0a1628', width: 240 }} className="flex flex-col shrink-0">
        {/* Logo */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ background: '#f5c842' }}>
              <Ship size={20} style={{ color: '#0a1628' }} />
            </div>
            <div>
              <div className="text-white font-bold text-sm leading-tight">SetSail</div>
              <div className="text-white/50 text-xs">Portal Practică</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? path === '/admin' : path.startsWith(href)
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                  active
                    ? 'text-white font-medium'
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
                style={active ? { background: '#f5c842', color: '#0a1628', fontWeight: 600 } : {}}
              >
                <Icon size={16} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10">
          <div className="text-white/30 text-xs text-center">SetSail Advertising SRL</div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
