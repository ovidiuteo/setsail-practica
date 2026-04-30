'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Users, CheckCircle, Clock, Plus, ExternalLink, GitBranch } from 'lucide-react'
import Link from 'next/link'

const statusMap: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Ciornă',     color: '#6b7280' },
  active:    { label: 'Activă',     color: '#d97706' },
  focus:     { label: 'Focus',      color: '#7c3aed' },
  completed: { label: 'Finalizată', color: '#059669' },
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ sessions: 0, students: 0, active: 0, completed: 0 })
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [allSessions, setAllSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: sessions }, { data: students }] = await Promise.all([
        supabase.from('sessions')
          .select('*, locations(name, county), instructors(full_name), boats(name), evaluators(full_name)')
          .order('session_date', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('students').select('id, portal_status, session_id')
      ])

      const all = sessions || []
      const sts = students || []

      // Doar principalele pentru statistici
      const principals = all.filter((s: any) => s.session_type === 'principal')

      setStats({
        sessions: principals.length,
        students: sts.length,
        active: principals.filter((s: any) => ['active','focus'].includes(s.status)).length,
        completed: principals.filter((s: any) => s.status === 'completed').length,
      })

      // Fetch student counts
      const { data: allStudents } = await supabase.from('students').select('session_id')
      const counts: Record<string,number> = {}
      for (const st of (allStudents||[])) {
        counts[st.session_id] = (counts[st.session_id]||0) + 1
      }

      const enrichedAll = all.map((s:any) => ({...s, _count: counts[s.id]||0}))
      const enrichedPrincipals = enrichedAll.filter((s:any) => s.session_type === 'principal')

      setAllSessions(enrichedAll)
      setRecentSessions(enrichedPrincipals.slice(0, 5)) // ascending: cele mai vechi primele
      setLoading(false)
    }
    load()
  }, [])

  const statCards = [
    { label: 'Sesiuni totale', value: stats.sessions, icon: Calendar, color: '#1e3a6e' },
    { label: 'Cursanți înregistrați', value: stats.students, icon: Users, color: '#0a1628' },
    { label: 'Sesiuni active', value: stats.active, icon: Clock, color: '#d97706' },
    { label: 'Sesiuni finalizate', value: stats.completed, icon: CheckCircle, color: '#059669' },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Gestionare examene practice yachting</p>
        </div>
        <Link href="/admin/sesiuni/nou"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90 transition-opacity"
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

      {/* Sesiuni recente cu tree view */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Sesiuni recente</h2>
          <Link href="/admin/sesiuni" className="text-sm text-blue-600 hover:underline">Vezi toate →</Link>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Se încarcă...</div>
        ) : recentSessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="mb-3">Nicio sesiune creată încă.</p>
            <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">Creează prima sesiune →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentSessions.map((principal: any) => {
              const st = statusMap[principal.status] || statusMap.draft
              const clones = allSessions.filter((s: any) => s.session_type === 'clone' && s.parent_session_id === principal.id)

              return (
                <div key={principal.id} className="p-4">
                  {/* Randul principal */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-gray-900 text-sm">
                          {new Date(principal.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: st.color + '15', color: st.color }}>
                          {st.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          Clasa {principal.class_caa?.replace(',', '+')}
                          {' · Total: '}
                          <span className="font-medium text-gray-600">
                            {(principal._count||0) + clones.reduce((sum:number,c:any)=>sum+(c._count||0),0)} cursanți
                          </span>
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 flex gap-3 flex-wrap">
                        <span>📍 {principal.locations?.name}{principal.locations?.county ? `, ${principal.locations.county}` : ''}</span>
                        <span>⛵ {principal.boats?.name || '—'}</span>
                        <span>👤 {principal.instructors?.full_name || '—'}</span>
                        <span>🏛️ {principal.evaluators?.full_name || '—'} · {principal._count||0} cursanți</span>
                      </div>
                    </div>
                    <Link href={`/admin/sesiuni/${principal.id}`} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                      <ExternalLink size={14} />
                    </Link>
                  </div>

                  {/* Clone */}
                  {clones.map((clone: any) => {
                    const cloneSt = statusMap[clone.status] || statusMap.draft
                    return (
                      <div key={clone.id} className="mt-2 ml-5 flex gap-0 items-start">
                        <div className="flex flex-col items-center mr-2 mt-1.5">
                          <div className="w-px h-3 bg-blue-200"/>
                          <div className="w-3 h-px bg-blue-200"/>
                        </div>
                        <div className="flex-1 flex items-center justify-between bg-blue-50/60 rounded-lg px-3 py-1.5 border border-blue-100">
                          <div className="flex items-center gap-2">
                            <GitBranch size={11} className="text-blue-400 shrink-0"/>
                            <span className="text-xs font-medium text-blue-600">Clonă</span>
                            <span className="text-xs text-gray-600">
                              {new Date(clone.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </span>
                            <span className="px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ background: cloneSt.color + '15', color: cloneSt.color }}>
                              {cloneSt.label}
                            </span>
                            <span className="text-xs text-gray-400">
                              📍 {clone.locations?.name}{clone.locations?.county ? `, ${clone.locations.county}` : ''}
                              {' · '}⛵ {clone.boats?.name||'—'}
                              {' · '}👤 {clone.instructors?.full_name||'—'}
                              {' · '}🏛️ {clone.evaluators?.full_name||'—'}
                              {' · '}{clone._count||0} cursanți
                            </span>
                          </div>
                          <Link href={`/admin/sesiuni/${principal.id}`} className="text-blue-300 hover:text-blue-600 transition-colors">
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
    </div>
  )
}