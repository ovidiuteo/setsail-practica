'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, XCircle, Clock, MessageSquare, ClipboardList } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import type { ApplicationRow } from './ClubEditor'

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  started:   { label: 'În curs',   bg: '#dbeafe', fg: '#1e40af' },
  submitted: { label: 'Trimisă',   bg: '#fef3c7', fg: '#92400e' },
  approved:  { label: 'Acceptată', bg: '#dcfce7', fg: '#166534' },
  rejected:  { label: 'Respinsă',  bg: '#fee2e2', fg: '#991b1b' },
  cancelled: { label: 'Anulată',   bg: '#f1f5f9', fg: '#475569' },
}

export default function ApplicationsTab({ initial }: { initial: ApplicationRow[] }) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [apps, setApps] = useState<ApplicationRow[]>(initial)
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [notesValue, setNotesValue] = useState('')
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function changeStatus(id: string, status: 'approved' | 'rejected') {
    setPendingId(id)
    setError('')
    const { error: err } = await supabase
      .from('ssyt_club_applications')
      .update({
        status,
        decided_at: new Date().toISOString(),
      })
      .eq('id', id)
    setPendingId(null)
    if (err) {
      setError(err.message)
      return
    }
    setApps((arr) =>
      arr.map((a) =>
        a.id === id ? { ...a, status, decided_at: new Date().toISOString() } : a
      )
    )
    router.refresh()
  }

  async function saveNotes(id: string) {
    const { error: err } = await supabase
      .from('ssyt_club_applications')
      .update({ admin_notes: notesValue.trim() || null })
      .eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setApps((arr) =>
      arr.map((a) => (a.id === id ? { ...a, admin_notes: notesValue.trim() || null } : a))
    )
    setEditingNotes(null)
    setNotesValue('')
    router.refresh()
  }

  if (apps.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-10 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <ClipboardList size={28} className="mx-auto mb-2" style={{ color: '#94a3b8' }} />
        <p className="text-sm text-gray-500">Niciun participant nu a aplicat la acest club încă.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {apps.map((app) => {
        const meta = STATUS_META[app.status] ?? STATUS_META.started
        const canDecide = app.status === 'submitted'
        const isFinal = app.status === 'approved' || app.status === 'rejected'

        return (
          <div
            key={app.id}
            className="rounded-lg border p-4"
            style={{ borderColor: '#e2e8f0', background: '#fff' }}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm" style={{ color: '#0a1628' }}>
                    {app.participant?.full_name ?? '(participant necunoscut)'}
                  </h3>
                  <span
                    className="inline-block text-xs px-2 py-0.5 rounded-full"
                    style={{ background: meta.bg, color: meta.fg }}
                  >
                    {meta.label}
                  </span>
                </div>
                {app.participant?.email && (
                  <div className="text-xs text-gray-500 font-mono">{app.participant.email}</div>
                )}
                <div className="text-xs text-gray-400 mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
                  {app.started_at && (
                    <span>
                      <Clock size={10} className="inline mr-0.5" />
                      Start: {new Date(app.started_at).toLocaleDateString('ro-RO')}
                    </span>
                  )}
                  {app.submitted_at && (
                    <span>Trimisă: {new Date(app.submitted_at).toLocaleDateString('ro-RO')}</span>
                  )}
                  {app.decided_at && (
                    <span>Decisă: {new Date(app.decided_at).toLocaleDateString('ro-RO')}</span>
                  )}
                </div>
              </div>

              {canDecide && (
                <div className="flex items-center gap-2">
                  <button
                    disabled={pendingId === app.id}
                    onClick={() => {
                      if (!confirm('Confirmi acceptarea aplicației?')) return
                      changeStatus(app.id, 'approved')
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                    style={{ background: '#16a34a', color: '#fff' }}
                  >
                    <CheckCircle2 size={12} />
                    Acceptă
                  </button>
                  <button
                    disabled={pendingId === app.id}
                    onClick={() => {
                      if (!confirm('Confirmi respingerea aplicației?')) return
                      changeStatus(app.id, 'rejected')
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium disabled:opacity-50"
                    style={{ background: '#dc2626', color: '#fff' }}
                  >
                    <XCircle size={12} />
                    Respinge
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 pt-3 border-t" style={{ borderColor: '#f1f5f9' }}>
              {editingNotes === app.id ? (
                <div className="space-y-2">
                  <textarea
                    value={notesValue}
                    onChange={(e) => setNotesValue(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full px-3 py-2 rounded-md border text-sm"
                    style={{ borderColor: '#cbd5e1' }}
                    placeholder="Notă vizibilă cursantului în portal..."
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => saveNotes(app.id)}
                      className="px-3 py-1 rounded-md text-xs font-medium"
                      style={{ background: '#FF6B35', color: '#fff' }}
                    >
                      Salvează
                    </button>
                    <button
                      onClick={() => {
                        setEditingNotes(null)
                        setNotesValue('')
                      }}
                      className="px-3 py-1 rounded-md text-xs text-gray-600 hover:bg-gray-100"
                    >
                      Anulează
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-400 uppercase tracking-wider mb-0.5 flex items-center gap-1">
                      <MessageSquare size={10} />
                      Notă admin (vizibilă cursantului)
                    </div>
                    <div className="text-sm text-gray-600 whitespace-pre-wrap">
                      {app.admin_notes ?? <span className="italic text-gray-400">— niciuna —</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setEditingNotes(app.id)
                      setNotesValue(app.admin_notes ?? '')
                    }}
                    className="text-xs text-gray-500 underline hover:text-gray-700"
                  >
                    {app.admin_notes ? 'Editează' : 'Adaugă'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
