'use client'
import { Lock, Archive } from 'lucide-react'
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

const STATUS_COLORS: Record<string, string> = {
  confirmed: '#10B981',
  declined: '#EF4444',
  tentative: '#9CA3AF',
  pending: '#F59E0B',
}

const STATUS_LETTER: Record<string, string> = {
  confirmed: 'P',
  declined: 'A',
  tentative: '?',
  pending: '·',
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: 'Prezent',
  declined: 'Absent',
  tentative: 'Indecis',
  pending: 'În așteptare',
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
  if (t === 'core') return 'core'
  if (t === 'occasional') return 'occ'
  if (t === 'punctual') return '1×'
  return ''
}

function attendanceTypeColor(t: string | null): string {
  if (t === 'core') return '#FF6B35'
  if (t === 'occasional') return '#00A8B5'
  if (t === 'punctual') return '#a855f7'
  return '#94a3b8'
}

type TeamKey = string

type TeamSnapshot = {
  key: TeamKey
  team_id: string | null
  name: string
  short_name: string | null
  color: string
}

type Participant = {
  key: string
  participant_id: string | null
  full_name: string
  email: string | null
  attendance_type: string | null // tip preponderent (din ultimul rând)
}

export default function ArchiveView({
  regattas,
  archivedRows,
}: {
  regattas: Regatta[]
  archivedRows: ArchivedRow[]
}) {
  const frozenRegattas = regattas
    .filter(isFrozen)
    .sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime())

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

  const frozenRegattaIds = new Set(frozenRegattas.map((r) => r.id))
  const rows = archivedRows.filter((r) => frozenRegattaIds.has(r.regatta_id))

  // Grupare pe team (team_id || archived_team_name)
  const teamMap = new Map<TeamKey, TeamSnapshot>()
  const participantsByTeam = new Map<TeamKey, Map<string, Participant>>()
  const cellByTeamPersonRegatta = new Map<string, ArchivedRow>()

  for (const row of rows) {
    const teamKey: TeamKey = row.team_id ?? `name:${row.archived_team_name ?? 'unknown'}`
    if (!teamMap.has(teamKey)) {
      teamMap.set(teamKey, {
        key: teamKey,
        team_id: row.team_id,
        name: row.archived_team_name || '—',
        short_name: row.archived_team_short_name,
        color: row.archived_team_color || '#94a3b8',
      })
    }
    const personKey =
      row.participant_id ??
      `email:${row.archived_participant_email ?? row.archived_participant_full_name ?? row.id}`

    if (!participantsByTeam.has(teamKey)) participantsByTeam.set(teamKey, new Map())
    const peopleMap = participantsByTeam.get(teamKey)!
    if (!peopleMap.has(personKey)) {
      peopleMap.set(personKey, {
        key: personKey,
        participant_id: row.participant_id,
        full_name: row.archived_participant_full_name || '(participant șters)',
        email: row.archived_participant_email,
        attendance_type: row.attendance_type,
      })
    } else {
      // pastrez ultimul tip non-null
      const existing = peopleMap.get(personKey)!
      if (row.attendance_type && !existing.attendance_type) {
        existing.attendance_type = row.attendance_type
      }
    }

    cellByTeamPersonRegatta.set(`${teamKey}|${personKey}|${row.regatta_id}`, row)
  }

  // Lista finală de echipe sortată: cele cu team_id real primele, alfabetic
  const teams: TeamSnapshot[] = Array.from(teamMap.values()).sort((a, b) => {
    if (a.team_id && !b.team_id) return -1
    if (!a.team_id && b.team_id) return 1
    return a.name.localeCompare(b.name, 'ro')
  })

  return (
    <div>
      <div
        className="rounded-md px-4 py-3 mb-4 text-xs flex items-center gap-2"
        style={{ background: '#fff7ed', color: '#9a3412', border: '1px solid #fed7aa' }}
      >
        <Archive size={14} />
        <span>
          <strong>Arhivă:</strong> datele de mai jos sunt înghețate. Numele participanților și
          echipelor se păstrează chiar dacă sunt scoși ulterior din sezon.
        </span>
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <th className="text-left px-3 py-2 sticky left-0 z-10" style={{ background: '#f8f9fa', minWidth: 240 }}>
                <span className="uppercase tracking-wider text-gray-500 font-medium">Membru</span>
              </th>
              {frozenRegattas.map((r) => {
                const d = new Date(r.start_date)
                return (
                  <th key={r.id} className="px-2 py-2 text-center" style={{ minWidth: 100 }}>
                    <Link href={`/ssyt/admin/regattas/${r.id}`} className="block hover:underline">
                      <div className="text-[10px] uppercase text-gray-400 flex items-center justify-center gap-1">
                        {d.toLocaleString('ro-RO', { month: 'short' })}
                        <Lock size={9} />
                      </div>
                      <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>
                        {d.getDate()}{r.end_date && new Date(r.end_date).getDate() !== d.getDate() ? `-${new Date(r.end_date).getDate()}` : ''}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[100px]" title={r.name}>
                        {r.short_name || r.name.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {teams.map((team) => {
              const peopleMap = participantsByTeam.get(team.key)
              if (!peopleMap || peopleMap.size === 0) return null
              const people: Participant[] = Array.from(peopleMap.values()).sort((a, b) =>
                a.full_name.localeCompare(b.full_name, 'ro')
              )
              return (
                <>
                  <tr key={`hdr-${team.key}`} style={{ background: team.color }}>
                    <td
                      colSpan={frozenRegattas.length + 1}
                      className="px-3 py-2 text-white font-semibold sticky left-0 z-10"
                      style={{ background: team.color }}
                    >
                      {team.team_id ? (
                        <Link href={`/ssyt/admin/teams/${team.team_id}`} className="hover:underline">
                          {team.name}
                        </Link>
                      ) : (
                        <span>{team.name}</span>
                      )}
                      <span className="text-white/70 text-xs font-normal ml-2">
                        ({people.length} {people.length === 1 ? 'persoană' : 'persoane'})
                      </span>
                      {!team.team_id && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,255,255,0.18)' }}>
                          echipă ștearsă
                        </span>
                      )}
                    </td>
                  </tr>
                  {people.map((p) => (
                    <tr key={`${team.key}-${p.key}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td className="px-3 py-2 sticky left-0 z-10" style={{ background: '#fff' }}>
                        <div className="flex items-center gap-2 flex-wrap">
                          {p.participant_id ? (
                            <Link
                              href={`/ssyt/admin/participants/${p.participant_id}`}
                              className="hover:underline font-medium"
                              style={{ color: '#0a1628' }}
                            >
                              {p.full_name}
                            </Link>
                          ) : (
                            <span className="font-medium italic text-gray-400">{p.full_name}</span>
                          )}
                          {p.attendance_type && (
                            <span
                              className="text-[9px] uppercase tracking-wider px-1 py-0.5 rounded"
                              style={{
                                background: attendanceTypeColor(p.attendance_type) + '20',
                                color: attendanceTypeColor(p.attendance_type),
                              }}
                              title={p.attendance_type}
                            >
                              {attendanceTypeLabel(p.attendance_type)}
                            </span>
                          )}
                        </div>
                        {p.email && (
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[220px]">
                            {p.email}
                          </div>
                        )}
                      </td>
                      {frozenRegattas.map((r) => {
                        const cell = cellByTeamPersonRegatta.get(`${team.key}|${p.key}|${r.id}`)
                        const status = cell?.confirmation_status
                        const color = status ? STATUS_COLORS[status] : null
                        const letter = status ? STATUS_LETTER[status] : ''
                        return (
                          <td key={r.id} className="p-1">
                            <div className="flex items-center justify-center">
                              {color ? (
                                <span
                                  className="inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold"
                                  style={{ background: color + '25', color }}
                                  title={STATUS_LABEL[status!] ?? status!}
                                >
                                  {letter}
                                </span>
                              ) : (
                                <span className="inline-block w-6 h-6 rounded" style={{ background: '#f1f5f9' }} title="fără răspuns" />
                              )}
                            </div>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </>
              )
            })}
          </tbody>
        </table>

        <div className="px-3 py-3 text-xs text-gray-500 border-t" style={{ background: '#f8f9fa' }}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-medium">Legendă:</span>
            <LegendItem letter="P" color="#10B981" label="Prezent" />
            <LegendItem letter="A" color="#EF4444" label="Absent" />
            <LegendItem letter="?" color="#9CA3AF" label="Indecis" />
            <span className="inline-flex items-center gap-1.5 ml-2">
              <span className="inline-block w-3 h-3 rounded" style={{ background: '#f1f5f9' }} />
              <span>fără răspuns</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendItem({ letter, color, label }: { letter: string; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center justify-center w-5 h-5 rounded text-[9px] font-bold"
        style={{ background: color + '25', color }}
      >
        {letter}
      </span>
      <span>{label}</span>
    </span>
  )
}
