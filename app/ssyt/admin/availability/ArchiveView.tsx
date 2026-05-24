'use client'
import { Lock, Archive, Crown } from 'lucide-react'
import Link from 'next/link'

type Regatta = {
  id: string
  name: string
  short_name: string | null
  start_date: string
  end_date: string | null
  status: string
}

type LiveTeam = {
  id: string
  name?: string | null
  short_name?: string | null
  color_primary?: string | null
  skipper_id?: string | null
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

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  confirmed: { bg: '#10B981', fg: '#fff', label: 'Prezent' },
  declined:  { bg: '#EF4444', fg: '#fff', label: 'Absent' },
  tentative: { bg: '#9CA3AF', fg: '#fff', label: 'Indecis' },
  pending:   { bg: '#F59E0B', fg: '#fff', label: 'În așteptare' },
}

const TYPE_RANK: Record<string, number> = {
  core: 0,
  occasional: 1,
  punctual: 2,
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
  skipper_id: string | null
}

type PersonAggregate = {
  key: string
  participant_id: string | null
  full_name: string
  email: string | null
  attendance_type: string | null // tipul predominant
}

export default function ArchiveView({
  regattas,
  archivedRows,
  teams,
}: {
  regattas: Regatta[]
  archivedRows: ArchivedRow[]
  teams: LiveTeam[]
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

  // Map team live (din ssyt_teams) pentru skipper_id
  const teamLiveById: Record<string, LiveTeam> = {}
  for (const t of teams) if (t.id) teamLiveById[t.id] = t

  // Agregare pe (team, persoană)
  const teamMap = new Map<TeamKey, TeamSnapshot>()
  const peopleByTeam = new Map<TeamKey, Map<string, PersonAggregate>>()
  const typeCountByPerson = new Map<string, Record<string, number>>() // teamKey|personKey → count per type
  const cellByTeamPersonRegatta = new Map<string, ArchivedRow>()

  for (const row of rows) {
    const teamKey: TeamKey = row.team_id ?? `name:${row.archived_team_name ?? 'unknown'}`
    if (!teamMap.has(teamKey)) {
      const live = row.team_id ? teamLiveById[row.team_id] : null
      teamMap.set(teamKey, {
        key: teamKey,
        team_id: row.team_id,
        name: row.archived_team_name || live?.name || '—',
        short_name: row.archived_team_short_name || live?.short_name || null,
        color: row.archived_team_color || live?.color_primary || '#94a3b8',
        skipper_id: live?.skipper_id ?? null,
      })
    }
    const personKey =
      row.participant_id ??
      `email:${row.archived_participant_email ?? row.archived_participant_full_name ?? row.id}`

    if (!peopleByTeam.has(teamKey)) peopleByTeam.set(teamKey, new Map())
    const peopleMap = peopleByTeam.get(teamKey)!
    if (!peopleMap.has(personKey)) {
      peopleMap.set(personKey, {
        key: personKey,
        participant_id: row.participant_id,
        full_name: row.archived_participant_full_name || '(participant șters)',
        email: row.archived_participant_email,
        attendance_type: null,
      })
    }

    // Count attendance types per persoana
    const ttKey = `${teamKey}|${personKey}`
    if (!typeCountByPerson.has(ttKey)) typeCountByPerson.set(ttKey, {})
    const counts = typeCountByPerson.get(ttKey)!
    if (row.attendance_type) {
      counts[row.attendance_type] = (counts[row.attendance_type] || 0) + 1
    }

    cellByTeamPersonRegatta.set(`${teamKey}|${personKey}|${row.regatta_id}`, row)
  }

  // Calc attendance_type predominant pentru fiecare persoana
  for (const [teamKey, peopleMap] of peopleByTeam) {
    for (const [personKey, person] of peopleMap) {
      const counts = typeCountByPerson.get(`${teamKey}|${personKey}`) || {}
      let best: string | null = null
      let bestCount = 0
      for (const [t, n] of Object.entries(counts)) {
        if (n > bestCount) { best = t; bestCount = n }
      }
      person.attendance_type = best
    }
  }

  // Sortare echipe (cu team_id live primele)
  const teamList: TeamSnapshot[] = Array.from(teamMap.values()).sort((a, b) => {
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
          <strong>Arhivă:</strong> rândurile sunt poziții fixe (Skipper, Crew 1, Crew 2 …) în
          fiecare echipă; sortare: core → ocazional → one-time, alfabetic. În fiecare celulă apare
          numele persoanei pe poziția și regata respectivă, colorat după status.
        </span>
      </div>

      <div className="rounded-lg overflow-x-auto" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <table className="text-xs" style={{ borderCollapse: 'collapse', minWidth: '100%' }}>
          <thead>
            <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
              <th className="text-left px-3 py-2 sticky left-0 z-10" style={{ background: '#f8f9fa', minWidth: 100 }}>
                <span className="uppercase tracking-wider text-gray-500 font-medium">Poziție</span>
              </th>
              {frozenRegattas.map((r) => {
                const d = new Date(r.start_date)
                return (
                  <th key={r.id} className="px-2 py-2 text-center" style={{ minWidth: 140 }}>
                    <Link href={`/ssyt/admin/regattas/${r.id}`} className="block hover:underline">
                      <div className="text-[10px] uppercase text-gray-400 flex items-center justify-center gap-1">
                        {d.toLocaleString('ro-RO', { month: 'short' })}
                        <Lock size={9} />
                      </div>
                      <div className="font-semibold text-sm" style={{ color: '#0a1628' }}>
                        {d.getDate()}{r.end_date && new Date(r.end_date).getDate() !== d.getDate() ? `-${new Date(r.end_date).getDate()}` : ''}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[140px]" title={r.name}>
                        {r.short_name || r.name.split(' ').slice(0, 2).join(' ')}
                      </div>
                    </Link>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {teamList.map((team) => {
              const peopleMap = peopleByTeam.get(team.key)
              if (!peopleMap || peopleMap.size === 0) return null
              const allPeople: PersonAggregate[] = Array.from(peopleMap.values())

              // 1. Skipper-ul (dacă există în echipa live)
              const skipperPerson = team.skipper_id
                ? allPeople.find((p) => p.participant_id === team.skipper_id) ?? null
                : null

              // 2. Restul: sortate core → occasional → punctual → alfabetic
              const rest = allPeople
                .filter((p) => p !== skipperPerson)
                .sort((a, b) => {
                  const ra = TYPE_RANK[a.attendance_type ?? ''] ?? 99
                  const rb = TYPE_RANK[b.attendance_type ?? ''] ?? 99
                  if (ra !== rb) return ra - rb
                  return a.full_name.localeCompare(b.full_name, 'ro')
                })

              const positions: { label: string; person: PersonAggregate | null }[] = []
              positions.push({ label: 'Skipper', person: skipperPerson })
              for (let i = 0; i < rest.length; i++) {
                positions.push({ label: `Crew ${i + 1}`, person: rest[i] })
              }

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
                        ({positions.filter((p) => p.person).length}{' '}
                        {positions.filter((p) => p.person).length === 1 ? 'persoană' : 'persoane'})
                      </span>
                      {!team.team_id && (
                        <span className="ml-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-semibold" style={{ background: 'rgba(255,255,255,0.18)' }}>
                          echipă ștearsă
                        </span>
                      )}
                    </td>
                  </tr>
                  {positions.map((pos, idx) => (
                    <tr key={`${team.key}-pos-${idx}`} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td className="px-3 py-1.5 sticky left-0 z-10 font-medium" style={{ background: '#fff' }}>
                        <div className="flex items-center gap-1.5 text-[11px]" style={{ color: '#475569' }}>
                          {pos.label === 'Skipper' && <Crown size={11} style={{ color: '#FF6B35' }} />}
                          {pos.label}
                        </div>
                      </td>
                      {frozenRegattas.map((r) => {
                        const cell = pos.person
                          ? cellByTeamPersonRegatta.get(`${team.key}|${pos.person.key}|${r.id}`)
                          : null
                        const status = cell?.confirmation_status
                        const meta = status ? STATUS_COLORS[status] : null
                        const nameToShow = pos.person?.full_name ?? ''
                        const personTypeColor = attendanceTypeColor(pos.person?.attendance_type ?? null)
                        const personTypeLabel = attendanceTypeLabel(pos.person?.attendance_type ?? null)
                        return (
                          <td key={r.id} className="p-1">
                            {pos.person ? (
                              meta ? (
                                <div
                                  className="rounded px-2 py-1 text-[10.5px] leading-tight"
                                  style={{ background: meta.bg + '30', borderLeft: `3px solid ${meta.bg}`, color: '#0a1628' }}
                                  title={`${nameToShow} — ${meta.label}`}
                                >
                                  <div className="font-medium truncate">{nameToShow}</div>
                                  <div className="flex items-center justify-between gap-1 mt-0.5">
                                    <span style={{ color: meta.bg, fontWeight: 600 }}>{meta.label}</span>
                                    {personTypeLabel && (
                                      <span
                                        className="text-[9px] uppercase tracking-wider px-1 py-0 rounded font-semibold"
                                        style={{ background: personTypeColor + '20', color: personTypeColor }}
                                      >
                                        {personTypeLabel}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div
                                  className="rounded px-2 py-1 text-[10.5px] text-gray-400 leading-tight"
                                  style={{ background: '#f8fafc', borderLeft: '3px solid #e2e8f0' }}
                                  title={`${nameToShow} — fără răspuns`}
                                >
                                  <div className="truncate">{nameToShow}</div>
                                  <div className="italic mt-0.5">—</div>
                                </div>
                              )
                            ) : (
                              <div className="rounded px-2 py-1 text-[10.5px] text-gray-300 italic text-center" style={{ background: '#fafafa' }}>
                                liber
                              </div>
                            )}
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
            <span className="font-medium">Legendă status:</span>
            <LegendItem color="#10B981" label="Prezent" />
            <LegendItem color="#EF4444" label="Absent" />
            <LegendItem color="#9CA3AF" label="Indecis" />
            <LegendItem color="#F59E0B" label="În așteptare" />
            <span className="text-gray-400">·</span>
            <span className="font-medium">Tip:</span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded" style={{ background: '#FF6B35' }} /> core
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded" style={{ background: '#00A8B5' }} /> occ
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded" style={{ background: '#a855f7' }} /> 1×
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block w-3 h-3 rounded"
        style={{ background: color + '30', borderLeft: `3px solid ${color}` }}
      />
      <span>{label}</span>
    </span>
  )
}
