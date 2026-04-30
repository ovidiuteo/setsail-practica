'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Copy, ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react'

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Ciornă', color: '#6b7280' },
  active: { label: 'Activă', color: '#d97706' },
  completed: { label: 'Finalizată', color: '#059669' },
}

export default function SesiuniPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [refs, setRefs] = useState({ locations: [], boats: [], evaluators: [], instructors: [] } as any)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: s }, loc, boat, ev, instr] = await Promise.all([
      supabase.from('sessions').select('*, locations(name, county), evaluators(full_name), instructors(full_name), boats(name)').eq('session_type', 'principal').order('session_date', { ascending: false }),
      supabase.from('locations').select('*').order('name'),
      supabase.from('boats').select('*').order('name'),
      supabase.from('evaluators').select('*').order('full_name'),
      supabase.from('instructors').select('*').order('full_name'),
    ])
    setSessions(s || [])
    setRefs({ locations: loc.data || [], boats: boat.data || [], evaluators: ev.data || [], instructors: instr.data || [] })
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSession(id: string) {
    if (!confirm('Ștergi sesiunea și toți cursanții asociați?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(ss => ss.filter(s => s.id !== id))
  }

  function copyCode(code: string) {
    const url = `${window.location.origin}/portal?cod=${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEdit(s: any) {
    setEditingId(s.id)
    setEditValues({
      session_date: s.session_date,
      location_id: s.location_id,
      boat_id: s.boat_id || '',
      evaluator_id: s.evaluator_id,
      instructor_id: s.instructor_id,
      class_caa: s.class_caa,
      status: s.status,
      notes: s.notes || '',
      request_number: s.request_number || '',
      location_detail: s.location_detail || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    const { data } = await supabase.from('sessions')
      .update(editValues)
      .eq('id', id)
      .select('*, locations(name, county), evaluators(full_name), instructors(full_name), boats(name)')
      .single()
    if (data) setSessions(ss => ss.map(s => s.id === id ? data : s))
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  const selectCls = "border border-blue-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
  const inputCls = "border border-blue-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Sesiuni Practică
          </h1>
          <p className="text-gray-500 text-sm mt-1">{sessions.length} sesiuni</p>
        </div>
        <Link href="/admin/sesiuni/nou"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#0a1628' }}
        >
          <Plus size={16} /> Sesiune nouă
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Se încarcă...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-3">Nicio sesiune creată.</p>
          <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">Creează prima sesiune →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => {
            const st = statusMap[s.status] || statusMap.draft
            const isEditing = editingId === s.id

            return (
              <div key={s.id} className={`bg-white rounded-xl shadow-sm border transition-colors ${isEditing ? 'border-blue-200' : 'border-gray-100'}`}>
                {isEditing ? (
                  /* Edit mode */
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Data</div>
                        <input type="date" className={inputCls + ' w-full'}
                          value={editValues.session_date}
                          onChange={e => setEditValues((v: any) => ({ ...v, session_date: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Clasa CAA</div>
                          <select className={selectCls + ' w-full'} value={editValues.class_caa}
                          onChange={e => setEditValues((v: any) => ({ ...v, class_caa: e.target.value }))}>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="C,D">C și D</option>
                          <option value="Radio">Radio</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Status</div>
                        <select className={selectCls + ' w-full'} value={editValues.status}
                          onChange={e => setEditValues((v: any) => ({ ...v, status: e.target.value }))}>
                          <option value="draft">Ciornă</option>
                          <option value="active">Activă</option>
                          <option value="completed">Finalizată</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Locație</div>
                        <select className={selectCls + ' w-full'} value={editValues.location_id}
                          onChange={e => {
                            const locId = e.target.value
                            const loc = refs.locations.find((l: any) => l.id === locId)
                            const defaultDetail = loc ? `${loc.name}, jud. ${loc.county}` : ''
                            setEditValues((v: any) => ({ ...v, location_id: locId, location_detail: defaultDetail }))
                          }}>
                          <option value="">— Selectează —</option>
                          {refs.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}, {l.county}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Ambarcațiune</div>
                        <select className={selectCls + ' w-full'} value={editValues.boat_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, boat_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Evaluator ANR</div>
                        <select className={selectCls + ' w-full'} value={editValues.evaluator_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, evaluator_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.evaluators.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 mb-1">Instructor SetSail</div>
                        <select className={selectCls + ' w-full'} value={editValues.instructor_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, instructor_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Locație detaliată</div>
                        <input className={inputCls + ' w-full'} value={editValues.location_detail}
                          onChange={e => setEditValues((v: any) => ({ ...v, location_detail: e.target.value }))}
                          placeholder={refs.locations.find((l: any) => l.id === editValues.location_id)?.location_detail || 'ex: Lac Snagov – complex Delta Snagov, strada Nicolae Grigorescu, sat Izvorani, comuna Ciolpani'} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Nr. solicitare furnizor</div>
                        <input className={inputCls + ' w-full'} value={editValues.request_number}
                          onChange={e => setEditValues((v: any) => ({ ...v, request_number: e.target.value }))}
                          placeholder="ex: 16/ 23.08.2024" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Observații</div>
                        <input className={inputCls + ' w-full'} value={editValues.notes}
                          onChange={e => setEditValues((v: any) => ({ ...v, notes: e.target.value }))}
                          placeholder="Condiții meteo, etc." />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={cancelEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
                        <X size={12} /> Anulează
                      </button>
                      <button onClick={() => saveEdit(s.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: '#059669' }}>
                        <Check size={12} /> {saving ? 'Se salvează...' : 'Salvează'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">
                          {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <div className="relative group">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: st.color + '15', color: st.color }}>
                          {st.label} ▾
                        </span>
                        <div className="absolute left-0 top-6 z-50 hidden group-hover:flex flex-col bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-32">
                          {(['draft','active','focus','completed'] as const).map(sv => (
                            <button key={sv} onClick={async(e)=>{e.stopPropagation();await supabase.from('sessions').update({status:sv}).eq('id',s.id);setSessions(ss=>ss.map(x=>x.id===s.id?{...x,status:sv}:x))}}
                              className="px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors font-medium"
                              style={{color:{draft:'#6b7280',active:'#d97706',focus:'#7c3aed',completed:'#059669'}[sv]}}>
                              {{draft:'Ciornă',active:'Activă',focus:'Focus',completed:'Finalizată'}[sv]}
                            </button>
                          ))}
                        </div>
                      </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Clasa {s.class_caa}</span>
                      {s.is_clone && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Clonă</span>}
                      </div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>📍 {s.locations?.name}, {s.locations?.county}</span>
                        <span>⛵ {s.boats?.name || '—'}</span>
                        <span>👤 {s.instructors?.full_name || '—'}</span>
                        <span>🏛️ {s.evaluators?.full_name || '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button onClick={() => copyCode(s.access_code)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-200 hover:bg-gray-50 transition-colors"
                        title="Copiază link portal">
                        <Copy size={12} />
                        {copied === s.access_code ? '✓ Copiat!' : s.access_code}
                      </button>
                      <button onClick={() => startEdit(s)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Editează sesiunea">
                        <Pencil size={14} />
                      </button>
                      <Link href={`/admin/sesiuni/${s.id}`}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
                        title="Deschide sesiunea">
                        <ExternalLink size={14} />
                      </Link>
                      <button onClick={() => deleteSession(s.id)}
                        className="p-2 rounded-lg border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title="Șterge sesiunea">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}