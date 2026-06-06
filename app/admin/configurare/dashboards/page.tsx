'use client'
import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Trash2, Check, X, Pencil, Copy, RefreshCw, ExternalLink, Eye,
  Loader2, KeyRound, ArrowUp, ArrowDown, LayoutDashboard, Link2, Download, ChevronLeft,
} from 'lucide-react'

type Dashboard = {
  id: string; name: string; slug: string; token: string; description: string | null
}
type DLink = {
  id: string; dashboard_id: string; title: string; description: string | null
  url: string; icon: string | null; sort_order: number
}

const origin = () => (typeof window !== 'undefined' ? window.location.origin : '')

export default function DashboardsConfigPage() {
  const [dashboards, setDashboards] = useState<Dashboard[] | null>(null)
  const [newName, setNewName] = useState('')
  const [adding, setAdding] = useState(false)

  const load = useCallback(async () => {
    const json = await fetch('/api/dashboards').then(r => r.json()).catch(() => null)
    setDashboards(json?.dashboards || [])
  }, [])
  useEffect(() => { load() }, [load])

  async function addDashboard() {
    const name = newName.trim()
    if (!name) return
    setAdding(true)
    const json = await fetch('/api/dashboards', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => r.json()).catch(() => null)
    if (json?.dashboard) setDashboards(d => [...(d || []), json.dashboard].sort((a, b) => a.name.localeCompare(b.name)))
    setNewName(''); setAdding(false)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <a href="/admin/configurare" className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors" title="Înapoi la Configurare">
            <ChevronLeft size={18} />
          </a>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
              <LayoutDashboard size={22} className="text-[#2ea8d8]" /> Dashboard-uri persoane
            </h1>
            <p className="text-gray-500 text-sm mt-1">Pagini individuale accesibile cu token. Configurează linkurile afișate fiecărei persoane.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addDashboard()}
            placeholder="Nume persoană nouă…"
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
          <button onClick={addDashboard} disabled={adding || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border border-[#2ea8d8] text-[#103a66] hover:bg-blue-50 transition-colors disabled:opacity-50">
            {adding ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} Adaugă dashboard
          </button>
        </div>
      </div>

      {dashboards === null ? (
        <div className="text-center text-gray-400 py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : dashboards.length === 0 ? (
        <div className="text-center text-gray-400 py-16 bg-white rounded-xl border border-gray-100">Niciun dashboard. Adaugă o persoană mai sus.</div>
      ) : (
        <div className="space-y-6">
          {dashboards.map(d => (
            <DashboardCard key={d.id} dashboard={d} allDashboards={dashboards}
              onChanged={upd => setDashboards(list => (list || []).map(x => x.id === upd.id ? upd : x))}
              onDeleted={id => setDashboards(list => (list || []).filter(x => x.id !== id))} />
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">
        💡 În URL-ul unui link poți folosi <code className="bg-gray-100 px-1 rounded">{'{token}'}</code> — va fi înlocuit cu token-ul curent al dashboard-ului. Astfel, când regenerezi token-ul, linkul se actualizează automat.
      </p>
    </div>
  )
}

function DashboardCard({ dashboard, allDashboards, onChanged, onDeleted }: {
  dashboard: Dashboard; allDashboards: Dashboard[]
  onChanged: (d: Dashboard) => void; onDeleted: (id: string) => void
}) {
  const [d, setD] = useState(dashboard)
  useEffect(() => setD(dashboard), [dashboard])

  const [links, setLinks] = useState<DLink[] | null>(null)
  const [editingMeta, setEditingMeta] = useState(false)
  const [metaName, setMetaName] = useState(d.name)
  const [metaDesc, setMetaDesc] = useState(d.description || '')
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState<'token' | 'link' | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [showAddLink, setShowAddLink] = useState(false)

  const pageUrl = `${origin()}/dashboard/${d.slug}?token=${d.token}`

  const loadLinks = useCallback(async () => {
    const json = await fetch(`/api/dashboards/${d.id}/links`).then(r => r.json()).catch(() => null)
    setLinks(json?.links || [])
  }, [d.id])
  useEffect(() => { loadLinks() }, [loadLinks])

  function copy(what: 'token' | 'link') {
    navigator.clipboard.writeText(what === 'token' ? d.token : pageUrl)
    setCopied(what); setTimeout(() => setCopied(null), 1500)
  }

  async function regenerate() {
    if (!confirm(`Regenerezi token-ul pentru ${d.name}? Linkul vechi nu va mai funcționa.`)) return
    setRegenerating(true)
    const json = await fetch(`/api/dashboards/${d.id}/token`, { method: 'POST' }).then(r => r.json()).catch(() => null)
    if (json?.token) { const upd = { ...d, token: json.token }; setD(upd); onChanged(upd) }
    setRegenerating(false)
  }

  async function saveMeta() {
    const name = metaName.trim(); if (!name) return
    const json = await fetch(`/api/dashboards/${d.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name, description: metaDesc || null }),
    }).then(r => r.json()).catch(() => null)
    if (json?.dashboard) { setD(json.dashboard); onChanged(json.dashboard) }
    setEditingMeta(false)
  }

  async function removeDashboard() {
    if (!confirm(`Ștergi dashboard-ul „${d.name}” și toate linkurile lui? Acțiunea nu poate fi anulată.`)) return
    const json = await fetch(`/api/dashboards/${d.id}`, { method: 'DELETE' }).then(r => r.json()).catch(() => null)
    if (json?.ok) onDeleted(d.id)
  }

  async function addLinkRow(fields: { title: string; url: string; description: string; icon: string }) {
    const json = await fetch(`/api/dashboards/${d.id}/links`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify(fields),
    }).then(r => r.json()).catch(() => null)
    if (json?.link) { setLinks(l => [...(l || []), json.link]); setShowAddLink(false) }
  }

  async function move(idx: number, dir: -1 | 1) {
    if (!links) return
    const j = idx + dir
    if (j < 0 || j >= links.length) return
    const next = [...links]
    ;[next[idx], next[j]] = [next[j], next[idx]]
    setLinks(next)
    await fetch(`/api/dashboards/${d.id}/links`, {
      method: 'PUT', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ orderedIds: next.map(l => l.id) }),
    }).catch(() => {})
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* header */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-blue-50/40 to-transparent">
        {editingMeta ? (
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-40">
              <div className="text-xs text-gray-400 mb-1">Nume</div>
              <input value={metaName} onChange={e => setMetaName(e.target.value)} autoFocus
                className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex-[2] min-w-40">
              <div className="text-xs text-gray-400 mb-1">Descriere</div>
              <input value={metaDesc} onChange={e => setMetaDesc(e.target.value)}
                className="border border-blue-200 rounded-lg px-2.5 py-1.5 text-sm w-full focus:outline-none focus:ring-2 focus:ring-blue-400" />
            </div>
            <div className="flex gap-1.5">
              <button onClick={saveMeta} className="p-2 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={15} /></button>
              <button onClick={() => { setEditingMeta(false); setMetaName(d.name); setMetaDesc(d.description || '') }} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={15} /></button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="rounded-lg p-2 shrink-0" style={{ background: '#f5c842' }}>
                <LayoutDashboard size={16} style={{ color: '#0a1628' }} />
              </div>
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{d.name}</h3>
                <p className="text-xs text-gray-400 truncate">{d.description || `/dashboard/${d.slug}`}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <a href={pageUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
                <Eye size={14} /> Deschide pagina
              </a>
              <button onClick={() => setEditingMeta(true)}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors" title="Editează nume/descriere">
                <Pencil size={14} />
              </button>
              <button onClick={removeDashboard}
                className="p-1.5 rounded-lg border border-gray-100 text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors" title="Șterge dashboard">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* token zone */}
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound size={14} className="text-[#2ea8d8]" />
          <span className="text-xs font-medium text-gray-500">Acces cu token</span>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <input readOnly value={pageUrl}
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 bg-white truncate" />
          <button onClick={() => copy('link')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 transition-colors">
            {copied === 'link' ? <Check size={14} className="text-green-600" /> : <Copy size={14} />} {copied === 'link' ? 'Copiat' : 'Copiază link'}
          </button>
          <button onClick={() => copy('token')}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-600 transition-colors">
            {copied === 'token' ? <Check size={14} className="text-green-600" /> : <KeyRound size={14} />} {copied === 'token' ? 'Copiat' : 'Copiază token'}
          </button>
          <button onClick={regenerate} disabled={regenerating}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-amber-200 text-amber-700 hover:bg-amber-50 transition-colors disabled:opacity-50">
            {regenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Regenerează token
          </button>
        </div>
      </div>

      {/* links */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
            <Link2 size={15} className="text-gray-400" /> Linkuri afișate ({links?.length ?? 0})
          </h4>
          <div className="flex gap-1.5">
            <button onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors text-gray-600">
              <Download size={13} /> Importă din alt dashboard
            </button>
            <button onClick={() => setShowAddLink(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
              <Plus size={13} /> Adaugă link
            </button>
          </div>
        </div>

        {showAddLink && <LinkForm onCancel={() => setShowAddLink(false)} onSave={addLinkRow} />}

        {links === null ? (
          <div className="text-center text-gray-400 py-6"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : links.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-6">Niciun link adăugat încă.</div>
        ) : (
          <div className="space-y-2 mt-2">
            {links.map((l, i) => (
              <LinkRow key={l.id} link={l} idx={i} total={links.length}
                token={d.token}
                onMove={move}
                onUpdated={u => setLinks(list => (list || []).map(x => x.id === u.id ? u : x))}
                onDeleted={id => setLinks(list => (list || []).filter(x => x.id !== id))} />
            ))}
          </div>
        )}
      </div>

      {showImport && (
        <ImportModal current={d} all={allDashboards} onClose={() => setShowImport(false)}
          onImported={imported => { setLinks(l => [...(l || []), ...imported]); setShowImport(false) }} />
      )}
    </div>
  )
}

function LinkForm({ initial, onSave, onCancel }: {
  initial?: { title: string; url: string; description: string; icon: string }
  onSave: (f: { title: string; url: string; description: string; icon: string }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title || '')
  const [url, setUrl] = useState(initial?.url || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [icon, setIcon] = useState(initial?.icon || '')
  const [saving, setSaving] = useState(false)
  const inp = 'border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full'

  async function submit() {
    if (!title.trim() || !url.trim()) return
    setSaving(true)
    await onSave({ title: title.trim(), url: url.trim(), description: description.trim(), icon: icon.trim() })
    setSaving(false)
  }

  return (
    <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/40 mb-3">
      <div className="grid sm:grid-cols-2 gap-2.5 mb-2.5">
        <div>
          <div className="text-xs text-gray-500 mb-1">Titlu *</div>
          <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Acte contabile SSY" autoFocus />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">URL * <span className="text-gray-400">(poți folosi {'{token}'})</span></div>
          <input className={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://… sau /acte-contabile/ssy?token={token}" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Descriere scurtă</div>
          <input className={inp} value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Încarcă facturi și extrase" />
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Emoji / icon (opțional)</div>
          <input className={inp} value={icon} onChange={e => setIcon(e.target.value)} placeholder="ex: 📁" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 text-gray-500 hover:bg-gray-50">Anulează</button>
        <button onClick={submit} disabled={saving || !title.trim() || !url.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium bg-[#2ea8d8] text-white hover:bg-[#2691bd] disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvează
        </button>
      </div>
    </div>
  )
}

function LinkRow({ link, idx, total, token, onMove, onUpdated, onDeleted }: {
  link: DLink; idx: number; total: number; token: string
  onMove: (idx: number, dir: -1 | 1) => void
  onUpdated: (l: DLink) => void; onDeleted: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const resolved = link.url.replace(/\{token\}/g, token)

  async function save(f: { title: string; url: string; description: string; icon: string }) {
    const json = await fetch(`/api/dashboards/links/${link.id}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: f.title, url: f.url, description: f.description || null, icon: f.icon || null }),
    }).then(r => r.json()).catch(() => null)
    if (json?.link) { onUpdated(json.link); setEditing(false) }
  }

  async function remove() {
    if (!confirm(`Ștergi linkul „${link.title}”?`)) return
    const json = await fetch(`/api/dashboards/links/${link.id}`, { method: 'DELETE' }).then(r => r.json()).catch(() => null)
    if (json?.ok) onDeleted(link.id)
  }

  if (editing) {
    return <LinkForm initial={{ title: link.title, url: link.url, description: link.description || '', icon: link.icon || '' }}
      onSave={save} onCancel={() => setEditing(false)} />
  }

  const dynamic = /\{token\}/.test(link.url)

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
      <div className="flex flex-col gap-0.5 shrink-0">
        <button onClick={() => onMove(idx, -1)} disabled={idx === 0}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowUp size={13} /></button>
        <button onClick={() => onMove(idx, 1)} disabled={idx === total - 1}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-30"><ArrowDown size={13} /></button>
      </div>
      {link.icon && <span className="text-lg shrink-0">{link.icon}</span>}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{link.title}</span>
          {dynamic && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium shrink-0">token dinamic</span>}
        </div>
        {link.description && <div className="text-xs text-gray-400 truncate">{link.description}</div>}
        <a href={resolved} target="_blank" rel="noreferrer" className="text-xs text-[#2ea8d8] hover:underline truncate block">{resolved}</a>
      </div>
      <div className="flex gap-1.5 shrink-0">
        <a href={resolved} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-[#2ea8d8] hover:border-blue-200 hover:bg-blue-50 transition-colors" title="Deschide">
          <ExternalLink size={13} />
        </a>
        <button onClick={() => setEditing(true)} className="p-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors" title="Editează">
          <Pencil size={13} />
        </button>
        <button onClick={remove} className="p-1.5 rounded-lg border border-gray-100 text-red-300 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors" title="Șterge">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

function ImportModal({ current, all, onClose, onImported }: {
  current: Dashboard; all: Dashboard[]
  onClose: () => void; onImported: (links: DLink[]) => void
}) {
  const others = all.filter(d => d.id !== current.id)
  const [sourceId, setSourceId] = useState(others[0]?.id || '')
  const [links, setLinks] = useState<DLink[] | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    if (!sourceId) { setLinks([]); return }
    setLinks(null); setSelected(new Set())
    fetch(`/api/dashboards/${sourceId}/links`).then(r => r.json()).then(j => setLinks(j?.links || [])).catch(() => setLinks([]))
  }, [sourceId])

  function toggle(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function doImport() {
    if (selected.size === 0) return
    setImporting(true)
    const json = await fetch(`/api/dashboards/${current.id}/import`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ linkIds: Array.from(selected) }),
    }).then(r => r.json()).catch(() => null)
    setImporting(false)
    if (json?.links) onImported(json.links)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Importă linkuri în „{current.name}”</h3>
            <p className="text-xs text-gray-400 mt-0.5">Copiile păstrează {'{token}'} și folosesc token-ul lui {current.name}.</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><X size={16} /></button>
        </div>
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="text-xs text-gray-500 mb-1">Din dashboard-ul</div>
          <select value={sourceId} onChange={e => setSourceId(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
            {others.length === 0 && <option value="">— niciun alt dashboard —</option>}
            {others.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="flex-1 overflow-auto px-5 py-3">
          {links === null ? (
            <div className="text-center text-gray-400 py-8"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
          ) : links.length === 0 ? (
            <div className="text-center text-sm text-gray-400 py-8">Acest dashboard nu are linkuri.</div>
          ) : links.map(l => (
            <label key={l.id} className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer">
              <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} className="mt-1" />
              <div className="min-w-0">
                <div className="text-sm font-medium text-gray-900 flex items-center gap-1.5">{l.icon && <span>{l.icon}</span>}{l.title}</div>
                {l.description && <div className="text-xs text-gray-400">{l.description}</div>}
                <div className="text-xs text-gray-400 truncate">{l.url}</div>
              </div>
            </label>
          ))}
        </div>
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">{selected.size} selectate</span>
          <button onClick={doImport} disabled={importing || selected.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-[#2ea8d8] text-white hover:bg-[#2691bd] disabled:opacity-50">
            {importing ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} Importă {selected.size > 0 ? `(${selected.size})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}
