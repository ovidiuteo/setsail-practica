'use client'
import Link from 'next/link'
import { Users, Anchor } from 'lucide-react'

export default function TeamTab({ teams }: { teams: any[] }) {
  if (!teams || teams.length === 0) {
    return (
      <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
        <Users size={28} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Această ambarcațiune nu e alocată niciunei echipe.</p>
        <p className="text-xs text-gray-400 mt-1">Alocarea se face din pagina echipei.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {teams.map((team: any) => {
        const activeMembers = (team.memberships || []).filter((m: any) => m.status === 'active')
        return (
          <div key={team.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            {/* Header echipa */}
            <div className="p-5 flex items-center gap-4" style={{ background: team.color_primary || '#4A5568' }}>
              <div className="w-12 h-12 rounded bg-white/15 flex items-center justify-center text-white font-bold">
                {team.short_name?.charAt(0) || 'T'}
              </div>
              <div className="flex-1">
                <h3 className="text-white text-xl font-semibold tracking-tight">{team.name}</h3>
                {team.slogan && <p className="text-white/80 text-xs italic">"{team.slogan}"</p>}
              </div>
              <Link
                href={`/ssyt/admin/teams/${team.id}`}
                className="text-xs text-white/90 hover:text-white px-3 py-1.5 rounded-md bg-white/15 hover:bg-white/25 transition"
              >
                Vezi echipa →
              </Link>
            </div>

            {/* Skipper highlight */}
            {team.skipper && (
              <div className="px-5 py-3 border-b flex items-center gap-3" style={{ borderColor: '#e5e7eb', background: '#f8f9fa' }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-semibold text-sm" style={{ background: '#0a1628' }}>
                  {initials(team.skipper.full_name)}
                </div>
                <div className="flex-1">
                  <div className="text-xs uppercase tracking-wider text-gray-500 font-medium">Skipper</div>
                  <div className="font-medium" style={{ color: '#0a1628' }}>{team.skipper.full_name}</div>
                </div>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}>
                  skipper
                </span>
              </div>
            )}

            {/* Roster */}
            <div className="p-5">
              <div className="text-xs uppercase tracking-wider text-gray-500 font-medium mb-3 flex items-center gap-2">
                <Users size={12} /> Roster ({activeMembers.length} membri)
              </div>

              {activeMembers.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {activeMembers.map((m: any) => {
                    const isSkipperMember = m.participant?.id === team.skipper?.id
                    if (isSkipperMember) return null // deja afisat sus
                    return (
                      <Link
                        key={m.id}
                        href={`/ssyt/admin/participants/${m.participant?.id}`}
                        className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 transition"
                      >
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold flex-shrink-0" style={{ background: '#4A5568' }}>
                          {initials(m.participant?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate" style={{ color: '#0a1628' }}>{m.participant?.full_name}</div>
                          <div className="text-xs text-gray-500 truncate">{m.participant?.email}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          background: m.membership_type === 'core' ? 'rgba(255,107,53,0.12)' : 'rgba(0,168,181,0.12)',
                          color: m.membership_type === 'core' ? '#FF6B35' : '#00A8B5',
                        }}>
                          {m.membership_type}
                        </span>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Niciun membru.</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function initials(name: string | null | undefined): string {
  if (!name) return '?'
  return name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
}
