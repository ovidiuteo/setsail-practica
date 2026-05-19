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
  feedback: string
  obtinere_prelungire: string
  status: string
  submitted_at: string | null
  grila_score: number
  translation_score: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const MONTHS_SHORT_RO = ['IAN', 'FEB', 'MAR', 'APR', 'MAI', 'IUN', 'IUL', 'AUG', 'SEP', 'OCT', 'NOI', 'DEC']
const MONTHS_LONG_RO = ['IANUARIE', 'FEBRUARIE', 'MARTIE', 'APRILIE', 'MAI', 'IUNIE', 'IULIE', 'AUGUST', 'SEPTEMBRIE', 'OCTOMBRIE', 'NOIEMBRIE', 'DECEMBRIE']

function formatDateShortRO(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS_SHORT_RO[d.getMonth()]} ${d.getFullYear()}`
}
function formatDateLongRO(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS_LONG_RO[d.getMonth()]} ${d.getFullYear()}`
}

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
  const [feedback, setFeedback] = useState<string>('')
  const [profesorGrila, setProfesorGrila] = useState<string>('DRUGAN OVIDIU')
  const [profesorEngleza, setProfesorEngleza] = useState<string>('DRUGAN OVIDIU')
  const [codGenerare, setCodGenerare] = useState<string>('')
  const [obtinerePrelungire, setObtinerePrelungire] = useState<string>('')

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [submitting, setSubmitting] = useState(false)

  const lastSavedRef = useRef<{ grila: string; trad: string; feedback: string; obtinere: string }>({ grila: '', trad: '', feedback: '', obtinere: '' })
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
      if (ex.profesor_grila) setProfesorGrila(ex.profesor_grila)
      else if (ex.profesor_examinator) setProfesorGrila(ex.profesor_examinator)
      if (ex.profesor_engleza) setProfesorEngleza(ex.profesor_engleza)
      else if (ex.profesor_examinator) setProfesorEngleza(ex.profesor_examinator)
      if (ex.cod_generare) setCodGenerare(ex.cod_generare)

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
      setFeedback(row.feedback || '')
      setObtinerePrelungire(row.obtinere_prelungire || '')
      lastSavedRef.current = {
        grila: JSON.stringify(row.grila_answers || {}),
        trad: JSON.stringify(row.translation_answers || {}),
        feedback: row.feedback || '',
        obtinere: row.obtinere_prelungire || '',
      }

      setPhase('ready')
    })()
  }, [router])

  // ---------- AUTO-SAVE ----------
  const doSave = useCallback(async () => {
    if (!answerRowIdRef.current) return
    const gJson = JSON.stringify(grila)
    const tJson = JSON.stringify(trad)
    if (
      gJson === lastSavedRef.current.grila &&
      tJson === lastSavedRef.current.trad &&
      feedback === lastSavedRef.current.feedback &&
      obtinerePrelungire === lastSavedRef.current.obtinere
    ) return
    setSaveStatus('saving')
    const { error } = await supabase
      .from('radio_exam_answers')
      .update({
        grila_answers: grila,
        translation_answers: trad,
        feedback: feedback,
        obtinere_prelungire: obtinerePrelungire,
        updated_at: new Date().toISOString(),
      })
      .eq('id', answerRowIdRef.current)
    if (error) {
      setSaveStatus('error')
    } else {
      lastSavedRef.current = { grila: gJson, trad: tJson, feedback, obtinere: obtinerePrelungire }
      setSaveStatus('saved')
    }
  }, [grila, trad, feedback, obtinerePrelungire])

  useEffect(() => {
    if (phase !== 'ready') return
    const interval = setInterval(() => { doSave() }, 1000)
    return () => clearInterval(interval)
  }, [phase, doSave])

  // ---------- SUBMIT FINAL ----------
  async function submitFinal() {
    if (!answerRow || !examId) return
    if (!obtinerePrelungire) {
      alert('Te rugăm să alegi „Obținere carnet" sau „Prelungire valabilitate" la începutul examenului.')
      return
    }
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
          feedback: feedback,
          obtinere_prelungire: obtinerePrelungire,
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
            <h1 className="text-base font-bold text-gray-900 truncate">Examinare Radio LRC</h1>
            <p className="text-sm text-gray-400 truncate">{studentName}</p>
          </div>
          <div className="text-sm flex items-center gap-2 shrink-0">
            {saveStatus === 'saving' && <><Loader2 size={14} className="animate-spin text-gray-400" /> <span className="text-gray-400">Salvez...</span></>}
            {saveStatus === 'saved' && <><CheckCircle size={14} className="text-green-500" /> <span className="text-green-600">Salvat</span></>}
            {saveStatus === 'error' && <><AlertCircle size={14} className="text-red-500" /> <span className="text-red-600">Eroare salvare</span></>}
            {saveStatus === 'idle' && <Save size={14} className="text-gray-300" />}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-4 pb-2 flex gap-3 text-sm text-gray-500">
          <span>Grilă: <strong className="text-gray-800">{answeredGrila}/{totalGrila}</strong></span>
          <span>Traduceri: <strong className="text-gray-800">{answeredTrad}/{totalTrad}</strong></span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">

        {/* Antet examen */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            EXAMEN RADIO GMDSS/LRC - {formatDateShortRO(session?.session_date)}
          </h1>
          <p className="text-sm text-gray-700 leading-relaxed mb-6">
            Probă de regulamente interne şi internaţionale pentru examenul de obţinere/prelungire a Certificatului General
            de Operator radio pentru ambarcaţiuni de agrement în Serviciile Mobil Maritim şi Mobil Maritim prin
            Satelit emis în conformitate Rezoluţia 343 (WRC-97) şi Recomandarea CEPT ERC 31-05 E
          </p>
          <div className="space-y-2 text-base text-gray-800">
            <div>DATA: {formatDateLongRO(session?.session_date)}</div>
            <div>Evaluare simulator: ________</div>
            <div>Numar subiecte engleza: {totalTrad}</div>
            <div>Punctaj engleza: ________</div>
            <div>Numar subiecte grila: {totalGrila}</div>
            <div>Numar subiecte corecte: ________</div>
          </div>
          {codGenerare && (
            <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
              Cod generare = {codGenerare}
            </div>
          )}
        </div>

        {/* Obținere / Prelungire */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <label className="block text-base font-semibold text-gray-900 mb-3">
            OBȚINERE CARNET SAU PRELUNGIRE? <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {[
              { val: 'obtinere', label: 'OBȚINERE CARNET (nu am mai avut brevet radio sau a expirat)' },
              { val: 'prelungire', label: 'PRELUNGIRE VALABILITATE (carnetul mai are foarte puțin și expiră)' },
            ].map(opt => {
              const isSelected = obtinerePrelungire === opt.val
              return (
                <button key={opt.val} type="button"
                  onClick={() => setObtinerePrelungire(opt.val)}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                    isSelected ? 'bg-purple-50 border-purple-300' : 'border-gray-200 hover:bg-gray-50'
                  }`}>
                  {isSelected
                    ? <CircleDot size={22} className="text-purple-600 shrink-0 mt-0.5" />
                    : <Circle size={22} className="text-gray-300 shrink-0 mt-0.5" />}
                  <span className={`text-base ${isSelected ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                    {opt.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Avertisment */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex gap-2">
          <span className="text-lg leading-none">⚠️</span>
          <span>
            Răspunsurile se salvează automat. Apasă <strong>„Trimite examen"</strong> la final.
            După trimitere, nu mai poți modifica nimic.
          </span>
        </div>

        {/* Întrebări grilă */}
        <div className="bg-white rounded-2xl p-5 shadow-sm space-y-5">
          <div className="border-b border-gray-100 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h2 className="font-bold text-gray-900 text-lg">CHESTIONAR RĂSPUNSURI - TEST GRILA PROBA LRC</h2>
              <div className="text-sm text-gray-500 font-medium">PROFESOR EXAMINATOR: {profesorGrila}</div>
            </div>
          </div>
          {questions.map(q => {
            const selected = grila[String(q.order_no)] || ''
            return (
              <div key={q.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                <div className="text-lg font-bold text-gray-900 mb-3 whitespace-pre-wrap">{q.order_no}. {q.question_text}</div>
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
                          ? <CircleDot size={22} className="text-purple-600 shrink-0 mt-0.5" />
                          : <Circle size={22} className="text-gray-300 shrink-0 mt-0.5" />}
                        <span className={`text-base ${isSelected ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
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
          <div className="border-b border-gray-100 pb-3">
            <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
              <h2 className="font-bold text-gray-900 text-lg">Radiocomunicatii LRC proba II: ENGLEZA</h2>
              <div className="text-sm text-gray-500 font-medium">PROFESOR EXAMINATOR: {profesorEngleza}</div>
            </div>
            <div className="text-base font-semibold text-gray-700 mt-3">Translate into Romanian:</div>
          </div>
          {translations.map(t => (
            <div key={t.id} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
              <div className="text-lg font-bold text-gray-900 mb-3 whitespace-pre-wrap bg-gray-50 rounded-lg p-3">
                {t.order_no}. {t.english_text}
              </div>
              <label className="block text-sm text-gray-500 mb-1">Traducerea ta în română:</label>
              <textarea
                value={trad[String(t.order_no)] || ''}
                onChange={e => setTrad(prev => ({ ...prev, [String(t.order_no)]: e.target.value }))}
                rows={3}
                placeholder="Scrie traducerea aici..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-purple-400"
              />
            </div>
          ))}
        </div>

        {/* Feedback Google Reviews */}
        <div className="bg-white rounded-2xl p-5 shadow-sm">
          <h2 className="font-bold text-gray-900 text-lg mb-2">Feedback curs Radio Online</h2>
          <p className="text-base text-gray-600 mb-4">
            Vă rugăm să ne acordați câteva minute și să ne redactați un feedback al experienței
            dumneavoastră SetSail.
          </p>
          <p className="text-base text-gray-600 mb-4">
            Este cu atât mai de ajutor cu cât doriți să-l postați și la Google Reviews, prin link
            sau prin scanare QR Code:
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-4 p-4 bg-gray-50 rounded-xl">
            <img src="/qr-feedback-google.jpg" alt="QR Google Reviews SetSail"
              className="w-32 h-32 shrink-0 rounded-lg shadow-sm" />
            <div className="flex-1 text-center sm:text-left">
              <a href="https://g.page/r/CSF2mkhzKOBDEAI/review"
                target="_blank" rel="noopener noreferrer"
                className="inline-block px-4 py-2 rounded-lg text-sm font-medium text-white"
                style={{ background: '#7c3aed' }}>
                Deschide formular Google Reviews
              </a>
              <p className="text-sm text-gray-400 mt-2 break-all">
                https://g.page/r/CSF2mkhzKOBDEAI/review
              </p>
            </div>
          </div>
          <label className="block text-sm text-gray-500 mb-1">Feedback-ul tău (opțional):</label>
          <textarea
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            rows={4}
            placeholder="Scrie aici impresiile tale despre curs..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-base focus:outline-none focus:border-purple-400"
          />
          <p className="text-sm text-gray-400 mt-2 text-center">
            Echipa SetSail vă mulțumește pentru bunăvoință!
          </p>
        </div>

        {/* Submit */}
        <button onClick={submitFinal} disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-base font-bold text-white shadow-lg disabled:opacity-50"
          style={{ background: '#7c3aed' }}>
          {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          {submitting ? 'Se trimite...' : 'Trimite examen'}
        </button>
        <p className="text-sm text-gray-400 text-center">
          După trimitere nu mai poți modifica răspunsurile.
        </p>

      </div>
    </div>
  )
}
