'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Search, Upload, ExternalLink, CheckCircle, Clock, XCircle, GitBranch, UserX } from 'lucide-react'

const portalMap: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: 'Neconectat', color: '#9ca3af', icon: Clock },
  signed:  { label: 'Semnat',     color: '#059669', icon: CheckCircle },
  absent:  { label: 'Absent',     color: '#ef4444', icon: XCircle },
}

export default function CursantiPage() {
  const [students, setStudents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSession, setFilterSession] = useState('all') // 'all' | 'absent' | session_id
  const [principals, setPrincipals] = useState<any[]>([]) // sesiuni principale
  const [allSessions, setAllSessions] = useState<any[]>([]) // toate sesiunile
  const [studentCounts, setStudentCounts] = useState<Record<string,number>>({})
  const [sessMapState, setSessMapState] = useState<Record<string,any>>({})

  useEffect(() => {
    async function load() {
      const [{ data: sts }, { data: sess }] = await Promise.all([
        supabase.from('students').select('*').order('full_name'),
        supabase.from('sessions')
          .select('id, session_date, session_type, parent_session_id, locations(name, county), boats(name), access_code, status')
          .order('session_date', { ascending: true })
          .order('created_at', { ascending: true }),
      ])

      const sessMap: Record<string, any> = {}
      for (const s of (sess || [])) sessMap[s.id] = s
      // Sesiunile non-absent pentru filtre
      const nonAbsentSess = (sess || []).filter((s: any) => s.session_type !== 'absent')

      const enriched = (sts || []).map(st => ({ ...st, _session: sessMap[st.session_id] || null }))

      // Counts per session
      const counts: Record<string,number> = {}
      for (const st of enriched) {
        if (st.session_id) counts[st.session_id] = (counts[st.session_id]||0) + 1
      }

      setStudents(enriched)
      setStudentCounts(counts)
      setPrincipals((sess||[]).filter((s:any) => s.session_type === 'principal'))
      setAllSessions(sess || [])
      setSessMapState(sessMap)
      setLoading(false)
    }
    load()
  }, [])

  // Calculeaza lista filtrata - returneaza doar date, NU JSX
  const getFiltered = () => {
    let result = students

    // Filtru text
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(s =>
        s.full_name?.toLowerCase().includes(q) ||
        s.cnp?.includes(q) ||
        s.email?.toLowerCase().includes(q)
      )
    }

    // Filtru status
    if (filterStatus !== 'all') {
      result = result.filter(s => s.portal_status === filterStatus)
    }

    // Filtru sesiune - DOAR filtrare date
    if (filterSession === 'absent_pending') {
      // Separat - nu returnam JSX aici
      return result.filter(s => {
        const ps = portalMap[s.portal_status] || portalMap.pending
        const Icon = ps.icon
        const origSess = s.original_session_id ? sessMapState[s.original_session_id] : null
        const isFromAbsent = origSess?.session_type === 'absent'
        const currentSessNotCompleted = s._session?.status !== 'completed'
        return isFromAbsent && currentSessNotCompleted
      })
    }

    if (filterSession === 'absent') {
      result = result.filter(s => s._session?.session_type === 'absent')
    } else if (filterSession === 'absent_pending') {
      // Cursanti cu original_session_id pointing la o sesiune absent
      // si sesiunea lor curenta nu e completed
      result = result.filter(s => {
        const origSess = s.original_session_id ? sessMapState[s.original_session_id] : null
        const isFromAbsent = origSess?.session_type === 'absent'
        const currentSessNotCompleted = s._session?.status !== 'completed'
        return isFromAbsent && currentSessNotCompleted
      })
    } else if (filterSession !== 'all') {
      // Selectata o sesiune principala - include si clonele ei
      const principal = allSessions.find(s => s.id === filterSession)
      if (principal) {
        const relatedIds = allSessions
          .filter(s => s.id === filterSession || (s.parent_session_id === filterSession && s.session_type === 'clone'))
          .map(s => s.id)
        result = result.filter(s => relatedIds.includes(s.session_id))
      }
    } else {
      // 'all' - exclude absentii din sesiunile absent
      result = result.filter(s => s._session?.session_type !== 'absent')
    }

    return result
  }

  const filtered = getFiltered()
  const signed  = students.filter(s => s.portal_status === 'signed' && s._session?.session_type !== 'absent').length
  const pending = students.filter(s => s.portal_status === 'pending' && s._session?.session_type !== 'absent').length
  const absentCount = students.filter(s => s._session?.session_type === 'absent').length

  // Randeaza tabelul cu linie de demarcatie intre principal si clona
  function renderTable(rows: any[], showDivider = false, dividerLabel = '') {
    if (rows.length === 0) return null
    const inCls = "border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
    return (
      <>
        {showDivider && (
          <tr>
            <td colSpan={9} className="px-4 py-2 bg-blue-50 border-y border-blue-100">
              <div className="flex items-center gap-2">
                <GitBranch size={12} className="text-blue-400"/>
                <span className="text-xs font-medium text-blue-600">{dividerLabel}</span>
              </div>
            </td>
          </tr>
        )}
        {rows.map((s: any, i: number) => {
          const ps = portalMap[s.portal_status] || portalMap.pending
          const Icon = ps.icon
          return (
            <tr key={s.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{s.full_name}</td>
              <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.cnp || '—'}</td>
              <td className="px-4 py-3 text-xs">
                {s.ci_series && s.ci_number
                  ? <span className="font-mono font-semibold px-1.5 py-0.5 rounded" style={{background:'#dcfce7',color:'#166534'}}>{s.ci_series} {s.ci_number}</span>
                  : <span className="text-gray-400">—</span>}
              </td>
              <td className="px-4 py-3 text-xs text-gray-500">{s.email || '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500">{s.class_caa?.replace(',','+') || '—'}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {s._session ? (
                  <span>
                    {new Date(s._session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}
                    {s._session.session_type === 'clone' && <span className="text-blue-400 ml-1">⎇</span>}
                    {s._session.session_type === 'absent' && <span className="text-red-400 ml-1">✗</span>}
                    {' · '}{s._session.locations?.name}
                  </span>
                ) : <span className="text-red-400">—</span>}
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: ps.color }}>
                  <Icon size={13} />{ps.label}
                </span>
              </td>
              <td className="px-2 py-3">
                {s.session_id && (
                  <Link href={`/admin/sesiuni/${s._session?.parent_session_id || s.session_id}`}
                    className="text-gray-300 hover:text-gray-600 transition-colors">
                    <ExternalLink size={13} />
                  </Link>
                )}
              </td>
            </tr>
          )
        })}
      </>
    )
  }

  // Construieste continutul tabelului in functie de filtru
  function renderTableBody() {
    if (filterSession === 'absent_pending') {
      // Tabel special pentru absenti in curs de alocare
      return filtered.map((s: any, i: number) => {
        const ps = portalMap[s.portal_status] || portalMap.pending
        const Icon = ps.icon
        const origSess = s.original_session_id ? sessMapState[s.original_session_id] : null
        const isFromAbsent = origSess?.session_type === 'absent'
        const currentSessNotCompleted = s._session?.status !== 'completed'
        return isFromAbsent && currentSessNotCompleted
      })
    }

    if (filterSession === 'absent') {
      // Absentii grupati pe sesiuni, cele mai vechi primele
      const absentSessions = allSessions
        .filter(s => s.session_type === 'absent')
        .sort((a,b) => a.session_date.localeCompare(b.session_date))

      return absentSessions.map((sess, si) => {
        const sessStudents = filtered.filter(s => s.session_id === sess.id)
        if (sessStudents.length === 0) return null
        const parentSess = allSessions.find(s => s.id === sess.parent_session_id)
        const label = `Absenți de la sesiunea ${new Date(parentSess?.session_date || sess.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})} · ${parentSess?.locations?.name || sess.locations?.name}`
        return renderTable(sessStudents, si > 0, label)
      })
    }

    if (filterSession !== 'all') {
      // O sesiune principala selectata - cu linie intre principal si clone
      const principal = allSessions.find(s => s.id === filterSession)
      if (!principal) return renderTable(filtered)

      const clones = allSessions.filter(s => s.parent_session_id === filterSession && s.session_type === 'clone')
      const principalStudents = filtered.filter(s => s.session_id === filterSession)
      const result: any[] = [renderTable(principalStudents)]

      clones.forEach((clone, ci) => {
        const cloneStudents = filtered.filter(s => s.session_id === clone.id)
        if (cloneStudents.length > 0) {
          const label = `Clonă — ${new Date(clone.session_date).toLocaleDateString('ro-RO', {day:'2-digit', month:'long', year:'numeric'})} · ${clone.locations?.name}`
          result.push(renderTable(cloneStudents, true, label))
        }
      })
      return result
    }

    // Toate (fara absenti)
    return renderTable(filtered)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Cursanți</h1>
          <p className="text-gray-500 text-sm mt-1">
            {students.filter(s=>s._session?.session_type!=='absent').length} cursanți · {signed} semnați · {pending} în așteptare
            {absentCount > 0 && <> · <span className="text-red-500">{absentCount} absenți</span></>}
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
          <input className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            placeholder="Caută după nume, CNP, email..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
          value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Toate statusurile</option>
          <option value="pending">Neconectat</option>
          <option value="signed">Semnat</option>
          <option value="absent">Absent</option>
        </select>
        <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
          value={filterSession} onChange={e => setFilterSession(e.target.value)}>
          <option value="all">Toate sesiunile</option>
          <option value="absent">⚠ Absenți</option>
          <option value="absent_pending">🔄 Absenți în curs de alocare</option>
          {principals.map((s: any) => (
            <option key={s.id} value={s.id}>
              {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' })} — {s.locations?.name}
              {' ('}
              {allSessions.filter(x=>x.id===s.id||x.parent_session_id===s.id&&x.session_type==='clone').reduce((sum,x)=>sum+(studentCounts[x.id]||0),0)}
              {')'}
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
            {students.length === 0
              ? <div><p className="mb-3">Niciun cursant în baza de date.</p>
                  <Link href="/admin/cursanti/import" className="text-blue-600 hover:underline text-sm">Importați cursanți →</Link>
                </div>
              : <p>Niciun rezultat pentru filtrele selectate.</p>
            }
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">#</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Nume și prenume</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">CNP</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">CI</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Clasa</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Sesiune</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">Status portal</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {renderTableBody()}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">
          {filtered.length} cursanți afișați
        </div>
      )}
    </div>
  )
}