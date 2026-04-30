'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Users, Copy, Plus, Trash2, Check, X, Pencil, GitBranch, ArrowRight } from 'lucide-react'

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Ciornă', color: '#6b7280' },
  active: { label: 'Activă', color: '#d97706' },
  completed: { label: 'Finalizată', color: '#059669' },
}

const portalMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Neconectat', color: '#9ca3af' },
  signed: { label: 'Semnat', color: '#059669' },
  absent: { label: 'Absent', color: '#ef4444' },
}

type Student = {
  id: string
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
  portal_status: string
  order_in_session: number
  signed_at: string
}

const EMPTY_STUDENT = {
  full_name: '', cnp: '', email: '', phone: '',
  birth_date: '', ci_series: '', ci_number: '',
  address: '', county: '', class_caa: 'C,D'
}

function StudentsTable({
  sessionId,
  students,
  setStudents,
  cloneId,
  cloneStudents,
  setCloneStudents,
  isClone = false,
}: {
  sessionId: string
  students: Student[]
  setStudents: (s: Student[]) => void
  cloneId?: string
  cloneStudents?: Student[]
  setCloneStudents?: (s: Student[]) => void
  isClone?: boolean
}) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState<any>(EMPTY_STUDENT)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<string | null>(null)

  async function removeStudent(sid: string) {
    if (!confirm('Ștergi cursantul?')) return
    await supabase.from('students').delete().eq('id', sid)
    const remaining = students.filter(s => s.id !== sid)
    const reordered = remaining.map((s, i) => ({ ...s, order_in_session: i + 1 }))
    setStudents(reordered)
    for (const s of reordered) {
      await supabase.from('students').update({ order_in_session: s.order_in_session }).eq('id', s.id)
    }
  }

  async function moveToClone(s: Student) {
    if (!cloneId || !cloneStudents || !setCloneStudents) return
    setMoving(s.id)
    const maxOrder = cloneStudents.reduce((m, cs) => Math.max(m, cs.order_in_session || 0), 0)
    // Adauga la clona
    const { data: newSt } = await supabase.from('students').insert({
      session_id: cloneId,
      full_name: s.full_name, cnp: s.cnp, email: s.email, phone: s.phone,
      birth_date: s.birth_date, ci_series: s.ci_series, ci_number: s.ci_number,
      address: s.address, county: s.county, class_caa: s.class_caa,
      id_document: s.ci_series && s.ci_number ? `${s.ci_series} ${s.ci_number}` : '',
      order_in_session: maxOrder + 1, portal_status: 'pending',
    }).select().single()
    if (newSt) setCloneStudents([...cloneStudents, newSt as Student])
    // Sterge din sesiunea curenta
    await supabase.from('students').delete().eq('id', s.id)
    const remaining = students.filter(st => st.id !== s.id)
    const reordered = remaining.map((st, i) => ({ ...st, order_in_session: i + 1 }))
    setStudents(reordered)
    for (const st of reordered) {
      await supabase.from('students').update({ order_in_session: st.order_in_session }).eq('id', st.id)
    }
    setMoving(null)
  }

  async function moveToParent(s: Student, parentId: string, parentStudents: Student[], setParentStudents: (s: Student[]) => void) {
    setMoving(s.id)
    const maxOrder = parentStudents.reduce((m, ps) => Math.max(m, ps.order_in_session || 0), 0)
    const { data: newSt } = await supabase.from('students').insert({
      session_id: parentId,
      full_name: s.full_name, cnp: s.cnp, email: s.email, phone: s.phone,
      birth_date: s.birth_date, ci_series: s.ci_series, ci_number: s.ci_number,
      address: s.address, county: s.county, class_caa: s.class_caa,
      id_document: s.ci_series && s.ci_number ? `${s.ci_series} ${s.ci_number}` : '',
      order_in_session: maxOrder + 1, portal_status: 'pending',
    }).select().single()
    if (newSt) setParentStudents([...parentStudents, newSt as Student])
    await supabase.from('students').delete().eq('id', s.id)
    const remaining = students.filter(st => st.id !== s.id)
    const reordered = remaining.map((st, i) => ({ ...st, order_in_session: i + 1 }))
    setStudents(reordered)
    for (const st of reordered) {
      await supabase.from('students').update({ order_in_session: st.order_in_session }).eq('id', st.id)
    }
    setMoving(null)
  }

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditValues({
      full_name: s.full_name || '', cnp: s.cnp || '', email: s.email || '',
      phone: s.phone || '', birth_date: s.birth_date || '',
      ci_series: s.ci_series || '', ci_number: s.ci_number || '',
      address: s.address || '', county: s.county || '', class_caa: s.class_caa || 'C,D',
    })
  }

  async function saveEdit(sid: string) {
    setSaving(true)
    const { data } = await supabase.from('students')
      .update({ ...editValues, full_name: editValues.full_name.toUpperCase() })
      .eq('id', sid).select().single()
    if (data) setStudents(students.map(s => s.id === sid ? data as Student : s))
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  async function addStudent() {
    if (!newStudent.full_name) return
    setAdding(true)
    const maxOrder = students.reduce((m, s) => Math.max(m, s.order_in_session || 0), 0)
    const { data } = await supabase.from('students').insert({
      ...newStudent,
      full_name: newStudent.full_name.toUpperCase(),
      session_id: sessionId,
      order_in_session: maxOrder + 1,
      portal_status: 'pending'
    }).select().single()
    if (data) setStudents([...students, data as Student])
    setNewStudent(EMPTY_STUDENT)
    setShowAddForm(false)
    setAdding(false)
  }

  const inCls = "border border-blue-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
  const addCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400" />
          <span className="font-semibold text-sm text-gray-900">Cursanți ({students.length})</span>
        </div>
        <button onClick={() => { setShowAddForm(true); setEditingId(null) }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
          <Plus size={12} /> Adaugă
        </button>
      </div>

      {showAddForm && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/40">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="col-span-2">
              <div className="text-xs text-gray-400 mb-1">Nume complet *</div>
              <input className={addCls} placeholder="POPESCU ION" value={newStudent.full_name}
                onChange={e => setNewStudent((s: any) => ({ ...s, full_name: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">CNP</div>
              <input className={addCls} placeholder="1800101..." value={newStudent.cnp}
                onChange={e => setNewStudent((s: any) => ({ ...s, cnp: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Clasa</div>
              <select className={addCls} value={newStudent.class_caa}
                onChange={e => setNewStudent((s: any) => ({ ...s, class_caa: e.target.value }))}>
                <option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option>
              </select>
            </div>
            <div className="col-span-2">
              <div className="text-xs text-gray-400 mb-1">Email</div>
              <input className={addCls} placeholder="email@..." value={newStudent.email}
                onChange={e => setNewStudent((s: any) => ({ ...s, email: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Telefon</div>
              <input className={addCls} placeholder="07XX..." value={newStudent.phone}
                onChange={e => setNewStudent((s: any) => ({ ...s, phone: e.target.value }))} />
            </div>
            <div>
              <div className="text-xs text-gray-400 mb-1">Data nașterii</div>
              <input className={addCls} placeholder="dd.mm.yyyy" value={newStudent.birth_date}
                onChange={e => setNewStudent((s: any) => ({ ...s, birth_date: e.target.value }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowAddForm(false); setNewStudent(EMPTY_STUDENT) }}
              className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
              <X size={12} className="inline" /> Anulează
            </button>
            <button onClick={addStudent} disabled={adding}
              className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
              style={{ background: '#0a1628' }}>
              <span className="flex items-center gap-1"><Check size={12} />{adding ? 'Se adaugă...' : 'Adaugă cursant'}</span>
            </button>
          </div>
        </div>
      )}

      {students.length === 0 ? (
        <div className="p-10 text-center text-gray-400 text-sm">Niciun cursant.</div>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-3 py-2.5 font-medium text-gray-400 w-6">#</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Nume</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">CNP</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Email</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Telefon</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">CI</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Clasa</th>
                <th className="text-left px-3 py-2.5 font-medium text-gray-500">Portal</th>
                <th className="w-24"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((s, i) => {
                const ps = portalMap[s.portal_status] || portalMap.pending
                const isEditing = editingId === s.id
                return (
                  <tr key={s.id} className={isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50 transition-colors'}>
                    <td className="px-3 py-2 text-gray-300">{i + 1}</td>
                    {isEditing ? (
                      <>
                        <td className="px-1 py-1.5"><input className={inCls + ' font-medium min-w-28'} value={editValues.full_name} onChange={e => setEditValues((v: any) => ({ ...v, full_name: e.target.value.toUpperCase() }))} /></td>
                        <td className="px-1 py-1.5"><input className={inCls + ' font-mono w-28'} value={editValues.cnp} onChange={e => setEditValues((v: any) => ({ ...v, cnp: e.target.value }))} /></td>
                        <td className="px-1 py-1.5"><input className={inCls + ' min-w-32'} value={editValues.email} onChange={e => setEditValues((v: any) => ({ ...v, email: e.target.value }))} /></td>
                        <td className="px-1 py-1.5"><input className={inCls + ' w-24'} value={editValues.phone} onChange={e => setEditValues((v: any) => ({ ...v, phone: e.target.value }))} /></td>
                        <td className="px-1 py-1.5">
                          <div className="flex gap-1">
                            <input className={inCls + ' w-12'} placeholder="AB" value={editValues.ci_series} onChange={e => setEditValues((v: any) => ({ ...v, ci_series: e.target.value.toUpperCase() }))} />
                            <input className={inCls + ' w-16'} placeholder="123456" value={editValues.ci_number} onChange={e => setEditValues((v: any) => ({ ...v, ci_number: e.target.value }))} />
                          </div>
                        </td>
                        <td className="px-1 py-1.5">
                          <select className={inCls} value={editValues.class_caa} onChange={e => setEditValues((v: any) => ({ ...v, class_caa: e.target.value }))}>
                            <option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option>
                          </select>
                        </td>
                        <td className="px-1 py-1.5"><span className="text-xs" style={{ color: ps.color }}>{ps.label}</span></td>
                        <td className="px-2 py-1.5">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(s.id)} disabled={saving} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Check size={12} /></button>
                            <button onClick={() => setEditingId(null)} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={12} /></button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-3 py-2 font-medium text-gray-900">{s.full_name}</td>
                        <td className="px-3 py-2 font-mono text-gray-400">{s.cnp || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{s.email || '—'}</td>
                        <td className="px-3 py-2 text-gray-500">{s.phone || '—'}</td>
                        <td className="px-3 py-2">
                          {s.ci_series && s.ci_number ? (
                            <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                              {s.ci_series} {s.ci_number}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-xs" style={{ background: '#fee2e2', color: '#991b1b' }}>lipsă</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{s.class_caa}</td>
                        <td className="px-3 py-2">
                          <span className="text-xs font-medium" style={{ color: ps.color }}>{ps.label}</span>
                          {s.signed_at && <div className="text-gray-300 text-xs">{new Date(s.signed_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</div>}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex gap-1">
                            {/* Buton Muta la clona (din principal) */}
                            {!isClone && cloneId && (
                              <button
                                onClick={() => moveToClone(s)}
                                disabled={moving === s.id}
                                className="p-1.5 rounded border border-blue-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Mută la clonă">
                                {moving === s.id ? '...' : <ArrowRight size={12} />}
                              </button>
                            )}
                            {/* Buton Muta la principal (din clona) */}
                            {isClone && cloneStudents !== undefined && setCloneStudents && (
                              <button
                                onClick={() => moveToParent(s, sessionId, cloneStudents, setCloneStudents)}
                                disabled={moving === s.id}
                                className="p-1.5 rounded border border-purple-100 text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                                title="Mută înapoi la sesiunea principală">
                                {moving === s.id ? '...' : <ArrowLeft size={12} />}
                              </button>
                            )}
                            <button onClick={() => startEdit(s)} className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"><Pencil size={12} /></button>
                            <button onClick={() => removeStudent(s.id)} className="p-1.5 rounded border border-gray-100 text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors"><Trash2 size={12} /></button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string }
  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [clone, setClone] = useState<any>(null)
  const [cloneStudents, setCloneStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generatingPV, setGeneratingPV] = useState(false)
  const [generatingFise, setGeneratingFise] = useState(false)
  const [generatingPDF, setGeneratingPDF] = useState(false)

  async function load() {
    const [{ data: s }, { data: sts }] = await Promise.all([
      supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', id).single(),
      supabase.from('students').select('*').eq('session_id', id).order('order_in_session'),
    ])
    setSession(s)
    setStudents((sts || []) as Student[])

    // Cauta clona acestei sesiuni
    const { data: cloneSession } = await supabase
      .from('sessions')
      .select('*, locations(*), boats(*), evaluators(*), instructors(*)')
      .eq('parent_session_id', id)
      .eq('is_clone', true)
      .single()

    if (cloneSession) {
      setClone(cloneSession)
      const { data: cloneSts } = await supabase
        .from('students').select('*')
        .eq('session_id', cloneSession.id)
        .order('order_in_session')
      setCloneStudents((cloneSts || []) as Student[])
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function copyPortalLink(s: any) {
    navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${s.access_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function setStatus(sid: string, status: string) {
    await supabase.from('sessions').update({ status }).eq('id', sid)
    if (sid === id) setSession((s: any) => ({ ...s, status }))
    else if (clone && sid === clone.id) setClone((s: any) => ({ ...s, status }))
  }

  async function generateDoc(endpoint: string, filename: string, sid: string) {
    const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sid }) })
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = filename
    a.click()
  }

  function SessionCard({ sess, sts, setSts, isCloneCard = false }: { sess: any, sts: Student[], setSts: (s: Student[]) => void, isCloneCard?: boolean }) {
    const st = statusMap[sess.status] || statusMap.draft
    const signedCount = sts.filter(s => s.portal_status === 'signed').length
    const [copiedLocal, setCopiedLocal] = useState(false)
    const [gPV, setGPV] = useState(false)
    const [gFise, setGFise] = useState(false)
    const [gPDF, setGPDF] = useState(false)

    return (
      <div className="grid grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Detalii sesiune</h3>
            <div className="space-y-2">
              {[
                ['Instructor', sess.instructors?.full_name],
                ['Evaluator ANR', sess.evaluators?.full_name],
                ['Decizie ANR', sess.evaluators?.decision_number],
                ['Ambarcațiune', sess.boats?.name || '—'],
                ['Clasa CAA', sess.class_caa],
                ['Nr. solicitare', sess.request_number || '—'],
                ['Locație detaliată', sess.location_detail || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-gray-400 text-xs shrink-0">{label}</span>
                  <span className="text-gray-900 text-xs text-right font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Link portal</h3>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">
              /portal?cod=<strong>{sess.access_code}</strong>
            </div>
            <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${sess.access_code}`); setCopiedLocal(true); setTimeout(() => setCopiedLocal(false), 2000) }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
              <Copy size={12} />{copiedLocal ? '✓ Copiat!' : 'Copiază link'}
            </button>
            <div className="mt-3 text-xs text-gray-400 text-center">{signedCount}/{sts.length} cursanți au semnat</div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Documente</h3>
            <div className="space-y-2">
              <button onClick={async () => { setGPV(true); try { await generateDoc('/api/generate-pv', `PV_${sess.session_date}.docx`, sess.id) } catch(e: any) { alert(e.message) } setGPV(false) }}
                disabled={gPV || sts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#0a1628' }}>
                <FileText size={13} />{gPV ? 'Se generează...' : 'Proces Verbal (Anexa 12)'}
              </button>
              <button onClick={async () => { setGFise(true); try { await generateDoc('/api/generate-fise', `Fise_${sess.session_date}.docx`, sess.id) } catch(e: any) { alert(e.message) } setGFise(false) }}
                disabled={gFise || sts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                <Download size={13} />{gFise ? 'Se generează...' : 'Fișe DOCX (Anexa 10)'}
              </button>
              <button onClick={async () => { setGPDF(true); try {
                const res = await fetch('/api/generate-fise-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: sess.id }) })
                const isPdfFallback = res.headers.get('X-Pdf-Fallback') === 'true'
                const blob = await res.blob()
                const url = URL.createObjectURL(blob)
                if (isPdfFallback) { const win = window.open(url, '_blank'); if (win) win.onload = () => win.print() }
                else { const a = document.createElement('a'); a.href = url; a.download = `Fise_${sess.session_date}.pdf`; a.click() }
              } catch(e: any) { alert(e.message) } setGPDF(false) }}
                disabled={gPDF || sts.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Download size={13} />{gPDF ? 'Se generează...' : 'Fișe PDF cu semnături'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Câmpurile de evaluare rămân goale pentru completare manuală.</p>
          </div>
        </div>

        {/* Tabel cursanti */}
        <div className="col-span-2">
          <StudentsTable
            sessionId={sess.id}
            students={sts}
            setStudents={setSts}
            cloneId={isCloneCard ? undefined : clone?.id}
            cloneStudents={isCloneCard ? students : cloneStudents}
            setCloneStudents={isCloneCard ? setStudents : setCloneStudents}
            isClone={isCloneCard}
          />
        </div>
      </div>
    )
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>
  if (!session) return <div className="p-8 text-center text-gray-400">Sesiunea nu a fost găsită.</div>

  const st = statusMap[session.status] || statusMap.draft

  return (
    <div className="p-8">
      {/* Header sesiune principala */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sesiuni" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20} /></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
              {new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: st.color + '20', color: st.color }}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{session.locations?.name}, {session.locations?.county}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/sesiuni/${id}/clone`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
            <GitBranch size={12} /> {clone ? 'Vezi/Editează clona' : 'Clonează'}
          </Link>
          {session.status !== 'active' && (
            <button onClick={() => setStatus(id, 'active')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">→ Activează</button>
          )}
          {session.status !== 'completed' && (
            <button onClick={() => setStatus(id, 'completed')} className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">✓ Finalizează</button>
          )}
        </div>
      </div>

      {/* Sesiunea principala */}
      <SessionCard sess={session} sts={students} setSts={setStudents} isCloneCard={false} />

      {/* Clona - daca exista */}
      {clone && (
        <>
          {/* Separator */}
          <div className="my-8 flex items-center gap-4">
            <div className="flex-1 border-t-2 border-dashed border-blue-200" />
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200">
              <GitBranch size={14} className="text-blue-500" />
              <span className="text-sm font-medium text-blue-700">
                Clonă — {new Date(clone.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                {' · '}{clone.locations?.name}
                {' · '}{clone.boats?.name}
              </span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium ml-2"
                style={{ background: (statusMap[clone.status]?.color || '#6b7280') + '20', color: statusMap[clone.status]?.color || '#6b7280' }}>
                {statusMap[clone.status]?.label || 'Ciornă'}
              </span>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-blue-200" />
          </div>

          {/* Butoane clona */}
          <div className="flex justify-end gap-2 mb-4">
            {clone.status !== 'active' && (
              <button onClick={() => setStatus(clone.id, 'active')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">→ Activează clona</button>
            )}
            {clone.status !== 'completed' && (
              <button onClick={() => setStatus(clone.id, 'completed')} className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">✓ Finalizează clona</button>
            )}
          </div>

          {/* Continut clona */}
          <SessionCard sess={clone} sts={cloneStudents} setSts={setCloneStudents} isCloneCard={true} />
        </>
      )}
    </div>
  )
}