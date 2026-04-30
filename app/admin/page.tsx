'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Users, CheckCircle, Clock, Plus, ExternalLink, GitBranch, UserX, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const statusMap: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Ciornă',     color: '#6b7280' },
  active:    { label: 'Activă',     color: '#d97706' },
  focus:     { label: 'Focus',      color: '#7c3aed' },
  completed: { label: 'Finalizată', color: '#059669' },
}

export default function AdminDashboard() {
  const [stats, setStats]           = useState({ sessions: 0, students: 0, active: 0, completed: 0 })
  const [allSessions, setAllSessions] = useState<any[]>([])
  const [absentStudents, setAbsentStudents] = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [filter, setFilter]         = useState<'active'|'all'>('active')
  const [moving, setMoving]         = useState<string|null>(null)
  const [moveMenuId, setMoveMenuId] = useState<string|null>(null)

  async function load() {
    const [{ data: sessions }, { data: allSts }] = await Promise.all([
      supabase.from('sessions')
        .select('*, locations(name, county), instructors(full_name), boats(name), evaluators(full_name)')
        .order('session_date', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase.from('students').select('*, sessions!session_id(session_date, session_type, status, locations(name))')
    ])

    const all = sessions || []
    const sts = allSts || []

    const counts: Record<string,number> = {}
    for (const st of sts) counts[st.session_id] = (counts[st.session_id]||0) + 1

    const enriched = all.map((s:any) => ({...s, _count: counts[s.id]||0}))
    const principals = enriched.filter((s:any) => s.session_type === 'principal')

    setStats({
      sessions: principals.length,
      students: sts.filter((s:any) => s.sessions?.session_type !== 'absent').length,
      active: principals.filter((s:any) => ['active','focus'].includes(s.status)).length,
      completed: principals.filter((s:any) => s.status === 'completed').length,
    })
    setAllSessions(enriched)

    // Absenti: cursanti cu original_session_id pointing la sesiune absent
    // si sesiunea lor curenta nu e finalizata cu ei pe lista
    const absentSessIds = enriched.filter((s:any) => s.session_type === 'absent').map((s:any) => s.id)
    const completedSessIds = enriched.filter((s:any) => s.status === 'completed').map((s:any) => s.id)

    if (absentSessIds.length > 0) {
      // Cursanti inca pe sesiunile absent (nelocati inca)
      const { data: stillAbsent } = await supabase
        .from('students').select('*')
        .in('session_id', absentSessIds)
        .order('full_name')
      // Cursanti alocati dar sesiunea tinta nu e completata
      const { data: allocated } = await supabase
        .from('students').select('*')
        .in('original_session_id', absentSessIds)
        .not('session_id', 'in', `(${absentSessIds.join(',')})`)
        .order('full_name')
      // Filtreaza cei deja pe sesiuni completate
      const allocatedPending = (allocated || []).filter((s:any) => !completedSessIds.includes(s.session_id))
      setAbsentStudents([...(stillAbsent || []), ...allocatedPending])
    } else {
      setAbsentStudents([])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Sesiunile la care se poate aloca (focus, active, draft - nu absent si nu completed)
  const allocatableSessions = allSessions
    .filter((s:any) => s.session_type === 'principal' && s.status !== 'completed')
    .concat(allSessions.filter((s:any) => s.session_type === 'clone' && s.status !== 'completed'))

  async function allocateToSession(student: any, targetSessionId: string) {
    setMoving(student.id); setMoveMenuId(null)
    // Calculeaza ordinea in sesiunea tinta
    const { data: targetSts } = await supabase.from('students').select('order_in_session').eq('session_id', targetSessionId).order('order_in_session', {ascending: false}).limit(1)
    const maxOrder = targetSts?.[0]?.order_in_session || 0
    // Muta fizic cursantul in sesiunea tinta, pastreaza original_session_id ca referinta la absent
    await supabase.from('students').update({
      session_id: targetSessionId,
      allocated_session_id: targetSessionId,
      original_session_id: student.session_id, // sesiunea absent de origine
      portal_status: student.portal_status === 'absent' ? 'pending' : student.portal_status,
      order_in_session: maxOrder + 1
    }).eq('id', student.id)
    // Scoate din lista de absenti
    setAbsentStudents(prev => prev.filter(s => s.id !== student.id))
    setMoving(null)
  }

  const statCards = [
    { label: 'Sesiuni totale',      value: stats.sessions,  icon: Calendar,     color: '#1e3a6e' },
    { label: 'Cursanți înregistrați', value: stats.students, icon: Users,       color: '#0a1628' },
    { label: 'Sesiuni active',      value: stats.active,    icon: Clock,        color: '#d97706' },
    { label: 'Sesiuni finalizate',  value: stats.completed, icon: CheckCircle,  color: '#059669' },
  ]

  const principals = allSessions.filter((s:any) => s.session_type === 'principal')
  const displayedPrincipals = filter === 'active'
    ? principals.filter((s:any) => s.status !== 'completed')
    : principals

  // Grupam absentii pe sesiunile lor de origine (sesiunea absent parent)
  const absentBySession: Record<string, { sess: any, students: any[] }> = {}
  for (const st of absentStudents) {
    // Gasim sesiunea absent de origine
    const origSessId = st.original_session_id || st.session_id
    const absSess = allSessions.find((s:any) => s.id === origSessId)
    if (!absSess) continue
    const parentId = absSess.parent_session_id || absSess.id
    if (!absentBySession[parentId]) {
      const parentSess = allSessions.find((s:any) => s.id === parentId)
      absentBySession[parentId] = { sess: parentSess || absSess, students: [] }
    }
    absentBySession[parentId].students.push(st)
  }
  const absentGroups = Object.values(absentBySession)
    .sort((a,b) => a.sess.session_date.localeCompare(b.sess.session_date))

  return (
    <div className="p-8" onClick={() => setMoveMenuId(null)}>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Gestionare examene practice yachting</p>
        </div>
        <Link href="/admin/sesiuni/nou"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90"
          style={{ background: '#0a1628' }}>
          <Plus size={16} /> Sesiune nouă
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-gray-500">{label}</div>
              <div className="rounded-lg p-2" style={{ background: color + '15' }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <div className="text-3xl font-bold" style={{ color, fontFamily: 'Georgia, serif' }}>
              {loading ? '—' : value}
            </div>
          </div>
        ))}
      </div>

      {/* Sesiuni recente cu filtre */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Sesiuni Practică</h2>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              <button onClick={() => setFilter('active')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter==='active'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}>
                Nefinalizate
              </button>
              <button onClick={() => setFilter('all')}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter==='all'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}>
                Toate
              </button>
            </div>
            <Link href="/admin/sesiuni" className="text-sm text-blue-600 hover:underline">Vezi toate →</Link>
          </div>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Se încarcă...</div>
        ) : displayedPrincipals.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="mb-3">Nicio sesiune.</p>
            <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">Creează prima sesiune →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {displayedPrincipals.map((principal: any) => {
              const st = statusMap[principal.status] || statusMap.draft
              const clones = allSessions.filter((s:any) => s.session_type === 'clone' && s.parent_session_id === principal.id)
              const totalCount = principal._count + clones.reduce((sum:number,c:any)=>sum+(c._count||0),0)

              return (
                <div key={principal.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 text-sm">
                          {new Date(principal.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: st.color+'15', color: st.color }}>{st.label}</span>
                        <span className="text-xs text-gray-400">
                          Clasa {principal.class_caa?.replace(',','+')} · Total: <strong>{totalCount}</strong> cursanți
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
                        <span>📍 {principal.locations?.name}{principal.locations?.county?`, ${principal.locations.county}`:''}</span>
                        <span>⛵ {principal.boats?.name||'—'}</span>
                        <span>👤 {principal.instructors?.full_name||'—'}</span>
                        <span>🏛️ {principal.evaluators?.full_name||'—'} · {principal._count} cursanți</span>
                      </div>
                    </div>
                    <Link href={`/admin/sesiuni/${principal.id}`} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                      <ExternalLink size={14}/>
                    </Link>
                  </div>

                  {clones.map((clone:any) => {
                    const cloneSt = statusMap[clone.status] || statusMap.draft
                    return (
                      <div key={clone.id} className="mt-2 ml-5 flex items-start">
                        <div className="flex flex-col items-center mr-2 mt-1.5">
                          <div className="w-px h-3 bg-blue-200"/>
                          <div className="w-3 h-px bg-blue-200"/>
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-blue-50/60 rounded-lg px-3 py-1.5 border border-blue-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <GitBranch size={11} className="text-blue-400 shrink-0"/>
                            <span className="text-xs font-medium text-blue-600">Clonă</span>
                            <span className="text-xs text-gray-600">{new Date(clone.session_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'short',year:'numeric'})}</span>
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{background:cloneSt.color+'15',color:cloneSt.color}}>{cloneSt.label}</span>
                            <span className="text-xs text-gray-400">
                              📍 {clone.locations?.name}{clone.locations?.county?`, ${clone.locations.county}`:''}
                              {' · '}⛵ {clone.boats?.name||'—'}
                              {' · '}👤 {clone.instructors?.full_name||'—'}
                              {' · '}🏛️ {clone.evaluators?.full_name||'—'}
                              {' · '}{clone._count||0} cursanți
                            </span>
                          </div>
                          <Link href={`/admin/sesiuni/${principal.id}`} className="text-blue-300 hover:text-blue-600 transition-colors ml-2">
                            <ExternalLink size={12}/>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Sectiunea Absenti */}
      {!loading && absentGroups.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-red-100">
          <div className="p-5 border-b border-red-100 flex items-center gap-2">
            <UserX size={16} className="text-red-400"/>
            <h2 className="font-semibold text-red-700">
              Absenți în așteptare ({absentStudents.length})
            </h2>
          </div>
          <div className="divide-y divide-red-50">
            {absentGroups.map(({ sess, students: grpSts }) => (
              <div key={sess.id} className="p-4">
                <div className="text-xs font-medium text-red-500 mb-2">
                  De la sesiunea {new Date(sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'})} · {sess.locations?.name}
                </div>
                <div className="space-y-1.5">
                  {grpSts.map((st:any) => {
                    const allocSess = st.allocated_session_id
                      ? allSessions.find((s:any) => s.id === st.allocated_session_id)
                      : null

                    return (
                      <div key={st.id} className="flex items-center justify-between bg-red-50 rounded-lg px-3 py-2">
                        <div>
                          <span className="text-sm font-medium text-gray-900">{st.full_name}</span>
                          {st.allocated_session_id && st.session_id !== (allSessions.find((s:any)=>s.session_type==='absent'&&s.id===st.session_id)?.id) && (() => {
                            const allocSess = allSessions.find((s:any) => s.id === st.session_id)
                            return allocSess ? (
                              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                                → Alocat: {new Date(allocSess.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'short',year:'numeric'})} · {allocSess.locations?.name}
                              </span>
                            ) : null
                          })()}
                        </div>
                        <div className="relative" onClick={e=>e.stopPropagation()}>
                          <button
                            onClick={() => setMoveMenuId(moveMenuId===st.id?null:st.id)}
                            disabled={moving===st.id}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-100 transition-colors text-xs font-medium">
                            <ArrowRight size={12}/> Alocă
                          </button>
                          {moveMenuId===st.id && (
                            <div className="absolute right-0 top-8 z-50 bg-white rounded-xl shadow-xl border border-gray-100 min-w-56 py-1">
                              <div className="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-50">Alocă la sesiunea:</div>
                              {allocatableSessions.map((ts:any) => (
                                <button key={ts.id} onClick={()=>allocateToSession(st, ts.id)}
                                  className="w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors">
                                  <div className="font-medium text-gray-900 flex items-center gap-1">
                                    {ts.session_type==='clone'&&<span className="text-blue-400">⎇</span>}
                                    {new Date(ts.session_date).toLocaleDateString('ro-RO',{day:'2-digit',month:'long',year:'numeric'})}
                                    <span className="px-1.5 py-0.5 rounded-full text-xs ml-1" style={{background:statusMap[ts.status]?.color+'20',color:statusMap[ts.status]?.color}}>{statusMap[ts.status]?.label}</span>
                                  </div>
                                  <div className="text-gray-400">{ts.locations?.name} · {ts.boats?.name} · {ts.instructors?.full_name}</div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="px-5 py-3 bg-red-50/50 rounded-b-xl border-t border-red-100">
            <p className="text-xs text-red-400">Absenții dispar din această listă doar după ce sesiunea la care sunt alocați este finalizată cu ei pe listă.</p>
          </div>
        </div>
      )}
    </div>
  )
}