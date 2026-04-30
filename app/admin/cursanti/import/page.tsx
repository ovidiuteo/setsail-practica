'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload, FileSpreadsheet, Check, AlertCircle, Trash2 } from 'lucide-react'
import Link from 'next/link'

type StudentRow = {
  full_name: string
  cnp: string
  email: string
  phone: string
  birth_date: string
  ci_series: string
  ci_number: string
  address: string
  county: string
  class_caa: string
}

const EMPTY_ROW: StudentRow = {
  full_name: '', cnp: '', email: '', phone: '',
  birth_date: '', ci_series: '', ci_number: '',
  address: '', county: '', class_caa: 'C,D'
}

export default function ImportCursantiPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState('')
  const [defaultClass, setDefaultClass] = useState('C,D')
  const [rows, setRows] = useState<StudentRow[]>([])
  const [importing, setImporting] = useState(false)
  const [done, setDone] = useState(false)
  const [importedCount, setImportedCount] = useState(0)
  const [importReport, setImportReport] = useState<{
    inserted: number
    updated: number
    unchanged: number
    updatedFields: {name: string, fields: string[]}[]
  } | null>(null)
  const [pasteText, setPasteText] = useState('')
  const [mode, setMode] = useState<'paste' | 'file'>('paste')

  useEffect(() => {
    supabase.from('sessions')
      .select('id, session_date, access_code, locations(name), class_caa')
      .order('session_date', { ascending: false })
      .then(({ data }) => {
        setSessions(data || [])
        if (data && data.length > 0) {
          setSelectedSession(data[0].id)
          setDefaultClass(data[0].class_caa || 'C,D')
        }
      })
  }, [])

  // Parse pasted text - detectează automat formatul din datele trimise
  // Format detectat: Nume\tEmail\tTelefon\tDataNastere\tCNP: XXXXX
  // sau: Nume\tCNP\tEmail\tCI\tClasa (format clasic)
  function invertName(name: string): string {
    const parts = name.trim().split(/\s+/)
    if (parts.length <= 1) return name.toUpperCase()
    return parts.slice(1).join(' ') + ' ' + parts[0]
  }
  function cleanCounty(val: string): string {
    return val.trim().replace(/^jud\.\s*/i,'').replace(/^judet\s*/i,'').replace(/^județul\s*/i,'').trim()
  }
  function cleanPhone(val: string): string {
    return val.replace(/^[^0-9+]/, '').trim()
  }

  function parseText(text: string): StudentRow[] {
    const lines = text.trim().split('\n').filter(l => l.trim())
    const parsed: StudentRow[] = []

    // Sari randurile de titlu si header
    let startIdx = 0
    for (let hi = 0; hi < Math.min(3, lines.length); hi++) {
      const hparts = lines[hi].split('\t').map(p => p.trim())
      const h = lines[hi].toLowerCase()
      // Header de tabel sau titlu de curs (un singur camp sau cuvinte cheie)
      if (h.includes('cursant') || h.includes('nr.') ||
          (hparts[0].toLowerCase() === 'nr') ||
          (hparts.filter(p=>p).length <= 2 && !hparts[1] && hparts[0].length > 3 && !/^\d/.test(hparts[0]))) {
        startIdx = hi + 1
      }
    }

    for (let li = startIdx; li < lines.length; li++) {
      const line = lines[li]
      const parts = line.includes('\t') ? line.split('\t') : line.split(',')
      const trimmed = parts.map(p => p.trim())
      const firstIsNumber = /^\d+$/.test(trimmed[0])
      const hasCNPLabel = trimmed.some(p => p.startsWith('CNP:'))

      const firstIsEmpty = trimmed[0] === ''

      if ((firstIsNumber || firstIsEmpty) && trimmed.length >= 4 && trimmed[1] !== '') {
        // FORMAT 1 (nr) sau FORMAT 2 (gol): [Nr/gol] | Cursant | CNP | DataNasterii | Email | ...
        const cursant = trimmed[1] || ''
        if (!cursant) continue
        const full_name = invertName(cursant)
        const cnpRaw = trimmed[2].replace(/\.0$/, '')
        const birthRaw = trimmed[3] || ''
        const email = trimmed[4] || ''
        const phone = cleanPhone(trimmed[5] || '')
        const adresa = trimmed[6] || ''
        const localitate = trimmed[7] || ''
        const sectorJudet = trimmed[8] || ''
        let address = adresa
        if (localitate && !address.toLowerCase().includes(localitate.toLowerCase())) {
          address = address + (address ? ', ' : '') + localitate
        }
        parsed.push({ ...EMPTY_ROW, full_name, cnp: cnpRaw, email, phone, birth_date: birthRaw,
          address, county: cleanCounty(sectorJudet || localitate), class_caa: defaultClass })
      } else if (hasCNPLabel) {
        const full_name = trimmed[0] || ''
        const email = trimmed[1] || ''
        const phone = cleanPhone(trimmed[2] || '')
        let birth_date = '', cnp = ''
        for (const part of trimmed) {
          if (part.startsWith('CNP:')) cnp = part.replace('CNP:', '').trim()
          else if (/^\d{2}\.\d{2}\.\d{4}$/.test(part)) birth_date = part
        }
        if (!full_name) continue
        parsed.push({ ...EMPTY_ROW, full_name: full_name.toUpperCase(), email, phone, birth_date, cnp, class_caa: defaultClass })
      } else {
        const full_name = trimmed[0] || ''
        if (!full_name || full_name.toLowerCase() === 'nr') continue
        parsed.push({ ...EMPTY_ROW, full_name: full_name.toUpperCase(), cnp: trimmed[1] || '',
          email: trimmed[2] || '', ci_series: trimmed[3] || '', class_caa: trimmed[4] || defaultClass })
      }
    }
    return parsed
  }

  function handlePaste() {
    const parsed = parseText(pasteText)
    if (parsed.length === 0) return
    setRows(parsed)
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
      const parsed: StudentRow[] = []
      let startRow = 0
      // Sari headerul daca primul rand contine text
      if (data[0] && typeof data[0][0] === 'string' && isNaN(Number(data[0][0]))) startRow = 1

      for (let ri = startRow; ri < data.length; ri++) {
        const row = data[ri]
        const firstCell = String(row[0] || '').trim()
        // Nu sara randurile cu prima coloana goala (Format 2)

        // Detectam Format 1 sau 2: prima coloana e numar sau goala
        if (/^\d+$/.test(firstCell) || firstCell === '') {
          const cursant = String(row[1] || '').trim()
          if (!cursant) continue  // sarim randurile complet goale
          if (!cursant) continue
          const full_name = invertName(cursant)
          const cnpRaw = String(row[2] || '').replace(/\.0$/, '').trim()
          const birthRaw = String(row[3] || '').trim()
          const email = String(row[4] || '').trim()
          const phone = cleanPhone(String(row[5] || '').trim())
          const adresa = String(row[6] || '').trim()
          const localitate = String(row[7] || '').trim()
          const sectorJudet = String(row[8] || '').trim()
          let address = adresa
          if (localitate && !address.toLowerCase().includes(localitate.toLowerCase())) {
            address = address + (address ? ', ' : '') + localitate
          }
          parsed.push({
            full_name, cnp: cnpRaw, email, phone,
            birth_date: birthRaw,
            ci_series: '', ci_number: '',
            address, county: cleanCounty(sectorJudet || localitate),
            class_caa: defaultClass,
          })
        } else {
          // Format clasic
          if (['nume', 'name', 'nr'].includes(firstCell.toLowerCase())) continue
          const cnpRaw = String(row[1] || '').replace(/\.0$/, '').trim()
          parsed.push({
            full_name: firstCell.toUpperCase(),
            cnp: cnpRaw,
            email: String(row[2] || '').trim(),
            phone: String(row[3] || '').trim(),
            birth_date: String(row[4] || '').trim(),
            ci_series: String(row[5] || '').trim(),
            ci_number: String(row[6] || '').trim(),
            address: String(row[7] || '').trim(),
            county: String(row[8] || '').trim(),
            class_caa: String(row[9] || defaultClass).trim() || defaultClass,
          })
        }
      }
      setRows(parsed)
    } else {
      const text = await file.text()
      setRows(parseText(text))
    }
    if (fileRef.current) fileRef.current.value = ''
  }

  function updateRow(i: number, field: keyof StudentRow, value: string) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeRow(i: number) {
    setRows(rs => rs.filter((_, idx) => idx !== i))
  }

  function addEmptyRow() {
    setRows(rs => [...rs, { ...EMPTY_ROW, class_caa: defaultClass }])
  }

  async function doImport() {
    if (!selectedSession || rows.length === 0) return
    setImporting(true)

    // Fetch cursantii existenti din sesiune
    const { data: existingStudents } = await supabase
      .from('students').select('*')
      .eq('session_id', selectedSession)
      .order('order_in_session', { ascending: false })
    const existing = existingStudents || []
    const maxOrder = existing[0]?.order_in_session || 0

    const report = { inserted: 0, updated: 0, unchanged: 0, updatedFields: [] as {name: string, fields: string[]}[] }
    let orderCounter = maxOrder

    for (const row of rows.filter(r => r.full_name)) {
      // Gaseste duplicate dupa nume (case-insensitive) sau email sau CNP
      const match = existing.find(e =>
        e.full_name?.toLowerCase() === row.full_name.toLowerCase() ||
        (row.email && e.email?.toLowerCase() === row.email.toLowerCase()) ||
        (row.cnp && row.cnp.length > 5 && e.cnp === row.cnp)
      )

      if (match) {
        // Verifica ce campuri sunt in plus in import vs existente
        const updatedF: string[] = []
        const updateData: any = {}
        const fields: [string, string, string][] = [
          ['cnp', 'CNP', row.cnp],
          ['email', 'Email', row.email],
          ['phone', 'Telefon', row.phone],
          ['birth_date', 'Data nașterii', row.birth_date],
          ['address', 'Adresă', row.address],
          ['county', 'Județ', row.county],
          ['ci_series', 'Serie CI', row.ci_series],
          ['ci_number', 'Nr CI', row.ci_number],
        ]
        for (const [key, label, newVal] of fields) {
          if (newVal && !match[key]) {
            updateData[key] = newVal
            updatedF.push(label)
          }
        }
        if (Object.keys(updateData).length > 0) {
          await supabase.from('students').update(updateData).eq('id', match.id)
          report.updated++
          report.updatedFields.push({ name: match.full_name, fields: updatedF })
        } else {
          report.unchanged++
        }
      } else {
        // Cursant nou - insereaza
        orderCounter++
        await supabase.from('students').insert({
          session_id: selectedSession,
          full_name: row.full_name,
          cnp: row.cnp || null,
          email: row.email || null,
          phone: row.phone || null,
          birth_date: row.birth_date || null,
          ci_series: row.ci_series || null,
          ci_number: row.ci_number || null,
          address: row.address || null,
          county: row.county || null,
          class_caa: row.class_caa || defaultClass,
          order_in_session: orderCounter,
          portal_status: 'pending',
          original_session_id: selectedSession,
        })
        report.inserted++
      }
    }

    setImportReport(report)
    setImportedCount(report.inserted)
    setDone(true)
    setImporting(false)
  }

  const session = sessions.find(s => s.id === selectedSession)
  const inCls = "border border-blue-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"

  if (done) {
    return (
      <div className="p-8 max-w-2xl">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style={{ background: '#d1fae5' }}>
              <Check size={24} style={{ color: '#059669' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Import finalizat</h2>
              <p className="text-gray-500 text-sm">{session ? new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</p>
            </div>
          </div>

          {/* Raport */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-green-50 rounded-xl p-4 text-center border border-green-100">
              <div className="text-2xl font-bold text-green-700">{importReport?.inserted || 0}</div>
              <div className="text-xs text-green-600 mt-1">Cursanți noi adăugați</div>
            </div>
            <div className="bg-amber-50 rounded-xl p-4 text-center border border-amber-100">
              <div className="text-2xl font-bold text-amber-700">{importReport?.updated || 0}</div>
              <div className="text-xs text-amber-600 mt-1">Actualizați cu info noi</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center border border-gray-100">
              <div className="text-2xl font-bold text-gray-500">{importReport?.unchanged || 0}</div>
              <div className="text-xs text-gray-400 mt-1">Identici — nicio schimbare</div>
            </div>
          </div>

          {/* Detalii actualizari */}
          {importReport?.updatedFields && importReport.updatedFields.length > 0 && (
            <div className="mb-6">
              <div className="text-xs font-medium text-gray-500 mb-2">Câmpuri actualizate:</div>
              <div className="space-y-1.5 max-h-48 overflow-auto">
                {importReport.updatedFields.map((u, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs bg-amber-50 rounded-lg px-3 py-2">
                    <span className="font-medium text-gray-900">{u.name}</span>
                    <span className="text-gray-400">→</span>
                    <span className="text-amber-700">{u.fields.join(', ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => { setDone(false); setRows([]); setPasteText(''); setImportReport(null) }}
              className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
              Import nou
            </button>
            <Link href={`/admin/sesiuni/${selectedSession}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: '#0a1628' }}>
              Deschide sesiunea →
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/cursanti" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Import cursanți</h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Sesiunea de destinație</h3>
            {sessions.length === 0 ? (
              <div className="text-sm text-gray-400">Nicio sesiune. <Link href="/admin/sesiuni/nou" className="text-blue-600">Creează →</Link></div>
            ) : (
              <>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-3"
                  value={selectedSession}
                  onChange={e => { setSelectedSession(e.target.value); const s = sessions.find(s => s.id === e.target.value); if (s) setDefaultClass(s.class_caa || 'C,D') }}>
                  {sessions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })} — {s.locations?.name}
                    </option>
                  ))}
                </select>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Clasa implicită</div>
                  <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={defaultClass} onChange={e => setDefaultClass(e.target.value)}>
                    <option value="C">C</option><option value="D">D</option><option value="C,D">C și D</option>
                  </select>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Sursă date</h3>
            <div className="flex rounded-lg border border-gray-200 mb-4 overflow-hidden">
              <button onClick={() => setMode('paste')} className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'paste' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Lipire text</button>
              <button onClick={() => setMode('file')} className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'file' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>Fișier Excel</button>
            </div>

            {mode === 'paste' ? (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Copiați din Excel/email și lipiți. Detectează automat formatul cu CNP, email, telefon, dată naștere.
                </p>
                <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                  rows={10} placeholder={"Format 1: Nr\tNume Prenume\tCNP\tData nașterii\tEmail\t...\nFormat 2: \tNume Prenume\tCNP\tData nașterii\tEmail\t..."}
                  value={pasteText} onChange={e => setPasteText(e.target.value)} />
                <button onClick={handlePaste} disabled={!pasteText.trim()}
                  className="w-full mt-2 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                  style={{ background: '#1e3a6e' }}>
                  Procesează →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  Coloane Excel: <strong>Nume | CNP | Email | Telefon | Data nașterii | Serie CI | Nr CI | Adresă | Județ | Clasa</strong>
                </p>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                  <FileSpreadsheet size={24} className="text-gray-300 mb-2" />
                  <span className="text-xs text-gray-400">Click sau drag & drop</span>
                  <span className="text-xs text-gray-300 mt-0.5">.xlsx, .xls, .csv</span>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={handleFile} />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900">Previzualizare</span>
                {rows.length > 0 && <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{rows.length} cursanți</span>}
              </div>
              <div className="flex gap-2">
                {rows.length > 0 && (
                  <>
                    <button onClick={addEmptyRow} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-100 hover:bg-blue-50">+ Rând nou</button>
                    <button onClick={() => setRows([])} className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> Șterge tot</button>
                  </>
                )}
              </div>
            </div>

            {rows.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Upload size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Lipiți date sau încărcați un fișier.</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto max-h-[500px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50 z-10">
                      <tr className="border-b border-gray-100">
                        <th className="px-2 py-2.5 text-left font-medium text-gray-400 w-6">#</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Nume *</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">CNP</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Email</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Telefon</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Data nașterii</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Serie CI</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Nr CI</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Adresă</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500">Județ</th>
                        <th className="px-2 py-2.5 text-left font-medium text-gray-500 w-14">Clasa</th>
                        <th className="w-6"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className={!r.full_name ? 'bg-red-50' : 'hover:bg-gray-50'}>
                          <td className="px-2 py-1.5 text-gray-300">{i + 1}</td>
                          <td className="px-1 py-1.5"><input className={inCls + ' font-medium min-w-28'} value={r.full_name} onChange={e => updateRow(i, 'full_name', e.target.value.toUpperCase())} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' font-mono w-28'} value={r.cnp} onChange={e => updateRow(i, 'cnp', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' min-w-32'} value={r.email} onChange={e => updateRow(i, 'email', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' w-24'} value={r.phone} onChange={e => updateRow(i, 'phone', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' w-24'} value={r.birth_date} placeholder="dd.mm.yyyy" onChange={e => updateRow(i, 'birth_date', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' w-16'} value={r.ci_series} placeholder="AB" onChange={e => updateRow(i, 'ci_series', e.target.value.toUpperCase())} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' w-20'} value={r.ci_number} placeholder="123456" onChange={e => updateRow(i, 'ci_number', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' min-w-32'} value={r.address} onChange={e => updateRow(i, 'address', e.target.value)} /></td>
                          <td className="px-1 py-1.5"><input className={inCls + ' w-20'} value={r.county} onChange={e => updateRow(i, 'county', e.target.value)} /></td>
                          <td className="px-1 py-1.5">
                            <select className={inCls} value={r.class_caa} onChange={e => updateRow(i, 'class_caa', e.target.value)}>
                              <option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option>
                            </select>
                          </td>
                          <td className="px-1 py-1.5"><button onClick={() => removeRow(i)} className="text-red-300 hover:text-red-500"><Trash2 size={12} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <AlertCircle size={13} />
                    Editați datele direct în tabel înainte de import
                  </div>
                  <button onClick={doImport} disabled={importing || !selectedSession || rows.filter(r => r.full_name).length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: '#0a1628' }}>
                    <Upload size={14} />
                    {importing ? 'Se importă...' : `Importă ${rows.filter(r => r.full_name).length} cursanți`}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}