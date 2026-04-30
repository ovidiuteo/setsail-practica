'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Upload } from 'lucide-react'
import Link from 'next/link'

export default function NouaSesiunePage() {
  const router = useRouter()
  const [refs, setRefs] = useState({ locations: [], boats: [], evaluators: [], instructors: [] } as any)
  const [form, setForm] = useState({
    session_date: new Date().toISOString().split('T')[0],
    location_id: '', boat_id: '', evaluator_id: '', instructor_id: '',
    class_caa: 'C,D', status: 'draft', notes: '', request_number: '',
    location_detail: ''
  })
  const [csvText, setCsvText] = useState('')
  const [students, setStudents] = useState<{ full_name: string; cnp: string; email: string; id_document: string; class_caa: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [loc, boat, ev, instr] = await Promise.all([
        supabase.from('locations').select('*').order('name'),
        supabase.from('boats').select('*').order('name'),
        supabase.from('evaluators').select('*').order('full_name'),
        supabase.from('instructors').select('*').order('full_name'),
      ])
      setRefs({ locations: loc.data || [], boats: boat.data || [], evaluators: ev.data || [], instructors: instr.data || [] })
    }
    load()
  }, [])

  function parseExcel(text: string) {
    const lines = text.trim().split('\n').filter(Boolean)
    const parsed = lines.map((line, i) => {
      const parts = line.split('\t')
      return {
        full_name: (parts[0] || '').trim(),
        cnp: (parts[1] || '').trim(),
        email: (parts[2] || '').trim(),
        id_document: (parts[3] || '').trim(),
        class_caa: (parts[4] || form.class_caa).trim() || form.class_caa,
      }
    }).filter(s => s.full_name)
    setStudents(parsed)
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    setCsvText(text)
    parseExcel(text)
  }

  async function save() {
    setError('')
    if (!form.session_date || !form.location_id || !form.evaluator_id || !form.instructor_id) {
      setError('Completează câmpurile obligatorii: dată, locație, evaluator, instructor.')
      return
    }
    setSaving(true)
    const { data, error: err } = await supabase.from('sessions').insert(form).select().single()
    if (err || !data) { setError(err?.message || 'Eroare la salvare.'); setSaving(false); return }

    if (students.length > 0) {
      const rows = students.map((s, i) => ({ ...s, session_id: data.id, order_in_session: i + 1 }))
      await supabase.from('students').insert(rows)
    }

    router.push(`/admin/sesiuni/${data.id}`)
  }

  const inputClass = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const labelClass = "block text-xs font-medium text-gray-600 mb-1.5"

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sesiuni" className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
          Sesiune nouă
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Data sesiunii *</label>
            <input type="date" className={inputClass} value={form.session_date}
              onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} />
          </div>
          <div>
            <label className={labelClass}>Clasa CAA *</label>
            <select className={inputClass} value={form.class_caa}
              onChange={e => setForm(f => ({ ...f, class_caa: e.target.value }))}>
              <option value="A">A</option>
              <option value="B">B</option>
              <option value="C">C</option>
              <option value="D">D</option>
              <option value="C,D">C și D</option>
              <option value="Radio">Radio</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Locație *</label>
            <select className={inputClass} value={form.location_id}
              onChange={e => {
                const locId = e.target.value
                const loc = refs.locations.find((l: any) => l.id === locId)
                const defaultDetail = loc ? (loc.county ? loc.name + ', jud. ' + loc.county : loc.name) : ''
                setForm(f => ({ ...f, location_id: locId, location_detail: defaultDetail }))
              }}>
              <option value="">— Selectează —</option>
              {refs.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}, {l.county}</option>)}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Locație detaliată</label>
            <input className={inputClass} value={form.location_detail}
              onChange={e => setForm(f => ({ ...f, location_detail: e.target.value }))}
              placeholder={refs.locations.find((l: any) => l.id === form.location_id)?.location_detail || 'ex: Lac Snagov – complex Delta Snagov, strada Nicolae Grigorescu, sat Izvorani, comuna Ciolpani'} />
          </div>
          <div>
            <label className={labelClass}>Ambarcațiune</label>
            <select className={inputClass} value={form.boat_id}
              onChange={e => setForm(f => ({ ...f, boat_id: e.target.value }))}>
              <option value="">— Selectează —</option>
              {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Evaluator ANR *</label>
            <select className={inputClass} value={form.evaluator_id}
              onChange={e => setForm(f => ({ ...f, evaluator_id: e.target.value }))}>
              <option value="">— Selectează —</option>
              {refs.evaluators.map((e: any) => <option key={e.id} value={e.id}>{e.full_name} — {e.title}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Instructor SetSail *</label>
            <select className={inputClass} value={form.instructor_id}
              onChange={e => setForm(f => ({ ...f, instructor_id: e.target.value }))}>
              <option value="">— Selectează —</option>
              {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Observații</label>
          <textarea className={inputClass} rows={2} value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            placeholder="Condiții meteo, alte observații..." />
        </div>

        {/* Import cursanti */}
        <div className="border-t pt-5">
          <div className="flex items-center gap-2 mb-3">
            <Upload size={16} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Import cursanți (opțional)</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">
            Fișier TSV/CSV sau copiază din Excel: coloane <strong>Nume Prenume | CNP | Email | Serie CI | Clasa</strong>
          </p>
          <input type="file" accept=".txt,.csv,.tsv" onChange={handleFile}
            className="text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer" />

          {students.length > 0 && (
            <div className="mt-3 rounded-lg border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-600 border-b border-gray-100">
                {students.length} cursanți detectați
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                {students.map((s, i) => (
                  <div key={i} className="px-3 py-2 flex items-center gap-4 text-xs">
                    <span className="text-gray-400 w-5">{i + 1}</span>
                    <span className="font-medium text-gray-900 flex-1">{s.full_name}</span>
                    <span className="text-gray-400 font-mono">{s.cnp}</span>
                    <span className="text-gray-400">{s.email}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/admin/sesiuni" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            Anulează
          </Link>
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ background: '#0a1628' }}
          >
            {saving ? 'Se salvează...' : 'Creează sesiunea'}
          </button>
        </div>
      </div>
    </div>
  )
}