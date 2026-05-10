'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle, Ban, Plus, Trash2, Download, Upload,
  AlertTriangle, X, Check, Search, FileText, ClipboardPaste,
  ArrowLeft, TrendingUp, ArrowUp, ArrowDown
} from 'lucide-react'
import Link from 'next/link'

type Rule = {
  id: string
  email_address: string
  rule_type: 'whitelist' | 'blacklist'
  notes: string | null
  created_at: string
}

type Stat = {
  id: string
  recorded_at: string
  whitelist_count: number
  blacklist_count: number
  delta_whitelist: number
  delta_blacklist: number
  action: string | null
}

type ImportRow = {
  email: string
  notes: string
  conflict?: 'whitelist' | 'blacklist'
}

function parseEmails(text: string): string[] {
  const arr = text.split(/[\n\r\t,;]+/)
    .map(l => l.trim().toLowerCase())
    .filter(l => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(l))
  return arr.filter((v, i) => arr.indexOf(v) === i)
}

function exportCSV(rules: Rule[]) {
  const header = 'email_address,rule_type,notes,created_at'
  const rows = rules.map(r =>
    `"${r.email_address}","${r.rule_type}","${(r.notes || '').replace(/"/g, '""')}","${new Date(r.created_at).toLocaleDateString('ro-RO')}"`
  )
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url
  a.download = `setsail-reguli-${new Date().toISOString().slice(0, 10)}.csv`
  a.click(); URL.revokeObjectURL(url)
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })
}

export default function ReguliPage() {
  const [rules, setRules]     = useState<Rule[]>([])
  const [stats, setStats]     = useState<Stat[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [activeTab, setActiveTab] = useState<'whitelist' | 'blacklist'>('whitelist')
  const [newEmail, setNewEmail] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding]     = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [importMode, setImportMode]   = useState<'whitelist' | 'blacklist'>('whitelist')
  const [importText, setImportText]   = useState('')
  const [importStep, setImportStep]   = useState<'input' | 'preview' | 'importing' | 'done'>('input')
  const [importRows, setImportRows]   = useState<ImportRow[]>([])
  const [resolutions, setResolutions] = useState<Record<string, 'move' | 'skip'>>({})
  const [importProgress, setImportProgress] = useState(0)
  const [importTotal, setImportTotal]       = useState(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const loadStats = useCallback(async () => {
    const { data } = await supabase.from('email_rules_stats').select('*').order('recorded_at', { ascending: false }).limit(15)
    setStats(data || [])
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: rulesData }, { data: statsData }] = await Promise.all([
      supabase.from('email_rules').select('*').order('created_at', { ascending: false }),
      supabase.from('email_rules_stats').select('*').order('recorded_at', { ascending: false }).limit(15),
    ])
    setRules(rulesData || [])
    setStats(statsData || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const whitelist = rules.filter(r => r.rule_type === 'whitelist')
  const blacklist = rules.filter(r => r.rule_type === 'blacklist')
  const activeList = (activeTab === 'whitelist' ? whitelist : blacklist).filter(r =>
    !search || r.email_address.includes(search.toLowerCase()) ||
    r.notes?.toLowerCase().includes(search.toLowerCase())
  )

  async function addRule() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return
    setAdding(true)
    await supabase.from('email_rules').upsert(
      { email_address: email, rule_type: activeTab, notes: newNotes.trim() || null },
      { onConflict: 'email_address' }
    )
    setNewEmail(''); setNewNotes('')
    await load(); setAdding(false)
  }

  async function deleteRule(id: string) {
    await supabase.from('email_rules').delete().eq('id', id)
    setRules(prev => prev.filter(r => r.id !== id))
    await loadStats()
  }

  function handlePreview() {
    const emails = parseEmails(importText)
    if (!emails.length) return
    const rows: ImportRow[] = emails.map(email => {
      const existing = rules.find(r => r.email_address === email)
      const conflict = existing && existing.rule_type !== importMode ? existing.rule_type : undefined
      return { email, notes: '', conflict }
    })
    const res: Record<string, 'move' | 'skip'> = {}
    rows.filter(r => r.conflict).forEach(r => { res[r.email] = 'move' })
    setImportRows(rows); setResolutions(res); setImportStep('preview')
  }

  async function handleImport() {
    const toImport = importRows
      .filter(r => !r.conflict || resolutions[r.email] === 'move')
      .map(r => ({ email_address: r.email, rule_type: importMode, notes: null as string | null }))

    setImportTotal(toImport.length)
    setImportProgress(0)
    setImportStep('importing')

    const chunkSize = 500
    for (let i = 0; i < toImport.length; i += chunkSize) {
      await supabase.from('email_rules').upsert(toImport.slice(i, i + chunkSize), { onConflict: 'email_address' })
      setImportProgress(Math.min(i + chunkSize, toImport.length))
    }

    await load()
    setImportStep('done')
  }

  function resetImport() {
    setShowImport(false); setImportText(''); setImportRows([])
    setResolutions({}); setImportStep('input'); setImportProgress(0)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const text = ev.target?.result as string
      const lines = text.split('\n')
      const header = lines[0]?.toLowerCase()
      const col = header?.split(/[,;\t]/).findIndex(h => h.includes('email')) ?? 0
      const skip = header?.includes('@') ? 0 : 1
      const extracted = lines.slice(skip)
        .map(l => l.split(/[,;\t]/)[col]?.replace(/"/g, '').trim())
        .filter(Boolean).join('\n')
      setImportText(p => p ? p + '\n' + extracted : extracted)
    }
    reader.readAsText(file); e.target.value = ''
  }

  const validCount    = parseEmails(importText).length
  const conflictRows  = importRows.filter(r => r.conflict)
  const cleanRows     = importRows.filter(r => !r.conflict)
  const toImportCount = importRows.filter(r => !r.conflict || resolutions[r.email] === 'move').length
  const progressPct   = importTotal > 0 ? Math.round((importProgress / importTotal) * 100) : 0

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/admin/emailuri" className="text-gray-400 hover:text-gray-600 transition-colors">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Reguli Email</h1>
          </div>
          <p className="text-gray-500 text-sm">{whitelist.length} whitelist · {blacklist.length} blacklist</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => exportCSV(rules)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => { setShowImport(true); setImportMode(activeTab) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#0a1628' }}>
            <Upload size={14} /> Import
          </button>
        </div>
      </div>

      {/* Add single */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Adaugă adresă</h2>
        <div className="flex gap-3 flex-wrap">
          <input className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="email@exemplu.com" value={newEmail}
            onChange={e => setNewEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule()} />
          <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
            value={activeTab} onChange={e => setActiveTab(e.target.value as any)}>
            <option value="whitelist">✅ Whitelist</option>
            <option value="blacklist">🚫 Blacklist</option>
          </select>
          <input className="flex-1 min-w-32 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            placeholder="Notă opțională" value={newNotes}
            onChange={e => setNewNotes(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule()} />
          <button onClick={addRule} disabled={adding || !newEmail.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: '#0a1628' }}>
            <Plus size={14} /> Adaugă
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['whitelist', 'blacklist'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${activeTab === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {t === 'whitelist' ? <CheckCircle size={13} /> : <Ban size={13} />}
              {t === 'whitelist' ? 'Whitelist' : 'Blacklist'}
              <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs ${activeTab === t ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'}`}>
                {t === 'whitelist' ? whitelist.length : blacklist.length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            placeholder="Caută adresă sau notă..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Se încarcă...</div>
        ) : activeList.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {activeTab === 'whitelist'
              ? <><CheckCircle size={28} className="mx-auto mb-3 opacity-20" /><p className="text-sm">Nicio adresă în whitelist.</p></>
              : <><Ban size={28} className="mx-auto mb-3 opacity-20" /><p className="text-sm">Nicio adresă în blacklist.</p></>}
          </div>
        ) : (
          <>
            <div className="grid px-4 py-2 bg-gray-50 border-b border-gray-100" style={{ gridTemplateColumns: '1fr 2fr auto auto' }}>
              <span className="text-xs font-medium text-gray-400">ADRESĂ</span>
              <span className="text-xs font-medium text-gray-400">NOTĂ</span>
              <span className="text-xs font-medium text-gray-400">DATA</span>
              <span></span>
            </div>
            <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
              {activeList.map(rule => (
                <div key={rule.id} className="grid items-center px-4 py-3 hover:bg-gray-50 transition-colors gap-4"
                  style={{ gridTemplateColumns: '1fr 2fr auto auto' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${activeTab === 'whitelist' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                      {rule.email_address[0].toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">{rule.email_address}</span>
                  </div>
                  <span className="text-xs text-gray-400 truncate">{rule.notes || '—'}</span>
                  <span className="text-xs text-gray-300 whitespace-nowrap">
                    {new Date(rule.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                  <button onClick={() => deleteRule(rule.id)} className="text-gray-200 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-xs text-gray-400 text-right">
              {activeList.length} adrese afișate
            </div>
          </>
        )}
      </div>

      {/* Statistici */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
          <TrendingUp size={15} className="text-gray-400" />
          <h2 className="font-semibold text-gray-900">Istoric modificări</h2>
          <span className="ml-auto text-xs text-gray-400">ultimele 15 înregistrări</span>
        </div>
        {stats.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">Nicio modificare înregistrată încă.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">DATA ȘI ORA</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-400">ACȚIUNE</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-green-500">WHITELIST</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Δ WL</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-red-400">BLACKLIST</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-400">Δ BL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.map((s, i) => (
                  <tr key={s.id} className={i === 0 ? 'bg-blue-50/40' : 'hover:bg-gray-50'}>
                    <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap font-mono">{formatDateTime(s.recorded_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.action === 'import' ? 'bg-blue-100 text-blue-700' : s.action === 'delete' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>
                        {s.action || 'modificare'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{s.whitelist_count.toLocaleString('ro-RO')}</td>
                    <td className="px-4 py-3 text-right">
                      {s.delta_whitelist !== 0 ? (
                        <span className={`flex items-center justify-end gap-0.5 text-xs font-medium ${s.delta_whitelist > 0 ? 'text-green-600' : 'text-red-500'}`}>
                          {s.delta_whitelist > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                          {Math.abs(s.delta_whitelist).toLocaleString('ro-RO')}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{s.blacklist_count.toLocaleString('ro-RO')}</td>
                    <td className="px-4 py-3 text-right">
                      {s.delta_blacklist !== 0 ? (
                        <span className={`flex items-center justify-end gap-0.5 text-xs font-medium ${s.delta_blacklist > 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {s.delta_blacklist > 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />}
                          {Math.abs(s.delta_blacklist).toLocaleString('ro-RO')}
                        </span>
                      ) : <span className="text-gray-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900">Import adrese</h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {importStep === 'input' && 'Paste sau încarcă un fișier'}
                  {importStep === 'preview' && `${importRows.length} adrese detectate`}
                  {importStep === 'importing' && `Se importă... ${importProgress.toLocaleString('ro-RO')}/${importTotal.toLocaleString('ro-RO')}`}
                  {importStep === 'done' && 'Import finalizat'}
                </p>
              </div>
              {importStep !== 'importing' && (
                <button onClick={resetImport} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

              {importStep === 'input' && (
                <>
                  <div className="flex gap-2">
                    {(['whitelist', 'blacklist'] as const).map(type => (
                      <button key={type} onClick={() => setImportMode(type)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-medium transition-all ${importMode === type ? (type === 'whitelist' ? 'border-green-400 bg-green-50 text-green-700' : 'border-red-300 bg-red-50 text-red-600') : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                        {type === 'whitelist' ? <CheckCircle size={14} /> : <Ban size={14} />}
                        {type === 'whitelist' ? 'Whitelist' : 'Blacklist'}
                      </button>
                    ))}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <ClipboardPaste size={13} className="text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">Paste adrese</span>
                      <span className="text-xs text-gray-400">— per linie, virgulă, tab sau punct și virgulă</span>
                    </div>
                    <textarea className="w-full border border-gray-200 rounded-xl p-3 text-sm font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                      rows={7} placeholder={'email1@exemplu.com\nemail2@exemplu.com\n\nSau copiază din Excel → Ctrl+C pe coloana de emailuri → Ctrl+V aici'}
                      value={importText} onChange={e => setImportText(e.target.value)} />
                    <div className="text-xs text-gray-400 mt-1">
                      {validCount > 0 ? `${validCount} adrese valide detectate` : 'Nicio adresă validă detectată'}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText size={13} className="text-gray-400" />
                      <span className="text-xs font-medium text-gray-600">Sau importă din fișier CSV / TXT</span>
                    </div>
                    <button onClick={() => fileRef.current?.click()}
                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors">
                      <Upload size={14} /> Click pentru a selecta fișier (.csv, .txt)
                    </button>
                    <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFile} />
                  </div>
                </>
              )}

              {importStep === 'preview' && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 text-green-700 text-xs font-medium">
                      <Check size={12} /> {cleanRows.length} fără conflict
                    </div>
                    {conflictRows.length > 0 && (
                      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 text-amber-700 text-xs font-medium">
                        <AlertTriangle size={12} /> {conflictRows.length} conflicte
                      </div>
                    )}
                    <div className="ml-auto text-xs text-gray-400">
                      Se importă <strong className="text-gray-700">{toImportCount.toLocaleString('ro-RO')}</strong> adrese în <strong className="text-gray-700">{importMode}</strong>
                    </div>
                  </div>
                  {conflictRows.length > 0 && (
                    <div className="rounded-xl border border-amber-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center gap-2">
                        <AlertTriangle size={13} className="text-amber-500" />
                        <span className="text-xs font-medium text-amber-700">Conflicte</span>
                        <div className="ml-auto flex gap-2">
                          <button onClick={() => { const r = {...resolutions}; conflictRows.forEach(c => { r[c.email] = 'move' }); setResolutions(r) }}
                            className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200">Mută toate</button>
                          <button onClick={() => { const r = {...resolutions}; conflictRows.forEach(c => { r[c.email] = 'skip' }); setResolutions(r) }}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">Sari toate</button>
                        </div>
                      </div>
                      <div className="divide-y divide-amber-50 max-h-48 overflow-y-auto">
                        {conflictRows.map(row => (
                          <div key={row.email} className="flex items-center px-4 py-2.5 gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{row.email}</div>
                              <div className="text-xs text-amber-600">În <strong>{row.conflict}</strong> → muți în <strong>{importMode}</strong>?</div>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => setResolutions(r => ({ ...r, [row.email]: 'move' }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${resolutions[row.email] === 'move' ? 'bg-amber-500 text-white' : 'border border-gray-200 text-gray-500'}`}>Mută</button>
                              <button onClick={() => setResolutions(r => ({ ...r, [row.email]: 'skip' }))}
                                className={`px-2.5 py-1 rounded-lg text-xs font-medium ${resolutions[row.email] === 'skip' ? 'bg-gray-600 text-white' : 'border border-gray-200 text-gray-500'}`}>Sari</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {cleanRows.length > 0 && (
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">Adrese noi ({cleanRows.length.toLocaleString('ro-RO')})</span>
                      </div>
                      <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
                        {cleanRows.slice(0, 100).map(row => (
                          <div key={row.email} className="flex items-center px-4 py-2 gap-2">
                            <Check size={12} className="text-green-500 shrink-0" />
                            <span className="text-sm text-gray-700">{row.email}</span>
                          </div>
                        ))}
                        {cleanRows.length > 100 && (
                          <div className="px-4 py-2 text-xs text-gray-400 text-center">
                            ...și încă {(cleanRows.length - 100).toLocaleString('ro-RO')} adrese
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}

              {importStep === 'importing' && (
                <div className="py-6">
                  <div className="text-center mb-6">
                    <div className="text-4xl font-bold text-gray-900 mb-1" style={{ fontFamily: 'Georgia, serif' }}>{progressPct}%</div>
                    <div className="text-sm text-gray-500">
                      {importProgress.toLocaleString('ro-RO')} din {importTotal.toLocaleString('ro-RO')} adrese importate
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progressPct}%`, background: '#0a1628' }} />
                  </div>
                  <p className="text-xs text-gray-400 text-center mt-3">Nu închide pagina...</p>
                </div>
              )}

              {importStep === 'done' && (
                <div className="py-8 text-center">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <Check size={28} className="text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">Import finalizat!</h3>
                  <p className="text-sm text-gray-500">{toImportCount.toLocaleString('ro-RO')} adrese adăugate în <strong>{importMode}</strong>.</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between shrink-0">
              {importStep === 'input' && (
                <>
                  <button onClick={resetImport} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Anulează</button>
                  <button onClick={handlePreview} disabled={validCount === 0}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    style={{ background: '#0a1628' }}>Continuă →</button>
                </>
              )}
              {importStep === 'preview' && (
                <>
                  <button onClick={() => setImportStep('input')} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">← Înapoi</button>
                  <button onClick={handleImport} disabled={toImportCount === 0}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    style={{ background: '#059669' }}>
                    Importă {toImportCount.toLocaleString('ro-RO')} adrese
                  </button>
                </>
              )}
              {importStep === 'done' && (
                <button onClick={resetImport} className="ml-auto px-5 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#0a1628' }}>Închide</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}