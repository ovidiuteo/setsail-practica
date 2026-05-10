'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  CheckCircle, Ban, Plus, Trash2, Upload, Download,
  FileSpreadsheet, AlertTriangle, X, ArrowLeft, Check,
  Search, RefreshCw
} from 'lucide-react'
import Link from 'next/link'

type Rule = {
  id: string
  email_address: string
  rule_type: 'whitelist' | 'blacklist'
  notes: string | null
  created_at: string
}

type ImportRow = {
  email_address: string
  rule_type: 'whitelist' | 'blacklist'
  notes: string
  // stare import
  status: 'ok' | 'conflict' | 'duplicate' | 'invalid'
  conflict_with?: 'whitelist' | 'blacklist'
  conflict_id?: string
}

type ImportMode = 'paste' | 'file'

export default function EmailRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'whitelist' | 'blacklist'>('all')

  // Add single
  const [newEmail, setNewEmail] = useState('')
  const [newType, setNewType] = useState<'whitelist' | 'blacklist'>('whitelist')
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)

  // Import modal
  const [showImport, setShowImport] = useState(false)
  const [importMode, setImportMode] = useState<ImportMode>('paste')
  const [pasteText, setPasteText] = useState('')
  const [importType, setImportType] = useState<'whitelist' | 'blacklist'>('whitelist')
  const [importRows, setImportRows] = useState<ImportRow[]>([])
  const [importing, setImporting] = useState(false)
  const [importDone, setImportDone] = useState<{ inserted: number; skipped: number; resolved: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Conflict resolution
  const [conflictResolutions, setConflictResolutions] = useState<Record<number, 'keep' | 'move'>>({})

  const loadRules = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('email_rules')
      .select('*')
      .order('created_at', { ascending: false })
    setRules(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRules() }, [loadRules])

  // ── Filtrare ──────────────────────────────────────────────────────────────

  const filtered = rules.filter(r => {
    const matchSearch = !search.trim() || r.email_address.toLowerCase().includes(search.toLowerCase()) || r.notes?.toLowerCase().includes(search.toLowerCase())
    const matchType = filterType === 'all' || r.rule_type === filterType
    return matchSearch && matchType
  })

  const whitelist = rules.filter(r => r.rule_type === 'whitelist')
  const blacklist = rules.filter(r => r.rule_type === 'blacklist')

  // ── Adaugă o singură regulă ───────────────────────────────────────────────

  async function addRule() {
    const email = newEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    setAdding(true)
    await supabase.from('email_rules').upsert({
      email_address: email,
      rule_type: newType,
      notes: newNotes.trim() || null,
    }, { onConflict: 'email_address' })
    setNewEmail(''); setNewNotes('')
    await loadRules()
    setAdding(false)
  }

  async function deleteRule(id: string) {
    await supabase.from('email_rules').delete().eq('id', id)
    setRules(prev => prev.filter(r => r.id !== id))
  }

  // ── Export CSV ────────────────────────────────────────────────────────────

  function exportCSV(subset?: Rule[]) {
    const data = subset || rules
    const header = 'email_address,rule_type,notes,created_at'
    const rows = data.map(r =>
      `"${r.email_address}","${r.rule_type}","${(r.notes || '').replace(/"/g, '""')}","${new Date(r.created_at).toLocaleDateString('ro-RO')}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `setsail-email-rules-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Parse import ──────────────────────────────────────────────────────────

  function parseAndValidate(lines: string[], defaultType: 'whitelist' | 'blacklist'): ImportRow[] {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    const existingMap = new Map(rules.map(r => [r.email_address.toLowerCase(), r]))

    const seen = new Set<string>()
    const result: ImportRow[] = []

    for (const raw of lines) {
      const line = raw.trim()
      if (!line || line.startsWith('#')) continue

      // Detectează separator: tab, virgulă, punct-virgulă
      const parts = line.includes('\t')
        ? line.split('\t')
        : line.includes(';')
          ? line.split(';')
          : line.split(',')

      const email = parts[0]?.trim().toLowerCase().replace(/^["']|["']$/g, '')
      // Detectează tipul dacă e specificat în coloana 2
      let ruleType = defaultType
      const col2 = parts[1]?.trim().toLowerCase().replace(/^["']|["']$/g, '')
      if (col2 === 'whitelist' || col2 === 'blacklist') ruleType = col2 as any
      const notes = (col2 === 'whitelist' || col2 === 'blacklist')
        ? (parts[2]?.trim().replace(/^["']|["']$/g, '') || '')
        : (col2 || '')

      if (!email || !emailRegex.test(email)) continue

      // Duplicat în import
      if (seen.has(email)) {
        result.push({ email_address: email, rule_type: ruleType, notes, status: 'duplicate' })
        continue
      }
      seen.add(email)

      // Verifică conflicte cu DB
      const existing = existingMap.get(email)
      if (existing && existing.rule_type !== ruleType) {
        result.push({
          email_address: email, rule_type: ruleType, notes,
          status: 'conflict',
          conflict_with: existing.rule_type,
          conflict_id: existing.id,
        })
      } else if (existing && existing.rule_type === ruleType) {
        result.push({ email_address: email, rule_type: ruleType, notes, status: 'duplicate' })
      } else {
        result.push({ email_address: email, rule_type: ruleType, notes, status: 'ok' })
      }
    }

    return result
  }

  function handlePaste() {
    const lines = pasteText.split('\n')
    const rows = parseAndValidate(lines, importType)
    setImportRows(rows)
    setConflictResolutions({})
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      // Convertim fiecare rând în string tab-separated
      const lines = data
        .filter(row => row.some(cell => cell !== ''))
        .map(row => row.map(String).join('\t'))
      setImportRows(parseAndValidate(lines, importType))
    } else {
      const text = await file.text()
      setImportRows(parseAndValidate(text.split('\n'), importType))
    }
    setConflictResolutions({})
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Execută importul ──────────────────────────────────────────────────────

  async function doImport() {
    setImporting(true)
    let inserted = 0, skipped = 0, resolved = 0

    for (let i = 0; i < importRows.length; i++) {
      const row = importRows[i]

      if (row.status === 'duplicate') { skipped++; continue }
      if (row.status === 'invalid') { skipped++; continue }

      if (row.status === 'conflict') {
        const res = conflictResolutions[i]
        if (!res) { skipped++; continue } // nedecis → skip
        if (res === 'keep') { skipped++; continue }
        // 'move' → suprascrie
        await supabase.from('email_rules').upsert({
          email_address: row.email_address,
          rule_type: row.rule_type,
          notes: row.notes || null,
        }, { onConflict: 'email_address' })
        resolved++
        continue
      }

      // status === 'ok'
      await supabase.from('email_rules').insert({
        email_address: row.email_address,
        rule_type: row.rule_type,
        notes: row.notes || null,
      })
      inserted++
    }

    await loadRules()
    setImportDone({ inserted, skipped, resolved })
    setImporting(false)
  }

  function resetImport() {
    setImportRows([])
    setPasteText('')
    setImportDone(null)
    setConflictResolutions({})
    setShowImport(false)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const okRows       = importRows.filter(r => r.status === 'ok')
  const conflictRows = importRows.filter(r => r.status === 'conflict')
  const dupRows      = importRows.filter(r => r.status === 'duplicate')
  const unresolvedConflicts = conflictRows.filter((_, i) =>
    !conflictResolutions[importRows.indexOf(conflictRows[0]) + i]
  ).length

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/admin/emailuri" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Reguli email
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {whitelist.length} whitelist · {blacklist.length} blacklist
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => exportCSV(filtered.length < rules.length ? filtered : undefined)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} />
            Export CSV {filtered.length < rules.length ? `(${filtered.length})` : ''}
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#0a1628' }}
          >
            <Upload size={14} /> Import
          </button>
        </div>
      </div>

      {/* Adaugă regulă rapidă */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="text-sm font-medium text-gray-700 mb-3">Adaugă adresă</div>
        <div className="flex gap-3 flex-wrap items-end">
          <div className="flex-1 min-w-52">
            <input
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="email@exemplu.com"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRule()}
            />
          </div>
          <select
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
            value={newType}
            onChange={e => setNewType(e.target.value as any)}
          >
            <option value="whitelist">✅ Whitelist</option>
            <option value="blacklist">🚫 Blacklist</option>
          </select>
          <input
            className="flex-1 min-w-36 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none"
            placeholder="Notă (opțional)"
            value={newNotes}
            onChange={e => setNewNotes(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addRule()}
          />
          <button
            onClick={addRule}
            disabled={adding || !newEmail.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: '#0a1628' }}
          >
            <Plus size={14} /> Adaugă
          </button>
        </div>
      </div>

      {/* Filtre + căutare */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Caută adresă sau notă..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          {(['all', 'whitelist', 'blacklist'] as const).map(t => (
            <button key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${filterType === t ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
            >
              {t === 'all' ? 'Toate' : t === 'whitelist' ? '✅ Whitelist' : '🚫 Blacklist'}
            </button>
          ))}
        </div>
        <button onClick={loadRules} className="p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-gray-600">
          <RefreshCw size={14} />
        </button>
      </div>

      {/* Tabel reguli */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Se încarcă...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {rules.length === 0 ? 'Nicio regulă adăugată.' : 'Niciun rezultat pentru filtrele selectate.'}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-8">#</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Adresă email</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Tip</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Notă</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 w-28">Adăugat</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((rule, i) => (
                <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-300 text-xs">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={rule.rule_type === 'whitelist'
                          ? { background: '#d1fae5', color: '#065f46' }
                          : { background: '#fee2e2', color: '#991b1b' }
                        }
                      >
                        {rule.email_address[0].toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{rule.email_address}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
                      style={rule.rule_type === 'whitelist'
                        ? { background: '#d1fae5', color: '#065f46' }
                        : { background: '#fee2e2', color: '#991b1b' }
                      }
                    >
                      {rule.rule_type === 'whitelist' ? <CheckCircle size={10} /> : <Ban size={10} />}
                      {rule.rule_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">{rule.notes || '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(rule.created_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </td>
                  <td className="px-3 py-3">
                    <button onClick={() => deleteRule(rule.id)} className="text-gray-300 hover:text-red-400 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-400">{filtered.length} reguli afișate</span>
            <button
              onClick={() => exportCSV(filterType !== 'all' || search ? filtered : undefined)}
              className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
            >
              <Download size={11} /> Exportă {filterType !== 'all' ? filterType : 'toate'}
            </button>
          </div>
        )}
      </div>

      {/* ── Modal Import ────────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col">

            {/* Modal header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Import reguli</h2>
                <p className="text-sm text-gray-500 mt-0.5">Paste din Excel, CSV sau fișier</p>
              </div>
              <button onClick={resetImport} className="text-gray-400 hover:text-gray-700">
                <X size={20} />
              </button>
            </div>

            {importDone ? (
              /* ── Rezultat import ── */
              <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
                <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mb-4">
                  <Check size={28} className="text-green-600" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Import finalizat</h3>
                <div className="flex gap-4 mt-4">
                  <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100 min-w-24">
                    <div className="text-2xl font-bold text-green-700">{importDone.inserted}</div>
                    <div className="text-xs text-green-600 mt-1">Adăugate</div>
                  </div>
                  {importDone.resolved > 0 && (
                    <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100 min-w-24">
                      <div className="text-2xl font-bold text-amber-700">{importDone.resolved}</div>
                      <div className="text-xs text-amber-600 mt-1">Conflicte rezolvate</div>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100 min-w-24">
                    <div className="text-2xl font-bold text-gray-500">{importDone.skipped}</div>
                    <div className="text-xs text-gray-400 mt-1">Sărite</div>
                  </div>
                </div>
                <button
                  onClick={resetImport}
                  className="mt-8 px-6 py-2.5 rounded-lg text-sm font-medium text-white"
                  style={{ background: '#0a1628' }}
                >
                  Închide
                </button>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto p-6 space-y-5">

                {/* Tip implicit + Sursă */}
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Tip implicit pentru rândurile fără tip specificat</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      <button onClick={() => setImportType('whitelist')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${importType === 'whitelist' ? 'bg-green-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        ✅ Whitelist
                      </button>
                      <button onClick={() => setImportType('blacklist')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${importType === 'blacklist' ? 'bg-red-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        🚫 Blacklist
                      </button>
                    </div>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Sursă</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                      <button onClick={() => setImportMode('paste')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${importMode === 'paste' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        Paste text
                      </button>
                      <button onClick={() => setImportMode('file')}
                        className={`flex-1 py-2 text-sm font-medium transition-colors ${importMode === 'file' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                        Fișier
                      </button>
                    </div>
                  </div>
                </div>

                {/* Input */}
                {importMode === 'paste' ? (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                      Copiază din Excel (celule) sau scrie direct — un email per rând.
                      Coloane opționale: <code className="bg-gray-100 px-1 rounded">email | whitelist/blacklist | notă</code>
                    </label>
                    <textarea
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={6}
                      placeholder={"client@yahoo.com\npartener@firma.ro\twhitelist\tFurnizor principal\nspam@bulk.com\tblacklist"}
                      value={pasteText}
                      onChange={e => setPasteText(e.target.value)}
                    />
                    <button
                      onClick={handlePaste}
                      disabled={!pasteText.trim()}
                      className="mt-2 w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                      style={{ background: '#1e3a6e' }}
                    >
                      Procesează →
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">
                      Coloane: <code className="bg-gray-100 px-1 rounded">email_address, rule_type (opțional), notes (opțional)</code>
                    </label>
                    <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                      <FileSpreadsheet size={24} className="text-gray-300 mb-2" />
                      <span className="text-sm text-gray-400">Click sau drag & drop</span>
                      <span className="text-xs text-gray-300 mt-0.5">.xlsx, .xls, .csv, .txt</span>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls,.csv,.txt,.tsv"
                        className="hidden"
                        onChange={handleFile}
                      />
                    </label>
                  </div>
                )}

                {/* Preview + Conflicte */}
                {importRows.length > 0 && (
                  <div>
                    {/* Sumar */}
                    <div className="flex gap-3 mb-4">
                      {okRows.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-100 text-xs font-medium text-green-700">
                          <CheckCircle size={12} /> {okRows.length} de adăugat
                        </div>
                      )}
                      {conflictRows.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-100 text-xs font-medium text-amber-700">
                          <AlertTriangle size={12} /> {conflictRows.length} conflicte
                        </div>
                      )}
                      {dupRows.length > 0 && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs font-medium text-gray-500">
                          {dupRows.length} duplicate (se sar)
                        </div>
                      )}
                    </div>

                    {/* Conflicte — decizie per rând */}
                    {conflictRows.length > 0 && (
                      <div className="mb-4 p-4 rounded-xl border border-amber-200 bg-amber-50">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle size={14} className="text-amber-500" />
                          <span className="text-sm font-semibold text-amber-800">Conflicte — decide ce faci cu fiecare</span>
                        </div>
                        <div className="space-y-2">
                          {conflictRows.map((row) => {
                            const idx = importRows.indexOf(row)
                            const res = conflictResolutions[idx]
                            return (
                              <div key={idx} className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-amber-100">
                                <div className="flex-1">
                                  <span className="text-sm font-medium text-gray-900">{row.email_address}</span>
                                  <span className="ml-2 text-xs text-gray-500">
                                    e în <strong>{row.conflict_with}</strong>, vrei să muți în <strong>{row.rule_type}</strong>
                                  </span>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                  <button
                                    onClick={() => setConflictResolutions(prev => ({ ...prev, [idx]: 'keep' }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                      res === 'keep'
                                        ? 'bg-gray-800 text-white border-gray-800'
                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                                  >
                                    Păstrează {row.conflict_with}
                                  </button>
                                  <button
                                    onClick={() => setConflictResolutions(prev => ({ ...prev, [idx]: 'move' }))}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                                      res === 'move'
                                        ? 'bg-amber-500 text-white border-amber-500'
                                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                                  >
                                    Mută în {row.rule_type}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Preview tabel */}
                    <div className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="bg-gray-50 px-4 py-2 border-b border-gray-100">
                        <span className="text-xs font-medium text-gray-500">Preview — {importRows.length} rânduri</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <tbody>
                            {importRows.map((row, i) => (
                              <tr key={i} className={`border-b border-gray-50 ${
                                row.status === 'conflict' ? 'bg-amber-50' :
                                row.status === 'duplicate' ? 'bg-gray-50 opacity-50' : ''
                              }`}>
                                <td className="px-3 py-2 w-5 text-gray-300">{i + 1}</td>
                                <td className="px-3 py-2 font-medium text-gray-900">{row.email_address}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                    row.rule_type === 'whitelist' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                  }`}>
                                    {row.rule_type}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-500">{row.notes || '—'}</td>
                                <td className="px-3 py-2 text-right">
                                  {row.status === 'ok' && <span className="text-green-500 text-xs">✓ nou</span>}
                                  {row.status === 'duplicate' && <span className="text-gray-400 text-xs">duplicat</span>}
                                  {row.status === 'conflict' && <span className="text-amber-600 text-xs">⚠ conflict</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Modal footer */}
            {!importDone && importRows.length > 0 && (
              <div className="p-5 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {conflictRows.length > 0 && unresolvedConflicts > 0
                    ? `${unresolvedConflicts} conflicte nerezolvate vor fi sărite`
                    : `${okRows.length} adrese noi + ${conflictRows.filter((_, i) => conflictResolutions[importRows.indexOf(conflictRows[i])] === 'move').length} conflicte de mutat`
                  }
                </span>
                <button
                  onClick={doImport}
                  disabled={importing || (okRows.length === 0 && conflictRows.filter((_, i) => conflictResolutions[importRows.indexOf(conflictRows[i])] === 'move').length === 0)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 hover:opacity-90"
                  style={{ background: '#0a1628' }}
                >
                  <Upload size={14} />
                  {importing ? 'Se importă...' : `Importă ${okRows.length + conflictRows.filter((_, i) => conflictResolutions[importRows.indexOf(conflictRows[i])] === 'move').length} reguli`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
