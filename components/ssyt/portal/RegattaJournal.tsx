'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Edit2, Save, X, BookOpen } from 'lucide-react'

export default function RegattaJournal({
  teamId,
  regattaId,
  teamName,
  initialContent,
  canEdit,
}: {
  teamId: string
  regattaId: string
  teamName: string
  initialContent: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(initialContent)
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    const res = await fetch('/api/ssyt/portal/team-regatta-journal', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_id: teamId, regatta_id: regattaId, content }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      alert(d.error || 'Eroare')
      return
    }
    setEditing(false)
    router.refresh()
  }

  return (
    <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          <BookOpen size={12} /> Jurnal {teamName}
        </div>
        {canEdit && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md hover:bg-gray-100 transition"
            style={{ color: '#FF6B35' }}
          >
            <Edit2 size={12} /> Editează
          </button>
        )}
      </div>

      {editing ? (
        <div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder="Cum a fost regata pentru echipă? Rezultate, momente, lecții... (markdown acceptat)"
            className="w-full px-3 py-2 border rounded-md text-sm font-mono resize-y"
            style={{ borderColor: '#d1d5db' }}
            autoFocus
          />
          <p className="text-[11px] text-gray-400 mt-1">Markdown acceptat: **bold**, *italic*, listă, link [text](url)</p>
          <div className="flex items-center gap-2 justify-end mt-3">
            <button
              onClick={() => {
                setEditing(false)
                setContent(initialContent)
              }}
              className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900"
            >
              <X size={14} className="inline mr-1" /> Anulează
            </button>
            <button
              onClick={save}
              disabled={busy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium text-white disabled:opacity-50"
              style={{ background: '#FF6B35' }}
            >
              <Save size={14} /> Salvează
            </button>
          </div>
        </div>
      ) : (
        <div className="prose prose-sm max-w-none">
          {content.trim() ? (
            <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{content}</div>
          ) : (
            <p className="text-sm text-gray-400 italic">
              Niciun jurnal încă.{canEdit ? ' Scrie prima intrare cu click pe Editează.' : ''}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
