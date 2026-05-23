import Link from 'next/link'
import { BarChart3, Users, Activity, TrendingUp, AlertTriangle, Trophy, Mail, ExternalLink } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import StatsConnectionsChart from './StatsConnectionsChart'

export const dynamic = 'force-dynamic'

function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const diffMs = Date.now() - d.getTime()
  const diffH = Math.floor(diffMs / 3600000)
  if (diffH < 1) return 'acum'
  if (diffH < 24) return `acum ${diffH}h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 7) return `acum ${diffD}z`
  return d.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
}

export default async function AdminStatsPage() {
  const { data: stats } = await supabase.rpc('ssyt_portal_stats')

  const overview = stats?.overview || {}
  const byTeam = stats?.by_team || []
  const connectionsByDay = stats?.connections_by_day || []
  const notConnected = stats?.not_connected || []
  const mostActive = stats?.most_active || []

  const adoptionRate = overview.total_participants > 0
    ? Math.round((overview.connected / overview.total_participants) * 100)
    : 0

  return (
    <div className="px-8 py-8 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-lg flex items-center justify-center" style={{ background: '#0a1628' }}>
          <BarChart3 size={22} className="text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
            Statistici portal
          </h1>
          <p className="text-sm text-gray-500">Activitatea participanților în portalul SSYT2026</p>
        </div>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={<Users size={18} />}
          label="Conectați"
          value={`${overview.connected || 0} / ${overview.total_participants || 0}`}
          sub={`${adoptionRate}% rată de adopție`}
          color="#FF6B35"
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Total sesiuni"
          value={overview.total_sessions || 0}
          sub="conectări cumulate"
          color="#00A8B5"
        />
        <StatCard
          icon={<TrendingUp size={18} />}
          label="Activi 7 zile"
          value={overview.active_last_7d || 0}
          sub="persoane unice"
          color="#10B981"
        />
        <StatCard
          icon={<Activity size={18} />}
          label="Activi 24h"
          value={overview.active_last_24h || 0}
          sub="persoane unice"
          color="#3B82F6"
        />
      </div>

      {/* Adoptie pe echipe */}
      <div className="rounded-lg p-6 mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4">Adopție pe echipe</h2>
        <div className="space-y-4">
          {byTeam.map((t: any) => {
            const pct = t.total_members > 0 ? Math.round((t.connected_members / t.total_members) * 100) : 0
            return (
              <div key={t.short_name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ background: t.color_primary }}></span>
                    <span className="font-medium text-sm" style={{ color: '#0a1628' }}>{t.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {t.connected_members} / {t.total_members} <span className="text-xs">({pct}%)</span>
                  </span>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: '#f3f4f6' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: t.color_primary }}></div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Grafic conectari pe zile */}
      <div className="rounded-lg p-6 mb-8" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4">Conectări în ultimele 30 zile</h2>
        <StatsConnectionsChart data={connectionsByDay} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cei mai activi */}
        <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-1.5">
            <Trophy size={14} /> Cei mai activi
          </h2>
          <div className="space-y-2">
            {mostActive.map((p: any, idx: number) => {
              const seen = formatLastSeen(p.last_seen)
              return (
                <div key={idx} className="flex items-center gap-3 py-1.5">
                  <span className="w-6 text-center text-xs font-bold" style={{ color: idx < 3 ? '#FF6B35' : '#9CA3AF' }}>
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate" style={{ color: '#0a1628' }}>{p.full_name}</div>
                    <div className="text-xs text-gray-400">
                      {p.team || 'fără echipă'}
                      {seen && <span className="ml-1.5">· {seen}</span>}
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: '#0a1628' }}>{p.connections}</span>
                  <span className="text-xs text-gray-400">conectări</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Neconectați */}
        <div className="rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-4 flex items-center gap-1.5">
            <AlertTriangle size={14} /> Încă neconectați ({notConnected.length})
          </h2>
          <div className="space-y-1.5 max-h-96 overflow-y-auto">
            {notConnected.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Toți s-au conectat! 🎉</p>
            ) : (
              notConnected.map((p: any, idx: number) => {
                const firstName = (p.full_name || '').split(' ')[0]
                const mailto = !p.placeholder_email && p.email
                  ? `mailto:${encodeURIComponent(p.email)}?subject=${encodeURIComponent('SSYT2026 — Reminder portal')}&body=${encodeURIComponent(`Bună ${firstName},\n\nNu te-am văzut încă în portalul SSYT2026. Intră aici: https://practica.setsail.ro/ssyt/portal-login?email=${encodeURIComponent(p.email)}\n\nMulțumesc!`)}`
                  : null
                return (
                  <div key={idx} className="flex items-center gap-2 py-1 text-sm">
                    <div className="flex-1 min-w-0">
                      <span className="font-medium" style={{ color: '#0a1628' }}>{p.full_name}</span>
                      <span className="text-xs text-gray-400 ml-2">{p.team || 'fără echipă'}</span>
                    </div>
                    {p.placeholder_email ? (
                      <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                        email placeholder
                      </span>
                    ) : (
                      <>
                        <span className="text-xs text-gray-400 font-mono truncate max-w-[140px]" title={p.email}>{p.email}</span>
                        {mailto && (
                          <a
                            href={mailto}
                            title="Trimite reminder pe email"
                            className="shrink-0 p-1 rounded hover:bg-orange-50"
                            style={{ color: '#FF6B35' }}
                          >
                            <Mail size={13} />
                          </a>
                        )}
                        <a
                          href={`/ssyt/portal-login?email=${encodeURIComponent(p.email)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Deschide portalul în numele lui"
                          className="shrink-0 p-1 rounded hover:bg-gray-100"
                          style={{ color: '#64748b' }}
                        >
                          <ExternalLink size={13} />
                        </a>
                      </>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, color }: { icon: React.ReactNode; label: string; value: string | number; sub: string; color: string }) {
  return (
    <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center gap-2 mb-2" style={{ color }}>
        {icon}
        <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-2xl font-bold" style={{ color: '#0a1628' }}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  )
}
