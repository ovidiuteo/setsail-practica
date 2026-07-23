'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Search,
  RefreshCw,
  Check,
  X,
  Trash2,
  Edit2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Save,
  Mail,
  Smartphone,
} from 'lucide-react'
import GoogleGIcon from '@/components/GoogleGIcon'
import { supabase } from '@/lib/supabase'
import { mailVarValues, extractVars, MAIL_VARIABLES_FLAT } from '@/lib/mail-template'
import { buildFields, INTEREST_GENRES, genreLabel, type Genre, type InterestField } from '@/lib/interese-catalog'
import { Plus, Eye, EyeOff } from 'lucide-react'

type Template = {
  id: string
  key: string
  label: string
  category: 'scoala' | 'expeditii' | 'sales' | 'admin' | 'altele'
  subject: string
  body_text: string
  body_html: string | null
  variables: string[]
  is_active: boolean
  is_proposed: boolean
  source_message_ids: string[]
  notes: string | null
  created_at: string
  updated_at: string
}

const CATEGORY_LABELS: Record<Template['category'], string> = {
  scoala: 'Școală',
  expeditii: 'Expediții',
  sales: 'Sales',
  admin: 'Admin',
  altele: 'Altele',
}

const CATEGORY_COLORS: Record<Template['category'], { bg: string; fg: string }> = {
  scoala: { bg: '#dbeafe', fg: '#1e40af' },
  expeditii: { bg: '#dcfce7', fg: '#15803d' },
  sales: { bg: '#fef3c7', fg: '#92400e' },
  admin: { bg: '#f3e8ff', fg: '#6b21a8' },
  altele: { bg: '#f3f4f6', fg: '#374151' },
}

function highlightVars(text: string) {
  return text.split(/(\{\{[^}]+\}\})/g).map((p, i) =>
    p.startsWith('{{') && p.endsWith('}}') ? (
      <code
        key={i}
        style={{
          background: '#fef3c7',
          color: '#92400e',
          padding: '1px 5px',
          borderRadius: 4,
          fontSize: '0.85em',
          fontFamily: 'ui-monospace, monospace',
        }}
      >
        {p}
      </code>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

export default function GmailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<'all' | Template['category']>('all')
  const [status, setStatus] = useState<'all' | 'proposed' | 'active' | 'inactive'>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Partial<Template>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [tab, setTab] = useState<'templates' | 'leads'>('leads')
  useEffect(() => { try { const t = localStorage.getItem('gmail_tab'); if (t === 'leads' || t === 'templates') setTab(t) } catch {} }, [])
  const changeTab = (k: 'templates' | 'leads') => { setTab(k); try { localStorage.setItem('gmail_tab', k) } catch {} }

  async function load() {
    setLoading(true)
    const res = await fetch('/api/gmail-templates')
    const data = await res.json()
    setTemplates(data.templates ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => {
    return templates.filter((t) => {
      if (category !== 'all' && t.category !== category) return false
      if (status === 'proposed' && !t.is_proposed) return false
      if (status === 'active' && !t.is_active) return false
      if (status === 'inactive' && (t.is_active || t.is_proposed)) return false
      if (search) {
        const s = search.toLowerCase()
        if (
          !t.label.toLowerCase().includes(s) &&
          !t.subject.toLowerCase().includes(s) &&
          !t.body_text.toLowerCase().includes(s) &&
          !t.key.toLowerCase().includes(s)
        ) return false
      }
      return true
    })
  }, [templates, category, status, search])

  const stats = useMemo(() => ({
    total: templates.length,
    proposed: templates.filter((t) => t.is_proposed).length,
    active: templates.filter((t) => t.is_active).length,
    inactive: templates.filter((t) => !t.is_active && !t.is_proposed).length,
  }), [templates])

  async function patch(id: string, body: Partial<Template>) {
    setSavingId(id)
    const res = await fetch(`/api/gmail-templates/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.ok) {
      const data = await res.json()
      setTemplates((cur) => cur.map((t) => (t.id === id ? data.template : t)))
    } else {
      alert('Eroare la salvare')
    }
    setSavingId(null)
  }

  async function activate(t: Template) {
    await patch(t.id, { is_active: true, is_proposed: false })
  }
  async function deactivate(t: Template) {
    await patch(t.id, { is_active: false, is_proposed: false })
  }
  async function discard(t: Template) {
    if (!confirm(`Ștergi template-ul "${t.label}"?`)) return
    setSavingId(t.id)
    const res = await fetch(`/api/gmail-templates/${t.id}`, { method: 'DELETE' })
    if (res.ok) setTemplates((cur) => cur.filter((x) => x.id !== t.id))
    else alert('Eroare la ștergere')
    setSavingId(null)
  }

  function startEdit(t: Template) {
    setEditingId(t.id)
    setExpandedId(t.id)
    setDraft({
      label: t.label,
      subject: t.subject,
      body_text: t.body_text,
      variables: t.variables,
      category: t.category,
      notes: t.notes ?? '',
    })
  }
  function cancelEdit() {
    setEditingId(null)
    setDraft({})
  }
  async function saveEdit(id: string) {
    await patch(id, draft)
    setEditingId(null)
    setDraft({})
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <GoogleGIcon size={32} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Gmail Templates</h1>
          <p className="text-sm text-gray-500">
            Template-uri propuse de scanner pe office@setsail.ro
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          disabled={loading}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Reîncarcă
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-4">
        {([['leads', 'Import mail → Leaduri'], ['templates', 'Template-uri']] as const).map(([k, lbl]) => (
          <button key={k} onClick={() => changeTab(k)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 ${tab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'leads' && <LeadsTab />}

      {tab === 'templates' && (<>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Total" value={stats.total} color="#374151" />
        <StatCard label="Propuse" value={stats.proposed} color="#d97706" />
        <StatCard label="Active" value={stats.active} color="#15803d" />
        <StatCard label="Inactive" value={stats.inactive} color="#6b7280" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            size={14}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Caută în label, subject, body..."
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-md focus:outline-none focus:border-gray-400"
          />
        </div>
        <div className="flex gap-1">
          <FilterChip active={status === 'all'} onClick={() => setStatus('all')}>
            Toate
          </FilterChip>
          <FilterChip active={status === 'proposed'} onClick={() => setStatus('proposed')} color="#d97706">
            Propuse
          </FilterChip>
          <FilterChip active={status === 'active'} onClick={() => setStatus('active')} color="#15803d">
            Active
          </FilterChip>
          <FilterChip active={status === 'inactive'} onClick={() => setStatus('inactive')}>
            Inactive
          </FilterChip>
        </div>
        <div className="flex gap-1">
          <FilterChip active={category === 'all'} onClick={() => setCategory('all')}>
            Toate cat.
          </FilterChip>
          {(['scoala', 'expeditii', 'sales', 'admin', 'altele'] as const).map((c) => (
            <FilterChip
              key={c}
              active={category === c}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center text-gray-500 py-12">Se încarcă...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-500 py-12">
          {templates.length === 0
            ? 'Niciun template încă. Rulează scanner-ul.'
            : 'Niciun template cu filtrele curente.'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const expanded = expandedId === t.id
            const editing = editingId === t.id
            const cat = CATEGORY_COLORS[t.category]
            return (
              <div
                key={t.id}
                className="bg-white rounded-lg border border-gray-200 overflow-hidden"
              >
                {/* Row header */}
                <div className="p-3 flex items-start gap-3">
                  {/* Status dot */}
                  <div
                    title={
                      t.is_active ? 'Activ' : t.is_proposed ? 'Propus' : 'Inactiv'
                    }
                    className="w-2 h-2 rounded-full mt-2 shrink-0"
                    style={{
                      background: t.is_active
                        ? '#22c55e'
                        : t.is_proposed
                        ? '#f59e0b'
                        : '#9ca3af',
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-gray-900">
                        {t.label}
                      </span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: cat.bg, color: cat.fg }}
                      >
                        {CATEGORY_LABELS[t.category]}
                      </span>
                      <code className="text-xs text-gray-400 font-mono">
                        {t.key}
                      </code>
                    </div>
                    <div className="text-sm text-gray-700 truncate">
                      <span className="text-gray-400">Subject: </span>
                      {highlightVars(t.subject)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 flex gap-3 flex-wrap">
                      <span>{t.variables.length} variabile</span>
                      <span>·</span>
                      <span>{t.source_message_ids?.length ?? 0} mesaje sursă</span>
                      {t.is_proposed && (
                        <>
                          <span>·</span>
                          <span className="flex items-center gap-1" style={{ color: '#d97706' }}>
                            <Sparkles size={11} /> Necesită revizie
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setExpandedId(expanded ? null : t.id)}
                      className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                      title={expanded ? 'Restrânge' : 'Vezi body'}
                    >
                      {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {!editing && (
                      <button
                        onClick={() => startEdit(t)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
                        title="Editează"
                        disabled={savingId === t.id}
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                    {t.is_active ? (
                      <button
                        onClick={() => deactivate(t)}
                        className="px-2 py-1 rounded text-xs font-medium border border-gray-300 text-gray-600 hover:bg-gray-50"
                        disabled={savingId === t.id}
                      >
                        Dezactivează
                      </button>
                    ) : (
                      <button
                        onClick={() => activate(t)}
                        className="px-2 py-1 rounded text-xs font-medium text-white hover:opacity-90 flex items-center gap-1"
                        style={{ background: '#22c55e' }}
                        disabled={savingId === t.id}
                      >
                        <Check size={12} /> Activează
                      </button>
                    )}
                    <button
                      onClick={() => discard(t)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title="Șterge"
                      disabled={savingId === t.id}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Expanded body */}
                {expanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-3">
                    {editing ? (
                      <div className="space-y-2">
                        <Field label="Label">
                          <input
                            value={draft.label as string}
                            onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </Field>
                        <Field label="Categorie">
                          <select
                            value={draft.category as string}
                            onChange={(e) => setDraft({ ...draft, category: e.target.value as any })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {(['scoala', 'expeditii', 'sales', 'admin', 'altele'] as const).map((c) => (
                              <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Subject">
                          <input
                            value={draft.subject as string}
                            onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                          />
                        </Field>
                        <Field label="Variabile (comma-separated)">
                          <input
                            value={(draft.variables as string[] ?? []).join(', ')}
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                variables: e.target.value
                                  .split(',')
                                  .map((s) => s.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded font-mono"
                          />
                        </Field>
                        <Field label="Body">
                          <textarea
                            value={draft.body_text as string}
                            onChange={(e) => setDraft({ ...draft, body_text: e.target.value })}
                            rows={12}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded font-mono whitespace-pre-wrap"
                            style={{ fontFamily: 'ui-monospace, monospace' }}
                          />
                        </Field>
                        <Field label="Note">
                          <textarea
                            value={(draft.notes as string) ?? ''}
                            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                            rows={2}
                            className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          />
                        </Field>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(t.id)}
                            disabled={savingId === t.id}
                            className="flex items-center gap-1 px-3 py-1.5 text-sm rounded text-white"
                            style={{ background: '#2563eb' }}
                          >
                            <Save size={13} /> Salvează
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-600"
                          >
                            <X size={13} className="inline mr-1" /> Anulează
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                            Variabile
                          </div>
                          {t.variables.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {t.variables.map((v) => (
                                <code
                                  key={v}
                                  className="text-xs px-1.5 py-0.5 rounded"
                                  style={{
                                    background: '#fef3c7',
                                    color: '#92400e',
                                    fontFamily: 'ui-monospace, monospace',
                                  }}
                                >
                                  {`{{${v}}}`}
                                </code>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400 italic">
                              Nicio variabilă
                            </span>
                          )}
                        </div>
                        <div>
                          <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                            Body
                          </div>
                          <div
                            className="bg-white border border-gray-200 rounded p-2 text-sm whitespace-pre-wrap"
                            style={{ fontFamily: 'ui-monospace, monospace' }}
                          >
                            {highlightVars(t.body_text)}
                          </div>
                        </div>
                        {t.notes && (
                          <div>
                            <div className="text-xs uppercase tracking-wider text-gray-400 mb-1">
                              Note
                            </div>
                            <div className="text-sm text-gray-700">{t.notes}</div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
      </>)}
    </div>
  )
}

function LeadsTab() {
  const [raw, setRaw] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ nume: '', prenume: '', email: '', telefon: '', rezumat: '', observatii: '' })
  const [extra, setExtra] = useState<Record<string, any>>({})
  const [leads, setLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Date pentru modalul de trimis mail (template + interese/sesiune)
  const [mailLead, setMailLead] = useState<any | null>(null)
  const [editLead, setEditLead] = useState<any | null>(null)
  const [mailTemplates, setMailTemplates] = useState<any[]>([])
  const [mailSessions, setMailSessions] = useState<any[]>([])
  const [mailContacts, setMailContacts] = useState<any[]>([])
  const [mailSetsailInfo, setMailSetsailInfo] = useState<Record<string, string>>({})
  const [instructorMap, setInstructorMap] = useState<Record<string, string>>({})

  async function load() {
    const r = await fetch('/api/mail-leads'); const j = await r.json()
    setLeads(j.leads || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  // Încarcă o singură dată datele necesare pentru compunerea mailului
  useEffect(() => {
    supabase.from('mail_templates').select('*').eq('activ', true).order('categorie').order('label')
      .then(({ data }) => setMailTemplates(data || []))
    supabase.from('sessions')
      .select('id, class_caa, session_date, course_start_date, practice_start_date, practice_start_time, location_detail, access_code, contact_person_ids, instructor_id, instructor_id_2, instructor_id_3, status, boats(name), locations(name), evaluators(email_oficial, email_personal)')
      .order('session_date', { ascending: false })
      .then(({ data }) => setMailSessions(data || []))
    supabase.from('contact_persons').select('*').eq('activ', true).order('full_name')
      .then(({ data }) => setMailContacts(data || []))
    supabase.from('setsail_info').select('key, value')
      .then(({ data }) => setMailSetsailInfo(Object.fromEntries((data || []).map((r: any) => [r.key, r.value]))))
    supabase.from('instructors').select('id, full_name')
      .then(({ data }) => setInstructorMap(Object.fromEntries((data || []).map((i: any) => [i.id, i.full_name]))))
  }, [])

  async function extract() {
    if (!raw.trim()) return
    setExtracting(true)
    try {
      const r = await fetch('/api/extract-lead', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: raw }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'eroare')
      const ex = j.extra || {}
      const rez = Object.entries(ex).map(([k, v]) => `${k}: ${v}`).join(' · ')
      setForm({ nume: j.nume || '', prenume: j.prenume || '', email: j.email || '', telefon: j.telefon || '', rezumat: rez, observatii: form.observatii })
      setExtra(ex)
    } catch (e: any) { alert('Extragere eșuată: ' + e.message) }
    setExtracting(false)
  }

  async function addLead() {
    if (!form.nume && !form.prenume && !form.email) { alert('Completează cel puțin numele sau emailul.'); return }
    setSaving(true)
    const r = await fetch('/api/mail-leads', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, extra, raw_email: raw }),
    })
    const j = await r.json()
    setSaving(false)
    if (!r.ok) { alert('Salvare eșuată: ' + (j.error || '')); return }
    setLeads(l => [j.lead, ...l])
    setForm({ nume: '', prenume: '', email: '', telefon: '', rezumat: '', observatii: '' }); setExtra({}); setRaw('')
  }

  async function del(id: string) {
    if (!confirm('Ștergi lead-ul?')) return
    await fetch('/api/mail-leads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    setLeads(l => l.filter(x => x.id !== id))
  }
  async function setStatus(id: string, status: string) {
    await fetch('/api/mail-leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    setLeads(l => l.map(x => x.id === id ? { ...x, status } : x))
  }

  const inCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
  const STATUS = ['nou', 'contactat', 'cursant', 'respins']
  return (
    <div className="space-y-6">
      <LeadTemplatesSection mailTemplates={mailTemplates} sessions={mailSessions} contacts={mailContacts} setsailInfo={mailSetsailInfo} instructorMap={instructorMap} />
      <IntereseSection sessions={mailSessions} contacts={mailContacts} setsailInfo={mailSetsailInfo} instructorMap={instructorMap} />
      <VariabileSection />
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Import */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-1">Importă email brut</h3>
          <p className="text-xs text-gray-400 mb-3">Copiază emailul din Gmail (inclusiv semnătura/contactul) și lipește aici. Extrag automat datele.</p>
          <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
            placeholder="Lipește aici emailul copiat din inbox..."
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 font-mono" />
          <button onClick={extract} disabled={extracting || !raw.trim()}
            className="mt-2 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#1d4ed8' }}>
            <Sparkles size={14} /> {extracting ? 'Se extrage…' : 'Extrage date'}
          </button>
        </div>
        {/* Form */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-semibold text-gray-900 mb-3">Date lead (editabile)</h3>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Nume</span>
              <input className={inCls} value={form.nume} onChange={e => setForm(f => ({ ...f, nume: e.target.value.toUpperCase() }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Prenume</span>
              <input className={inCls} value={form.prenume} onChange={e => setForm(f => ({ ...f, prenume: e.target.value.toUpperCase() }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Email</span>
              <input className={inCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Telefon</span>
              <input className={inCls} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} /></label>
          </div>
          <label className="block mt-3"><span className="block text-xs text-gray-500 mb-1">Rezumat</span>
            <textarea rows={2} className={inCls} value={form.rezumat} onChange={e => setForm(f => ({ ...f, rezumat: e.target.value }))}
              placeholder="Rezumatul datelor extrase (curs interesat, sesiune, status…)" /></label>
          <label className="block mt-3"><span className="block text-xs text-gray-500 mb-1">Observații</span>
            <input className={inCls} value={form.observatii} onChange={e => setForm(f => ({ ...f, observatii: e.target.value }))} /></label>
          <button onClick={addLead} disabled={saving}
            className="mt-3 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
            {saving ? 'Se adaugă…' : '+ Adaugă lead'}
          </button>
        </div>
      </div>

      {/* Leaduri */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Leaduri ({leads.length})</h3>
          <button onClick={load} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"><RefreshCw size={12} /> Reîncarcă</button>
        </div>
        {loading ? (
          <div className="text-center text-gray-400 py-8 text-sm">Se încarcă…</div>
        ) : leads.length === 0 ? (
          <div className="text-center text-gray-400 py-8 text-sm">Niciun lead încă.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2.5">Nume</th><th className="px-4 py-2.5">Prenume</th>
                  <th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Telefon</th>
                  <th className="px-4 py-2.5">Rezumat</th><th className="px-4 py-2.5">Observații</th>
                  <th className="px-4 py-2.5">Status</th><th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {leads.map(l => (
                  <tr key={l.id} onClick={() => setEditLead(l)} title="Click pentru a edita lead-ul"
                    className="hover:bg-blue-50/60 cursor-pointer">
                    <td className="px-4 py-2 text-gray-800">{l.nume || '—'}</td>
                    <td className="px-4 py-2 text-gray-800">{l.prenume || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{l.email || '—'}</td>
                    <td className="px-4 py-2 text-gray-600">{l.telefon || '—'}</td>
                    <td className="px-4 py-2 text-gray-500 max-w-[16rem] truncate" title={l.rezumat || ''}>{l.rezumat || '—'}</td>
                    <td className="px-4 py-2 text-gray-500 max-w-[12rem] truncate" title={l.observatii || ''}>{l.observatii || '—'}</td>
                    <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                      <select value={l.status} onChange={e => setStatus(l.id, e.target.value)}
                        className="text-xs rounded-lg border border-gray-200 px-2 py-1 bg-white cursor-pointer">
                        {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs whitespace-nowrap">{l.created_at ? new Date(l.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' }) : ''}</td>
                    <td className="px-4 py-2 text-right whitespace-nowrap">
                      <button onClick={e => { e.stopPropagation(); setMailLead(l) }} title="Trimite email" className="text-gray-300 hover:text-blue-600 mr-2 align-middle"><Mail size={15} /></button>
                      <button onClick={e => { e.stopPropagation(); del(l.id) }} title="Șterge lead" className="text-gray-300 hover:text-red-500 align-middle"><Trash2 size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mailLead && (
        <LeadMailModal
          lead={mailLead}
          sessions={mailSessions}
          contacts={mailContacts}
          setsailInfo={mailSetsailInfo}
          instructorMap={instructorMap}
          onClose={() => { setMailLead(null); try { window.location.reload() } catch {} }}
        />
      )}
      {editLead && (
        <LeadEditModal
          lead={editLead}
          onClose={() => setEditLead(null)}
          onSaved={(upd: any) => setLeads(prev => prev.map(x => x.id === upd.id ? { ...x, ...upd } : x))}
          onMailing={() => { const l = editLead; setEditLead(null); setMailLead(l) }}
        />
      )}
    </div>
  )
}

// ── Modal: editează datele unui lead ──
function LeadEditModal({ lead, onClose, onSaved, onMailing }: { lead: any; onClose: () => void; onSaved: (upd: any) => void; onMailing: () => void }) {
  const STATUS = ['nou', 'contactat', 'cursant', 'respins']
  const [f, setF] = useState({
    nume: lead.nume || '', prenume: lead.prenume || '', email: lead.email || '',
    telefon: lead.telefon || '', rezumat: lead.rezumat || '', observatii: lead.observatii || '', status: lead.status || 'nou',
  })
  const [saving, setSaving] = useState(false)
  const inCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'

  async function save() {
    setSaving(true)
    const r = await fetch('/api/mail-leads', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: lead.id, ...f }) })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert('Salvare eșuată: ' + (j.error || '')); return }
    onSaved({ id: lead.id, ...f }); onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Editează lead</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Nume</span>
              <input className={inCls} value={f.nume} onChange={e => setF(s => ({ ...s, nume: e.target.value.toUpperCase() }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Prenume</span>
              <input className={inCls} value={f.prenume} onChange={e => setF(s => ({ ...s, prenume: e.target.value.toUpperCase() }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Email</span>
              <input className={inCls} value={f.email} onChange={e => setF(s => ({ ...s, email: e.target.value }))} /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Telefon</span>
              <input className={inCls} value={f.telefon} onChange={e => setF(s => ({ ...s, telefon: e.target.value }))} /></label>
          </div>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Rezumat</span>
            <textarea rows={2} className={inCls} value={f.rezumat} onChange={e => setF(s => ({ ...s, rezumat: e.target.value }))} /></label>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Observații</span>
            <input className={inCls} value={f.observatii} onChange={e => setF(s => ({ ...s, observatii: e.target.value }))} /></label>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Status</span>
            <select className={inCls + ' cursor-pointer'} value={f.status} onChange={e => setF(s => ({ ...s, status: e.target.value }))}>
              {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
            </select></label>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onMailing} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 mr-auto"><Mail size={15} /> Mailing</button>
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Anulează</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>{saving ? 'Se salvează…' : 'Salvează'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Modal: trimite mail către lead, cu template + card „interese" (program/serie) ──
function LeadMailModal({ lead, sessions, contacts, setsailInfo, instructorMap, onClose }: {
  lead: any; sessions: any[]; contacts: any[]
  setsailInfo: Record<string, string>; instructorMap: Record<string, string>; onClose: () => void
}) {
  const [interese, setInterese] = useState<any[]>([])
  const [variabile, setVariabile] = useState<any[]>([])
  const [interestId, setInterestId] = useState('')
  const [to, setTo] = useState(lead.email || '')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [tplId, setTplId] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({}) // valori pt. câmpurile cerute de template
  const [leadTpls, setLeadTpls] = useState<any[]>([])
  const [openInterest, setOpenInterest] = useState(false)   // rânduri collapse, default închise
  const [openTpl, setOpenTpl] = useState(false)
  const [showNewTpl, setShowNewTpl] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [aiTpl, setAiTpl] = useState<{ label: string; subject: string; body: string } | null>(null)
  const refreshLeadTpls = () => fetch('/api/lead-templates').then(r => r.json()).then(j => setLeadTpls(j.templates || []))
  useEffect(() => { fetch('/api/interese').then(r => r.json()).then(j => setInterese(j.interese || [])) }, [])
  useEffect(() => { fetch('/api/variabile').then(r => r.json()).then(j => setVariabile(j.variabile || [])) }, [])
  useEffect(() => { refreshLeadTpls() }, [])
  useEffect(() => { if (!interestId && interese.length) setInterestId(interese[0].id) }, [interese, interestId])

  const interest = useMemo(() => interese.find(i => i.id === interestId) || null, [interese, interestId])
  const sourceSession = useMemo(() => (interest?.source_id ? sessions.find(s => s.id === interest.source_id) || null : null), [interest, sessions])
  const tpl = useMemo(() => leadTpls.find(t => t.id === tplId) || null, [leadTpls, tplId])

  // Valorile de bază din sesiunea-sursă (acoperă toate variabilele {{...}} din template)
  const baseVals = useMemo(() => {
    if (!sourceSession) return {} as Record<string, string>
    const instr = [sourceSession.instructor_id, sourceSession.instructor_id_2, sourceSession.instructor_id_3]
      .filter(Boolean).map((id: string) => instructorMap[id]).filter(Boolean).map((n: string) => ({ full_name: n }))
    return mailVarValues({ origin: typeof window !== 'undefined' ? window.location.origin : undefined, sess: sourceSession, contacts, instructors: instr, setsailInfo })
  }, [sourceSession, contacts, instructorMap, setsailInfo])

  // Denumirile prietenoase din tabelul de variabile (după cheia formulei)
  const labelFor = (key: string) => {
    const v = variabile.find(x => String(x.formula || '').replace(/[{}\s]/g, '') === key)
    if (v?.denumire) return v.denumire
    const std = MAIL_VARIABLES_FLAT.find(m => m.key === key)
    if (std) return std.label
    // fallback: eticheta câmpului din interes (ex. „Babysitter" pt. o cheie custom_*)
    const inFld = (interest?.fields || []).find((f: any) => f.key === key)
    if (inFld?.label && inFld.label !== key) return inFld.label
    return key
  }
  const interestVal = (key: string) => ((interest?.fields || []).find((f: any) => f.key === key)?.value) || ''

  // Câmpurile cerute de template-ul selectat (formulele {{...}} unice)
  const required = useMemo(() => (tpl ? extractVars(`${tpl.subject || ''} ${tpl.body_html || tpl.body_text || ''}`) : []), [tpl])

  // Valorile lead-ului (client) — pt. personalizare {{prenume}}, {{nume}}
  const leadVals = useMemo(() => ({ prenume: lead.prenume || '', nume: lead.nume || '', email: lead.email || '' }), [lead])

  // Seed valorile câmpurilor cerute la schimbarea interesului sau a template-ului
  useEffect(() => {
    const seed: Record<string, string> = {}
    for (const k of required) seed[k] = interestVal(k) || baseVals[k] || (leadVals as any)[k] || ''
    setValues(seed)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interestId, tplId, required.join('|'), JSON.stringify(baseVals)])

  const interestFieldMap = useMemo(() => {
    const m: Record<string, string> = {}
    for (const f of (interest?.fields || []) as InterestField[]) if (f.value) m[f.key] = f.value
    return m
  }, [interest])
  const finalVals = useMemo(() => ({ ...baseVals, ...leadVals, ...interestFieldMap, ...values }), [baseVals, leadVals, interestFieldMap, values])

  const applyVals = (text: string, vals: Record<string, string>) => {
    let r = text || ''
    for (const [k, v] of Object.entries(vals)) r = r.split('{{' + k + '}}').join(v)
    return r
  }
  const missing = required.filter(k => !String(values[k] || '').trim())

  function genereaza() {
    if (!tpl) { alert('Selectează întâi un template.'); return }
    setSubject(applyVals(tpl.subject || '', finalVals))
    setBody(applyVals(tpl.body_html || tpl.body_text || '', finalVals))
  }

  // Variabilele disponibile pt. AI + picker (lead + catalog + câmpurile interesului), cu exemple din valorile curente
  const aiVariables = useMemo(() => {
    const seen = new Set<string>()
    const out: { key: string; label: string; sample: string }[] = []
    const push = (key: string, label: string) => { if (key && !seen.has(key)) { seen.add(key); out.push({ key, label, sample: String((finalVals as any)[key] || '') }) } }
    push('prenume', 'Prenume client'); push('nume', 'Nume client')
    for (const v of MAIL_VARIABLES_FLAT) push(v.key, labelFor(v.key))
    for (const f of (interest?.fields || []) as InterestField[]) push(f.key, f.label || labelFor(f.key))
    return out
  }, [finalVals, interest, variabile])

  // Generează template AI din mailul curent (înlocuiește valorile concrete cu {{variabile}})
  async function generateTemplateAI() {
    if (!subject.trim() && !body.trim()) { alert('Completează mesajul/subiectul întâi.'); return }
    setGenerating(true)
    try {
      const r = await fetch('/api/ai/mail-template', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, body, variables: aiVariables }),
      })
      const j = await r.json().catch(() => null)
      if (!r.ok || !j) {
        // fallback: deschide modalul cu conținutul brut, arată eroarea
        setAiTpl({ label: tpl?.label ? tpl.label + ' (modificat)' : '', subject, body })
        setShowNewTpl(true)
        alert('AI indisponibil (' + (j?.error || 'eroare') + '). Poți salva template-ul manual.')
        return
      }
      setAiTpl({ label: j.label || (tpl?.label || ''), subject: j.subject ?? subject, body: j.body ?? body })
      setShowNewTpl(true)
    } catch (e: any) {
      setAiTpl({ label: tpl?.label || '', subject, body }); setShowNewTpl(true)
      alert('Eroare AI: ' + (e?.message || e))
    } finally { setGenerating(false) }
  }

  // Salvează valoarea unui câmp în interes (persistă pt. viitor)
  async function persist(key: string) {
    if (!interest) return
    const val = String(values[key] || '')
    const fields = [...((interest.fields || []) as InterestField[])]
    const idx = fields.findIndex(f => f.key === key)
    if (idx >= 0) { if (fields[idx].value === val) return; fields[idx] = { ...fields[idx], value: val } }
    else fields.push({ key, label: labelFor(key), value: val, visible: true, custom: false })
    setInterese(prev => prev.map(i => i.id === interest.id ? { ...i, fields } : i))
    await fetch('/api/interese', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: interest.id, fields }) })
  }

  function guardSend(e: any) {
    if (!subject.trim() && !body.trim()) { e.preventDefault(); alert('Generează întâi mesajul din template.'); return }
    if (missing.length) { e.preventDefault(); alert('Completează câmpurile obligatorii înainte de trimitere:\n- ' + missing.map(labelFor).join('\n- ')); return }
  }

  const visibleFields = ((interest?.fields || []) as InterestField[]).filter(f => f.visible && f.value)

  const isHtml = body.trim().startsWith('<')
  const plainBody = isHtml ? body.replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|tr|h[1-6])>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\n{3,}/g, '\n\n').trim() : body
  const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}${isHtml ? '' : '&body=' + encodeURIComponent(body)}`
  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(plainBody)}`

  const copy = (txt: string, tag: string) => { navigator.clipboard.writeText(txt); setCopied(tag); setTimeout(() => setCopied(null), 2000) }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-gray-900">Trimite mail — {[lead.nume, lead.prenume].filter(Boolean).join(' ') || lead.email || 'lead'}</h3>
            <p className="text-xs text-gray-400 mt-0.5">Alege un template și un interes (program/serie), apoi trimite prin Gmail sau mobil.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rând collapse: TEMPLATE (default închis) */}
          <div className="rounded-xl border border-gray-200">
            <button onClick={() => setOpenTpl(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                <ChevronDown size={15} className={`text-gray-400 transition-transform ${openTpl ? '' : '-rotate-90'}`} />
                📨 Template {tpl && <span className="font-normal text-gray-400">· {tpl.label}</span>}
              </span>
            </button>
            {openTpl && (
              <div className="px-4 pb-3 flex flex-col sm:flex-row gap-2 sm:items-end">
                <label className="block flex-1">
                  <select value={tplId} onChange={e => setTplId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer">
                    <option value="">— alege template —</option>
                    {leadTpls.map(t => <option key={t.id} value={t.id}>{(SOURCE_BADGE[t.source]?.label || t.source) + ' · ' + t.label}</option>)}
                  </select>
                </label>
                <button onClick={genereaza} disabled={!tplId}
                  className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#1d4ed8' }}>
                  <Sparkles size={14} /> Apply template
                </button>
              </div>
            )}
          </div>

          {/* Rând collapse: INTERES (default închis) */}
          <div className="rounded-xl border border-indigo-100 bg-indigo-50/40">
            <button onClick={() => setOpenInterest(o => !o)} className="w-full flex items-center justify-between px-4 py-2.5 text-left">
              <span className="flex items-center gap-2 text-sm font-semibold text-indigo-900">
                <ChevronDown size={15} className={`text-indigo-300 transition-transform ${openInterest ? '' : '-rotate-90'}`} />
                🎯 Interes {interest && <span className="font-normal text-indigo-400">· {interest.nume || '(fără titlu)'}</span>}
              </span>
            </button>
            {openInterest && (
              <div className="px-4 pb-4">
                {interese.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">Niciun interes salvat. Creează-l în secțiunea „Interese" de mai jos, apoi revino.</p>
                ) : (
                  <select value={interestId} onChange={e => setInterestId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white cursor-pointer">
                    {interese.map(i => <option key={i.id} value={i.id}>{genreLabel(i.tip_program)} · {i.nume || '(fără titlu)'}</option>)}
                  </select>
                )}
                {visibleFields.length > 0 && (
                  <div className="mt-3 grid sm:grid-cols-2 gap-x-4 gap-y-1">
                    {visibleFields.map(f => (
                      <div key={f.key} className="flex items-start justify-between gap-2 text-xs py-0.5 border-b border-indigo-100/70">
                        <span className="text-gray-500 shrink-0" title={`{{${f.key}}}`}>{f.label}</span>
                        <span className="text-gray-900 text-right font-medium break-all">{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Câmpuri necesare pentru template (obligatorii înainte de trimitere) */}
          {tpl && (
            <div className={`rounded-xl border p-4 ${missing.length ? 'border-red-200 bg-red-50/40' : 'border-emerald-200 bg-emerald-50/30'}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm text-gray-800">🧩 Câmpuri necesare pentru „{tpl.label}"</h4>
                <span className={`text-xs font-medium ${missing.length ? 'text-red-600' : 'text-emerald-600'}`}>
                  {missing.length ? `${missing.length} de completat` : 'Complet ✓'}
                </span>
              </div>
              {required.length === 0 ? (
                <p className="text-xs text-gray-500 italic">Acest template nu conține variabile.</p>
              ) : (
                <div className="space-y-1.5">
                  {required.map(k => {
                    const empty = !String(values[k] || '').trim()
                    return (
                      <div key={k} className="flex items-center gap-2">
                        <span className="w-44 shrink-0 text-xs text-gray-600" title={`{{${k}}}`}>
                          {labelFor(k)}{empty && <span className="text-red-500"> *</span>}
                        </span>
                        <input value={values[k] || ''} onChange={e => setValues(v => ({ ...v, [k]: e.target.value }))} onBlur={() => persist(k)}
                          placeholder={`{{${k}}}`}
                          className={`flex-1 px-2 py-1 rounded border text-xs bg-white ${empty ? 'border-red-300 bg-red-50' : 'border-gray-200'}`} />
                      </div>
                    )
                  })}
                  <p className="text-[11px] text-gray-400 pt-1">Valorile completate se salvează în interes (pentru viitor). Câmpurile marcate cu <span className="text-red-500">*</span> sunt obligatorii.</p>
                </div>
              )}
            </div>
          )}

          {/* Către */}
          <label className="block">
            <span className="block text-xs text-gray-500 mb-1">Către</span>
            <input value={to} onChange={e => setTo(e.target.value)} placeholder="email client"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </label>

          {/* Subiect */}
          <label className="block">
            <span className="flex items-center justify-between text-xs text-gray-500 mb-1">Subiect
              <button onClick={() => copy(subject, 'subj')} className="text-blue-500 hover:text-blue-700">{copied === 'subj' ? 'Copiat!' : 'Copiază'}</button>
            </span>
            <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subiect email…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </label>

          {/* Mesaj */}
          <label className="block">
            <span className="flex items-center justify-between text-xs text-gray-500 mb-1">
              Mesaj {isHtml && <span className="text-amber-600">HTML — pentru Gmail: copiază și lipește cu Ctrl+Shift+V</span>}
              <button onClick={() => copy(isHtml ? body : plainBody, 'body')} className="text-blue-500 hover:text-blue-700">{copied === 'body' ? 'Copiat!' : (isHtml ? 'Copiază HTML' : 'Copiază')}</button>
            </span>
            <textarea rows={8} value={body} onChange={e => setBody(e.target.value)} placeholder="Scrie sau generează din template…"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono resize-y" />
          </label>

          {/* Butoane jos: Generează template (primul) + trimitere */}
          <div className="flex flex-col sm:flex-row gap-2">
            <button onClick={generateTemplateAI} disabled={generating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50">
              <Sparkles size={15} /> {generating ? 'Se generează…' : 'Generează template'}
            </button>
            <a href={gmailUrl} target="_blank" rel="noopener noreferrer"
              onClick={e => { guardSend(e); if (!e.defaultPrevented && isHtml) copy(body, 'body') }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#0a1628' }}>
              <GoogleGIcon size={15} /> {isHtml ? 'Gmail (lipește HTML)' : 'Trimite prin Gmail'}
            </a>
            <a href={mailtoUrl} onClick={guardSend}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#0f766e' }}>
              <Smartphone size={15} /> Android (mobil)
            </a>
          </div>
          {isHtml && <p className="text-[11px] text-gray-400 text-center">Gmail: HTML-ul e copiat automat la click → în fereastra Gmail apasă Ctrl+Shift+V. Pe mobil se trimite varianta text.</p>}
        </div>
      </div>

      {showNewTpl && (
        <NewTemplateModal
          initial={{ label: aiTpl?.label || '', subject: aiTpl?.subject ?? subject, body: aiTpl?.body ?? body }}
          previewCtx={{ sessions, contacts, setsailInfo, instructorMap, preferLeadId: lead.id, preferInterestId: interestId }}
          onClose={() => setShowNewTpl(false)}
          onSaved={async () => { await refreshLeadTpls(); setShowNewTpl(false) }}
        />
      )}
    </div>
  )
}

// ── Modal: creează (AI) / editează un template din lead_templates (picker variabile + preview) ──
function NewTemplateModal({ initial, previewCtx, onClose, onSaved }: {
  initial: { id?: string; label: string; categorie?: string; subject: string; body: string }
  previewCtx: { sessions: any[]; contacts: any[]; setsailInfo: Record<string, string>; instructorMap: Record<string, string>; preferLeadId?: string; preferInterestId?: string }
  onClose: () => void; onSaved: () => void
}) {
  const isEdit = !!initial.id
  const [label, setLabel] = useState(initial.label)
  const [categorie, setCategorie] = useState(initial.categorie || 'general')
  const [subject, setSubject] = useState(initial.subject)
  const [body, setBody] = useState(initial.body)
  const [saving, setSaving] = useState(false)
  const [showPreview, setShowPreview] = useState(true)
  const subjRef = useRef<HTMLInputElement>(null)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [focusedField, setFocusedField] = useState<'subject' | 'body'>('body')
  const inCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm'

  // Preview cu date reale: dropdown lead + interes (default = ultimul folosit din localStorage)
  const [leads, setLeads] = useState<any[]>([])
  const [interese, setInterese] = useState<any[]>([])
  const [leadId, setLeadId] = useState('')
  const [interestId, setInterestId] = useState('')
  useEffect(() => { fetch('/api/mail-leads').then(r => r.json()).then(j => setLeads(j.leads || [])) }, [])
  useEffect(() => { fetch('/api/interese').then(r => r.json()).then(j => setInterese(j.interese || [])) }, [])
  const lsGet = (k: string) => { try { return localStorage.getItem(k) || '' } catch { return '' } }
  const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v) } catch {} }
  useEffect(() => {
    if (leadId || !leads.length) return
    const pick = [lsGet('tpl_prev_lead'), previewCtx.preferLeadId].find(id => id && leads.some(l => l.id === id))
    setLeadId(pick || leads[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leads])
  useEffect(() => {
    if (interestId || !interese.length) return
    const pick = [lsGet('tpl_prev_interest'), previewCtx.preferInterestId].find(id => id && interese.some(i => i.id === id))
    setInterestId(pick || interese[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interese])
  const pickLead = (id: string) => { setLeadId(id); lsSet('tpl_prev_lead', id) }
  const pickInterest = (id: string) => { setInterestId(id); lsSet('tpl_prev_interest', id) }

  const lead = useMemo(() => leads.find(l => l.id === leadId) || null, [leads, leadId])
  const interest = useMemo(() => interese.find(i => i.id === interestId) || null, [interese, interestId])

  const sampleVals = useMemo(() => {
    const m: Record<string, string> = {}
    const s = interest?.source_id ? previewCtx.sessions.find(x => x.id === interest.source_id) : null
    if (s) {
      const instr = [s.instructor_id, s.instructor_id_2, s.instructor_id_3].filter(Boolean).map((id: string) => previewCtx.instructorMap[id]).filter(Boolean).map((n: string) => ({ full_name: n }))
      Object.assign(m, mailVarValues({ origin: typeof window !== 'undefined' ? window.location.origin : undefined, sess: s, contacts: previewCtx.contacts, instructors: instr, setsailInfo: previewCtx.setsailInfo }))
    }
    if (lead) { m.prenume = lead.prenume || ''; m.nume = lead.nume || ''; m.email = lead.email || '' }
    for (const f of (interest?.fields || []) as InterestField[]) if (f.value) m[f.key] = f.value
    return m
  }, [interest, lead, previewCtx])

  const variables = useMemo(() => {
    const seen = new Set<string>(); const out: { key: string; label: string; sample: string }[] = []
    const push = (k: string, l: string) => { if (k && !seen.has(k)) { seen.add(k); out.push({ key: k, label: l, sample: String(sampleVals[k] || '') }) } }
    push('prenume', 'Prenume client'); push('nume', 'Nume client')
    for (const v of MAIL_VARIABLES_FLAT) push(v.key, v.label)
    for (const f of (interest?.fields || []) as InterestField[]) push(f.key, f.label || f.key)
    return out
  }, [sampleVals, interest])

  function insertVar(key: string) {
    const token = `{{${key}}}`
    const isSubj = focusedField === 'subject'
    const el = isSubj ? subjRef.current : bodyRef.current
    const val = isSubj ? subject : body
    const set = isSubj ? setSubject : setBody
    const start = el?.selectionStart ?? val.length
    const end = el?.selectionEnd ?? val.length
    const nv = val.slice(0, start) + token + val.slice(end)
    set(nv)
    requestAnimationFrame(() => { if (el) { el.focus(); const p = start + token.length; el.setSelectionRange(p, p) } })
  }

  const apply = (t: string) => { let r = t || ''; for (const [k, v] of Object.entries(sampleVals)) r = r.split('{{' + k + '}}').join(v); return r }

  async function save() {
    if (!label.trim()) { alert('Dă un nume template-ului.'); return }
    setSaving(true)
    const isHtml = body.trim().startsWith('<')
    const payload: any = { label, categorie, subject, body_html: isHtml ? body : null, body_text: isHtml ? null : body }
    const r = isEdit
      ? await fetch('/api/lead-templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: initial.id, ...payload }) })
      : await fetch('/api/lead-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...payload, source: 'generat' }) })
    setSaving(false)
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert('Salvare eșuată: ' + (j.error || '')); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{isEdit ? 'Editează template' : 'Template nou (generat AI)'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-gray-400">{isEdit ? 'Editează template-ul. Inserează variabile din picker și verifică în preview.' : <>AI-ul a înlocuit valorile concrete cu <span className="font-mono">{'{{variabile}}'}</span>. Editează, inserează variabile din picker, verifică în preview, apoi salvează. Îl regăsești în „Template-uri leaduri".</>}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Nume template</span>
              <input className={inCls} value={label} onChange={e => setLabel(e.target.value)} placeholder="ex. Ofertă curs intensiv" /></label>
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Categorie</span>
              <input className={inCls} value={categorie} onChange={e => setCategorie(e.target.value)} placeholder="general" /></label>
          </div>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Subiect</span>
            <input ref={subjRef} onFocus={() => setFocusedField('subject')} className={inCls} value={subject} onChange={e => setSubject(e.target.value)} /></label>
          <label className="block"><span className="block text-xs text-gray-500 mb-1">Mesaj {body.trim().startsWith('<') && <span className="text-amber-600">(HTML)</span>}</span>
            <textarea ref={bodyRef} onFocus={() => setFocusedField('body')} rows={8} className={`${inCls} font-mono resize-y`} value={body} onChange={e => setBody(e.target.value)} /></label>

          {/* Picker de variabile — inserează {{cheie}} la poziția cursorului */}
          <div>
            <div className="text-xs text-gray-500 mb-1">Inserează variabilă (în ultimul câmp focusat: <b>{focusedField === 'subject' ? 'Subiect' : 'Mesaj'}</b>)</div>
            <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto">
              {variables.map(v => (
                <button key={v.key} onClick={() => insertVar(v.key)} title={v.label + (v.sample ? ` (ex: ${v.sample})` : '')}
                  className="px-2 py-1 rounded border border-gray-200 text-[11px] font-mono hover:bg-blue-50 hover:border-blue-200">{`{{${v.key}}}`}</button>
              ))}
            </div>
          </div>

          {/* Preview cu date reale (interesul curent) */}
          <div className="rounded-lg border border-gray-100 bg-gray-50/60">
            <button onClick={() => setShowPreview(p => !p)} className="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-gray-600">
              <span>👁 Preview cu date reale</span>
              <span className="text-gray-400">{showPreview ? 'Ascunde' : 'Arată'}</span>
            </button>
            {showPreview && (
              <div className="px-3 pb-3 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <label className="block"><span className="block text-[11px] text-gray-400 mb-0.5">Lead</span>
                    <select value={leadId} onChange={e => pickLead(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-white cursor-pointer">
                      {leads.length === 0 && <option value="">(niciun lead)</option>}
                      {leads.map(l => <option key={l.id} value={l.id}>{[l.nume, l.prenume].filter(Boolean).join(' ') || l.email || '(fără nume)'}</option>)}
                    </select></label>
                  <label className="block"><span className="block text-[11px] text-gray-400 mb-0.5">Interes</span>
                    <select value={interestId} onChange={e => pickInterest(e.target.value)} className="w-full px-2 py-1 rounded border border-gray-200 text-xs bg-white cursor-pointer">
                      {interese.length === 0 && <option value="">(niciun interes)</option>}
                      {interese.map(i => <option key={i.id} value={i.id}>{genreLabel(i.tip_program)} · {i.nume || '(fără titlu)'}</option>)}
                    </select></label>
                </div>
                <div>
                  <div className="text-[11px] text-gray-400">Subiect</div>
                  <div className="text-xs text-gray-800 bg-white rounded border border-gray-100 px-2 py-1">{apply(subject) || '—'}</div>
                  <div className="text-[11px] text-gray-400 mt-1">Mesaj</div>
                  <div className="text-xs text-gray-800 bg-white rounded border border-gray-100 px-2 py-1 max-h-40 overflow-y-auto whitespace-pre-wrap">{apply(body) || '—'}</div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Anulează</button>
            <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0E7C86' }}>{saving ? 'Se salvează…' : 'Salvează template'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Secțiune „Interese": catalog de interese importate din programe (sesiuni) ──
function IntereseSection({ sessions, contacts, setsailInfo, instructorMap }: {
  sessions: any[]; contacts: any[]; setsailInfo: Record<string, string>; instructorMap: Record<string, string>
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [variabile, setVariabile] = useState<any[]>([])
  useEffect(() => { fetch('/api/variabile').then(r => r.json()).then(j => setVariabile(j.variabile || [])) }, [])

  useEffect(() => {
    fetch('/api/interese').then(r => r.json()).then(j => { setItems(j.interese || []); setLoading(false) })
  }, [])

  const futureSessions = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0)
    return sessions
      .filter(s => s.session_date && new Date(s.session_date) >= today)
      .sort((a, b) => String(a.session_date).localeCompare(String(b.session_date)))
  }, [sessions])

  function sessionLabel(s: any) {
    const d = s.session_date ? new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'
    const loc = s.location_detail || s.locations?.name || ''
    return `${s.class_caa || '—'} · ${d}${loc ? ' · ' + loc : ''}`
  }

  function sessionValues(s: any): Record<string, string> {
    const instr = [s.instructor_id, s.instructor_id_2, s.instructor_id_3].filter(Boolean).map((id: string) => instructorMap[id]).filter(Boolean)
    const ctx = { origin: typeof window !== 'undefined' ? window.location.origin : undefined, sess: s, contacts, instructors: instr.map((n: string) => ({ full_name: n })), setsailInfo }
    const v = mailVarValues(ctx)
    const fmt = (d: string) => d ? new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' }) : ''
    const interval = s.practice_start_date && s.session_date && s.practice_start_date !== s.session_date
      ? `${new Date(s.practice_start_date).getDate()}–${fmt(s.session_date)}` : fmt(s.session_date)
    return {
      nume_program: s.class_caa ? `Curs ${s.class_caa}` : 'Curs', interval,
      locatie: v.locatie, ambarcatiune: v.ambarcatiune, link_portal: v.link_portal,
      clase: s.class_caa || '', data_start_curs: v.data_start_curs, ora_start: v.ora_start,
      instructor: [v.instructor_1, v.instructor_2, v.instructor_3].filter(Boolean).join(', '),
    }
  }

  async function create(payload: any) {
    setBusy(true)
    const r = await fetch('/api/interese', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const j = await r.json(); setBusy(false); setPicker(false)
    if (!r.ok) { alert(j.error || 'Eroare'); return }
    setItems(x => [j.interes, ...x])
  }
  function createFromSession(s: any) {
    const vals = sessionValues(s)
    create({ nume: `${vals.nume_program}${vals.interval ? ' — ' + vals.interval : ''}`, tip_program: 'curs', source_type: 'session', source_id: s.id, fields: buildFields('curs', vals) })
  }
  function createBlank(genre: Genre) {
    create({ nume: '', tip_program: genre, source_type: 'blank', fields: buildFields(genre) })
  }

  async function saveInterest(id: string, patch: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...patch } : it))
    await fetch('/api/interese', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
  }
  async function removeInterest(id: string) {
    if (!confirm('Ștergi interesul? (nu afectează programul-sursă)')) return
    setItems(prev => prev.filter(i => i.id !== id))
    await fetch('/api/interese', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 font-semibold text-gray-900">
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          🎯 Interese (programe / serii) <span className="text-xs font-normal text-gray-400">({items.length})</span>
        </button>
        <div className="relative">
          <button onClick={() => setPicker(p => !p)} disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#1d4ed8' }}>
            <Plus size={14} /> Creează interes
          </button>
          {picker && (
            <div className="absolute right-0 mt-1 w-80 max-h-96 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-20 p-2">
              <div className="text-xs font-semibold text-gray-400 px-2 py-1">Serii viitoare de practică</div>
              {futureSessions.length === 0 && <div className="px-2 py-2 text-xs text-gray-400 italic">Nicio serie viitoare.</div>}
              {futureSessions.map(s => (
                <button key={s.id} onClick={() => createFromSession(s)}
                  className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-blue-50">{sessionLabel(s)}</button>
              ))}
              <div className="border-t border-gray-100 my-1" />
              <div className="text-xs font-semibold text-gray-400 px-2 py-1">Gol (manual)</div>
              <button onClick={() => createBlank('curs')} className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50">＋ Curs blank</button>
              <button onClick={() => createBlank('expeditie')} className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50">＋ Expediție blank</button>
              <button onClick={() => createBlank('practica_suplimentara')} className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-gray-50">＋ Practică suplimentară blank</button>
            </div>
          )}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {loading ? <div className="text-center text-gray-400 py-4 text-sm">Se încarcă…</div>
            : items.length === 0 ? <div className="text-center text-gray-400 py-4 text-sm">Niciun interes încă. Apasă „Creează interes".</div>
              : items.map(it => (
                <InterestCard key={it.id} interes={it} variabile={variabile}
                  onSave={(patch: any) => saveInterest(it.id, patch)}
                  onDelete={() => removeInterest(it.id)} />
              ))}
        </div>
      )}
    </div>
  )
}

function InterestCard({ interes, variabile, onSave, onDelete }: { interes: any; variabile: any[]; onSave: (patch: any) => void; onDelete: () => void }) {
  const [nume, setNume] = useState(interes.nume || '')
  const [genre, setGenre] = useState<Genre>(interes.tip_program || 'curs')
  const [fields, setFields] = useState<InterestField[]>(Array.isArray(interes.fields) ? interes.fields : [])
  const [openCard, setOpenCard] = useState(false)
  const [varPicker, setVarPicker] = useState(false)

  const saveFields = (nf: InterestField[]) => { setFields(nf); onSave({ fields: nf }) }
  const changeGenre = (g: Genre) => { setGenre(g); const nf = buildFields(g, {}, fields); setFields(nf); onSave({ tip_program: g, fields: nf }) }
  const toggleVis = (i: number) => saveFields(fields.map((f, idx) => idx === i ? { ...f, visible: !f.visible } : f))
  const setVal = (i: number, v: string) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, value: v } : f))
  const setLabel = (i: number, v: string) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, label: v } : f))
  const setKey = (i: number, v: string) => setFields(prev => prev.map((f, idx) => idx === i ? { ...f, key: v.trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '') } : f))
  const addCustom = () => saveFields([...fields, { key: '', label: 'Câmp nou', value: '', visible: true, custom: true }])
  const removeField = (i: number) => saveFields(fields.filter((_, idx) => idx !== i))
  const addFromVar = (v: any) => {
    const key = String(v.formula || '').replace(/[{}\s]/g, '') || String(v.cod || '').trim()
    if (!key) return
    setVarPicker(false)
    if (fields.some(f => f.key === key)) { alert('Câmpul există deja în interes.'); return }
    saveFields([...fields, { key, label: v.denumire || v.cod || key, value: '', visible: true, custom: true }])
  }

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
      <div className="flex items-center gap-2 mb-2">
        <button onClick={() => setOpenCard(o => !o)} title={openCard ? 'Restrânge' : 'Extinde'} className="p-1 text-indigo-300 hover:text-indigo-600">
          <ChevronDown size={15} className={`transition-transform ${openCard ? '' : '-rotate-90'}`} />
        </button>
        <input value={nume} onChange={e => setNume(e.target.value)} onBlur={() => nume !== interes.nume && onSave({ nume })}
          placeholder="Titlu interes…" className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-sm font-medium bg-white" />
        <select value={genre} onChange={e => changeGenre(e.target.value as Genre)}
          className="text-xs rounded-lg border border-gray-200 px-2 py-1.5 bg-white cursor-pointer">
          {INTEREST_GENRES.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
        </select>
        <button onClick={onDelete} title="Șterge interesul" className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50"><Trash2 size={15} /></button>
      </div>
      {openCard && (<>
      <div className="space-y-1">
        {fields.map((f, i) => (
          <div key={i} className={`flex items-center gap-2 ${f.visible ? '' : 'opacity-50'}`}>
            <button onClick={() => toggleVis(i)} title={f.visible ? 'Ascunde câmpul' : 'Arată câmpul'}
              className={`p-1 rounded ${f.visible ? 'text-indigo-600' : 'text-gray-400'} hover:bg-white`}>
              {f.visible ? <Eye size={14} /> : <EyeOff size={14} />}
            </button>
            {f.custom
              ? <input value={f.label} onChange={e => setLabel(i, e.target.value)} onBlur={() => onSave({ fields })}
                  className="w-28 shrink-0 px-2 py-1 rounded border border-gray-200 text-xs bg-white" placeholder="Nume câmp" />
              : <span className="w-28 shrink-0 text-xs text-gray-500 truncate" title={f.label}>{f.label}</span>}
            {f.custom
              ? <input value={f.key} onChange={e => setKey(i, e.target.value)} onBlur={() => onSave({ fields })}
                  className="w-28 shrink-0 px-2 py-1 rounded border border-gray-200 text-[11px] font-mono bg-white" placeholder="cheie" title="Cheia formulei: devine {{cheie}} în template" />
              : <span className="w-28 shrink-0 text-[10px] font-mono text-gray-400 truncate" title={`{{${f.key}}}`}>{`{{${f.key}}}`}</span>}
            <input value={f.value} onChange={e => setVal(i, e.target.value)} onBlur={() => onSave({ fields })}
              className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs bg-white" placeholder="valoare…" />
            {f.custom && <button onClick={() => removeField(i)} className="p-1 text-gray-300 hover:text-red-500"><X size={13} /></button>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button onClick={addCustom} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"><Plus size={12} /> Adaugă câmp custom</button>
        <div className="relative">
          <button onClick={() => setVarPicker(p => !p)} className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800"><Plus size={12} /> Importă din variabile</button>
          {varPicker && (
            <div className="absolute left-0 bottom-full mb-1 w-64 max-h-64 overflow-y-auto bg-white rounded-xl border border-gray-200 shadow-lg z-20 p-1">
              {variabile.length === 0 && <div className="px-2 py-2 text-xs text-gray-400 italic">Nicio variabilă definită.</div>}
              {variabile.map(v => {
                const key = String(v.formula || '').replace(/[{}\s]/g, '') || String(v.cod || '')
                const exists = fields.some(f => f.key === key)
                return (
                  <button key={v.id} onClick={() => addFromVar(v)} disabled={exists}
                    className="w-full text-left px-2 py-1.5 rounded-lg text-xs hover:bg-indigo-50 disabled:opacity-40 disabled:hover:bg-transparent">
                    <span className="font-medium">{v.denumire || v.cod || key}</span>
                    <span className="text-gray-400 font-mono ml-1">{v.formula}</span>
                    {exists && <span className="text-gray-400"> · există</span>}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
      </>)}
    </div>
  )
}

// ── Secțiune „Template-uri leaduri": zona unificată, import din sesiuni + Gmail + generate ──
const SOURCE_BADGE: Record<string, { label: string; cls: string }> = {
  sesiune: { label: 'sesiune', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  gmail: { label: 'gmail', cls: 'bg-red-50 text-red-700 border-red-200' },
  generat: { label: 'generat', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  manual: { label: 'manual', cls: 'bg-gray-50 text-gray-600 border-gray-200' },
}

function LeadTemplatesSection({ mailTemplates, sessions, contacts, setsailInfo, instructorMap }: {
  mailTemplates: any[]; sessions: any[]; contacts: any[]; setsailInfo: Record<string, string>; instructorMap: Record<string, string>
}) {
  const [items, setItems] = useState<any[]>([])
  const [gmail, setGmail] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [pickSes, setPickSes] = useState('')
  const [pickGm, setPickGm] = useState('')
  const [busy, setBusy] = useState(false)
  const [editTpl, setEditTpl] = useState<any | null>(null)

  async function load() {
    const r = await fetch('/api/lead-templates'); const j = await r.json()
    setItems(j.templates || []); setLoading(false)
  }
  useEffect(() => { load() }, [])
  useEffect(() => { fetch('/api/gmail-templates').then(r => r.json()).then(j => setGmail(j.templates || [])).catch(() => {}) }, [])

  async function create(payload: any) {
    setBusy(true)
    const r = await fetch('/api/lead-templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    const j = await r.json(); setBusy(false)
    if (!r.ok) { alert(j.error || 'Eroare'); return }
    setItems(x => [j.template, ...x])
  }
  function importSesiune() {
    const m = mailTemplates.find(t => t.id === pickSes); if (!m) return
    create({ label: m.label, categorie: m.categorie || 'general', subject: m.subject, body_html: m.body_html || null, body_text: m.body_text || null, source: 'sesiune', source_id: m.id })
    setPickSes('')
  }
  function importGmail() {
    const g = gmail.find(t => t.id === pickGm); if (!g) return
    create({ label: g.label, categorie: g.category || 'general', subject: g.subject, body_html: g.body_html || null, body_text: g.body_text || null, source: 'gmail', source_id: g.id })
    setPickGm('')
  }
  async function save(id: string, patch: any) {
    setItems(prev => prev.map(t => t.id === id ? { ...t, ...patch } : t))
    await fetch('/api/lead-templates', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
  }
  async function del(id: string) {
    if (!confirm('Ștergi template-ul?')) return
    setItems(prev => prev.filter(t => t.id !== id))
    await fetch('/api/lead-templates', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 font-semibold text-gray-900 w-full text-left">
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          📨 Template-uri leaduri <span className="text-xs font-normal text-gray-400">({items.length})</span>
        </button>
      </div>
      {open && (
        <div className="p-4 space-y-3">
          <p className="text-xs text-gray-400">Zona unificată de template-uri pentru mailul către leaduri. Importă din sesiuni, din mailul office@ (Gmail) sau generează din modalul de trimitere.</p>
          <div className="grid sm:grid-cols-2 gap-2">
            <div className="flex gap-1.5">
              <select value={pickSes} onChange={e => setPickSes(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white cursor-pointer">
                <option value="">Import din sesiuni…</option>
                {mailTemplates.filter(t => t.categorie !== 'anr' && t.categorie !== 'ancom').map(t => <option key={t.id} value={t.id}>{(t.categorie ? t.categorie + ' · ' : '') + t.label}</option>)}
              </select>
              <button onClick={importSesiune} disabled={!pickSes || busy} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#1d4ed8' }}>Importă</button>
            </div>
            <div className="flex gap-1.5">
              <select value={pickGm} onChange={e => setPickGm(e.target.value)} className="flex-1 px-2 py-1.5 rounded-lg border border-gray-200 text-xs bg-white cursor-pointer">
                <option value="">Import din Gmail (office@)…</option>
                {gmail.map(t => <option key={t.id} value={t.id}>{(t.category ? t.category + ' · ' : '') + t.label}</option>)}
              </select>
              <button onClick={importGmail} disabled={!pickGm || busy} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#dc2626' }}>Importă</button>
            </div>
          </div>
          {loading ? <div className="text-center text-gray-400 py-3 text-sm">Se încarcă…</div>
            : items.length === 0 ? <div className="text-center text-gray-400 py-3 text-sm">Niciun template. Importă din surse sau generează din modalul de mail.</div>
              : (
                <div className="space-y-1.5">
                  {items.map(t => {
                    const badge = SOURCE_BADGE[t.source] || SOURCE_BADGE.manual
                    return (
                      <div key={t.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                        <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded border ${badge.cls}`}>{badge.label}</span>
                        <input defaultValue={t.label} onBlur={e => e.target.value !== t.label && save(t.id, { label: e.target.value })}
                          className="w-52 shrink-0 px-2 py-1 rounded border border-gray-200 text-xs bg-white" />
                        <span className="flex-1 text-xs text-gray-400 truncate" title={t.subject}>{t.subject || '—'}</span>
                        <button onClick={() => setEditTpl(t)} title="Editează template" className="p-1 text-gray-300 hover:text-blue-600"><Edit2 size={13} /></button>
                        <button onClick={() => del(t.id)} title="Șterge" className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button>
                      </div>
                    )
                  })}
                </div>
              )}
        </div>
      )}

      {editTpl && (
        <NewTemplateModal
          initial={{ id: editTpl.id, label: editTpl.label, categorie: editTpl.categorie, subject: editTpl.subject || '', body: editTpl.body_html || editTpl.body_text || '' }}
          previewCtx={{ sessions, contacts, setsailInfo, instructorMap }}
          onClose={() => setEditTpl(null)}
          onSaved={async () => { await load(); setEditTpl(null) }}
        />
      )}
    </div>
  )
}

// ── Secțiune „Variabile": cod intern · denumire proprie · formulă {{...}} ──
function VariabileSection() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function load() {
    const r = await fetch('/api/variabile'); const j = await r.json()
    setRows(j.variabile || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function addRow() {
    const r = await fetch('/api/variabile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cod: '', denumire: '', formula: '' }) })
    const j = await r.json(); if (r.ok) setRows(x => [...x, j.variabila])
  }
  async function save(id: string, patch: any) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r))
    await fetch('/api/variabile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, ...patch }) })
  }
  async function del(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch('/api/variabile', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
  }
  async function importStandard() {
    setBusy(true)
    const bulk = MAIL_VARIABLES_FLAT.map(v => ({ cod: v.key, denumire: v.label, formula: `{{${v.key}}}` }))
    const r = await fetch('/api/variabile', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bulk }) })
    const j = await r.json(); setBusy(false)
    if (r.ok) { await load(); alert(`Importate ${j.inserted} variabile noi din catalog.`) } else alert(j.error || 'Eroare')
  }

  const cell = 'px-2 py-1 rounded border border-gray-200 text-xs bg-white w-full'
  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <button onClick={() => setOpen(o => !o)} className="flex items-center gap-2 font-semibold text-gray-900">
          <ChevronDown size={16} className={`text-gray-400 transition-transform ${open ? '' : '-rotate-90'}`} />
          🔤 Variabile <span className="text-xs font-normal text-gray-400">({rows.length})</span>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={importStandard} disabled={busy} className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-50">Importă din catalog</button>
          <button onClick={addRow} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-white" style={{ background: '#1d4ed8' }}><Plus size={13} /> Rând</button>
        </div>
      </div>
      {open && (
        <div className="p-4">
          <p className="text-xs text-gray-400 mb-2">Mapare între formula din template și o denumire prietenoasă. „Cod intern" e opțional (referință proprie).</p>
          {loading ? <div className="text-center text-gray-400 py-3 text-sm">Se încarcă…</div>
            : rows.length === 0 ? <div className="text-center text-gray-400 py-3 text-sm">Nicio variabilă. Apasă „Importă din catalog" sau „Rând".</div>
              : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead><tr className="text-left text-gray-400">
                      <th className="px-2 py-1 font-medium">Cod intern</th><th className="px-2 py-1 font-medium">Denumire</th><th className="px-2 py-1 font-medium">Formulă</th><th></th>
                    </tr></thead>
                    <tbody>
                      {rows.map(r => (
                        <tr key={r.id}>
                          <td className="py-1 pr-2 w-40"><input className={cell} defaultValue={r.cod} onBlur={e => e.target.value !== r.cod && save(r.id, { cod: e.target.value })} placeholder="data_pract" /></td>
                          <td className="py-1 pr-2"><input className={cell} defaultValue={r.denumire} onBlur={e => e.target.value !== r.denumire && save(r.id, { denumire: e.target.value })} placeholder="Zi început full" /></td>
                          <td className="py-1 pr-2 w-56"><input className={`${cell} font-mono`} defaultValue={r.formula} onBlur={e => e.target.value !== r.formula && save(r.id, { formula: e.target.value })} placeholder="{{zz_llll_data_practica}}" /></td>
                          <td className="py-1 w-8 text-right"><button onClick={() => del(r.id)} className="p-1 text-gray-300 hover:text-red-500"><Trash2 size={13} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-2xl font-bold" style={{ color }}>{value}</div>
    </div>
  )
}

function FilterChip({
  children,
  active,
  onClick,
  color = '#374151',
}: {
  children: React.ReactNode
  active: boolean
  onClick: () => void
  color?: string
}) {
  return (
    <button
      onClick={onClick}
      className="px-2.5 py-1 text-xs rounded-md transition-colors"
      style={
        active
          ? { background: color, color: '#fff' }
          : { background: '#f3f4f6', color: '#6b7280' }
      }
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wider text-gray-500 mb-1">{label}</div>
      {children}
    </div>
  )
}
