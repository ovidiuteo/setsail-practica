'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Circle, CircleDot, FileText, Users,
  Play, Lock, RotateCcw, ChevronDown, ChevronUp, Loader2, Check
} from 'lucide-react'

type RadioExam = {
  id: string
  session_id: string
  cod_generare: string | null
  profesor_examinator: string | null
  numar_subiecte_grila: number
  numar_subiecte_engleza: number
}
type Question = {
  id?: string
  exam_id?: string
  order_no: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: 'A' | 'B' | 'C' | 'D'
}
type Translation = {
  id?: string
  exam_id?: string
  order_no: number
  english_text: string
  romanian_key: string
}
type Answer = {
  id: string
  exam_id: string
  student_id: string
  grila_answers: Record<string, string>
  translation_answers: Record<string, string>
  translation_grades: Record<string, any>
  status: 'in_progress' | 'submitted' | 'graded' | string
  submitted_at: string | null
  graded_at: string | null
  grila_score: number
  translation_score: number
}
type StudentLite = {
  id: string
  full_name: string
  email: string
  class_caa: string
}

const NUM_GRILA = 20
const NUM_TRANS = 5

function emptyQuestions(): Question[] {
  return Array.from({ length: NUM_GRILA }, (_, i) => ({
    order_no: i + 1,
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A',
  }))
}
function emptyTranslations(): Translation[] {
  return Array.from({ length: NUM_TRANS }, (_, i) => ({
    order_no: i + 1,
    english_text: '',
    romanian_key: '',
  }))
}

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:  { label: 'Ciornă',  bg: '#6b728020', color: '#6b7280' },
  active: { label: 'Activ',   bg: '#05966920', color: '#059669' },
  closed: { label: 'Închis',  bg: '#7c3aed20', color: '#7c3aed' },
}

export default function ExamenPage() {
  const params = useParams<{ id: string }>()
  const sessionId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sessAccessCode, setSessAccessCode] = useState('')
  const [sessDate, setSessDate] = useState('')
  const [sessClassCaa, setSessClassCaa] = useState('')
  const [radioExamStatus, setRadioExamStatus] = useState<string>('draft')

  const [exam, setExam] = useState<RadioExam | null>(null)
  const [codGenerare, setCodGenerare] = useState('')
  const [profesor, setProfesor] = useState('')
  const [questions, setQuestions] = useState<Question[]>(emptyQuestions())
  const [translations, setTranslations] = useState<Translation[]>(emptyTranslations())

  const [tab, setTab] = useState<'config' | 'results'>('config')
  const [answers, setAnswers] = useState<Answer[]>([])
  const [students, setStudents] = useState<StudentLite[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gradeDraft, setGradeDraft] = useState<Record<string, number>>({})
  const [savingGrade, setSavingGrade] = useState<string | null>(null)

  // ---------- LOAD ----------
  const loadAll = useCallback(async () => {
    setLoading(true)

    const { data: s } = await supabase
      .from('sessions')
      .select('id, access_code, session_date, class_caa, radio_exam_status')
      .eq('id', sessionId)
      .single()
    if (s) {
      setSessAccessCode(s.access_code || '')
      setSessDate(s.session_date || '')
      setSessClassCaa(s.class_caa || '')
      setRadioExamStatus(s.radio_exam_status || 'draft')
    }

    const { data: ex } = await supabase
      .from('radio_exams')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (ex) {
      setExam(ex as RadioExam)
      setCodGenerare(ex.cod_generare || '')
      setProfesor(ex.profesor_examinator || '')

      const { data: qs } = await supabase
        .from('radio_exam_questions')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      if (qs && qs.length) {
        const filled = emptyQuestions()
        qs.forEach((q: any) => {
          if (q.order_no >= 1 && q.order_no <= NUM_GRILA) {
            filled[q.order_no - 1] = {
              id: q.id,
              exam_id: q.exam_id,
              order_no: q.order_no,
              question_text: q.question_text || '',
              option_a: q.option_a || '',
              option_b: q.option_b || '',
              option_c: q.option_c || '',
              option_d: q.option_d || '',
              correct_option: (q.correct_option || 'A') as 'A' | 'B' | 'C' | 'D',
            }
          }
        })
        setQuestions(filled)
      }

      const { data: tr } = await supabase
        .from('radio_exam_translations')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      if (tr && tr.length) {
        const filled = emptyTranslations()
        tr.forEach((t: any) => {
          if (t.order_no >= 1 && t.order_no <= NUM_TRANS) {
            filled[t.order_no - 1] = {
              id: t.id,
              exam_id: t.exam_id,
              order_no: t.order_no,
              english_text: t.english_text || '',
              romanian_key: t.romanian_key || '',
            }
          }
        })
        setTranslations(filled)
      }

      // Răspunsuri
      const { data: ans } = await supabase
        .from('radio_exam_answers')
        .select('*')
        .eq('exam_id', ex.id)
      const ansList = (ans || []) as Answer[]
      setAnswers(ansList)

      // Studenți din sesiune
      const { data: sts } = await supabase
        .from('students')
        .select('id, full_name, email, class_caa')
        .eq('session_id', sessionId)
      setStudents((sts || []) as StudentLite[])

      // Init grade draft
      const draft: Record<string, number> = {}
      ansList.forEach(a => { draft[a.id] = a.translation_score || 0 })
      setGradeDraft(draft)
    } else {
      setExam(null)
      setQuestions(emptyQuestions())
      setTranslations(emptyTranslations())
    }

    setLoading(false)
  }, [sessionId])

  useEffect(() => { if (sessionId) loadAll() }, [sessionId, loadAll])

  // ---------- HELPERS ----------
  function updateQuestion(idx: number, field: keyof Question, value: string) {
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, [field]: value } : q))
  }
  function updateTranslation(idx: number, field: keyof Translation, value: string) {
    setTranslations(prev => prev.map((t, i) => i === idx ? { ...t, [field]: value } : t))
  }

  // ---------- SAVE CONFIG ----------
  async function saveConfig() {
    setSaving(true)
    try {
      let examRow = exam
      if (!examRow) {
        const { data: created, error } = await supabase
          .from('radio_exams')
          .insert({
            session_id: sessionId,
            cod_generare: codGenerare || null,
            profesor_examinator: profesor || null,
            numar_subiecte_grila: NUM_GRILA,
            numar_subiecte_engleza: NUM_TRANS,
          })
          .select()
          .single()
        if (error) throw error
        examRow = created as RadioExam
        setExam(examRow)
      } else {
        const { error } = await supabase
          .from('radio_exams')
          .update({
            cod_generare: codGenerare || null,
            profesor_examinator: profesor || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', examRow.id)
        if (error) throw error
      }

      // Upsert întrebări — șterg pe cele existente și inserez la loc (mai simplu decât upsert pe (exam_id, order_no))
      await supabase.from('radio_exam_questions').delete().eq('exam_id', examRow.id)
      const qRows = questions.map(q => ({
        exam_id: examRow!.id,
        order_no: q.order_no,
        question_text: q.question_text,
        option_a: q.option_a,
        option_b: q.option_b,
        option_c: q.option_c,
        option_d: q.option_d,
        correct_option: q.correct_option,
      }))
      const { error: qErr } = await supabase.from('radio_exam_questions').insert(qRows)
      if (qErr) throw qErr

      await supabase.from('radio_exam_translations').delete().eq('exam_id', examRow.id)
      const tRows = translations.map(t => ({
        exam_id: examRow!.id,
        order_no: t.order_no,
        english_text: t.english_text,
        romanian_key: t.romanian_key,
      }))
      const { error: tErr } = await supabase.from('radio_exam_translations').insert(tRows)
      if (tErr) throw tErr

      // Dacă status era NULL, setează 'draft' (default-ul DB ar trebui să-l acopere deja, dar pentru siguranță)
      if (!radioExamStatus) {
        await supabase.from('sessions').update({ radio_exam_status: 'draft' }).eq('id', sessionId)
        setRadioExamStatus('draft')
      }

      await loadAll()
      alert('Configurarea a fost salvată.')
    } catch (e: any) {
      alert('Eroare la salvare: ' + (e.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  // ---------- STATUS ----------
  async function changeStatus(newStatus: 'draft' | 'active' | 'closed') {
    if (newStatus === radioExamStatus) return
    if (newStatus === 'active' && !exam) {
      alert('Salvează mai întâi configurarea examenului.')
      return
    }
    if (newStatus === 'draft' && radioExamStatus === 'active') {
      if (!confirm('Treci înapoi la „Ciornă"? Cursanții nu vor mai putea accesa examenul.')) return
    }
    const { error } = await supabase
      .from('sessions')
      .update({ radio_exam_status: newStatus })
      .eq('id', sessionId)
    if (error) { alert('Eroare: ' + error.message); return }
    setRadioExamStatus(newStatus)
  }

  // ---------- GRADE ----------
  async function saveGrade(answer: Answer) {
    const score = gradeDraft[answer.id] ?? 0
    if (score < 0 || score > 5) { alert('Nota trebuie să fie între 0 și 5.'); return }
    setSavingGrade(answer.id)
    const { error } = await supabase
      .from('radio_exam_answers')
      .update({
        translation_score: score,
        graded_at: new Date().toISOString(),
        status: 'graded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', answer.id)
    setSavingGrade(null)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  // ---------- RENDER ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  const stMeta = STATUS_META[radioExamStatus] || STATUS_META.draft

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href={`/admin/sesiuni/${sessionId}`}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Examen Radio LRC</h1>
              <p className="text-xs text-gray-500">
                Sesiune {sessAccessCode} · {sessDate} · {sessClassCaa}
              </p>
            </div>
          </div>
          <span className="px-3 py-1.5 rounded-md text-xs font-semibold"
            style={{ background: stMeta.bg, color: stMeta.color }}>
            {stMeta.label}
          </span>
        </div>

        {/* Status buttons */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs font-semibold text-gray-700 mb-2">Stare examen</div>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'active', 'closed'] as const).map(s => {
              const active = radioExamStatus === s
              const meta = STATUS_META[s]
              return (
                <button
                  key={s}
                  onClick={() => changeStatus(s)}
                  disabled={active}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    active ? 'cursor-default' : 'hover:bg-gray-50'
                  }`}
                  style={active
                    ? { background: meta.color, borderColor: meta.color, color: 'white' }
                    : { borderColor: meta.color + '60', color: meta.color, background: 'white' }}
                >
                  {s === 'draft' && <RotateCcw size={12} className="inline mr-1" />}
                  {s === 'active' && <Play size={12} className="inline mr-1" />}
                  {s === 'closed' && <Lock size={12} className="inline mr-1" />}
                  {meta.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            • <strong>Ciornă</strong> — editezi liber, cursanții nu văd nimic.
            <br />• <strong>Activ</strong> — cursanții pot accesa examenul din portal.
            <br />• <strong>Închis</strong> — cursanții nu mai pot trimite. Notează rezultatele.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => setTab('config')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'config' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <FileText size={14} className="inline mr-1" />Configurare
          </button>
          <button onClick={() => setTab('results')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'results' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Users size={14} className="inline mr-1" />Rezultate
            {answers.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">
                {answers.length}
              </span>
            )}
          </button>
        </div>

        {/* TAB CONFIG */}
        {tab === 'config' && (
          <div className="space-y-6">
            {/* Meta examen */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Cod generare</label>
                <input type="text" value={codGenerare} onChange={e => setCodGenerare(e.target.value)}
                  placeholder="ex. LRC-2026-05"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Profesor examinator</label>
                <input type="text" value={profesor} onChange={e => setProfesor(e.target.value)}
                  placeholder="Nume profesor"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
              </div>
            </div>

            {/* Întrebări grilă */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-4">
                Întrebări grilă <span className="text-gray-400 font-normal">({NUM_GRILA})</span>
              </h3>
              <div className="space-y-6">
                {questions.map((q, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-purple-700">Întrebarea {q.order_no}</span>
                      <span className="text-xs text-gray-400">
                        Corect: <strong className="text-gray-700">{q.correct_option}</strong>
                      </span>
                    </div>
                    <textarea
                      value={q.question_text}
                      onChange={e => updateQuestion(i, 'question_text', e.target.value)}
                      placeholder="Textul întrebării..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-3 focus:outline-none focus:border-purple-400"
                    />
                    <div className="space-y-1.5">
                      {(['A', 'B', 'C', 'D'] as const).map(letter => {
                        const fieldKey = `option_${letter.toLowerCase()}` as keyof Question
                        const optionVal = q[fieldKey] as string
                        const isCorrect = q.correct_option === letter
                        return (
                          <div key={letter}
                            className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                              isCorrect ? 'bg-purple-50 border-purple-200' : 'border-gray-100 hover:bg-gray-50'
                            }`}
                          >
                            <button type="button"
                              onClick={() => updateQuestion(i, 'correct_option', letter)}
                              className="shrink-0"
                              title="Marchează ca răspuns corect"
                            >
                              {isCorrect
                                ? <CircleDot size={20} className="text-purple-600" />
                                : <Circle size={20} className="text-gray-300 hover:text-gray-500" />}
                            </button>
                            <span className={`text-xs w-5 shrink-0 ${isCorrect ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                              {letter}.
                            </span>
                            <input type="text"
                              value={optionVal}
                              onChange={e => updateQuestion(i, fieldKey, e.target.value)}
                              placeholder={`Opțiunea ${letter}`}
                              className={`flex-1 px-2 py-1 bg-transparent text-sm focus:outline-none ${
                                isCorrect ? 'font-bold text-gray-900' : 'text-gray-700'
                              }`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Traduceri */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-4">
                Traduceri EN → RO <span className="text-gray-400 font-normal">({NUM_TRANS})</span>
              </h3>
              <div className="space-y-4">
                {translations.map((t, i) => (
                  <div key={i} className="border border-gray-100 rounded-lg p-4">
                    <div className="mb-2 text-xs font-bold text-purple-700">Traducerea {t.order_no}</div>
                    <label className="block text-xs text-gray-500 mb-1">Text engleză (de afișat cursantului)</label>
                    <textarea
                      value={t.english_text}
                      onChange={e => updateTranslation(i, 'english_text', e.target.value)}
                      placeholder="Original english text..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:border-purple-400"
                    />
                    <label className="block text-xs text-gray-500 mb-1">Traducere de referință (română)</label>
                    <textarea
                      value={t.romanian_key}
                      onChange={e => updateTranslation(i, 'romanian_key', e.target.value)}
                      placeholder="Traducerea corectă pentru notarea manuală..."
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Save */}
            <div className="sticky bottom-4">
              <button onClick={saveConfig} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white shadow-lg disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {saving ? 'Se salvează...' : 'Salvează configurarea'}
              </button>
            </div>
          </div>
        )}

        {/* TAB RESULTS */}
        {tab === 'results' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {!exam && (
              <div className="p-8 text-center text-gray-400 text-sm">
                Examenul nu a fost încă salvat. Completează tab-ul „Configurare".
              </div>
            )}
            {exam && answers.length === 0 && (
              <div className="p-8 text-center text-gray-400 text-sm">
                Niciun cursant nu a început încă examenul.
              </div>
            )}
            {exam && answers.length > 0 && (
              <div className="divide-y divide-gray-100">
                {answers.map(a => {
                  const st = students.find(x => x.id === a.student_id)
                  const isOpen = expandedId === a.id
                  const draftScore = gradeDraft[a.id] ?? a.translation_score ?? 0
                  return (
                    <div key={a.id}>
                      <button onClick={() => setExpandedId(isOpen ? null : a.id)}
                        className="w-full flex items-center justify-between gap-4 px-5 py-3 hover:bg-gray-50 text-left">
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">
                            {st?.full_name || '—'}
                          </div>
                          <div className="text-xs text-gray-400">
                            {st?.email || ''}
                            {a.submitted_at && ` · trimis ${new Date(a.submitted_at).toLocaleString('ro-RO')}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs px-2 py-0.5 rounded-md font-medium" style={{
                            background: a.status === 'graded' ? '#05966920' :
                                       a.status === 'submitted' ? '#d9770620' : '#6b728020',
                            color: a.status === 'graded' ? '#059669' :
                                   a.status === 'submitted' ? '#d97706' : '#6b7280',
                          }}>
                            {a.status === 'graded' ? 'Notat' : a.status === 'submitted' ? 'Trimis' : 'În lucru'}
                          </span>
                          <div className="text-xs text-gray-600">
                            <strong>{a.grila_score}</strong>/{NUM_GRILA} grilă
                          </div>
                          <div className="text-xs text-gray-600">
                            <strong>{a.translation_score}</strong>/5 trad.
                          </div>
                          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 bg-gray-50 space-y-4">
                          {/* Notare manuală traduceri */}
                          <div className="bg-white rounded-lg p-4 border border-purple-100">
                            <div className="text-xs font-semibold text-purple-700 mb-2">
                              Notare traduceri (1-5)
                            </div>
                            <div className="flex items-center gap-3">
                              <input type="number" min={0} max={5} step={1}
                                value={draftScore}
                                onChange={e => setGradeDraft(prev => ({
                                  ...prev,
                                  [a.id]: Math.max(0, Math.min(5, parseInt(e.target.value) || 0))
                                }))}
                                className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-purple-400"
                              />
                              <button onClick={() => saveGrade(a)}
                                disabled={savingGrade === a.id || a.status === 'in_progress'}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                style={{ background: '#7c3aed' }}>
                                {savingGrade === a.id ? <Loader2 size={14} className="animate-spin inline" /> : <Check size={14} className="inline mr-1" />}
                                Salvează nota
                              </button>
                              {a.graded_at && (
                                <span className="text-xs text-gray-400">
                                  Notat {new Date(a.graded_at).toLocaleString('ro-RO')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Răspunsuri grilă */}
                          <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-700 mb-3">Răspunsuri grilă</div>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {questions.map(q => {
                                const studentAnswer = a.grila_answers?.[String(q.order_no)] || '—'
                                const correct = studentAnswer === q.correct_option
                                return (
                                  <div key={q.order_no} className="text-xs flex items-center gap-2 py-1">
                                    <span className="w-6 text-gray-400">{q.order_no}.</span>
                                    <span className={`font-mono font-bold ${correct ? 'text-green-600' : 'text-red-600'}`}>
                                      {studentAnswer}
                                    </span>
                                    <span className="text-gray-300">/</span>
                                    <span className="font-mono text-gray-500">{q.correct_option}</span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Răspunsuri traduceri */}
                          <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-700 mb-3">Răspunsuri traduceri</div>
                            <div className="space-y-3">
                              {translations.map(t => {
                                const studentText = a.translation_answers?.[String(t.order_no)] || ''
                                return (
                                  <div key={t.order_no} className="text-xs">
                                    <div className="text-gray-400 mb-1">
                                      <strong>EN {t.order_no}:</strong> {t.english_text}
                                    </div>
                                    <div className="text-gray-400 mb-1">
                                      <strong>Referință:</strong> {t.romanian_key}
                                    </div>
                                    <div className="bg-purple-50 border border-purple-100 rounded p-2 text-gray-800 whitespace-pre-wrap">
                                      <strong>Cursant:</strong> {studentText || <em className="text-gray-400">(necompletat)</em>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
