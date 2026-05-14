'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Mail, Phone, Users, Search, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

type Participant = {
  id: string
  full_name: string
  email: string
  phone: string | null
  status: string
  team_id: string | null
  membership_type: string | null
}

type Team = {
  id: string
  name: string
  short_name: string
  slug: string
  color_primary: string
  display_order: number
}

type FilterValue = 'all_sections' | 'all_flat' | 'unassigned' | string
type SortKey = 'full_name' | 'email' | 'phone' | 'membership_type' | 'team'
type SortDir = 'asc' | 'desc' | null

export default function PublicParticipantsView({
  participants,
  teams,
}: {
  participants: Participant[]
  teams: Team[]
}) {
  const [filter, setFilter] = useState<FilterValue>('all_sections')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('full_name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: participants.length, unassigned: 0 }
    for (const t of teams) c[t.id] = 0
    for (const p of participants) {
      if (!p.team_id) c.unassigned++
      else if (c[p.team_id] !== undefined) c[p.team_id]++
    }
    return c
  }, [participants, teams])

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      if (filter === 'unassigned' && p.team_id) return false
      if (filter !== 'all_sections' && filter !== 'all_flat' && filter !== 'unassigned' && p.team_id !== filter) return false
      if (search) {
        const q = search.toLowerCase()
        const matches =
          p.full_name.toLowerCase().includes(q) ||
          p.email?.toLowerCase().includes(q) ||
          p.phone?.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })
  }, [participants, filter, search])

  const sorted = useMemo(() => {
    if (!sortDir) return filtered
    const arr = [...filtered]
    const mul = sortDir === 'asc' ? 1 : -1
    const teamMap: Record<string, Team> = {}
    for (const t of teams) teamMap[t.id] = t

    arr.sort((a, b) => {
      let va: any, vb: any
      switch (sortKey) {
        case 'full_name': va = a.full_name; vb = b.full_name; break
        case 'email': va = a.email || ''; vb = b.email || ''; break
        case 'phone': va = a.phone || ''; vb = b.phone || ''; break
        case 'membership_type': va = a.membership_type || ''; vb = b.membership_type || ''; break
        case 'team':
          va = a.team_id ? (teamMap[a.team_id]?.display_order || 999) : 9999
          vb = b.team_id ? (teamMap[b.team_id]?.display_order || 999) : 9999
          break
      }
      if (typeof va === 'string') return va.localeCompare(vb, 'ro') * mul
      return (va - vb) * mul
    })
    return arr
  }, [filtered, sortKey, sortDir, teams])

  function toggleSort(key: SortKey) {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir('asc')
    } else {
      if (sortDir === 'asc') setSortDir('desc')
      else if (sortDir === 'desc') { setSortDir(null); setSortKey('full_name') }
      else setSortDir('asc')
    }
  }

  const showSections = filter === 'all_sections'
  const showFlat = filter === 'all_flat'
  const showSpecificTeam = filter !== 'all_sections' && filter !== 'all_flat' && filter !== 'unassigned'

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterButton active={filter === 'all_sections'} onClick={() => setFilter('all_sections')} color="#0a1628" label="Toți (secțiuni)" count={counts.all} />
        <FilterButton active={filter === 'all_flat'} onClick={() => setFilter('all_flat')} color="#0a1628" label="Toți (listă)" count={counts.all} />
        {teams.map((t) => (
          <FilterButton key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)} color={t.color_primary} label={t.short_name} count={counts[t.id] || 0} />
        ))}
        <FilterButton active={filter === 'unassigned'} onClick={() => setFilter('unassigned')} color="#9CA3AF" label="Nealocați" count={counts.unassigned} />
      </div>

      <div className="mb-4 relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută după nume, email sau telefon..."
          className="w-full pl-9 pr-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
            {sorted.length} rezultate
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-400" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Users size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Niciun participant nu corespunde filtrelor.</p>
        </div>
      ) : showSections ? (
        <div className="space-y-6">
          {teams.map((t) => {
            const teamPeople = sorted.filter((p) => p.team_id === t.id)
            if (teamPeople.length === 0) return null
            return <TeamSection key={t.id} team={t} participants={teamPeople} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} showTeamCol={false} />
          })}
          {(() => {
            const unassigned = sorted.filter((p) => !p.team_id)
            if (unassigned.length === 0) return null
            return <UnassignedSection participants={unassigned} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} showTeamCol={false} />
          })()}
        </div>
      ) : showFlat ? (
        <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <ParticipantsTable participants={sorted} teamColor="#0a1628" teams={teams} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} showTeamCol={true} />
        </div>
      ) : showSpecificTeam ? (
        (() => {
          const t = teams.find((x) => x.id === filter)
          if (!t) return null
          return <TeamSection team={t} participants={sorted} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} showTeamCol={false} />
        })()
      ) : (
        <UnassignedSection participants={sorted} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} showTeamCol={false} />
      )}
    </div>
  )
}

function FilterButton({ active, onClick, color, label, count }: { active: boolean; onClick: () => void; color: string; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition"
      style={{
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `1.5px solid ${color}`,
      }}
    >
      {label}
      <span
        className="inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold"
        style={{
          background: active ? 'rgba(255,255,255,0.2)' : `${color}15`,
          color: active ? '#fff' : color,
        }}
      >
        {count}
      </span>
    </button>
  )
}

type SectionProps = {
  participants: Participant[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  showTeamCol: boolean
}

function TeamSection({ team, participants, sortKey, sortDir, onSort, showTeamCol }: SectionProps & { team: Team }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: team.color_primary, color: '#fff' }}>
        <Users size={16} />
        <Link href={`/ssyt/teams/${team.slug}`} className="font-semibold tracking-tight hover:underline">
          {team.name}
        </Link>
        <span className="text-xs uppercase tracking-wider opacity-80">({participants.length})</span>
      </div>
      <ParticipantsTable participants={participants} teamColor={team.color_primary} teams={[]} sortKey={sortKey} sortDir={sortDir} onSort={onSort} showTeamCol={showTeamCol} />
    </div>
  )
}

function UnassignedSection({ participants, sortKey, sortDir, onSort, showTeamCol }: SectionProps) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#9CA3AF', color: '#fff' }}>
        <Users size={16} />
        <span className="font-semibold tracking-tight">Nealocați</span>
        <span className="text-xs uppercase tracking-wider opacity-80">({participants.length})</span>
      </div>
      <ParticipantsTable participants={participants} teamColor="#9CA3AF" teams={[]} sortKey={sortKey} sortDir={sortDir} onSort={onSort} showTeamCol={showTeamCol} />
    </div>
  )
}

function SortableHeader({ label, columnKey, sortKey, sortDir, onSort, align = 'left' }: { label: string; columnKey: SortKey; sortKey: SortKey; sortDir: SortDir; onSort: (key: SortKey) => void; align?: 'left' | 'center' | 'right' }) {
  const isActive = sortKey === columnKey && sortDir !== null
  return (
    <th className={`px-5 py-2 text-${align}`}>
      <button
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider transition hover:text-gray-900"
        style={{ color: isActive ? '#FF6B35' : '#6B7280' }}
      >
        {label}
        {isActive ? (
          sortDir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="opacity-40" />
        )}
      </button>
    </th>
  )
}

function ParticipantsTable({
  participants, teamColor, teams, sortKey, sortDir, onSort, showTeamCol,
}: {
  participants: Participant[]
  teamColor: string
  teams: Team[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  showTeamCol: boolean
}) {
  const teamMap: Record<string, Team> = {}
  for (const t of teams) teamMap[t.id] = t

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
          <tr>
            <SortableHeader label="Nume" columnKey="full_name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHeader label="Email" columnKey="email" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            <SortableHeader label="Telefon" columnKey="phone" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            {showTeamCol && <SortableHeader label="Echipă" columnKey="team" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />}
            <SortableHeader label="Tip" columnKey="membership_type" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="center" />
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const isPlaceholder = p.email?.endsWith('@ssyt.ro')
            const team = p.team_id ? teamMap[p.team_id] : null
            return (
              <tr key={p.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #f3f4f6' }}>
                <td className="px-5 py-2.5">
                  <span className="font-medium" style={{ color: '#0a1628' }}>{p.full_name}</span>
                </td>
                <td className="px-5 py-2.5 text-xs">
                  {isPlaceholder ? (
                    <span className="text-gray-300 italic">—</span>
                  ) : (
                    <a href={`mailto:${p.email}`} className="inline-flex items-center gap-1 text-gray-700 hover:underline">
                      <Mail size={11} className="text-gray-400" />
                      <span className="font-mono">{p.email}</span>
                    </a>
                  )}
                </td>
                <td className="px-5 py-2.5 text-xs text-gray-700">
                  {p.phone ? (
                    <a href={`tel:${p.phone}`} className="inline-flex items-center gap-1 hover:underline">
                      <Phone size={11} className="text-gray-400" />
                      <span className="font-mono">{p.phone}</span>
                    </a>
                  ) : (
                    <span className="text-gray-300 italic">—</span>
                  )}
                </td>
                {showTeamCol && (
                  <td className="px-5 py-2.5 text-xs">
                    {team ? (
                      <Link href={`/ssyt/teams/${team.slug}`} className="inline-flex items-center gap-1.5 hover:underline">
                        <span className="w-2 h-2 rounded-full" style={{ background: team.color_primary }}></span>
                        <span style={{ color: '#0a1628' }}>{team.short_name}</span>
                      </Link>
                    ) : (
                      <span className="text-gray-400 italic">— nealocat</span>
                    )}
                  </td>
                )}
                <td className="px-5 py-2.5 text-center">
                  {p.membership_type ? (
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{
                      background: p.membership_type === 'core' ? `${teamColor}20` : 'rgba(0,168,181,0.12)',
                      color: p.membership_type === 'core' ? teamColor : '#00A8B5',
                    }}>
                      {p.membership_type}
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
