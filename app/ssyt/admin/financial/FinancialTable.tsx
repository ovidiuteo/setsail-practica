'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

type Row = {
  id: string
  membership_type: string
  planned_regattas_count: number | null
  planned_regattas_note: string | null
  agreed_price: number | null
  advance_paid: number | null
  total_paid: number | null
  payment_status: string
  payment_notes: string | null
  general_notes: string | null
  team: { id: string; name: string; short_name: string | null; color_primary: string | null } | { id: string; name: string; short_name: string | null; color_primary: string | null }[] | null
  participant: { id: string; full_name: string; first_name: string; last_name: string; email: string | null; phone: string | null } | { id: string; full_name: string; first_name: string; last_name: string; email: string | null; phone: string | null }[] | null
}

const STATUS_OPTIONS = [
  { value: 'unknown', label: 'unknown' },
  { value: 'unpaid', label: 'unpaid' },
  { value: 'advance', label: 'advance' },
  { value: 'partial', label: 'partial' },
  { value: 'paid', label: 'paid' },
  { value: 'not_invoiced', label: 'not_invoiced' },
]

const STATUS_COLORS: Record<string, string> = {
  paid: '#10B981',
  partial: '#F59E0B',
  advance: '#3B82F6',
  unpaid: '#EF4444',
  unknown: '#9CA3AF',
  not_invoiced: '#8B5CF6',
}

function asObject<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  return Array.isArray(v) ? (v[0] ?? null) : v
}

export default function FinancialTable({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [filterTeam, setFilterTeam] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  async function saveField(id: string, field: string, value: string) {
    const cleanValue = value === '' ? null : value
    const payload: any = { [field]: cleanValue }
    // Pentru numeric, convertesc string la number
    if (['agreed_price', 'advance_paid', 'total_paid', 'planned_regattas_count'].includes(field) && cleanValue !== null) {
      payload[field] = Number(cleanValue)
    }
    const { error } = await supabase.from('ssyt_team_memberships').update(payload).eq('id', id)
    if (error) {
      alert(error.message)
      throw error
    }
    router.refresh()
  }

  // Filtre
  const teams = Array.from(new Set(rows.map((r) => {
    const t = asObject(r.team)
    return t?.id
  }).filter(Boolean))) as string[]

  const filtered = rows.filter((r) => {
    const t = asObject(r.team)
    if (filterTeam !== 'all' && t?.id !== filterTeam) return false
    if (filterStatus !== 'all' && r.payment_status !== filterStatus) return false
    return true
  })

  return (
    <div>
      {/* Filtre */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <select
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border"
          style={{ borderColor: '#e5e7eb', background: '#fff' }}
        >
          <option value="all">Toate echipele</option>
          {teams.map((id) => {
            const team = asObject(rows.find((r) => {
              const t = asObject(r.team)
              return t?.id === id
            })?.team)
            return <option key={id} value={id}>{team?.name}</option>
          })}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="px-3 py-1.5 text-sm rounded-md border"
          style={{ borderColor: '#e5e7eb', background: '#fff' }}
        >
          <option value="all">Toate statusurile</option>
          {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <span className="text-xs text-gray-500 ml-auto">
          {filtered.length} din {rows.length} membri
        </span>
      </div>

      {/* Tabel */}
      <div className="rounded-lg overflow-x-auto" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <table className="w-full text-sm" style={{ minWidth: 1400 }}>
          <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Membru</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
              <th className="text-center px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
              <th className="text-center px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Regate</th>
              <th className="text-center px-2 py-2 text-xs font-medium uppercase tracking-wider" style={{ color: '#FF6B35' }}>Status</th>
              <th className="text-right px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Preț (€)</th>
              <th className="text-right px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Avans (€)</th>
              <th className="text-right px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Plătit (€)</th>
              <th className="text-right px-2 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Rest (€)</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Note plată</th>
              <th className="text-left px-3 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Note general</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const team = asObject(r.team)
              const participant = asObject(r.participant)
              const price = Number(r.agreed_price || 0)
              const advance = Number(r.advance_paid || 0)
              const paid = Number(r.total_paid || 0)
              const totalIncasat = advance + paid
              const rest = price - totalIncasat
              const statusColor = STATUS_COLORS[r.payment_status] || '#9CA3AF'

              return (
                <tr key={r.id} className="hover:bg-gray-50" style={{ borderTop: '1px solid #e5e7eb' }}>
                  <td className="px-3 py-2">
                    {participant && (
                      <Link href={`/ssyt/admin/participants/${participant.id}`} className="font-medium hover:underline text-xs" style={{ color: '#0a1628' }}>
                        {participant.full_name}
                      </Link>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {team && (
                      <Link href={`/ssyt/admin/teams/${team.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <span className="w-2 h-2 rounded-full" style={{ background: team.color_primary || '#4A5568' }}></span>
                        <span style={{ color: '#0a1628' }}>{team.short_name || team.name}</span>
                      </Link>
                    )}
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider" style={{
                      background: r.membership_type === 'core' ? 'rgba(255,107,53,0.12)' : 'rgba(0,168,181,0.12)',
                      color: r.membership_type === 'core' ? '#FF6B35' : '#00A8B5',
                    }}>
                      {r.membership_type}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-center text-xs">
                    <EditableField
                      value={r.planned_regattas_count}
                      onSave={(v) => saveField(r.id, 'planned_regattas_count', v)}
                      type="number"
                      placeholder="—"
                      displayClassName="tabular-nums font-medium"
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: `${statusColor}15`, color: statusColor }}>
                      <EditableField
                        value={r.payment_status}
                        onSave={(v) => saveField(r.id, 'payment_status', v)}
                        type="select"
                        options={STATUS_OPTIONS}
                        formatDisplay={(v) => STATUS_OPTIONS.find(o => o.value === v)?.label || String(v)}
                      />
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums">
                    <EditableField
                      value={r.agreed_price}
                      onSave={(v) => saveField(r.id, 'agreed_price', v)}
                      type="number"
                      placeholder="—"
                      displayClassName="tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums">
                    <EditableField
                      value={r.advance_paid}
                      onSave={(v) => saveField(r.id, 'advance_paid', v)}
                      type="number"
                      placeholder="0"
                      displayClassName="tabular-nums"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums">
                    <EditableField
                      value={r.total_paid}
                      onSave={(v) => saveField(r.id, 'total_paid', v)}
                      type="number"
                      placeholder="0"
                      displayClassName="tabular-nums font-medium text-green-600"
                    />
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums">
                    {price > 0 ? (
                      <span className="font-semibold" style={{ color: rest > 0 ? '#FF6B35' : '#10B981' }}>
                        {rest.toFixed(0)}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ maxWidth: 200 }}>
                    <EditableField
                      value={r.payment_notes}
                      onSave={(v) => saveField(r.id, 'payment_notes', v)}
                      placeholder="—"
                      displayClassName="text-gray-700 truncate block"
                    />
                  </td>
                  <td className="px-3 py-2 text-xs" style={{ maxWidth: 200 }}>
                    <EditableField
                      value={r.general_notes}
                      onSave={(v) => saveField(r.id, 'general_notes', v)}
                      placeholder="—"
                      displayClassName="text-gray-700 truncate block"
                    />
                  </td>
                </tr>
              )
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="text-center py-8 text-gray-400 italic">
                  Niciun membru cu filtrele selectate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-gray-500">
        💡 Click pe oricare câmp pentru a-l edita. <strong>Rest</strong> se calculează automat din Preț - (Avans + Plătit).
      </p>
    </div>
  )
}