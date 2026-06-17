'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { ArrowLeft, Loader2, CheckCircle2 } from 'lucide-react'

type ExamRow = { id: string; numar_subiecte_grila: number; numar_subiecte_engleza: number }
type StudentLite = { id: string; full_name: string; order_in_session: number | null; only_sailing: boolean }
type AnswerRow = {
  student_id: string
  grila_answers: Record<string, string> | null
  translation_answers: Record<string, string> | null
  status: string
  last_seen: string | null
  updated_at: string | null
  submitted_at: string | null
}

type SortCol = 'name' | 'grila' | 'gresite' | 'trad' | 'pct' | 'stare'

const CONNECTED_MS = 35000 // conectat daca heartbeat / ultima salvare in ultimele 35s

function countFilled(obj: Record<string, string> | null | undefined): number {
  if (!obj) return 0
  return Object.values(obj).filter(v => v != null && String(v).trim() !== '').length
}

export default function ExamStatusPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [exam, setExam] = useState<ExamRow | null>(null)
  const [correctMap, setCorrectMap] = useState<Record<string, string>>({}) // order_no -> raspuns corect
  const [students, setStudents] = useState<StudentLite[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(0) // ms; setat dupa mount ca sa evitam mismatch SSR
  const [sessionDate, setSessionDate] = useState<string>('')
  const [sortCol, setSortCol] = useState<SortCol>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir(col === 'name' ? 'asc' : 'desc') }
  }
  const arrow = (col: SortCol) => sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : <span className="text-gray-300">↕</span>

  // Incarca examenul + cursantii o data
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data: sess } = await supabase.from('sessions').select('session_date').eq('id', sessionId).single()
      const { data: ex } = await supabase.from('radio_exams').select('id, numar_subiecte_grila, numar_subiecte_engleza').eq('session_id', sessionId).maybeSingle()
      const { data: sts } = await supabase.from('students')
        .select('id, full_name, order_in_session, only_sailing')
        .eq('session_id', sessionId).eq('only_sailing', false)
        .order('order_in_session')
      if (ex) {
        const { data: qs } = await supabase.from('radio_exam_questions')
          .select('order_no, correct_option').eq('exam_id', (ex as ExamRow).id)
        const cm: Record<string, string> = {}
        for (const q of (qs || []) as { order_no: number; correct_option: string }[]) cm[String(q.order_no)] = q.correct_option
        if (!cancelled) setCorrectMap(cm)
      }
      if (cancelled) return
      setSessionDate(sess?.session_date || '')
      setExam(ex as ExamRow | null)
      setStudents((sts || []) as StudentLite[])
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [sessionId])

  // Poll raspunsuri + ceas
  const poll = useCallback(async (examId: string) => {
    const { data } = await supabase.from('radio_exam_answers')
      .select('student_id, grila_answers, translation_answers, status, last_seen, updated_at, submitted_at')
      .eq('exam_id', examId)
    const map: Record<string, AnswerRow> = {}
    for (const a of (data || []) as AnswerRow[]) map[a.student_id] = a
    setAnswers(map)
    setNow(Date.now())
  }, [])

  useEffect(() => {
    if (!exam) return
    poll(exam.id)
    const t = setInterval(() => poll(exam.id), 4000)
    return () => clearInterval(t)
  }, [exam, poll])

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>

  const totalGrila = exam?.numar_subiecte_grila || 0
  const totalTrad = exam?.numar_subiecte_engleza || 0
  const totalAll = totalGrila + totalTrad

  if (!exam) {
    return (
      <div className="p-8 max-w-3xl">
        <div className="flex items-center gap-3 mb-6">
          <Link href={`/admin/sesiuni/${sessionId}/examen`} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20}/></Link>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Status examen</h1>
        </div>
        <p className="text-sm text-gray-400">Nu există încă un examen generat pentru această sesiune. Creează-l din pagina <Link href={`/admin/sesiuni/${sessionId}/examen`} className="text-purple-600 hover:underline">Examen</Link>.</p>
      </div>
    )
  }

  const rows = students.map(s => {
    const a = answers[s.id]
    const grila = countFilled(a?.grila_answers)
    // corecte / gresite din cele raspunse la grila (comparat cu raspunsul corect)
    let grilaCorect = 0, grilaGresit = 0
    if (a?.grila_answers) {
      for (const [k, v] of Object.entries(a.grila_answers)) {
        if (v == null || String(v).trim() === '') continue
        if (correctMap[k] && v === correctMap[k]) grilaCorect++; else grilaGresit++
      }
    }
    const trad = countFilled(a?.translation_answers)
    const done = grila + trad
    const pct = totalAll > 0 ? Math.round((done / totalAll) * 100) : 0
    const finalized = a?.status === 'submitted' || a?.status === 'graded'
    // A intrat in test = exista rand de raspuns (sau a raspuns la ceva). Doar cine n-a intrat deloc e rosu.
    const started = !!a
    return { s, grila, grilaCorect, grilaGresit, trad, pct, finalized, started }
  })

  // ordine pentru sortarea dupa stare: neinceput < in lucru < finalizat
  const stareRank = (r: typeof rows[number]) => r.finalized ? 2 : (r.started ? 1 : 0)
  rows.sort((a, b) => {
    let cmp = 0
    if (sortCol === 'name') cmp = a.s.full_name.localeCompare(b.s.full_name, 'ro')
    else if (sortCol === 'grila') cmp = a.grila - b.grila
    else if (sortCol === 'gresite') cmp = a.grilaGresit - b.grilaGresit
    else if (sortCol === 'trad') cmp = a.trad - b.trad
    else if (sortCol === 'pct') cmp = a.pct - b.pct
    else if (sortCol === 'stare') cmp = stareRank(a) - stareRank(b)
    if (cmp === 0) cmp = (a.s.order_in_session || 0) - (b.s.order_in_session || 0)
    return sortDir === 'asc' ? cmp : -cmp
  })

  const nrStarted = rows.filter(r => r.started).length
  const nrFinalized = rows.filter(r => r.finalized).length

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center gap-3 mb-1">
        <Link href={`/admin/sesiuni/${sessionId}/examen`} className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20}/></Link>
        <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Status examen live</h1>
        <Loader2 size={15} className="animate-spin text-gray-300" />
      </div>
      <p className="text-xs text-gray-500 mb-5 ml-8">
        {sessionDate ? new Date(sessionDate).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) + ' · ' : ''}
        {students.length} cursanți · <span className="text-green-600 font-medium">{nrStarted} în test</span> · {nrFinalized} finalizați ·
        grilă {totalGrila} întrebări, traduceri {totalTrad} fraze · actualizare la 4s
      </p>

      <div className="space-y-1.5">
        {/* Cap tabel */}
        <div className="flex items-center gap-3 px-3 py-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide select-none">
          <div className="w-4" />
          <button onClick={() => toggleSort('name')} className="flex-1 text-left flex items-center gap-1 hover:text-blue-600">Cursant {arrow('name')}</button>
          <button onClick={() => toggleSort('grila')} className="w-24 flex items-center justify-center gap-1 hover:text-blue-600">Grilă {arrow('grila')}</button>
          <button onClick={() => toggleSort('gresite')} className="w-28 flex items-center justify-center gap-1 hover:text-blue-600">Corecte/Greșite {arrow('gresite')}</button>
          <button onClick={() => toggleSort('trad')} className="w-24 flex items-center justify-center gap-1 hover:text-blue-600">Traduceri {arrow('trad')}</button>
          <button onClick={() => toggleSort('pct')} className="w-16 flex items-center justify-end gap-1 hover:text-blue-600">Progres {arrow('pct')}</button>
          <button onClick={() => toggleSort('stare')} className="w-28 flex items-center justify-end gap-1 hover:text-blue-600">Stare {arrow('stare')}</button>
        </div>

        {rows.map(({ s, grila, grilaCorect, grilaGresit, trad, pct, finalized, started }) => (
          <div key={s.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${finalized ? 'border-green-200' : 'border-gray-100'}`}
            style={finalized ? { background: '#dcfce7' } : {}}>
            {/* Indicator: verde daca a intrat in test, rosu daca n-a intrat deloc */}
            <span className="w-4 flex justify-center" title={started ? (finalized ? 'Test finalizat' : 'În test') : 'N-a intrat'}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: started ? '#22c55e' : '#ef4444' }} />
            </span>
            <div className="flex-1 text-sm font-medium text-gray-900 truncate">{s.full_name}</div>
            <div className="w-24 text-center text-xs text-gray-600 font-mono">{grila}/{totalGrila}</div>
            <div className={`w-28 text-center text-xs font-mono rounded-md py-0.5 ${grila > 0 && grilaGresit >= 7 ? 'bg-red-200' : ''}`}>
              {grila > 0
                ? <><span className="text-green-600 font-semibold">{grilaCorect}</span><span className="text-gray-300"> / </span><span className="font-semibold" style={{ color: grilaGresit === 0 ? '#16a34a' : grilaGresit <= 2 ? '#2563eb' : '#dc2626' }}>{grilaGresit}</span></>
                : <span className="text-gray-300">—</span>}
            </div>
            <div className="w-24 text-center text-xs text-gray-600 font-mono">{trad}/{totalTrad}</div>
            <div className="w-16 text-right text-sm font-semibold" style={{ color: pct === 100 ? '#16a34a' : '#374151' }}>{pct}%</div>
            <div className="w-28 text-right">
              {finalized ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 size={13} /> Test finalizat
                </span>
              ) : started ? (
                <span className="text-xs font-medium text-green-600">În lucru</span>
              ) : (
                <span className="text-xs text-gray-300">Neînceput</span>
              )}
            </div>
          </div>
        ))}

        {rows.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400">Niciun cursant în această sesiune.</div>
        )}
      </div>
    </div>
  )
}
