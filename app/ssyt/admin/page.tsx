import Link from 'next/link'
import { Users, Sailboat, Anchor, Trophy, Calendar, ClipboardList, ArrowRight } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'

export const revalidate = 0 // mereu fresh in admin

export default async function AdminDashboardPage() {
  const season = await getActiveSeason()

  // Statistici paralele
  const [teamsRes, participantsRes, boatsRes, regattasRes, applicationsRes] = await Promise.all([
    supabase.from('ssyt_teams').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('ssyt_participants').select('id', { count: 'exact', head: true }).in('status', ['active', 'accepted']),
    supabase.from('ssyt_boats').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('ssyt_regattas').select('id', { count: 'exact', head: true }).eq('season_id', season?.id ?? ''),
    supabase.from('ssyt_applications').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('season_id', season?.id ?? ''),
  ])

  const stats = {
    teams: teamsRes.count ?? 0,
    participants: participantsRes.count ?? 0,
    boats: boatsRes.count ?? 0,
    regattas: regattasRes.count ?? 0,
    pendingApps: applicationsRes.count ?? 0,
  }

  return (
    <div className="px-8 py-8 max-w-7xl">
      {/* Header pagina */}
      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
          {season?.name || 'Niciun sezon activ'}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Overview sezon
        </h1>
        {season && (
          <p className="text-sm text-gray-500 mt-1">
            Status: <span className="font-medium" style={{ color: '#0a1628' }}>{season.status}</span>
            {season.start_date && season.end_date && (
              <> · {formatDate(season.start_date)} – {formatDate(season.end_date)}</>
            )}
          </p>
        )}
      </div>

      {/* Statistici cheie */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        <StatTile icon={<Users size={18} />} value={stats.teams} label="Echipe" href="/ssyt/admin/teams" />
        <StatTile icon={<Users size={18} />} value={stats.participants} label="Participanți" href="/ssyt/admin/participants" />
        <StatTile icon={<Sailboat size={18} />} value={stats.boats} label="Ambarcațiuni" href="/ssyt/admin/boats" />
        <StatTile icon={<Anchor size={18} />} value={stats.regattas} label="Regatte" href="/ssyt/admin/regattas" />
        <StatTile icon={<ClipboardList size={18} />} value={stats.pendingApps} label="Aplicări noi" href="/ssyt/admin/applications" highlight={stats.pendingApps > 0} />
      </div>

      {/* Acțiuni rapide */}
      <div className="mb-10">
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Acțiuni rapide</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <QuickAction href="/ssyt/admin/teams" title="Gestionează echipele" desc="Editează roster, culori, skipperi" icon={<Users size={16} />} />
          <QuickAction href="/ssyt/admin/regattas/new" title="Adaugă regatta" desc="Programează un nou eveniment" icon={<Anchor size={16} />} />
          <QuickAction href="/ssyt/admin/participants" title="Adaugă participant" desc="Înregistrează manual un membru" icon={<Users size={16} />} />
        </div>
      </div>

      {/* Echipele sezonului — preview */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500">Echipele sezonului</h2>
          <Link href="/ssyt/admin/teams" className="text-xs font-medium inline-flex items-center gap-1 hover:gap-2 transition-all" style={{ color: '#0a1628' }}>
            Gestionează <ArrowRight size={12} />
          </Link>
        </div>
        <TeamsOverview seasonId={season?.id} />
      </div>
    </div>
  )
}

async function TeamsOverview({ seasonId }: { seasonId?: string }) {
  if (!seasonId) return null

  const { data: teams } = await supabase
    .from('ssyt_teams')
    .select(`
      id, name, short_name, color_primary,
      boat:ssyt_boats(name),
      skipper:ssyt_participants!ssyt_teams_skipper_id_fkey(full_name)
    `)
    .eq('season_id', seasonId)
    .eq('status', 'active')
    .order('display_order')

  if (!teams || teams.length === 0) {
    return <div className="rounded-lg p-8 text-center text-sm text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>Nicio echipă în sezon.</div>
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {teams.map((t: any) => (
        <Link
          key={t.id}
          href={`/ssyt/admin/teams/${t.id}`}
          className="rounded-lg p-4 hover:shadow-md transition group"
          style={{ background: '#fff', border: '1px solid #e5e7eb' }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center text-white font-semibold text-sm" style={{ background: t.color_primary || '#4A5568' }}>
              {t.short_name?.charAt(0) || 'T'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate" style={{ color: '#0a1628' }}>{t.name}</div>
              <div className="text-xs text-gray-500 truncate">{t.boat?.name || 'Fără ambarcațiune'}</div>
            </div>
          </div>
          <div className="text-xs text-gray-600">
            <span className="text-gray-400">Skipper:</span> {t.skipper?.full_name || '—'}
          </div>
        </Link>
      ))}
    </div>
  )
}

function StatTile({ icon, value, label, href, highlight }: { icon: React.ReactNode; value: number; label: string; href: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className="block rounded-lg p-4 hover:shadow-md transition"
      style={{
        background: '#fff',
        border: highlight ? '1px solid #FF6B35' : '1px solid #e5e7eb',
      }}
    >
      <div className="flex items-center gap-2 mb-2" style={{ color: highlight ? '#FF6B35' : '#0a1628' }}>
        {icon}
        <span className="text-xs uppercase tracking-wider text-gray-500 font-medium">{label}</span>
      </div>
      <div className="text-2xl font-semibold tracking-tight" style={{ color: '#0a1628' }}>{value}</div>
    </Link>
  )
}

function QuickAction({ href, title, desc, icon }: { href: string; title: string; desc: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-lg p-4 hover:shadow-md transition group flex items-start gap-3"
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
    >
      <div className="w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm" style={{ color: '#0a1628' }}>{title}</div>
        <div className="text-xs text-gray-500 mt-0.5">{desc}</div>
      </div>
    </Link>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
}