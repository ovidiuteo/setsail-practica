'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Anchor, Users, Trophy, Image as ImageIcon, Info, BookOpen } from 'lucide-react'
import RegattaOverviewTab from './tabs/RegattaOverviewTab'
import RacesTab from './tabs/RacesTab'
import CrewlistTab from './tabs/CrewlistTab'
import DocumentsTab from './tabs/DocumentsTab'
import ResultsTab from './tabs/ResultsTab'
import MediaTab from './tabs/MediaTab'
import JournalsTab from './tabs/JournalsTab'

type TabKey = 'overview' | 'races' | 'crewlist' | 'documents' | 'results' | 'media' | 'journals'

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: 'overview', label: 'Overview', icon: Info },
  { key: 'races', label: 'Curse', icon: Anchor },
  { key: 'crewlist', label: 'Crewlist', icon: Users },
  { key: 'documents', label: 'Documente', icon: FileText },
  { key: 'results', label: 'Rezultate', icon: Trophy },
  { key: 'media', label: 'Media', icon: ImageIcon },
  { key: 'journals', label: 'Jurnale', icon: BookOpen },
]

export default function RegattaDetailTabs(props: {
  regatta: any
  races: any[]
  participation: any[]
  results: any[]
  documents: any[]
  media: any[]
  teams: any[]
  allParticipants: any[]
  roles: any[]
  docTypes: any[]
  journals: any[]
}) {
  const [tab, setTab] = useState<TabKey>('overview')
  const router = useRouter()
  const refresh = () => router.refresh()

  return (
    <div>
      <div className="border-b mb-6 flex overflow-x-auto" style={{ borderColor: '#e5e7eb' }}>
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          const count =
            t.key === 'races' ? props.races.length :
            t.key === 'crewlist' ? props.participation.length :
            t.key === 'documents' ? props.documents.length :
            t.key === 'results' ? props.results.length :
            t.key === 'media' ? props.media.length :
            t.key === 'journals' ? props.journals.length : null

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
              {count !== null && count > 0 && (
                <span className="ml-1 text-xs text-gray-400">({count})</span>
              )}
            </button>
          )
        })}
      </div>

      <div>
        {tab === 'overview' && <RegattaOverviewTab regatta={props.regatta} onSaved={refresh} />}
        {tab === 'races' && <RacesTab regattaId={props.regatta.id} races={props.races} onChange={refresh} />}
        {tab === 'crewlist' && <CrewlistTab regattaId={props.regatta.id} participation={props.participation} teams={props.teams} allParticipants={props.allParticipants} roles={props.roles} onChange={refresh} />}
        {tab === 'documents' && <DocumentsTab regattaId={props.regatta.id} documents={props.documents} docTypes={props.docTypes} onChange={refresh} />}
        {tab === 'results' && <ResultsTab regattaId={props.regatta.id} results={props.results} teams={props.teams} onChange={refresh} />}
        {tab === 'media' && <MediaTab regattaId={props.regatta.id} media={props.media} onChange={refresh} />}
        {tab === 'journals' && <JournalsTab journals={props.journals} teams={props.teams} />}
      </div>
    </div>
  )
}