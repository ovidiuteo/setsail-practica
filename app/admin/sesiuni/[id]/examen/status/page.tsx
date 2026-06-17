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
  submitted_at: string | null
}

const CONNECTED_MS = 25000 // conectat daca heartbeat in ultimele 25s

function countFilled(obj: Record<string, string> | null | undefined): number {
  if (!obj) return 0
  return Object.values(obj).filter(v => v != null && String(v).trim() !== '').length
}

export default function ExamStatusPage() {
  const params = useParams()
  const sessionId = params.id as string

  const [exam, setExam] = useState<ExamRow | null>(null)
  const [students, setStudents] = useState<StudentLite[]>([])
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({})
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(0) // ms; setat dupa mount ca sa evitam mismatch SSR
  const [sessionDate, setSessionDate] = useState<string>('')

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
      .select('student_id, grila_answers, translation_answers, status, last_seen, submitted_at')
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
    const trad = countFilled(a?.translation_answers)
    const done = grila + trad
    const pct = totalAll > 0 ? Math.round((done / totalAll) * 100) : 0
    const finalized = a?.status === 'submitted' || a?.status === 'graded'
    const connected = !finalized && !!a?.last_seen && (now - new Date(a.last_seen).getTime()) < CONNECTED_MS
    return { s, grila, trad, pct, finalized, connected, started: !!a }
  })

  const nrConnected = rows.filter(r => r.connected).length
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
        {students.length} cursanți · <span className="text-green-600 font-medium">{nrConnected} conectați</span> · {nrFinalized} finalizați ·
        grilă {totalGrila} întrebări, traduceri {totalTrad} fraze · actualizare la 4s
      </p>

      <div className="space-y-1.5">
        {/* Cap tabel */}
        <div className="flex items-center gap-3 px-3 py-1 text-[11px] font-medium text-gray-400 uppercase tracking-wide">
          <div className="w-4" />
          <div className="flex-1">Cursant</div>
          <div className="w-28 text-center">Grilă</div>
          <div className="w-28 text-center">Traduceri</div>
          <div className="w-16 text-right">Progres</div>
          <div className="w-28 text-right">Stare</div>
        </div>

        {rows.map(({ s, grila, trad, pct, finalized, connected, started }) => (
          <div key={s.id}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${finalized ? 'border-green-200' : 'border-gray-100'}`}
            style={finalized ? { background: '#dcfce7' } : {}}>
            {/* Indicator conectat */}
            <span className="w-4 flex justify-center" title={connected ? 'Conectat' : (finalized ? 'Test finalizat' : 'Neconectat')}>
              <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ background: connected ? '#22c55e' : (finalized ? '#16a34a' : '#ef4444') }} />
            </span>
            <div className="flex-1 text-sm font-medium text-gray-900 truncate">{s.full_name}</div>
            <div className="w-28 text-center text-xs text-gray-600 font-mono">{grila}/{totalGrila}</div>
            <div className="w-28 text-center text-xs text-gray-600 font-mono">{trad}/{totalTrad}</div>
            <div className="w-16 text-right text-sm font-semibold" style={{ color: pct === 100 ? '#16a34a' : '#374151' }}>{pct}%</div>
            <div className="w-28 text-right">
              {finalized ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <CheckCircle2 size={13} /> Test finalizat
                </span>
              ) : connected ? (
                <span className="text-xs font-medium text-green-600">În lucru</span>
              ) : started ? (
                <span className="text-xs text-amber-600">Pe pauză</span>
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
