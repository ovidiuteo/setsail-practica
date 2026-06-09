'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, Wrench, ListChecks, FileText, Link as LinkIcon, Image as ImageIcon, Gauge, FolderInput,
} from 'lucide-react'
import SpecsTab from './tabs/SpecsTab'
import TeamTab from './tabs/TeamTab'
import EquipmentTab from './tabs/EquipmentTab'
import TasksTab from './tabs/TasksTab'
import FilesTab from './tabs/FilesTab'
import ResourcesTab from './tabs/ResourcesTab'
import TeamResourcesTab from './tabs/TeamResourcesTab'
import PhotosTab from './tabs/PhotosTab'

type TabKey = 'team' | 'specs' | 'equipment' | 'tasks' | 'files' | 'resources' | 'team_resources' | 'photos'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'team', label: 'Echipă', icon: Users },
  { key: 'specs', label: 'Date tehnice', icon: Gauge },
  { key: 'equipment', label: 'Echipamente', icon: Wrench },
  { key: 'tasks', label: 'To-do', icon: ListChecks },
  { key: 'files', label: 'Fișiere', icon: FileText },
  { key: 'resources', label: 'Resurse', icon: LinkIcon },
  { key: 'team_resources', label: 'Resurse echipă (portal)', icon: FolderInput },
  { key: 'photos', label: 'Poze', icon: ImageIcon },
]

export default function BoatDetailTabs(props: {
  boat: any
  specs: any
  equipment: any[]
  tasks: any[]
  files: any[]
  resources: any[]
  teamResources: any[]
  photos: any[]
  teams: any[]
  allParticipants: any[]
}) {
  const [tab, setTab] = useState<TabKey>('team')
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  return (
    <div>
      {/* Tab bar */}
      <div className="border-b mb-6 flex overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition"
              style={{
                color: active ? '#FF6B35' : '#6B7280',
                borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <Icon size={14} />
              {t.label}
              {t.key === 'tasks' && props.tasks.filter((x) => x.status === 'todo' || x.status === 'in_progress').length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#FF6B35', color: '#fff', fontSize: '10px' }}>
                  {props.tasks.filter((x) => x.status === 'todo' || x.status === 'in_progress').length}
                </span>
              )}
              {t.key === 'equipment' && props.equipment.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">({props.equipment.length})</span>
              )}
              {t.key === 'photos' && props.photos.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">({props.photos.length})</span>
              )}
              {t.key === 'team_resources' && props.teamResources.length > 0 && (
                <span className="ml-1 text-xs text-gray-400">({props.teamResources.length})</span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'team' && <TeamTab teams={props.teams} />}
        {tab === 'specs' && <SpecsTab boat={props.boat} specs={props.specs} onSaved={refresh} />}
        {tab === 'equipment' && <EquipmentTab boatId={props.boat.id} equipment={props.equipment} onChange={refresh} />}
        {tab === 'tasks' && <TasksTab boatId={props.boat.id} tasks={props.tasks} allParticipants={props.allParticipants} equipment={props.equipment} onChange={refresh} />}
        {tab === 'files' && <FilesTab boatId={props.boat.id} files={props.files} onChange={refresh} />}
        {tab === 'resources' && <ResourcesTab boatId={props.boat.id} resources={props.resources} onChange={refresh} />}
        {tab === 'team_resources' && <TeamResourcesTab resources={props.teamResources} onChange={refresh} />}
        {tab === 'photos' && <PhotosTab boatId={props.boat.id} photos={props.photos} onChange={refresh} />}
      </div>
    </div>
  )
}
