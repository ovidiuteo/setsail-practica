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
  id_document: string
  class_caa: string
  error?: string
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

  function parseText(text: string) {
    const lines = text.trim().split('\n').filter(l => l.trim())
    const parsed: StudentRow[] = []
    for (const line of lines) {
      // Support tab-separated (from Excel) or comma-separated
      const parts = line.includes('\t') ? line.split('\t') : line.split(',')
      const full_name = (parts[0] || '').trim()
      if (!full_name) continue
      parsed.push({
        full_name: full_name.toUpperCase(),
        cnp: (parts[1] || '').trim(),
        email: (parts[2] || '').trim(),
        id_document: (parts[3] || '').trim(),
        class_caa: (parts[4] || defaultClass).trim() || defaultClass,
      })
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

    // Handle .xlsx files using SheetJS
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      const XLSX = await import('xlsx')
      const buf = await file.arrayBuffer()
      const wb = XLSX.read(buf)
      const ws = wb.Sheets[wb.SheetNames[0]]
      const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      const parsed: StudentRow[] = []
      for (const row of data) {
        const full_name = String(row[0] || '').trim()
        if (!full_name || full_name.toLowerCase() === 'nume' || full_name.toLowerCase() === 'name') continue
        // Handle Excel date serial for CNP-like numbers
        const cnpRaw = row[1] !== undefined ? String(row[1]).replace(/\.0$/, '').trim() : ''
        parsed.push({
          full_name: full_name.toUpperCase(),
          cnp: cnpRaw,
          email: String(row[2] || '').trim(),
          id_document: String(row[3] || '').trim(),
          class_caa: String(row[4] || defaultClass).trim() || defaultClass,
        })
      }
      setRows(parsed)
    } else {
      // Plain text/CSV
      const text = await file.text()
      setRows(parseText(text))
    }
    // Reset file input
    if (fileRef.current) fileRef.current.value = ''
  }

  function updateRow(i: number, field: keyof StudentRow, value: string) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function removeRow(i: number) {
    setRows(rs => rs.filter((_, idx) => idx !== i))
  }

  async function doImport() {
    if (!selectedSession || rows.length === 0) return
    setImporting(true)

    // Get current max order
    const { data: existing } = await supabase
      .from('students')
      .select('order_in_session')
      .eq('session_id', selectedSession)
      .order('order_in_session', { ascending: false })
      .limit(1)
    const maxOrder = existing?.[0]?.order_in_session || 0

    const toInsert = rows
      .filter(r => r.full_name)
      .map((r, i) => ({
        session_id: selectedSession,
        full_name: r.full_name,
        cnp: r.cnp || null,
        email: r.email || null,
        id_document: r.id_document || null,
        class_caa: r.class_caa || defaultClass,
        order_in_session: maxOrder + i + 1,
        portal_status: 'pending',
      }))

    const { error } = await supabase.from('students').insert(toInsert)
    if (!error) {
      setImportedCount(toInsert.length)
      setDone(true)
    }
    setImporting(false)
  }

  const session = sessions.find(s => s.id === selectedSession)
  const inputCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full"

  if (done) {
    return (
      <div className="p-8 max-w-lg">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#d1fae5' }}>
            <Check size={32} style={{ color: '#059669' }} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import reușit!</h2>
          <p className="text-gray-500 mb-6">
            <span className="font-semibold text-gray-900">{importedCount} cursanți</span> au fost adăugați la sesiunea din{' '}
            <span className="font-semibold">{session ? new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : ''}</span>.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setDone(false); setRows([]); setPasteText('') }}
              className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">
              Import nou
            </button>
            <Link href={`/admin/sesiuni/${selectedSession}`}
              className="px-4 py-2 rounded-lg text-sm font-medium text-white"
              style={{ background: '#0a1628' }}>
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
        <Link href="/admin/cursanti" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
          Import cursanți
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Settings + Input */}
        <div className="space-y-4">
          {/* Session selector */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Sesiunea de destinație</h3>
            {sessions.length === 0 ? (
              <div className="text-sm text-gray-400">
                Nicio sesiune creată.{' '}
                <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline">Creează una →</Link>
              </div>
            ) : (
              <>
                <select
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white mb-3"
                  value={selectedSession}
                  onChange={e => {
                    setSelectedSession(e.target.value)
                    const s = sessions.find(s => s.id === e.target.value)
                    if (s) setDefaultClass(s.class_caa || 'C,D')
                  }}>
                  {sessions.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {' — '}{s.locations?.name}
                    </option>
                  ))}
                </select>
                <div>
                  <div className="text-xs text-gray-400 mb-1">Clasa implicită (dacă nu e specificată)</div>
                  <select
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={defaultClass}
                    onChange={e => setDefaultClass(e.target.value)}>
                    <option value="C">C</option>
                    <option value="D">D</option>
                    <option value="C,D">C și D</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Input method */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Sursă date</h3>

            <div className="flex rounded-lg border border-gray-200 mb-4 overflow-hidden">
              <button onClick={() => setMode('paste')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'paste' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Lipire text
              </button>
              <button onClick={() => setMode('file')}
                className={`flex-1 py-2 text-xs font-medium transition-colors ${mode === 'file' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
                Fișier Excel/CSV
              </button>
            </div>

            {mode === 'paste' ? (
              <div>
                <p className="text-xs text-gray-400 mb-2">
                  Copiați din Excel și lipiți aici. Coloane: <strong>Nume | CNP | Email | CI | Clasa</strong>
                </p>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white resize-none"
                  rows={8}
                  placeholder={'POPESCU ION\t1800101234567\t\n' +
                    'IONESCU MARIA\t2850202345678\tionescu@email.ro'}
                  value={pasteText}
                  onChange={e => setPasteText(e.target.value)}
                />
                <button onClick={handlePaste} disabled={!pasteText.trim()}
                  className="w-full mt-2 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-40 transition-opacity hover:opacity-90"
                  style={{ background: '#1e3a6e' }}>
                  Procesează text →
                </button>
              </div>
            ) : (
              <div>
                <p className="text-xs text-gray-400 mb-3">
                  Suportă <strong>.xlsx</strong>, <strong>.xls</strong>, <strong>.csv</strong>, <strong>.txt</strong>
                </p>
                <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-blue-300 hover:bg-blue-50/50 transition-colors">
                  <FileSpreadsheet size={24} className="text-gray-300 mb-2" />
                  <span className="text-xs text-gray-400">Click sau drag & drop</span>
                  <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,.txt,.tsv" className="hidden" onChange={handleFile} />
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Right: Preview table */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-gray-900">
                  Previzualizare
                </span>
                {rows.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {rows.length} cursanți
                  </span>
                )}
              </div>
              {rows.length > 0 && (
                <button onClick={() => setRows([])}
                  className="text-xs text-gray-400 hover:text-red-500 flex items-center gap-1">
                  <Trash2 size={12} /> Șterge tot
                </button>
              )}
            </div>

            {rows.length === 0 ? (
              <div className="p-12 text-center text-gray-400">
                <Upload size={32} className="mx-auto mb-3 text-gray-200" />
                <p className="text-sm">Lipiți date din Excel sau încărcați un fișier.</p>
                <p className="text-xs mt-1 text-gray-300">Coloane: Nume | CNP | Email | Serie CI | Clasa</p>
              </div>
            ) : (
              <>
                <div className="overflow-auto max-h-[460px]">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-8">#</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Nume și prenume *</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">CNP</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Email</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500">Serie CI</th>
                        <th className="text-left px-3 py-2.5 font-medium text-gray-500 w-20">Clasa</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {rows.map((r, i) => (
                        <tr key={i} className={`hover:bg-gray-50 ${!r.full_name ? 'bg-red-50' : ''}`}>
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td className="px-3 py-2">
                            <input className={inputCls + ' font-medium'} value={r.full_name}
                              onChange={e => updateRow(i, 'full_name', e.target.value.toUpperCase())} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputCls + ' font-mono'} value={r.cnp}
                              onChange={e => updateRow(i, 'cnp', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputCls} value={r.email}
                              onChange={e => updateRow(i, 'email', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <input className={inputCls} value={r.id_document}
                              onChange={e => updateRow(i, 'id_document', e.target.value)} />
                          </td>
                          <td className="px-3 py-2">
                            <select className={inputCls} value={r.class_caa}
                              onChange={e => updateRow(i, 'class_caa', e.target.value)}>
                              <option value="C">C</option>
                              <option value="D">D</option>
                              <option value="C,D">C,D</option>
                            </select>
                          </td>
                          <td className="px-2 py-2">
                            <button onClick={() => removeRow(i)}
                              className="text-red-300 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <AlertCircle size={13} />
                    Puteți edita datele direct în tabel înainte de import
                  </div>
                  <button onClick={doImport}
                    disabled={importing || !selectedSession || rows.filter(r => r.full_name).length === 0}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
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
