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
  id: string; full_name: string; cnp: string; email: string; phone: string
  birth_date: string; ci_series: string; ci_number: string; address: string
  county: string; class_caa: string; portal_status: string
  order_in_session: number; signed_at: string; session_id: string
}
const EMPTY_ST = { full_name: '', cnp: '', email: '', phone: '', birth_date: '', ci_series: '', ci_number: '', address: '', county: '', class_caa: 'C,D' }

function StudentsTable({ sess, students, setStudents, otherSessionId, otherStudents, setOtherStudents, isClone }:
  { sess: any, students: Student[], setStudents: (s:Student[])=>void, otherSessionId?:string, otherStudents?:Student[], setOtherStudents?:(s:Student[])=>void, isClone:boolean }) {

  const [editingId, setEditingId] = useState<string|null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newSt, setNewSt] = useState<any>(EMPTY_ST)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<string|null>(null)

  async function reorder(list: Student[], sessionId: string) {
    const reordered = list.map((s,i) => ({...s, order_in_session: i+1}))
    for (const s of reordered) {
      await supabase.from('students').update({order_in_session: s.order_in_session}).eq('id', s.id)
    }
    return reordered
  }

  async function deleteStudent(sid: string) {
    if (!confirm('Ștergi definitiv cursantul din baza de date?')) return
    await supabase.from('students').delete().eq('id', sid)
    const remaining = students.filter(s => s.id !== sid)
    const reordered = await reorder(remaining, sess.id)
    setStudents(reordered)
  }

  async function moveStudent(s: Student) {
    if (!otherSessionId || !otherStudents || !setOtherStudents) return
    setMoving(s.id)
    // Schimba session_id - muta cursantul in cealalta sesiune
    const maxOrder = otherStudents.reduce((m,os) => Math.max(m, os.order_in_session||0), 0)
    await supabase.from('students').update({
      session_id: otherSessionId,
      order_in_session: maxOrder + 1
    }).eq('id', s.id)
    // Scoate din lista curenta, renumeroteaza
    const remaining = students.filter(st => st.id !== s.id)
    const reordered = await reorder(remaining, sess.id)
    setStudents(reordered)
    // Adauga in cealalta lista
    setOtherStudents([...otherStudents, {...s, session_id: otherSessionId, order_in_session: maxOrder+1}])
    setMoving(null)
  }

  function startEdit(s: Student) {
    setEditingId(s.id)
    setEditValues({ full_name: s.full_name||'', cnp: s.cnp||'', email: s.email||'', phone: s.phone||'', birth_date: s.birth_date||'', ci_series: s.ci_series||'', ci_number: s.ci_number||'', address: s.address||'', county: s.county||'', class_caa: s.class_caa||'C,D' })
  }

  async function saveEdit(sid: string) {
    setSaving(true)
    const { data } = await supabase.from('students').update({...editValues, full_name: editValues.full_name.toUpperCase()}).eq('id', sid).select().single()
    if (data) setStudents(students.map(s => s.id === sid ? data as Student : s))
    setEditingId(null); setEditValues({}); setSaving(false)
  }

  async function addStudent() {
    if (!newSt.full_name) return
    setAdding(true)
    const maxOrder = students.reduce((m,s) => Math.max(m, s.order_in_session||0), 0)
    const { data } = await supabase.from('students').insert({
      ...newSt, full_name: newSt.full_name.toUpperCase(),
      session_id: sess.id, original_session_id: sess.id,
      order_in_session: maxOrder+1, portal_status: 'pending'
    }).select().single()
    if (data) setStudents([...students, data as Student])
    setNewSt(EMPTY_ST); setShowAdd(false); setAdding(false)
  }

  const inCls = "border border-blue-100 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white w-full"
  const addCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full"
  const moveLabel = isClone ? '← Principal' : '→ Clonă'
  const moveCls = isClone
    ? "p-1.5 rounded border border-purple-100 text-purple-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
    : "p-1.5 rounded border border-blue-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400"/>
          <span className="font-semibold text-sm text-gray-900">Cursanți ({students.length})</span>
        </div>
        <button onClick={() => {setShowAdd(true); setEditingId(null)}}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
          <Plus size={12}/> Adaugă
        </button>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/40">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="col-span-2"><div className="text-xs text-gray-400 mb-1">Nume complet *</div>
              <input className={addCls} placeholder="POPESCU ION" value={newSt.full_name} onChange={e => setNewSt((s:any)=>({...s, full_name: e.target.value.toUpperCase()}))} /></div>
            <div><div className="text-xs text-gray-400 mb-1">CNP</div>
              <input className={addCls} placeholder="1800101..." value={newSt.cnp} onChange={e => setNewSt((s:any)=>({...s, cnp: e.target.value}))} /></div>
            <div><div className="text-xs text-gray-400 mb-1">Clasa</div>
              <select className={addCls} value={newSt.class_caa} onChange={e => setNewSt((s:any)=>({...s, class_caa: e.target.value}))}>
                <option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option>
              </select></div>
            <div className="col-span-2"><div className="text-xs text-gray-400 mb-1">Email</div>
              <input className={addCls} placeholder="email@..." value={newSt.email} onChange={e => setNewSt((s:any)=>({...s, email: e.target.value}))} /></div>
            <div><div className="text-xs text-gray-400 mb-1">Telefon</div>
              <input className={addCls} placeholder="07XX..." value={newSt.phone} onChange={e => setNewSt((s:any)=>({...s, phone: e.target.value}))} /></div>
            <div><div className="text-xs text-gray-400 mb-1">Data nașterii</div>
              <input className={addCls} placeholder="dd.mm.yyyy" value={newSt.birth_date} onChange={e => setNewSt((s:any)=>({...s, birth_date: e.target.value}))} /></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => {setShowAdd(false); setNewSt(EMPTY_ST)}} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50"><X size={12} className="inline"/> Anulează</button>
            <button onClick={addStudent} disabled={adding} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#0a1628'}}>
              <span className="flex items-center gap-1"><Check size={12}/>{adding ? 'Se adaugă...' : 'Adaugă'}</span>
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
                <th className="w-28"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {students.map((s,i) => {
                const ps = portalMap[s.portal_status] || portalMap.pending
                const isEditing = editingId === s.id
                return (
                  <tr key={s.id} className={isEditing ? 'bg-blue-50/40' : 'hover:bg-gray-50 transition-colors'}>
                    <td className="px-3 py-2 text-gray-300">{i+1}</td>
                    {isEditing ? (<>
                      <td className="px-1 py-1.5"><input className={inCls+' font-medium min-w-28'} value={editValues.full_name} onChange={e=>setEditValues((v:any)=>({...v,full_name:e.target.value.toUpperCase()}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' font-mono w-28'} value={editValues.cnp} onChange={e=>setEditValues((v:any)=>({...v,cnp:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' min-w-32'} value={editValues.email} onChange={e=>setEditValues((v:any)=>({...v,email:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' w-24'} value={editValues.phone} onChange={e=>setEditValues((v:any)=>({...v,phone:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><div className="flex gap-1">
                        <input className={inCls+' w-12'} placeholder="AB" value={editValues.ci_series} onChange={e=>setEditValues((v:any)=>({...v,ci_series:e.target.value.toUpperCase()}))}/>
                        <input className={inCls+' w-16'} placeholder="123456" value={editValues.ci_number} onChange={e=>setEditValues((v:any)=>({...v,ci_number:e.target.value}))}/>
                      </div></td>
                      <td className="px-1 py-1.5"><select className={inCls} value={editValues.class_caa} onChange={e=>setEditValues((v:any)=>({...v,class_caa:e.target.value}))}>
                        <option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option></select></td>
                      <td className="px-1 py-1.5"><span className="text-xs" style={{color:ps.color}}>{ps.label}</span></td>
                      <td className="px-2 py-1.5"><div className="flex gap-1">
                        <button onClick={()=>saveEdit(s.id)} disabled={saving} className="p-1 rounded bg-green-100 text-green-700 hover:bg-green-200"><Check size={12}/></button>
                        <button onClick={()=>setEditingId(null)} className="p-1 rounded bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={12}/></button>
                      </div></td>
                    </>) : (<>
                      <td className="px-3 py-2 font-medium text-gray-900">{s.full_name}</td>
                      <td className="px-3 py-2 font-mono text-gray-400">{s.cnp||'—'}</td>
                      <td className="px-3 py-2 text-gray-500">{s.email||'—'}</td>
                      <td className="px-3 py-2 text-gray-500">{s.phone||'—'}</td>
                      <td className="px-3 py-2">
                        {s.ci_series && s.ci_number
                          ? <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold" style={{background:'#dcfce7',color:'#166534'}}>{s.ci_series} {s.ci_number}</span>
                          : <span className="px-2 py-0.5 rounded text-xs" style={{background:'#fee2e2',color:'#991b1b'}}>lipsă</span>}
                      </td>
                      <td className="px-3 py-2 text-gray-500">{s.class_caa}</td>
                      <td className="px-3 py-2">
                        <span className="text-xs font-medium" style={{color:ps.color}}>{ps.label}</span>
                        {s.signed_at && <div className="text-gray-300 text-xs">{new Date(s.signed_at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</div>}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1">
                          {otherSessionId && (
                            <button onClick={()=>moveStudent(s)} disabled={moving===s.id} className={moveCls} title={moveLabel}>
                              {moving===s.id ? <span className="text-xs">...</span> : <ArrowRight size={12}/>}
                            </button>
                          )}
                          <button onClick={()=>startEdit(s)} className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors"><Pencil size={12}/></button>
                          <button onClick={()=>deleteStudent(s.id)} className="p-1.5 rounded border border-gray-100 text-red-300 hover:text-red-500 hover:bg-red-50 transition-colors" title="Șterge definitiv"><Trash2 size={12}/></button>
                        </div>
                      </td>
                    </>)}
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

function SidebarCard({ sess, students, onStatusChange }: { sess: any, students: Student[], onStatusChange: (id:string,status:string)=>void }) {
  const [gPV, setGPV] = useState(false)
  const [gFise, setGFise] = useState(false)
  const [gPDF, setGPDF] = useState(false)
  const [copied, setCopied] = useState(false)

  async function generateDoc(endpoint: string, filename: string) {
    const res = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({session_id: sess.id}) })
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Detalii sesiune</h3>
        <div className="space-y-2">
          {([
            ['Instructor', sess.instructors?.full_name],
            ['Evaluator ANR', sess.evaluators?.full_name],
            ['Decizie ANR', sess.evaluators?.decision_number],
            ['Ambarcațiune', sess.boats?.name||'—'],
            ['Clasa CAA', sess.class_caa],
            ['Nr. solicitare', sess.request_number||'—'],
            ['Locație detaliată', sess.location_detail||'—'],
          ] as [string,string][]).map(([label,value]) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-gray-400 text-xs shrink-0">{label}</span>
              <span className="text-gray-900 text-xs text-right font-medium">{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Link portal</h3>
        <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">/portal?cod=<strong>{sess.access_code}</strong></div>
        <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${sess.access_code}`); setCopied(true); setTimeout(()=>setCopied(false),2000) }}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
          <Copy size={12}/>{copied ? '✓ Copiat!' : 'Copiază link'}
        </button>
        <div className="mt-3 text-xs text-gray-400 text-center">{students.filter(s=>s.portal_status==='signed').length}/{students.length} cursanți au semnat</div>
      </div>

      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Documente</h3>
        <div className="space-y-2">
          <button onClick={async()=>{setGPV(true);try{await generateDoc('/api/generate-pv',`PV_${sess.session_date}.docx`)}catch(e:any){alert(e.message)}setGPV(false)}}
            disabled={gPV||students.length===0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#0a1628'}}>
            <FileText size={13}/>{gPV?'Se generează...':'Proces Verbal (Anexa 12)'}
          </button>
          <button onClick={async()=>{setGFise(true);try{await generateDoc('/api/generate-fise',`Fise_${sess.session_date}.docx`)}catch(e:any){alert(e.message)}setGFise(false)}}
            disabled={gFise||students.length===0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
            <Download size={13}/>{gFise?'Se generează...':'Fișe DOCX (Anexa 10)'}
          </button>
          <button onClick={async()=>{setGPDF(true);try{
            const res=await fetch('/api/generate-fise-pdf',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id})})
            const isPdfFallback=res.headers.get('X-Pdf-Fallback')==='true'
            const blob=await res.blob(); const url=URL.createObjectURL(blob)
            if(isPdfFallback){const win=window.open(url,'_blank');if(win)win.onload=()=>win.print()}
            else{const a=document.createElement('a');a.href=url;a.download=`Fise_${sess.session_date}.pdf`;a.click()}
          }catch(e:any){alert(e.message)}setGPDF(false)}}
            disabled={gPDF||students.length===0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-50">
            <Download size={13}/>{gPDF?'Se generează...':'Fișe PDF cu semnături'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3 text-center">Câmpurile de evaluare rămân goale pentru completare manuală.</p>
      </div>
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

  async function load() {
    const [{ data: s }, { data: sts }] = await Promise.all([
      supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', id).single(),
      supabase.from('students').select('*').eq('session_id', id).order('order_in_session'),
    ])
    setSession(s); setStudents((sts||[]) as Student[])

    const { data: cloneSess } = await supabase
      .from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)')
      .eq('parent_session_id', id).eq('is_clone', true).maybeSingle()
    if (cloneSess) {
      setClone(cloneSess)
      const { data: cloneSts } = await supabase.from('students').select('*').eq('session_id', cloneSess.id).order('order_in_session')
      setCloneStudents((cloneSts||[]) as Student[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function setStatus(sid: string, status: string) {
    await supabase.from('sessions').update({ status }).eq('id', sid)
    if (sid === id) setSession((s:any) => ({...s, status}))
    else setClone((s:any) => ({...s, status}))
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>
  if (!session) return <div className="p-8 text-center text-gray-400">Sesiunea nu a fost găsită.</div>

  const st = statusMap[session.status] || statusMap.draft

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sesiuni" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20}/></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily:'Georgia, serif'}}>
              {new Date(session.session_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'})}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{background:st.color+'20',color:st.color}}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{session.locations?.name}, {session.locations?.county}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/admin/sesiuni/${id}/clone`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
            <GitBranch size={12}/> {clone ? 'Editează clona' : 'Clonează'}
          </Link>
          {session.status !== 'active' && <button onClick={()=>setStatus(id,'active')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">→ Activează</button>}
          {session.status !== 'completed' && <button onClick={()=>setStatus(id,'completed')} className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">✓ Finalizează</button>}
        </div>
      </div>

      {/* Sesiunea principala */}
      <div className="grid grid-cols-3 gap-6">
        <SidebarCard sess={session} students={students} onStatusChange={setStatus} />
        <div className="col-span-2">
          <StudentsTable
            sess={session} students={students} setStudents={setStudents}
            otherSessionId={clone?.id} otherStudents={cloneStudents} setOtherStudents={setCloneStudents}
            isClone={false}
          />
        </div>
      </div>

      {/* Clona */}
      {clone && (<>
        <div className="my-8 flex items-center gap-4">
          <div className="flex-1 border-t-2 border-dashed border-blue-200"/>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 border border-blue-200">
            <GitBranch size={14} className="text-blue-500"/>
            <span className="text-sm font-medium text-blue-700">
              Clonă — {new Date(clone.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}
              {' · '}{clone.locations?.name}{' · '}{clone.boats?.name}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs font-medium ml-1"
              style={{background:(statusMap[clone.status]?.color||'#6b7280')+'20',color:statusMap[clone.status]?.color||'#6b7280'}}>
              {statusMap[clone.status]?.label||'Ciornă'}
            </span>
          </div>
          <div className="flex gap-2">
            {clone.status !== 'active' && <button onClick={()=>setStatus(clone.id,'active')} className="px-3 py-1.5 text-xs rounded-lg border border-amber-200 text-amber-700 hover:bg-amber-50">→ Activează</button>}
            {clone.status !== 'completed' && <button onClick={()=>setStatus(clone.id,'completed')} className="px-3 py-1.5 text-xs rounded-lg border border-green-200 text-green-700 hover:bg-green-50">✓ Finalizează</button>}
          </div>
          <div className="flex-1 border-t-2 border-dashed border-blue-200"/>
        </div>

        <div className="grid grid-cols-3 gap-6">
          <SidebarCard sess={clone} students={cloneStudents} onStatusChange={setStatus} />
          <div className="col-span-2">
            <StudentsTable
              sess={clone} students={cloneStudents} setStudents={setCloneStudents}
              otherSessionId={id} otherStudents={students} setOtherStudents={setStudents}
              isClone={true}
            />
          </div>
        </div>
      </>)}
    </div>
  )
}