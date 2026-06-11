'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Wand2, Loader2 } from 'lucide-react'
import {
  DIPLOMA_CATEGORIES, DiplomaCategory, defaultCategoriesForClass, getNextDiplomaNumber,
  formatDiplomaDate,
} from '@/lib/diplomas'
import DateInputRO from '../DateInputRO'

type SessionRow = {
  id: string
  session_date: string
  course_start_date: string | null
  class_caa: string | null
  session_type: string | null
  locations: { name: string } | null
}

// Rândul „Probă practică" se tipărește implicit doar pe seriile cu probă pe apă
const SHOW_PRACTICE_DEFAULT: Record<DiplomaCategory, boolean> = {
  A: false, B: true, C: true, D: true, S: false,
}

const LUNI_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

// Serie curs pentru cursul intensiv (fără dată de start): "[ziua practicii - 3]-[ziua practicii] [luna] [anul]"
// ex. practică pe 20.05.2026 → "17-20 mai 2026"
function intensiveGroupName(practiceDate: string): string {
  const end = new Date(practiceDate)
  if (isNaN(end.getTime())) return ''
  const start = new Date(end)
  start.setDate(end.getDate() - 3)
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}-${end.getDate()} ${LUNI_RO[end.getMonth()]} ${end.getFullYear()}`
  }
  // intervalul trece peste granița de lună
  return `${start.getDate()} ${LUNI_RO[start.getMonth()]} - ${end.getDate()} ${LUNI_RO[end.getMonth()]} ${end.getFullYear()}`
}
type StudentRow = {
  id: string
  full_name: string
  cnp: string | null
  address: string | null
  city: string | null
  county: string | null
  country: string | null
  class_caa: string | null
}

export default function GenereazaDiplomePage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<SessionRow[]>([])
  const [sessionId, setSessionId] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)

  // câmpuri comune
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [groupName, setGroupName] = useState('')
  const [expiration, setExpiration] = useState('')
  const [practiceLocation, setPracticeLocation] = useState('')
  const [practiceDate, setPracticeDate] = useState('')

  // selecții per cursant: id -> set de categorii (gol = exclus)
  const [selections, setSelections] = useState<Record<string, DiplomaCategory[]>>({})
  // diplome deja emise per student (ca să nu emitem dubluri din greșeală)
  const [existing, setExisting] = useState<Record<string, DiplomaCategory[]>>({})

  useEffect(() => {
    supabase
      .from('sessions')
      .select('id, session_date, course_start_date, class_caa, session_type, locations(name)')
      .order('session_date', { ascending: false })
      .then(({ data }) => setSessions((data || []) as unknown as SessionRow[]))
  }, [])

  const loadStudents = useCallback(async (sid: string) => {
    setLoadingStudents(true)
    const session = sessions.find(s => s.id === sid)
    const [{ data: studs }, { data: dips }] = await Promise.all([
      supabase
        .from('students')
        .select('id, full_name, cnp, address, city, county, country, class_caa')
        .eq('session_id', sid)
        .eq('only_sailing', false)
        .order('order_in_session'),
      supabase
        .from('diplomas')
        .select('student_id, series')
        .eq('session_id', sid)
        .eq('status', 1),
    ])
    const rows = (studs || []) as StudentRow[]
    setStudents(rows)
    const ex: Record<string, DiplomaCategory[]> = {}
    for (const d of dips || []) {
      if (!d.student_id) continue
      ex[d.student_id] = [...(ex[d.student_id] || []), d.series as DiplomaCategory]
    }
    setExisting(ex)
    const sel: Record<string, DiplomaCategory[]> = {}
    for (const s of rows) {
      const def = defaultCategoriesForClass(s.class_caa || session?.class_caa)
      // nu pre-bifa categoriile pentru care există deja diplomă activă
      sel[s.id] = def.filter(c => !(ex[s.id] || []).includes(c))
    }
    setSelections(sel)
    if (session) {
      setPracticeLocation(session.locations?.name || '')
      setPracticeDate(session.session_date || '')
      setIssueDate(session.session_date || new Date().toISOString().slice(0, 10))
      // Serie curs: "[prima zi de curs] - [data practicii]";
      // fără dată de start (curs intensiv): "17-20 mai 2026" (practica - 3 zile)
      setGroupName(
        session.course_start_date
          ? `${formatDiplomaDate(session.course_start_date)} - ${formatDiplomaDate(session.session_date)}`
          : intensiveGroupName(session.session_date),
      )
    }
    setLoadingStudents(false)
  }, [sessions])

  useEffect(() => { if (sessionId) loadStudents(sessionId) }, [sessionId, loadStudents])

  function toggle(studentId: string, cat: DiplomaCategory) {
    setSelections(prev => {
      const cur = prev[studentId] || []
      return { ...prev, [studentId]: cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat] }
    })
  }

  const totalToGenerate = useMemo(
    () => Object.values(selections).reduce((a, cats) => a + cats.length, 0),
    [selections],
  )

  async function generate() {
    if (!sessionId || totalToGenerate === 0) return
    if (!groupName.trim() && !confirm('Seria de curs e goală. Continui fără?')) return
    setSaving(true)
    try {
      let nr = await getNextDiplomaNumber(supabase)
      const inserts: any[] = []
      for (const s of students) {
        const cats = selections[s.id] || []
        // ordinea categoriilor pe diplome urmează ordinea A,B,C,D,S
        for (const cat of DIPLOMA_CATEGORIES.filter(c => cats.includes(c))) {
          inserts.push({
            series: cat,
            number: nr++,
            issue_date: issueDate,
            expiration: expiration.trim() || null,
            full_name: s.full_name,
            cnp: s.cnp,
            address: s.address,
            city: [s.city, s.county].filter(Boolean).join(', ') || null,
            group_name: groupName.trim() || null,
            practice_location: practiceLocation.trim() || null,
            practice_date: practiceDate || null,
            show_practice: SHOW_PRACTICE_DEFAULT[cat],
            session_id: sessionId,
            student_id: s.id,
            in_print_queue: true,
          })
        }
      }
      const { error } = await supabase.from('diplomas').insert(inserts)
      if (error) throw error
      router.push('/admin/diplome')
    } catch (e: any) {
      alert('Eroare la generare: ' + (e.message || e))
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/admin/diplome" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Wand2 size={18} className="text-amber-600" />
              Generează diplome din sesiune
            </h1>
            <p className="text-xs text-gray-500">
              Diplomele generate intră automat în lista de tipărire. Numerotarea continuă secvențial.
            </p>
          </div>
        </div>

        {/* Selectare sesiune */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Sesiune practică">
              <select value={sessionId} onChange={e => setSessionId(e.target.value)} className={inputCls}>
                <option value="">— alege sesiunea —</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {new Date(s.session_date).toLocaleDateString('ro-RO')} · {s.locations?.name || '?'}
                    {s.session_type && s.session_type !== 'main' ? ` (${s.session_type})` : ''}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Serie curs (apare pe diplomă)">
              <input value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ex: CDS 2026-3" className={inputCls} />
            </Field>
            <Field label="Data eliberării">
              <DateInputRO value={issueDate} onChange={setIssueDate} className={inputCls} />
            </Field>
            <Field label="Expiră la (gol = nu se tipărește)">
              <input value={expiration} onChange={e => setExpiration(e.target.value)} placeholder="ex: NELIMITAT" className={inputCls} />
            </Field>
            <Field label="Locația probei practice">
              <input value={practiceLocation} onChange={e => setPracticeLocation(e.target.value)} className={inputCls} />
            </Field>
            <Field label="Data probei practice">
              <DateInputRO value={practiceDate} onChange={setPracticeDate} className={inputCls} />
            </Field>
          </div>
          <p className="text-xs text-gray-500">
            Rândul „Probă practică: locație / dată" se tipărește implicit pe seriile <strong>B, C, D</strong>;
            pe <strong>A</strong> și <strong>S</strong> nu apare (se poate schimba ulterior din editarea fiecărei diplome).
          </p>
        </div>

        {/* Cursanți */}
        {sessionId && (
          loadingStudents ? (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-100">
              <Loader2 className="animate-spin text-gray-400 mx-auto" size={24} />
            </div>
          ) : students.length === 0 ? (
            <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm border border-gray-100">
              Sesiunea nu are cursanți.
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-3">Cursant</th>
                    <th className="px-4 py-3">Clasa CAA</th>
                    <th className="px-4 py-3">Diplome de emis</th>
                    <th className="px-4 py-3">Deja emise</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id} className="border-b border-gray-50">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-gray-900">{s.full_name}</div>
                        <div className="text-[11px] text-gray-400">
                          <span className="font-mono">{s.cnp || 'fără CNP'}</span>
                          {(s.address || s.city || s.county) && (
                            <span> · {[s.address, s.city, s.county].filter(Boolean).join(', ')}</span>
                          )}
                        </div>
                        {s.country && (
                          <div className="text-[11px] text-gray-400">{s.country}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-gray-600">{s.class_caa || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex gap-1.5">
                          {DIPLOMA_CATEGORIES.map(cat => {
                            const on = (selections[s.id] || []).includes(cat)
                            return (
                              <button key={cat} onClick={() => toggle(s.id, cat)}
                                className={`w-8 h-8 rounded-lg text-xs font-bold border transition-colors ${
                                  on
                                    ? 'bg-amber-500 border-amber-500 text-white'
                                    : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                }`}>
                                {cat}
                              </button>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-gray-500">
                        {(existing[s.id] || []).join(', ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {/* Acțiune */}
        {sessionId && students.length > 0 && (
          <div className="flex items-center justify-end gap-3">
            <div className="text-sm text-gray-500">{totalToGenerate} diplome de generat</div>
            <button onClick={generate} disabled={saving || totalToGenerate === 0}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: '#0a1628' }}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              Generează {totalToGenerate > 0 ? totalToGenerate : ''} diplome
            </button>
          </div>
        )}

      </div>
    </div>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
