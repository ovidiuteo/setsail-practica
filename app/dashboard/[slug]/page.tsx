'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, ExternalLink, LayoutDashboard, Plus, X, Check, Shield } from 'lucide-react'

type PublicLink = { id: string; title: string; description: string | null; url: string; icon: string | null }
type PublicData = { name: string; slug: string; description: string | null }

export default function DashboardPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [token, setToken] = useState('')
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [data, setData] = useState<PublicData | null>(null)
  const [links, setLinks] = useState<PublicLink[]>([])
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    setToken(t)
    ;(async () => {
      const j = await fetch(`/api/dashboards/public?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(t)}`)
        .then(r => r.json()).catch(() => ({ valid: false }))
      if (!j.valid) { setPhase('denied'); return }
      setData(j.dashboard); setLinks(j.links || []); setPhase('ready')
    })()
  }, [slug])

  // Titlul tab-ului de browser = "Dashboard {nume}"
  useEffect(() => {
    if (data?.name) document.title = `Dashboard ${data.name}`
  }, [data])

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-[#0a1628] mb-2">Acces refuzat</h1>
          <p className="text-slate-500 text-sm">Token invalid sau lipsă. Folosește linkul complet primit de la administrator.</p>
        </div>
      </div>
    )
  }

  const isOvidiu = slug === 'ovidiu'

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-[#0a1628] text-white">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="rounded-lg p-2.5 shrink-0" style={{ background: '#f5c842' }}>
              <LayoutDashboard size={20} style={{ color: '#0a1628' }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold leading-tight truncate">{data?.name}</h1>
              <p className="text-xs text-white/50 truncate">{data?.description || 'Dashboard personal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isOvidiu && (
              <a href="/admin/configurare/dashboards"
                className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-white/10 hover:bg-white/20 transition font-medium">
                <Shield size={15} /> Admin
              </a>
            )}
            <button onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-semibold text-[#0a1628] hover:opacity-90 transition"
              style={{ background: '#f5c842' }}>
              <Plus size={15} /> Adaugă link
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {links.length === 0 ? (
          <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
            Niciun link configurat încă. Apasă <span className="font-medium text-slate-500">„Adaugă link”</span> ca să adaugi unul.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {links.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer"
                className="group bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-[#2ea8d8] hover:shadow-md transition-all">
                <div className="text-2xl shrink-0 leading-none mt-0.5">{l.icon || '🔗'}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#0a1628] flex items-center gap-1.5">
                    {l.title}
                    <ExternalLink size={13} className="text-slate-300 group-hover:text-[#2ea8d8] transition-colors" />
                  </div>
                  {l.description && <p className="text-sm text-slate-500 mt-0.5">{l.description}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 text-center mt-8">
          Acest link este personal. Nu îl distribui — oricine îl are accesează aceste resurse.
        </p>
      </main>

      {showAdd && (
        <AddLinkModal slug={slug} token={token}
          onClose={() => setShowAdd(false)}
          onAdded={l => { setLinks(prev => [...prev, l]); setShowAdd(false) }} />
      )}
    </div>
  )
}

function AddLinkModal({ slug, token, onClose, onAdded }: {
  slug: string; token: string
  onClose: () => void; onAdded: (l: PublicLink) => void
}) {
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  async function submit() {
    if (!title.trim() || !url.trim()) return
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/dashboards/public/links', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, token, title: title.trim(), url: url.trim(), description: description.trim(), icon: icon.trim() }),
      })
      const json = await res.json()
      if (!res.ok || !json.link) { setErr(json.error === 'unauthorized' ? 'Token invalid.' : (json.error || 'Adăugare eșuată.')); return }
      onAdded(json.link)
    } catch { setErr('Conexiune eșuată.') }
    finally { setSaving(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842] bg-white'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="font-semibold text-[#0a1628] flex items-center gap-2"><Plus size={17} className="text-amber-500" /> Adaugă link</h3>
          <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"><X size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Titlu *</label>
            <input className={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="ex: Jurnal de bord" autoFocus
              onKeyDown={e => { if (e.key === 'Enter') submit() }} />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">URL *</label>
            <input className={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://…" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Descriere scurtă</label>
            <input className={inp} value={description} onChange={e => setDescription(e.target.value)} placeholder="ex: Completează jurnalul zilnic" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Emoji / icon (opțional)</label>
            <input className={inp} value={icon} onChange={e => setIcon(e.target.value)} placeholder="ex: 📒" />
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm border border-slate-200 text-slate-500 hover:bg-slate-50">Anulează</button>
          <button onClick={submit} disabled={saving || !title.trim() || !url.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-[#0a1628] hover:opacity-90 transition disabled:opacity-50"
            style={{ background: '#f5c842' }}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />} Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
