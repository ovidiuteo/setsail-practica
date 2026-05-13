import Link from 'next/link'
import { ArrowRight, Trophy, Users, Calendar, Anchor, Sailboat } from 'lucide-react'
import { getActiveSeason, getTeamsBySeason, getRegattasBySeason } from '@/lib/ssyt/supabase'

export const revalidate = 60 // ISR la 60s

export default async function SSYTHomePage() {
  const season = await getActiveSeason()
  const teams = season ? await getTeamsBySeason(season.id) : []
  const regattas = season ? await getRegattasBySeason(season.id) : []

  const teamsCount = teams.length || 4
  const regattasCount = regattas.length || 5

  return (
    <>
      {/* HERO */}
      <section style={{ background: '#0a1628' }} className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6" style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#FF6B35' }}></span>
              Sezon inaugural · {season?.year ?? 2026}
            </div>

            <h1 className="text-white font-semibold leading-[1.05] tracking-tight mb-6" style={{ fontSize: 'clamp(2.5rem, 6vw, 4.5rem)', letterSpacing: '-0.03em' }}>
              SSYT<span style={{ color: '#FF6B35' }}>2026</span>
            </h1>

            <p className="text-white text-2xl md:text-3xl font-medium mb-6" style={{ letterSpacing: '-0.01em' }}>
              {teamsCount} Teams. {regattasCount} Regattas. <span className="text-white/60">1 Racing Season.</span>
            </p>

            <p className="text-white/70 text-lg leading-relaxed max-w-2xl mb-10">
              Programul sportiv SetSail pentru cursanții care vor să treacă de la sailing recreațional la regatta sailing. Marea Neagră. Beneteau First 34.7.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/ssyt/apply"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white hover:opacity-90 transition"
                style={{ background: '#FF6B35' }}
              >
                Aplică în program
                <ArrowRight size={16} />
              </Link>
              <Link
                href="/ssyt/teams"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white border hover:bg-white/5 transition"
                style={{ borderColor: 'rgba(255,255,255,0.2)' }}
              >
                Vezi echipele
              </Link>
              <Link
                href="/ssyt/portal/login"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white/70 hover:text-white transition"
              >
                Intră în portal
              </Link>
            </div>
          </div>
        </div>

        {/* Decoratiune subtila in fundal */}
        <div className="absolute right-0 top-0 w-1/2 h-full pointer-events-none opacity-[0.04]" style={{
          background: 'radial-gradient(circle at 80% 50%, #FF6B35 0%, transparent 70%)'
        }}></div>
      </section>

      {/* CE ESTE SSYT2026 */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="max-w-2xl mb-12">
          <p className="text-sm font-medium uppercase tracking-wider mb-3" style={{ color: '#FF6B35' }}>Despre program</p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Nu un curs. O echipă.
          </h2>
          <p className="text-gray-600 text-lg leading-relaxed">
            SSYT2026 nu e o serie de evenimente separate. E un sezon competițional structurat, cu nucleu fix de echipă, antrenamente și regate oficiale pe Marea Neagră.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<Users size={20} />} value={teamsCount.toString()} label="Echipe" />
          <StatCard icon={<Sailboat size={20} />} value="4" label="Beneteau First 34.7" />
          <StatCard icon={<Calendar size={20} />} value={regattasCount.toString()} label="Regatte" />
          <StatCard icon={<Trophy size={20} />} value="9+1" label="Cursanți + skipper / echipă" />
        </div>
      </section>

      {/* ECHIPE PREVIEW */}
      <section className="max-w-7xl mx-auto px-6 pb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>Flota 2026</p>
            <h2 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>Echipele</h2>
          </div>
          <Link href="/ssyt/teams" className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all" style={{ color: '#0a1628' }}>
            Vezi toate <ArrowRight size={14} />
          </Link>
        </div>

        {teams.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {teams.slice(0, 4).map((t) => (
              <TeamPreviewCard key={t.id} team={t} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            <Anchor size={28} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Echipele sezonului SSYT2026 vor fi anunțate în curând.</p>
          </div>
        )}
      </section>

      {/* CALENDAR PREVIEW */}
      <section style={{ background: '#fff' }} className="border-t border-b" >
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="flex items-end justify-between mb-8">
            <div>
              <p className="text-sm font-medium uppercase tracking-wider mb-2" style={{ color: '#FF6B35' }}>Sezon</p>
              <h2 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>Calendar 2026</h2>
            </div>
            <Link href="/ssyt/calendar" className="text-sm font-medium inline-flex items-center gap-1 hover:gap-2 transition-all" style={{ color: '#0a1628' }}>
              Calendar complet <ArrowRight size={14} />
            </Link>
          </div>

          {regattas.length > 0 ? (
            <div className="space-y-3">
              {regattas.slice(0, 6).map((r, idx) => (
                <CalendarRow key={r.id} regatta={r} index={idx + 1} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#f8f9fa' }}>
              <Calendar size={28} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Calendarul oficial al sezonului SSYT2026 va fi publicat în curând.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="rounded-2xl p-10 md:p-16 text-center" style={{ background: '#0a1628' }}>
          <h2 className="text-white text-3xl md:text-4xl font-semibold tracking-tight mb-4" style={{ letterSpacing: '-0.02em' }}>
            Vrei să faci parte dintr-o echipă de regatta SetSail?
          </h2>
          <p className="text-white/60 text-lg mb-8 max-w-xl mx-auto">
            Aplicarea pentru sezonul 2026 este deschisă. Te înscrii, urmează evaluarea și alocarea în echipă.
          </p>
          <Link
            href="/ssyt/apply"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-md font-medium text-white hover:opacity-90 transition"
            style={{ background: '#FF6B35' }}
          >
            Aplică pentru SSYT2026
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------
// SUBCOMPONENTE locale
// ---------------------------------------------------------------------------

function StatCard({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="p-5 rounded-lg" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center gap-2 mb-3" style={{ color: '#FF6B35' }}>
        {icon}
      </div>
      <div className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>{value}</div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  )
}

function TeamPreviewCard({ team }: { team: any }) {
  const color = team.color_primary || '#4A5568'
  return (
    <Link
      href={`/ssyt/teams/${team.slug || team.id}`}
      className="block rounded-lg overflow-hidden hover:shadow-md transition group"
      style={{ background: '#fff', border: '1px solid #e5e7eb' }}
    >
      <div className="h-24 flex items-center justify-center" style={{ background: color }}>
        <span className="text-white font-semibold text-lg tracking-tight">{team.short_name || team.name}</span>
      </div>
      <div className="p-4">
        <div className="font-medium text-gray-900 mb-1">{team.name}</div>
        {team.slogan && <div className="text-xs text-gray-500 mb-2">{team.slogan}</div>}
        <div className="text-xs text-gray-400 group-hover:text-gray-700 transition">Vezi echipa →</div>
      </div>
    </Link>
  )
}

function CalendarRow({ regatta, index }: { regatta: any; index: number }) {
  const statusColors: Record<string, string> = {
    upcoming: '#3B82F6',
    live: '#EF4444',
    completed: '#10B981',
    cancelled: '#6B7280',
    draft: '#9CA3AF',
  }
  const statusColor = statusColors[regatta.status] || '#6B7280'
  const date = new Date(regatta.start_date)
  const monthShort = date.toLocaleString('ro-RO', { month: 'short' })
  const day = date.getDate()

  return (
    <Link
      href={`/ssyt/regattas/${regatta.slug || regatta.id}`}
      className="flex items-center gap-4 p-4 rounded-lg hover:bg-gray-50 transition"
      style={{ background: '#f8f9fa', border: '1px solid #e5e7eb' }}
    >
      <div className="flex-shrink-0 w-12 h-12 rounded flex flex-col items-center justify-center text-xs font-medium" style={{ background: '#0a1628', color: '#fff' }}>
        <span className="text-[10px] uppercase opacity-70">{monthShort}</span>
        <span className="text-base font-semibold leading-none">{day}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{regatta.name}</div>
        <div className="text-xs text-gray-500">{regatta.location || 'Marea Neagră'}</div>
      </div>
      <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${statusColor}15`, color: statusColor }}>
        {regatta.status}
      </span>
    </Link>
  )
}
