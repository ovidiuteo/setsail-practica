'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Check, X, Pencil, Copy, RefreshCw, ExternalLink, KeyRound, Loader2, FileText, Eye } from 'lucide-react'

type Entity = { id: string; [key: string]: string }
type Field = { key: string; label: string; placeholder?: string }

function Section({ title, table, fields }: {
  title: string
  table: string
  fields: Field[]
}) {
  const [items, setItems] = useState<Entity[]>([])
  const [newItem, setNewItem] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    supabase.from(table).select('*').order(fields[0].key).then(({ data }) => setItems(data || []))
  }, [table])

  async function add() {
    if (!newItem[fields[0].key]) return
    setAdding(true)
    const { data } = await supabase.from(table).insert(newItem).select().single()
    if (data) { setItems(i => [...i, data as Entity]); setNewItem({}); setShowAddForm(false) }
    setAdding(false)
  }

  async function remove(id: string) {
    if (!confirm('Ștergi acest element?')) return
    await supabase.from(table).delete().eq('id', id)
    setItems(i => i.filter(x => x.id !== id))
  }

  function startEdit(item: Entity) {
    setEditingId(item.id)
    const vals: Record<string, string> = {}
    fields.forEach(f => { vals[f.key] = item[f.key] || '' })
    setEditValues(vals)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const { data } = await supabase.from(table).update(editValues).eq('id', id).select().single()
    if (data) {
      setItems(i => i.map(x => x.id === id ? { ...x, ...editValues } : x))
    }
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  const inputCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white flex-1 min-w-0"
  const editInputCls = "border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-full"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{title}</h3>
        <button onClick={() => { setShowAddForm(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
          <Plus size={12} /> Adaugă
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/50">
          <div className="flex gap-2 flex-wrap items-end">
            {fields.map(f => (
              <div key={f.key} className="flex-1 min-w-28">
                <div className="text-xs text-gray-500 mb-1">{f.label}</div>
                <input className={inputCls} placeholder={f.placeholder || f.label}
                  value={newItem[f.key] || ''}
                  onChange={e => setNewItem(n => ({ ...n, [f.key]: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && add()} />
              </div>
            ))}
            <div className="flex gap-1.5 shrink-0">
              <button onClick={add} disabled={adding}
                className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                <Check size={15} />
              </button>
              <button onClick={() => { setShowAddForm(false); setNewItem({}) }}
                className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                <X size={15} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-50">
        {items.length === 0 ? (
          <div className="px-5 py-8 text-sm text-gray-400 text-center">Niciun element adăugat.</div>
        ) : items.map(item => (
          <div key={item.id} className="px-4 py-3 hover:bg-gray-50 transition-colors">
            {editingId === item.id ? (
              <div className="flex gap-2 items-end flex-wrap">
                {fields.map((f, fi) => (
                  <div key={f.key} className="flex-1 min-w-28">
                    <div className="text-xs text-gray-400 mb-1">{f.label}</div>
                    <input className={editInputCls}
                      value={editValues[f.key] || ''}
                      onChange={e => setEditValues(v => ({ ...v, [f.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit() }}
                      autoFocus={fi === 0} />
                  </div>
                ))}
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => saveEdit(item.id)} disabled={saving}
                    className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors">
                    <Check size={15} />
                  </button>
                  <button onClick={cancelEdit}
                    className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors">
                    <X size={15} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="flex gap-4 flex-wrap flex-1 min-w-0">
                  {fields.map(f => (
                    <span key={f.key} className="text-sm min-w-0">
                      <span className="text-gray-400 text-xs mr-1">{f.label}:</span>
                      <span className="text-gray-900 font-medium">{item[f.key] || '—'}</span>
                    </span>
                  ))}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => startEdit(item)}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"
                    title="Editează">
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => remove(item.id)}
                    className="p-1.5 rounded-lg border border-gray-100 text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                    title="Șterge">
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConfigurarePage() {
  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Configurare</h1>
          <p className="text-gray-500 text-sm mt-1">Gestionare locații, ambarcațiuni, evaluatori, instructori și persoane de contact</p>
        </div>
        <div className="flex items-center gap-2">
        <a href="/admin/configurare/timeline"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/><circle cx="6" cy="12" r="2"/><circle cx="14" cy="12" r="2.5"/><circle cx="20" cy="12" r="1.5"/>
          </svg>
          Timeline sesiuni
        </a>
        <a href="/admin/configurare/mail-templates"
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
          Template-uri Email
        </a>
        </div>
      </div>
      <LandingTokenSection />
      <ActeContabileSection />

      <div className="grid grid-cols-2 gap-6">
        <Section title="📍 Locații de practică" table="locations"
          fields={[
            { key: 'name', label: 'Localitate', placeholder: 'ex: Limanu' },
            { key: 'county', label: 'Județ', placeholder: 'ex: Constanța' },
            { key: 'location_detail', label: 'Adresă detaliată', placeholder: 'ex: Lac Snagov – complex Delta Snagov, str. Nicolae Grigorescu, sat Izvorani, comuna Ciolpani' },
          ]} />
        <Section title="⛵ Ambarcațiuni" table="boats"
          fields={[
            { key: 'name', label: 'Nume', placeholder: 'ex: SetSail' },
            { key: 'registration', label: 'Înmatriculare', placeholder: 'ex: CT-123' },
          ]} />
        <Section title="🏛️ Evaluatori ANR" table="evaluators"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'title', label: 'Functie', placeholder: 'Director CZC' },
            { key: 'decision_number', label: 'Nr. decizie', placeholder: '1565/16.09.2024' },
            { key: 'email_oficial', label: 'Email oficial comunicari', placeholder: 'autorizari@rna.ro' },
            { key: 'email_personal', label: 'Email personal', placeholder: 'nume@email.ro' },
            { key: 'address_serviciu', label: 'Adresa serviciu', placeholder: 'Str. Portului nr. 1' },
            { key: 'address_personal', label: 'Adresa personala', placeholder: 'Str. Exemplu nr. 1' },
            { key: 'phone_serviciu', label: 'Telefon serviciu', placeholder: '0241 123 456' },
            { key: 'phone_personal', label: 'Telefon personal', placeholder: '07XX XXX XXX' },
          ]} />
        <Section title="👤 Instructori SetSail" table="instructors"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'POPESCU ION' },
            { key: 'email', label: 'Email', placeholder: 'email@setsail.ro' },
          ]} />
        <Section title="📞 Persoane de contact" table="contact_persons"
          fields={[
            { key: 'full_name', label: 'Nume complet', placeholder: 'Paula Drugan' },
            { key: 'phone', label: 'Telefon', placeholder: '0722 488 973' },
            { key: 'email', label: 'Email', placeholder: 'paula@setsail.ro' },
            { key: 'rol', label: 'Rol', placeholder: 'ex: instructor, manager' },
          ]} />
      </div>

      {/* Numere notificari - sectiune separata full-width */}
      <NotificationNumbersSection />
    </div>
  )
}

function LandingTokenSection() {
  const [token, setToken] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState<'token' | 'link' | null>(null)

  const editorUrl = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/curs-yachting-cds/admin?token=${token}` : ''

  async function load() {
    setLoading(true)
    const json = await fetch('/api/cds-landing/token').then(r => r.json()).catch(() => null)
    setToken(json?.token || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function regenerate() {
    if (!confirm('Regenerezi token-ul? Link-urile vechi de editare nu vor mai funcționa.')) return
    setRegenerating(true)
    const json = await fetch('/api/cds-landing/token', { method: 'POST' }).then(r => r.json()).catch(() => null)
    if (json?.token) setToken(json.token)
    setRegenerating(false)
  }

  function copy(what: 'token' | 'link') {
    navigator.clipboard.writeText(what === 'token' ? token : editorUrl)
    setCopied(what)
    setTimeout(() => setCopied(null), 1500)
  }

  return (
    <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} className="text-[#2ea8d8]" />
          <div>
            <h2 className="font-semibold text-gray-900">Landing page CDS — token editor</h2>
            <p className="text-xs text-gray-400 mt-0.5">Acces la editorul paginii <code className="text-gray-500">/curs-yachting-cds</code> (texte, imagini, lead-uri)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a href="/curs-yachting-cds" target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
            <Eye size={15} /> Deschide pagina
          </a>
          <a href={editorUrl || '#'} target="_blank" rel="noreferrer"
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-colors ${token ? 'border-[#2ea8d8] text-[#103a66] hover:bg-blue-50' : 'border-gray-200 text-gray-300 pointer-events-none'}`}>
            <ExternalLink size={15} /> Deschide editorul
          </a>
          <button onClick={regenerate} disabled={regenerating || loading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
            {regenerating ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />} Regenerează token
          </button>
        </div>
      </div>
      <div className="p-6 space-y-4">
        <div>
          <label className="text-xs font-medium text-gray-500">Token</label>
          <div className="flex gap-2 mt-1">
            <input readOnly value={loading ? 'Se încarcă…' : token}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono text-gray-600 bg-gray-50" />
            <button onClick={() => copy('token')} disabled={!token}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors disabled:opacity-50">
              {copied === 'token' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />} {copied === 'token' ? 'Copiat' : 'Copiază'}
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Link direct către editor</label>
          <div className="flex gap-2 mt-1">
            <input readOnly value={loading ? '' : editorUrl}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-600 bg-gray-50 truncate" />
            <button onClick={() => copy('link')} disabled={!token}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 transition-colors disabled:opacity-50">
              {copied === 'link' ? <Check size={15} className="text-green-600" /> : <Copy size={15} />} {copied === 'link' ? 'Copiat' : 'Copiază'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Oricine are acest link poate edita pagina. Regenerează token-ul pentru a revoca accesul.</p>
        </div>
      </div>
    </div>
  )
}

function ActeContabileSection() {
  const ENTITIES = [
    { key: 'ssa', label: 'SSA — Set Sail Advertising', color: '#2563eb' },
    { key: 'ssy', label: 'SSY — Set Sail Yachting',     color: '#0a8a6f' },
  ] as const

  return (
    <div className="mb-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <FileText size={18} className="text-amber-500" />
        <div>
          <h2 className="font-semibold text-gray-900">Acte contabile — link-uri contabil</h2>
          <p className="text-xs text-gray-400 mt-0.5">Pagini private de încărcare documente pentru fiecare firmă. Distribuie link-ul contabilului; regenerează pentru a revoca accesul.</p>
        </div>
      </div>
      <div className="divide-y divide-gray-50">
        {ENTITIES.map(e => <ActeEntityRow key={e.key} entity={e.key} label={e.label} color={e.color} />)}
      </div>
    </div>
  )
}

function ActeEntityRow({ entity, label, color }: { entity: string; label: string; color: string }) {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/acte-contabile/${entity}?token=${token}` : ''

  async function load() {
    setLoading(true)
    const json = await fetch(`/api/acte-contabile/token?entity=${entity}`).then(r => r.json()).catch(() => null)
    setToken(json?.token || '')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function regenerate() {
    if (!confirm(`Regenerezi token-ul pentru ${entity.toUpperCase()}? Link-ul vechi nu va mai funcționa.`)) return
    setRegenerating(true)
    const json = await fetch(`/api/acte-contabile/token?entity=${entity}`, { method: 'POST' }).then(r => r.json()).catch(() => null)
    if (json?.token) setToken(json.token)
    setRegenerating(false)
  }

  function copy() {
    navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="px-6 py-4">
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-sm font-medium text-gray-800 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: color }} /> {label}
        </span>
        <div className="flex items-center gap-2">
          <a href={url || '#'} target="_blank" rel="noreferrer"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${token ? 'border-gray-200 text-gray-700 hover:bg-gray-50' : 'border-gray-100 text-gray-300 pointer-events-none'}`}>
            <ExternalLink size={13} /> Deschide pagina
          </a>
          <button onClick={regenerate} disabled={regenerating || loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
            {regenerating ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Regenerează
          </button>
        </div>
      </div>
      <div className="flex gap-2">
        <input readOnly value={loading ? 'Se încarcă…' : url}
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-gray-50 truncate" />
        <button onClick={copy} disabled={!token}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 transition-colors disabled:opacity-50">
          {copied ? <Check size={14} className="text-green-600" /> : <Copy size={14} />} {copied ? 'Copiat' : 'Copiază link'}
        </button>
      </div>
    </div>
  )
}

function NotificationNumbersSection() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTip, setFilterTip] = useState<'all'|'solicitare'|'document'>('all')

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('notification_numbers')
      .select('*, sessions(session_date, class_caa)')
      .order('numar', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function remove(id: string, numar: number) {
    if (!confirm(`Ștergi numărul ${numar}? Această acțiune nu poate fi anulată.`)) return
    await supabase.from('notification_numbers').delete().eq('id', id)
    setRows(r => r.filter(x => x.id !== id))
  }

  const TIP_LABELS: Record<string, string> = {
    'curs-obtinere':     'Curs Obținere',
    'examen-obtinere':   'Examen Obținere',
    'curs-prelungire':   'Curs Prelungire',
    'examen-prelungire': 'Examen Prelungire',
    'instiintare-anr':   'Înștiințare ANR',
    'pv-obtinere':       'PV Obținere',
    'anexa-pv-obtinere': 'Anexă PV Obținere',
    'pv-prelungire':     'PV Prelungire',
    'anexa-pv-prelungire':'Anexă PV Prelungire',
  }

  const filtered = filterTip === 'all' ? rows : rows.filter(r => r.tip === filterTip)

  return (
    <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div>
          <h2 className="font-semibold text-gray-900">🔢 Numere notificări alocate</h2>
          <p className="text-xs text-gray-400 mt-0.5">{rows.length} înregistrări total</p>
        </div>
        <div className="flex gap-2">
          {(['all','solicitare','document'] as const).map(t => (
            <button key={t} onClick={() => setFilterTip(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                filterTip === t ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {t === 'all' ? 'Toate' : t === 'solicitare' ? 'Înștiințări' : 'Documente PV'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-gray-400 py-8">Se încarcă...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-gray-400 py-8">Niciun număr alocat.</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-400 font-medium">
              <th className="text-left px-6 py-3">Nr.</th>
              <th className="text-left px-4 py-3">Tip serie</th>
              <th className="text-left px-4 py-3">Document</th>
              <th className="text-left px-4 py-3">Data</th>
              <th className="text-left px-4 py-3">Sesiune</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 font-bold text-gray-900">{r.numar}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    r.tip === 'solicitare'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-purple-50 text-purple-700'
                  }`}>
                    {r.tip === 'solicitare' ? 'Înștiințare' : 'Document PV'}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {TIP_LABELS[r.document_tip] || r.document || '—'}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {r.data_notificare
                    ? new Date(r.data_notificare).toLocaleDateString('ro-RO')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {r.sessions?.session_date
                    ? new Date(r.sessions.session_date).toLocaleDateString('ro-RO') + ' · ' + (r.sessions.class_caa || '')
                    : '—'}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => remove(r.id, r.numar)}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                    <Trash2 size={14}/>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
