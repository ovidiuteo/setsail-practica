'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Calendar, Users, CheckCircle, Clock, Plus, ExternalLink } from 'lucide-react'
import Link from 'next/link'

export default function AdminDashboard() {
  const [stats, setStats] = useState({ sessions: 0, students: 0, active: 0, completed: 0 })
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: sessions }, { data: students }] = await Promise.all([
        supabase.from('sessions').select('*, locations(name), instructors(full_name)').order('session_date', { ascending: false }).limit(5),
        supabase.from('students').select('id, portal_status')
      ])
      const all = sessions || []
      const sts = students || []
      setStats({
        sessions: all.length,
        students: sts.length,
        active: all.filter((s: any) => s.status === 'active').length,
        completed: all.filter((s: any) => s.status === 'completed').length,
      })
      setRecentSessions(all)
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

  const statusLabel: Record<string, { label: string; color: string }> = {
    draft: { label: 'Ciornă', color: '#6b7280' },
    active: { label: 'Activă', color: '#d97706' },
    completed: { label: 'Finalizată', color: '#059669' },
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Dashboard
          </h1>
          <p className="text-gray-500 text-sm mt-1">Gestionare examene practice yachting</p>
        </div>
        <Link href="/admin/sesiuni/nou"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
          style={{ background: '#0a1628' }}
        >
          <Plus size={16} />
          Sesiune nouă
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

      {/* Recent sessions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Sesiuni recente</h2>
          <Link href="/admin/sesiuni" className="text-sm text-blue-600 hover:underline">
            Vezi toate →
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">Se încarcă...</div>
        ) : recentSessions.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="mb-3">Nicio sesiune creată încă.</p>
            <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">
              Creează prima sesiune →
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {recentSessions.map((s: any) => {
              const st = statusLabel[s.status] || statusLabel.draft
              return (
                <div key={s.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">
                      {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                      {' — '}{s.locations?.name || '—'}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Instructor: {s.instructors?.full_name || '—'} · Cod: <span className="font-mono font-bold">{s.access_code}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: st.color + '15', color: st.color }}>
                      {st.label}
                    </span>
                    <Link href={`/admin/sesiuni/${s.id}`} className="text-gray-400 hover:text-gray-700">
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
