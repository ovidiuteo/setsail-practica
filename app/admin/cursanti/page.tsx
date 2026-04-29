'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Upload, ExternalLink, CheckCircle, Clock, XCircle } from 'lucide-react'

const portalMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Neconectat', color: '#9ca3af', icon: Clock },
  signed: { label: 'Semnat', color: '#059669', icon: CheckCircle },
  absent: { label: 'Absent', color: '#ef4444', icon: XCircle },
}

export default function CursantiPage() {
  const [students, setStudents] = useState<any[]>([])
  const [filtered, setFiltered] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSession, setFilterSession] = useState('all')
  const [sessions, setSessions] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const { data: sts } = await supabase
        .from('students')
        .select('*, sessions(session_date, access_code, locations(name))')
        .order('full_name')
      const { data: sess } = await supabase
        .from('sessions')
        .select('id, session_date, locations(name)')
        .order('session_date', { ascending: false })
      setStudents(sts || [])
      setFiltered(sts || [])
      setSessions(sess || [])
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    let result = students
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.cnp?.includes(q) ||
        s.email?.toLowerCase().includes(q)
      )
    }
    if (filterStatus !== 'all') {
      result = result.filter(s => s.portal_status === filterStatus)
    }
    if (filterSession !== 'all') {
      result = result.filter(s => s.session_id === filterSession)
    }
    setFiltered(result)
  }, [search, filterStatus, filterSession, students])

  const signed = students.filter(s => s.portal_status === 'signed').length
  const pending = students.filter(s => s.portal_status === 'pending').length

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Cursanți
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {students.length} cursanți total · {signed} semnați · {pending} în așteptare
          </p>
        </div>
        <Link href="/admin/cursanti/import"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#0a1628' }}>
          <Upload size={15} /> Import cursanți
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Caută după nume, CNP, email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Toate statusurile</option>
          <option value="pending">Neconectat</option>
          <option value="signed">Semnat</option>
          <option value="absent">Absent</option>
        </select>
        <select
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          value={filterSession}
          onChange={e => setFilterSession(e.target.value)}>
          <option value="all">Toate sesiunile</option>
          {sessions.map((s: any) => (
            <option key={s.id} value={s.id}>
              {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })} — {s.locations?.name}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400">Se încarcă...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            {students.length === 0 ? (
              <div>
                <p className="mb-3">Niciun cursant în baza de date.</p>
                <Link href="/admin/cursanti/import" className="text-blue-600 hover:underline text-sm">
                  Importați cursanți →
                </Link>
              </div>
            ) : (
              <p>Niciun rezultat pentru filtrele selectate.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nume și prenume</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">CNP</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Serie CI</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Clasa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Sesiune</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status portal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((s: any, i: number) => {
                  const ps = portalMap[s.portal_status] || portalMap.pending
                  const Icon = ps.icon
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.cnp || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.id_document || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.email || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{s.class_caa}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {s.sessions ? (
                          <span>
                            {new Date(s.sessions.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                            {' · '}{s.sessions.locations?.name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs" style={{ color: ps.color }}>
                          <Icon size={13} />
                          {ps.label}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        {s.session_id && (
                          <Link href={`/admin/sesiuni/${s.session_id}`}
                            className="text-gray-300 hover:text-gray-600 transition-colors">
                            <ExternalLink size={13} />
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          {filtered.length} din {students.length} cursanți
        </div>
      )}
    </div>
  )
}
