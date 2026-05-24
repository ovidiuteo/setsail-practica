'use client'
import { Lock, Users, CheckCircle2, XCircle, HelpCircle, Calendar } from 'lucide-react'
import Link from 'next/link'

type Regatta = {
  id: string
  name: string
  short_name: string | null
  start_date: string
  end_date: string | null
  status: string
}

type ArchivedRow = {
  id: string
  regatta_id: string
  participant_id: string | null
  team_id: string | null
  confirmation_status: string
  attendance_type: string | null
  archived_participant_full_name: string | null
  archived_participant_email: string | null
  archived_team_name: string | null
  archived_team_short_name: string | null
  archived_team_color: string | null
  archived_at: string | null
}

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  confirmed: { label: 'Prezent', color: '#10B981', icon: CheckCircle2 },
  declined: { label: 'Absent', color: '#EF4444', icon: XCircle },
  tentative: { label: 'Indecis', color: '#9CA3AF', icon: HelpCircle },
  pending: { label: 'În așteptare', color: '#F59E0B', icon: HelpCircle },
}

function isFrozen(r: Regatta): boolean {
  if (r.status === 'completed' || r.status === 'cancelled') return true
  if (r.end_date) {
    const end = new Date(r.end_date)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    if (end < today) return true
  }
  return false
}

function attendanceTypeLabel(t: string | null): string {
  if (!t) return ''
  if (t === 'core') return 'core'
  if (t === 'occasional') return 'ocazional'
  if (t === 'punctual') return 'one-time'
  return t
}

export default function ArchiveView({
  regattas,
  archivedRows,
}: {
  regattas: Regatta[]
  archivedRows: ArchivedRow[]
}) {
  const frozenRegattas = regattas.filter(isFrozen)

  if (frozenRegattas.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-12 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <Lock size={28} className="mx-auto mb-2 text-gray-300" />
        <p className="text-sm text-gray-500">
          Nu există încă regate finalizate. Arhiva apare după ce o regată își termină perioada
          (end_date &lt; azi) sau este marcată manual ca <code>completed</code>.
        </p>
      </div>
    )
  }

  // Grupez rândurile arhivate per regată
  const rowsByRegatta: Record<string, ArchivedRow[]> = {}
  for (const r of archivedRows) {
    if (!rowsByRegatta[r.regatta_id]) rowsByRegatta[r.regatta_id] = []
    rowsByRegatta[r.regatta_id].push(r)
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-md px-4 py-3 text-xs"
        style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}
      >
        <strong>Arhivă:</strong> datele de mai jos sunt înghețate. Numele participanților se păstrează
        chiar dacă sunt scoși ulterior din echipă sau șterși din sezon.
      </div>

      {frozenRegattas.map((r) => {
        const rows = rowsByRegatta[r.id] ?? []
        const confirmed = rows.filter((x) => x.confirmation_status === 'confirmed')
        const declined = rows.filter((x) => x.confirmation_status === 'declined')
        const tentative = rows.filter((x) => x.confirmation_status === 'tentative' || x.confirmation_status === 'pending')

        const startDate = new Date(r.start_date)
        const endDate = r.end_date ? new Date(r.end_date) : null

        return (
          <section
            key={r.id}
            className="rounded-lg border overflow-hidden"
            style={{ borderColor: '#e2e8f0', background: '#fff' }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between flex-wrap gap-2"
              style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Lock size={14} style={{ color: '#9a3412' }} />
                <Link
                  href={`/ssyt/admin/regattas/${r.id}`}
                  className="font-semibold text-sm hover:underline"
                  style={{ color: '#0a1628' }}
                >
                  {r.name}
                </Link>
                <span className="text-xs text-gray-500">
                  <Calendar size={11} className="inline align-middle mr-1" />
                  {startDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {endDate && endDate.getTime() !== startDate.getTime() &&
                    ` – ${endDate.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}`}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="inline-flex items-center gap-1">
                  <Users size={11} />
                  <strong style={{ color: '#0a1628' }}>{rows.length}</strong> total
                </span>
                <span className="inline-flex items-center gap-1">
                  <CheckCircle2 size={11} style={{ color: '#10B981' }} />
                  <strong style={{ color: '#10B981' }}>{confirmed.length}</strong> prezent
                </span>
                {declined.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <XCircle size={11} style={{ color: '#EF4444' }} />
                    <strong style={{ color: '#EF4444' }}>{declined.length}</strong> absent
                  </span>
                )}
                {tentative.length > 0 && (
                  <span className="inline-flex items-center gap-1">
                    <HelpCircle size={11} style={{ color: '#9CA3AF' }} />
                    <strong style={{ color: '#9CA3AF' }}>{tentative.length}</strong> indecis
                  </span>
                )}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                Nicio înregistrare pentru această regată.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: '#fcfcfd', color: '#475569' }}>
                    <th className="px-4 py-2 text-left font-medium">Participant</th>
                    <th className="px-4 py-2 text-left font-medium">Echipă</th>
                    <th className="px-4 py-2 text-left font-medium">Tip</th>
                    <th className="px-4 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const meta = STATUS_META[row.confirmation_status] ?? STATUS_META.tentative
                    const Icon = meta.icon
                    const name = row.archived_participant_full_name ?? (row.participant_id ? '(participant șters)' : '—')
                    const teamName = row.archived_team_name ?? row.archived_team_short_name ?? '—'
                    const teamColor = row.archived_team_color ?? '#94a3b8'

                    return (
                      <tr key={row.id} className="border-t" style={{ borderColor: '#f1f5f9' }}>
                        <td className="px-4 py-1.5">
                          <div className="font-medium" style={{ color: '#0a1628' }}>{name}</div>
                          {row.archived_participant_email && (
                            <div className="text-[10px] text-gray-400 font-mono">{row.archived_participant_email}</div>
                          )}
                        </td>
                        <td className="px-4 py-1.5">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="inline-block w-2 h-2 rounded-full" style={{ background: teamColor }} />
                            {teamName}
                          </span>
                        </td>
                        <td className="px-4 py-1.5 text-gray-500">
                          {attendanceTypeLabel(row.attendance_type)}
                        </td>
                        <td className="px-4 py-1.5 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium"
                            style={{ background: meta.color + '20', color: meta.color }}
                          >
                            <Icon size={10} />
                            {meta.label}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>
        )
      })}
    </div>
  )
}
