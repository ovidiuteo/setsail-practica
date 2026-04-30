'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Users, Copy, Plus, Trash2, Check, X, Pencil, GitBranch } from 'lucide-react'

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

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string }
  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generatingPV, setGeneratingPV] = useState(false)
  const [generatingFise, setGeneratingFise] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newStudent, setNewStudent] = useState<any>(EMPTY_STUDENT)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)

  async function load() {
    const [{ data: s }, { data: sts }] = await Promise.all([
      supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', id).single(),
      supabase.from('students').select('*').eq('session_id', id).order('order_in_session'),
    ])
    setSession(s)
    setStudents((sts || []) as Student[])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  function copyPortalLink() {
    if (!session) return
    navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${session.access_code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function setStatus(status: string) {
    await supabase.from('sessions').update({ status }).eq('id', id)
    setSession((s: any) => ({ ...s, status }))
  }

  async function addStudent() {
    if (!newStudent.full_name) return
    setAdding(true)
    const maxOrder = students.reduce((m, s) => Math.max(m, s.order_in_session || 0), 0)
    const { data } = await supabase.from('students').insert({
      ...newStudent,
      full_name: newStudent.full_name.toUpperCase(),
      session_id: id,
      order_in_session: maxOrder + 1,
      portal_status: 'pending'
    }).select().single()
    if (data) setStudents(ss => [...ss, data as Student])
    setNewStudent(EMPTY_STUDENT)
    setShowAddForm(false)
    setAdding(false)
  }

  async function removeStudent(sid: string) {
    if (!confirm('Ștergi cursantul?')) return
    await supabase.from('students').delete().eq('id', sid)
    // Renumeroteaza dupa stergere
    const remaining = students.filter(s => s.id !== sid)
    const reordered = remaining.map((s, i) => ({ ...s, order_in_session: i + 1 }))
    setStudents(reordered)
    // Actualizeaza in baza de date
    for (const s of reordered) {
      await supabase.from('students').update({ order_in_session: s.order_in_session }).eq('id', s.id)
    }
  }

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditValues({
      full_name: s.full_name || '',
      cnp: s.cnp || '',
      email: s.email || '',
      phone: s.phone || '',
      birth_date: s.birth_date || '',
      ci_series: s.ci_series || '',
      ci_number: s.ci_number || '',
      address: s.address || '',
      county: s.county || '',
      class_caa: s.class_caa || 'C,D',
    })
  }

  async function saveEdit(sid: string) {
    setSaving(true)
    const { data } = await supabase.from('students')
      .update({ ...editValues, full_name: editValues.full_name.toUpperCase() })
      .eq('id', sid).select().single()
    if (data) setStudents(ss => ss.map(s => s.id === sid ? data as Student : s))
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  async function generatePV() {
    setGeneratingPV(true)
    try {
      const res = await fetch('/api/generate-pv', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: id }) })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `PV_Practic_${session?.session_date}_${session?.locations?.name}.docx`; a.click()
    } catch (e: any) { alert('Eroare: ' + e.message) }
    setGeneratingPV(false)
  }

  async function generateFise() {
    setGeneratingFise(true)
    try {
      const res = await fetch('/api/generate-fise', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: id }) })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
      a.download = `Fise_Anexa10_${session?.session_date}.docx`; a.click()
    } catch (e: any) { alert('Eroare: ' + e.message) }
    setGeneratingFise(false)
  }

  const [generatingPDF, setGeneratingPDF] = useState(false)
  async function generateFisePDF() {
    setGeneratingPDF(true)
    try {
      const res = await fetch('/api/generate-fise-pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session_id: id }) })
      if (!res.ok) throw new Error(await res.text())
      const isPdfFallback = res.headers.get('X-Pdf-Fallback') === 'true'
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (isPdfFallback) {
        // Deschide în tab nou pentru print manual
        const win = window.open(url, '_blank')
        if (win) { win.onload = () => { win.print() } }
      } else {
        const a = document.createElement('a'); a.href = url
        a.download = `Fise_Anexa10_${session?.session_date}.pdf`; a.click()
      }
    } catch (e: any) { alert('Eroare: ' + e.message) }
    setGeneratingPDF(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>
  if (!session) return <div className="p-8 text-center text-gray-400">Sesiunea nu a fost găsită.</div>

  const st = statusMap[session.status] || statusMap.draft
  const signedCount = students.filter(s => s.portal_status === 'signed').length
  const inCls = "border border-blue-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
  const addCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full"

  return (
    <div className="p-8">
      {/* Header */}
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
          {session.is_clone && session.parent_session_id && (
            <Link href={`/admin/sesiuni/${session.parent_session_id}`} className="text-xs text-blue-500 hover:underline mt-0.5 block">
              ↑ Sesiune originală
            </Link>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/sesiuni/${id}/clone`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
            <GitBranch size={12} /> Clonează
          </Link>
          {session.status !== 'active' && (
            <button onClick={() => setStatus('active')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">→ Activează</button>
          )}
          {session.status !== 'completed' && (
            <button onClick={() => setStatus('completed')} className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">✓ Finalizează</button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Detalii sesiune</h3>
            <div className="space-y-2 text-sm">
              {[
                ['Instructor', session.instructors?.full_name],
                ['Evaluator ANR', session.evaluators?.full_name],
                ['Decizie ANR', session.evaluators?.decision_number],
                ['Ambarcațiune', session.boats?.name || '—'],
                ['Clasa CAA', session.class_caa],
                ['Nr. solicitare', session.request_number || '—'],
                ['Locație detaliată', session.location_detail || '—'],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between gap-2">
                  <span className="text-gray-400 text-xs shrink-0">{label}</span>
                  <span className="text-gray-900 text-xs text-right font-medium">{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Link portal cursanți</h3>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">
              /portal?cod=<strong>{session.access_code}</strong>
            </div>
            <button onClick={copyPortalLink} className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
              <Copy size={12} />{copied ? '✓ Copiat!' : 'Copiază link complet'}
            </button>
            <div className="mt-3 text-xs text-gray-400 text-center">{signedCount}/{students.length} cursanți au semnat</div>
          </div>

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Documente</h3>
            <div className="space-y-2">
              <button onClick={generatePV} disabled={generatingPV || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#0a1628' }}>
                <FileText size={13} />{generatingPV ? 'Se generează...' : 'Proces Verbal (Anexa 12)'}
              </button>
              <button onClick={generateFise} disabled={generatingFise || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
                <Download size={13} />{generatingFise ? 'Se generează...' : 'Fișe DOCX (Anexa 10)'}
              </button>
              <button onClick={generateFisePDF} disabled={generatingPDF || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Download size={13} />{generatingPDF ? 'Se generează...' : 'Fișe PDF cu semnături'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">Câmpurile de evaluare rămân goale pentru completare manuală.</p>
          </div>
        </div>

        {/* Students table */}
        <div className="col-span-2">
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

            {/* Add form */}
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
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50"><X size={12} /> Anulează</button>
                  <button onClick={addStudent} disabled={adding}
                    className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#0a1628' }}>
                    <span className="flex items-center gap-1"><Check size={12} />{adding ? 'Se adaugă...' : 'Adaugă cursant'}</span>
                  </button>
                </div>
              </div>
            )}

            {students.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">Niciun cursant adăugat.</div>
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
                      <th className="w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, i) => {
                      const ps = portalMap[s.portal_status] || portalMap.pending
                      const isEditing = editingId === s.id
                      return (
                        <tr key={s.id} className={isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50 transition-colors'}>
                          <td className="px-3 py-2 text-gray-300">{s.order_in_session || i + 1}</td>
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
                              <td className="px-1 py-1.5">
                                <span className="text-gray-400 text-xs" style={{ color: ps.color }}>{ps.label}</span>
                              </td>
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
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-semibold" style={{ background: '#dcfce7', color: '#166534' }}>
                                    {s.ci_series} {s.ci_number}
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: '#fee2e2', color: '#991b1b' }}>
                                    lipsă
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2 text-gray-500">{s.class_caa}</td>
                              <td className="px-3 py-2">
                                <span className="text-xs font-medium" style={{ color: ps.color }}>{ps.label}</span>
                                {s.signed_at && <div className="text-gray-300 text-xs">{new Date(s.signed_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</div>}
                              </td>
                              <td className="px-2 py-2">
                                <div className="flex gap-1">
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
        </div>
      </div>
    </div>
  )
}