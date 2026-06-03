'use client'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

type Journal = {
  id: string
  team_id: string
  content: string | null
  updated_at: string | null
  team: { id: string; name: string; short_name: string | null; color_primary: string | null } | { id: string; name: string; short_name: string | null; color_primary: string | null }[] | null
}

function getTeam(j: Journal) {
  if (Array.isArray(j.team)) return j.team[0] ?? null
  return j.team
}

export default function JournalsTab({ journals, teams }: { journals: Journal[]; teams: any[] }) {
  // Doar jurnale cu conținut real
  const filled = journals.filter((j) => (j.content || '').trim().length > 0)

  if (filled.length === 0) {
    return (
      <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
        <BookOpen size={28} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Nicio echipă nu a scris jurnal pentru această regatta.</p>
        <p className="text-xs text-gray-400 mt-1">Editorii echipelor scriu jurnalul din portal, pe pagina regattei.</p>
      </div>
    )
  }

  // Sortez după ordinea echipelor (display_order din teams), apoi nume
  const teamOrder: Record<string, number> = {}
  teams.forEach((t: any, i: number) => { teamOrder[t.id] = i })
  const sorted = [...filled].sort((a, b) => (teamOrder[a.team_id] ?? 999) - (teamOrder[b.team_id] ?? 999))

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">{filled.length} {filled.length === 1 ? 'jurnal' : 'jurnale'} scrise de echipe.</p>
      {sorted.map((j) => {
        const team = getTeam(j)
        const color = team?.color_primary || '#4A5568'
        return (
          <div key={j.id} className="rounded-lg overflow-hidden" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="px-5 py-3 flex items-center justify-between" style={{ background: `${color}10`, borderBottom: '1px solid #e5e7eb' }}>
              <div className="inline-flex items-center gap-2 font-semibold" style={{ color: '#0a1628' }}>
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                {team ? (
                  <Link href={`/ssyt/admin/teams/${team.id}`} className="hover:underline">
                    {team.name}
                  </Link>
                ) : (
                  'Echipă necunoscută'
                )}
              </div>
              {j.updated_at && (
                <span className="text-xs text-gray-400">
                  actualizat {new Date(j.updated_at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="p-5">
              <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{j.content}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
