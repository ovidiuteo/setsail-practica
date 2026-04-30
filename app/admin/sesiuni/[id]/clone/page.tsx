'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Copy, ChevronRight, ChevronLeft, Check, Users } from 'lucide-react'

export default function CloneSessionPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  const [original, setOriginal] = useState<any>(null)
  const [refs, setRefs] = useState({ locations: [], boats: [], evaluators: [], instructors: [] } as any)
  const [form, setForm] = useState({
    session_date: '',
    location_id: '',
    boat_id: '',
    evaluator_id: '',
    instructor_id: '',
    class_caa: 'C,D',
    status: 'draft',
    notes: '',
    location_detail: '',
  })

  // Cursanți din sesiunea originală
  const [allStudents, setAllStudents] = useState<any[]>([])
  // Cursanți alocați la clonă
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: s }, { data: sts }, loc, boat, ev, instr] = await Promise.all([
        supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', id).single(),
        supabase.from('students').select('*').eq('session_id', id).order('order_in_session'),
        supabase.from('locations').select('*').order('name'),
        supabase.from('boats').select('*').order('name'),
        supabase.from('evaluators').select('*').order('full_name'),
        supabase.from('instructors').select('*').order('full_name'),
      ])
      setOriginal(s)
      setAllStudents(sts || [])
      // Pre-selectează toți cursanții
      setSelectedIds(new Set((sts || []).map((st: any) => st.id)))
      setRefs({ locations: loc.data || [], boats: boat.data || [], evaluators: ev.data || [], instructors: instr.data || [] })
      // Pre-completează formularul cu datele originale
      if (s) {
        setForm({
          session_date: s.session_date,
          location_id: s.location_id || '',
          boat_id: s.boat_id || '',
          evaluator_id: s.evaluator_id || '',
          instructor_id: s.instructor_id || '',
          class_caa: s.class_caa || 'C,D',
          status: 'draft',
          notes: s.notes || '',
          location_detail: s.location_detail || '',
        })
      }
      setLoading(false)
    }
    load()
  }, [id])

  function toggleStudent(sid: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(sid)) next.delete(sid)
      else next.add(sid)
      return next
    })
  }

  function selectAll() { setSelectedIds(new Set(allStudents.map(s => s.id))) }
  function selectNone() { setSelectedIds(new Set()) }

  async function createClone() {
    if (!form.session_date || !form.location_id || !form.evaluator_id || !form.instructor_id) {
      alert('Completează data, locația, evaluatorul și instructorul.')
      return
    }
    if (selectedIds.size === 0) {
      alert('Selectează cel puțin un cursant.')
      return
    }
    setSaving(true)

    // Creează sesiunea clonată
    const { data: newSession, error } = await supabase.from('sessions').insert({
      ...form,
      parent_session_id: id,
      is_clone: true,
    }).select().single()

    if (error || !newSession) {
      alert('Eroare la creare: ' + error?.message)
      setSaving(false)
      return
    }

    // Copiază cursanții selectați în noua sesiune
    const studentsToClone = allStudents
      .filter(s => selectedIds.has(s.id))
      .map((s, i) => ({
        session_id: newSession.id,
        full_name: s.full_name,
        cnp: s.cnp,
        email: s.email,
        phone: s.phone,
        birth_date: s.birth_date,
        ci_series: s.ci_series,
        ci_number: s.ci_number,
        address: s.address,
        county: s.county,
        class_caa: s.class_caa,
        id_document: s.id_document,
        order_in_session: i + 1,
        portal_status: 'pending',
      }))

    await supabase.from('students').insert(studentsToClone)

    router.push(`/admin/sesiuni/${newSession.id}`)
  }

  const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
  const labelCls = "block text-xs font-medium text-gray-500 mb-1.5"

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>

  return (
    <div className="p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link href={`/admin/sesiuni/${id}`} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Clonează sesiunea
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Original: {original && new Date(original.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })} — {original?.locations?.name}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Stânga: Formularul sesiunii noi */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <Copy size={16} className="text-gray-400" />
            <h2 className="font-semibold text-gray-900">Detalii sesiune nouă</h2>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Data *</label>
                <input type="date" className={inputCls} value={form.session_date}
                  onChange={e => setForm(f => ({ ...f, session_date: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>Clasa CAA</label>
                <select className={inputCls} value={form.class_caa}
                  onChange={e => setForm(f => ({ ...f, class_caa: e.target.value }))}>
                  <option value="C">C</option>
                  <option value="D">D</option>
                  <option value="C,D">C și D</option>
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Locație *</label>
              <select className={inputCls} value={form.location_id}
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

            <div>
              <label className={labelCls}>Locație detaliată</label>
              <input className={inputCls} value={form.location_detail}
                onChange={e => setForm(f => ({ ...f, location_detail: e.target.value }))}
                placeholder={refs.locations.find((l: any) => l.id === form.location_id)?.location_detail || 'ex: Lac Snagov – complex Delta Snagov, strada Nicolae Grigorescu, sat Izvorani, comuna Ciolpani'} />
            </div>
            <div>
              <label className={labelCls}>Ambarcațiune</label>
              <select className={inputCls} value={form.boat_id}
                onChange={e => setForm(f => ({ ...f, boat_id: e.target.value }))}>
                <option value="">— Selectează —</option>
                {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Evaluator ANR *</label>
              <select className={inputCls} value={form.evaluator_id}
                onChange={e => setForm(f => ({ ...f, evaluator_id: e.target.value }))}>
                <option value="">— Selectează —</option>
                {refs.evaluators.map((e: any) => <option key={e.id} value={e.id}>{e.full_name} — {e.title}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Instructor SetSail *</label>
              <select className={inputCls} value={form.instructor_id}
                onChange={e => setForm(f => ({ ...f, instructor_id: e.target.value }))}>
                <option value="">— Selectează —</option>
                {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
              </select>
            </div>

            <div>
              <label className={labelCls}>Observații</label>
              <textarea className={inputCls} rows={2} value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="A doua zi, altă barcă, etc." />
            </div>
          </div>
        </div>

        {/* Dreapta: Selectare cursanți */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-gray-400" />
              <span className="font-semibold text-gray-900">
                Cursanți ({selectedIds.size}/{allStudents.length} selectați)
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded border border-blue-100 hover:bg-blue-50">
                Toți
              </button>
              <button onClick={selectNone} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded border border-gray-200 hover:bg-gray-50">
                Niciunul
              </button>
            </div>
          </div>

          <div className="divide-y divide-gray-50 max-h-96 overflow-y-auto">
            {allStudents.map(s => {
              const isSelected = selectedIds.has(s.id)
              return (
                <div key={s.id}
                  onClick={() => toggleStudent(s.id)}
                  className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}>
                  <div className={`w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all ${isSelected ? 'bg-blue-600' : 'border-2 border-gray-200'}`}>
                    {isSelected && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{s.full_name}</div>
                    <div className="text-xs text-gray-400 mt-0.5 flex gap-3">
                      {s.cnp && <span className="font-mono">{s.cnp}</span>}
                      {s.email && <span>{s.email}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{s.class_caa}</span>
                </div>
              )
            })}
          </div>

          {/* Info */}
          <div className="p-4 border-t border-gray-100 bg-amber-50/50">
            <p className="text-xs text-amber-700">
              💡 Cursanții selectați vor fi copiați în sesiunea nouă. Datele lor (CI, adresă, semnătură) se copiază automat — nu trebuie să se logheze din nou pe portal.
            </p>
          </div>
        </div>
      </div>

      {/* Buton creare */}
      <div className="mt-6 flex items-center justify-between">
        <Link href={`/admin/sesiuni/${id}`} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
          ← Înapoi la sesiunea originală
        </Link>
        <button onClick={createClone} disabled={saving || selectedIds.size === 0}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity hover:opacity-90"
          style={{ background: '#0a1628' }}>
          <Copy size={15} />
          {saving ? 'Se creează...' : `Creează sesiunea cu ${selectedIds.size} cursanți`}
        </button>
      </div>
    </div>
  )
}