'use client'
import { useState } from 'react'
import { Plus, ListChecks, Trash2, X, CheckCircle2, Circle, Clock, Ban } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'
import EditableField from '@/components/ssyt/EditableField'

const STATUS_OPTIONS = [
  { value: 'todo', label: 'De făcut' },
  { value: 'in_progress', label: 'În lucru' },
  { value: 'done', label: 'Finalizat' },
  { value: 'cancelled', label: 'Anulat' },
]
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'urgent', label: 'urgent' },
]

const PRIORITY_COLORS: Record<string, string> = {
  low: '#6B7280', medium: '#3B82F6', high: '#F59E0B', urgent: '#EF4444',
}

export default function TasksTab({
  boatId, tasks, allParticipants, equipment, onChange,
}: {
  boatId: string; tasks: any[]; allParticipants: any[]; equipment: any[]; onChange: () => void
}) {
  const [showNew, setShowNew] = useState(false)
  const [filter, setFilter] = useState<'all' | 'open' | 'done'>('open')

  async function updateField(id: string, field: string, value: string | null) {
    const cleanValue = value === '' ? null : value
    const updates: any = { [field]: cleanValue }
    if (field === 'status' && value === 'done') {
      updates.completed_at = new Date().toISOString()
    }
    if (field === 'status' && value !== 'done') {
      updates.completed_at = null
    }
    const { error } = await supabase.from('ssyt_boat_tasks').update(updates).eq('id', id)
    if (error) { alert(error.message); throw error }
    onChange()
  }

  async function toggleStatus(t: any) {
    const newStatus = t.status === 'done' ? 'todo' : 'done'
    await updateField(t.id, 'status', newStatus)
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest task?')) return
    const { error } = await supabase.from('ssyt_boat_tasks').delete().eq('id', id)
    if (error) { alert(error.message); return }
    onChange()
  }

  const filtered = tasks.filter((t) => {
    if (filter === 'all') return true
    if (filter === 'open') return t.status === 'todo' || t.status === 'in_progress'
    if (filter === 'done') return t.status === 'done' || t.status === 'cancelled'
    return true
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-1 text-sm">
          {(['open', 'all', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-md font-medium"
              style={{
                background: filter === f ? '#FF6B35' : 'transparent',
                color: filter === f ? '#fff' : '#6B7280',
              }}
            >
              {f === 'open' ? 'Deschise' : f === 'all' ? 'Toate' : 'Închise'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90"
          style={{ background: '#FF6B35' }}
        >
          <Plus size={14} /> Adaugă task
        </button>
      </div>

      {showNew && (
        <NewTaskForm boatId={boatId} allParticipants={allParticipants} equipment={equipment} onClose={() => setShowNew(false)} onSaved={() => { setShowNew(false); onChange() }} />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg p-12 text-center text-gray-500" style={{ background: '#fff', border: '1px dashed #e5e7eb' }}>
          <ListChecks size={28} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">Niciun task {filter === 'open' ? 'deschis' : filter === 'done' ? 'închis' : ''}.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isDone = t.status === 'done' || t.status === 'cancelled'
            return (
              <div
                key={t.id}
                className="rounded-lg p-4 flex items-start gap-3"
                style={{
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  opacity: isDone ? 0.65 : 1,
                }}
              >
                <button onClick={() => toggleStatus(t)} className="mt-0.5 flex-shrink-0">
                  {t.status === 'done' ? (
                    <CheckCircle2 size={18} className="text-green-600" />
                  ) : t.status === 'cancelled' ? (
                    <Ban size={18} className="text-gray-400" />
                  ) : t.status === 'in_progress' ? (
                    <Clock size={18} style={{ color: '#FF6B35' }} />
                  ) : (
                    <Circle size={18} className="text-gray-300" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className={`font-medium text-sm ${isDone ? 'line-through text-gray-500' : ''}`} style={{ color: isDone ? undefined : '#0a1628' }}>
                    <EditableField value={t.title} onSave={(v) => updateField(t.id, 'title', v)} placeholder="Titlu task" />
                  </div>

                  {(t.description || true) && (
                    <div className="text-xs text-gray-500 mt-1">
                      <EditableField value={t.description} onSave={(v) => updateField(t.id, 'description', v)} placeholder="Descriere..." type="textarea" multiline />
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                    {/* Status */}
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{
                      background: t.status === 'done' ? 'rgba(16,185,129,0.12)' : t.status === 'in_progress' ? 'rgba(255,107,53,0.12)' : 'rgba(107,114,128,0.12)',
                      color: t.status === 'done' ? '#10B981' : t.status === 'in_progress' ? '#FF6B35' : '#6B7280',
                    }}>
                      <EditableField value={t.status} onSave={(v) => updateField(t.id, 'status', v)} type="select" options={STATUS_OPTIONS} formatDisplay={(v) => STATUS_OPTIONS.find(o => o.value === v)?.label || String(v)} />
                    </span>

                    {/* Priority */}
                    <span className="font-medium" style={{ color: PRIORITY_COLORS[t.priority] || '#6B7280' }}>
                      ●{' '}
                      <EditableField value={t.priority} onSave={(v) => updateField(t.id, 'priority', v)} type="select" options={PRIORITY_OPTIONS} />
                    </span>

                    {/* Assigned */}
                    <span className="text-gray-500">
                      <span className="text-gray-400">→</span>{' '}
                      <EditableField
                        value={t.assigned_to}
                        onSave={(v) => updateField(t.id, 'assigned_to', v === '' ? null : v)}
                        type="select"
                        options={allParticipants.map((p) => ({ value: p.id, label: p.full_name }))}
                        formatDisplay={(v) => allParticipants.find((p) => p.id === v)?.full_name || 'neasignat'}
                        placeholder="neasignat"
                      />
                    </span>

                    {/* Due date */}
                    <span className="text-gray-500">
                      <span className="text-gray-400">📅</span>{' '}
                      <EditableField value={t.due_date} onSave={(v) => updateField(t.id, 'due_date', v)} type="date" placeholder="fără dată" />
                    </span>
                  </div>
                </div>

                <button onClick={() => remove(t.id)} className="text-gray-300 hover:text-red-600 p-1 flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NewTaskForm({ boatId, allParticipants, equipment, onClose, onSaved }: {
  boatId: string; allParticipants: any[]; equipment: any[]; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', assigned_to: '', due_date: '' })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title.trim()) return
    setSaving(true)
    const { error } = await supabase.from('ssyt_boat_tasks').insert({
      boat_id: boatId,
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      assigned_to: form.assigned_to || null,
      due_date: form.due_date || null,
      status: 'todo',
    })
    setSaving(false)
    if (error) { alert(error.message); return }
    onSaved()
  }

  return (
    <div className="rounded-lg p-5 mb-4" style={{ background: '#fff', border: '1px solid #FF6B35' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>Task nou</h3>
        <button onClick={onClose}><X size={16} className="text-gray-400" /></button>
      </div>
      <input placeholder="Titlu *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <textarea placeholder="Descriere" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-md text-sm mb-3" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          {PRIORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="px-3 py-2 border rounded-md text-sm">
          <option value="">— neasignat —</option>
          {allParticipants.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
        </select>
        <input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="px-3 py-2 border rounded-md text-sm" />
      </div>
      <button onClick={save} disabled={saving || !form.title.trim()} className="px-4 py-2 rounded-md text-sm text-white font-medium disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? '...' : 'Salvează'}
      </button>
    </div>
  )
}
