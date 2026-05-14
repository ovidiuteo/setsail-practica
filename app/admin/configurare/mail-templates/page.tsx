'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Pencil, Trash2, X, Check, Eye, Code, Mail, Tag, ChevronDown, ChevronUp, Copy } from 'lucide-react'

type Template = {
  id: string
  key: string
  label: string
  categorie: string
  subject: string
  body_text: string
  body_html: string
  variables: string[]
  activ: boolean
  created_at: string
  updated_at: string
}

const CATEGORII = [
  { value: 'portal', label: '🔗 Portal', color: '#3b82f6' },
  { value: 'practica', label: '⛵ Practică', color: '#f59e0b' },
  { value: 'organizatoric', label: '📋 Organizatoric', color: '#8b5cf6' },
  { value: 'rezultate', label: '🏆 Rezultate', color: '#10b981' },
  { value: 'general', label: '📧 General', color: '#6b7280' },
]

const VARIABLES_INFO: Record<string, string> = {
  link_portal: 'Link-ul portalului de practică al sesiunii',
  data_sesiune: 'Data sesiunii (ex: 18 mai 2026)',
  locatie: 'Locația sesiunii (ex: Limanu)',
  ambarcatiune: 'Numele ambarcațiunii (ex: SetSail)',
  data_noua: 'Noua dată (pentru modificări)',
  adresa_locatie: 'Adresa completă a locației',
  zz_data_start_practica: 'Ziua din data start practică (ex: 18)',
  zz_llll_data_practica: 'Ziua și luna din data practică (ex: 20 mai)',
  ora_start: 'Ora de start a practicii (ex: 9:30)',
}

const EMPTY_TEMPLATE: Partial<Template> = {
  key: '',
  label: '',
  categorie: 'general',
  subject: '',
  body_text: '',
  body_html: '',
  variables: [],
  activ: true,
}

export default function MailTemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [form, setForm] = useState<Partial<Template>>(EMPTY_TEMPLATE)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'text' | 'html'>('text')
  const [previewMode, setPreviewMode] = useState(false)
  const [filterCat, setFilterCat] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [varInput, setVarInput] = useState('')

  async function load() {
    const { data } = await supabase.from('mail_templates').select('*').order('categorie').order('label')
    setTemplates((data || []) as Template[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function startNew() {
    setForm({ ...EMPTY_TEMPLATE, variables: [] })
    setIsNew(true)
    setEditingId(null)
    setActiveTab('text')
    setPreviewMode(false)
  }

  function startEdit(t: Template) {
    setForm({ ...t })
    setEditingId(t.id)
    setIsNew(false)
    setActiveTab('text')
    setPreviewMode(false)
  }

  function cancelEdit() {
    setEditingId(null)
    setIsNew(false)
    setForm(EMPTY_TEMPLATE)
  }

  async function save() {
    if (!form.key || !form.label || !form.subject) return
    setSaving(true)
    const payload = {
      key: form.key!.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
      label: form.label,
      categorie: form.categorie || 'general',
      subject: form.subject,
      body_text: form.body_text || '',
      body_html: form.body_html || '',
      variables: form.variables || [],
      activ: form.activ ?? true,
    }
    if (isNew) {
      const { data, error } = await supabase.from('mail_templates').insert(payload).select().single()
      if (!error && data) setTemplates(prev => [...prev, data as Template].sort((a,b) => a.categorie.localeCompare(b.categorie)))
    } else if (editingId) {
      const { data, error } = await supabase.from('mail_templates').update(payload).eq('id', editingId).select().single()
      if (!error && data) setTemplates(prev => prev.map(t => t.id === editingId ? data as Template : t))
    }
    cancelEdit()
    setSaving(false)
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Ștergi definitiv acest template?')) return
    await supabase.from('mail_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  async function toggleActiv(t: Template) {
    await supabase.from('mail_templates').update({ activ: !t.activ }).eq('id', t.id)
    setTemplates(prev => prev.map(x => x.id === t.id ? { ...x, activ: !x.activ } : x))
  }

  function addVariable(v: string) {
    const clean = v.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')
    if (!clean || (form.variables || []).includes(clean)) return
    setForm(f => ({ ...f, variables: [...(f.variables || []), clean] }))
    setVarInput('')
  }

  function removeVariable(v: string) {
    setForm(f => ({ ...f, variables: (f.variables || []).filter(x => x !== v) }))
  }

  function insertVariable(v: string) {
    const tag = `{{${v}}}`
    if (activeTab === 'text') {
      setForm(f => ({ ...f, body_text: (f.body_text || '') + tag }))
    } else {
      setForm(f => ({ ...f, body_html: (f.body_html || '') + tag }))
    }
  }

  function copyVar(v: string) {
    navigator.clipboard.writeText(`{{${v}}}`)
    setCopied(v)
    setTimeout(() => setCopied(null), 1500)
  }

  const filtered = filterCat === 'all' ? templates : templates.filter(t => t.categorie === filterCat)
  const grouped = CATEGORII.reduce((acc, cat) => {
    const items = filtered.filter(t => t.categorie === cat.value)
    if (items.length > 0) acc[cat.value] = { ...cat, items }
    return acc
  }, {} as Record<string, any>)

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"
  const textareaCls = "border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full font-mono resize-none"

  const isEditing = isNew || editingId !== null

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Template-uri Email
          </h1>
          <p className="text-sm text-gray-500 mt-1">{templates.length} template-uri • folosite în secțiunea Mailing din sesiuni</p>
        </div>
        <button onClick={startNew}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity"
          style={{ background: '#0a1628' }}>
          <Plus size={15} /> Template nou
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCat === 'all' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          Toate ({templates.length})
        </button>
        {CATEGORII.map(cat => {
          const cnt = templates.filter(t => t.categorie === cat.value).length
          if (cnt === 0) return null
          return (
            <button key={cat.value} onClick={() => setFilterCat(cat.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filterCat === cat.value ? 'text-white' : 'text-gray-600 hover:opacity-80'}`}
              style={filterCat === cat.value
                ? { background: cat.color }
                : { background: cat.color + '20', color: cat.color }}>
              {cat.label} ({cnt})
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT - Lista templates */}
        <div className="space-y-6">
          {loading ? (
            <div className="text-center text-gray-400 py-12">Se încarcă...</div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="text-center text-gray-400 py-12">Niciun template.</div>
          ) : Object.entries(grouped).map(([catKey, cat]) => (
            <div key={catKey}>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: cat.color + '40' }} />
                <span className="text-xs font-semibold px-2 py-1 rounded-full"
                  style={{ background: cat.color + '15', color: cat.color }}>
                  {cat.label}
                </span>
                <div className="h-px flex-1" style={{ background: cat.color + '40' }} />
              </div>
              <div className="space-y-2">
                {cat.items.map((t: Template) => (
                  <div key={t.id}
                    className={`bg-white rounded-xl border transition-all ${editingId === t.id ? 'border-blue-300 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-gray-900 truncate">{t.label}</span>
                            {!t.activ && (
                              <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-400">inactiv</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-400 truncate mb-2">Subiect: {t.subject}</div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-xs bg-gray-50 px-2 py-0.5 rounded border border-gray-200 text-gray-500">{t.key}</span>
                            {(t.variables || []).map(v => (
                              <span key={v} className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
                                {`{{${v}}}`}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setExpandedId(expandedId === t.id ? null : t.id)}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                            {expandedId === t.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          <button onClick={() => toggleActiv(t)}
                            className={`p-1.5 rounded-lg transition-colors ${t.activ ? 'text-green-500 hover:bg-green-50' : 'text-gray-300 hover:bg-gray-100'}`}
                            title={t.activ ? 'Activ — click pentru dezactivare' : 'Inactiv — click pentru activare'}>
                            <Mail size={14} />
                          </button>
                          <button onClick={() => startEdit(t)}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
                            <Pencil size={14} />
                          </button>
                          <button onClick={() => deleteTemplate(t.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Preview expandat */}
                      {expandedId === t.id && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          {t.body_html ? (
                            <div className="space-y-2">
                              <div className="flex gap-2">
                                <button onClick={() => {}} className="text-xs text-blue-600 font-medium">Text</button>
                                <span className="text-gray-300">|</span>
                                <button className="text-xs text-gray-400">HTML</button>
                              </div>
                              <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                                {t.body_text.slice(0, 400)}{t.body_text.length > 400 ? '...' : ''}
                              </pre>
                            </div>
                          ) : (
                            <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap font-mono">
                              {t.body_text.slice(0, 400)}{t.body_text.length > 400 ? '...' : ''}
                            </pre>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* RIGHT - Editor */}
        {isEditing ? (
          <div className="lg:sticky lg:top-8 self-start">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
                <h3 className="font-semibold text-sm text-gray-900">
                  {isNew ? '+ Template nou' : `Editare: ${form.label}`}
                </h3>
                <button onClick={cancelEdit} className="p-1 rounded hover:bg-gray-200 text-gray-400">
                  <X size={16} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                {/* Label + Categorie */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Nume afișat *</label>
                    <input className={inputCls} placeholder="🔗 Link portal"
                      value={form.label || ''} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Categorie</label>
                    <select className={inputCls} value={form.categorie || 'general'}
                      onChange={e => setForm(f => ({ ...f, categorie: e.target.value }))}>
                      {CATEGORII.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Key */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Key intern <span className="text-gray-300 font-normal">(auto-generat din nume)</span>
                  </label>
                  <input className={inputCls + ' font-mono text-xs'} placeholder="link_portal"
                    value={form.key || ''} onChange={e => setForm(f => ({ ...f, key: e.target.value }))} />
                </div>

                {/* Subiect */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Subiect email *</label>
                  <input className={inputCls} placeholder="⛵ Detalii practică navigație..."
                    value={form.subject || ''} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
                </div>

                {/* Variabile */}
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-2 block">
                    Câmpuri variabile <span className="text-gray-400 font-normal">— se înlocuiesc automat la trimitere</span>
                  </label>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {(form.variables || []).map(v => (
                      <span key={v} className="flex items-center gap-1 text-xs bg-blue-50 border border-blue-100 text-blue-700 px-2 py-1 rounded-lg">
                        <button onClick={() => copyVar(v)} title="Copiază {{var}}"
                          className="hover:text-blue-900">
                          {copied === v ? '✓' : <Copy size={10} />}
                        </button>
                        <code>{`{{${v}}}`}</code>
                        <button onClick={() => removeVariable(v)} className="text-blue-400 hover:text-red-500 ml-0.5">
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {/* Variabile predefinite */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {Object.keys(VARIABLES_INFO)
                      .filter(v => !(form.variables || []).includes(v))
                      .map(v => (
                        <button key={v} onClick={() => addVariable(v)}
                          title={VARIABLES_INFO[v]}
                          className="text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-500 px-2 py-0.5 rounded transition-colors font-mono">
                          + {v}
                        </button>
                      ))}
                  </div>
                  <div className="flex gap-2">
                    <input className={inputCls + ' text-xs font-mono'} placeholder="variabila_noua"
                      value={varInput} onChange={e => setVarInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addVariable(varInput)} />
                    <button onClick={() => addVariable(varInput)}
                      className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 text-xs font-medium hover:bg-blue-100 whitespace-nowrap">
                      + Adaugă
                    </button>
                  </div>
                </div>

                {/* Body tabs */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-gray-500">Conținut</label>
                    <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                      <button onClick={() => { setActiveTab('text'); setPreviewMode(false) }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'text' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                        <span className="flex items-center gap-1"><Mail size={11} /> Text</span>
                      </button>
                      <button onClick={() => { setActiveTab('html'); setPreviewMode(false) }}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${activeTab === 'html' && !previewMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                        <span className="flex items-center gap-1"><Code size={11} /> HTML</span>
                      </button>
                      {activeTab === 'html' && (
                        <button onClick={() => setPreviewMode(!previewMode)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${previewMode ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
                          <span className="flex items-center gap-1"><Eye size={11} /> Preview</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {activeTab === 'text' && (
                    <textarea className={textareaCls} rows={10} placeholder="Scrie conținutul email-ului text...
Folosește {{variabila}} pentru câmpuri dinamice."
                      value={form.body_text || ''}
                      onChange={e => setForm(f => ({ ...f, body_text: e.target.value }))} />
                  )}

                  {activeTab === 'html' && !previewMode && (
                    <textarea className={textareaCls} rows={10} placeholder="<!DOCTYPE html>..."
                      value={form.body_html || ''}
                      onChange={e => setForm(f => ({ ...f, body_html: e.target.value }))} />
                  )}

                  {activeTab === 'html' && previewMode && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ height: 240 }}>
                      <iframe
                        srcDoc={form.body_html || '<p style="padding:20px;color:#999;font-family:Arial">Niciun HTML...</p>'}
                        className="w-full h-full"
                        sandbox="allow-same-origin"
                        title="Preview HTML"
                      />
                    </div>
                  )}

                  {/* Shortcut variabile in body */}
                  {(form.variables || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="text-xs text-gray-400">Inserează:</span>
                      {(form.variables || []).map(v => (
                        <button key={v} onClick={() => insertVariable(v)}
                          className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono hover:bg-blue-100 transition-colors">
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Activ toggle */}
                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <div>
                    <div className="text-sm font-medium text-gray-700">Template activ</div>
                    <div className="text-xs text-gray-400">Apare în lista din secțiunea Mailing</div>
                  </div>
                  <button onClick={() => setForm(f => ({ ...f, activ: !f.activ }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.activ ? 'bg-green-500' : 'bg-gray-200'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${form.activ ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>

                {/* Buttons */}
                <div className="flex gap-2 pt-1">
                  <button onClick={cancelEdit}
                    className="flex-1 py-2 rounded-xl text-sm border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">
                    Anulează
                  </button>
                  <button onClick={save} disabled={saving || !form.key || !form.label || !form.subject}
                    className="flex-1 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-40 transition-opacity"
                    style={{ background: '#0a1628' }}>
                    {saving ? 'Se salvează...' : (isNew ? '+ Creează' : '✓ Salvează')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hidden lg:flex items-center justify-center">
            <div className="text-center text-gray-300">
              <Mail size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-sm">Selectează un template pentru editare<br />sau creează unul nou</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
