'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Edit2, X, Save, Check, User as UserIcon, Users as UsersIcon } from 'lucide-react'

export type Todo = {
  id: string
  title: string
  description: string | null
  assignee_type: 'all' | 'individual'
  assignee_participant: string | null
  is_done: boolean
  done_at: string | null
  done_by_participant: string | null
  created_by_participant: string | null
  created_at: string
}

export type TeamMember = { id: string; full_name: string; first_name: string }

export default function TodoList({
  todos,
  canEdit,
  scope,
  teamId,
  teamMembers,
  currentParticipantId,
  emptyText = 'Niciun task încă.',
}: {
  todos: Todo[]
  canEdit: boolean
  scope: 'team' | 'boat'
  teamId: string
  teamMembers: TeamMember[]
  currentParticipantId: string
  emptyText?: string
}) {
  const router = useRouter()
  const [addOpen, setAddOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const memberMap: Record<string, TeamMember> = {}
  for (const m of teamMembers) memberMap[m.id] = m

  async function saveNew(form: any) {
    setBusy(true)
    const res = await fetch('/api/ssyt/portal/team-todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, team_id: teamId, scope }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Eroare')
      return
    }
    setAddOpen(false)
    router.refresh()
  }

  async function saveEdit(id: string, form: any) {
    setBusy(true)
    const res = await fetch('/api/ssyt/portal/team-todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...form }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Eroare')
      return
    }
    setEditingId(null)
    router.refresh()
  }

  async function toggleDone(id: string) {
    const res = await fetch('/api/ssyt/portal/team-todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'toggle_done' }),
    })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Eroare')
      return
    }
    router.refresh()
  }

  // Sortez: nedone întâi, apoi done
  const sorted = [...todos].sort((a, b) => {
    if (a.is_done === b.is_done) return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return a.is_done ? 1 : -1
  })

  return (
    <div>
      {canEdit && (
        <div className="mb-4">
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-white hover:opacity-90 transition"
            style={{ background: '#FF6B35' }}
          >
            <Plus size={14} /> Adaugă task
          </button>
        </div>
      )}

      {addOpen && (
        <TodoForm
          teamMembers={teamMembers}
          onCancel={() => setAddOpen(false)}
          onSave={saveNew}
          busy={busy}
        />
      )}

      <div className="space-y-2">
        {sorted.length === 0 && !addOpen ? (
          <div className="text-sm text-gray-400 italic p-6 text-center rounded-lg" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
            {emptyText}
          </div>
        ) : (
          sorted.map((t) =>
            editingId === t.id ? (
              <TodoForm
                key={t.id}
                initial={t}
                teamMembers={teamMembers}
                onCancel={() => setEditingId(null)}
                onSave={(data) => saveEdit(t.id, data)}
                busy={busy}
              />
            ) : (
              <div
                key={t.id}
                className="rounded-lg p-3 flex items-start gap-3"
                style={{ background: t.is_done ? '#f8f9fa' : '#fff', border: '1px solid #e5e7eb', opacity: t.is_done ? 0.7 : 1 }}
              >
                <button
                  onClick={() => canEdit && toggleDone(t.id)}
                  disabled={!canEdit}
                  className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition disabled:cursor-not-allowed"
                  style={{
                    background: t.is_done ? '#10B981' : '#fff',
                    borderColor: t.is_done ? '#10B981' : '#d1d5db',
                  }}
                  title={canEdit ? 'Click pentru a (de)bifa' : 'Doar editorii pot bifa'}
                >
                  {t.is_done && <Check size={12} className="text-white" />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: '#0a1628', textDecoration: t.is_done ? 'line-through' : 'none' }}>
                    {t.title}
                  </div>
                  {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400 flex-wrap">
                    {t.assignee_type === 'individual' && t.assignee_participant ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,107,53,0.1)', color: '#FF6B35' }}>
                        <UserIcon size={9} /> {memberMap[t.assignee_participant]?.full_name || '?'}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded" style={{ background: '#f3f4f6' }}>
                        <UsersIcon size={9} /> toată echipa
                      </span>
                    )}
                    {t.is_done && t.done_by_participant && (
                      <span>✓ bifat de {memberMap[t.done_by_participant]?.first_name || '?'}</span>
                    )}
                    {!t.is_done && t.created_by_participant && (
                      <span>creat de {memberMap[t.created_by_participant]?.first_name || '?'}</span>
                    )}
                  </div>
                </div>
                {canEdit && (
                  <button onClick={() => setEditingId(t.id)} className="text-gray-400 hover:text-gray-700 flex-shrink-0">
                    <Edit2 size={13} />
                  </button>
                )}
              </div>
            )
          )
        )}
      </div>
    </div>
  )
}

function TodoForm({
  initial,
  teamMembers,
  onCancel,
  onSave,
  busy,
}: {
  initial?: Partial<Todo>
  teamMembers: TeamMember[]
  onCancel: () => void
  onSave: (data: any) => void
  busy: boolean
}) {
  const [form, setForm] = useState({
    title: initial?.title || '',
    description: initial?.description || '',
    assignee_type: (initial?.assignee_type as 'all' | 'individual') || 'all',
    assignee_participant: initial?.assignee_participant || '',
  })

  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: '#fff', border: '2px solid #FF6B35' }}>
      <div className="space-y-3">
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Task *</label>
          <input
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }} autoFocus
          />
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Descriere</label>
          <textarea
            value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
            className="w-full px-3 py-1.5 border rounded-md text-sm resize-y" style={{ borderColor: '#d1d5db' }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Asignat</label>
            <select
              value={form.assignee_type} onChange={(e) => setForm({ ...form, assignee_type: e.target.value as any })}
              className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }}
            >
              <option value="all">Toată echipa</option>
              <option value="individual">Persoană specifică</option>
            </select>
          </div>
          {form.assignee_type === 'individual' && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider text-gray-500 font-medium mb-1">Cui</label>
              <select
                value={form.assignee_participant} onChange={(e) => setForm({ ...form, assignee_participant: e.target.value })}
                className="w-full px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db' }}
              >
                <option value="">— alege —</option>
                {teamMembers.map((m) => (
                  <option key={m.id} value={m.id}>{m.full_name}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 justify-end pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900">
            <X size={14} className="inline mr-1" /> Anulează
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={busy || !form.title || (form.assignee_type === 'individual' && !form.assignee_participant)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#FF6B35' }}
          >
            <Save size={14} /> Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
