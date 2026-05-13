'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, X, HelpCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

type Regatta = { id: string; name: string; slug: string; start_date: string; end_date: string | null; event_type: string }
type Participation = { id: string; regatta_id: string; confirmation_status: string; on_crewlist: boolean; team_id: string | null }

export default function AvailabilityEditor({
  participantId, teamId, membershipType, regattas, participations,
}: {
  participantId: string
  teamId: string | null
  membershipType: string
  regattas: Regatta[]
  participations: Participation[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const partMap: Record<string, Participation> = {}
  for (const p of participations) partMap[p.regatta_id] = p

  async function setStatus(regattaId: string, status: 'confirmed' | 'declined' | 'tentative') {
    setBusy(regattaId)
    const supabase = createSupabaseBrowserClient()
    const existing = partMap[regattaId]

    if (existing) {
      const updates: any = { confirmation_status: status }
      if (status === 'confirmed') {
        updates.confirmed_at = new Date().toISOString()
      } else {
        updates.on_crewlist = false  // auto-scoatere de pe crewlist daca devine indisponibil
      }
      const { error } = await supabase.from('ssyt_regatta_participation').update(updates).eq('id', existing.id)
      if (error) alert(error.message)
    } else {
      const { error } = await supabase.from('ssyt_regatta_participation').insert({
        regatta_id: regattaId,
        participant_id: participantId,
        team_id: teamId,
        confirmation_status: status,
        attendance_type: membershipType,
        on_crewlist: false,
        confirmed_at: status === 'confirmed' ? new Date().toISOString() : null,
      })
      if (error) alert(error.message)
    }
    setBusy(null)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {regattas.map((r) => {
        const part = partMap[r.id]
        const status = part?.confirmation_status
        const onCrewlist = part?.on_crewlist
        const d1 = new Date(r.start_date)
        const d2 = r.end_date ? new Date(r.end_date) : null
        const isBusy = busy === r.id

        return (
          <div key={r.id} className="rounded-lg p-4 flex items-center gap-4 flex-wrap" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
            <div className="w-14 h-14 rounded-md flex flex-col items-center justify-center flex-shrink-0" style={{ background: '#0a1628', color: '#fff' }}>
              <div className="text-[10px] uppercase">{d1.toLocaleString('ro-RO', { month: 'short' })}</div>
              <div className="text-xl font-bold leading-none">{d1.getDate()}</div>
              {d2 && d2.getDate() !== d1.getDate() && (
                <div className="text-[10px] mt-0.5">→{d2.getDate()}</div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold" style={{ color: '#0a1628' }}>{r.name}</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {d1.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
                {d2 && d2.getDate() !== d1.getDate() && ` – ${d2.toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' })}`}
                <span className="ml-2 px-1.5 py-0.5 rounded uppercase tracking-wider text-[10px]" style={{ background: 'rgba(255,107,53,0.12)', color: '#FF6B35' }}>
                  {r.event_type}
                </span>
              </div>
              {onCrewlist && (
                <div className="text-xs mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981' }}>
                  ✓ Ești pe crewlist
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <StatusButton
                active={status === 'confirmed'}
                onClick={() => setStatus(r.id, 'confirmed')}
                disabled={isBusy}
                color="#10B981"
                icon={<Check size={16} />}
                label="Disponibil"
              />
              <StatusButton
                active={status === 'tentative'}
                onClick={() => setStatus(r.id, 'tentative')}
                disabled={isBusy}
                color="#F59E0B"
                icon={<HelpCircle size={16} />}
                label="Nu știu"
              />
              <StatusButton
                active={status === 'declined'}
                onClick={() => setStatus(r.id, 'declined')}
                disabled={isBusy}
                color="#EF4444"
                icon={<X size={16} />}
                label="Indisponibil"
              />
            </div>
          </div>
        )
      })}

      {regattas.length === 0 && (
        <div className="rounded-lg p-8 text-center text-gray-400 italic" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          Niciun regatta în acest sezon.
        </div>
      )}
    </div>
  )
}

function StatusButton({ active, onClick, disabled, color, icon, label }: { active: boolean; onClick: () => void; disabled: boolean; color: string; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
      style={{
        background: active ? color : '#fff',
        color: active ? '#fff' : color,
        border: `2px solid ${color}`,
      }}
      title={label}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}
