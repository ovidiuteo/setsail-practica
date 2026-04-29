'use client'
import { useEffect, useState } from 'react'
import { supabase, Student } from '@/lib/supabase'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Users, Copy, Plus, Trash2, Edit2, Check, X } from 'lucide-react'

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

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const [session, setSession] = useState<any>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [generatingPV, setGeneratingPV] = useState(false)
  const [generatingFise, setGeneratingFise] = useState(false)
  const [newStudent, setNewStudent] = useState({ full_name: '', cnp: '', email: '', id_document: '', class_caa: 'C,D' })
  const [adding, setAdding] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  async function load() {
    const [{ data: s }, { data: sts }] = await Promise.all([
      supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', id).single(),
      supabase.from('students').select('*').eq('session_id', id).order('order_in_session'),
    ])
    setSession(s)
    setStudents(sts || [])
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
      ...newStudent, session_id: id, order_in_session: maxOrder + 1
    }).select().single()
    if (data) setStudents(ss => [...ss, data as Student])
    setNewStudent({ full_name: '', cnp: '', email: '', id_document: '', class_caa: session?.class_caa || 'C,D' })
    setShowAddForm(false)
    setAdding(false)
  }

  async function removeStudent(sid: string) {
    if (!confirm('Ștergi cursantul?')) return
    await supabase.from('students').delete().eq('id', sid)
    setStudents(ss => ss.filter(s => s.id !== sid))
  }

  async function generatePV() {
    setGeneratingPV(true)
    try {
      const res = await fetch('/api/generate-pv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id })
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `PV_Practic_${session?.session_date}_${session?.locations?.name}.docx`
      a.click()
    } catch (e: any) {
      alert('Eroare la generare: ' + e.message)
    }
    setGeneratingPV(false)
  }

  async function generateFise() {
    setGeneratingFise(true)
    try {
      const res = await fetch('/api/generate-fise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: id })
      })
      if (!res.ok) throw new Error(await res.text())
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Fise_Anexa10_${session?.session_date}.zip`
      a.click()
    } catch (e: any) {
      alert('Eroare la generare: ' + e.message)
    }
    setGeneratingFise(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>
  if (!session) return <div className="p-8 text-center text-gray-400">Sesiunea nu a fost găsită.</div>

  const st = statusMap[session.status] || statusMap.draft
  const signedCount = students.filter(s => s.portal_status === 'signed').length
  const inputCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"

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
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: st.color + '20', color: st.color }}>
              {st.label}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{session.locations?.name}, {session.locations?.county}</p>
        </div>
        <div className="flex gap-2">
          {session.status !== 'active' && (
            <button onClick={() => setStatus('active')}
              className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">
              → Activează
            </button>
          )}
          {session.status !== 'completed' && (
            <button onClick={() => setStatus('completed')}
              className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">
              ✓ Finalizează
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left: Info + Portal */}
        <div className="space-y-4">
          {/* Session info */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Detalii sesiune</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Instructor</span>
                <span className="text-gray-900 font-medium text-right">{session.instructors?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Evaluator ANR</span>
                <span className="text-gray-900 font-medium text-right text-xs">{session.evaluators?.full_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Decizie ANR</span>
                <span className="text-gray-900 font-mono text-xs">{session.evaluators?.decision_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Ambarcațiune</span>
                <span className="text-gray-900">{session.boats?.name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Clasa CAA</span>
                <span className="text-gray-900 font-medium">{session.class_caa}</span>
              </div>
            </div>
          </div>

          {/* Portal link */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Link portal cursanți</h3>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">
              /portal?cod=<strong>{session.access_code}</strong>
            </div>
            <button onClick={copyPortalLink}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 transition-colors">
              <Copy size={12} />
              {copied ? '✓ Copiat!' : 'Copiază link complet'}
            </button>
            <div className="mt-3 text-xs text-gray-400 text-center">
              {signedCount}/{students.length} cursanți au semnat
            </div>
          </div>

          {/* Generate docs */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Documente</h3>
            <div className="space-y-2">
              <button onClick={generatePV} disabled={generatingPV || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-opacity hover:opacity-90"
                style={{ background: '#0a1628' }}
              >
                <FileText size={13} />
                {generatingPV ? 'Se generează...' : 'Proces Verbal (Anexa 12)'}
              </button>
              <button onClick={generateFise} disabled={generatingFise || students.length === 0}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50"
              >
                <Download size={13} />
                {generatingFise ? 'Se generează...' : 'Fișe individuale (Anexa 10)'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3 text-center">
              Documentele se descarcă completate cu datele sesiunii. Câmpurile de evaluare rămân goale pentru completare manuală.
            </p>
          </div>
        </div>

        {/* Right: Students table */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={16} className="text-gray-400" />
                <span className="font-semibold text-sm text-gray-900">Cursanți ({students.length})</span>
              </div>
              <button onClick={() => setShowAddForm(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
                <Plus size={12} /> Adaugă
              </button>
            </div>

            {showAddForm && (
              <div className="p-4 border-b border-blue-50 bg-blue-50/50 flex gap-2 items-end flex-wrap">
                <div className="flex-1 min-w-32">
                  <div className="text-xs text-gray-500 mb-1">Nume complet *</div>
                  <input className={inputCls + ' w-full'} value={newStudent.full_name} placeholder="POPESCU ION"
                    onChange={e => setNewStudent(s => ({ ...s, full_name: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">CNP</div>
                  <input className={inputCls} value={newStudent.cnp} placeholder="1800101..."
                    onChange={e => setNewStudent(s => ({ ...s, cnp: e.target.value }))} style={{ width: 130 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Email</div>
                  <input className={inputCls} value={newStudent.email} placeholder="email@..."
                    onChange={e => setNewStudent(s => ({ ...s, email: e.target.value }))} style={{ width: 150 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Serie CI</div>
                  <input className={inputCls} value={newStudent.id_document} placeholder="AB123456"
                    onChange={e => setNewStudent(s => ({ ...s, id_document: e.target.value }))} style={{ width: 90 }} />
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Clasa</div>
                  <select className={inputCls} value={newStudent.class_caa}
                    onChange={e => setNewStudent(s => ({ ...s, class_caa: e.target.value }))}>
                    <option>C</option><option>D</option><option value="C,D">C,D</option>
                  </select>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={addStudent} disabled={adding}
                    className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200"><Check size={14} /></button>
                  <button onClick={() => setShowAddForm(false)}
                    className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={14} /></button>
                </div>
              </div>
            )}

            {students.length === 0 ? (
              <div className="p-10 text-center text-gray-400 text-sm">
                Niciun cursant adăugat. Importați din Excel la crearea sesiunii sau adăugați manual.
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-gray-500">
                      <th className="text-left px-3 py-2.5 font-medium w-8">#</th>
                      <th className="text-left px-3 py-2.5 font-medium">Nume și prenume</th>
                      <th className="text-left px-3 py-2.5 font-medium">CNP</th>
                      <th className="text-left px-3 py-2.5 font-medium">CI</th>
                      <th className="text-left px-3 py-2.5 font-medium">Clasa</th>
                      <th className="text-left px-3 py-2.5 font-medium">Portal</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {students.map((s, i) => {
                      const ps = portalMap[s.portal_status] || portalMap.pending
                      return (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2.5 text-gray-400">{s.order_in_session || i + 1}</td>
                          <td className="px-3 py-2.5 font-medium text-gray-900">{s.full_name}</td>
                          <td className="px-3 py-2.5 font-mono text-gray-500">{s.cnp}</td>
                          <td className="px-3 py-2.5 text-gray-500">{s.id_document}</td>
                          <td className="px-3 py-2.5 text-gray-500">{s.class_caa}</td>
                          <td className="px-3 py-2.5">
                            <span className="px-2 py-0.5 rounded-full text-xs" style={{ background: ps.color + '20', color: ps.color }}>
                              {ps.label}
                            </span>
                          </td>
                          <td className="px-2 py-2.5">
                            <button onClick={() => removeStudent(s.id)} className="text-red-300 hover:text-red-500">
                              <Trash2 size={13} />
                            </button>
                          </td>
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
