'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Ship, Calendar, Users, Settings, Anchor, Building2, Mail, PenTool, LogOut, Ticket, Award } from 'lucide-react'
import GoogleGIcon from '@/components/GoogleGIcon'

const nav = [
  { href: '/admin',             label: 'Dashboard',         icon: Anchor },
  { href: '/admin/sesiuni',     label: 'Sesiuni Practică',  icon: Calendar },
  { href: '/admin/cursanti',    label: 'Cursanți',          icon: Users },
  { href: '/admin/vouchere',    label: 'Vouchere',          icon: Ticket },
  { href: '/admin/diplome',     label: 'Diplome',           icon: Award },
  { href: '/admin/emailuri',    label: 'Emailuri',          icon: Mail },
  { href: '/admin/gmail',       label: 'Gmail Templates',   icon: GoogleGIcon },
  { href: '/admin/semnaturi',   label: 'Semnături',         icon: PenTool },
  { href: '/admin/setsail',     label: 'SetSail Firmă',     icon: Building2 },
  { href: '/admin/configurare', label: 'Configurare',       icon: Settings },
]

// Titlul tab-ului de browser pentru fiecare pagina admin.
// Paginile dinamice (sesiune/cursant) primesc un titlu de baza aici,
// pe care pagina il rafineaza dupa ce incarca datele.
const ADMIN_TAB_TITLES: Record<string, string> = {
  '/admin':                            'SetSail Admin',
  '/admin/login':                      'Login Admin',
  '/admin/sesiuni':                    'Sesiuni Practică',
  '/admin/sesiuni/nou':                'Sesiune nouă',
  '/admin/cursanti':                   'Cursanți',
  '/admin/cursanti/import':            'Import cursanți',
  '/admin/vouchere':                   'Vouchere',
  '/admin/diplome':                    'Diplome',
  '/admin/diplome/genereaza':          'Generează diplome',
  '/admin/diplome/nou':                'Diplomă nouă',
  '/admin/diplome/coada':              'Tipărire listă diplome',
  '/admin/diplome/sabloane':           'Șabloane diplome',
  '/admin/diplome/print':              'Print diplome',
  '/admin/emailuri':                   'Emailuri',
  '/admin/emailuri/reguli':            'Reguli email',
  '/admin/gmail':                      'Gmail Templates',
  '/admin/semnaturi':                  'Semnături',
  '/admin/setsail':                    'SetSail Firmă',
  '/admin/pool-radio':                 'Pool Radio',
  '/admin/configurare':                'Configurare',
  '/admin/configurare/dashboards':     'Dashboard-uri persoane',
  '/admin/configurare/mail-templates': 'Template-uri Email',
  '/admin/configurare/timeline':       'Timeline sesiuni',
}

function adminTabTitle(path: string): string {
  if (ADMIN_TAB_TITLES[path]) return ADMIN_TAB_TITLES[path]
  if (/^\/admin\/diplome\/sabloane\/[^/]+$/.test(path)) return 'Calibrare șablon'
  if (/^\/admin\/diplome\/[^/]+$/.test(path))         return 'Diplomă'
  if (/^\/admin\/sesiuni\/[^/]+\/clone$/.test(path))  return 'Clonează sesiune'
  if (/^\/admin\/sesiuni\/[^/]+\/examen$/.test(path)) return 'Examen sesiune'
  if (/^\/admin\/sesiuni\/[^/]+$/.test(path))         return 'Sesiune'       // pagina suprascrie cu data
  if (/^\/admin\/cursanti\/[^/]+$/.test(path))        return 'Fișă cursant'  // pagina suprascrie cu numele
  return 'SetSail Admin'
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const router = useRouter()

  // Titlu tab browser per pagina (paginile dinamice il rafineaza ulterior)
  useEffect(() => { document.title = adminTabTitle(path) }, [path])

  // Login page: fără sidebar
  if (path === '/admin/login') return <>{children}</>
  // Pagina de print diplome: fără sidebar (sidebar-ul ar apărea pe hârtie)
  if (path.startsWith('/admin/diplome/print')) return <>{children}</>

  async function logout() {
    await fetch('/api/admin-auth/logout', { method: 'POST' })
    router.replace('/admin/login')
  }
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

        {/* Logout */}
        <div className="flex justify-center py-3 border-t border-white/10 relative group">
          <button
            onClick={logout}
            className="flex items-center justify-center w-9 h-9 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-all"
            title="Logout"
          >
            <LogOut size={16} />
          </button>
          <div className="absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50
            px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap
            bg-gray-900 text-white shadow-lg
            opacity-0 pointer-events-none
            group-hover:opacity-100 transition-opacity duration-150">
            Logout
            <div className="absolute right-full top-1/2 -translate-y-1/2
              border-4 border-transparent border-r-gray-900"/>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50 overflow-auto">
        {children}
      </main>
    </div>
  )
}
