'use client'

import { useState } from 'react'
import { Info, Mail, ListOrdered, FileText, ClipboardList } from 'lucide-react'
import InfoTab from './InfoTab'
import ContactsTab from './ContactsTab'
import ProceduresTab from './ProceduresTab'

export type ClubRow = {
  id: string
  slug: string
  name: string
  short_description: string | null
  description_md: string | null
  logo_url: string | null
  address: string | null
  website: string | null
  phone: string | null
  display_order: number
  is_active: boolean
  season_id: string | null
}

export type ContactRow = {
  id: string
  club_id: string
  contact_type: string
  name: string | null
  email: string
  label: string | null
  display_order: number
}

export type ProcedureRow = {
  id: string
  club_id: string
  step_no: number
  title: string
  description_md: string | null
  optional_link: string | null
}

export type TemplateRow = {
  id: string
  title: string
  description: string | null
  is_required: boolean
  display_order: number
  updated_at: string | null
}

export type ApplicationRow = {
  id: string
  status: string
  started_at: string | null
  submitted_at: string | null
  decided_at: string | null
  admin_notes: string | null
  participant: { id: string; full_name: string | null; email: string | null } | null
}

const TABS = [
  { key: 'info', label: 'Info', icon: Info },
  { key: 'documents', label: 'Documente', icon: FileText },
  { key: 'contacts', label: 'Contacte (email)', icon: Mail },
  { key: 'procedures', label: 'Proceduri', icon: ListOrdered },
  { key: 'applications', label: 'Aplicații', icon: ClipboardList },
] as const

type TabKey = (typeof TABS)[number]['key']

export default function ClubEditor({
  club,
  contacts,
  procedures,
  templates,
  applications,
}: {
  club: ClubRow
  contacts: ContactRow[]
  procedures: ProcedureRow[]
  templates: TemplateRow[]
  applications: ApplicationRow[]
}) {
  const [tab, setTab] = useState<TabKey>('info')

  return (
    <div>
      <div className="flex items-center border-b mb-6" style={{ borderColor: '#e2e8f0' }}>
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
              {key === 'applications' && applications.length > 0 && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-full"
                  style={{ background: '#fff7ed', color: '#FF6B35' }}
                >
                  {applications.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'info' && <InfoTab club={club} />}
      {tab === 'contacts' && <ContactsTab clubId={club.id} initial={contacts} />}
      {tab === 'procedures' && <ProceduresTab clubId={club.id} initial={procedures} />}
      {tab === 'documents' && (
        <Placeholder
          title="Template-uri documente"
          message="Editorul HTML cu placeholderi vine în următorul deploy (Batch 2)."
          subtitle={`${templates.length} template-uri configurate momentan.`}
        />
      )}
      {tab === 'applications' && (
        <Placeholder
          title="Aplicații participanți"
          message="Lista de aplicații + aprobare/respingere vine în Batch 3."
          subtitle={`${applications.length} aplicații în total.`}
        />
      )}
    </div>
  )
}

function Placeholder({
  title,
  message,
  subtitle,
}: {
  title: string
  message: string
  subtitle?: string
}) {
  return (
    <div
      className="rounded-lg border border-dashed py-10 px-6 text-center"
      style={{ borderColor: '#cbd5e1', background: '#fff' }}
    >
      <h3 className="text-base font-medium mb-1" style={{ color: '#0a1628' }}>
        {title}
      </h3>
      <p className="text-sm text-gray-500">{message}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-2">{subtitle}</p>}
    </div>
  )
}
