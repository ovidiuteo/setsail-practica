'use client'
import React, { useEffect, useState, useRef, useCallback } from 'react'
import CIImageEditor from '@/components/CIImageEditor'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Download, FileText, Users, Copy, Plus, Trash2, Check, X, Pencil, GitBranch, ArrowRight, UserX, Mail, ChevronDown } from 'lucide-react'

function applyTemplate(text: string, sess: any, contacts?: any[]): string {
  if (!text) return ''
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'
  const sd  = sess?.session_date || ''
  const psd = sess?.practice_start_date || ''
  const vars: Record<string, string> = {
    'link_portal':                origin + '/portal?cod=' + (sess?.access_code || ''),
    'data_sesiune':               sd  ? new Date(sd).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'}) : '',
    'locatie':                    sess?.location_detail || sess?.locations?.name || '',
    'ambarcatiune':               sess?.boats?.name || '',
    'zz_data_start_practica':     psd ? String(new Date(psd).getDate()) : '',
    'zz_llll_data_practica':      sd  ? new Date(sd).toLocaleDateString('ro-RO', {day:'2-digit', month:'long'}) : '',
    'ora_start':                  sess?.practice_start_time || '9:30',
    'zz_data_start_curs':         sess?.course_start_date ? String(new Date(sess.course_start_date).getDate()) : '',
    'zz_llll_aaaa_data_practica': sd  ? new Date(sd).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'}) : '',
  }
  const contactIds: string[] = sess?.contact_person_ids || []
  const selected = (contacts || [])
    .filter((c: any) => contactIds.includes(c.id))
    .sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'ro'))
  const contactVars: Record<string, string> = {
    'pers_cont_1': selected[0]?.full_name || '',
    'pers_cont_2': selected[1]?.full_name || '',
    'pers_cont_3': selected[2]?.full_name || '',
    'pers_cont_4': selected[3]?.full_name || '',
    'tel_cont_1':  selected[0]?.phone || '',
    'tel_cont_2':  selected[1]?.phone || '',
    'tel_cont_3':  selected[2]?.phone || '',
    'tel_cont_4':  selected[3]?.phone || '',
  }
  let result = text
  for (const [key, val] of Object.entries({ ...vars, ...contactVars })) {
    result = result.split('{{' + key + '}}').join(val)
  }
  return result
}


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
  only_sailing: boolean
  notes?: string
  signature_pool?: boolean
  signature_random?: string
}
type Session = { id: string; session_date: string; course_start_date?: string; status: string; session_type: string; access_code: string; class_caa: string; request_number?: string; location_detail?: string; parent_session_id?: string; is_clone?: boolean; locations?: any; boats?: any; evaluators?: any; instructors?: any; contact_person_ids?: string[]; practice_start_date?: string; practice_start_time?: string }

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
        // Re-fetch din DB pentru a garanta ca avem imaginea noua, nu cea din cache
        const { data: fresh } = await supabase.from('students').select('*').eq('id', studentId).single()
        setStudents(students.map(s => s.id === studentId ? (fresh || {...s, ...updates}) : s))
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

function StudentsTable({ sess, students, setStudents, allSessions, allStudents, setAllStudents, isAbsent, onSelectionChange, selectedIds, setSelectedIds, onCiPreview }:
  { sess: Session, students: Student[], setStudents:(s:Student[])=>void,
    allSessions: Session[], allStudents: Record<string,Student[]>, setAllStudents:(sid:string,s:Student[])=>void,
    isAbsent: boolean, onSelectionChange?: (emails: string[]) => void,
    selectedIds: Set<string>, setSelectedIds: (s: Set<string>) => void,
    onCiPreview?: (name:string, img:string) => void }) {

  const [editingId, setEditingId] = useState<string|null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newSt, setNewSt] = useState<any>(EMPTY_ST)
  const [adding, setAdding] = useState(false)
  const [moving, setMoving] = useState<string|null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState<string|null>(null)
  const [showMovePrincipal, setShowMovePrincipal] = useState<string|null>(null)
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

    // Gasim label sesiunea tinta pentru nota
    const targetSess = allSessions.find(sess => sess.id === targetSessionId)
    const targetLabel = targetSess
      ? `${new Date(targetSess.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})} — ${(targetSess as any).locations?.name||''}`
      : targetSessionId

    // Gasim label sesiunea curenta (de unde vine absentul)
    const originSess = allSessions.find(sess => sess.id === s.session_id) || sess
    const originLabel = `${new Date(originSess.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})} — ${(originSess as any).locations?.name||''}`

    if (isAbsent) {
      // Absent -> alta sesiune: cream profil nou cu toate datele + nota
      const noteNou = [s.notes, `Absent de la sesiunea ${originLabel}`].filter(Boolean).join(' | ')
      await supabase.from('students').insert({
        session_id: targetSessionId,
        full_name: s.full_name,
        cnp: s.cnp,
        email: s.email,
        phone: s.phone,
        birth_date: s.birth_date,
        ci_series: s.ci_series,
        ci_number: s.ci_number,
        ci_image_data: s.ci_image_data,
        address: s.address,
        city: (s as any).city,
        county: s.county,
        class_caa: s.class_caa,
        order_in_session: maxOrder + 1,
        portal_status: 'pending',
        original_session_id: targetSessionId,
        notes: noteNou,
      })
      // Pe profilul vechi (sesiunea absent) adaugam nota si il lasam acolo
      const noteVechi = [s.notes, `A făcut practica la sesiunea ${targetLabel}`].filter(Boolean).join(' | ')
      await supabase.from('students').update({ notes: noteVechi }).eq('id', s.id)
      // Scoatem din lista de absenti in UI
      setStudents(students.filter(st => st.id !== s.id))
    } else {
      // Mutare normala (non-absent) -> alt slot
      await supabase.from('students').update({ session_id: targetSessionId, order_in_session: maxOrder+1 }).eq('id', s.id)
      const remaining = students.filter(st => st.id !== s.id)
      const reordered = await reorder(remaining)
      setStudents(reordered)
      setAllStudents(targetSessionId, [...targetStudents, {...s, session_id: targetSessionId, order_in_session: maxOrder+1}])
    }
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


  async function markSailing(s: Student) {
    // Gasim sesiunea principala (parent) pentru a muta cursantul acolo
    const mainSess = allSessions.find(sess => sess.session_type === 'principal' && !sess.parent_session_id)
      || allSessions.find(sess => sess.session_type === 'principal')
    const targetSessionId = mainSess?.id || s.session_id

    // Mutam cursantul la sesiunea principala cu only_sailing=true
    const maxOrder = Math.max(0, ...(allStudents[targetSessionId]||[]).map(st => st.order_in_session || 0))
    await supabase.from('students').update({
      only_sailing: true,
      session_id: targetSessionId,
      order_in_session: maxOrder + 1,
    }).eq('id', s.id)

    // Scoatem din lista curenta
    setStudents(students.filter(st => st.id !== s.id))
    // Adaugam la sesiunea principala in state
    if (targetSessionId !== sess.id) {
      const updated = { ...s, only_sailing: true, session_id: targetSessionId, order_in_session: maxOrder + 1 }
      setAllStudents(targetSessionId, [...(allStudents[targetSessionId]||[]), updated])
    }
  }

  async function moveToPrincipalSession(s: Student, targetSessionId: string) {
    setMoving(s.id); setShowMovePrincipal(null)
    const { data: targetSts } = await supabase.from('students').select('order_in_session')
      .eq('session_id', targetSessionId).order('order_in_session', {ascending: false}).limit(1)
    const maxOrder = (targetSts as any)?.[0]?.order_in_session || 0
    await supabase.from('students').update({
      session_id: targetSessionId,
      order_in_session: maxOrder + 1,
      portal_status: 'pending',
      only_sailing: false,
    }).eq('id', s.id)
    setStudents(students.filter(st => st.id !== s.id))
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
          <span className="font-semibold text-sm text-gray-900">Cursanți ({students.filter((s:Student)=>!s.only_sailing).length})</span>
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
                <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option><option value="Radio">Radio</option><option value="Obtinere LRC">Obținere LRC</option><option value="Prelungire LRC">Prelungire LRC</option></select></div>
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
              {getSorted(students.filter((s:Student)=>!s.only_sailing)).map((s,i) => {
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
                        <option value="A">A</option><option value="B">B</option><option value="C">C</option><option value="D">D</option><option value="C,D">C,D</option><option value="Radio">Radio</option><option value="Obtinere LRC">Obținere LRC</option><option value="Prelungire LRC">Prelungire LRC</option></select></td>
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
                      {/* Nume — click deschide pagina admin cursant */}
                      <td className="px-2 py-2">
                        <Link href={`/admin/cursanti/${s.id}`} target="_blank" rel="noopener noreferrer"
                          className="font-medium text-gray-900 hover:text-blue-600 hover:underline cursor-pointer text-xs block">
                          {s.full_name}
                        </Link>
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
                          <button onClick={()=>onCiPreview?.(s.full_name, s.ci_image_data)}
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
                        ) : (s as any).signature_random ? (
                          <button onClick={()=>{const w=window.open('','_blank');w?.document.write(`<img src="${(s as any).signature_random}" style="max-width:400px;border:1px solid #ccc;padding:10px;background:#fff;"/>`)}}
                            title="Semnătură random alocată — invizibilă pe portal"
                            className="p-1 rounded hover:bg-purple-100 transition-colors">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                          {/* Muta la Sailing */}
                          {!isAbsent && !s.only_sailing && (
                            <button onClick={()=>markSailing(s)}
                              className="p-1.5 rounded border border-orange-100 text-orange-400 hover:text-orange-600 hover:bg-orange-50 transition-colors font-bold text-xs w-7 h-7 flex items-center justify-center"
                              title="Mută la Sailing (categoria S) — dispare din liste și PV">
                              S
                            </button>
                          )}
                          {/* Muta la alta sesiune principala - sageata rosie */}
                          {!isAbsent && (
                            <div className="relative">
                              <button
                                onClick={async(e)=>{
                                  e.stopPropagation()
                                  setShowMovePrincipal(prev => prev===s.id ? null : s.id)
                                }}
                                disabled={moving===s.id}
                                title="Mută la altă sesiune principală"
                                className="p-1.5 rounded border border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50 transition-colors">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <line x1="5" y1="12" x2="19" y2="12"/>
                                  <polyline points="12 5 19 12 12 19"/>
                                </svg>
                              </button>
                              {showMovePrincipal===s.id && (
                                <OtherPrincipalDropdown
                                  currentGroupIds={new Set(allSessions.map(x=>x.id))}
                                  onSelect={(tid)=>moveToPrincipalSession(s, tid)}
                                  onClose={()=>setShowMovePrincipal(null)}
                                />
                              )}
                            </div>
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
    body: (sess: any) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'
      const link = `${origin}/portal?cod=${sess.access_code}`
      return `Stimate/Stimată cursant,

Vă rugăm să accesați portalul SetSail Practică și să completați datele personale (serie CI, număr CI, semnătură) înainte de data sesiunii.

Link portal: ${link}

Data sesiunii: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}
Locația: ${sess.location_detail || sess.locations?.name || ''}

Vă mulțumim,
Echipa SetSail`
    },
  },
  {
    label: '⏰ Completați portalul',
    subject: 'Reminder: date lipsă în portal - SetSail Practică',
    body: (sess: any) => {
      const origin = typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'
      const link = `${origin}/portal?cod=${sess.access_code}`
      return `Stimate/Stimată cursant,

Am observat că nu ați completat încă datele personale în portalul SetSail Practică. Sesiunea de practică se apropie și avem nevoie de datele dvs. (serie CI, număr CI) pentru a putea emite documentele oficiale.

Vă rugăm să accesați portalul cât mai curând:
${link}

Data sesiunii: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}

Vă mulțumim,
Echipa SetSail`
    },
  },
  {
    label: '📅 Reminder sesiune',
    subject: 'Reminder: sesiunea de practică are loc mâine',
    body: (sess: any) => `Stimate/Stimată cursant,\n\nVă reamintim că sesiunea de practică de conducere a ambarcațiunii de agrement are loc mâine.\n\nData: ${new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})}\nLocația: ${sess.location_detail || sess.locations?.name || ''}\nAmbarcațiunea: ${sess.boats?.name || ''}\n\nVă rugăm să fiți prezenți cu 15 minute înainte și să aveți cartea de identitate la dumneavoastră.\n\nSucces!\nEchipa SetSail`,
  },
]

const DROPDOWN_TEMPLATES = [
  {
    label: '⛵ Practică 18-20 mai - Detalii organizatorice',
    subject: '⛵ Practică navigație 18-20 mai - Detalii organizatorice',
    body: (sess: any) => `Ahoy,

În perioada 18-20 mai ne vom întâlni pentru cele 3 zile de practică. Ne vedem la ora 9:30 în marina Limanu (LifeHarbour), unde vom forma echipajele și veți face cunoștință cu instructorii Set Sail.

Ne așteaptă trei zile frumoase, pline de navigație și voie bună! 🙂⛵

Program luni – miercuri:
Manevre cu motorul și navigație cu vele – în funcție de condițiile meteo, vom decide ce zi dedicăm manevrelor și ce zi navigației cu vele.
Miercuri la ora 10:00 este proba practică cu ANR, urmează testarea internă SetSail și o ultimă tură de navigație sau manevre până spre 18:00.
Pauza de prânz este între 14:00 și 16:00, timp numai bun de relaxare și socializare.

Dacă ești sensibil la valuri, ia cu tine Emetix sau ceva echivalent.
Vom face poze, iar unele vor ajunge pe paginile noastre de social media. Dacă nu vrei să apari, spune-ne.

Te rugăm să accesezi PORTALUL DE PRACTICĂ care cere upload CI pentru a completa datele necesare fișei de evaluare ANR: \${typeof window !== 'undefined' ? window.location.origin : 'https://setsail-practica.vercel.app'}/portal?cod=\${sess.access_code}

Pe mare va fi chiar frig seara, așa că mai bine pregătit decât surprins!

Echipament obligatoriu:
pantofi sport și pantaloni lungi sport (impermeabili dacă e prognoză de ploaie), tricou cu mânecă lungă, hanorac, geacă de vânt, geacă groasă, căciulă, șapcă, cremă cu protecție solară.

Echipament recomandat:
pantaloni de yachting, geacă și mănuși de yachting, încălțăminte de yachting, polar, sac marinar (drybag), cizme de cauciuc de yachting, salopetă de yachting, cagulă.

Ploaia în sine nu ne deranjează foarte tare — navigatorii sunt destul de obișnuiți cu apa. ⛵🙂 Practica se desfășoară normal chiar dacă plouă, atât timp cât condițiile sunt sigure.
Amânăm ieșirile doar în caz de vreme extremă, de exemplu vânt puternic (peste 25–30 noduri) sau temperaturi foarte scăzute, sub aproximativ 5–7°C.

Persoane de contact (Marina Limanu):
Paula Drugan – 0722 488 973
Ovidiu Drugan – 0735 557 337

Vă așteptăm la bord!
SetSail NauticSchool`,
    html: (sess: any) => `<!DOCTYPE html>
<html lang="ro">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Practică navigație</title></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

<!-- HEADER -->
<tr><td style="background:#1e3a5f;padding:32px 40px;text-align:center;">
  <div style="font-size:28px;margin-bottom:8px;">⛵</div>
  <div style="color:#ffffff;font-size:22px;font-weight:bold;letter-spacing:0.5px;">SetSail NauticSchool</div>
  <div style="color:#f0b429;font-size:13px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Practică navigație</div>
</td></tr>

<!-- SALUT -->
<tr><td style="padding:32px 40px 0 40px;">
  <p style="margin:0;font-size:18px;font-weight:bold;color:#1e3a5f;">Ahoy! 👋</p>
  <p style="margin:12px 0 0 0;font-size:15px;color:#444;line-height:1.7;">
    În perioada <strong>18-20 mai</strong> ne vom întâlni pentru cele 3 zile de practică. Ne vedem la <strong>ora 9:30</strong> în marina Limanu (LifeHarbour), unde vom forma echipajele și veți face cunoștință cu instructorii Set Sail.
  </p>
  <p style="margin:12px 0 0 0;font-size:15px;color:#444;line-height:1.7;">
    Ne așteaptă trei zile frumoase, pline de navigație și voie bună! 🙂⛵
  </p>
</td></tr>

<!-- PROGRAM -->
<tr><td style="padding:24px 40px 0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f4fd;border-radius:8px;border-left:4px solid #1e90ff;padding:0;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:14px;font-weight:bold;color:#1e3a5f;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.5px;">📅 Program luni – miercuri</div>
    <p style="margin:0 0 8px 0;font-size:14px;color:#333;line-height:1.6;">
      <strong>Manevre cu motorul și navigație cu vele</strong> – în funcție de condițiile meteo, vom decide ce zi dedicăm manevrelor și ce zi navigației cu vele.
    </p>
    <p style="margin:0 0 8px 0;font-size:14px;color:#333;line-height:1.6;">
      <strong>Miercuri la ora 10:00</strong> este proba practică cu ANR, urmează testarea internă SetSail și o ultimă tură de navigație sau manevre până spre 18:00.
    </p>
    <p style="margin:0;font-size:14px;color:#333;line-height:1.6;">
      Pauza de prânz este între <strong>14:00 și 16:00</strong>, timp numai bun de relaxare și socializare.
    </p>
  </td></tr>
  </table>
</td></tr>

<!-- PORTAL -->
<tr><td style="padding:20px 40px 0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff3cd;border-radius:8px;border-left:4px solid #e53e3e;padding:0;">
  <tr><td style="padding:16px 20px;">
    <p style="margin:0;font-size:14px;color:#7a5c00;line-height:1.6;">
      🪪 <strong>Te rugăm să accesezi PORTALUL DE PRACTICĂ</strong> care cere upload CI pentru a completa datele necesare fișei de evaluare ANR:<br>
      <a href="https://setsail-practica.vercel.app/portal?cod=${sess.access_code}" style="color:#1e3a5f;font-weight:bold;text-decoration:underline;">https://setsail-practica.vercel.app/portal?cod=${sess.access_code}</a>
    </p>
  </td></tr>
  </table>
</td></tr>

<!-- INFO DIVERSE -->
<tr><td style="padding:20px 40px 0 40px;">
  <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
    Dacă ești sensibil la valuri, ia cu tine <strong>Emetix</strong> sau ceva echivalent.<br>
    Vom face poze, iar unele vor ajunge pe paginile noastre de social media. Dacă nu vrei să apari, spune-ne.
  </p>
</td></tr>

<!-- ECHIPAMENT OBLIGATORIU -->
<tr><td style="padding:20px 40px 0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff8e1;border-radius:8px;border-left:4px solid #f0b429;padding:0;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:14px;font-weight:bold;color:#7a5c00;margin-bottom:10px;">🎒 Echipament obligatoriu</div>
    <p style="margin:0;font-size:13px;color:#555;line-height:1.8;">
      pantofi sport și pantaloni lungi sport (impermeabili dacă e prognoză de ploaie), tricou cu mânecă lungă, hanorac, geacă de vânt, geacă groasă, căciulă, șapcă, cremă cu protecție solară.
    </p>
  </td></tr>
  </table>
</td></tr>

<!-- ECHIPAMENT RECOMANDAT -->
<tr><td style="padding:16px 40px 0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#e8f5e9;border-radius:8px;border-left:4px solid #43a047;padding:0;">
  <tr><td style="padding:18px 20px;">
    <div style="font-size:14px;font-weight:bold;color:#2e7d32;margin-bottom:10px;">⭐ Echipament recomandat</div>
    <p style="margin:0;font-size:13px;color:#555;line-height:1.8;">
      pantaloni de yachting, geacă și mănuși de yachting, încălțăminte de yachting, polar, sac marinar (drybag), cizme de cauciuc de yachting, salopetă de yachting, cagulă.
    </p>
  </td></tr>
  </table>
</td></tr>

<!-- VREME -->
<tr><td style="padding:20px 40px 0 40px;">
  <p style="margin:0;font-size:14px;color:#555;line-height:1.7;">
    Ploaia în sine nu ne deranjează foarte tare — navigatorii sunt destul de obișnuiți cu apa. ⛵🙂 Practica se desfășoară normal chiar dacă plouă, atât timp cât condițiile sunt sigure.<br><br>
    Amânăm ieșirile doar în caz de <strong>vreme extremă</strong>, de exemplu vânt puternic (peste 25–30 noduri) sau temperaturi foarte scăzute, sub aproximativ 5–7°C.<br><br>
    Dacă apar condiții care țin de siguranță, anunțăm cât putem de repede orice modificare.
  </p>
</td></tr>

<!-- CONTACT -->
<tr><td style="padding:24px 40px 0 40px;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#1e3a5f;border-radius:8px;padding:0;">
  <tr><td style="padding:20px 24px;">
    <div style="font-size:14px;font-weight:bold;color:#f0b429;margin-bottom:12px;">📞 Persoane de contact (Marina Limanu)</div>
    <table cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;">
          <span style="color:#ffffff;font-size:14px;">Paula Drugan &nbsp;</span>
          <a href="tel:0722488973" style="color:#f0b429;font-weight:bold;text-decoration:none;font-size:14px;">0722 488 973</a>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;">
          <span style="color:#ffffff;font-size:14px;">Ovidiu Drugan &nbsp;</span>
          <a href="tel:0735557337" style="color:#f0b429;font-weight:bold;text-decoration:none;font-size:14px;">0735 557 337</a>
        </td>
      </tr>
    </table>
  </td></tr>
  </table>
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:32px 40px;text-align:center;border-top:1px solid #eee;margin-top:24px;">
  <p style="margin:0 0 8px 0;font-size:16px;font-weight:bold;color:#1e3a5f;">Vă așteptăm la bord! ⚓</p>
  <p style="margin:0;font-size:13px;color:#888;">SetSail NauticSchool</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`
  },
  { label: 'Modificare dată sesiune', subject: 'Modificare dată sesiune de practică', body: 'Stimate/Stimată cursant,\n\nVă informăm că sesiunea de practică a suferit modificări de dată.\n\nNoua dată: [data nouă]\nLocația: [locație]\n\nVă rugăm să confirmați participarea.\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Documente necesare', subject: 'Documente necesare pentru examenul practic', body: 'Stimate/Stimată cursant,\n\nVă rugăm să aveți asupra dvs. la prezentare:\n- Cartea de identitate (original)\n- Adeverința de curs\n- Chitanța de plată taxă examen\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Felicitări promovare', subject: 'Felicitări pentru promovarea examenului practic!', body: 'Stimate/Stimată cursant,\n\nVă felicităm pentru promovarea cu succes a examenului practic!\n\nCertificatul dumneavoastră va fi emis în cel mai scurt timp.\n\nCu stimă,\nEchipa SetSail' },
  { label: 'Informații locație', subject: 'Informații locație examen practic', body: 'Stimate/Stimată cursant,\n\nVă transmitem detalii despre locația sesiunii de practică:\n\n[adresa locației]\n\nVă recomandăm să sosiți cu 15 minute înainte.\n\nCu stimă,\nEchipa SetSail' },
]

function SidebarCard({ sess, students, allStatuses, onStatusChange, allSessions, allStudents, onEditSession }:
  { sess: Session, students: Student[], allStatuses: string[], onStatusChange:(sid:string,status:string)=>void, allSessions: Session[], allStudents: Record<string,Student[]>, onEditSession:(s:Session)=>void }) {
  const [dbTemplates, setDbTemplates] = useState<any[]>([])
  const [allContacts, setAllContacts] = useState<any[]>([])
  const [sessionContactIds, setSessionContactIds] = useState<string[]>(sess.contact_person_ids || [])
  const [showMailAuth, setShowMailAuth] = useState(false)
  const [authSubject, setAuthSubject] = useState('')
  const [authBody, setAuthBody] = useState('')
  const [authCopied, setAuthCopied] = useState(false)
  const [selectedAuthCategory, setSelectedAuthCategory] = useState<string | null>(null)
  const [showNrModal, setShowNrModal] = useState<'solicitare'|'document'|null>(null)
  const [nrModalData, setNrModalData] = useState<any[]>([])
  const [nrModalNext, setNrModalNext] = useState(1)
  const [nrModalDate, setNrModalDate] = useState(new Date().toISOString().slice(0,10))
  const [nrModalLoading, setNrModalLoading] = useState(false)
  const [gPV, setGPV] = useState(false)
  const [gFise, setGFise] = useState(false)
  const [gPDF, setGPDF] = useState(false)
  const [notif, setNotif] = useState<any>(null)
  const [notifForm, setNotifForm] = useState({ nr_notificare:'', ora_examinare:'10:00', barci_selectate:[] as string[], clasa:'', locatie_curs:'', locatie_examinare:'' })
  const [notifScanFile, setNotifScanFile] = useState<string|null>(null)
  const [showNotif, setShowNotif] = useState(false)
  const [gNotif, setGNotif] = useState(false)
  const [notifSaved, setNotifSaved] = useState(false)
  const notifScanRef = useRef<HTMLInputElement|null>(null)

  useEffect(() => {
    supabase.from('mail_templates').select('*').eq('activ', true).order('categorie').order('label')
      .then(({ data }) => setDbTemplates(data || []))
    supabase.from('contact_persons').select('*').eq('activ', true).order('full_name')
      .then(({ data }) => setAllContacts(data || []))
  }, [])

  const SOL_TIPS = [
    { key: 'curs-obtinere',    label: 'Curs Obținere LRC' },
    { key: 'examen-obtinere',  label: 'Examen Obținere LRC' },
    { key: 'curs-prelungire',  label: 'Curs Prelungire LRC' },
    { key: 'examen-prelungire',label: 'Examen Prelungire LRC' },
  ]
  const DOC_TIPS = [
    { key: 'pv-obtinere',      label: 'PV Obținere LRC' },
    { key: 'anexa-pv-obtinere',label: 'Anexă PV Obținere LRC' },
    { key: 'pv-prelungire',    label: 'PV Prelungire LRC' },
    { key: 'anexa-pv-prelungire', label: 'Anexă PV Prelungire LRC' },
  ]

  async function openNrModal(tip: 'solicitare'|'document') {
    setShowNrModal(tip)
    setNrModalLoading(true)
    setNrModalDate(new Date().toISOString().slice(0,10))
    const { data } = await supabase
      .from('notification_numbers')
      .select('*')
      .order('numar', { ascending: false })
    const history = data || []
    setNrModalData(history)
    const maxNr = history.length > 0 ? Math.max(...history.map((r:any) => r.numar)) : 0
    setNrModalNext(maxNr + 1)
    setNrModalLoading(false)
  }

  async function confirmNrModal() {
    if (!showNrModal) return
    const tip = showNrModal
    const first = nrModalNext
    // Intotdeauna alocam 4 numere consecutive (cate 4 tipuri per serie)
    const tips = tip === 'solicitare' ? SOL_TIPS : DOC_TIPS
    const rows = tips.map((d, i) => ({
      numar: first + i,
      data_notificare: nrModalDate,
      document: d.label,
      document_tip: d.key,
      session_id: sess.id,
      tip,
    }))
    await supabase.from('notification_numbers').insert(rows)
    // Salvam intervalul in sesiune
    if (tip === 'solicitare') {
      await supabase.from('sessions').update({ request_number: String(first) + '-' + String(first+3) }).eq('id', sess.id)
    } else {
      await supabase.from('sessions').update({ nr_document_ancom: String(first) + '-' + String(first+3) }).eq('id', sess.id)
    }
    setShowNrModal(null)
    // Refresh pagina ca sa apara noile numere
    window.location.reload()
  }

  const [copied, setCopied] = useState(false)
  const [showMail, setShowMail] = useState(false)
  const [mailTo, setMailTo] = useState('')
  const [mailSubject, setMailSubject] = useState('')
  const [mailBody, setMailBody] = useState('')
  const [mailCopied, setMailCopied] = useState<string|null>(null)
  const [selectedEmails, setSelectedEmails] = useState<string[]>(
    () => students.filter(s=>s.email).map(s=>s.email)
  )

  // Sincronizeaza BCC automat - include toti cursantii din TOATE sesiunile (principal+clone+absenti+sailing)
  // Toti cursantii din sesiunile ACESTEI sesiuni (principal + clone + absenti + sailing)
  const currentSessionIds = new Set(allSessions.map((s:Session) => s.id))
  const allCommStudents = Object.values(allStudents)
    .flat()
    .filter((s: Student) => currentSessionIds.has(s.session_id)) as Student[]
  useEffect(()=>{
    const commEmails = allCommStudents
      .filter(s=>s.email && s.communication_target)
      .map(s=>s.email as string)
      .filter((e,i,arr)=>arr.indexOf(e)===i) // deduplicare
    setSelectedEmails(commEmails)
  }, [allCommStudents.map(s=>s.id+'_'+s.communication_target).join(',')])

  useEffect(()=>{
    setMailTo(selectedEmails.join(', '))
  }, [selectedEmails.join(',')])



  function calcNotifDefaults() {
    const locName = ((sess as any).locations?.name || '').toLowerCase()
    const isSnagov = locName.includes('snagov')
    const isClassB = sess.class_caa?.includes('B')
    const adr = 'str. Virgiliu nr. 15, etaj 3, Sector 1, București'
    const locatieCurs = isSnagov ? `${adr}/Lacul Snagov`
      : locName.includes('limanu') ? `${adr}/Marina Limanu`
      : locName.includes('mangalia') ? `${adr}/Marina Mangalia`
      : `${adr}/${(sess as any).locations?.name || ''}`
    const locatieExaminare = isSnagov ? 'de pe Lacul Snagov'
      : locName.includes('limanu') ? 'din Marina Limanu'
      : locName.includes('mangalia') ? 'din Marina Mangalia'
      : `din ${(sess as any).locations?.name || ''}`
    return {
      nr_notificare: '',
      ora_examinare: '10:00',
      clasa: isClassB ? 'B/Manevra ambarcatiunii cu vele' : 'C/D/Manevra ambarcatiunii cu vele',
      barci_selectate: isSnagov ? ['Trainer 1', 'Trainer 2'] : ['SetSail', 'Trainer 2'],
      locatie_curs: locatieCurs,
      locatie_examinare: locatieExaminare,
    }
  }

  async function ensureNotification(): Promise<string|null> {
    // Folosim upsert cu on_conflict=session_id — creaza daca nu exista, nu face nimic daca exista
    const { data: existing } = await supabase
      .from('notifications').select('*')
      .eq('session_id', sess.id).single()

    if (existing?.id) {
      // Exista deja — actualizeaza state-ul si returneaza id-ul
      setNotif(existing)
      setNotifForm({
        nr_notificare: existing.nr_notificare || '',
        ora_examinare: existing.ora_examinare || '10:00',
        clasa: existing.clasa || '',
        barci_selectate: existing.barci_selectate || [],
        locatie_curs: existing.locatie_curs || '',
        locatie_examinare: existing.locatie_examinare || '',
      })
      setNotifScanFile(existing.scanned_file_data || null)
      return existing.id
    }

    // Nu exista — creaza cu valorile default
    const defaults = calcNotifDefaults()
    const { data, error } = await supabase.from('notifications')
      .insert({ session_id: sess.id, ...defaults, data_notificare: new Date().toISOString().split('T')[0] })
      .select().single()
    if (error) { console.error('Insert error:', error); return null }
    if (data) {
      setNotif(data)
      setNotifForm({
        nr_notificare: data.nr_notificare || '',
        ora_examinare: data.ora_examinare || '10:00',
        clasa: data.clasa || '',
        barci_selectate: data.barci_selectate || [],
        locatie_curs: data.locatie_curs || '',
        locatie_examinare: data.locatie_examinare || '',
      })
      return data.id
    }
    return null
  }

  async function saveNotification(): Promise<string|null> {
    // Gasim id-ul (din state sau din DB)
    let notifId = notif?.id
    if (!notifId) {
      const { data: existing } = await supabase
        .from('notifications').select('id').eq('session_id', sess.id).single()
      notifId = existing?.id
    }

    const payload = {
      ...notifForm,
      // clasa se salveaza exact cum e editata (text liber)
      scanned_file_data: notifScanFile
    }

    if (notifId) {
      const { error } = await supabase.from('notifications').update(payload).eq('id', notifId)
      if (error) { console.error('Update error:', error); return null }
      return notifId
    } else {
      // Fallback: creaza cu upsert
      const { data, error } = await supabase.from('notifications')
        .insert({ session_id: sess.id, ...payload, data_notificare: new Date().toISOString().split('T')[0] })
        .select().single()
      if (error) { console.error('Insert error:', error); return null }
      if (data) { setNotif(data); return data.id }
      return null
    }
  }

  async function generateNotificare(cuStampila: boolean, format: 'docx'|'pdf') {
    setGNotif(true)
    try {
      const notifId = await saveNotification()
      if (!notifId) { alert('Eroare la salvarea notificării. Verificați consola.'); setGNotif(false); return }
      const res = await fetch('/api/generate-notificare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notification_id: notifId, cu_stampila: cuStampila, format })
      })
      if (format === 'pdf') {
        // PDF - deschidem HTML-ul intr-o fereastra noua pentru print
        const html = await res.text()
        const w = window.open('', '_blank')
        if (w) { w.document.write(html); w.document.close(); setTimeout(()=>w.print(), 800) }
      } else {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const cd = res.headers.get('Content-Disposition') || ''
        const fn = cd.match(/filename="(.+)"/)?.[1] || 'notificare.docx'
        const a = document.createElement('a'); a.href = url; a.download = fn; a.click()
      }
    } catch(e: any) { alert(e.message) }
    setGNotif(false)
  }

  async function generateDoc(endpoint: string, filename: string) {
    const res = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id})})
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }
  async function generateDocRadio(endpoint: string, filename: string, tip: string, format: string) {
    const res = await fetch(endpoint, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id, tip, format})})
    if (!res.ok) throw new Error(await res.text())
    const blob = await res.blob()
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click()
  }

  const st = statusMap[sess.status] || statusMap.draft
  const isAbsent = sess.session_type === 'absent'
  const isRadio = (sess.class_caa || '').toLowerCase().includes('radio') || (sess.class_caa || '').toLowerCase().includes('lrc')

  return (
    <>
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-sm text-gray-900 mb-3">Detalii sesiune</h3>
        <div className="space-y-2">
          {([
            ['Data start curs', sess.course_start_date ? new Date(sess.course_start_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'}) : '—'],
            ['Data start practică', (sess as any).practice_start_date ? new Date((sess as any).practice_start_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'}) : '—'],
            ['Ora start', (sess as any).practice_start_time || '9:30'],
            ['Data practică', new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'})],
            ['Instructor', sess.instructors?.full_name],
            ['Evaluator ANR', sess.evaluators?.full_name],
            ['Decizie ANR', sess.evaluators?.decision_number],
            ['Ambarcațiune', sess.boats?.name||'—'],
            ['Clasa CAA', sess.class_caa],
            ['Nr. înștiințări', sess.request_number||'—'],
            ['Nr. documente PV', (sess as any).nr_document_ancom||'—'],
            ['Locație detaliată', sess.location_detail||'—'],
          ] as [string,string][]).map(([label,value]) => (
            <div key={label} className="flex justify-between gap-2">
              <span className="text-gray-400 text-xs shrink-0">{label}</span>
              {label === 'Nr. înștiințări' ? (
                <button onClick={()=>openNrModal('solicitare')}
                  className="text-xs font-medium text-blue-600 hover:underline text-right">
                  {value === '—' ? '+ Alocă număr' : value}
                </button>
              ) : label === 'Nr. documente PV' ? (
                <button onClick={()=>openNrModal('document')}
                  className="text-xs font-medium text-purple-600 hover:underline text-right">
                  {value === '—' ? '+ Alocă număr' : value}
                </button>
              ) : (
                <span className="text-gray-900 text-xs text-right font-medium">{value}</span>
              )}
            </div>
          ))}
        </div>
        {/* Persoane de contact sesiune */}
        {!isAbsent && allContacts.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <div className="text-xs text-gray-400 mb-2">Persoane de contact</div>
            <div className="space-y-1.5">
              {allContacts.map((c: any) => (
                <label key={c.id} className="flex items-center gap-2 cursor-pointer group">
                  <input type="checkbox"
                    checked={sessionContactIds.includes(c.id)}
                    onChange={async (e) => {
                      const newIds = e.target.checked
                        ? [...sessionContactIds, c.id]
                        : sessionContactIds.filter((id: string) => id !== c.id)
                      setSessionContactIds(newIds)
                      await supabase.from('sessions').update({ contact_person_ids: newIds }).eq('id', sess.id)
                    }}
                    className="rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-gray-800">{c.full_name}</span>
                    <a href={'tel:' + c.phone.replace(/ /g,'')}
                      className="text-xs text-blue-600 ml-2 hover:underline"
                      onClick={e => e.stopPropagation()}>
                      {c.phone}
                    </a>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Statistici cursanti */}
        {!isAbsent && (
          <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
            {(() => {
              const activeSessions2 = allSessions.filter((s:any) => s.session_type !== 'absent' && s.session_type !== 'clone' && !s.is_clone)
              const cloneSessions2 = allSessions.filter((s:any) => s.session_type === 'clone' || s.is_clone)
              const absentSess2 = allSessions.find((s:any) => s.session_type === 'absent')
              const sailingAll = allSessions.filter((s:any)=>s.session_type!=='absent').flatMap((s:any)=>(allStudents[s.id]||[]).filter((st:Student)=>st.only_sailing))
              const absentAll = absentSess2 ? (allStudents[absentSess2.id]||[]) : []
              const principalCount = (allStudents[allSessions.find((s:any)=>s.session_type==='principal'&&!s.parent_session_id)?.id||'']||[]).filter((s:Student)=>!s.only_sailing).length
              const total = allSessions.filter((s:any)=>s.session_type!=='absent').flatMap((s:any)=>(allStudents[s.id]||[])).length
              return (
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-gray-700">Total cursanți:</span>
                    <span className="font-bold text-gray-900">{total}</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Lista 1 (principal):</span>
                    <span className="font-medium">{principalCount}</span>
                  </div>
                  {cloneSessions2.map((cl:any, ci:number) => (
                    <div key={cl.id} className="flex justify-between text-xs text-gray-500">
                      <span>Lista {ci+2} ({cl.session_date ? new Date(cl.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short'}) : 'clonă'}):</span>
                      <span className="font-medium">{(allStudents[cl.id]||[]).filter((s:Student)=>!s.only_sailing).length}</span>
                    </div>
                  ))}
                  {sailingAll.length > 0 && (
                    <div className="flex justify-between text-xs text-orange-600">
                      <span>⛵ Sailing:</span>
                      <span className="font-medium">{sailingAll.length}</span>
                    </div>
                  )}
                  {absentAll.length > 0 && (
                    <div className="flex justify-between text-xs text-red-500">
                      <span>Absenți:</span>
                      <span className="font-medium">{absentAll.length}</span>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
        )}

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
              {(sess.session_type === 'clone' || sess.is_clone) && (
                <button onClick={()=>{
                  // Deschide modalul de editare sesiune (reutilizam startEditSession)
                  onEditSession(sess)
                }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 border-blue-200 text-blue-600 hover:bg-blue-50 transition-all">
                  ✎ Editează
                </button>
              )}
              {(sess.session_type === 'clone' || sess.is_clone) && (
                <button onClick={async()=>{
                  if (!window.confirm('Ștergi clona?\n\nCursanții vor fi mutați înapoi la sesiunea principală.')) return
                  // parent_session_id e sesiunea principala
                  const principalId = sess.parent_session_id
                  if (principalId && students.length > 0) {
                    const { data: pSts } = await supabase.from('students').select('order_in_session').eq('session_id', principalId).order('order_in_session',{ascending:false}).limit(1)
                    const maxOrder = pSts?.[0]?.order_in_session || 0
                    for (let i = 0; i < students.length; i++) {
                      await supabase.from('students').update({ session_id: principalId, order_in_session: maxOrder + i + 1, only_sailing: false }).eq('id', students[i].id)
                    }
                  }
                  // Stergem sesiunea absent a clonei
                  await supabase.from('sessions').delete().eq('parent_session_id', sess.id).eq('session_type','absent')
                  await supabase.from('sessions').delete().eq('id', sess.id)
                  window.location.reload()
                }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium border-2 border-red-200 text-red-500 hover:bg-red-50 transition-all">
                  🗑 Șterge clona
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {!isAbsent && (
        <>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-2">Link portal</h3>
            {/* Clona: optiune portal propriu sau impartit cu principala */}
            <ClonePortalOption sess={sess} />
            {sess.status === 'draft' ? (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                Sesiunea nu este activă. Portal inaccesibil.
              </div>
            ) : (sess.status === 'active' || sess.status === 'focus') ? (
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                Portal accesibil
              </div>
            ) : null}
            <div className="bg-gray-50 rounded-lg p-3 font-mono text-xs text-gray-600 break-all mb-3">/portal?cod=<strong>{sess.access_code}</strong></div>
            <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/portal?cod=${sess.access_code}`);setCopied(true);setTimeout(()=>setCopied(false),2000)}}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
              <Copy size={12}/>{copied?'✓ Copiat!':'Copiază link'}
            </button>
            <div className="mt-3 text-xs text-gray-400 text-center">{students.filter(s=>s.portal_status==='signed').length}/{students.filter(s=>!s.only_sailing).length} cursanți au semnat</div>
          </div>

          {/* Instiintari ANCOM - doar pentru sesiuni Radio */}
          {isRadio && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-purple-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Înștiințări ANCOM</h3>
              <div className="space-y-2">
                {/* 1. Curs Obtinere */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-instiintare-ancom',`Instiintare_ANCOM_curs-obtinere_${sess.session_date}.docx`,'curs-obtinere','docx')}catch(e:any){alert(e.message)}}}
                    disabled={false} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#1d4ed8'}}>
                    <FileText size={11}/>Curs Obținere
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-instiintare-ancom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'curs-obtinere',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#dc2626'}}>
                    <Download size={11}/>PDF Curs Obținere
                  </button>
                </div>
                {/* 2. Examen Obtinere */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-instiintare-ancom',`Instiintare_ANCOM_examen-obtinere_${sess.session_date}.docx`,'examen-obtinere','docx')}catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#1d4ed8'}}>
                    <FileText size={11}/>Examen Obținere
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-instiintare-ancom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'examen-obtinere',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#dc2626'}}>
                    <Download size={11}/>PDF Examen Obținere
                  </button>
                </div>
                {/* Separator */}
                <div className="border-t border-gray-100 pt-1 mt-1"/>
                {/* 3. Curs Prelungire */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-instiintare-ancom',`Instiintare_ANCOM_curs-prelungire_${sess.session_date}.docx`,'curs-prelungire','docx')}catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#1d4ed8'}}>
                    <FileText size={11}/>Curs Prelungire
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-instiintare-ancom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'curs-prelungire',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#dc2626'}}>
                    <Download size={11}/>PDF Curs Prelungire
                  </button>
                </div>
                {/* 4. Examen Prelungire */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-instiintare-ancom',`Instiintare_ANCOM_examen-prelungire_${sess.session_date}.docx`,'examen-prelungire','docx')}catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#1d4ed8'}}>
                    <FileText size={11}/>Examen Prelungire
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-instiintare-ancom',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'examen-prelungire',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#dc2626'}}>
                    <Download size={11}/>PDF Examen Prelungire
                  </button>
                </div>
                {/* Buton mare: TOATE Instiintarile intr-un singur PDF */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-instiintare-ancom-toate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id})})
                    if(!res.ok){const e=await res.text();throw new Error(e)}
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),1200)}
                  }catch(e:any){alert(e.message)}}}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white" style={{background:'#7c3aed'}}>
                    <Download size={14}/>TOATE Înștiințările PDF
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sectiunea Cereri - distincta, intre Instiintari si Documente */}
          {isRadio && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-indigo-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Cereri ANCOM</h3>
              <div className="space-y-2">
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-cereri-radio',`Cereri_obtinere_${sess.session_date}.docx`,'obtinere','docx')}catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>Cereri Obținere
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-cereri-radio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'obtinere',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Obținere
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-cereri-radio',`Cereri_prelungire_${sess.session_date}.docx`,'prelungire','docx')}catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>Cereri Prelungire
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-cereri-radio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'prelungire',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Prelungire
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-semibold text-sm text-gray-900 mb-3">Documente</h3>
            {isRadio ? (
              <div className="space-y-2">
                {/* 1. PV Obtinere */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{setGPV(true);try{await generateDocRadio('/api/generate-pv-radio',`PV_LRC_OBTINERE_${sess.session_date}.docx`,'obtinere','docx')}catch(e:any){alert(e.message)}setGPV(false)}}
                    disabled={gPV||students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>{gPV?'...':'PV Obținere LRC'}
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-pv-radio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'obtinere',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Obținere LRC
                  </button>
                </div>
                {/* 2. Anexa Obtinere */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-anexa-pv',`Anexa_PV_LRC_OBTINERE_${sess.session_date}.docx`,'obtinere','docx')}catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>Anexă PV Obținere LRC
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-anexa-pv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'obtinere',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Anexă Obținere
                  </button>
                </div>
                {/* Separator */}
                <div className="border-t border-gray-100 pt-1 mt-1"/>
                {/* 3. PV Prelungire */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-pv-radio',`PV_LRC_PRELUNGIRE_${sess.session_date}.docx`,'prelungire','docx')}catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>PV Prelungire LRC
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-pv-radio',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'prelungire',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Prelungire LRC
                  </button>
                </div>
                {/* 4. Anexa Prelungire */}
                <div className="flex gap-1.5">
                  <button onClick={async()=>{try{await generateDocRadio('/api/generate-anexa-pv',`Anexa_PV_LRC_PRELUNGIRE_${sess.session_date}.docx`,'prelungire','docx')}catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#1d4ed8'}}>
                    <FileText size={12}/>Anexă PV Prelungire LRC
                  </button>
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-anexa-pv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id,tip:'prelungire',format:'pdf'})})
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),800)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{background:'#dc2626'}}>
                    <Download size={12}/>PDF Anexă Prelungire
                  </button>
                </div>
                {/* Buton mare: TOATE documentele radio intr-un singur PDF */}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <button onClick={async()=>{try{
                    const res=await fetch('/api/generate-documente-radio-toate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({session_id:sess.id})})
                    if(!res.ok){const e=await res.text();throw new Error(e)}
                    const html=await res.text();const w=window.open('','_blank');if(w){w.document.write(html);w.document.close();setTimeout(()=>w.print(),1200)}
                  }catch(e:any){alert(e.message)}}}
                    disabled={students.length===0} className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold text-white disabled:opacity-50" style={{background:'#7c3aed'}}>
                    <Download size={14}/>TOATE Documentele PDF
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Documente standard */}
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
            )}
          </div>

          {/* Notificare ANR */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <button onClick={async()=>{
              if(!showNotif) await ensureNotification()
              setShowNotif(s=>!s)
            }} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={isRadio ? '#7c3aed' : '#9ca3af'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                </svg>
                <h3 className="font-semibold text-sm text-gray-900">{isRadio ? 'Notificare ANCOM' : 'Notificare ANR'}</h3>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${showNotif?'rotate-180':''}`}/>
            </button>
            {showNotif && (
              <div className="mt-4 space-y-3">
                {/* Avertizare termen */}
                {sess && (() => {
                  const sessDt = new Date(sess.session_date)
                  const today = new Date()
                  const diffDays = Math.floor((sessDt.getTime() - today.getTime()) / 86400000)
                  const startDt = sess.course_start_date ? new Date(sess.course_start_date) : null
                  return (
                    <div>
                      {startDt && (
                        <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-2">
                          📅 Perioadă curs: <b>{startDt.getDate()} {startDt.toLocaleDateString('ro-RO',{month:'long'})}</b> — <b>{sessDt.getDate()} {sessDt.toLocaleDateString('ro-RO',{month:'long',year:'numeric'})}</b>
                        </div>
                      )}
                      {diffDays > 30
                        ? <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">⚠ Notificarea poate fi trimisă cel mai devreme cu 30 zile înainte ({new Date(sessDt.getTime()-30*86400000).toLocaleDateString('ro-RO')})</div>
                        : diffDays < 15
                        ? <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">⛔ Termenul minim de 15 zile a fost depășit! Sesiunea e pe {sessDt.toLocaleDateString('ro-RO')}</div>
                        : <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">✓ În termen — {diffDays} zile până la sesiune</div>
                      }
                    </div>
                  )
                })()}

                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Nr. notificare</label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={notifForm.nr_notificare} placeholder="ex: 6/21.04.2026"
                    onChange={e=>setNotifForm(f=>({...f,nr_notificare:e.target.value}))}/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Ora examinare <span className="text-gray-300 font-normal">(dublu-click = reset)</span>
                  </label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={notifForm.ora_examinare} placeholder="10:00"
                    onChange={e=>setNotifForm(f=>({...f,ora_examinare:e.target.value}))}
                    onDoubleClick={()=>setNotifForm(f=>({...f,ora_examinare:'10:00'}))}
                    title="Dublu-click pentru a reseta la 10:00"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Clasă <span className="text-gray-300 font-normal">(dublu-click = reset)</span>
                  </label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={notifForm.clasa} placeholder="C,D"
                    onChange={e=>setNotifForm(f=>({...f,clasa:e.target.value}))}
                    onDoubleClick={()=>{
                      const isClassB = sess.class_caa?.includes('B')
                      setNotifForm(f=>({...f, clasa: isClassB ? 'B/Manevra ambarcatiunii cu vele' : 'C/D/Manevra ambarcatiunii cu vele'}))
                    }}
                    title="Dublu-click pentru a reseta la valoarea default"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Cursuri în locația aprobată din <span className="text-gray-300 font-normal">(dublu-click = reset)</span>
                  </label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={notifForm.locatie_curs} placeholder="str. Virgiliu nr. 15.../Marina Limanu"
                    onChange={e=>setNotifForm(f=>({...f,locatie_curs:e.target.value}))}
                    onDoubleClick={()=>{
                      const ln = ((sess as any).locations?.name||'').toLowerCase()
                      const adr = 'str. Virgiliu nr. 15, etaj 3, Sector 1, București'
                      const def = ln.includes('snagov') ? `${adr}/Lacul Snagov` : ln.includes('limanu') ? `${adr}/Marina Limanu` : ln.includes('mangalia') ? `${adr}/Marina Mangalia` : `${adr}/${(sess as any).locations?.name||''}`
                      setNotifForm(f=>({...f,locatie_curs:def}))
                    }}
                    title="Dublu-click pentru a reseta la valoarea default"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">
                    Examinare practică în locația aprobată <span className="text-gray-300 font-normal">(dublu-click = reset)</span>
                  </label>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={notifForm.locatie_examinare} placeholder="din Marina Limanu"
                    onChange={e=>setNotifForm(f=>({...f,locatie_examinare:e.target.value}))}
                    onDoubleClick={()=>{
                      const ln = ((sess as any).locations?.name||'').toLowerCase()
                      const def = ln.includes('snagov') ? 'de pe Lacul Snagov' : ln.includes('limanu') ? 'din Marina Limanu' : ln.includes('mangalia') ? 'din Marina Mangalia' : `din ${(sess as any).locations?.name||''}`
                      setNotifForm(f=>({...f,locatie_examinare:def}))
                    }}
                    title="Dublu-click pentru a reseta la valoarea default"/>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Ambarcațiuni</label>
                  <div className="space-y-1">
                    {['SetSail','Trainer 1','Trainer 2'].map(b=>(
                      <label key={b} className="flex items-center gap-2 text-xs cursor-pointer">
                        <input type="checkbox" checked={notifForm.barci_selectate.includes(b)}
                          onChange={e=>setNotifForm(f=>({...f,barci_selectate:e.target.checked?[...f.barci_selectate,b]:f.barci_selectate.filter(x=>x!==b)}))}
                          className="rounded"/>
                        {b}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Butoane generare — 2 randuri x 2 */}
                <div className="space-y-1.5 pt-1">
                  <div className="flex gap-1.5">
                    <button onClick={()=>generateNotificare(false,'docx')} disabled={gNotif}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors"
                      style={{background:'#1e40af'}} title="Descarcă DOCX fără ștampilă">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                      DOCX
                    </button>
                    <button onClick={()=>generateNotificare(false,'pdf')} disabled={gNotif}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors"
                      style={{background:'#dc2626'}} title="Descarcă PDF fără ștampilă">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8" fill="none" stroke="currentColor" strokeWidth="2"/></svg>
                      PDF
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <button onClick={()=>generateNotificare(true,'docx')} disabled={gNotif}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors"
                      style={{background:'#1d4ed8'}} title="Descarcă DOCX cu ștampilă + semnătură">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l2 2 4-4"/></svg>
                      DOCX + ștampilă
                    </button>
                    <button onClick={()=>generateNotificare(true,'pdf')} disabled={gNotif}
                      className="flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50 transition-colors"
                      style={{background:'#b91c1c'}} title="Descarcă PDF cu ștampilă + semnătură">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><path d="M10 13l2 2 4-4"/></svg>
                      PDF + ștampilă
                    </button>
                  </div>
                  {gNotif && <p className="text-xs text-center text-gray-400">Se generează...</p>}
                </div>

                {/* Upload notificare scanata */}
                <div className="border-t border-gray-100 pt-3">
                  <label className="text-xs font-medium text-gray-500 mb-2 block">Notificare scanată (pentru email ANR)</label>
                  <input type="file" accept="image/*,application/pdf" className="hidden"
                    ref={notifScanRef}
                    onChange={async e=>{
                      const f=e.target.files?.[0];if(!f)return
                      const reader=new FileReader()
                      reader.onload=async ev=>{
                        const data=ev.target?.result as string
                        setNotifScanFile(data)
                        if(notif?.id) await supabase.from('notifications').update({scanned_file_data:data,scanned_file_name:f.name}).eq('id',notif.id)
                      }
                      reader.readAsDataURL(f)
                    }}
                  />
                  {notifScanFile ? (
                    <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-green-700">✓ Fișier încărcat</span>
                      <button onClick={()=>notifScanRef.current?.click()} className="text-xs text-blue-500 hover:underline">Înlocuiește</button>
                    </div>
                  ) : (
                    <button onClick={()=>notifScanRef.current?.click()}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs border border-dashed border-gray-300 text-gray-500 hover:bg-gray-50">
                      ⬆ Încarcă notificare scanată
                    </button>
                  )}
                </div>

                {/* Email ANR */}
                {notifScanFile && (
                  <div className="border-t border-gray-100 pt-3">
                    <label className="text-xs font-medium text-gray-500 mb-2 block">Email către ANR</label>
                    <div className="text-xs text-gray-400 mb-2">
                      Destinatar: <span className="font-mono text-gray-600">autorizari@rna.ro</span>
                    </div>
                    <button onClick={()=>{
                      const sessDt = new Date(sess.session_date)
                      const zi = sessDt.getDate()
                      const luna = sessDt.toLocaleDateString('ro-RO',{month:'long'})
                      const locName = sess.locations?.name||'locatie'
                      const subject = encodeURIComponent(`Notificare privind cursuri si examene practice SetSail ${locName}`)
                      const body = encodeURIComponent(`Bună ziua,

Vă trimitem atașata notificarea privind următorul curs și examinare practică SetSail, în vederea alocării unui reprezentant ANR:

${zi} ${luna} - ${locName} ora ${notifForm.ora_examinare}

Vă mulțumim!

Cu stimă,

Ruxandra Taloș
Set Sail NauticSchool
0727387245`)
                      window.open(`https://mail.google.com/mail/?view=cm&to=autorizari@rna.ro&su=${subject}&body=${body}`)
                    }}
                      className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs bg-blue-600 text-white hover:bg-blue-700">
                      ✉ Deschide în Gmail
                    </button>
                    <p className="text-xs text-gray-400 mt-1 text-center">Atașează manual notificarea scanată</p>
                  </div>
                )}

                <button onClick={async()=>{
                    const id = await saveNotification()
                    if(id){ setNotifSaved(true); setTimeout(()=>setNotifSaved(false),2500) }
                  }}
                  className={`w-full py-2 rounded-lg text-xs border transition-colors ${notifSaved?'border-green-300 text-green-600 bg-green-50':'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {notifSaved ? '✓ Salvat!' : '💾 Salvează info'}
                </button>
              </div>
            )}
          </div>

        {/* Mailing autoritati - colapsabil, identic cu cursanti */}
        {!isAbsent && (
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <button onClick={()=>setShowMailAuth(!showMailAuth)}
              className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail size={14} style={{color: isRadio ? '#7c3aed' : '#1d4ed8'}}/>
                <h3 className="font-semibold text-sm" style={{color: isRadio ? '#7c3aed' : '#1d4ed8'}}>
                  {isRadio ? 'Mailing ANCOM' : 'Mailing ANR'}
                </h3>
              </div>
              <ChevronDown size={14} className={`text-gray-400 transition-transform ${showMailAuth?'rotate-180':''}`}/>
            </button>
            {showMailAuth && (
              <div className="mt-4 space-y-3">
                {/* TO */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">TO</label>
                    <button onClick={()=>navigator.clipboard.writeText(sess.evaluators?.email_oficial||(isRadio?'secretariat@ancom.ro':'autorizari@rna.ro'))}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>Copiază
                    </button>
                  </div>
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 select-all">
                    {sess.evaluators?.email_oficial || (isRadio ? 'secretariat@ancom.ro' : 'autorizari@rna.ro')}
                  </div>
                </div>
                {isRadio && sess.evaluators?.email_personal && (
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">CC</label>
                    <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 select-all">
                      {sess.evaluators.email_personal}
                    </div>
                  </div>
                )}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">BCC</label>
                  <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-700 bg-gray-50 select-all">
                    office@setsail.ro
                  </div>
                </div>
                {/* Subiect */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Subiect</label>
                    <button onClick={()=>navigator.clipboard.writeText(authSubject)}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>Copiază
                    </button>
                  </div>
                  <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                    value={authSubject} onChange={e=>setAuthSubject(e.target.value)} placeholder="Subiect email..."/>
                </div>
                {/* Mesaj */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs text-gray-400">Mesaj</label>
                    <button onClick={()=>{navigator.clipboard.writeText(authBody);setAuthCopied(true);setTimeout(()=>setAuthCopied(false),2000)}}
                      className="text-xs text-blue-500 hover:text-blue-700 flex items-center gap-1">
                      <Copy size={11}/>{authCopied?'Copiat!':'Copiază tot'}
                    </button>
                  </div>
                  <textarea rows={6} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y font-mono"
                    value={authBody} onChange={e=>setAuthBody(e.target.value)} placeholder="Scrie sau selectează un template..."/>
                </div>
                {/* Template-uri autoritate - sub mesaj */}
                {(() => {
                  const catKey = isRadio ? 'ancom' : 'anr'
                  const authTemplates = dbTemplates.filter((t: any) => t.categorie === catKey)
                  if (authTemplates.length === 0) return null
                  return (
                    <div>
                      <div className="text-xs text-gray-400 font-medium mb-1">{isRadio ? '📡 ANCOM' : '⚓ ANR'}</div>
                      <div className="flex flex-col gap-1">
                        {authTemplates.map((t: any) => (
                          <button key={t.id}
                            onClick={()=>{
                              const rawBody = t.body_html || t.body_text || ''
                              setAuthSubject(applyTemplate(t.subject, sess, allContacts))
                              setAuthBody(applyTemplate(rawBody, sess, allContacts))
                              setSelectedAuthCategory(catKey)
                            }}
                            className="text-left px-3 py-2 rounded-lg text-xs border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })()}
                {/* Gmail */}
                <a href={`https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(sess.evaluators?.email_oficial||(isRadio?'secretariat@ancom.ro':'autorizari@rna.ro'))}${isRadio&&sess.evaluators?.email_personal?'&cc='+encodeURIComponent(sess.evaluators.email_personal):''}&bcc=${encodeURIComponent('office@setsail.ro')}&su=${encodeURIComponent(authSubject)}&body=${encodeURIComponent(authBody)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white"
                  style={{background:'#0a1628'}}>
                  <Mail size={13}/> Deschide în Gmail
                </a>
                {/* Buton ATAS toate instiintarile - apare doar daca template-ul selectat e ANCOM */}
                {selectedAuthCategory === 'ancom' && (
                  <>
                    <button onClick={async()=>{
                      try {
                        // 1. Deschide PDF cu TOATE Instiintarile in tab nou + auto-print (Save as PDF)
                        const res = await fetch('/api/generate-instiintare-ancom-toate',{
                          method:'POST',
                          headers:{'Content-Type':'application/json'},
                          body: JSON.stringify({session_id: sess.id})
                        })
                        if (!res.ok) { const e = await res.text(); throw new Error(e) }
                        const html = await res.text()
                        const wPdf = window.open('', '_blank')
                        if (wPdf) {
                          wPdf.document.write(html)
                          wPdf.document.close()
                          setTimeout(() => wPdf.print(), 1200)
                        }
                        // 2. Imediat dupa, deschide Gmail intr-un alt tab
                        const gmailUrl = `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(sess.evaluators?.email_oficial||'secretariat@ancom.ro')}${sess.evaluators?.email_personal?'&cc='+encodeURIComponent(sess.evaluators.email_personal):''}&bcc=${encodeURIComponent('office@setsail.ro')}&su=${encodeURIComponent(authSubject)}&body=${encodeURIComponent(authBody)}`
                        setTimeout(() => window.open(gmailUrl, '_blank'), 600)
                      } catch(e:any) { alert(e.message) }
                    }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-semibold text-white"
                      style={{background:'#7c3aed'}}>
                      <Download size={13}/> Salvează PDF + Deschide Gmail
                    </button>
                    <p className="text-xs text-gray-400 text-center -mt-1">
                      După deschidere atașează PDF-ul salvat la mailul Gmail
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}


          {/* Mailing */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <button onClick={()=>{
              if(!showMail) {
                // Refresh la deschidere - doar cei cu communication_target=true
                const commEmails = students.filter(s=>s.email && s.communication_target).map(s=>s.email)
                const allComm = Object.values(allStudents).flat() as Student[]
                const allCommEmails = allComm
                  .filter((s:Student)=>s.email&&s.communication_target)
                  .map((s:Student)=>s.email as string)
                  .filter((e:string,i:number,arr:string[])=>arr.indexOf(e)===i)
                setSelectedEmails(allCommEmails)
                setMailTo(allCommEmails.join(', '))
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
                        {allCommStudents.filter(s=>s.email&&s.communication_target).length > 0
                          ? <><span className="font-medium text-green-600">{allCommStudents.filter(s=>s.email&&s.communication_target).length}</span><span className="text-green-600 ml-0.5">selectați</span></>
                          : <span>Refresh</span>}
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

                {/* Template-uri din DB - grupate pe categorii, exclud anr/ancom */}
                <div>
                  {dbTemplates.length === 0 ? (
                    <div className="text-xs text-gray-400 italic">Se încarcă template-urile...</div>
                  ) : (() => {
                    const CATS: Record<string,string> = {
                      portal:'🔗 Portal', practica:'⛵ Practică',
                      organizatoric:'📋 Organizatoric', rezultate:'🏆 Rezultate', general:'📧 General'
                    }
                    const grouped = dbTemplates
                      .filter((t: any) => t.categorie !== 'anr' && t.categorie !== 'ancom')
                      .reduce((acc: Record<string,any[]>, t: any) => {
                        const cat = t.categorie || 'general'
                        if (!acc[cat]) acc[cat] = []
                        acc[cat].push(t)
                        return acc
                      }, {})
                    return (
                      <div className="space-y-3">
                        {Object.entries(grouped).map(([cat, items]) => (
                          <div key={cat}>
                            <div className="text-xs text-gray-400 font-medium mb-1">{CATS[cat] || cat}</div>
                            <div className="flex flex-col gap-1">
                              {(items as any[]).map((t: any) => (
                                <button key={t.id}
                                  onClick={()=>{
                                    const rawBody = t.body_html || t.body_text || ''
                                    setMailSubject(applyTemplate(t.subject, sess, allContacts))
                                    setMailBody(applyTemplate(rawBody, sess, allContacts))
                                  }}
                                  className="text-left px-3 py-2 rounded-lg text-xs border border-gray-200 hover:bg-blue-50 hover:border-blue-200 transition-colors">
                                  {t.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )
                  })()}
                </div>

                {/* Buton deschide Gmail */}
                {mailBody.trim().startsWith('<') ? (
                  // Template HTML - prea mare pentru URL Gmail, copiem in clipboard
                  <div className="space-y-2">
                    <button onClick={()=>{
                      navigator.clipboard.writeText(mailBody)
                      setMailCopied('body')
                      setTimeout(()=>setMailCopied(null), 3000)
                    }}
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium border border-blue-200 text-blue-700 hover:bg-blue-50">
                      {mailCopied==='body' ? '✓ HTML copiat în clipboard!' : '📋 Copiază HTML în clipboard'}
                    </button>
                    <a href={`https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(mailTo)}&su=${encodeURIComponent(mailSubject)}`}
                      target="_blank" rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white"
                      style={{background:'#0a1628'}}>
                      <Mail size={13}/> Deschide Gmail (paste HTML manual)
                    </a>
                    <p className="text-xs text-gray-400 text-center">1. Copiază HTML → 2. Deschide Gmail → 3. Ctrl+Shift+V (paste formatat)</p>
                  </div>
                ) : (
                  <a href={`https://mail.google.com/mail/?view=cm&bcc=${encodeURIComponent(mailTo)}&su=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-medium text-white"
                    style={{background:'#0a1628'}}>
                    <Mail size={13}/> Deschide în Gmail
                  </a>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>

      {/* Modal Nr. Notificare */}
      {showNrModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">
                {showNrModal === 'solicitare' ? 'Nr. înștiințări ANCOM' : 'Nr. documente PV (LRC)'}
              </h3>
              <button onClick={()=>setShowNrModal(null)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                <X size={16}/>
              </button>
            </div>
            <div className="p-5">
              {nrModalLoading ? (
                <div className="text-center text-gray-400 py-6">Se încarcă...</div>
              ) : (<>
                {/* Numarul de start + data picker */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1">Primul număr disponibil</div>
                    <input type="number" value={nrModalNext} onChange={e=>setNrModalNext(parseInt(e.target.value)||1)}
                      className="w-full border-2 border-blue-400 rounded-lg px-3 py-2 text-lg font-bold text-blue-700 text-center focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-gray-400 mb-1">Data (aceeași pentru toate 4)</div>
                    <input type="date" value={nrModalDate} onChange={e=>setNrModalDate(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"/>
                  </div>
                </div>

                {/* Preview cele 4 numere */}
                <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-1.5">
                  <div className="text-xs text-gray-400 font-medium mb-2">Se vor aloca:</div>
                  {(showNrModal === 'solicitare' ? SOL_TIPS : DOC_TIPS).map((d,i) => (
                    <div key={d.key} className="flex items-center justify-between text-xs">
                      <span className="text-gray-600">{d.label}</span>
                      <span className="font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                        {nrModalNext + i} / {nrModalDate.split('-').reverse().join('.')}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Buton confirmare */}
                <button onClick={confirmNrModal}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-white mb-5"
                  style={{background:'#0a1628'}}>
                  ✓ Alocă numerele {nrModalNext}–{nrModalNext+3}
                </button>

                {/* Istoric */}
                {nrModalData.filter((r:any) => r.tip === showNrModal).length > 0 && (
                  <div>
                    <div className="text-xs text-gray-400 font-medium mb-2">
                      Istoric {showNrModal === 'solicitare' ? 'înștiințări' : 'documente PV'}
                    </div>
                    <div className="space-y-0.5 max-h-44 overflow-y-auto">
                      {nrModalData
                        .filter((r:any) => r.tip === showNrModal)
                        .map((r:any) => (
                        <div key={r.id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 text-xs">
                          <span className="font-bold text-gray-900 w-7 shrink-0">{r.numar}</span>
                          <span className="text-gray-400 shrink-0">{new Date(r.data_notificare).toLocaleDateString('ro-RO')}</span>
                          <span className="text-gray-500 truncate">{r.document}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function OtherPrincipalDropdown({ currentGroupIds, onSelect, onClose }: {
  currentGroupIds: Set<string>
  onSelect: (sessionId: string) => void
  onClose: () => void
}) {
  const [principals, setPrincipals] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('sessions')
      .select('id, session_date, status, locations(name), class_caa')
      .eq('session_type', 'principal')
      .in('status', ['draft', 'active', 'focus'])
      .order('session_date', { ascending: true })
      .then(({ data }) => {
        setPrincipals((data || []).filter((s: any) => !currentGroupIds.has(s.id)))
        setLoading(false)
      })
  }, [])

  const statusColors: Record<string, string> = { draft:'#6b7280', active:'#d97706', focus:'#7c3aed' }
  const statusLabels: Record<string, string> = { draft:'Ciornă', active:'Activă', focus:'Focus' }

  return (
    <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-100 min-w-60 py-1"
      onClick={e=>e.stopPropagation()}>
      <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-50 flex items-center justify-between">
        <span>Mută la sesiunea:</span>
        <button onClick={onClose} className="text-gray-300 hover:text-gray-500 ml-3">✕</button>
      </div>
      {loading ? (
        <div className="px-3 py-3 text-xs text-gray-400">Se încarcă...</div>
      ) : principals.length === 0 ? (
        <div className="px-3 py-3 text-xs text-gray-400">Nicio altă sesiune disponibilă</div>
      ) : principals.map((p: any) => (
        <button key={p.id} onClick={()=>onSelect(p.id)}
          className="w-full text-left px-3 py-2 text-xs hover:bg-red-50 transition-colors border-b border-gray-50 last:border-0">
          <div className="font-medium text-gray-900">
            {new Date(p.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}
            {' · '}{p.locations?.name}
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-gray-400">
            <span style={{color: statusColors[p.status]||'#6b7280'}}>{statusLabels[p.status]||p.status}</span>
            <span>· Clasa {(p.class_caa||'').replace(',','+')}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

function ClonePortalOption({ sess }: { sess: Session }) {
  const [parentCode, setParentCode] = useState<string|null>(null)
  const isClone = sess.session_type === 'clone' || sess.is_clone

  useEffect(() => {
    if (!isClone || !sess.parent_session_id) return
    supabase.from('sessions').select('access_code').eq('id', sess.parent_session_id).single()
      .then(({ data }) => setParentCode(data?.access_code || null))
  }, [sess.parent_session_id])

  if (!isClone) return null

  const sharesPortal = parentCode !== null && sess.access_code === parentCode

  return (
    <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
      <div className="text-xs font-medium text-blue-700 mb-2">Portal clonă</div>
      <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer mb-1.5">
        <input type="radio" name={`portal-${sess.id}`} checked={sharesPortal}
          onChange={async()=>{
            if (!parentCode) return
            await supabase.from('sessions').update({access_code: parentCode}).eq('id', sess.id)
            window.location.reload()
          }}/> Partajat cu sesiunea principală
      </label>
      <label className="flex items-center gap-2 text-xs text-blue-600 cursor-pointer">
        <input type="radio" name={`portal-${sess.id}`} checked={!sharesPortal}
          onChange={async()=>{
            const newCode = Math.random().toString(36).substring(2, 8).toUpperCase()
            await supabase.from('sessions').update({access_code: newCode}).eq('id', sess.id)
            window.location.reload()
          }}/> Portal propriu (cod separat)
      </label>
    </div>
  )
}

function OnlySailingSection({ sessions, studentsMap, setStudentsMap }: {
  sessions: Session[], studentsMap: Record<string,Student[]>, setStudentsMap: (fn: any) => void
}) {
  const allSailors = sessions
    .filter(s => s.session_type !== 'absent')
    .flatMap(s => (studentsMap[s.id]||[]).filter((st:Student) => st.only_sailing))

  async function revoke(s: Student) {
    await supabase.from('students').update({ only_sailing: false }).eq('id', s.id)
    // Cursantul revine vizibil in sesiunea lui (only_sailing=false)
    // Il readaugam in lista sesiunii lui cu ordinea la final
    setStudentsMap((prev:any) => {
      const upd = {...prev}
      for (const sid of Object.keys(upd)) {
        const list = upd[sid]
        const exists = list.find((st:Student) => st.id === s.id)
        if (exists) {
          // Deja e in lista (cu only_sailing=true) - doar updatam flag
          upd[sid] = list.map((st:Student) => st.id===s.id ? {...st, only_sailing:false} : st)
        } else if (sid === s.session_id) {
          // Nu e in lista (a fost scos) - il readaugam
          const maxOrder = Math.max(0, ...list.map((st:Student) => st.order_in_session || 0))
          upd[sid] = [...list, {...s, only_sailing:false, order_in_session: maxOrder+1}]
        }
      }
      return upd
    })
  }

  const psMap = {pending:{label:'Neconectat',color:'#9ca3af'},signed:{label:'Semnat',color:'#16a34a'},absent:{label:'Absent',color:'#dc2626'}}

  return (
    <div className="mt-6 mb-2">
      <div className="flex items-center gap-3 my-4">
        <div className="flex-1 border-t-2 border-dashed border-orange-200"/>
        <div className="flex items-center gap-2 px-4 py-1.5 rounded-full border-2 border-orange-200 bg-orange-50">
          <span className="text-sm">⛵</span>
          <span className="text-sm font-semibold text-orange-700">Sailing ({allSailors.length})</span>
        </div>
        <div className="flex-1 border-t-2 border-dashed border-orange-200"/>
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-orange-400 text-lg">⛵</span>
            <h3 className="font-semibold text-sm text-orange-700">Cursanți Sailing</h3>
          </div>
          <p className="text-xs text-orange-400">Categoria S — excluși din randomizare. Rămân ficși. Apasă ⛵ de pe un cursant pentru a-l muta aici.</p>
        </div>
        <div className="col-span-2 bg-white rounded-xl border border-orange-100 shadow-sm overflow-hidden">
          {allSailors.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="bg-orange-50 border-b border-orange-100 text-xs font-medium text-orange-600">
                  <th className="px-3 py-2 text-center w-8">✉</th>
                  <th className="px-3 py-2 text-left w-8">#</th>
                  <th className="px-3 py-2 text-left">Nume</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">CNP</th>
                  <th className="px-3 py-2 text-left">Portal</th>
                  <th className="px-3 py-2 w-20"/>
                </tr>
              </thead>
              <tbody>
                {allSailors.map((s:Student, i:number) => {
                  const pst = psMap[s.portal_status as keyof typeof psMap]||psMap.pending
                  return (
                    <tr key={s.id} className="border-b border-gray-50 hover:bg-orange-50/20">
                      <td className="px-3 py-2 text-center">
                        {s.email ? (
                          <button onClick={async(e)=>{ e.stopPropagation(); const nv=!s.communication_target; await supabase.from('students').update({communication_target:nv}).eq('id',s.id); setStudentsMap((prev:any)=>{const upd={...prev};for(const sid of Object.keys(upd)){upd[sid]=upd[sid].map((st:Student)=>st.id===s.id?{...st,communication_target:nv}:st)}return upd}) }}
                            title={s.communication_target ? 'Email activ' : 'Email inactiv'}>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke={s.communication_target ? '#16a34a' : '#d1d5db'}>
                              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                              <polyline points="22,6 12,13 2,6"/>
                            </svg>
                          </button>
                        ) : <span className="text-gray-200">✉</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-300">{i+1}</td>
                      <td className="px-3 py-2 text-xs font-medium text-orange-900">
                        <Link href={`/admin/cursanti/${s.id}`} target="_blank" className="hover:underline">{s.full_name}</Link>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500">{s.email||'—'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-gray-400">{s.cnp||'—'}</td>
                      <td className="px-3 py-2 text-xs font-medium" style={{color:pst.color}}>{pst.label}</td>
                      <td className="px-3 py-2 text-right">
                        <button onClick={()=>revoke(s)} className="text-xs text-orange-400 hover:text-red-500 hover:bg-red-50 px-2 py-1 rounded transition-colors">✕ Revocă</button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <div className="px-4 py-8 text-center text-xs text-gray-400">
              <div className="text-3xl mb-2">⛵</div>
              Niciun cursant Sailing
            </div>
          )}
        </div>
      </div>
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
  const [ciPreview, setCiPreview] = useState<{name:string, img:string}|null>(null)
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
      course_start_date: (sess as any).course_start_date || '',
      session_date: sess.session_date,
      practice_start_date: (sess as any).practice_start_date || '',
      practice_start_time: (sess as any).practice_start_time || '9:30',
      location_id: (sess as any).location_id || '',
      boat_id: (sess as any).boat_id || '',
      evaluator_id: (sess as any).evaluator_id || '',
      instructor_id: (sess as any).instructor_id || '',
      class_caa: sess.class_caa || 'C,D',
      request_number: sess.request_number || '',
      nr_document_ancom: (sess as any).nr_document_ancom || '',
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
    // Colectam TOTI cursantii de pe toate listele active - EXCLUS only_sailing
    const allActiveStudents: Student[] = []
    for (const sess of activeSessions) {
      const sts = studentsMap[sess.id] || []
      allActiveStudents.push(...sts.filter((s: Student) => !s.only_sailing))
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

  const cloneSessions = sessions.filter(s => s.session_type === 'clone' || s.is_clone === true)
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
      {/* Modal previzualizare CI */}
      {ciPreview && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={()=>setCiPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e=>e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">CI — {ciPreview.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">Click în afară pentru a închide</p>
              </div>
              <button onClick={()=>setCiPreview(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={16}/>
              </button>
            </div>
            <div className="p-4 bg-gray-50">
              <img src={ciPreview.img} alt="CI" className="w-full rounded-xl shadow-sm object-contain" style={{maxHeight:'70vh'}}/>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <a href={ciPreview.img} download={`CI_${ciPreview.name.replace(/ /g,'_')}.jpg`}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                ⬇ Descarcă
              </a>
              <button onClick={()=>setCiPreview(null)}
                className="px-4 py-2 rounded-lg text-xs font-medium text-white" style={{background:'#0a1628'}}>
                Închide
              </button>
            </div>
          </div>
        </div>
      )}
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
          setRandomCounts(activeSess.map(s=>(studentsMap[s.id]||[]).filter((st:Student)=>!st.only_sailing).length))
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
        const totalStudents = activeSess.reduce((sum, s) => sum + (studentsMap[s.id]||[]).filter((st:Student)=>!st.only_sailing).length, 0)
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
                ['Data start curs', 'course_start_date', 'date'],
                ['Data start practică', 'practice_start_date', 'date'],
                ['Ora start', 'practice_start_time', 'text'],
                ['Data practică', 'session_date', 'date'],
                ['Nr. înștiințări', 'request_number', 'text'],
                ['Nr. documente PV', 'nr_document_ancom', 'text'],
                ['Locație detaliată', 'location_detail', 'text'],
                ['Clasa CAA', 'class_caa', 'select-class'],
              ].map(([label, key, type]) => (
                <div key={key} className={key==='location_detail'?'col-span-2':''}>
                  <div className="text-xs text-gray-400 mb-1">{label}</div>
                  {type==='select-class' ? (
                    <select className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs w-full focus:outline-none focus:ring-1 focus:ring-blue-400"
                      value={editSessionValues[key]} onChange={e=>setEditSessionValues((v:any)=>({...v,[key]:e.target.value}))}>
                      {['A','B','C','D','C,D','Radio','Obtinere LRC','Prelungire LRC'].map(c=><option key={c} value={c}>{c}</option>)}
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
        <SidebarCard sess={mainSession} students={studentsMap[mainSession.id]||[]} allStatuses={[]} onStatusChange={updateStatus} allSessions={sessions} allStudents={studentsMap} onEditSession={startEditSession}/>
        <div className="col-span-2">
          <StudentsTable
            sess={mainSession} students={studentsMap[mainSession.id]||[]}
            setStudents={(sts)=>setSessionStudents(mainSession.id,sts)}
            allSessions={sessions} allStudents={studentsMap} setAllStudents={setSessionStudents}
            isAbsent={false}
            selectedIds={getSelectedIds(mainSession.id, studentsMap[mainSession.id]||[])}
            setSelectedIds={(ids)=>setSelectedIds(mainSession.id, ids)}
            onCiPreview={(name,img)=>setCiPreview({name,img})}
          />
        </div>
      </div>

      {/* Clone */}
      {cloneSessions.map(clone => (
        <div key={clone.id}>
          <SectionDivider sess={clone}/>
          <div className="grid grid-cols-3 gap-6">
            <SidebarCard sess={clone} students={studentsMap[clone.id]||[]} allStatuses={[]} onStatusChange={updateStatus} allSessions={sessions} allStudents={studentsMap} onEditSession={startEditSession}/>
            <div className="col-span-2">
              <StudentsTable
                sess={clone} students={studentsMap[clone.id]||[]}
                setStudents={(sts)=>setSessionStudents(clone.id,sts)}
                allSessions={sessions} allStudents={studentsMap} setAllStudents={setSessionStudents}
                isAbsent={false}
                selectedIds={getSelectedIds(clone.id, studentsMap[clone.id]||[])}
                setSelectedIds={(ids)=>setSelectedIds(clone.id, ids)}
                onCiPreview={(name,img)=>setCiPreview({name,img})}
              />
            </div>
          </div>
        </div>
      ))}

      {/* Only Sailing — sectiune permanenta, deasupra absentilor */}
      <OnlySailingSection
        sessions={sessions}
        studentsMap={studentsMap}
        setStudentsMap={setStudentsMap}
      />

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
                onCiPreview={(name,img)=>setCiPreview({name,img})}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}