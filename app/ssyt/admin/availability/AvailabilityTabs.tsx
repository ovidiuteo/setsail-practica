'use client'
import { useState } from 'react'
import { Users, Sailboat } from 'lucide-react'
import AvailabilityMatrix from './AvailabilityMatrix'
import BoatCapacityView from './BoatCapacityView'

type TabKey = 'members' | 'boats'

export default function AvailabilityTabs(props: {
  regattas: any[]
  teams: any[]
  memberships: any[]
  participation: any[]
}) {
  const [tab, setTab] = useState<TabKey>('members')

  return (
    <div>
      <div className="border-b mb-6 flex" style={{ borderColor: '#e5e7eb' }}>
        <TabButton active={tab === 'members'} onClick={() => setTab('members')} icon={<Users size={14} />} label="Membri" />
        <TabButton active={tab === 'boats'} onClick={() => setTab('boats')} icon={<Sailboat size={14} />} label="Bărci" />
      </div>

      {tab === 'members' && (
        <AvailabilityMatrix
          regattas={props.regattas}
          teams={props.teams}
          memberships={props.memberships}
          participation={props.participation}
        />
      )}

      {tab === 'boats' && (
        <BoatCapacityView
          regattas={props.regattas}
          teams={props.teams}
          memberships={props.memberships}
          participation={props.participation}
        />
      )}
    </div>
  )
}

function TabButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition"
      style={{
        color: active ? '#FF6B35' : '#6B7280',
        borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent',
        marginBottom: '-1px',
      }}
    >
      {icon}
      {label}
    </button>
  )
}