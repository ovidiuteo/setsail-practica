'use client'
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Circle, CircleDot, Loader2, CheckCircle, AlertCircle, Send, Save
} from 'lucide-react'

type Question = {
  id: string
  order_no: number
  question_text: string
  option_a: string
  option_b: string
  option_c: string
  option_d: string
  correct_option: string
}
type Translation = {
  id: string
  order_no: number
  english_text: string
  romanian_key: string
}
type AnswerRow = {
  id: string
  exam_id: string
  student_id: string
  grila_answers: Record<string, string>
  translation_answers: Record<string, string>
  status: string
  submitted_at: string | null
  grila_score: number
  translation_score: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export default function PortalExamenPage() {
  const router = useRouter()

  const [phase, setPhase] = useState<'loading' | 'no-active' | 'closed' | 'already-submitted' | 'ready' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [studentName, setStudentName] = useState('')
  const [session, setSession] = useState<any>(null)
  const [examId, setExamId] = useState<string>('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [translations, setTranslations] = useState<Translation[]>([])
  const [answerRow, setAnswerRow] = useState<AnswerRow | null>(null)

  const [grila, setGrila] = useState<Record<string, string>>({})
  const [trad, setTrad] = useState<Record<string, string>>({})

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [submitting, setSubmitting] = useState(false)

  const lastSavedRef = useRef<{ grila: string; trad: string }>({ grila: '', trad: '' })
  const answerRowIdRef = useRef<string>('')

  // ---------- INIT / AUTH ----------
  useEffect(() => {
    (async () => {
      const cod = (typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('cod') || ''
        : '').toUpperCase().trim()
      if (!cod) {
        setPhase('error'); setErrorMsg('Lipsește codul de sesiune din URL.'); return
      }

      // 1) Auto-login din localStorage
      let stored: { email?: string; student_id?: string } | null = null
      try {
        const raw = localStorage.getItem(`setsail_portal_${cod}`)
        if (raw) stored = JSON.parse(raw)
      } catch {}
      if (!stored?.student_id || !stored?.email) {
        router.replace(`/portal?cod=${cod}`)
        return
      }

      // 2) Fetch sesiune
      const { data: sessList } = await supabase
        .from('sessions')
        .select('id, access_code, session_date, class_caa, radio_exam_status, location_id, locations(name)')
        .eq('access_code', cod)
      if (!sessList || sessList.length === 0) {
        setPhase('error'); setErrorMsg('Sesiunea nu a fost găsită.'); return
      }
      const sess = sessList.find((x: any) => x.session_type === 'principal' && !x.parent_session_id)
                || sessList.find((x: any) => x.session_type === 'principal')
                || sessList[0]
      setSession(sess)

      if (sess.radio_exam_status !== 'active') {
        if (sess.radio_exam_status === 'closed') setPhase('closed')
        else setPhase('no-active')
        return
      }

      // 3) Fetch examen
      const sessionIds = sessList.map((x: any) => x.id)
      const { data: ex } = await supabase
        .from('radio_exams')
        .select('*')
        .in('session_id', sessionIds)
        .maybeSingle()
      if (!ex) { setPhase('error'); setErrorMsg('Examenul nu este configurat.'); return }
      setExamId(ex.id)

      // 4) Verifică studentul + nume
      const { data: st } = await supabase
        .from('students')
        .select('id, full_name, email, session_id')
        .eq('id', stored.student_id)
        .ilike('email', stored.email)
        .maybeSingle()
      if (!st) {
        // localStorage stricat / desincronizat → re-login
        try { localStorage.removeItem(`setsail_portal_${cod}`) } catch {}
        router.replace(`/portal?cod=${cod}`)
        return
      }
      setStudentName(st.full_name || '')

      // 5) Fetch întrebări + traduceri
      const { data: qs } = await supabase
        .from('radio_exam_questions')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      const { data: tr } = await supabase
        .from('radio_exam_translations')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      setQuestions((qs || []) as Question[])
      setTranslations((tr || []) as Translation[])

      // 6) Fetch sau creează rândul de răspunsuri
      const { data: existing } = await supabase
        .from('radio_exam_answers')
        .select('*')
        .eq('exam_id', ex.id)
        .eq('student_id', st.id)
        .maybeSingle()

      let row = existing as AnswerRow | null
      if (!row) {
        const { data: created, error } = await supabase
          .from('radio_exam_answers')
          .insert({
            exam_id: ex.id,
            student_id: st.id,
            grila_answers: {},
            translation_answers: {},
            status: 'in_progress',
          })
          .select()
          .single()
        if (error) { setPhase('error'); setErrorMsg('Eroare la inițializare: ' + error.message); return }
        row = created as AnswerRow
      }
      setAnswerRow(row)
      answerRowIdRef.current = row.id

      if (row.status === 'submitted' || row.status === 'graded') {
        setPhase('already-submitted')
        return
      }

      setGrila(row.grila_answers || {})
      setTrad(row.translation_answers || {})
      lastSavedRef.current = {
        grila: JSON.stringify(row.grila_answers || {}),
        trad: JSON.stringify(row.translation_answers || {}),
      }

      setPhase('ready')
    })()
  }, [router])

  // ---------- AUTO-SAVE ----------
  const doSave = useCallback(async () => {
    if (!answerRowIdRef.current) return
    const gJson = JSON.stringify(grila)
    const tJson = JSON.stringify(trad)
    if (gJson === lastSavedRef.current.grila && tJson === lastSavedRef.current.trad) return
    setSaveStatus('saving')
    const { error } = await supabase
      .from('radio_exam_answers')
      .update({
        grila_answers: grila,
        translation_answers: trad,
        updated_at: new Date().toISOString(),
      })
      .eq('id', answerRowIdRef.current)
    if (error) {
      setSaveStatus('error')
    } else {
      lastSavedRef.current = { grila: gJson, trad: tJson }
      setSaveStatus('saved')
    }
  }, [grila, trad])

  useEffect(() => {
    if (phase !== 'ready') return
    const interval = setInterval(() => { doSave() }, 1000)
    return () => clearInterval(interval)
  }, [phase, doSave])

  // ---------- SUBMIT FINAL ----------
  async function submitFinal() {
    if (!answerRow || !examId) return
    if (!confirm('Sigur trimiți examenul? Nu vei mai putea modifica nimic după acest pas.')) return
    setSubmitting(true)
    try {
      // calcul scor grilă local
      let score = 0
      for (const q of questions) {
        if (grila[String(q.order_no)] === q.correct_option) score++
      }
      const { error } = await supabase
        .from('radio_exam_answers')
        .update({
          grila_answers: grila,
          translation_answers: trad,
          grila_score: score,
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', answerRow.id)
      if (error) throw error
      setPhase('already-submitted')
    } catch (e: any) {
      alert('Eroare la trimitere: ' + (e.message || String(e)))
    } finally {
      setSubmitting(false)
    }
  }

  // ---------- RENDER STATES ----------
  if (phase === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }
  if (phase === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md text-center">
          <AlertCircle size={32} className="mx-auto text-red-500 mb-3" />
          <h2 className="font-bold text-gray-900 mb-1">Eroare</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    )
  }
  if (phase === 'no-active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md text-center">
          <AlertCircle size={32} className="mx-auto text-amber-500 mb-3" />
          <h2 className="font-bold text-gray-900 mb-1">Examenul nu este activ</h2>
          <p className="text-sm text-gray-500">
            Vei putea accesa examenul când profesorul îl deschide. Reîncarcă pagina mai târziu.
          </p>
        </div>
      </div>
    )
  }
  if (phase === 'closed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md text-center">
          <CheckCircle size={32} className="mx-auto text-purple-500 mb-3" />
          <h2 className="font-bold text-gray-900 mb-1">Examenul s-a încheiat</h2>
          <p className="text-sm text-gray-500">
            Examenul a fost închis. Rezultatele îți vor fi comunicate ulterior.
          </p>
        </div>
      </div>
    )
  }
  if (phase === 'already-submitted') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-md text-center">
          <CheckCircle size={32} className="mx-auto text-green-500 mb-3" />
          <h2 className="font-bold text-gray-900 mb-1">Examen trimis</h2>
          <p className="text-sm text-gray-500 mb-1">Mulțumim, {studentName}.</p>
          <p className="text-sm text-gray-500">
            Răspunsurile tale au fost înregistrate. Rezultatul îți va fi transmis ulterior.
          </p>
        </div>
      </div>
    )
  }

  // PHASE === 'ready' — examenul activ, formularul de completare
  const totalGrila = questions.length
  const totalTrad = translations.length
  const answeredGrila = Object.values(grila).filter(v => v).length
  const answeredTrad = Object.values(trad).filter(v => v && v.trim()).length

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-gray-900 truncate">Examinare Radio LRC</h1>
            <p className="text-xs text-gray-400 truncate">{studentName}</p>
          </div>
          <div className="text-xs flex items-center gap-2 shrink-0">
            {saveStatus === 'saving' && <><Loader2 size={12} className="animate-spin text-gray-400" /> <span className="text-gray-400">Salvez...</span></>}
            {saveStatus === 'saved' && <><CheckCircle size={12} className="text-green-500" /> <span className="text-green-600">Salvat</span></>}
            {saveStatus === 'error' && <><AlertCircle size={12} className="text-red-500" /> <span className="text-red-600">Eroare salvare</span></>}
            {saveStatus === 'idle' && <Save size={12} className="text-gray-300" />}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-3 text-xs text-gray-500">
          <span>Grilă: <strong className="text-gray-800">{answeredGrila}/{totalGrila}</strong></span>
          <span>Traduceri: <strong className="text-gray-800">{answeredTrad}/{totalTrad}</strong></span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">

        {/* Avertisment */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex gap-2">
          <span className="text-base leading-none">⚠️</span>
          <span>
            Răspunsurile se salvează automat. Apasă <strong>„Trimite examen"</strong> la final.
            După trimitere, nu mai poți modifica nimic.
          </span>
        </div>

        {/* Întrebări grilă */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <h2 className="font-bold text-gray-900">Întrebări grilă</h2>
          {questions.map(q => {
            const selected = grila[String(q.order_no)] || ''
            return (
              <div key={q.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                <div className="text-xs font-bold text-purple-700 mb-1">Întrebarea {q.order_no}</div>
                <div className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{q.question_text}</div>
                <div className="space-y-1.5">
                  {(['A', 'B', 'C', 'D'] as const).map(letter => {
                    const optKey = `option_${letter.toLowerCase()}` as keyof Question
                    const optionText = q[optKey] as string
                    const isSelected = selected === letter
                    return (
                      <button
                        key={letter}
                        type="button"
                        onClick={() => setGrila(prev => ({ ...prev, [String(q.order_no)]: letter }))}
                        className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                          isSelected ? 'bg-purple-50 border-purple-300' : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        {isSelected
                          ? <CircleDot size={20} className="text-purple-600 shrink-0 mt-0.5" />
                          : <Circle size={20} className="text-gray-300 shrink-0 mt-0.5" />}
                        <span className={`text-sm ${isSelected ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                          <span className="mr-2">{letter}.</span>{optionText}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Traduceri */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <h2 className="font-bold text-gray-900">Traduceri EN → RO</h2>
          {translations.map(t => (
            <div key={t.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
              <div className="text-xs font-bold text-purple-700 mb-1">Traducerea {t.order_no}</div>
              <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-2 whitespace-pre-wrap">
                {t.english_text}
              </div>
              <label className="block text-xs text-gray-500 mb-1">Traducerea ta în română:</label>
              <textarea
                value={trad[String(t.order_no)] || ''}
                onChange={e => setTrad(prev => ({ ...prev, [String(t.order_no)]: e.target.value }))}
                rows={3}
                placeholder="Scrie traducerea aici..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
          ))}
        </div>

        {/* Submit */}
        <button onClick={submitFinal} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold text-white shadow-lg disabled:opacity-50"
          style={{ background: '#dc2626' }}>
          {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
          {submitting ? 'Se trimite...' : 'Trimite examen'}
        </button>
        <p className="text-xs text-gray-400 text-center">
          După trimitere nu mai poți modifica răspunsurile.
        </p>

      </div>
    </div>
  )
}
