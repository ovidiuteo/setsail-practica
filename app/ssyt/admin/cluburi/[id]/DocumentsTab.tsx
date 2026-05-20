'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  FileText,
  Eye,
  Save,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import type { TemplateRow } from './ClubEditor'

const PLACEHOLDERS: Array<{ key: string; label: string; sample: string }> = [
  { key: 'nume_complet', label: 'Nume complet', sample: 'Corina Cobianu-Drugan' },
  { key: 'prenume', label: 'Prenume', sample: 'Corina' },
  { key: 'nume', label: 'Nume', sample: 'Cobianu-Drugan' },
  { key: 'email', label: 'Email', sample: 'corina@exemplu.ro' },
  { key: 'telefon', label: 'Telefon', sample: '+40 7XX XXX XXX' },
  { key: 'data_nasterii', label: 'Data nașterii', sample: '15.03.1985' },
  { key: 'cnp', label: 'CNP', sample: '2850315123456' },
  { key: 'cetatenia', label: 'Cetățenia', sample: 'Română' },
  { key: 'loc_nasterii', label: 'Loc nașterii', sample: 'București' },
  { key: 'judet_nasterii', label: 'Județ nașterii', sample: 'Sector 1' },
  { key: 'adresa', label: 'Adresă completă', sample: 'Str. Exemplu nr. 12, București' },
  { key: 'ci_seria', label: 'CI seria', sample: 'RR' },
  { key: 'ci_numar', label: 'CI număr', sample: '123456' },
  { key: 'ci_emis_de', label: 'CI emisă de', sample: 'SPCEP Sector 1' },
  { key: 'ci_emisa_la', label: 'CI emisă la', sample: '01.01.2020' },
  { key: 'nume_club', label: 'Nume club', sample: 'Santa Clara Yachting' },
  { key: 'adresa_club', label: 'Adresă club', sample: 'Str. Sabinelor 8, Sector 5' },
  { key: 'telefon_club', label: 'Telefon club', sample: '+40 722 ...' },
  { key: 'website_club', label: 'Website club', sample: 'https://...' },
  { key: 'data_curenta', label: 'Data curentă', sample: '15.05.2026' },
  { key: 'semnatura_img', label: '🖋️ Imagine semnătură', sample: '[img semnătură]' },
  { key: 'ci_img', label: '🆔 Imagine CI', sample: '[img CI]' },
  { key: 'loc_semnatura', label: 'Loc semnătură (img sau linie)', sample: '[img/linie]' },
]

export default function DocumentsTab({
  clubId,
  initial,
}: {
  clubId: string
  initial: TemplateRow[]
}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [templates, setTemplates] = useState<TemplateRow[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')

  function startAdd() {
    setEditingId(null)
    setAdding(true)
  }

  async function createTemplate(payload: {
    title: string
    description: string
    is_required: boolean
    html_content: string
  }) {
    setError('')
    const nextOrder = (templates[templates.length - 1]?.display_order ?? -1) + 1
    const { data, error: err } = await supabase
      .from('ssyt_club_document_templates')
      .insert({
        club_id: clubId,
        title: payload.title,
        description: payload.description || null,
        is_required: payload.is_required,
        html_content: payload.html_content,
        display_order: nextOrder,
      })
      .select('*')
      .single()

    if (err || !data) {
      setError(err?.message ?? 'Eroare la creare.')
      return
    }

    setTemplates((arr) => [...arr, data as TemplateRow])
    setAdding(false)
    setEditingId((data as TemplateRow).id)
    router.refresh()
  }

  async function updateTemplate(
    id: string,
    payload: {
      title: string
      description: string
      is_required: boolean
      html_content: string
    }
  ) {
    setError('')
    const { error: err } = await supabase
      .from('ssyt_club_document_templates')
      .update({
        title: payload.title,
        description: payload.description || null,
        is_required: payload.is_required,
        html_content: payload.html_content,
      })
      .eq('id', id)

    if (err) {
      setError(err.message)
      return
    }

    setTemplates((arr) =>
      arr.map((t) =>
        t.id === id
          ? {
              ...t,
              title: payload.title,
              description: payload.description || null,
              is_required: payload.is_required,
              html_content: payload.html_content,
            }
          : t
      )
    )
    setEditingId(null)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Sigur ștergi acest template? Va dispărea din portal pentru toți participanții.'))
      return
    const { error: err } = await supabase
      .from('ssyt_club_document_templates')
      .delete()
      .eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setTemplates((arr) => arr.filter((t) => t.id !== id))
    setEditingId(null)
    router.refresh()
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= templates.length) return
    const a = templates[index]
    const b = templates[target]
    const next = [...templates]
    next[index] = { ...b, display_order: a.display_order }
    next[target] = { ...a, display_order: b.display_order }
    setTemplates(next)
    await supabase
      .from('ssyt_club_document_templates')
      .update({ display_order: b.display_order })
      .eq('id', a.id)
    await supabase
      .from('ssyt_club_document_templates')
      .update({ display_order: a.display_order })
      .eq('id', b.id)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <p className="text-xs text-gray-500 max-w-xl">
          Template-uri HTML ce vor fi convertite în PDF de către participanți (Ctrl+P „Save as PDF").
          Folosește placeholderii din panoul din dreapta editorului — ei se înlocuiesc automat cu
          datele cursantului la generare.
        </p>
        <button
          onClick={startAdd}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Plus size={14} />
          Adaugă template
        </button>
      </div>

      {error && (
        <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}

      {adding && (
        <TemplateEditor
          onCancel={() => setAdding(false)}
          onSave={(p) => createTemplate(p)}
        />
      )}

      {templates.length === 0 && !adding && (
        <div
          className="rounded-lg border border-dashed py-10 text-center"
          style={{ borderColor: '#cbd5e1', background: '#fff' }}
        >
          <FileText size={28} className="mx-auto mb-2" style={{ color: '#94a3b8' }} />
          <p className="text-sm text-gray-500">
            Niciun template configurat. Adaugă unul ca să poată cursanții descărca documentele
            precompletate.
          </p>
        </div>
      )}

      <ol className="space-y-2">
        {templates.map((t, i) => {
          const isEditing = editingId === t.id
          return (
            <li
              key={t.id}
              className="rounded-lg border"
              style={{ borderColor: '#e2e8f0', background: '#fff' }}
            >
              <div className="px-4 py-3 flex items-center gap-3">
                <button
                  onClick={() => setEditingId(isEditing ? null : t.id)}
                  className="shrink-0 p-1 rounded hover:bg-gray-100"
                  title={isEditing ? 'Închide editor' : 'Deschide editor'}
                >
                  {isEditing ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium" style={{ color: '#0a1628' }}>
                    {t.title}
                    {t.is_required && (
                      <span
                        className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold"
                        style={{ background: '#fef3c7', color: '#92400e' }}
                      >
                        Obligatoriu
                      </span>
                    )}
                  </div>
                  {t.description && (
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.description}</div>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="Mută sus"
                  >
                    <ArrowUp size={13} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === templates.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                    title="Mută jos"
                  >
                    <ArrowDown size={13} />
                  </button>
                  <button
                    onClick={() => remove(t.id)}
                    className="p-1 rounded hover:bg-red-50"
                    title="Șterge"
                  >
                    <Trash2 size={13} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              </div>

              {isEditing && (
                <div className="border-t px-4 py-4" style={{ borderColor: '#e2e8f0' }}>
                  <TemplateEditor
                    initial={t}
                    onCancel={() => setEditingId(null)}
                    onSave={(p) => updateTemplate(t.id, p)}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// ============================================================================
// Inline editor (form + textarea HTML + placeholders sidebar + preview)
// ============================================================================
function TemplateEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial?: TemplateRow
  onCancel: () => void
  onSave: (payload: {
    title: string
    description: string
    is_required: boolean
    html_content: string
  }) => Promise<void> | void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [isRequired, setIsRequired] = useState(initial?.is_required ?? true)
  const [html, setHtml] = useState(initial?.html_content ?? defaultHtml())
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function insertAtCursor(text: string) {
    const ta = textareaRef.current
    if (!ta) {
      setHtml((h) => h + text)
      return
    }
    const start = ta.selectionStart ?? html.length
    const end = ta.selectionEnd ?? html.length
    const next = html.slice(0, start) + text + html.slice(end)
    setHtml(next)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(start + text.length, start + text.length)
    })
  }

  const previewHtml = useMemo(() => {
    let out = html
    for (const p of PLACEHOLDERS) {
      const re = new RegExp(`\\{\\{\\s*${p.key}\\s*\\}\\}`, 'g')
      const sample =
        p.key === 'semnatura_img' || p.key === 'loc_semnatura'
          ? '<span style="display:inline-block;border-bottom:1px solid #000;width:160px;text-align:center;color:#999;font-style:italic">semnătură</span>'
          : p.key === 'ci_img'
            ? '<span style="display:inline-block;border:1px dashed #999;padding:8px 16px;color:#999;font-style:italic">[poza CI]</span>'
            : escapeForHtml(p.sample)
      out = out.replace(re, sample)
    }
    return out
  }, [html])

  async function handleSave() {
    if (!title.trim()) {
      alert('Titlul e obligatoriu.')
      return
    }
    setSaving(true)
    await onSave({
      title: title.trim(),
      description: description.trim(),
      is_required: isRequired,
      html_content: html,
    })
    setSaving(false)
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
            Titlu *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="ex: Cerere de legitimare"
            required
          />
        </div>
        <div className="flex items-end">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isRequired}
              onChange={(e) => setIsRequired(e.target.checked)}
            />
            Document obligatoriu
          </label>
        </div>
      </div>

      <div>
        <label className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
          Descriere (afișată cursantului)
        </label>
        <input
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{ borderColor: '#cbd5e1' }}
          placeholder="ex: Anexa 1 către FRY — semnată olograf"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs uppercase tracking-wider" style={{ color: '#475569' }}>
              HTML conținut
            </label>
            <button
              type="button"
              onClick={() => setShowPreview((s) => !s)}
              className="inline-flex items-center gap-1 text-xs underline"
              style={{ color: '#FF6B35' }}
            >
              <Eye size={12} />
              {showPreview ? 'Ascunde preview' : 'Arată preview'}
            </button>
          </div>
          <textarea
            ref={textareaRef}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            rows={20}
            className="w-full px-3 py-2 rounded-md border text-xs font-mono"
            style={{ borderColor: '#cbd5e1', resize: 'vertical', minHeight: 360 }}
            spellCheck={false}
          />
        </div>

        <div
          className="rounded-md border p-3 max-h-[420px] overflow-y-auto"
          style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}
        >
          <div className="text-xs font-medium uppercase tracking-wider mb-2" style={{ color: '#475569' }}>
            Placeholderi
          </div>
          <p className="text-[11px] text-gray-500 mb-2">
            Click pe unul ca să-l inserezi în text la poziția cursorului.
          </p>
          <ul className="space-y-1">
            {PLACEHOLDERS.map((p) => (
              <li key={p.key}>
                <button
                  type="button"
                  onClick={() => insertAtCursor(`{{${p.key}}}`)}
                  className="w-full text-left px-2 py-1 rounded text-xs hover:bg-orange-50 transition"
                  title={`Exemplu: ${p.sample}`}
                >
                  <code className="text-[11px]" style={{ color: '#FF6B35' }}>
                    {`{{${p.key}}}`}
                  </code>
                  <div className="text-[10px] text-gray-500">{p.label}</div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showPreview && (
        <div className="rounded-md border" style={{ borderColor: '#e2e8f0' }}>
          <div
            className="px-3 py-2 text-xs uppercase tracking-wider border-b flex items-center justify-between"
            style={{ borderColor: '#e2e8f0', background: '#f8fafc', color: '#475569' }}
          >
            <span>Preview (cu valori mock)</span>
            <span className="text-[10px] text-gray-400">A4 simulat</span>
          </div>
          <iframe
            title="Preview"
            srcDoc={`<style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.45;padding:20px;color:#000;background:#fff}</style>${previewHtml}`}
            className="w-full"
            style={{ minHeight: 420, border: 'none', background: '#fff' }}
            sandbox=""
          />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-50"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Save size={14} />
          {saving ? 'Se salvează...' : initial ? 'Salvează modificările' : 'Creează template'}
        </button>
        <button
          onClick={onCancel}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100"
        >
          <X size={14} />
          Anulează
        </button>
      </div>
    </div>
  )
}

function escapeForHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function defaultHtml(): string {
  return `<h2 style="text-align:center">TITLU DOCUMENT</h2>

<p>Subsemnatul/a <strong>{{nume_complet}}</strong>, CNP <strong>{{cnp}}</strong>,
domiciliat(ă) în {{adresa}}, posesor al CI seria <strong>{{ci_seria}}</strong> nr.
<strong>{{ci_numar}}</strong>, eliberată de {{ci_emis_de}} la data de {{ci_emisa_la}},</p>

<p>declar prin prezenta că ...</p>

<p style="margin-top:2em">
  Data: {{data_curenta}}<br/>
  Semnătura: {{loc_semnatura}}
</p>`
}
