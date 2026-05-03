'use client'
import React, { useEffect, useState, useRef } from 'react'
import CIImageEditor from '@/components/CIImageEditor'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Users, Copy, Plus, Trash2, Check, X, Pencil, GitBranch, ArrowRight, UserX, Mail, ChevronDown } from 'lucide-react'

const statusMap: Record<string, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Ciornă',     color: '#6b7280', bg: '#6b728020' },
  active:    { label: 'Activă',     color: '#d97706', bg: '#d9770620' },
  completed: { label: 'Finalizată', color: '#059669', bg: '#05966920' },
  focus:     { label: 'Focus',      color: '#7c3aed', bg: '#7c3aed20' },
}
const portalMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'Neconectat', color: '#9ca3af' },
  signed:  { label: 'Semnat',     color: '#059669' },
  absent:  { label: 'Absent',     color: '#ef4444' },
}

type Student = {
  id: string; full_name: string; cnp: string; email: string; phone: string
  birth_date: string; ci_series: string; ci_number: string; ci_image_data: string
  address: string; county: string; city: string; country: string
  class_caa: string; portal_status: string; signed_at: string; session_id: string
  order_in_session: number; communication_target: boolean
  expiry_date: string; nationality: string; signature_data: string
  original_session_id: string; allocated_session_id: string
}
type Session = { id: string; session_date: string; status: string; session_type: string; access_code: string; class_caa: string; request_number?: string; location_detail?: string; parent_session_id?: string; is_clone?: boolean; locations?: any; boats?: any; evaluators?: any; instructors?: any }

const EMPTY_ST = { full_name:'', cnp:'', email:'', phone:'', birth_date:'', ci_series:'', ci_number:'', address:'', county:'', class_caa:'C,D' }


function CIAdminScan({ studentId, students, setStudents }: {
  studentId: string, students: any[], setStudents: (s: any[]) => void
}) {
  const [scanning, setScanning] = useState(false)
  const [done, setDone] = useState(false)
  const [pendingFile, setPendingFile] = useState<File|null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setPendingFile(file)
  }

  async function processFile(dataUrl: string, mediaType: string) {
    setScanning(true)
    try {
      const res = await fetch('/api/ocr-ci', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: dataUrl, mediaType: mediaType || 'image/jpeg' })
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data
        const updates: any = { ci_image_data: dataUrl }
        if (d.ci_series) updates.ci_series = d.ci_series
        if (d.ci_number) updates.ci_number = d.ci_number
        if (d.cnp) updates.cnp = d.cnp
        if (d.birth_date) updates.birth_date = d.birth_date
        if (d.address) updates.address = d.address
        if (d.county) updates.county = d.county
        if (d.expiry_date) updates.expiry_date = d.expiry_date
        if (d.city) updates.city = d.city
        if (d.country) updates.country = d.country
        if (d.last_name && d.first_name) updates.full_name = d.last_name.toUpperCase() + ' ' + d.first_name.toUpperCase()
        await supabase.from('students').update(updates).eq('id', studentId)
        setStudents(students.map(s => s.id === studentId ? {...s, ...updates} : s))
        setDone(true)
        setTimeout(() => setDone(false), 3000)
      }
    } catch (e) { console.error(e) }
    finally { setScanning(false) }
  }

  return (
    <>
      {pendingFile && (
        <CIImageEditor
          file={pendingFile}
          onConfirm={(dataUrl, mediaType) => { setPendingFile(null); processFile(dataUrl, mediaType) }}
          onCancel={() => setPendingFile(null)}
        />
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden"
        onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}/>
      <button onClick={()=>inputRef.current?.click()} disabled={scanning}
        title="Scan CI — completare automată date"
        className={`p-1.5 rounded border transition-colors text-xs ${done ? 'border-green-200 text-green-600 bg-green-50' : 'border-blue-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50'}`}>
        {scanning ? '⏳' : done ? '✓' : '🪪'}
      </button>
    </>
  )
}

function StudentsTable({ sess, students, setStudents, allSessions, allStudents, setAllStudents, isAbsent, onSelectionChange, selectedIds, setSelectedIds }:
  { sess: Session, students: Student[], setStudents:(s:Student[])=>void,
    allSessions: Session[], allStudents: Record<string,Student[]>, setAllStudents:(sid:string,s:Student[])=>void,
    isAbsent: boolean, onSelectionChange?: (emails: string[]) => void,
    selectedIds: Set<string>, setSelectedIds: (s: Set<string>) => void }) {

  const [editingId, setEditingId] = useState<string|null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newSt, setNewSt] = useState<any>(EMPTY_ST)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<string|null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState<string|null>(null)
  const [sortCol, setSortCol] = useState<string|null>(null)
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('asc')

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  function getSorted(list: Student[]) {
    if (!sortCol) return list
    return [...list].sort((a, b) => {
      const av = (a as any)[sortCol] || ''
      const bv = (b as any)[sortCol] || ''
      return sortDir === 'asc' ? av.localeCompare(bv, 'ro') : bv.localeCompare(av, 'ro')
    })
  }

  async function recount() {
    const sorted = getSorted(students)
    for (let i = 0; i < sorted.length; i++) {
      await supabase.from('students').update({ order_in_session: i + 1 }).eq('id', sorted[i].id)
    }
    setStudents(sorted.map((s, i) => ({ ...s, order_in_session: i + 1 })))
    setSortCol(null)
  }

  // Helper trunchere cu tooltip
  function T({ val, full }: { val?: string|null, full?: boolean }) {
    if (!val) return <span className="text-gray-300">—</span>
    const short = full ? val : (val.length > 5 ? val.slice(0, 5) + '…' : val)
    if (full || val.length <= 5) return <span>{val}</span>
    return <span title={val} className="cursor-help border-b border-dotted border-gray-300">{short}</span>
  }
  function toggleSelect(id: string) {
    const s = students.find(st=>st.id===id)
    if (!s?.email) return
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelectedIds(next)
  }
  function selectAll() {
    setSelectedIds(new Set(students.filter(s=>s.email).map(s=>s.id)))
  }
  function selectNone() {
    setSelectedIds(new Set())
  }

  // Sesiunile la care se poate muta (exclusiv absenti si sesiunea curenta)
  const movableToSessions = allSessions.filter(s => s.id !== sess.id && s.session_type !== 'absent')
  // Sesiunea de absenti
  const absentSession = allSessions.find(s => s.session_type === 'absent')

  async function reorder(list: Student[]) {
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
    const reordered = await reorder(remaining)
    setStudents(reordered)
  }

  async function moveToSession(s: Student, targetSessionId: string) {
    setMoving(s.id); setShowMoveMenu(null)
    const targetStudents = allStudents[targetSessionId] || []
    const maxOrder = targetStudents.reduce((m,ts) => Math.max(m, ts.order_in_session||0), 0)
    await supabase.from('students').update({ session_id: targetSessionId, order_in_session: maxOrder+1 }).eq('id', s.id)
    const remaining = students.filter(st => st.id !== s.id)
    const reordered = await reorder(remaining)
    setStudents(reordered)
    setAllStudents(targetSessionId, [...targetStudents, {...s, session_id: targetSessionId, order_in_session: maxOrder+1}])
    setMoving(null)
  }

  async function markAbsent(s: Student) {
    if (!absentSession) return
    setMoving(s.id)
    const targetStudents = allStudents[absentSession.id] || []
    const maxOrder = targetStudents.reduce((m,ts) => Math.max(m, ts.order_in_session||0), 0)
    await supabase.from('students').update({ session_id: absentSession.id, order_in_session: maxOrder+1, portal_status: 'absent' }).eq('id', s.id)
    const remaining = students.filter(st => st.id !== s.id)
    const reordered = await reorder(remaining)
    setStudents(reordered)
    setAllStudents(absentSession.id, [...targetStudents, {...s, session_id: absentSession.id, portal_status: 'absent', order_in_session: maxOrder+1}])
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
  function trunc(val: string|null|undefined, full?: boolean): React.ReactNode {
    if (!val) return <span className="text-gray-300">—</span>
    if (full || val.length <= 5) return <>{val}</>
    return <span title={val} className="cursor-help border-b border-dotted border-gray-300">{val.slice(0,5)}…</span>
  }
  const addCls = "border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white w-full"

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-gray-400"/>
          <span className="font-semibold text-sm text-gray-900">Cursanți ({students.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={recount} title="Re-numerotează conform ordinii curente"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            ↺ Nr. crt.
          </button>
          <button onClick={() => {setShowAdd(true); setEditingId(null)}}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
            <Plus size={12}/> Adaugă
          </button>
        </div>
      </div>

      {showAdd && (
        <div className="p-4 border-b border-blue-50 bg-blue-50/40">
          <div className="grid grid-cols-4 gap-2 mb-2">
            <div className="col-span-2"><div className="text-xs text-gray-400 mb-1">Nume complet *</div>
              <input className={addCls} placeholder="POPESCU ION" value={newSt.full_name} onChange={e=>setNewSt((s:any)=>({...s,full_name:e.target.value.toUpperCase()}))}/></div>
            <div><div className="text-xs text-gray-400 mb-1">CNP</div><input className={addCls} placeholder="1800101..." value={newSt.cnp} onChange={e=>setNewSt((s:any)=>({...s,cnp:e.target.value}))}/></div>
            <div><div className="text-xs text-gray-400 mb-1">Clasa</div>
              <select className={addCls} value={newSt.class_caa} onChange={e=>setNewSt((s:any)=>({...s,class_caa:e.target.value}))}>
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option><option value="Radio">Radio</option></select></div>
            <div className="col-span-2"><div className="text-xs text-gray-400 mb-1">Email</div><input className={addCls} placeholder="email@..." value={newSt.email} onChange={e=>setNewSt((s:any)=>({...s,email:e.target.value}))}/></div>
            <div><div className="text-xs text-gray-400 mb-1">Telefon</div><input className={addCls} placeholder="07XX..." value={newSt.phone} onChange={e=>setNewSt((s:any)=>({...s,phone:e.target.value}))}/></div>
            <div><div className="text-xs text-gray-400 mb-1">Data nașterii</div><input className={addCls} placeholder="dd.mm.yyyy" value={newSt.birth_date} onChange={e=>setNewSt((s:any)=>({...s,birth_date:e.target.value}))}/></div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={()=>{setShowAdd(false);setNewSt(EMPTY_ST)}} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50"><X size={12} className="inline"/> Anulează</button>
            <button onClick={addStudent} disabled={adding} className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#0a1628'}}>
              <span className="flex items-center gap-1"><Check size={12}/>{adding?'Se adaugă...':'Adaugă'}</span>
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
                <th className="w-16 px-2 py-2.5 text-center">
                  <div className="flex flex-col gap-0 items-center">
                    <button onClick={async()=>{
                      for(const st of students.filter(s=>s.email)){
                        await supabase.from('students').update({communication_target:true}).eq('id',st.id)
                      }
                      setStudents(students.map(st=>({...st,communication_target:st.email?true:st.communication_target})))
                    }} className="text-xs text-green-600 hover:text-green-800 font-bold leading-tight">All</button>
                    <button onClick={async()=>{
                      for(const st of students){
                        await supabase.from('students').update({communication_target:false}).eq('id',st.id)
                      }
                      setStudents(students.map(st=>({...st,communication_target:false})))
                    }} className="text-xs text-gray-400 hover:text-gray-600 font-bold leading-tight">None</button>
                  </div>
                </th>
                <th className="w-6 px-2 py-2.5 text-gray-400 text-xs font-medium text-right">#</th>
                {[
                  ['full_name','Nume'],['email','Email'],['phone','Tel'],
                  ['cnp','CNP'],['birth_date','Naștere'],['address','Adresă'],
                  ['expiry_date','Exp. CI'],['class_caa','Cls'],['portal_status','Portal']
                ].map(([col,label]) => (
                  <th key={col} className="px-2 py-2.5 font-medium text-gray-500 text-left cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
                    onClick={()=>toggleSort(col)}>
                    <span className="flex items-center gap-0.5">
                      {label}
                      {sortCol===col ? (sortDir==='asc'?'↑':'↓') : <span className="text-gray-200 text-xs">↕</span>}
                    </span>
                  </th>
                ))}
                <th className="px-2 py-2.5 text-gray-400 text-xs font-medium text-center">CI</th>
                <th className="px-2 py-2.5 text-gray-400 text-xs font-medium text-center">Sem.</th>
                <th className="w-24 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {getSorted(students).map((s,i) => {
                const ps = portalMap[s.portal_status] || portalMap.pending
                const isEditing = editingId === s.id
                return (
                  <tr key={s.id} className={isEditing?'bg-blue-50/40':'hover:bg-gray-50 transition-colors'}>
                    {isEditing ? (<>
                      <td className="px-2 py-2 text-center"><span className="text-gray-200">✉</span></td>
                      <td className="px-2 py-2 text-gray-300 text-xs text-right">{i+1}</td>
                      <td className="px-1 py-1.5"><input className={inCls+' font-medium min-w-28'} value={editValues.full_name} onChange={e=>setEditValues((v:any)=>({...v,full_name:e.target.value.toUpperCase()}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' font-mono w-24'} value={editValues.cnp} onChange={e=>setEditValues((v:any)=>({...v,cnp:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' min-w-28'} value={editValues.email} onChange={e=>setEditValues((v:any)=>({...v,email:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><input className={inCls+' w-24'} value={editValues.phone} onChange={e=>setEditValues((v:any)=>({...v,phone:e.target.value}))}/></td>
                      <td className="px-1 py-1.5"><div className="flex gap-1">
                        <input className={inCls+' w-12'} placeholder="AB" value={editValues.ci_series} onChange={e=>setEditValues((v:any)=>({...v,ci_series:e.target.value.toUpperCase()}))}/>
                        <input className={inCls+' w-16'} placeholder="123456" value={editValues.ci_number} onChange={e=>setEditValues((v:any)=>({...v,ci_number:e.target.value}))}/>
                      </div></td>
                      <td className="px-1 py-1.5"><select className={inCls} value={editValues.class_caa} onChange={e=>setEditValues((v:any)=>({...v,class_caa:e.target.value}))}>
                        <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option><option value="Radio">Radio</option></select></td>
                      <td className="px-1 py-1.5"><span className="text-xs" style={{color:ps.color}}>{ps.label}</span></td>
                      <td className="px-2 py-1.5"><div className="flex gap-1">
                        <button onClick={()=>saveEdit(s.id)} disabled={saving} className="p-1 rounded bg-green-100 text-green-700"><Check size={12}/></button>
                        <button onClick={()=>setEditingId(null)} className="p-1 rounded bg-gray-100 text-gray-500"><X size={12}/></button>
                      </div></td>
                    </>) : (<>
                      {/* ✉ Communication target */}
                      <td className="px-2 py-2 text-center">
                        <button onClick={async(e)=>{e.stopPropagation();if(!s.email)return;const nv=!s.communication_target;await supabase.from('students').update({communication_target:nv}).eq('id',s.id);setStudents(students.map(st=>st.id===s.id?{...st,communication_target:nv}:st))}}
                          disabled={!s.email} title={s.email?(s.communication_target?'Email activ':'Email inactiv'):'Fără email'}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-20 transition-colors">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke={s.communication_target&&s.email?'#16a34a':'#d1d5db'}>
                            <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                          </svg>
                        </button>
                      </td>
                      {/* # */}
                      <td className="px-2 py-2 text-gray-300 text-xs text-right">{i+1}</td>
                      {/* Nume — click deschide portal */}
                      <td className="px-2 py-2">
                        <a href={`/portal?cod=${sess.access_code}&email=${encodeURIComponent(s.email||'')}`}
                          target="_blank" rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer text-xs">
                          {s.full_name}
                        </a>
                      </td>
                      {/* Email cu buton copy */}
                      <td className="px-2 py-2 text-gray-500 text-xs">
                        {s.email ? (
                          <span className="flex items-center gap-1 group">
                            <span>{s.email}</span>
                            <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(s.email)}}
                              title="Copiază email" className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 transition-all">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                              </svg>
                            </button>
                          </span>
                        ) : <span className="text-gray-300">—</span>}
                      </td>
                      {/* Telefon */}
                      <td className="px-2 py-2 text-gray-500 text-xs">{trunc(s.phone)}</td>
                      {/* CNP */}
                      <td className="px-2 py-2 font-mono text-gray-400 text-xs">{trunc(s.cnp)}</td>
                      {/* Data nasterii */}
                      <td className="px-2 py-2 text-gray-400 text-xs">{trunc(s.birth_date)}</td>
                      {/* Adresa */}
                      <td className="px-2 py-2 text-gray-400 text-xs">{trunc(s.address)}</td>
                      {/* Data expirare CI */}
                      <td className="px-2 py-2 text-gray-400 text-xs">{trunc(s.expiry_date)}</td>
                      {/* Clasa */}
                      <td className="px-2 py-2 text-gray-500 text-xs">{(s.class_caa||'').replace(',','+')}</td>
                      {/* Portal status */}
                      <td className="px-2 py-2">
                        <span className="text-xs font-medium" style={{color:ps.color}}>{ps.label}</span>
                        {s.signed_at && <div className="text-gray-300 text-xs">{new Date(s.signed_at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}</div>}
                      </td>
                      {/* CI imagine - pictograma */}
                      <td className="px-2 py-2 text-center">
                        {s.ci_image_data ? (
                          <button onClick={()=>{const w=window.open('','_blank');w?.document.write(`<img src="${s.ci_image_data}" style="max-width:100%;max-height:100vh;"/>`)}}
                            title="CI scanat — click pentru previzualizare"
                            className="p-1 rounded hover:bg-gray-100 transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                          </button>
                        ) : (
                          <span title="CI lipsă" className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 text-red-400">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
                              <circle cx="12" cy="10" r="3"/>
                            </svg>
                          </span>
                        )}
                        {s.ci_series && s.ci_number && (
                          <div className="text-xs font-mono text-gray-400 mt-0.5">{s.ci_series} {s.ci_number}</div>
                        )}
                      </td>
                      {/* Semnatura - pictograma */}
                      <td className="px-2 py-2 text-center">
                        {s.signature_data ? (
                          <button onClick={()=>{const w=window.open('','_blank');w?.document.write(`<img src="${s.signature_data}" style="max-width:400px;border:1px solid #ccc;padding:10px;background:#fff;"/>`)}}
                            title="Semnătură — click pentru previzualizare"
                            className="p-1 rounded hover:bg-gray-100 transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 17c3-3 6 3 9 0s6-3 9 0"/><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2"/>
                            </svg>
                          </button>
                        ) : (
                          <span title="Semnătură lipsă" className="inline-flex items-center justify-center w-6 h-6 rounded border-2 border-red-300 text-red-400">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 17c3-3 6 3 9 0s6-3 9 0"/><line x1="3" y1="12" x2="21" y2="12" strokeDasharray="2 2"/>
                            </svg>
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex gap-1 items-center relative">
                          {/* Muta la alta sesiune - dropdown */}
                          {!isAbsent && movableToSessions.length > 0 && (
                            <div className="relative">
                              <button onClick={()=>setShowMoveMenu(showMoveMenu===s.id?null:s.id)}
                                disabled={moving===s.id}
                                className="p-1.5 rounded border border-blue-100 text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                title="Mută la altă sesiune">
                                {moving===s.id ? <span className="text-xs">...</span> : <ArrowRight size={12}/>}
                              </button>
                              {showMoveMenu===s.id && (
                                <div className="absolute right-0 top-7 z-50 bg-white rounded-xl shadow-xl border border-gray-100 min-w-48 py-1">
                                  <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-50">Mută la:</div>
                                  {movableToSessions.map(ts => (
                                    <button key={ts.id} onClick={()=>moveToSession(s, ts.id)}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">
                                      <div className="font-medium text-gray-900">
                                        {ts.session_type==='clone' && <span className="text-blue-500 mr-1">⎇</span>}
                                        {new Date(ts.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'})}
                                        {' · '}{ts.locations?.name}
                                      </div>
                                      <div className="text-gray-400">{ts.boats?.name} · {ts.instructors?.full_name}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          {/* Muta la absenti */}
                          {!isAbsent && absentSession && (
                            <button onClick={()=>markAbsent(s)} disabled={moving===s.id}
                              className="p-1.5 rounded border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                              title="Marchează absent">
                              <UserX size={12}/>
                            </button>
                          )}
                          {/* Muta inapoi din absenti */}
                          {isAbsent && movableToSessions.length > 0 && (
                            <div className="relative">
                              <button onClick={()=>setShowMoveMenu(showMoveMenu===s.id?null:s.id)}
                                disabled={moving===s.id}
                                className="p-1.5 rounded border border-green-100 text-green-500 hover:text-green-700 hover:bg-green-50 transition-colors"
                                title="Alocă la sesiune">
                                {moving===s.id ? <span className="text-xs">...</span> : <ArrowRight size={12}/>}
                              </button>
                              {showMoveMenu===s.id && (
                                <div className="absolute right-0 top-7 z-50 bg-white rounded-xl shadow-xl border border-gray-100 min-w-52 py-1">
                                  <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-50">Alocă la sesiunea:</div>
                                  {movableToSessions.map(ts => (
                                    <button key={ts.id} onClick={()=>moveToSession(s, ts.id)}
                                      className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">
                                      <div className="font-medium text-gray-900">
                                        {ts.session_type==='clone' && <span className="text-blue-500 mr-1">⎇</span>}
                                        {new Date(ts.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}
                                        {' · '}{ts.locations?.name}
                                      </div>
                                      <div className="text-gray-400">{ts.boats?.name} · {ts.instructors?.full_name}</div>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <button onClick={()=>startEdit(s)} className="p-1.5 rounded border border-gray-200 text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"><Pencil size={12}/></button>
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

const QUICK_TEMPLATES = [
  {
    label: '🔗 Link portal',
    subject: 'Acces portal cursanți - SetSail Practică',
    body: (sess: any) => `Stimate/Stimată cursant,\n\nVă rugăm să accesați portalul SetSail Practică și să completați datele personale (serie CI, număr CI, semnătură) înainte de data sesiunii.\n\nLink portal: ${typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'}/portal?cod=${sess.access_code}\n\nData sesiunii: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}\nLocația: ${sess.location_detail || sess.locations?.name || ''}\n\nVă mulțumim,\nEchipa SetSail`,
  },
  {
    label: '⏰ Completați portalul',
    subject: 'Reminder: date lipsă în portal - SetSail Practică',
    body: (sess: any) => `Stimate/Stimată cursant,\n\nAm observat că nu ați completat încă datele personale în portalul SetSail Practică. Sesiunea de practică se apropie și avem nevoie de datele dvs. (serie CI, număr CI) pentru a putea emite documentele oficiale.\n\nVă rugăm să accesați portalul cât mai curând:\n${typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'}/portal?cod=${sess.access_code}\n\nData sesiunii: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}\n\nVă mulțumim,\nEchipa SetSail`,
  },
  {
    label: '📅 Reminder sesiune',
    subject: 'Reminder: sesiunea de practică are loc mâine',
    body: (sess: any) => `Stimate/Stimată cursant,\n\nVă reamintim că sesiunea de practică de conducere a ambarcațiunii de agrement are loc mâine.\n\nData: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}\nLocația: ${sess.location_detail || sess.locations?.name || ''}\nAmbarcațiunea: ${sess.boats?.name || ''}\n\nVă rugăm să fiți prezenți cu 15 minute înainte și să aveți cartea de identitate la dumneavoastră.\n\nSucces!\nEchipa SetSail`,
  },
]

const DROPDOWN_TEMPLATES = [
  { label: 'Modificare dată sesiune', subject: 'Modificare dată sesiune de practică', body: 'Stimate/Stimată cursant,\n\nVă informăm că sesiunea de practică a suferit modificări de dată.\n\nNoua dată: [data nouă]\nLocația: [locație]\n\nVă rugăm să confirmați participarea.\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Documente necesare', subject: 'Documente necesare pentru examenul practic', body: 'Stimate/Stimată cursant,\n\nVă rugăm să aveți asupra dvs. la prezentare:\n- Cartea de identitate (original)\n- Adeverința de curs\n- Chitanța de plată taxă examen\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Felicitări promovare', subject: 'Felicitări pentru promovarea examenului practic!', body: 'Stimate/Stimată cursant,\n\nVă felicităm pentru promovarea cu succes a examenului practic!\n\nCertificatul dumneavoastră va fi emis în cel mai scurt timp.\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Informații locație', subject: 'Informații locație examen practic', body: 'Stimate/Stimată cursant,\n\nVă transmitem detalii despre locația sesiunii de practică:\n\n[adresa locației]\n\nVă recomandăm să sosiți cu 15 minute înainte.\n\nCu stimă,\nEchipa SetSail' },
]

function SidebarCard({ sess, students, allStatuses, onStatusChange }:
  { sess: Session, students: Student[], allStatuses: string[], onStatusChange:(sid:string,status:string)=>void }) {
  const [gPV, setGPV] = useState(false)
  const [gFise, setGFise] = useState(false)
  const [gPDF, setGPDF] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showMail, setShowMail] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [mailCopied, setMailCopied] = useState<string|null>(null)
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    () => students.filter(s=>s.email).map(s=>s.email)
  )

  // Sincronizeaza BCC automat cand se schimba communication_target la orice cursant
  useEffect(()=>{
    const commEmails = students.filter(s=>s.email && s.communication_target).map(s=>s.email)
    setSelectedEmails(commEmails)
  }, [students.map(s=>s.id+'_'+s.communication_target).join(',')])

  useEffect(()=>{
    setMailTo(selectedEmails.join(', '))
  }, [selectedEmails.join(',')])

  async function generateDoc(endpoint: string, filename: string) {
    const res = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id})})
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }

  const st = statusMap[sess.status] || statusMap.draft
  const isAbsent = sess.session_type === 'absent'

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
        {/* Status buttons */}
        {!isAbsent && (
          <div className="mt-4">
            <div className="text-xs text-gray-400 mb-2">Status sesiune</div>
            <div className="flex flex-wrap gap-1.5">
              {(sess.session_type === 'principal' ? ['draft','active','focus','completed'] : ['draft','active','completed'] as const).map((sv: string) => (
                <button key={sv} onClick={()=>onStatusChange(sess.id, sv)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border-2 ${sess.status===sv ? 'text-white border-transparent' : 'bg-white hover:opacity-90'}`}
                  style={sess.status===sv
                    ? {background: statusMap[sv].color, borderColor: statusMap[sv].color}
                    : {borderColor: statusMap[sv].color+'60', color: statusMap[sv].color}}>
                  {sess.status===sv && '✓ '}{statusMap[sv].label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {!isAbsent && (
        <>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Link portal</h3>
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">/portal?cod=<strong>{sess.access_code}</strong></div>
            <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${sess.access_code}`);setCopied(true);setTimeout(()=>setCopied(false),2000)}}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
              <Copy size={12}/>{copied?'✓ Copiat!':'Copiază link'}
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
                const blob=await res.blob();const url=URL.createObjectURL(blob)
                if(isPdfFallback){const win=window.open(url,'_blank');if(win)win.onload=()=>win.print()}
                else{const a=document.createElement('a');a.href=url;a.download=`Fise_${sess.session_date}.pdf`;a.click()}
              }catch(e:any){alert(e.message)}setGPDF(false)}}
                disabled={gPDF||students.length===0} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-red-100 text-red-700 hover:bg-red-50 disabled:opacity-50">
                <Download size={13}/>{gPDF?'Se generează...':'Fișe PDF cu semnături'}
              </button>
            </div>
          </div>

          {/* Mailing */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <button onClick={()=>{
              if(!showMail) {
                const emails = students.filter(s=>s.email).map(s=>s.email).join(', ')
                setMailTo(emails)
              }
              setShowMail(!showMail)
            }} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={14} className="text-gray-400"/>
                <h3 className="font-semibold text-sm text-gray-900">Mailing cursanți</h3>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${showMail?'rotate-180':''}`}/>
            </button>

            {showMail && (
              <div className="mt-4 space-y-3">
                {/* BCC */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400">BCC</label>
                      <button
                        onClick={()=>{
                          const emails = students.filter(s=>s.email && s.communication_target).map(s=>s.email)
                          setSelectedEmails(emails)
                          setMailTo(emails.join(', '))
                        }}
                        title="Reîncarcă emailurile active"
                        className="text-xs text-gray-400 hover:text-blue-600 flex items-center gap-0.5 transition-colors">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>
                        </svg>
                        Refresh
                      </button>
                    </div>
                    <button onClick={()=>{navigator.clipboard.writeText(mailTo);setMailCopied('bcc');setTimeout(()=>setMailCopied(null),2000)}}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>{mailCopied==='bcc'?'Copiat!':'Copiază'}
                    </button>
                  </div>
                  <textarea rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none font-mono"
                    value={mailTo} onChange={e=>setMailTo(e.target.value)}
                    onFocus={()=>{
                      const emails = students.filter(s=>s.email && s.communication_target).map(s=>s.email)
                      setMailTo(emails.join(', '))
                    }}
                  />
                </div>

                {/* Subiect */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Subiect</label>
                    <button onClick={()=>{navigator.clipboard.writeText(mailSubject);setMailCopied('subj');setTimeout(()=>setMailCopied(null),2000)}}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>{mailCopied==='subj'?'Copiat!':'Copiază'}
                    </button>
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={mailSubject} onChange={e=>setMailSubject(e.target.value)} placeholder="Subiect email..."/>
                </div>

                {/* Mesaj */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Mesaj</label>
                    <button onClick={()=>{navigator.clipboard.writeText(mailBody);setMailCopied('body');setTimeout(()=>setMailCopied(null),2000)}}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>{mailCopied==='body'?'Copiat!':'Copiază tot'}
                    </button>
                  </div>
                  <textarea rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y font-mono"
                    value={mailBody} onChange={e=>setMailBody(e.target.value)} placeholder="Scrie sau selectează un template..."/>
                </div>

                {/* Template-uri rapide */}
                <div>
                  <div className="text-xs text-gray-400 mb-1.5">Template-uri rapide:</div>
                  <div className="flex flex-col gap-1.5">
                    {QUICK_TEMPLATES.map((t,i) => (
                      <button key={i} onClick={()=>{setMailSubject(t.subject);setMailBody(t.body(sess))}}
                        className="text-left px-3 py-2 rounded-lg text-xs border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                        {t.label}
                      </button>
                    ))}
                    {/* Dropdown template-uri extra */}
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none bg-white"
                      onChange={e=>{
                        const t = DROPDOWN_TEMPLATES[parseInt(e.target.value)]
                        if(t){setMailSubject(t.subject);setMailBody(t.body)}
                        e.target.value = ''
                      }} defaultValue="">
                      <option value="" disabled>+ Alte template-uri...</option>
                      {DROPDOWN_TEMPLATES.map((t,i)=>(
                        <option key={i} value={i}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Buton deschide Gmail */}
                <a href={`https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(mailTo)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white"
                  style={{background:'#0a1628'}}>
                  <Mail size={13}/> Deschide în Gmail
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function SessionDetailPage() {
  const { id } = useParams() as { id: string }
  const [mainSession, setMainSession] = useState<Session|null>(null)
  const [sessions, setSessions] = useState<Session[]>([]) // principal + clone + absent
  const [studentsMap, setStudentsMap] = useState<Record<string,Student[]>>({})
  const [mailEmailsMap, setMailEmailsMap] = useState<Record<string,string[]>>({})
  const [selectedIdsMap, setSelectedIdsMap] = useState<Record<string,Set<string>>>({})

  function getSelectedIds(sessionId: string, sts: Student[]): Set<string> {
    if (selectedIdsMap[sessionId]) return selectedIdsMap[sessionId]
    // Default: toti cu email selectati
    return new Set(sts.filter(s=>s.email).map(s=>s.id))
  }
  function setSelectedIds(sessionId: string, ids: Set<string>) {
    setSelectedIdsMap(prev => ({...prev, [sessionId]: ids}))
    // Actualizeaza emailurile
    const emails = Array.from(ids).map(id => {
      const allSts = Object.values(studentsMap).flat()
      return allSts.find(s=>s.id===id)?.email || ''
    }).filter(Boolean)
    setMailEmailsMap(prev => ({...prev, [sessionId]: emails}))
  }
  const [loading, setLoading] = useState(true)
  const [showRandomizer, setShowRandomizer] = useState(false)
  const [randomCounts, setRandomCounts] = useState<number[]>([])
  const [randomizing, setRandomizing] = useState(false)
  const [editingSession, setEditingSession] = useState<string|null>(null)
  const [editSessionValues, setEditSessionValues] = useState<any>({})
  const [savingSession, setSavingSession] = useState(false)
  const [refs, setRefs] = useState<any>({locations:[], boats:[], evaluators:[], instructors:[]})

  function setMailEmails(sessionId: string, emails: string[]) {
    setMailEmailsMap(prev => ({...prev, [sessionId]: emails}))
  }

  function setSessionStudents(sessionId: string, sts: Student[]) {
    setStudentsMap(prev => ({...prev, [sessionId]: sts}))
  }

  function startEditSession(sess: Session) {
    setEditingSession(sess.id)
    setEditSessionValues({
      session_date: sess.session_date,
      location_id: (sess as any).location_id || '',
      boat_id: (sess as any).boat_id || '',
      evaluator_id: (sess as any).evaluator_id || '',
      instructor_id: (sess as any).instructor_id || '',
      class_caa: sess.class_caa || 'C,D',
      request_number: sess.request_number || '',
      location_detail: sess.location_detail || '',
    })
  }

  async function saveEditSession(sid: string) {
    setSavingSession(true)
    await supabase.from('sessions').update(editSessionValues).eq('id', sid)
    // Reload session data
    const { data: updated } = await supabase.from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)').eq('id', sid).single()
    if (updated) {
      setSessions(prev => prev.map(s => s.id === sid ? {...s, ...updated} : s))
      if (sid === id) setMainSession(updated as Session)
    }
    setEditingSession(null)
    setSavingSession(false)
  }

  async function updateStatus(sid: string, status: string) {
    if (status === 'completed') {
      const confirmed = window.confirm(
        'Ești sigur că sesiunea este finalizată?\n\n' +
        '• Cursanții nu mai pot accesa portalul\n' +
        '• Absenții pot fi alocați la alte sesiuni\n\n' +
        'Poți reveni oricând la alt status.'
      )
      if (!confirmed) return
    }
    await supabase.from('sessions').update({status}).eq('id', sid)
    setSessions(prev => prev.map(s => s.id===sid ? {...s, status} : s))
    if (sid === id) setMainSession(prev => prev ? {...prev, status} : prev)
  }

  async function load() {
    // Fetch refs pentru editare
    const [{ data: locations }, { data: boats }, { data: evaluators }, { data: instructors }] = await Promise.all([
      supabase.from('locations').select('*').order('name'),
      supabase.from('boats').select('*').order('name'),
      supabase.from('evaluators').select('*').order('full_name'),
      supabase.from('instructors').select('*').order('full_name'),
    ])
    setRefs({ locations: locations||[], boats: boats||[], evaluators: evaluators||[], instructors: instructors||[] })

    const { data: s } = await supabase
      .from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)')
      .eq('id', id).single()
    if (!s) { setLoading(false); return }
    setMainSession(s as Session)

    // Cauta clone si sesiunea de absenti
    const { data: related } = await supabase
      .from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)')
      .eq('parent_session_id', id)
    const allSess = [s as Session, ...(related||[]) as Session[]]
    setSessions(allSess)

    // Cursanti pentru toate sesiunile
    const map: Record<string,Student[]> = {}
    for (const sess of allSess) {
      const { data: sts } = await supabase.from('students').select('*').eq('session_id', sess.id).order('order_in_session')
      map[sess.id] = (sts||[]) as Student[]
    }

    // Creeaza sesiunea de absenti DOAR pentru sesiunile principale (nu clone)
    const absentSess = allSess.find(s => s.session_type === 'absent')
    if (!absentSess && s.session_type === 'principal') {
      const { data: newAbsent } = await supabase.from('sessions').insert({
        session_date: s.session_date,
        location_id: s.location_id,
        boat_id: s.boat_id,
        evaluator_id: s.evaluator_id,
        instructor_id: s.instructor_id,
        class_caa: s.class_caa,
        status: 'draft',
        parent_session_id: id,
        is_clone: false,
        session_type: 'absent',
      }).select('*, locations(*), boats(*), evaluators(*), instructors(*)').single()
      if (newAbsent) {
        allSess.push(newAbsent as Session)
        map[newAbsent.id] = []
        setSessions([...allSess])
      }
    }

    setStudentsMap(map)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  // Randomizare cursanti pe liste
  async function doRandomize() {
    setRandomizing(true)
    // Colectam toate sesiunile active (principal + clone, fara absent)
    const activeSessions = sessions.filter(s => s.session_type !== 'absent')
    // Colectam TOTI cursantii de pe toate listele active
    const allActiveStudents: Student[] = []
    for (const sess of activeSessions) {
      const sts = studentsMap[sess.id] || []
      allActiveStudents.push(...sts)
    }
    // Shuffle Fisher-Yates
    const shuffled = [...allActiveStudents]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    // Distribuie pe liste conform randomCounts
    let idx = 0
    for (let si = 0; si < activeSessions.length; si++) {
      const sess = activeSessions[si]
      const count = randomCounts[si] || 0
      const batch = shuffled.slice(idx, idx + count)
      idx += count
      // Sorteaza alfabetic
      batch.sort((a, b) => a.full_name.localeCompare(b.full_name, 'ro'))
      // Actualizeaza session_id si order_in_session
      for (let bi = 0; bi < batch.length; bi++) {
        await supabase.from('students')
          .update({ session_id: sess.id, order_in_session: bi + 1 })
          .eq('id', batch[bi].id)
      }
      setSessionStudents(sess.id, batch.map((s, i) => ({...s, session_id: sess.id, order_in_session: i+1})))
    }
    setShowRandomizer(false)
    setRandomizing(false)
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>
  if (!mainSession) return <div className="p-8 text-center text-gray-400">Sesiunea nu a fost găsită.</div>

  const cloneSessions = sessions.filter(s => s.session_type === 'clone')
  const absentSession = sessions.find(s => s.session_type === 'absent')
  const st = statusMap[mainSession.status] || statusMap.draft

  function SectionDivider({ sess, isAbsent }: { sess: Session, isAbsent?: boolean }) {
    const color = isAbsent ? '#ef4444' : '#3b82f6'
    const bg = isAbsent ? '#fef2f2' : '#eff6ff'
    const border = isAbsent ? '#fecaca' : '#bfdbfe'
    const label = isAbsent
      ? `Absenți (${(studentsMap[sess.id]||[]).length})`
      : `Clonă — ${new Date(sess.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})} · ${sess.locations?.name} · ${sess.boats?.name}`
    const stMap = statusMap[sess.status] || statusMap.draft
    return (
      <div className="my-8 flex items-center gap-4">
        <div className="flex-1 border-t-2 border-dashed" style={{borderColor: border}}/>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full border" style={{background:bg, borderColor:border}}>
          {isAbsent ? <UserX size={14} style={{color}}/> : <GitBranch size={14} style={{color}}/>}
          <span className="text-sm font-medium" style={{color}}>{label}</span>
          {!isAbsent && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium ml-1"
              style={{background:stMap.bg, color:stMap.color}}>{stMap.label}</span>
          )}
        </div>
        <div className="flex-1 border-t-2 border-dashed" style={{borderColor: border}}/>
      </div>
    )
  }

  return (
    <div className="p-8" onClick={()=>{}}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/sesiuni" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20}/></Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily:'Georgia, serif'}}>
              {new Date(mainSession.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}
            </h1>
            <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{background:st.bg,color:st.color}}>{st.label}</span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{mainSession.locations?.name}, {mainSession.locations?.county}</p>
        </div>
        <button onClick={()=>startEditSession(mainSession)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
          <Pencil size={12}/> Editează sesiunea
        </button>
        <button onClick={()=>{
          const activeSess = sessions.filter(s=>s.session_type!=='absent')
          setRandomCounts(activeSess.map(s=>(studentsMap[s.id]||[]).length))
          setShowRandomizer(true)
        }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50">
          🎲 Randomizează
        </button>
        <Link href={`/admin/sesiuni/${id}/clone`}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50">
          <GitBranch size={12}/> {cloneSessions.length>0?'Adaugă clonă':'Clonează'}
        </Link>
      </div>

      {/* Modal randomizator */}
      {showRandomizer && (() => {
        const activeSess = sessions.filter(s => s.session_type !== 'absent')
        const totalStudents = activeSess.reduce((sum, s) => sum + (studentsMap[s.id]||[]).length, 0)
        const totalAllocated = randomCounts.reduce((a,b)=>a+b,0)
        const isValid = totalAllocated === totalStudents && randomCounts.every(c=>c>=0)
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="font-semibold text-gray-900 mb-1">🎲 Randomizare cursanți</h3>
              <p className="text-xs text-gray-400 mb-4">
                Total cursanți: <strong>{totalStudents}</strong> · 
                Alocați: <strong className={totalAllocated===totalStudents?'text-green-600':'text-red-500'}>{totalAllocated}</strong>
              </p>
              <div className="space-y-3 mb-5">
                {activeSess.map((sess, si) => (
                  <div key={sess.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-700 flex items-center gap-1">
                        {sess.session_type==='clone' && <span className="text-blue-400">⎇</span>}
                        {new Date(sess.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric'})}
                        {' · '}{sess.locations?.name}
                      </div>
                      <div className="text-xs text-gray-400">{studentsMap[sess.id]?.length||0} cursanți curenți</div>
                    </div>
                    <input
                      type="number" min="0" max={totalStudents}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomCounts[si]||0}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value)||0)
                        setRandomCounts(prev => prev.map((c,i) => i===si ? val : c))
                      }}
                    />
                    <span className="text-xs text-gray-400 w-12">cursanți</span>
                  </div>
                ))}
              </div>
              {!isValid && (
                <p className="text-xs text-red-500 mb-3 text-center">
                  {totalAllocated > totalStudents
                    ? `Ai alocat ${totalAllocated-totalStudents} cursanți în plus`
                    : `Mai ai ${totalStudents-totalAllocated} cursanți nealocați`}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={()=>setShowRandomizer(false)} className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">Anulează</button>
                <button onClick={doRandomize} disabled={!isValid||randomizing}
                  className="px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{background:'#7c3aed'}}>
                  {randomizing?'Se randomizează...':'🎲 Randomize allocation'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal editare sesiune */}
      {editingSession && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Editează sesiunea</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Data', 'session_date', 'date'],
                ['Nr. solicitare', 'request_number', 'text'],
                ['Locație detaliată', 'location_detail', 'text'],
                ['Clasa CAA', 'class_caa', 'select-class'],
              ].map(([label, key, type]) => (
                <div key={key} className={key==='location_detail'?'col-span-2':''}>
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  {type==='select-class' ? (
                    <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={editSessionValues[key]} onChange={e=>setEditSessionValues((v:any)=>({...v,[key]:e.target.value}))}>
                      {['A','B','C','D','C,D','Radio'].map(c=><option key={c} value={c}>{c.replace(',','+')}</option>)}
                    </select>
                  ) : (
                    <input type={type} className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={editSessionValues[key]||''} onChange={e=>setEditSessionValues((v:any)=>({...v,[key]:e.target.value}))}/>
                  )}
                </div>
              ))}
              {[
                ['Locație', 'location_id', refs.locations, 'name', 'county'],
                ['Ambarcațiune', 'boat_id', refs.boats, 'name', null],
                ['Evaluator ANR', 'evaluator_id', refs.evaluators, 'full_name', null],
                ['Instructor', 'instructor_id', refs.instructors, 'full_name', null],
              ].map(([label, key, options, nameField, extraField]: any) => (
                <div key={key}>
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={editSessionValues[key]||''} onChange={e=>setEditSessionValues((v:any)=>({...v,[key]:e.target.value}))}>
                    <option value="">— Selectează —</option>
                    {options.map((o:any)=><option key={o.id} value={o.id}>{o[nameField]}{extraField&&o[extraField]?`, ${o[extraField]}`:''}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={()=>setEditingSession(null)} className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">Anulează</button>
              <button onClick={()=>saveEditSession(editingSession)} disabled={savingSession}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#059669'}}>
                {savingSession?'Se salvează...':'Salvează'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sesiunea principala */}
      <div className="grid grid-cols-3 gap-6">
        <SidebarCard sess={mainSession} students={studentsMap[mainSession.id]||[]} allStatuses={[]} onStatusChange={updateStatus}/>
        <div className="col-span-2">
          <StudentsTable
            sess={mainSession} students={studentsMap[mainSession.id]||[]}
            setStudents={(sts)=>setSessionStudents(mainSession.id,sts)}
            allSessions={sessions} allStudents={studentsMap} setAllStudents={setSessionStudents}
            isAbsent={false}
            selectedIds={getSelectedIds(mainSession.id, studentsMap[mainSession.id]||[])}
            setSelectedIds={(ids)=>setSelectedIds(mainSession.id, ids)}
          />
        </div>
      </div>

      {/* Clone */}
      {cloneSessions.map(clone => (
        <div key={clone.id}>
          <SectionDivider sess={clone}/>
          <div className="grid grid-cols-3 gap-6">
            <SidebarCard sess={clone} students={studentsMap[clone.id]||[]} allStatuses={[]} onStatusChange={updateStatus}/>
            <div className="col-span-2">
              <StudentsTable
                sess={clone} students={studentsMap[clone.id]||[]}
                setStudents={(sts)=>setSessionStudents(clone.id,sts)}
                allSessions={sessions} allStudents={studentsMap} setAllStudents={setSessionStudents}
                isAbsent={false}
                selectedIds={getSelectedIds(clone.id, studentsMap[clone.id]||[])}
                setSelectedIds={(ids)=>setSelectedIds(clone.id, ids)}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Absenti */}
      {absentSession && (
        <div>
          <SectionDivider sess={absentSession} isAbsent/>
          <div className="grid grid-cols-3 gap-6">
            <div className="bg-red-50 rounded-xl p-5 border border-red-100">
              <div className="flex items-center gap-2 mb-3">
                <UserX size={16} className="text-red-400"/>
                <h3 className="font-semibold text-sm text-red-700">Cursanți absenți</h3>
              </div>
              <p className="text-xs text-red-400">
                Cursanții absenți pot fi alocați la orice sesiune de practică viitoare folosind butonul → din dreptul numelui.
              </p>
            </div>
            <div className="col-span-2">
              <StudentsTable
                sess={absentSession} students={studentsMap[absentSession.id]||[]}
                setStudents={(sts)=>setSessionStudents(absentSession.id,sts)}
                allSessions={sessions} allStudents={studentsMap} setAllStudents={setSessionStudents}
                isAbsent={true}
                selectedIds={getSelectedIds(absentSession.id, studentsMap[absentSession.id]||[])}
                setSelectedIds={(ids)=>setSelectedIds(absentSession.id, ids)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}