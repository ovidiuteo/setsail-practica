'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Mail, ListOrdered, Download, Send, XCircle } from 'lucide-react'

type Template = {
  id: string
  title: string
  description: string | null
  is_required: boolean
  is_full_package?: boolean | null
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

type TabKey = 'documents' | 'procedures' | 'communication'

const TAB_META: Record<TabKey, { label: string; icon: typeof FileText }> = {
  documents: { label: 'Documente', icon: FileText },
  procedures: { label: 'Proceduri', icon: ListOrdered },
  communication: { label: 'Comunicare', icon: Mail },
}

// Inainte de submit: Documente | Proceduri | Comunicare
const TABS_BEFORE_SUBMIT: TabKey[] = ['documents', 'procedures', 'communication']
// Dupa submit: Proceduri pe primul loc (deja a trimis docs, urmeaza pasii)
const TABS_AFTER_SUBMIT: TabKey[] = ['procedures', 'documents', 'communication']

export default function ApplicationFlow({
  applicationId,
  applicationStatus,
  clubSlug,
  clubName,
  participantName,
  templates,
  contacts,
  procedures,
}: {
  applicationId: string
  applicationStatus: string
  clubSlug: string
  clubName: string
  participantName: string
  templates: Template[]
  contacts: Contact[]
  procedures: Procedure[]
}) {
  const router = useRouter()

  const isStarted = applicationStatus === 'started'
  const isFinal = applicationStatus === 'approved' || applicationStatus === 'rejected'

  // Tab ordering + default depinde de status: cand cursantul lucreaza vede documentele,
  // dupa trimiterea aplicatiei vede mai intai procedurile (ce mai are de facut).
  const tabsOrder = isStarted ? TABS_BEFORE_SUBMIT : TABS_AFTER_SUBMIT
  const [tab, setTab] = useState<TabKey>(tabsOrder[0])

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
        'Marchezi aplicația ca trimisă? Asta confirmă că ai trimis efectiv documentele clubului prin email. Câmpul de email și butoanele vor dispărea.'
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

  const totalSteps = procedures.length
  const completedSteps = procedures.filter((p) => checked[p.id]).length

  return (
    <div>
      <div className="flex items-center border-b mb-4" style={{ borderColor: '#e2e8f0' }}>
        {tabsOrder.map((key) => {
          const { label, icon: Icon } = TAB_META[key]
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
        <DocumentsList templates={templates} applicationId={applicationId} />
      )}

      {tab === 'communication' && (
        <CommunicationList
          contacts={contacts}
          clubName={clubName}
          participantName={participantName}
        />
      )}

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
        <div className="mt-6 space-y-3">
          {isStarted && (
            <SubmitBlock
              contacts={contacts}
              clubName={clubName}
              participantName={participantName}
              onMarkAsSent={submit}
              submitting={submitting}
              currentTab={tab}
              onSwitchTab={setTab}
            />
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

// ============================================================================
// Submit block: email field + mailto button + "Am trimis aplicatia" button
// ============================================================================
function SubmitBlock({
  contacts,
  clubName,
  participantName,
  onMarkAsSent,
  submitting,
  currentTab,
  onSwitchTab,
}: {
  contacts: Contact[]
  clubName: string
  participantName: string
  onMarkAsSent: () => void | Promise<void>
  submitting: boolean
  currentTab: TabKey
  onSwitchTab: (k: TabKey) => void
}) {
  const defaultEmail =
    contacts.find((c) => c.contact_type === 'inscriere')?.email ??
    contacts.find((c) => c.contact_type === 'general')?.email ??
    contacts[0]?.email ??
    ''

  const [email, setEmail] = useState(defaultEmail)

  const subject = buildSubject('inscriere', participantName, clubName)
  const body = buildBody(participantName, clubName)
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`

  let greenJump: { label: string; icon: typeof FileText; target: TabKey } | null = null
  if (currentTab === 'documents') {
    greenJump = { label: 'Vezi procedurile', icon: ListOrdered, target: 'procedures' }
  } else if (currentTab === 'procedures') {
    greenJump = { label: 'Vezi documente', icon: FileText, target: 'documents' }
  }

  return (
    <div
      className="rounded-lg border p-4"
      style={{ borderColor: '#e2e8f0', background: '#fff' }}
    >
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="email club"
        className="w-full mb-3 px-3 py-2 rounded-md border text-sm font-mono"
        style={{ borderColor: '#cbd5e1' }}
      />

      <div className="flex items-center gap-2 flex-wrap">
        <a
          href={mailto}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Mail size={14} />
          Trimite aplicația
        </a>
        <button
          onClick={onMarkAsSent}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold disabled:opacity-50"
          style={{ background: '#2563eb', color: '#fff' }}
        >
          <Send size={14} />
          {submitting ? 'Se marchează...' : 'Am trimis aplicația'}
        </button>
        {greenJump &&
          (() => {
            const GreenIcon = greenJump.icon
            return (
              <button
                onClick={() => onSwitchTab(greenJump!.target)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-sm font-semibold transition"
                style={{ background: '#16a34a', color: '#fff' }}
              >
                <GreenIcon size={14} />
                {greenJump!.label}
              </button>
            )
          })()}
      </div>
    </div>
  )
}

function DocumentsList({
  templates,
  applicationId,
}: {
  templates: Template[]
  applicationId: string
}) {
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
    <div>
      <p className="text-xs text-gray-500 mb-3">
        Click pe „Generează PDF" deschide documentul precompletat într-un tab nou. Folosește{' '}
        <strong>Ctrl+P</strong> (sau <strong>⌘P</strong> pe Mac) și alege „Save as PDF". Asigură-te că
        ai uploadat poza CI și semnătura în{' '}
        <a href="/ssyt/portal/profile/identitate" className="underline" style={{ color: '#FF6B35' }}>
          Profil → Identitate
        </a>
        .
      </p>
      <ul className="space-y-2">
        {templates.map((t) => (
          <li
            key={t.id}
            className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            style={{
              borderColor: t.is_full_package ? '#bbf7d0' : '#e2e8f0',
              background: t.is_full_package ? '#f0fdf4' : '#fff',
            }}
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
                {t.is_full_package && (
                  <span
                    className="ml-2 inline-block text-[10px] px-1.5 py-0.5 rounded uppercase font-semibold"
                    style={{ background: '#dcfce7', color: '#166534' }}
                  >
                    Pachet complet
                  </span>
                )}
              </div>
              {t.description && <div className="text-xs text-gray-500 mt-0.5">{t.description}</div>}
            </div>

            <a
              href={`/api/ssyt/club/application/${applicationId}/document/${t.id}/render`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition shrink-0"
              style={{ background: '#FF6B35', color: '#fff' }}
            >
              <Download size={12} />
              Generează PDF
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

const SUBJECT_PER_TYPE: Record<string, string> = {
  inscriere: 'Adeziune și înscriere ca membru',
  contabilitate: 'Cotizație de membru',
  gdpr: 'Solicitare GDPR',
  antrenor: 'Înscriere antrenor',
  general: 'Cerere informații',
  altul: 'Solicitare',
}

function buildSubject(contactType: string, participantName: string, clubName: string) {
  const base = SUBJECT_PER_TYPE[contactType] ?? 'Solicitare'
  return `${base} — ${participantName} — ${clubName}`
}

function buildBody(participantName: string, clubName: string) {
  return [
    'Bună ziua,',
    '',
    `Vă transmit atașat documentele de înscriere ca membru al ${clubName}.`,
    '',
    'Vă mulțumesc!',
    participantName,
  ].join('\n')
}

function CommunicationList({
  contacts,
  clubName,
  participantName,
}: {
  contacts: Contact[]
  clubName: string
  participantName: string
}) {
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
        Adresele de mai jos sunt pre-completate. Editează-le dacă vrei să trimiți la altcineva. Apasă
        „Trimite emailul" → se deschide clientul tău de email (Outlook, Gmail etc.) cu subject și text
        gata. <strong>Nu trimitem nimic automat din platformă.</strong> Atașează PDF-urile generate
        înainte de a trimite.
      </p>
      <ul className="space-y-3">
        {contacts.map((c) => (
          <ContactRow
            key={c.id}
            contact={c}
            clubName={clubName}
            participantName={participantName}
          />
        ))}
      </ul>
    </div>
  )
}

function ContactRow({
  contact,
  clubName,
  participantName,
}: {
  contact: Contact
  clubName: string
  participantName: string
}) {
  const [email, setEmail] = useState(contact.email)

  const subject = buildSubject(contact.contact_type, participantName, clubName)
  const body = buildBody(participantName, clubName)
  const mailto = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(
    subject
  )}&body=${encodeURIComponent(body)}`

  return (
    <li
      className="rounded-lg border px-4 py-3"
      style={{ borderColor: '#e2e8f0', background: '#fff' }}
    >
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span
          className="inline-block text-xs px-2 py-0.5 rounded-full"
          style={{ background: '#fff7ed', color: '#FF6B35' }}
        >
          {CONTACT_TYPE_LABEL[contact.contact_type] ?? contact.contact_type}
        </span>
        {contact.name && <span className="text-xs text-gray-500">{contact.name}</span>}
        {contact.label && (
          <span className="text-xs text-gray-400">· {contact.label}</span>
        )}
      </div>

      <div className="flex items-stretch gap-2 flex-wrap">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="flex-1 min-w-[200px] px-3 py-2 rounded-md border text-sm font-mono"
          style={{ borderColor: '#cbd5e1' }}
        />
        <a
          href={mailto}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Mail size={14} />
          Trimite emailul
        </a>
      </div>
    </li>
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
