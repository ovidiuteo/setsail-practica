'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, RefreshCw, ShieldAlert, Download, GraduationCap, Radio, Mail, Trash2, Pin, Eye, CalendarDays, TrendingUp, ExternalLink, Copy, Check } from 'lucide-react'

const LANDING_PATH: Record<'cds' | 'radio', string> = {
  cds: '/curs-yachting-cds',
  radio: '/curs-radio-gmdss-lrc',
}

type Visit = { total: number; today: number; last7: number }
type Data = { cds: any[]; radio: any[]; newsletter: any[]; visits?: { cds: Visit; radio: Visit } }
type Kind = 'cds' | 'radio' | 'newsletter'

const STATUSES = ['nou', 'contactat', 'inscris', 'respins'] as const
const STATUS_STYLE: Record<string, string> = {
  nou: 'bg-blue-50 text-blue-700',
  contactat: 'bg-amber-50 text-amber-700',
  inscris: 'bg-emerald-50 text-emerald-700',
  respins: 'bg-slate-100 text-slate-500',
}

function fmtDate(s: string) {
  const d = new Date(s)
  return d.toLocaleDateString('ro-RO') + ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

function toCsv(rows: any[], cols: string[]): string {
  const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}
function downloadCsv(name: string, rows: any[], cols: string[]) {
  const blob = new Blob(['﻿' + toCsv(rows, cols)], { type: 'text/csv;charset=utf-8;' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function LeadsDashboardPage() {
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [data, setData] = useState<Data | null>(null)
  const [tab, setTab] = useState<'cds' | 'radio' | 'newsletter'>('cds')
  const [focusKind, setFocusKind] = useState<'cds' | 'radio' | null>(null)

  function toggleFocus(k: 'cds' | 'radio') {
    const next = focusKind === k ? null : k
    setFocusKind(next)
    try { next ? localStorage.setItem('leads_focus', next) : localStorage.removeItem('leads_focus') } catch {}
    if (next) setTab(next)
  }

  const load = useCallback(async (t: string) => {
    const res = await fetch(`/api/leads-dashboard?token=${encodeURIComponent(t)}`)
    if (res.status === 401) { setPhase('denied'); return }
    const json = await res.json().catch(() => null)
    setData(json || { cds: [], radio: [], newsletter: [] })
    setPhase('ready')
  }, [])

  useEffect(() => {
    let f: string | null = null
    try { f = localStorage.getItem('leads_focus') } catch {}
    if (f === 'cds' || f === 'radio') { setFocusKind(f); setTab(f) }
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    if (!t) { setPhase('denied'); return }
    load(t)
  }, [load])

  // Browser tab title reflects which landing is focused (first) — Radio first when pinned.
  useEffect(() => {
    document.title = focusKind === 'radio' ? 'Lead-uri Radio / CDS' : 'Lead-uri CDS / Radio'
  }, [focusKind])

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-[#0a2a4e] mb-2">Acces refuzat</h1>
          <p className="text-slate-500 text-sm">Token invalid sau lipsă. Găsești link-ul în panoul de administrare → <span className="font-medium">Configurare</span>.</p>
        </div>
      </div>
    )
  }

  async function patchRow(kind: Kind, id: string, patch: { status?: string }) {
    setData((prev) => (prev ? { ...prev, [kind]: prev[kind].map((r) => (r.id === id ? { ...r, ...patch } : r)) } : prev))
    await fetch('/api/leads-dashboard', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, kind, id, ...patch }) }).catch(() => {})
  }
  async function removeRow(kind: Kind, id: string) {
    if (!confirm('Ștergi această înregistrare definitiv?')) return
    setData((prev) => (prev ? { ...prev, [kind]: prev[kind].filter((r) => r.id !== id) } : prev))
    await fetch(`/api/leads-dashboard?token=${encodeURIComponent(token || '')}&kind=${kind}&id=${id}`, { method: 'DELETE' }).catch(() => {})
  }

  const d = data as Data
  const TABS = [
    { k: 'cds' as const, label: 'CDS', icon: GraduationCap, n: d.cds.length },
    { k: 'radio' as const, label: 'Radio GMDSS', icon: Radio, n: d.radio.length },
    { k: 'newsletter' as const, label: 'Newsletter', icon: Mail, n: d.newsletter.length },
  ]
  const ordered = focusKind ? [TABS.find((t) => t.k === focusKind)!, ...TABS.filter((t) => t.k !== focusKind)] : TABS

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-[#0a2a4e] text-lg">Lead-uri SetSail</h1>
            <p className="text-xs text-slate-400">CDS · Radio GMDSS · Newsletter</p>
          </div>
          <button onClick={() => token && load(token)} className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition"><RefreshCw size={15} /> Reîncarcă</button>
        </div>
        <div className="max-w-6xl mx-auto px-5 flex gap-1 items-center">
          {ordered.map(({ k, label, icon: Icon, n }) => (
            <div key={k} className={`flex items-center border-b-2 -mb-px ${tab === k ? 'border-[#2ea8d8]' : 'border-transparent'}`}>
              <button onClick={() => setTab(k)} className={`flex items-center gap-1.5 pl-4 pr-2 py-2.5 text-sm font-medium transition ${tab === k ? 'text-[#0a2a4e]' : 'text-slate-400 hover:text-slate-600'}`}>
                <Icon size={15} /> {label} <span className="text-xs bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">{n}</span>
              </button>
              {(k === 'cds' || k === 'radio') && (
                <button onClick={() => toggleFocus(k)} title={focusKind === k ? 'Anulează focus' : 'Focus — afișează primul'} className={`mr-1.5 p-1 rounded-md transition ${focusKind === k ? 'text-[#f5b528]' : 'text-slate-300 hover:text-slate-500'}`}>
                  <Pin size={14} className={focusKind === k ? 'fill-current' : ''} />
                </button>
              )}
            </div>
          ))}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-5 py-6">
        {tab === 'cds' && <><VisitCards stats={d.visits?.cds} /><LeadTable rows={d.cds} kind="cds" onPatch={patchRow} onDelete={removeRow} /></>}
        {tab === 'radio' && <><VisitCards stats={d.visits?.radio} /><LeadTable rows={d.radio} kind="radio" onPatch={patchRow} onDelete={removeRow} /></>}
        {tab === 'newsletter' && <NewsletterTable rows={d.newsletter} onDelete={(id) => removeRow('newsletter', id)} />}
      </main>
    </div>
  )
}

function ExportBtn({ onClick }: { onClick: () => void }) {
  return <button onClick={onClick} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 transition"><Download size={13} /> Export CSV</button>
}

function VisitCards({ stats }: { stats?: Visit }) {
  const cards = [
    { icon: Eye, label: 'Total accesări', value: stats?.total },
    { icon: CalendarDays, label: 'Azi', value: stats?.today },
    { icon: TrendingUp, label: 'Ultimele 7 zile', value: stats?.last7 },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {cards.map(({ icon: Icon, label, value }) => (
        <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-[#eef4fb] text-[#2ea8d8] flex items-center justify-center shrink-0"><Icon size={18} /></span>
          <div className="min-w-0">
            <p className="text-2xl font-extrabold text-[#0a2a4e] leading-none">{value ?? '—'}</p>
            <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function LandingButtons({ kind }: { kind: 'cds' | 'radio' }) {
  const [copied, setCopied] = useState(false)
  const path = LANDING_PATH[kind]
  const btn = 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition'
  function copy() {
    navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}${path}`)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }
  return (
    <>
      <a href={path} target="_blank" rel="noreferrer" className={btn}><ExternalLink size={13} /> Deschide landing page</a>
      <button onClick={copy} className={btn}>{copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiat' : 'Copiază link'}</button>
    </>
  )
}

function LeadTable({ rows, kind, onPatch, onDelete }: { rows: any[]; kind: 'cds' | 'radio'; onPatch: (k: Kind, id: string, p: { status?: string }) => void; onDelete: (k: Kind, id: string) => void }) {
  const cols = kind === 'radio'
    ? ['created_at', 'name', 'lead_type', 'phone', 'email', 'message', 'status']
    : ['created_at', 'name', 'phone', 'email', 'message', 'status']
  return (
    <div>
      <div className="flex justify-end items-center gap-2 mb-3">
        <LandingButtons kind={kind} />
        <ExportBtn onClick={() => downloadCsv(`leaduri-${kind}.csv`, rows, cols)} />
      </div>
      {rows.length === 0 ? (
        <Empty label="Niciun lead încă." />
      ) : (
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 text-left">
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Nume</th>
              {kind === 'radio' && <th className="px-4 py-3">Tip</th>}
              <th className="px-4 py-3">Contact</th><th className="px-4 py-3">Mesaj</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((l) => (
              <tr key={l.id} className="hover:bg-slate-50 align-top">
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(l.created_at)}</td>
                <td className="px-4 py-3 font-medium text-[#0a2a4e]">{l.name || '—'}</td>
                {kind === 'radio' && <td className="px-4 py-3">{l.lead_type ? <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${/re[iî]n/i.test(l.lead_type) ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{l.lead_type}</span> : <span className="text-slate-300">—</span>}</td>}
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {l.phone && <div><a href={`tel:${l.phone}`} className="hover:text-[#2ea8d8]">{l.phone}</a></div>}
                  {l.email && <div><a href={`mailto:${l.email}`} className="hover:text-[#2ea8d8]">{l.email}</a></div>}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-[220px]">{l.message || '—'}</td>
                <td className="px-4 py-3">
                  <select value={l.status || 'nou'} onChange={(e) => onPatch(kind, l.id, { status: e.target.value })} className={`text-[11px] font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${STATUS_STYLE[l.status] || 'bg-slate-100 text-slate-500'}`}>
                    {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3 text-right"><button onClick={() => onDelete(kind, l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition" title="Șterge"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </div>
  )
}

function NewsletterTable({ rows, onDelete }: { rows: any[]; onDelete: (id: string) => void }) {
  if (!rows.length) return <Empty label="Niciun abonat încă." />
  return (
    <div>
      <div className="flex justify-end mb-3"><ExportBtn onClick={() => downloadCsv('newsletter.csv', rows, ['created_at', 'email', 'source'])} /></div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs text-slate-400 text-left">
              <th className="px-4 py-3">Data</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Sursă</th><th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{fmtDate(s.created_at)}</td>
                <td className="px-4 py-3 font-medium text-[#0a2a4e]"><a href={`mailto:${s.email}`} className="hover:text-[#2ea8d8]">{s.email}</a></td>
                <td className="px-4 py-3"><span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 capitalize">{s.source || '—'}</span></td>
                <td className="px-4 py-3 text-right"><button onClick={() => onDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition" title="Șterge"><Trash2 size={14} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Empty({ label }: { label: string }) {
  return <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">{label}</div>
}
