import Link from 'next/link'
import { DollarSign, Wallet } from 'lucide-react'
import { supabase, getActiveSeason } from '@/lib/ssyt/supabase'
import FinancialTable from './FinancialTable'

export const revalidate = 0

export default async function AdminFinancialPage() {
  const season = await getActiveSeason()
  if (!season) {
    return <div className="px-8 py-16 text-center text-gray-500">Niciun sezon activ.</div>
  }

  const { data: memberships } = await supabase
    .from('ssyt_team_memberships')
    .select(`
      id, membership_type, status,
      planned_regattas_count, planned_regattas_note,
      agreed_price, advance_paid, total_paid, payment_status, payment_notes, general_notes,
      team:ssyt_teams(id, name, short_name, color_primary, display_order),
      participant:ssyt_participants(id, full_name, first_name, last_name, email, phone)
    `)
    .eq('status', 'active')

  const rows = (memberships || []).slice().sort((a: any, b: any) => {
    const tA = Array.isArray(a.team) ? a.team[0] : a.team
    const tB = Array.isArray(b.team) ? b.team[0] : b.team
    const orderDiff = (tA?.display_order ?? 999) - (tB?.display_order ?? 999)
    if (orderDiff !== 0) return orderDiff
    const pA = Array.isArray(a.participant) ? a.participant[0] : a.participant
    const pB = Array.isArray(b.participant) ? b.participant[0] : b.participant
    return (pA?.full_name || '').localeCompare(pB?.full_name || '', 'ro')
  })

  const teamTotals: Record<string, { name: string; color: string; totalAgreed: number; totalPaid: number; totalAdvance: number; members: number; teamId: string }> = {}
  for (const m of rows as any[]) {
    const t = Array.isArray(m.team) ? m.team[0] : m.team
    if (!t) continue
    const key = t.id
    if (!teamTotals[key]) {
      teamTotals[key] = { name: t.name, color: t.color_primary || '#4A5568', totalAgreed: 0, totalPaid: 0, totalAdvance: 0, members: 0, teamId: t.id }
    }
    teamTotals[key].totalAgreed += Number(m.agreed_price || 0)
    teamTotals[key].totalPaid += Number(m.total_paid || 0)
    teamTotals[key].totalAdvance += Number(m.advance_paid || 0)
    teamTotals[key].members++
  }

  const grandTotalAgreed = Object.values(teamTotals).reduce((s, t) => s + t.totalAgreed, 0)
  const grandTotalPaid = Object.values(teamTotals).reduce((s, t) => s + t.totalPaid + t.totalAdvance, 0)
  const grandTotalMembers = Object.values(teamTotals).reduce((s, t) => s + t.members, 0)

  return (
    <div className="px-8 py-8 max-w-[1600px]">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>
          {season.name}
        </p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          <Wallet size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
          Situație financiară
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {grandTotalMembers} membri activi în {Object.keys(teamTotals).length} echipe.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {Object.values(teamTotals).map((t) => {
          const rest = t.totalAgreed - (t.totalPaid + t.totalAdvance)
          return (
            <Link key={t.teamId} href={`/ssyt/admin/teams/${t.teamId}`} className="block rounded-lg p-4 hover:shadow-md transition" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: t.color }}></span>
                <span className="font-semibold text-sm" style={{ color: '#0a1628' }}>{t.name}</span>
                <span className="ml-auto text-xs text-gray-500">{t.members} membri</span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Total convenit</span>
                  <span className="font-medium tabular-nums" style={{ color: '#0a1628' }}>{t.totalAgreed.toFixed(0)} €</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Încasat</span>
                  <span className="font-medium tabular-nums text-green-600">{(t.totalPaid + t.totalAdvance).toFixed(0)} €</span>
                </div>
                <div className="flex justify-between pt-1.5 border-t" style={{ borderColor: '#f3f4f6' }}>
                  <span className="font-medium" style={{ color: '#0a1628' }}>Rest</span>
                  <span className="font-bold tabular-nums" style={{ color: rest > 0 ? '#FF6B35' : '#10B981' }}>{rest.toFixed(0)} €</span>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      <div className="rounded-lg p-4 mb-6 flex items-center justify-between" style={{ background: '#0a1628', color: '#fff' }}>
        <div className="flex items-center gap-3">
          <DollarSign size={20} style={{ color: '#FF6B35' }} />
          <span className="font-semibold tracking-tight">Total sezon</span>
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-white/60 mr-2">Convenit:</span>
            <span className="font-bold tabular-nums">{grandTotalAgreed.toFixed(0)} €</span>
          </div>
          <div>
            <span className="text-white/60 mr-2">Încasat:</span>
            <span className="font-bold tabular-nums text-green-400">{grandTotalPaid.toFixed(0)} €</span>
          </div>
          <div>
            <span className="text-white/60 mr-2">Rest:</span>
            <span className="font-bold tabular-nums" style={{ color: '#FF6B35' }}>{(grandTotalAgreed - grandTotalPaid).toFixed(0)} €</span>
          </div>
        </div>
      </div>

      <FinancialTable rows={rows as any[]} />
    </div>
  )
}