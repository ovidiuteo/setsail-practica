'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Ship, Calendar, Users, Settings, Anchor } from 'lucide-react'

const nav = [
  { href: '/admin',           label: 'Dashboard',        icon: Anchor },
  { href: '/admin/sesiuni',   label: 'Sesiuni Practică', icon: Calendar },
  { href: '/admin/cursanti',  label: 'Cursanți',         icon: Users },
  { href: '/admin/configurare', label: 'Configurare',    icon: Settings },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  return (
    <div className="flex min-h-screen">
      {/* Sidebar îngust - doar iconițe + tooltip la hover */}
      <aside
        style={{ background: '#0a1628', width: 56 }}
        className="flex flex-col shrink-0 z-40"
      >
        {/* Logo */}
        <div className="flex items-center justify-center py-4 border-b border-white/10">
          <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
            <Ship size={18} style={{ color: '#0a1628' }} />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col items-center py-3 gap-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = href === '/admin' ? path === '/admin' : path.startsWith(href)
            return (
              <div key={href} className="relative group w-full flex justify-center">
                <Link
                  href={href}
                  className={`flex items-center justify-center w-9 h-9 rounded-lg transition-all ${
                    active ? '' : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                  style={active ? { background: '#f5c842', color: '#0a1628' } : {}}
                >
                  <Icon size={17} />
                </Link>
                {/* Tooltip */}
                <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50
                  px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
                  bg-gray-900 text-white shadow-lg
                  opacity-0 pointer-events-none
                  group-hover:opacity-100 transition-opacity duration-150">
                  {label}
                  {/* Arrow */}
                  <div className="absolute right-full top-1/2 -translate-y-1/2
                    border-4 border-transparent border-r-gray-900"/>
                </div>
              </div>
            )
          })}
        </nav>

        {/* Footer dot */}
        <div className="flex justify-center py-3 border-t border-white/10">
          <div className="w-1.5 h-1.5 rounded-full bg-white/20"/>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}