'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Mail, ListOrdered, Download, Send, XCircle } from 'lucide-react'

type Template = {
  id: string
  title: string
  description: string | null
  is_required: boolean
  display_order: number
}

type Contact = {
  id: string
  contact_type: string
  name: string | null
  email: string
  label: string | null
  display_order: number
}

type Procedure = {
  id: string
  step_no: number
  title: string
  description_md: string | null
  optional_link: string | null
}

const CONTACT_TYPE_LABEL: Record<string, string> = {
  general: 'General',
  inscriere: 'Înscriere',
  contabilitate: 'Contabilitate',
  gdpr: 'GDPR',
  antrenor: 'Antrenor',
  altul: 'Altul',
}

const TABS = [
  { key: 'documents', label: 'Documente', icon: FileText },
  { key: 'communication', label: 'Comunicare', icon: Mail },
  { key: 'procedures', label: 'Proceduri', icon: ListOrdered },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ApplicationFlow({
  applicationId,
  applicationStatus,
  clubSlug,
  templates,
  contacts,
  procedures,
}: {
  applicationId: string
  applicationStatus: string
  clubSlug: string
  templates: Template[]
  contacts: Contact[]
  procedures: Procedure[]
}) {
  const router = useRouter()
  const [tab, setTab] = useState<TabKey>('documents')
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState('')

  // Persistam bifele local in localStorage (per aplicatie)
  const STORAGE_KEY = `ssyt_app_${applicationId}_steps`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setChecked(JSON.parse(raw))
    } catch {
      // ignore
    }
  }, [STORAGE_KEY])

  function toggleStep(id: string) {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore
    }
  }

  async function submit() {
    if (
      !confirm(
        'Confirmi trimiterea aplicației către club? După trimitere, clubul va analiza cererea ta și îți va răspunde prin email.'
      )
    )
      return

    setSubmitting(true)
    setError('')
    const res = await fetch(`/api/ssyt/club/application/${applicationId}/submit`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setSubmitting(false)

    if (!res.ok || !json.ok) {
      setError(json.error || 'A apărut o eroare la trimitere.')
      return
    }
    router.refresh()
  }

  async function cancel() {
    if (
      !confirm(
        'Sigur anulezi această aplicație? Vei putea aplica la un alt club după anulare.'
      )
    )
      return

    setCancelling(true)
    setError('')
    const res = await fetch(`/api/ssyt/club/application/${applicationId}/cancel`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setCancelling(false)

    if (!res.ok || !json.ok) {
      setError(json.error || 'A apărut o eroare la anulare.')
      return
    }
    router.push('/ssyt/portal/club')
    router.refresh()
  }

  const isStarted = applicationStatus === 'started'
  const isFinal = applicationStatus === 'approved' || applicationStatus === 'rejected'
  const totalSteps = procedures.length
  const completedSteps = procedures.filter((p) => checked[p.id]).length

  return (
    <div>
      <div className="flex items-center border-b mb-4" style={{ borderColor: '#e2e8f0' }}>
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition border-b-2 -mb-px"
              style={{
                color: active ? '#FF6B35' : '#64748b',
                borderColor: active ? '#FF6B35' : 'transparent',
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          )
        })}
      </div>

      {tab === 'documents' && (
        <DocumentsList templates={templates} />
      )}

      {tab === 'communication' && <CommunicationList contacts={contacts} />}

      {tab === 'procedures' && (
        <ProceduresChecklist
          procedures={procedures}
          checked={checked}
          onToggle={toggleStep}
          completedSteps={completedSteps}
          totalSteps={totalSteps}
        />
      )}

      {error && (
        <div
          className="mt-4 text-sm rounded-md px-3 py-2"
          style={{ background: '#fef2f2', color: '#dc2626' }}
        >
          {error}
        </div>
      )}

      {!isFinal && (
        <div className="mt-6 flex flex-wrap gap-3 items-center">
          {isStarted && (
            <button
              onClick={submit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold disabled:opacity-50"
              style={{ background: '#FF6B35', color: '#fff' }}
            >
              <Send size={14} />
              {submitting ? 'Se trimite...' : 'Trimite aplicația'}
            </button>
          )}

          <button
            onClick={cancel}
            disabled={cancelling}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium hover:bg-red-50 disabled:opacity-50"
            style={{ color: '#dc2626' }}
          >
            <XCircle size={14} />
            {cancelling ? 'Se anulează...' : 'Anulează aplicația'}
          </button>
        </div>
      )}
    </div>
  )
}

function DocumentsList({ templates }: { templates: Template[] }) {
  if (templates.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-10 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <p className="text-sm text-gray-500">
          Clubul nu a configurat încă documente de descărcat. Te rugăm să consulți secțiunea
          „Comunicare" pentru a contacta clubul direct.
        </p>
      </div>
    )
  }

  return (
    <ul className="space-y-2">
      {templates.map((t) => (
        <li
          key={t.id}
          className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
          style={{ borderColor: '#e2e8f0', background: '#fff' }}
        >
          <div className="min-w-0 flex-1">
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
            {t.description && <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
          </div>

          <button
            disabled
            title="Generare PDF disponibilă în următorul deploy"
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium opacity-50 cursor-not-allowed"
            style={{ background: '#f1f5f9', color: '#475569' }}
          >
            <Download size={12} />
            PDF (în curând)
          </button>
        </li>
      ))}
    </ul>
  )
}

function CommunicationList({ contacts }: { contacts: Contact[] }) {
  if (contacts.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-10 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <p className="text-sm text-gray-500">
          Clubul nu a configurat încă adrese de contact.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Copiază adresele de mai jos și trimite documentele din clientul tău obișnuit de email
        (Outlook, Gmail etc.). Nu trimitem mesajul prin platformă.
      </p>
      <ul className="space-y-2">
        {contacts.map((c) => (
          <li
            key={c.id}
            className="rounded-lg border px-4 py-3"
            style={{ borderColor: '#e2e8f0', background: '#fff' }}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className="inline-block text-xs px-2 py-0.5 rounded-full"
                style={{ background: '#fff7ed', color: '#FF6B35' }}
              >
                {CONTACT_TYPE_LABEL[c.contact_type] ?? c.contact_type}
              </span>
              {c.name && <span className="text-xs text-gray-500">{c.name}</span>}
            </div>
            <div className="text-sm font-mono select-all" style={{ color: '#0a1628' }}>
              {c.email}
            </div>
            {c.label && <div className="text-xs text-gray-400 mt-0.5">{c.label}</div>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function ProceduresChecklist({
  procedures,
  checked,
  onToggle,
  completedSteps,
  totalSteps,
}: {
  procedures: Procedure[]
  checked: Record<string, boolean>
  onToggle: (id: string) => void
  completedSteps: number
  totalSteps: number
}) {
  if (procedures.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-10 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <p className="text-sm text-gray-500">Clubul nu a definit încă pași de urmat.</p>
      </div>
    )
  }

  return (
    <div>
      {totalSteps > 0 && (
        <div className="mb-3 text-xs text-gray-500">
          Progres: <strong>{completedSteps}</strong> / {totalSteps} pași bifați (doar local —
          ajută-te să urmărești ce ai făcut)
        </div>
      )}
      <ol className="space-y-2">
        {procedures.map((step) => {
          const isChecked = !!checked[step.id]
          return (
            <li
              key={step.id}
              className="rounded-lg border px-4 py-3 flex items-start gap-3 cursor-pointer transition"
              style={{
                borderColor: isChecked ? '#bbf7d0' : '#e2e8f0',
                background: isChecked ? '#f0fdf4' : '#fff',
              }}
              onClick={() => onToggle(step.id)}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => onToggle(step.id)}
                onClick={(e) => e.stopPropagation()}
                className="mt-1 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-medium"
                  style={{ color: '#0a1628', textDecoration: isChecked ? 'line-through' : 'none' }}
                >
                  {step.step_no}. {step.title}
                </div>
                {step.description_md && (
                  <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">
                    {step.description_md}
                  </div>
                )}
                {step.optional_link && (
                  <a
                    href={step.optional_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline mt-1 inline-block"
                    style={{ color: '#FF6B35' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {step.optional_link}
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
