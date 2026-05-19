'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Circle, CircleDot, Check, X,
  Loader2, Pencil, FileText, Languages, Eye, EyeOff, Save
} from 'lucide-react'

type PoolOption = {
  id?: string
  question_id?: string
  code: 'X' | 'Y' | 'Z' | 'W'
  option_text: string
  is_correct: boolean
}
type PoolQuestion = {
  id: string
  code: string
  question_text: string
  class_caa: string
  active: boolean
  options: PoolOption[]
}
type PoolTranslation = {
  id: string
  code: string
  english_text: string
  class_caa: string
  active: boolean
}

const OPTION_CODES: Array<'X' | 'Y' | 'Z' | 'W'> = ['X', 'Y', 'Z', 'W']

function nextCode(prefix: string, existing: string[]): string {
  const nums = existing
    .map(c => parseInt(c.replace(prefix, ''), 10))
    .filter(n => !isNaN(n))
  const max = nums.length ? Math.max(...nums) : 0
  return `${prefix}${max + 1}`
}

export default function PoolRadioPage() {
  const [tab, setTab] = useState<'questions' | 'translations'>('questions')
  const [loading, setLoading] = useState(true)

  const [questions, setQuestions] = useState<PoolQuestion[]>([])
  const [translations, setTranslations] = useState<PoolTranslation[]>([])

  const [expandedQId, setExpandedQId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<PoolQuestion | null>(null)
  const [savingQ, setSavingQ] = useState(false)

  const [editTId, setEditTId] = useState<string | null>(null)
  const [editTDraft, setEditTDraft] = useState<{ code: string; english_text: string } | null>(null)
  const [savingT, setSavingT] = useState(false)

  const [showInactive, setShowInactive] = useState(true)

  // ---------- LOAD ----------
  const loadAll = useCallback(async () => {
    setLoading(true)

    const { data: qs } = await supabase
      .from('radio_question_pool')
      .select('*')
      .order('code', { ascending: true })
    const qList = (qs || []) as any[]

    const { data: opts } = await supabase
      .from('radio_question_pool_options')
      .select('*')
    const optList = (opts || []) as any[]

    const merged: PoolQuestion[] = qList.map(q => ({
      id: q.id,
      code: q.code,
      question_text: q.question_text,
      class_caa: q.class_caa,
      active: q.active,
      options: OPTION_CODES.map(c => {
        const found = optList.find(o => o.question_id === q.id && o.code === c)
        return found
          ? { id: found.id, question_id: q.id, code: c, option_text: found.option_text, is_correct: found.is_correct }
          : { question_id: q.id, code: c, option_text: '', is_correct: false }
      }),
    }))
    // sortăm numeric după partea după "Q"
    merged.sort((a, b) => {
      const na = parseInt(a.code.replace(/[^0-9]/g, ''), 10) || 0
      const nb = parseInt(b.code.replace(/[^0-9]/g, ''), 10) || 0
      return na - nb
    })
    setQuestions(merged)

    const { data: tr } = await supabase
      .from('radio_translation_pool')
      .select('*')
      .order('code', { ascending: true })
    const tList = ((tr || []) as PoolTranslation[]).sort((a, b) => {
      const na = parseInt(a.code.replace(/[^0-9]/g, ''), 10) || 0
      const nb = parseInt(b.code.replace(/[^0-9]/g, ''), 10) || 0
      return na - nb
    })
    setTranslations(tList)

    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ---------- QUESTIONS ----------
  async function addQuestion() {
    const code = nextCode('Q', questions.map(q => q.code))
    const { data: q, error } = await supabase
      .from('radio_question_pool')
      .insert({ code, question_text: '', active: true })
      .select()
      .single()
    if (error || !q) { alert('Eroare: ' + (error?.message || 'unknown')); return }
    const rows = OPTION_CODES.map(c => ({
      question_id: q.id, code: c, option_text: '', is_correct: false,
    }))
    await supabase.from('radio_question_pool_options').insert(rows)
    await loadAll()
    setExpandedQId(q.id)
    setEditDraft({
      id: q.id,
      code: q.code,
      question_text: '',
      class_caa: q.class_caa,
      active: true,
      options: OPTION_CODES.map(c => ({
        question_id: q.id, code: c, option_text: '', is_correct: false,
      })),
    })
  }

  function startEdit(q: PoolQuestion) {
    setExpandedQId(q.id)
    setEditDraft(JSON.parse(JSON.stringify(q)))
  }

  function cancelEdit() {
    setExpandedQId(null)
    setEditDraft(null)
  }

  function setCorrectOption(code: 'X' | 'Y' | 'Z' | 'W') {
    if (!editDraft) return
    setEditDraft({
      ...editDraft,
      options: editDraft.options.map(o => ({ ...o, is_correct: o.code === code })),
    })
  }

  async function saveQuestion() {
    if (!editDraft) return
    setSavingQ(true)
    try {
      // Validare cod unic
      const dup = questions.find(q => q.code === editDraft.code && q.id !== editDraft.id)
      if (dup) throw new Error('Codul „' + editDraft.code + '" este deja folosit.')

      // Update întrebare
      const { error: e1 } = await supabase
        .from('radio_question_pool')
        .update({
          code: editDraft.code,
          question_text: editDraft.question_text,
          active: editDraft.active,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editDraft.id)
      if (e1) throw e1

      // Update opțiuni
      for (const o of editDraft.options) {
        if (o.id) {
          const { error } = await supabase
            .from('radio_question_pool_options')
            .update({
              option_text: o.option_text,
              is_correct: o.is_correct,
            })
            .eq('id', o.id)
          if (error) throw error
        } else {
          const { error } = await supabase
            .from('radio_question_pool_options')
            .insert({
              question_id: editDraft.id,
              code: o.code,
              option_text: o.option_text,
              is_correct: o.is_correct,
            })
          if (error) throw error
        }
      }

      await loadAll()
      setExpandedQId(null)
      setEditDraft(null)
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setSavingQ(false)
    }
  }

  async function deleteQuestion(q: PoolQuestion) {
    if (!confirm('Ștergi definitiv „' + q.code + '" cu toate opțiunile?')) return
    const { error } = await supabase
      .from('radio_question_pool')
      .delete()
      .eq('id', q.id)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  async function toggleQuestionActive(q: PoolQuestion) {
    const { error } = await supabase
      .from('radio_question_pool')
      .update({ active: !q.active, updated_at: new Date().toISOString() })
      .eq('id', q.id)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  // ---------- TRANSLATIONS ----------
  async function addTranslation() {
    const code = nextCode('T', translations.map(t => t.code))
    const { data: t, error } = await supabase
      .from('radio_translation_pool')
      .insert({ code, english_text: '', active: true })
      .select()
      .single()
    if (error || !t) { alert('Eroare: ' + (error?.message || 'unknown')); return }
    await loadAll()
    setEditTId(t.id)
    setEditTDraft({ code: t.code, english_text: '' })
  }

  function startEditT(t: PoolTranslation) {
    setEditTId(t.id)
    setEditTDraft({ code: t.code, english_text: t.english_text })
  }

  function cancelEditT() {
    setEditTId(null)
    setEditTDraft(null)
  }

  async function saveTranslation() {
    if (!editTId || !editTDraft) return
    setSavingT(true)
    try {
      const dup = translations.find(t => t.code === editTDraft.code && t.id !== editTId)
      if (dup) throw new Error('Codul „' + editTDraft.code + '" este deja folosit.')

      const { error } = await supabase
        .from('radio_translation_pool')
        .update({
          code: editTDraft.code,
          english_text: editTDraft.english_text,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editTId)
      if (error) throw error

      await loadAll()
      setEditTId(null)
      setEditTDraft(null)
    } catch (e: any) {
      alert('Eroare: ' + (e.message || String(e)))
    } finally {
      setSavingT(false)
    }
  }

  async function deleteTranslation(t: PoolTranslation) {
    if (!confirm('Ștergi definitiv „' + t.code + '"?')) return
    const { error } = await supabase
      .from('radio_translation_pool')
      .delete()
      .eq('id', t.id)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  async function toggleTranslationActive(t: PoolTranslation) {
    const { error } = await supabase
      .from('radio_translation_pool')
      .update({ active: !t.active, updated_at: new Date().toISOString() })
      .eq('id', t.id)
    if (error) { alert('Eroare: ' + error.message); return }
    await loadAll()
  }

  // ---------- DERIVED ----------
  const visibleQuestions = showInactive ? questions : questions.filter(q => q.active)
  const visibleTranslations = showInactive ? translations : translations.filter(t => t.active)

  const activeQ = questions.filter(q => q.active).length
  const activeQWithCorrect = questions.filter(q => q.active && q.options.some(o => o.is_correct)).length
  const activeT = translations.filter(t => t.active).length

  // ---------- RENDER ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Pool examen Radio LRC</h1>
              <p className="text-xs text-gray-500">
                Bibliotecă globală de întrebări și traduceri pentru examenele Radio LRC
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">Întrebări active</div>
            <div className="text-xl font-bold text-gray-900">{activeQ}</div>
            <div className="text-xs text-gray-400">din {questions.length} totale</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">Active cu răspuns corect marcat</div>
            <div className="text-xl font-bold" style={{
              color: activeQWithCorrect >= 20 ? '#059669' : '#d97706'
            }}>
              {activeQWithCorrect}
            </div>
            <div className="text-xs text-gray-400">minim 20 pentru generare</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="text-xs text-gray-500">Traduceri active</div>
            <div className="text-xl font-bold" style={{
              color: activeT >= 5 ? '#059669' : '#d97706'
            }}>
              {activeT}
            </div>
            <div className="text-xs text-gray-400">din {translations.length} totale · minim 5</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-gray-200">
          <button onClick={() => setTab('questions')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'questions' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <FileText size={14} className="inline mr-1" />Întrebări
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{questions.length}</span>
          </button>
          <button onClick={() => setTab('translations')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === 'translations' ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Languages size={14} className="inline mr-1" />Traduceri
            <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-xs">{translations.length}</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setShowInactive(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            {showInactive ? <Eye size={12} /> : <EyeOff size={12} />}
            {showInactive ? 'Arată toate' : 'Doar active'}
          </button>
          {tab === 'questions' && (
            <button onClick={addQuestion}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: '#7c3aed' }}>
              <Plus size={12} />Adaugă întrebare
            </button>
          )}
          {tab === 'translations' && (
            <button onClick={addTranslation}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: '#7c3aed' }}>
              <Plus size={12} />Adaugă traducere
            </button>
          )}
        </div>

        {/* TAB QUESTIONS */}
        {tab === 'questions' && (
          <div className="space-y-3">
            {visibleQuestions.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm border border-gray-100">
                Nicio întrebare în pool.
              </div>
            )}
            {visibleQuestions.map(q => {
              const isOpen = expandedQId === q.id
              const draft = isOpen ? editDraft : null
              const hasCorrect = q.options.some(o => o.is_correct)
              return (
                <div key={q.id} className={`bg-white rounded-xl shadow-sm border ${
                  q.active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}>
                  {/* Header card */}
                  <div className="flex items-start gap-3 p-4">
                    <span className="text-xs font-bold text-purple-700 shrink-0 w-12 pt-1">{q.code}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-gray-900 whitespace-pre-wrap">
                        {q.question_text || <em className="text-gray-400">(întrebare goală)</em>}
                      </div>
                      {!hasCorrect && q.active && (
                        <div className="mt-1 text-xs text-amber-600">
                          ⚠ Niciun răspuns corect marcat
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => toggleQuestionActive(q)}
                        title={q.active ? 'Dezactivează' : 'Activează'}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                        {q.active ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button onClick={() => isOpen ? cancelEdit() : startEdit(q)}
                        className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                        title={isOpen ? 'Închide' : 'Editează'}>
                        {isOpen ? <X size={14} /> : <Pencil size={14} />}
                      </button>
                      <button onClick={() => deleteQuestion(q)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                        title="Șterge">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Edit body */}
                  {isOpen && draft && (
                    <div className="border-t border-gray-100 p-4 space-y-4 bg-gray-50">
                      <div className="grid sm:grid-cols-4 gap-3 items-end">
                        <div className="sm:col-span-1">
                          <label className="block text-xs font-medium text-gray-600 mb-1">Cod</label>
                          <input type="text" value={draft.code}
                            onChange={e => setEditDraft({ ...draft, code: e.target.value.toUpperCase() })}
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-purple-400" />
                        </div>
                        <div className="sm:col-span-3 flex items-center gap-2">
                          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                            <input type="checkbox" checked={draft.active}
                              onChange={e => setEditDraft({ ...draft, active: e.target.checked })}
                              className="rounded" />
                            Activă (poate fi selectată la generare)
                          </label>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Textul întrebării</label>
                        <textarea value={draft.question_text}
                          onChange={e => setEditDraft({ ...draft, question_text: e.target.value })}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-2">
                          Răspunsuri (marchează cu cerc răspunsul corect)
                        </label>
                        <div className="space-y-1.5">
                          {draft.options.map((o, idx) => (
                            <div key={o.code}
                              className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${
                                o.is_correct ? 'bg-purple-50 border-purple-200' : 'border-gray-100 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <button type="button"
                                onClick={() => setCorrectOption(o.code)}
                                className="shrink-0"
                                title="Marchează ca răspuns corect">
                                {o.is_correct
                                  ? <CircleDot size={20} className="text-purple-600" />
                                  : <Circle size={20} className="text-gray-300 hover:text-gray-500" />}
                              </button>
                              <span className={`text-xs w-7 shrink-0 ${o.is_correct ? 'font-bold text-purple-700' : 'text-gray-500'}`}>
                                {q.code}{o.code}
                              </span>
                              <textarea
                                value={o.option_text}
                                onChange={e => setEditDraft({
                                  ...draft,
                                  options: draft.options.map((x, i) => i === idx ? { ...x, option_text: e.target.value } : x),
                                })}
                                rows={1}
                                placeholder={`Textul opțiunii ${o.code}`}
                                className={`flex-1 px-2 py-1 bg-transparent text-sm focus:outline-none resize-none ${
                                  o.is_correct ? 'font-bold text-gray-900' : 'text-gray-700'
                                }`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <button onClick={cancelEdit}
                          className="px-4 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                          Anulează
                        </button>
                        <button onClick={saveQuestion} disabled={savingQ}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                          style={{ background: '#7c3aed' }}>
                          {savingQ ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                          Salvează
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* TAB TRANSLATIONS */}
        {tab === 'translations' && (
          <div className="space-y-3">
            {visibleTranslations.length === 0 && (
              <div className="bg-white rounded-xl p-8 text-center text-gray-400 text-sm border border-gray-100">
                Nicio traducere în pool. Apasă „Adaugă traducere" pentru a începe.
              </div>
            )}
            {visibleTranslations.map(t => {
              const isEditing = editTId === t.id
              return (
                <div key={t.id} className={`bg-white rounded-xl shadow-sm border p-4 ${
                  t.active ? 'border-gray-100' : 'border-gray-100 opacity-60'
                }`}>
                  <div className="flex items-start gap-3">
                    <span className="text-xs font-bold text-purple-700 shrink-0 w-10 pt-1">{t.code}</span>
                    <div className="flex-1 min-w-0">
                      {!isEditing && (
                        <div className="text-sm text-gray-900 whitespace-pre-wrap">
                          {t.english_text || <em className="text-gray-400">(traducere goală)</em>}
                        </div>
                      )}
                      {isEditing && editTDraft && (
                        <div className="space-y-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Cod</label>
                            <input type="text" value={editTDraft.code}
                              onChange={e => setEditTDraft({ ...editTDraft, code: e.target.value.toUpperCase() })}
                              className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-purple-400" />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-600 mb-1">Text englez</label>
                            <textarea value={editTDraft.english_text}
                              onChange={e => setEditTDraft({ ...editTDraft, english_text: e.target.value })}
                              rows={3}
                              placeholder="Original english text..."
                              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-purple-400" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={cancelEditT}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                              Anulează
                            </button>
                            <button onClick={saveTranslation} disabled={savingT}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                              style={{ background: '#7c3aed' }}>
                              {savingT ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                              Salvează
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => toggleTranslationActive(t)}
                          title={t.active ? 'Dezactivează' : 'Activează'}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700">
                          {t.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => startEditT(t)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700"
                          title="Editează">
                          <Pencil size={14} />
                        </button>
                        <button onClick={() => deleteTranslation(t)}
                          className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600"
                          title="Șterge">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    )}
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
