'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Mail, Phone, ChevronRight, Users, Search } from 'lucide-react'

type Participant = {
  id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string | null
  status: string
  auth_status: string | null
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

type FilterValue = 'all' | 'unassigned' | string // string = team_id

export default function ParticipantsView({
  participants,
  teams,
}: {
  participants: Participant[]
  teams: Team[]
}) {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [search, setSearch] = useState('')

  // Numar participanti per echipa + nealocati
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: participants.length, unassigned: 0 }
    for (const t of teams) c[t.id] = 0
    for (const p of participants) {
      if (!p.team_id) c.unassigned++
      else if (c[p.team_id] !== undefined) c[p.team_id]++
    }
    return c
  }, [participants, teams])

  // Aplic filtru + search
  const filtered = useMemo(() => {
    return participants.filter((p) => {
      // Filtru
      if (filter === 'unassigned' && p.team_id) return false
      if (filter !== 'all' && filter !== 'unassigned' && p.team_id !== filter) return false
      // Search
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

  // Pentru filtru "all": grupez pe echipe + nealocati
  // Pentru un team specific: doar tabelul cu echipa aleasă
  // Pentru "unassigned": doar nealocati

  const showAllSections = filter === 'all'
  const showSpecificTeam = filter !== 'all' && filter !== 'unassigned'
  const showOnlyUnassigned = filter === 'unassigned'

  return (
    <div>
      {/* Filtre butoane */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <FilterButton
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          color="#0a1628"
          label="Toți"
          count={counts.all}
        />
        {teams.map((t) => (
          <FilterButton
            key={t.id}
            active={filter === t.id}
            onClick={() => setFilter(t.id)}
            color={t.color_primary}
            label={t.short_name}
            count={counts[t.id] || 0}
          />
        ))}
        <FilterButton
          active={filter === 'unassigned'}
          onClick={() => setFilter('unassigned')}
          color="#9CA3AF"
          label="Nealocați"
          count={counts.unassigned}
        />
      </div>

      {/* Search */}
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
            {filtered.length} rezultate
          </span>
        )}
      </div>

      {/* Continut: sectiuni sau tabel single */}
      {filtered.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-400" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <Users size={24} className="mx-auto mb-2 opacity-30" />
          <p className="text-sm">Niciun participant nu corespunde filtrelor.</p>
        </div>
      ) : showAllSections ? (
        // Sectiuni: o secțiune pentru fiecare echipă (în ordine display_order), apoi nealocați
        <div className="space-y-6">
          {teams.map((t) => {
            const teamPeople = filtered.filter((p) => p.team_id === t.id)
            if (teamPeople.length === 0) return null
            return (
              <TeamSection key={t.id} team={t} participants={teamPeople} />
            )
          })}
          {(() => {
            const unassigned = filtered.filter((p) => !p.team_id)
            if (unassigned.length === 0) return null
            return <UnassignedSection participants={unassigned} />
          })()}
        </div>
      ) : showSpecificTeam ? (
        // Tabel pentru o echipa specifica
        (() => {
          const t = teams.find((x) => x.id === filter)
          if (!t) return null
          return <TeamSection team={t} participants={filtered} />
        })()
      ) : (
        // Doar nealocati
        <UnassignedSection participants={filtered} />
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

function TeamSection({ team, participants }: { team: Team; participants: Participant[] }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: team.color_primary, color: '#fff' }}>
        <Users size={16} />
        <Link href={`/ssyt/teams/${team.slug}`} className="font-semibold tracking-tight hover:underline">
          {team.name}
        </Link>
        <span className="text-xs uppercase tracking-wider opacity-80">({participants.length})</span>
      </div>
      <ParticipantsTable participants={participants} teamColor={team.color_primary} />
    </div>
  )
}

function UnassignedSection({ participants }: { participants: Participant[] }) {
  return (
    <div className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="px-5 py-3 flex items-center gap-3" style={{ background: '#9CA3AF', color: '#fff' }}>
        <Users size={16} />
        <span className="font-semibold tracking-tight">Nealocați</span>
        <span className="text-xs uppercase tracking-wider opacity-80">({participants.length})</span>
      </div>
      <ParticipantsTable participants={participants} teamColor="#9CA3AF" />
    </div>
  )
}

function ParticipantsTable({ participants, teamColor }: { participants: Participant[]; teamColor: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
          <tr>
            <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
            <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
            <th className="text-left px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Telefon</th>
            <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Tip</th>
            <th className="text-center px-5 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
            <th className="w-8"></th>
          </tr>
        </thead>
        <tbody>
          {participants.map((p) => {
            const isPlaceholder = p.email?.endsWith('@ssyt.ro')
            return (
              <tr key={p.id} className="hover:bg-gray-50 transition" style={{ borderTop: '1px solid #f3f4f6' }}>
                <td className="px-5 py-2.5">
                  <Link href={`/ssyt/admin/participants/${p.id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                    {p.full_name}
                  </Link>
                </td>
                <td className="px-5 py-2.5 text-xs">
                  <span className={`inline-flex items-center gap-1 ${isPlaceholder ? 'text-amber-600' : 'text-gray-700'}`}>
                    <Mail size={11} className="text-gray-400" />
                    <span className="font-mono">{p.email}</span>
                  </span>
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
                <td className="px-5 py-2.5 text-center">
                  <StatusBadge status={p.status} />
                </td>
                <td className="pr-5">
                  <Link href={`/ssyt/admin/participants/${p.id}`} className="text-gray-400 hover:text-gray-700">
                    <ChevronRight size={16} />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: '#10B981',
    accepted: '#3B82F6',
    applied: '#F59E0B',
    waitlist: '#8B5CF6',
    inactive: '#6B7280',
    rejected: '#EF4444',
  }
  const c = colors[status] || '#6B7280'
  return (
    <span className="text-xs font-medium px-2 py-1 rounded-full" style={{ background: `${c}15`, color: c }}>
      {status}
    </span>
  )
}
