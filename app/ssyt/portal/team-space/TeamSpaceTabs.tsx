'use client'
import { useState } from 'react'
import { FileText, CheckSquare, Anchor, Wrench, BookMarked } from 'lucide-react'
import NotesEditor from '@/components/ssyt/portal/NotesEditor'
import TodoList, { Todo, TeamMember } from '@/components/ssyt/portal/TodoList'
import ResourceList, { Resource } from '@/components/ssyt/portal/ResourceList'

type Tab = 'notes' | 'team-todo' | 'boat-resources' | 'boat-misc' | 'boat-todo'

export default function TeamSpaceTabs({
  teamId,
  canEdit,
  currentParticipantId,
  teamMembers,
  initialNotes,
  initialTodos,
  initialResources,
  boatResourcesAdmin = [],
}: {
  teamId: string
  canEdit: boolean
  currentParticipantId: string
  teamMembers: TeamMember[]
  initialNotes: string
  initialTodos: (Todo & { scope: 'team' | 'boat' })[]
  initialResources: Resource[]
  boatResourcesAdmin?: Resource[]
}) {
  const [tab, setTab] = useState<Tab>('notes')

  const teamTodos = initialTodos.filter((t) => t.scope === 'team')
  const boatTodos = initialTodos.filter((t) => t.scope === 'boat')

  const tabs: { id: Tab; label: string; icon: any; count?: number }[] = [
    { id: 'notes', label: 'Note', icon: FileText },
    { id: 'team-todo', label: 'To-do echipă', icon: CheckSquare, count: teamTodos.filter((t) => !t.is_done).length },
    { id: 'boat-resources', label: 'Resurse barcă', icon: Anchor, count: initialResources.length },
    { id: 'boat-misc', label: 'Resurse diverse', icon: BookMarked, count: boatResourcesAdmin.length },
    { id: 'boat-todo', label: 'To-do barcă', icon: Wrench, count: boatTodos.filter((t) => !t.is_done).length },
  ]

  return (
    <div>
      {/* Tabs nav */}
      <div className="border-b mb-6 flex flex-wrap" style={{ borderColor: '#e5e7eb' }}>
        {tabs.map((t) => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition"
              style={{
                color: active ? '#FF6B35' : '#6B7280',
                borderBottom: active ? '2px solid #FF6B35' : '2px solid transparent',
                marginBottom: '-1px',
              }}
            >
              <Icon size={14} />
              {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold" style={{ background: active ? '#FF6B35' : '#e5e7eb', color: active ? '#fff' : '#6B7280' }}>
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Tab content */}
      {tab === 'notes' && (
        <NotesEditor teamId={teamId} initialContent={initialNotes} canEdit={canEdit} />
      )}

      {tab === 'team-todo' && (
        <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Task-uri echipă</h2>
          <TodoList
            todos={teamTodos}
            canEdit={canEdit}
            scope="team"
            teamId={teamId}
            teamMembers={teamMembers}
            currentParticipantId={currentParticipantId}
            emptyText="Niciun task de echipă încă."
          />
        </div>
      )}

      {tab === 'boat-resources' && (
        <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-1">Resurse barcă (privat echipei)</h2>
          <p className="text-xs text-gray-400 mb-4">ORC, polare, tehnici speciale - vizibile doar pentru membrii echipei tale.</p>
          <ResourceList
            resources={initialResources}
            canEdit={canEdit}
            apiEndpoint="/api/ssyt/portal/team-boat-resources"
            teamId={teamId}
            emptyText="Nicio resursă încă pentru barca echipei."
          />
        </div>
      )}

      {tab === 'boat-misc' && (
        <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-1">Resurse diverse (de la organizatori)</h2>
          <p className="text-xs text-gray-400 mb-4">Resurse/link-uri/fișiere adăugate de admin pe barca voastră — doar citire.</p>
          <ResourceList
            resources={boatResourcesAdmin}
            canEdit={false}
            apiEndpoint=""
            emptyText="Nicio resursă diversă încă."
          />
        </div>
      )}

      {tab === 'boat-todo' && (
        <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
          <h2 className="text-sm font-medium uppercase tracking-wider text-gray-500 mb-3">Task-uri barcă</h2>
          <TodoList
            todos={boatTodos}
            canEdit={canEdit}
            scope="boat"
            teamId={teamId}
            teamMembers={teamMembers}
            currentParticipantId={currentParticipantId}
            emptyText="Niciun task pentru barcă încă."
          />
        </div>
      )}
    </div>
  )
}
