'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Save, Circle, CircleDot, FileText, Users,
  Play, Lock, RotateCcw, ChevronDown, ChevronUp, Loader2, Check,
  Sparkles, ExternalLink, AlertCircle, Shuffle, Trash2, Copy,
  Upload, X, EyeOff
} from 'lucide-react'

type RadioExam = {
  id: string
  session_id: string
  cod_generare: string | null
  profesor_examinator: string | null
  profesor_grila: string | null
  profesor_engleza: string | null
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
  feedback: string
  obtinere_prelungire: string
  status: 'in_progress' | 'submitted' | 'graded' | string
  submitted_at: string | null
  graded_at: string | null
  grila_score: number
  translation_score: number
  simulator_score: number | null
}
type StudentLite = {
  id: string
  full_name: string
  email: string
  class_caa: string
}
type PoolQuestionRow = {
  id: string
  code: string
  question_text: string
  active: boolean
}
type PoolOptionRow = {
  id: string
  question_id: string
  code: 'X' | 'Y' | 'Z' | 'W'
  option_text: string
  is_correct: boolean
}
type PoolTranslationRow = {
  id: string
  code: string
  english_text: string
  active: boolean
}

const NUM_GRILA = 20
const NUM_TRANS = 5

const STATUS_META: Record<string, { label: string; bg: string; color: string }> = {
  draft:  { label: 'Ciornă',  bg: '#6b728020', color: '#6b7280' },
  active: { label: 'Activ',   bg: '#05966920', color: '#059669' },
  hidden: { label: 'Ascuns',  bg: '#d9770620', color: '#d97706' },
  closed: { label: 'Închis',  bg: '#7c3aed20', color: '#7c3aed' },
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Generează un cod numeric de N digiți: primul digit 1-9, restul 0-9,
// fără mai mult de 3 zerouri consecutive.
function generateRandomCode(length = 13): string {
  for (let attempt = 0; attempt < 50; attempt++) {
    let code = String(Math.floor(Math.random() * 9) + 1)
    for (let i = 1; i < length; i++) {
      code += String(Math.floor(Math.random() * 10))
    }
    if (!/0{4,}/.test(code)) return code
  }
  // fallback foarte improbabil
  return '1' + String(Date.now()).slice(-(length - 1))
}

// Normalizare text pentru comparație — tolerantă la diacritice, ghilimele și whitespace
function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    // Descompune diacriticele (ă → a + ̆) apoi elimină marcajele combining
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    // Variante ş/ţ cu cedillă (vechi) → s/t
    .replace(/[\u0219\u015F]/g, 's')
    .replace(/[\u021B\u0163]/g, 't')
    // TOATE ghilimelele (ASCII + tipografice) și apostrofurile — codepoints explicit
    .replace(/[\u0022\u0027\u0060\u00AB\u00BB\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u201F]/g, '')
    // Whitespace exotic (NBSP, ZWSP, narrow NBSP, em space, en space)
    .replace(/[\u00A0\u200B\u202F\u2003\u2002]/g, ' ')
    .replace(/\s+/g, ' ')
    // Punctuație finală
    .replace(/[.,;:!?)\]]+$/g, '')
    .trim()
}

interface ParsedQuestion {
  number: number
  question_text: string
  options: { A: string; B: string; C: string; D: string }
}

// Parsează un text de examen Radio LRC și extrage codul de generare + cele 20 întrebări
function parseExamText(text: string): { codGenerare: string | null; questions: ParsedQuestion[] } {
  const lines = text.split(/\r?\n/)
  let codGenerare: string | null = null
  for (const line of lines) {
    const m = line.match(/Cod\s*generare\s*=\s*(\d+)/i)
    if (m) { codGenerare = m[1]; break }
  }

  // Filtrare linii header/footer repetitive
  const cleaned: string[] = []
  for (const raw of lines) {
    const t = raw.trim()
    if (!t) continue
    if (t.startsWith('Probă de regulamente interne')) continue
    if (t.startsWith('de Operator radio')) continue
    if (t.startsWith('Satelit emis')) continue
    if (/^(luni|marți|marţi|miercuri|joi|vineri|sâmbătă|sambata|duminică|duminica),/i.test(t)) continue
    if (/Page\s+\d+\s+of\s+\d+/i.test(t)) continue
    cleaned.push(t)
  }

  const questions: ParsedQuestion[] = []
  let current: ParsedQuestion | null = null
  let currentField: 'question_text' | 'A' | 'B' | 'C' | 'D' | null = null
  let nextExpected = 1

  function commit() {
    if (current) {
      // normalize whitespace
      current.question_text = current.question_text.replace(/\s+/g, ' ').trim()
      current.options.A = current.options.A.replace(/\s+/g, ' ').trim()
      current.options.B = current.options.B.replace(/\s+/g, ' ').trim()
      current.options.C = current.options.C.replace(/\s+/g, ' ').trim()
      current.options.D = current.options.D.replace(/\s+/g, ' ').trim()
      questions.push(current)
    }
  }

  for (const line of cleaned) {
    // Nouă întrebare: "N TextÎntrebare..." sau "N. Text..."
    // Doar dacă N este următorul așteptat (1..20) — evităm confuzia cu "1. MSI; ..." din răspunsuri
    const qMatch = line.match(/^(\d{1,2})[\s.)]+(.+)$/)
    if (qMatch && parseInt(qMatch[1], 10) === nextExpected && nextExpected <= 20 && !/^[A-D]\.\s/.test(qMatch[2])) {
      commit()
      current = {
        number: nextExpected,
        question_text: qMatch[2],
        options: { A: '', B: '', C: '', D: '' },
      }
      currentField = 'question_text'
      nextExpected++
      continue
    }

    // Răspuns A/B/C/D
    const oMatch = line.match(/^([A-D])\.\s*(.*)$/)
    if (oMatch && current) {
      const letter = oMatch[1] as 'A' | 'B' | 'C' | 'D'
      current.options[letter] = oMatch[2]
      currentField = letter
      continue
    }

    // Continuare pe linie nouă
    if (current && currentField) {
      if (currentField === 'question_text') {
        current.question_text += ' ' + line
      } else {
        current.options[currentField] += ' ' + line
      }
    }
  }
  commit()

  return { codGenerare, questions }
}

export default function ExamenPage() {
  const params = useParams<{ id: string }>()
  const sessionId = params?.id as string

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState<'q' | 't' | null>(null)
  const [sessAccessCode, setSessAccessCode] = useState('')
  const [sessDate, setSessDate] = useState('')
  const [sessClassCaa, setSessClassCaa] = useState('')
  const [radioExamStatus, setRadioExamStatus] = useState<string>('draft')

  const [exam, setExam] = useState<RadioExam | null>(null)
  const [codGenerare, setCodGenerare] = useState('')
  const [profesorGrila, setProfesorGrila] = useState('')
  const [profesorEngleza, setProfesorEngleza] = useState('')
  const [useCustomGrila, setUseCustomGrila] = useState(false)
  const [useCustomEngleza, setUseCustomEngleza] = useState(false)
  const [availableProfesori, setAvailableProfesori] = useState<string[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [translations, setTranslations] = useState<Translation[]>([])

  const [tab, setTab] = useState<'config' | 'results'>('config')
  const [resultsView, setResultsView] = useState<'answers' | 'noshow'>('answers')
  const paramsApplied = useRef(false)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [students, setStudents] = useState<StudentLite[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [gradeDraft, setGradeDraft] = useState<Record<string, number>>({})
  const [simulatorDraft, setSimulatorDraft] = useState<Record<string, number | null>>({})
  const [savingGrade, setSavingGrade] = useState<string | null>(null)

  // Randomizatoare note
  const [showRandomTrad, setShowRandomTrad] = useState(false)
  const [randomTradCounts, setRandomTradCounts] = useState<{ five: number; four: number }>({ five: 0, four: 0 })
  const [showRandomSim, setShowRandomSim] = useState(false)
  const [randomSimCounts, setRandomSimCounts] = useState<{ ten: number; nine: number; eight: number }>({ ten: 0, nine: 0, eight: 0 })
  const [randomizing, setRandomizing] = useState(false)

  // Rezolvare manuală cursant
  const [showResolve, setShowResolve] = useState(false)
  const [resolveStudentId, setResolveStudentId] = useState<string>('')
  const [resolveGrilaScore, setResolveGrilaScore] = useState<number>(20)
  const [resolveTradScore, setResolveTradScore] = useState<string>('')
  const [resolveSimScore, setResolveSimScore] = useState<string>('')
  const [resolveExistingAnswerId, setResolveExistingAnswerId] = useState<string | null>(null)
  const [resolveBusy, setResolveBusy] = useState(false)
  // Editare punctuala a unui raspuns grila al unui cursant
  const [editQ, setEditQ] = useState<{ answer: Answer; question: Question; selected: string } | null>(null)
  const [savingEditQ, setSavingEditQ] = useState(false)
  const [solutionCopied, setSolutionCopied] = useState(false)
  const [generatingPdf, setGeneratingPdf] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const [importError, setImportError] = useState('')

  // ---------- LOAD ----------
  const loadAll = useCallback(async () => {
    setLoading(true)

    const { data: s } = await supabase
      .from('sessions')
      .select('id, access_code, session_date, class_caa, radio_exam_status, instructor_id, contact_person_ids')
      .eq('id', sessionId)
      .single()
    if (s) {
      setSessAccessCode(s.access_code || '')
      setSessDate(s.session_date || '')
      setSessClassCaa(s.class_caa || '')
      setRadioExamStatus(s.radio_exam_status || 'draft')
    }

    // Fetch contact persons + instructor pentru lista profesori
    const profesoriList: string[] = []
    if (s?.instructor_id) {
      const { data: ins } = await supabase
        .from('instructors')
        .select('full_name')
        .eq('id', s.instructor_id)
        .maybeSingle()
      if (ins?.full_name) profesoriList.push(ins.full_name)
    }
    if (s?.contact_person_ids && Array.isArray(s.contact_person_ids) && s.contact_person_ids.length > 0) {
      const { data: cps } = await supabase
        .from('contact_persons')
        .select('full_name')
        .in('id', s.contact_person_ids)
      if (cps) cps.forEach((c: any) => {
        if (c.full_name && !profesoriList.includes(c.full_name)) profesoriList.push(c.full_name)
      })
    }
    setAvailableProfesori(profesoriList)

    // Detect Ovidiu Drugan din listă pentru default
    const ovidiuMatch = profesoriList.find(n =>
      n.toLowerCase().includes('ovidiu') && n.toLowerCase().includes('drugan')
    )

    const { data: ex } = await supabase
      .from('radio_exams')
      .select('*')
      .eq('session_id', sessionId)
      .maybeSingle()

    if (ex) {
      setExam(ex as RadioExam)
      setCodGenerare(ex.cod_generare || '')

      // Migrare valoare legacy din profesor_examinator dacă coloanele noi sunt goale
      const grilaVal = ex.profesor_grila || ex.profesor_examinator || ovidiuMatch || ''
      const englezaVal = ex.profesor_engleza || ex.profesor_examinator || ovidiuMatch || ''
      setProfesorGrila(grilaVal)
      setProfesorEngleza(englezaVal)
      setUseCustomGrila(!!grilaVal && !profesoriList.includes(grilaVal))
      setUseCustomEngleza(!!englezaVal && !profesoriList.includes(englezaVal))

      const { data: qs } = await supabase
        .from('radio_exam_questions')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      setQuestions((qs || []).map((q: any) => ({
        id: q.id,
        exam_id: q.exam_id,
        order_no: q.order_no,
        question_text: q.question_text || '',
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        correct_option: (q.correct_option || 'A') as 'A' | 'B' | 'C' | 'D',
      })))

      const { data: tr } = await supabase
        .from('radio_exam_translations')
        .select('*')
        .eq('exam_id', ex.id)
        .order('order_no', { ascending: true })
      setTranslations((tr || []).map((t: any) => ({
        id: t.id,
        exam_id: t.exam_id,
        order_no: t.order_no,
        english_text: t.english_text || '',
        romanian_key: t.romanian_key || '',
      })))

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

      // Init grade draft + simulator draft
      const draft: Record<string, number> = {}
      const simDraft: Record<string, number | null> = {}
      ansList.forEach(a => {
        draft[a.id] = a.translation_score || 0
        simDraft[a.id] = a.simulator_score ?? null
      })
      setGradeDraft(draft)
      setSimulatorDraft(simDraft)
    } else {
      setExam(null)
      setQuestions([])
      setTranslations([])
      setAnswers([])
      setStudents([])
      // Default Ovidiu Drugan dacă există în listă
      if (ovidiuMatch) {
        setProfesorGrila(ovidiuMatch)
        setProfesorEngleza(ovidiuMatch)
      }
    }

    setLoading(false)
  }, [sessionId])

  useEffect(() => { if (sessionId) loadAll() }, [sessionId, loadAll])

  // Aplica o singura data parametrii din URL (?tab=results&view=noshow&student=<id>)
  // folositi de patratica de rezultat din tabelul de cursanti
  useEffect(() => {
    if (loading || paramsApplied.current) return
    paramsApplied.current = true
    const p = new URLSearchParams(window.location.search)
    if (p.get('tab') === 'results') setTab('results')
    if (p.get('view') === 'noshow') setResultsView('noshow')
    const sid = p.get('student')
    if (sid) {
      setTab('results')
      const ans = answers.find(a => a.student_id === sid)
      if (ans) { setResultsView('answers'); setExpandedId(ans.id) }
      else { setResultsView('noshow') }
    }
  }, [loading, answers])

  // ---------- ENSURE EXAM ROW ----------
  async function ensureExamRow(): Promise<RadioExam | null> {
    if (exam) return exam
    const { data: created, error } = await supabase
      .from('radio_exams')
      .insert({
        session_id: sessionId,
        cod_generare: codGenerare || null,
        profesor_grila: profesorGrila || null,
        profesor_engleza: profesorEngleza || null,
        profesor_examinator: profesorGrila || null,
        numar_subiecte_grila: NUM_GRILA,
        numar_subiecte_engleza: NUM_TRANS,
      })
      .select()
      .single()
    if (error) { alert('Eroare: ' + error.message); return null }
    setExam(created as RadioExam)
    return created as RadioExam
  }

  // ---------- SAVE META ----------
  async function saveMeta() {
    setSaving(true)
    try {
      const examRow = await ensureExamRow()
      if (!examRow) return
      const { error } = await supabase
        .from('radio_exams')
        .update({
          cod_generare: codGenerare || null,
          profesor_grila: profesorGrila || null,
          profesor_engleza: profesorEngleza || null,
          profesor_examinator: profesorGrila || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', examRow.id)
      if (error) throw error
      if (!radioExamStatus) {
        await supabase.from('sessions').update({ radio_exam_status: 'draft' }).eq('id', sessionId)
        setRadioExamStatus('draft')
      }
      await loadAll()
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setSaving(false)
    }
  }

  // ---------- GENERATE QUESTIONS FROM POOL ----------
  async function generateQuestionsFromPool() {
    if (questions.length > 0) {
      if (!confirm('Înlocuiești cele ' + questions.length + ' întrebări existente cu altă selecție din pool?')) return
    }
    setGenerating('q')
    try {
      const examRow = await ensureExamRow()
      if (!examRow) return

      // Fetch pool active
      const { data: poolQs } = await supabase
        .from('radio_question_pool')
        .select('id, code, question_text, active')
        .eq('active', true)
      const poolList = (poolQs || []) as PoolQuestionRow[]

      const { data: poolOpts } = await supabase
        .from('radio_question_pool_options')
        .select('*')
      const allOpts = (poolOpts || []) as PoolOptionRow[]

      // Filtrăm doar întrebările cu un răspuns corect marcat
      const valid = poolList.filter(q => {
        const opts = allOpts.filter(o => o.question_id === q.id)
        return opts.length === 4 && opts.some(o => o.is_correct)
      })

      if (valid.length < NUM_GRILA) {
        alert('Pool insuficient: ' + valid.length + '/' + NUM_GRILA +
          ' întrebări active cu răspuns corect marcat. Mergi la „Gestionare pool" și completează.')
        return
      }

      // Random 20
      const selected = shuffle(valid).slice(0, NUM_GRILA)

      // Generăm snapshot
      const rows = selected.map((q, idx) => {
        const opts = allOpts.filter(o => o.question_id === q.id)
        const shuffled = shuffle(opts)
        const letters: Array<'A' | 'B' | 'C' | 'D'> = ['A', 'B', 'C', 'D']
        let correctLetter: 'A' | 'B' | 'C' | 'D' = 'A'
        const textByLetter: Record<string, string> = { A: '', B: '', C: '', D: '' }
        shuffled.forEach((o, i) => {
          const letter = letters[i]
          textByLetter[letter] = o.option_text
          if (o.is_correct) correctLetter = letter
        })
        return {
          exam_id: examRow.id,
          order_no: idx + 1,
          pool_question_code: q.code,
          question_text: q.question_text,
          option_a: textByLetter.A,
          option_b: textByLetter.B,
          option_c: textByLetter.C,
          option_d: textByLetter.D,
          correct_option: correctLetter,
        }
      })

      // Delete + insert
      await supabase.from('radio_exam_questions').delete().eq('exam_id', examRow.id)
      const { error: insErr } = await supabase.from('radio_exam_questions').insert(rows)
      if (insErr) throw insErr

      // Auto-generare cod unic pentru această sesiune de generare
      const newCode = generateRandomCode(13)
      await supabase
        .from('radio_exams')
        .update({ cod_generare: newCode, updated_at: new Date().toISOString() })
        .eq('id', examRow.id)
      setCodGenerare(newCode)

      await loadAll()
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setGenerating(null)
    }
  }

  // ---------- GENERATE TRANSLATIONS FROM POOL ----------
  async function generateTranslationsFromPool() {
    if (translations.length > 0) {
      if (!confirm('Înlocuiești cele ' + translations.length + ' traduceri existente cu altă selecție din pool?')) return
    }
    setGenerating('t')
    try {
      const examRow = await ensureExamRow()
      if (!examRow) return

      const { data: pool } = await supabase
        .from('radio_translation_pool')
        .select('*')
        .eq('active', true)
      const poolList = (pool || []) as PoolTranslationRow[]

      if (poolList.length < NUM_TRANS) {
        alert('Pool insuficient: ' + poolList.length + '/' + NUM_TRANS +
          ' traduceri active. Mergi la „Gestionare pool" și completează.')
        return
      }

      // Când pool-ul are EXACT NUM_TRANS traduceri, le păstrăm în ordinea codului (T1, T2, ...)
      // ca să nu randomizăm fără rost. Doar când există mai multe disponibile facem shuffle.
      let selected: PoolTranslationRow[]
      if (poolList.length === NUM_TRANS) {
        selected = [...poolList].sort((a, b) => {
          const na = parseInt(a.code.replace(/[^0-9]/g, ''), 10) || 0
          const nb = parseInt(b.code.replace(/[^0-9]/g, ''), 10) || 0
          return na - nb
        })
      } else {
        selected = shuffle(poolList).slice(0, NUM_TRANS)
      }
      const rows = selected.map((t, idx) => ({
        exam_id: examRow.id,
        order_no: idx + 1,
        english_text: t.english_text,
        romanian_key: '',
      }))

      await supabase.from('radio_exam_translations').delete().eq('exam_id', examRow.id)
      const { error: insErr } = await supabase.from('radio_exam_translations').insert(rows)
      if (insErr) throw insErr

      await loadAll()
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setGenerating(null)
    }
  }

  // ---------- STATUS ----------
  async function changeStatus(newStatus: 'draft' | 'active' | 'hidden' | 'closed') {
    if (newStatus === radioExamStatus) return
    if (newStatus === 'active' || newStatus === 'hidden') {
      if (!exam || questions.length !== NUM_GRILA || translations.length !== NUM_TRANS) {
        alert('Generează mai întâi cele ' + NUM_GRILA + ' întrebări și ' + NUM_TRANS + ' traduceri din pool.')
        return
      }
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
    if (score < 0 || score > 5) { alert('Nota traduceri trebuie să fie între 0 și 5.'); return }
    const sim = simulatorDraft[answer.id]
    if (sim !== null && sim !== undefined && (sim < 1 || sim > 10)) {
      alert('Nota simulator trebuie să fie între 1 și 10 (sau gol).'); return
    }
    setSavingGrade(answer.id)
    const { error } = await supabase
      .from('radio_exam_answers')
      .update({
        translation_score: score,
        simulator_score: sim ?? null,
        graded_at: new Date().toISOString(),
        status: 'graded',
        updated_at: new Date().toISOString(),
      })
      .eq('id', answer.id)
    setSavingGrade(null)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  // ---------- RANDOMIZARE NOTE ----------
  function openRandomTrad() {
    const eligible = answers.filter(a =>
      a.status !== 'in_progress' &&
      (!a.translation_score || a.translation_score === 0)
    )
    setRandomTradCounts({ five: eligible.length, four: 0 })
    setShowRandomTrad(true)
  }

  function openRandomSim() {
    const eligible = answers.filter(a =>
      a.status !== 'in_progress' &&
      (a.simulator_score === null || a.simulator_score === undefined)
    )
    setRandomSimCounts({ ten: eligible.length, nine: 0, eight: 0 })
    setShowRandomSim(true)
  }

  async function doRandomTrad() {
    const eligible = answers.filter(a =>
      a.status !== 'in_progress' &&
      (!a.translation_score || a.translation_score === 0)
    )
    const total = randomTradCounts.five + randomTradCounts.four
    if (total !== eligible.length) {
      alert('Total alocat (' + total + ') trebuie să fie egal cu numărul de cursanți eligibili (' + eligible.length + ').')
      return
    }
    setRandomizing(true)
    try {
      // Array note
      const grades: number[] = []
      for (let i = 0; i < randomTradCounts.five; i++) grades.push(5)
      for (let i = 0; i < randomTradCounts.four; i++) grades.push(4)
      // Shuffle
      const shuffled = shuffle(grades)
      // Aplică
      for (let i = 0; i < eligible.length; i++) {
        const a = eligible[i]
        const score = shuffled[i]
        await supabase
          .from('radio_exam_answers')
          .update({
            translation_score: score,
            graded_at: new Date().toISOString(),
            status: 'graded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', a.id)
      }
      await loadAll()
      setShowRandomTrad(false)
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setRandomizing(false)
    }
  }

  async function doRandomSim() {
    const eligible = answers.filter(a =>
      a.status !== 'in_progress' &&
      (a.simulator_score === null || a.simulator_score === undefined)
    )
    const total = randomSimCounts.ten + randomSimCounts.nine + randomSimCounts.eight
    if (total !== eligible.length) {
      alert('Total alocat (' + total + ') trebuie să fie egal cu numărul de cursanți eligibili (' + eligible.length + ').')
      return
    }
    setRandomizing(true)
    try {
      const grades: number[] = []
      for (let i = 0; i < randomSimCounts.ten; i++) grades.push(10)
      for (let i = 0; i < randomSimCounts.nine; i++) grades.push(9)
      for (let i = 0; i < randomSimCounts.eight; i++) grades.push(8)
      const shuffled = shuffle(grades)
      for (let i = 0; i < eligible.length; i++) {
        const a = eligible[i]
        const score = shuffled[i]
        await supabase
          .from('radio_exam_answers')
          .update({
            simulator_score: score,
            graded_at: new Date().toISOString(),
            status: 'graded',
            updated_at: new Date().toISOString(),
          })
          .eq('id', a.id)
      }
      await loadAll()
      setShowRandomSim(false)
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setRandomizing(false)
    }
  }

  // ---------- REZOLVARE MANUALĂ CURSANT ----------
  function openResolveNew() {
    setResolveStudentId('')
    setResolveGrilaScore(NUM_GRILA)
    setResolveTradScore('')
    setResolveSimScore('')
    setResolveExistingAnswerId(null)
    setShowResolve(true)
  }

  async function saveEditQ() {
    if (!editQ) return
    setSavingEditQ(true)
    try {
      const key = String(editQ.question.order_no)
      const newGrila = { ...(editQ.answer.grila_answers || {}), [key]: editQ.selected }
      let score = 0
      for (const qq of questions) { if (newGrila[String(qq.order_no)] === qq.correct_option) score++ }
      const { error } = await supabase.from('radio_exam_answers')
        .update({ grila_answers: newGrila, grila_score: score, updated_at: new Date().toISOString() })
        .eq('id', editQ.answer.id)
      if (error) throw error
      setEditQ(null)
      await loadAll()
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setSavingEditQ(false)
    }
  }

  function openResolveForStudent(studentId: string) {
    setResolveStudentId(studentId)
    setResolveGrilaScore(NUM_GRILA)
    setResolveTradScore('')
    setResolveSimScore('')
    setResolveExistingAnswerId(null)
    setShowResolve(true)
  }

  function openResolveFromExisting(answer: Answer) {
    setResolveStudentId(answer.student_id)
    setResolveGrilaScore(NUM_GRILA)
    setResolveTradScore('')
    setResolveSimScore('')
    setResolveExistingAnswerId(answer.id)
    setShowResolve(true)
  }

  async function doResolve() {
    if (!exam) { alert('Examenul nu există.'); return }
    if (!resolveStudentId) { alert('Alege un cursant.'); return }
    if (resolveGrilaScore < 0 || resolveGrilaScore > NUM_GRILA) {
      alert('Punctaj grilă invalid (0-' + NUM_GRILA + ').'); return
    }
    const tradN = resolveTradScore === '' ? null : parseInt(resolveTradScore, 10)
    if (tradN !== null && (isNaN(tradN) || tradN < 0 || tradN > 5)) {
      alert('Notă traduceri trebuie 0-5 sau gol.'); return
    }
    const simN = resolveSimScore === '' ? null : parseInt(resolveSimScore, 10)
    if (simN !== null && (isNaN(simN) || simN < 1 || simN > 10)) {
      alert('Notă simulator trebuie 1-10 sau gol.'); return
    }
    if (questions.length !== NUM_GRILA) {
      alert('Examenul nu are cele ' + NUM_GRILA + ' întrebări generate.'); return
    }

    setResolveBusy(true)
    try {
      // Construiește grila_answers: aleg random N întrebări care primesc răspunsul corect,
      // restul primesc un răspuns greșit ales aleator dintre celelalte 3 litere
      const indices = shuffle(questions.map((_, i) => i))
      const correctIdx = new Set(indices.slice(0, resolveGrilaScore))
      const grilaAns: Record<string, string> = {}
      questions.forEach((q, i) => {
        if (correctIdx.has(i)) {
          grilaAns[String(q.order_no)] = q.correct_option
        } else {
          const wrong = (['A', 'B', 'C', 'D'] as const).filter(l => l !== q.correct_option)
          grilaAns[String(q.order_no)] = wrong[Math.floor(Math.random() * wrong.length)]
        }
      })

      // Rand existent: din „Șterge și rezolvă" SAU daca studentul ales din dropdown are deja rezultat.
      // Resetam ce a scris cursantul (grila/traduceri), dar PASTRAM feedback-ul (review) daca e completat.
      let existingId: string | null = resolveExistingAnswerId
      if (!existingId) {
        const { data: existing } = await supabase
          .from('radio_exam_answers').select('id')
          .eq('exam_id', exam.id).eq('student_id', resolveStudentId).maybeSingle()
        existingId = existing?.id || null
      }
      let keepFeedback = ''
      if (existingId) {
        const { data: old } = await supabase.from('radio_exam_answers').select('feedback').eq('id', existingId).maybeSingle()
        keepFeedback = (old?.feedback || '').trim() ? (old!.feedback as string) : ''
        const { error: delErr } = await supabase.from('radio_exam_answers').delete().eq('id', existingId)
        if (delErr) throw delErr
      }

      // Status: 'graded' dacă AMBELE note sunt completate; altfel 'submitted' (ca să fie eligibil la random)
      const bothManual = tradN !== null && simN !== null
      const status = bothManual ? 'graded' : 'submitted'

      const { error: insErr } = await supabase
        .from('radio_exam_answers')
        .insert({
          exam_id: exam.id,
          student_id: resolveStudentId,
          grila_answers: grilaAns,
          translation_answers: {},
          feedback: keepFeedback,
          obtinere_prelungire: '',
          grila_score: resolveGrilaScore,
          translation_score: tradN ?? 0,
          simulator_score: simN,
          status,
          submitted_at: new Date().toISOString(),
          graded_at: bothManual ? new Date().toISOString() : null,
        })
      if (insErr) throw insErr

      await loadAll()
      setShowResolve(false)
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setResolveBusy(false)
    }
  }

  // ---------- IMPORT EXAM FROM TEXT ----------
  async function importExam() {
    setImportBusy(true)
    setImportError('')
    try {
      if (!importText.trim()) { setImportError('Lipsește textul.'); return }

      const examRow = await ensureExamRow()
      if (!examRow) { setImportError('Nu am putut crea/găsi examenul.'); return }

      const { codGenerare: parsedCode, questions: parsedQs } = parseExamText(importText)
      if (parsedQs.length < NUM_GRILA) {
        throw new Error('Am identificat doar ' + parsedQs.length + '/' + NUM_GRILA + ' întrebări în text. Verifică formatul.')
      }

      // Fetch pool întrebări + opțiuni
      const { data: poolQs } = await supabase
        .from('radio_question_pool')
        .select('id, code, question_text, active')
        .eq('active', true)
      const poolList = (poolQs || []) as PoolQuestionRow[]
      const { data: poolOpts } = await supabase
        .from('radio_question_pool_options')
        .select('*')
      const allOpts = (poolOpts || []) as PoolOptionRow[]

      const rows: any[] = []
      const unmatched: number[] = []
      const unmatchedOpts: number[] = []

      for (const pq of parsedQs.slice(0, NUM_GRILA)) {
        const normParsedQ = normalizeForMatch(pq.question_text)

        // Match întrebare în pool — exact, apoi prefix lung
        let poolQ = poolList.find(p => normalizeForMatch(p.question_text) === normParsedQ)
        if (!poolQ) {
          poolQ = poolList.find(p => {
            const pn = normalizeForMatch(p.question_text)
            return pn.startsWith(normParsedQ.slice(0, 40)) || normParsedQ.startsWith(pn.slice(0, 40))
          })
        }
        if (!poolQ) { unmatched.push(pq.number); continue }

        // Match opțiuni
        const poolOptsForQ = allOpts.filter(o => o.question_id === poolQ!.id)
        const optionMap: Record<'A' | 'B' | 'C' | 'D', PoolOptionRow | undefined> = {
          A: undefined, B: undefined, C: undefined, D: undefined,
        }
        for (const letter of ['A', 'B', 'C', 'D'] as const) {
          const normP = normalizeForMatch(pq.options[letter])
          let f = poolOptsForQ.find(o => normalizeForMatch(o.option_text) === normP)
          if (!f) {
            f = poolOptsForQ.find(o => {
              const on = normalizeForMatch(o.option_text)
              return on.startsWith(normP.slice(0, 25)) || normP.startsWith(on.slice(0, 25))
            })
          }
          if (f) optionMap[letter] = f
        }
        const mappedIds = new Set([optionMap.A?.id, optionMap.B?.id, optionMap.C?.id, optionMap.D?.id].filter(Boolean))
        if (mappedIds.size !== 4) { unmatchedOpts.push(pq.number); continue }

        const correctLetter = (['A', 'B', 'C', 'D'] as const).find(l => optionMap[l]?.is_correct) || 'A'

        rows.push({
          exam_id: examRow.id,
          order_no: pq.number,
          pool_question_code: poolQ.code,
          question_text: poolQ.question_text,
          option_a: optionMap.A!.option_text,
          option_b: optionMap.B!.option_text,
          option_c: optionMap.C!.option_text,
          option_d: optionMap.D!.option_text,
          correct_option: correctLetter,
        })
      }

      if (unmatched.length || unmatchedOpts.length) {
        const parts: string[] = []
        if (unmatched.length) parts.push('Întrebări nepotrivite în pool: ' + unmatched.join(', '))
        if (unmatchedOpts.length) parts.push('Întrebări cu opțiuni nepotrivite: ' + unmatchedOpts.join(', '))
        throw new Error(parts.join('. ') + '. Verifică textele sau adaugă-le în pool.')
      }
      if (rows.length !== NUM_GRILA) {
        throw new Error('Am procesat doar ' + rows.length + '/' + NUM_GRILA + ' întrebări. Anulez.')
      }

      // Delete + insert atomic-like
      await supabase.from('radio_exam_questions').delete().eq('exam_id', examRow.id)
      const { error: insErr } = await supabase.from('radio_exam_questions').insert(rows)
      if (insErr) throw insErr

      // Cod generare: îl iau din text dacă există, altfel generez random
      const codeToSave = parsedCode || generateRandomCode(13)
      await supabase
        .from('radio_exams')
        .update({ cod_generare: codeToSave, updated_at: new Date().toISOString() })
        .eq('id', examRow.id)
      setCodGenerare(codeToSave)

      await loadAll()
      setShowImport(false)
      setImportText('')
      setImportError('')
    } catch (e: any) {
      setImportError(e.message || String(e))
    } finally {
      setImportBusy(false)
    }
  }

  // ---------- DELETE / RESET ANSWER ----------
  async function deleteAnswerRow(answer: Answer) {
    const st = students.find(x => x.id === answer.student_id)
    const nume = st?.full_name || 'cursant'
    if (!confirm(
      'Sigur ștergi toate răspunsurile lui ' + nume + '?\n\n' +
      'După ștergere, va putea relua examenul de la zero din portal.'
    )) return
    const { error } = await supabase
      .from('radio_exam_answers')
      .delete()
      .eq('id', answer.id)
    if (error) { alert('Eroare: ' + error.message); return }
    setExpandedId(null)
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
  const hasQuestions = questions.length === NUM_GRILA
  const hasTranslations = translations.length === NUM_TRANS

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
          <div className="flex items-center gap-2 shrink-0">
            <a href={`/admin/sesiuni/${sessionId}/examen/status`} target="_blank" rel="noopener noreferrer"
              className="px-3 py-1.5 rounded-md text-xs font-medium border border-emerald-200 text-emerald-700 hover:bg-emerald-50 flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"/> Live results <ExternalLink size={11}/>
            </a>
            <span className="px-3 py-1.5 rounded-md text-xs font-semibold"
              style={{ background: stMeta.bg, color: stMeta.color }}>
              {stMeta.label}
            </span>
          </div>
        </div>

        {/* Acces pool global */}
        <Link href="/admin/pool-radio" target="_blank"
          className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors">
          <div className="flex items-center gap-2 text-purple-700">
            <Sparkles size={16} />
            <span className="text-sm font-medium">Gestionare pool global întrebări și traduceri</span>
          </div>
          <ExternalLink size={14} className="text-purple-500" />
        </Link>

        {/* Status buttons */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <div className="text-xs font-semibold text-gray-700 mb-2">Stare examen</div>
          <div className="flex flex-wrap gap-2">
            {(['draft', 'active', 'hidden', 'closed'] as const).map(s => {
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
                  {s === 'hidden' && <EyeOff size={12} className="inline mr-1" />}
                  {s === 'closed' && <Lock size={12} className="inline mr-1" />}
                  {meta.label}
                </button>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            • <strong>Ciornă</strong> — editezi liber, cursanții nu văd nimic.
            <br />• <strong>Activ</strong> — cursanții pot accesa examenul din portal (necesită 20 întrebări + 5 traduceri generate).
            <br />• <strong>Ascuns</strong> — linkul dispare din portal, dar examenul rămâne funcțional (cine îl are deschis poate continua/trimite). Util ca să oprești accesul nou fără să închizi.
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
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900 mb-3">Date examen</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Cod generare</label>
                  <input type="text" value={codGenerare} onChange={e => setCodGenerare(e.target.value)}
                    placeholder="ex. LRC-2026-05"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                </div>
                <div></div>

                {/* Profesor examinator grilă */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Profesor examinator (grilă)</label>
                  <select
                    value={useCustomGrila ? '__custom__' : profesorGrila}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setUseCustomGrila(true)
                        setProfesorGrila('')
                      } else {
                        setUseCustomGrila(false)
                        setProfesorGrila(e.target.value)
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white">
                    <option value="">— alege —</option>
                    {availableProfesori.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="__custom__">✏️ Alt nume...</option>
                  </select>
                  {useCustomGrila && (
                    <input type="text" value={profesorGrila}
                      onChange={e => setProfesorGrila(e.target.value)}
                      placeholder="Tastează numele"
                      className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  )}
                </div>

                {/* Profesor examinator engleză */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Profesor examinator (engleză)</label>
                  <select
                    value={useCustomEngleza ? '__custom__' : profesorEngleza}
                    onChange={e => {
                      if (e.target.value === '__custom__') {
                        setUseCustomEngleza(true)
                        setProfesorEngleza('')
                      } else {
                        setUseCustomEngleza(false)
                        setProfesorEngleza(e.target.value)
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400 bg-white">
                    <option value="">— alege —</option>
                    {availableProfesori.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                    <option value="__custom__">✏️ Alt nume...</option>
                  </select>
                  {useCustomEngleza && (
                    <input type="text" value={profesorEngleza}
                      onChange={e => setProfesorEngleza(e.target.value)}
                      placeholder="Tastează numele"
                      className="mt-2 w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                  )}
                </div>
              </div>
              {availableProfesori.length === 0 && (
                <p className="mt-2 text-xs text-amber-600">
                  ⚠ Sesiunea nu are persoane de contact sau instructor setați. Folosește „✏️ Alt nume..." pentru a introduce manual.
                </p>
              )}
              <div className="mt-3 flex justify-end">
                <button onClick={saveMeta} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvează datele
                </button>
              </div>
            </div>

            {/* Întrebări grilă */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-gray-900">
                  Întrebări grilă <span className="text-gray-400 font-normal">({hasQuestions ? NUM_GRILA + '/' + NUM_GRILA : questions.length + '/' + NUM_GRILA})</span>
                </h3>
                <div className="flex flex-wrap gap-2">
                  <button onClick={generateQuestionsFromPool} disabled={generating === 'q'}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#7c3aed' }}>
                    {generating === 'q' ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                    {hasQuestions ? 'Regenerează din pool' : 'Generează 20 din pool'}
                  </button>
                  <button onClick={() => { setShowImport(true); setImportError('') }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-purple-300 text-purple-700 hover:bg-purple-50">
                    <Upload size={12} />
                    Importă din text
                  </button>
                </div>
              </div>
              {!hasQuestions && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                  <Sparkles size={20} className="mx-auto mb-2 text-gray-300" />
                  Examenul nu are încă întrebări. Apasă „Generează 20 din pool" mai sus.
                </div>
              )}
              {hasQuestions && (() => {
                const parts = questions.map(q => `${String(q.order_no).padStart(2, ' ')}.${q.correct_option}`)
                const solutionString = parts.slice(0, 10).join('  ') + '\n' + parts.slice(10).join('  ')
                return (
                  <div className="mb-4 flex items-start gap-2 p-3 bg-purple-50 border border-purple-100 rounded-lg">
                    <span className="text-xs text-purple-700 font-semibold shrink-0 mt-0.5">Soluție:</span>
                    <code className="flex-1 text-xs font-mono text-gray-800 select-all whitespace-pre-wrap break-words">
                      {solutionString}
                    </code>
                    <button
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(solutionString)
                          setSolutionCopied(true)
                          setTimeout(() => setSolutionCopied(false), 1500)
                        } catch {
                          alert('Nu am putut copia în clipboard. Selectează manual.')
                        }
                      }}
                      title="Copiază soluția"
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white"
                      style={{ background: '#7c3aed' }}>
                      {solutionCopied ? <Check size={12} /> : <Copy size={12} />}
                      {solutionCopied ? 'Copiat' : 'Copiază'}
                    </button>
                    <button
                      onClick={async () => {
                        if (!exam) { alert('Examenul nu este salvat încă.'); return }
                        setGeneratingPdf(true)
                        try {
                          const res = await fetch('/api/generate-rezultate-pdf', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ exam_id: exam.id }),
                          })
                          if (!res.ok) {
                            const err = await res.text()
                            throw new Error(err)
                          }
                          const html = await res.text()
                          const w = window.open('', '_blank')
                          if (w) {
                            w.document.write(html)
                            w.document.close()
                            setTimeout(() => w.print(), 800)
                          } else {
                            alert('Blocker pop-up. Activează pop-up-urile pentru a genera PDF-ul.')
                          }
                        } catch (e: any) {
                          alert('Eroare: ' + (e.message || String(e)))
                        } finally {
                          setGeneratingPdf(false)
                        }
                      }}
                      title="Generează PDF cu rezultate în stil oficial"
                      disabled={generatingPdf}
                      className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-white disabled:opacity-50"
                      style={{ background: '#ea580c' }}>
                      {generatingPdf ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
                      Generează PDF
                    </button>
                  </div>
                )
              })()}
              {hasQuestions && (
                <div className="space-y-3">
                  {questions.map((q, i) => (
                    <div key={q.id || i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold text-purple-700">Întrebarea {q.order_no}</span>
                        <span className="text-xs text-gray-400">
                          Corect: <strong className="text-green-700">{q.correct_option}</strong>
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 mb-3 whitespace-pre-wrap">{q.question_text}</div>
                      <div className="space-y-1">
                        {(['A', 'B', 'C', 'D'] as const).map(letter => {
                          const fieldKey = `option_${letter.toLowerCase()}` as keyof Question
                          const optionVal = q[fieldKey] as string
                          const isCorrect = q.correct_option === letter
                          return (
                            <div key={letter}
                              className={`flex items-center gap-2 p-2 rounded ${
                                isCorrect ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-100'
                              }`}>
                              {isCorrect
                                ? <CircleDot size={16} className="text-green-600 shrink-0" />
                                : <Circle size={16} className="text-gray-300 shrink-0" />}
                              <span className={`text-xs ${isCorrect ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                                <strong className="mr-1">{letter}.</strong>{optionVal}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Traduceri */}
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm text-gray-900">
                  Traduceri EN → RO <span className="text-gray-400 font-normal">({hasTranslations ? NUM_TRANS + '/' + NUM_TRANS : translations.length + '/' + NUM_TRANS})</span>
                </h3>
                <button onClick={generateTranslationsFromPool} disabled={generating === 't'}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: '#7c3aed' }}>
                  {generating === 't' ? <Loader2 size={12} className="animate-spin" /> : <Shuffle size={12} />}
                  {hasTranslations ? 'Regenerează din pool' : 'Generează 5 din pool'}
                </button>
              </div>
              {!hasTranslations && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-lg">
                  <Sparkles size={20} className="mx-auto mb-2 text-gray-300" />
                  Examenul nu are încă traduceri. Apasă „Generează 5 din pool" mai sus.
                </div>
              )}
              {hasTranslations && (
                <div className="space-y-3">
                  {translations.map((t, i) => (
                    <div key={t.id || i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
                      <div className="text-xs font-bold text-purple-700 mb-2">Traducerea {t.order_no}</div>
                      <div className="text-sm text-gray-900 whitespace-pre-wrap">{t.english_text}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB RESULTS */}
        {tab === 'results' && (
          <>
          {exam && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-3 mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-purple-700 font-semibold mr-2">Acțiuni rezultate:</span>
              <button onClick={openRandomTrad}
                disabled={answers.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                🎲 Random trad
              </button>
              <button onClick={openRandomSim}
                disabled={answers.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                🎲 Random sim
              </button>
              <button onClick={openResolveNew}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: '#ea580c' }}>
                ➕ Rezolvă cursant
              </button>
              <span className="text-xs text-gray-500 ml-auto">
                Random afectează doar cursanții fără notă. „Rezolvă cursant" adaugă manual un cursant care nu a răspuns.
              </span>
            </div>
          )}
          {/* Sub-tab-uri: Raspunsuri vs cursanti care nu au intrat */}
          {exam && (() => {
            const noShow = students.filter(s => !answers.find(a => a.student_id === s.id))
            return (
              <div className="flex gap-2 mb-3 border-b border-gray-200">
                <button onClick={() => setResultsView('answers')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${resultsView === 'answers' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  Răspunsuri ({answers.length})
                </button>
                <button onClick={() => setResultsView('noshow')}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${resultsView === 'noshow' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  Nu au intrat ({noShow.length})
                </button>
              </div>
            )
          })()}
          {/* Cursanti care nu au intrat la examen */}
          {exam && resultsView === 'noshow' && (() => {
            const noShow = students.filter(s => !answers.find(a => a.student_id === s.id))
            return (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-500">
                  Cursanți fără rezultat (nu au deschis examenul). Alege-i și rezolvă-le examenul manual.
                </div>
                {noShow.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-sm">Toți cursanții au intrat la examen.</div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {noShow.map(s => (
                      <div key={s.id} id={`noshow-${s.id}`} className="flex items-center justify-between gap-4 px-5 py-3">
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-900 truncate">{s.full_name}</div>
                          <div className="text-xs text-gray-400">{s.class_caa}</div>
                        </div>
                        <button onClick={() => openResolveForStudent(s.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white shrink-0"
                          style={{ background: '#ea580c' }}>
                          ➕ Rezolvă examen
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })()}
          <div className={`bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden ${resultsView !== 'answers' ? 'hidden' : ''}`}>
            {!exam && (
              <div className="p-8 text-center text-gray-400 text-sm">
                Examenul nu a fost încă creat. Completează tab-ul „Configurare".
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
                            <strong style={{ color: a.grila_score >= 18 ? '#16a34a' : a.grila_score >= 15 ? '#2563eb' : a.grila_score === 14 ? '#ea580c' : '#dc2626' }}>{a.grila_score}</strong>/{NUM_GRILA} grilă
                          </div>
                          <div className="text-xs text-gray-600">
                            <strong>{a.translation_score}</strong>/5 trad.
                          </div>
                          <div className="text-xs text-gray-600">
                            <strong>{a.simulator_score ?? '—'}</strong>/10 sim.
                          </div>
                          {isOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                        </div>
                      </button>

                      {isOpen && (
                        <div className="px-5 pb-5 bg-gray-50 space-y-4">
                          {/* Obținere / Prelungire */}
                          <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-700 mb-1">Tip examen ales de cursant</div>
                            <div className="text-sm text-gray-900">
                              {a.obtinere_prelungire === 'obtinere'
                                ? 'OBȚINERE CARNET'
                                : a.obtinere_prelungire === 'prelungire'
                                  ? 'PRELUNGIRE VALABILITATE'
                                  : <em className="text-gray-400">(necompletat)</em>}
                            </div>
                          </div>

                          {/* Notare manuală traduceri + simulator */}
                          <div className="bg-white rounded-lg p-4 border border-purple-100">
                            <div className="text-xs font-semibold text-purple-700 mb-3">
                              Notare manuală
                            </div>
                            <div className="flex flex-wrap items-end gap-4 mb-3">
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Traduceri (0-5)</label>
                                <input type="number" min={0} max={5} step={1}
                                  value={draftScore}
                                  onChange={e => setGradeDraft(prev => ({
                                    ...prev,
                                    [a.id]: Math.max(0, Math.min(5, parseInt(e.target.value) || 0))
                                  }))}
                                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-purple-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-500 mb-1">Simulator (1-10)</label>
                                <input type="number" min={1} max={10} step={1}
                                  value={simulatorDraft[a.id] ?? ''}
                                  onChange={e => {
                                    const raw = e.target.value
                                    if (raw === '') {
                                      setSimulatorDraft(prev => ({ ...prev, [a.id]: null }))
                                    } else {
                                      const n = parseInt(raw, 10)
                                      if (!isNaN(n)) {
                                        setSimulatorDraft(prev => ({
                                          ...prev,
                                          [a.id]: Math.max(1, Math.min(10, n))
                                        }))
                                      }
                                    }
                                  }}
                                  placeholder="—"
                                  className="w-20 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:border-purple-400"
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <button onClick={() => saveGrade(a)}
                                disabled={savingGrade === a.id || a.status === 'in_progress'}
                                className="px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                                style={{ background: '#7c3aed' }}>
                                {savingGrade === a.id ? <Loader2 size={14} className="animate-spin inline" /> : <Check size={14} className="inline mr-1" />}
                                Salvează notele
                              </button>
                              {a.graded_at && (
                                <span className="text-xs text-gray-400">
                                  Ultima salvare: {new Date(a.graded_at).toLocaleString('ro-RO')}
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
                                  <button key={q.order_no} type="button"
                                    onClick={() => setEditQ({ answer: a, question: q, selected: studentAnswer === '—' ? '' : studentAnswer })}
                                    title="Click pentru a modifica răspunsul"
                                    className="text-xs flex items-center gap-2 py-1 px-1 rounded hover:bg-purple-50 text-left w-full">
                                    <span className="w-6 text-gray-400">{q.order_no}.</span>
                                    <span className={`font-mono font-bold ${correct ? 'text-green-600' : 'text-red-600'}`}>
                                      {studentAnswer}
                                    </span>
                                    <span className="text-gray-300">/</span>
                                    <span className="font-mono text-gray-500">{q.correct_option}</span>
                                    <span className="ml-auto text-gray-300">✎</span>
                                  </button>
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
                                    <div className="bg-purple-50 border border-purple-100 rounded p-2 text-gray-800 whitespace-pre-wrap">
                                      <strong>Cursant:</strong> {studentText || <em className="text-gray-400">(necompletat)</em>}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          {/* Feedback Google Reviews */}
                          <div className="bg-white rounded-lg p-4 border border-gray-100">
                            <div className="text-xs font-semibold text-gray-700 mb-2">Feedback curs</div>
                            <div className="text-xs text-gray-800 whitespace-pre-wrap bg-gray-50 rounded p-3">
                              {a.feedback?.trim()
                                ? a.feedback
                                : <em className="text-gray-400">(cursantul nu a lăsat feedback)</em>}
                            </div>
                          </div>

                          {/* Resetare / rezolvare cursant */}
                          <div className="bg-white rounded-lg p-4 border border-red-100">
                            <div className="text-xs font-semibold text-red-700 mb-1">Acțiuni cursant</div>
                            <p className="text-xs text-gray-500 mb-3">
                              Șterge răspunsurile pentru ca cursantul să reia examenul de la zero,
                              sau înlocuiește răspunsurile cu un set generat pentru un punctaj dorit.
                            </p>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => deleteAnswerRow(a)}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90"
                                style={{ background: '#dc2626' }}>
                                <Trash2 size={12} />
                                Șterge răspunsurile
                              </button>
                              {a.status === 'in_progress' && (
                                <button onClick={() => openResolveFromExisting(a)}
                                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90"
                                  style={{ background: '#7c3aed' }}>
                                  ✨ Șterge și rezolvă
                                </button>
                              )}
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
          </>
        )}

      </div>

      {/* Modal Import */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !importBusy && setShowImport(false)}>
          <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-900">Importă examen din text</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Lipește textul examenului (cu 20 întrebări A/B/C/D). Codul de generare este detectat automat.
                </p>
              </div>
              <button onClick={() => !importBusy && setShowImport(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 flex-1 overflow-y-auto">
              <textarea value={importText}
                onChange={e => setImportText(e.target.value)}
                placeholder="Lipește aici textul examenului..."
                rows={18}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs font-mono focus:outline-none focus:border-purple-400" />
              {importError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex gap-2">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  <span>{importError}</span>
                </div>
              )}
              <div className="mt-3 text-xs text-gray-400">
                <strong>Ce face importul:</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5">
                  <li>Identifică „Cod generare = …" din text și-l salvează</li>
                  <li>Extrage cele 20 întrebări numerotate 1–20 cu opțiunile A/B/C/D</li>
                  <li>Face match cu pool-ul global (pe baza textului) pentru a păstra răspunsul corect</li>
                  <li>Salvează ordinea exactă din text (NU re-shuffle)</li>
                </ul>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100">
              <button onClick={() => setShowImport(false)} disabled={importBusy}
                className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                Anulează
              </button>
              <button onClick={importExam} disabled={importBusy || !importText.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                style={{ background: '#7c3aed' }}>
                {importBusy ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                Importă și salvează
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Random TRAD */}
      {showRandomTrad && (() => {
        const eligible = answers.filter(a =>
          a.status !== 'in_progress' &&
          (!a.translation_score || a.translation_score === 0)
        )
        const total = randomTradCounts.five + randomTradCounts.four
        const isValid = total === eligible.length && randomTradCounts.five >= 0 && randomTradCounts.four >= 0
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="font-semibold text-gray-900 mb-1">🎲 Random note traduceri</h3>
              <p className="text-xs text-gray-400 mb-4">
                Cursanți eligibili (fără notă): <strong>{eligible.length}</strong> ·
                Alocați: <strong className={total === eligible.length ? 'text-green-600' : 'text-red-500'}>{total}</strong>
              </p>
              {eligible.length === 0 ? (
                <p className="text-sm text-gray-500 mb-5">
                  Toți cursanții au deja notă la traduceri. Modifică manual din lista de mai jos dacă vrei să le schimbi.
                </p>
              ) : (
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">Câți primesc nota <strong>5</strong>?</div>
                    <input type="number" min="0" max={eligible.length}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomTradCounts.five}
                      onChange={e => setRandomTradCounts(prev => ({ ...prev, five: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">Câți primesc nota <strong>4</strong>?</div>
                    <input type="number" min="0" max={eligible.length}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomTradCounts.four}
                      onChange={e => setRandomTradCounts(prev => ({ ...prev, four: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                </div>
              )}
              {eligible.length > 0 && !isValid && (
                <p className="text-xs text-red-500 mb-3 text-center">
                  {total > eligible.length
                    ? 'Ai alocat ' + (total - eligible.length) + ' cursanți în plus'
                    : 'Mai ai ' + (eligible.length - total) + ' cursanți nealocați'}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRandomTrad(false)} disabled={randomizing}
                  className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                  {eligible.length === 0 ? 'Închide' : 'Anulează'}
                </button>
                {eligible.length > 0 && (
                  <button onClick={doRandomTrad} disabled={!isValid || randomizing}
                    className="px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#7c3aed' }}>
                    {randomizing ? 'Se randomizează...' : '🎲 Aplică'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal editare raspuns grila */}
      {editQ && (() => {
        const q = editQ.question
        const opts: Array<['A'|'B'|'C'|'D', string]> = [['A', q.option_a], ['B', q.option_b], ['C', q.option_c], ['D', q.option_d]]
        const studentName = students.find(s => s.id === editQ.answer.student_id)?.full_name || ''
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => !savingEditQ && setEditQ(null)}>
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-gray-900">Întrebarea {q.order_no}</h3>
                <button onClick={() => setEditQ(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={16}/></button>
              </div>
              <p className="text-xs text-gray-400 mb-3">{studentName} · alege răspunsul corect pentru a corecta punctual</p>
              <p className="text-sm font-medium text-gray-900 mb-3 whitespace-pre-wrap">{q.question_text}</p>
              <div className="space-y-2 mb-5">
                {opts.map(([letter, text]) => {
                  const isCorrect = q.correct_option === letter
                  const isSelected = editQ.selected === letter
                  return (
                    <button key={letter} type="button"
                      onClick={() => setEditQ(prev => prev ? { ...prev, selected: letter } : prev)}
                      className={`w-full flex items-start gap-2 text-left px-3 py-2 rounded-lg border transition-colors ${isSelected ? 'border-purple-500 ring-1 ring-purple-300' : 'border-gray-200 hover:bg-gray-50'}`}
                      style={isCorrect ? { background: '#dcfce7' } : {}}>
                      <span className={`font-mono font-bold ${isCorrect ? 'text-green-700' : 'text-gray-500'}`}>{letter}.</span>
                      <span className="text-sm text-gray-800 flex-1">{text}</span>
                      {isCorrect && <span className="text-[10px] font-semibold text-green-700 mt-0.5">corect</span>}
                      {isSelected && <span className="text-[10px] font-semibold text-purple-600 mt-0.5">ales</span>}
                    </button>
                  )
                })}
              </div>
              <div className="flex justify-end gap-2">
                <button onClick={() => setEditQ(null)} disabled={savingEditQ}
                  className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">Anulează</button>
                <button onClick={saveEditQ} disabled={savingEditQ || !editQ.selected}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#7c3aed' }}>
                  {savingEditQ ? <Loader2 size={12} className="animate-spin"/> : <Check size={12}/>} Salvează
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Rezolvă cursant */}
      {showResolve && (() => {
        const answeredIds = new Set(answers.map(a => a.student_id))
        const isReResolve = !!resolveExistingAnswerId
        const fixedStudent = isReResolve
          ? students.find(s => s.id === resolveStudentId)
          : null
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="font-semibold text-gray-900 mb-1">
                {isReResolve ? '✨ Șterge și rezolvă cursant' : '➕ Rezolvă cursant'}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {isReResolve
                  ? 'Răspunsurile existente vor fi șterse și înlocuite cu un set generat.'
                  : 'Adaugă un rezultat pentru un cursant care nu a completat formularul.'}
              </p>

              <div className="space-y-3 mb-5">
                {/* Cursant */}
                {isReResolve ? (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cursant</label>
                    <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-800">
                      {fixedStudent?.full_name || '—'}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Cursant *</label>
                    <select value={resolveStudentId}
                      onChange={e => setResolveStudentId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-purple-400">
                      <option value="">— alege —</option>
                      {students.map(s => (
                        <option key={s.id} value={s.id}>{s.full_name} · {s.class_caa}{answeredIds.has(s.id) ? ' · ✓ are rezultat (se rescrie)' : ''}</option>
                      ))}
                    </select>
                    {resolveStudentId && answeredIds.has(resolveStudentId) && (
                      <p className="text-xs text-amber-600 mt-1">
                        Acest cursant are deja rezultat — răspunsurile vor fi rescrise, dar feedback-ul rămâne.
                      </p>
                    )}
                  </div>
                )}

                {/* Punctaj grilă */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Punctaj grilă (0–{NUM_GRILA}) *
                  </label>
                  <input type="number" min={0} max={NUM_GRILA} step={1}
                    value={resolveGrilaScore}
                    onChange={e => setResolveGrilaScore(Math.max(0, Math.min(NUM_GRILA, parseInt(e.target.value) || 0)))}
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                  <p className="text-xs text-gray-400 mt-1">
                    Răspunsurile la grilă vor fi generate automat: {resolveGrilaScore} corecte, restul greșite random.
                  </p>
                </div>

                {/* Notă traduceri */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Notă traduceri (0–5) <span className="text-gray-400 font-normal">— gol = se va decide la randomizare</span>
                  </label>
                  <input type="number" min={0} max={5} step={1}
                    value={resolveTradScore}
                    onChange={e => setResolveTradScore(e.target.value)}
                    placeholder="—"
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>

                {/* Notă simulator */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Notă simulator (1–10) <span className="text-gray-400 font-normal">— gol = se va decide la randomizare</span>
                  </label>
                  <input type="number" min={1} max={10} step={1}
                    value={resolveSimScore}
                    onChange={e => setResolveSimScore(e.target.value)}
                    placeholder="—"
                    className="w-24 px-3 py-2 border border-gray-200 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400" />
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={() => setShowResolve(false)} disabled={resolveBusy}
                  className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                  Anulează
                </button>
                <button onClick={doResolve}
                  disabled={resolveBusy || !resolveStudentId}
                  className="px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                  style={{ background: '#7c3aed' }}>
                  {resolveBusy ? 'Se rezolvă...' : (isReResolve ? '✨ Șterge și rezolvă' : '➕ Rezolvă')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modal Random SIM */}
      {showRandomSim && (() => {
        const eligible = answers.filter(a =>
          a.status !== 'in_progress' &&
          (a.simulator_score === null || a.simulator_score === undefined)
        )
        const total = randomSimCounts.ten + randomSimCounts.nine + randomSimCounts.eight
        const isValid = total === eligible.length &&
          randomSimCounts.ten >= 0 && randomSimCounts.nine >= 0 && randomSimCounts.eight >= 0
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="font-semibold text-gray-900 mb-1">🎲 Random note simulator</h3>
              <p className="text-xs text-gray-400 mb-4">
                Cursanți eligibili (fără notă): <strong>{eligible.length}</strong> ·
                Alocați: <strong className={total === eligible.length ? 'text-green-600' : 'text-red-500'}>{total}</strong>
              </p>
              {eligible.length === 0 ? (
                <p className="text-sm text-gray-500 mb-5">
                  Toți cursanții au deja notă la simulator. Modifică manual din lista de mai jos dacă vrei să le schimbi.
                </p>
              ) : (
                <div className="space-y-3 mb-5">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">Câți primesc nota <strong>10</strong>?</div>
                    <input type="number" min="0" max={eligible.length}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomSimCounts.ten}
                      onChange={e => setRandomSimCounts(prev => ({ ...prev, ten: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">Câți primesc nota <strong>9</strong>?</div>
                    <input type="number" min="0" max={eligible.length}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomSimCounts.nine}
                      onChange={e => setRandomSimCounts(prev => ({ ...prev, nine: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 text-sm text-gray-700">Câți primesc nota <strong>8</strong>?</div>
                    <input type="number" min="0" max={eligible.length}
                      className="w-20 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-400"
                      value={randomSimCounts.eight}
                      onChange={e => setRandomSimCounts(prev => ({ ...prev, eight: Math.max(0, parseInt(e.target.value) || 0) }))} />
                  </div>
                </div>
              )}
              {eligible.length > 0 && !isValid && (
                <p className="text-xs text-red-500 mb-3 text-center">
                  {total > eligible.length
                    ? 'Ai alocat ' + (total - eligible.length) + ' cursanți în plus'
                    : 'Mai ai ' + (eligible.length - total) + ' cursanți nealocați'}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRandomSim(false)} disabled={randomizing}
                  className="px-4 py-2 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-50">
                  {eligible.length === 0 ? 'Închide' : 'Anulează'}
                </button>
                {eligible.length > 0 && (
                  <button onClick={doRandomSim} disabled={!isValid || randomizing}
                    className="px-5 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                    style={{ background: '#7c3aed' }}>
                    {randomizing ? 'Se randomizează...' : '🎲 Aplică'}
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
