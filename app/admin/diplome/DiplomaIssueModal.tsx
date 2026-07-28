'use client'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { X, Search, Loader2, Award, Printer, Pencil, Check } from 'lucide-react'
import {
  DIPLOMA_CATEGORIES, DiplomaCategory, Diploma, TemplateFields,
  DEFAULT_TEMPLATE_FIELDS, DEFAULT_TEXT_COLOR,
  SHOW_PRACTICE_DEFAULT, groupNameForSession, formatDiplomaDate, getNextDiplomaNumber,
} from '@/lib/diplomas'
import DiplomaSheet, { SheetData } from './DiplomaSheet'
import DateInputRO from './DateInputRO'

// Emiterea unei diplome pentru un cursant anume (din registrul de diplome sau
// din fișa cursantului). Dacă diploma există deja pe seria aleasă, se arată
// previzualizarea ei în locul formularului.

export type DiplomaStudent = {
  id: string
  full_name: string
  cnp?: string | null
  address?: string | null
  city?: string | null
  county?: string | null
  class_caa?: string | null
  session_id?: string | null
}

const SERIES_COLORS: Record<string, string> = {
  A: 'bg-sky-100 text-sky-700 border-sky-200',
  B: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  C: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  D: 'bg-amber-100 text-amber-700 border-amber-200',
  S: 'bg-purple-100 text-purple-700 border-purple-200',
}

const PREVIEW_SCALE = 0.62
const inCls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200'

// ── Selectorul de cursant (cu căutare) ─────────────────────────────────────
type PickRow = DiplomaStudent & { sessions?: { session_date: string | null; class_caa: string | null } | null }

export function StudentPickerModal({ onPick, onClose }: { onPick: (s: DiplomaStudent) => void; onClose: () => void }) {
  const [rows, setRows] = useState<PickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')

  useEffect(() => {
    supabase.from('students')
      .select('id, full_name, cnp, address, city, county, class_caa, session_id, sessions(session_date, class_caa)')
      .order('full_name')
      .then(({ data }) => { setRows((data || []) as unknown as PickRow[]); setLoading(false) })
  }, [])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return rows
    return rows.filter(r =>
      (r.full_name || '').toLowerCase().includes(s) ||
      (r.cnp || '').includes(s) ||
      (r.city || '').toLowerCase().includes(s))
  }, [rows, q])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,.6)' }} onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[82vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Selectează cursant</h3>
            <p className="text-xs text-gray-400">Caută după nume, CNP sau oraș.</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>
        <div className="p-3 border-b border-gray-100">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="Caută cursant…"
              className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-200" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" /> Se încarcă…</div>
          ) : list.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-400">Niciun cursant găsit.</div>
          ) : list.map(r => (
            <button key={r.id} onClick={() => onPick(r)}
              className="w-full text-left px-3 py-2 rounded-lg hover:bg-amber-50 border border-transparent hover:border-amber-200">
              <div className="text-sm text-gray-900">{r.full_name}</div>
              <div className="text-[11px] text-gray-400">
                {[r.cnp, r.sessions?.session_date ? new Date(r.sessions.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
                  r.class_caa || r.sessions?.class_caa].filter(Boolean).join(' · ')}
              </div>
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-gray-100 text-[11px] text-gray-400">{list.length} din {rows.length} cursanți</div>
      </div>
    </div>
  )
}

// ── Modalul de emitere / previzualizare ────────────────────────────────────
export default function DiplomaIssueModal({ student, category = null, onClose, onSaved }: {
  student: DiplomaStudent
  category?: DiplomaCategory | null
  onClose: () => void
  onSaved?: () => void
}) {
  const [cat, setCat] = useState<DiplomaCategory | null>(category)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [existing, setExisting] = useState<Diploma[]>([])
  const [printerId, setPrinterId] = useState<string | null>(null)
  const [fields, setFields] = useState<TemplateFields>(DEFAULT_TEMPLATE_FIELDS)
  const [color, setColor] = useState(DEFAULT_TEXT_COLOR)
  const [asDuplicate, setAsDuplicate] = useState(false)

  const [number, setNumber] = useState('')
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [practiceDate, setPracticeDate] = useState('')
  const [practiceLocation, setPracticeLocation] = useState('')
  const [groupName, setGroupName] = useState('')

  const loadExisting = useCallback(async () => {
    // aceeași persoană poate avea diplome legate prin student_id sau prin CNP
    const byStudent = supabase.from('diplomas').select('*').eq('student_id', student.id).eq('status', 1)
    const byCnp = student.cnp
      ? supabase.from('diplomas').select('*').eq('cnp', student.cnp).eq('status', 1)
      : Promise.resolve({ data: [] as Diploma[] })
    const [{ data: a }, { data: b }] = await Promise.all([byStudent, byCnp as any])
    const seen = new Set<string>()
    const merged: Diploma[] = []
    for (const d of [...(a || []), ...(b || [])] as Diploma[]) {
      if (seen.has(d.id)) continue
      seen.add(d.id); merged.push(d)
    }
    setExisting(merged)
  }, [student.id, student.cnp])

  // date inițiale: sesiune, diplome existente, număr următor, imprimantă
  useEffect(() => {
    let alive = true
    ;(async () => {
      const [sessRes, nextNr, printerRes] = await Promise.all([
        student.session_id
          ? supabase.from('sessions').select('session_date, course_start_date, class_caa, locations(name)').eq('id', student.session_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getNextDiplomaNumber(supabase),
        supabase.from('diploma_printers').select('id').eq('active', true).limit(1).maybeSingle(),
      ])
      await loadExisting()
      if (!alive) return
      const s: any = sessRes?.data
      if (s) {
        setGroupName(groupNameForSession(s))
        setPracticeDate(s.session_date || '')
        setPracticeLocation(s.locations?.name || '')
        setIssueDate(s.session_date || new Date().toISOString().slice(0, 10))
      }
      setNumber(String(nextNr))
      setPrinterId((printerRes as any)?.data?.id || null)
      setLoading(false)
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student.id])

  // șablonul de poziții pentru previzualizare (calibrarea imprimantei, dacă există)
  useEffect(() => {
    if (!cat) return
    let alive = true
    const q = supabase.from('diploma_templates').select('fields, text_color').eq('category', cat)
    ;(printerId ? q.eq('printer_id', printerId) : q).limit(1).maybeSingle().then(({ data }: any) => {
      if (!alive) return
      setFields({ ...DEFAULT_TEMPLATE_FIELDS, ...(data?.fields || {}) })
      setColor(data?.text_color || DEFAULT_TEXT_COLOR)
    })
    return () => { alive = false }
  }, [cat, printerId])

  const issued = useMemo(() => new Set(existing.map(d => d.series)), [existing])
  const current = useMemo(() => (cat ? existing.find(d => d.series === cat) || null : null), [existing, cat])
  const showPractice = cat ? SHOW_PRACTICE_DEFAULT[cat] : false
  const cityLine = [student.city, student.county].filter(Boolean).join(', ') || null

  const sheet: SheetData | null = useMemo(() => {
    if (!cat) return null
    if (current && !asDuplicate) {
      return { ...current, number: current.number }
    }
    return {
      number: number || '—',
      issue_date: issueDate,
      expiration: null,
      full_name: student.full_name,
      cnp: student.cnp || null,
      address: student.address || null,
      city: cityLine,
      group_name: groupName || null,
      practice_location: practiceLocation || null,
      practice_date: practiceDate || null,
      show_practice: showPractice,
    }
  }, [cat, current, asDuplicate, number, issueDate, student, cityLine, groupName, practiceLocation, practiceDate, showPractice])

  async function save() {
    if (!cat) return
    const nr = Number(number)
    if (!nr || nr < 1) { alert('Completează numărul diplomei.'); return }
    if (!issueDate) { alert('Completează data eliberării.'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('diplomas').insert({
        series: cat,
        number: nr,
        issue_date: issueDate,
        expiration: null,
        full_name: student.full_name,
        cnp: student.cnp || null,
        address: student.address || null,
        city: cityLine,
        group_name: groupName.trim() || null,
        practice_location: practiceLocation.trim() || null,
        practice_date: practiceDate || null,
        show_practice: showPractice,
        session_id: student.session_id || null,
        student_id: student.id,
        in_print_queue: true,
        duplicate: asDuplicate,
      })
      if (error) throw error
      setAsDuplicate(false)
      await loadExisting()
      onSaved?.()
    } catch (e: any) {
      alert('Eroare la emitere: ' + (e.message || e))
    }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,.6)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Award size={16} className="text-amber-600" /> Diplomă — {student.full_name}
            </h3>
            <p className="text-xs text-gray-400">
              {cat ? (current && !asDuplicate ? 'Diplomă deja emisă — previzualizare.' : 'Completează datele și emite diploma.') : 'Alege tipul de diplomă.'}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipul diplomei */}
          <div>
            <div className="text-xs text-gray-500 mb-1.5">Tipul diplomei</div>
            <div className="flex flex-wrap gap-2">
              {DIPLOMA_CATEGORIES.map(c => (
                <button key={c} onClick={() => { setCat(c); setAsDuplicate(false) }}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${cat === c ? SERIES_COLORS[c] + ' ring-2 ring-offset-1 ring-amber-300' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {c}
                  {issued.has(c) && <Check size={12} className="inline ml-1 text-emerald-600" />}
                </button>
              ))}
            </div>
            {issued.size > 0 && <p className="text-[11px] text-gray-400 mt-1.5">Bifat = diplomă deja emisă pentru acest cursant.</p>}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400"><Loader2 size={15} className="animate-spin" /> Se încarcă…</div>
          ) : !cat ? (
            <div className="text-center py-10 text-sm text-gray-400">Selectează o serie (S / D / C / B / A) pentru a continua.</div>
          ) : (
            <>
              {current && !asDuplicate ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3 flex flex-wrap items-center gap-3">
                  <div className="text-sm text-emerald-900">
                    <b>Diploma {current.series} nr. {current.number}</b> · eliberată {formatDiplomaDate(current.issue_date)}
                    {current.group_name ? ` · seria ${current.group_name}` : ''}
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Link href={`/admin/diplome/${current.id}`}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-white hover:bg-gray-50"><Pencil size={12} /> Editează</Link>
                    <Link href={`/admin/diplome/print?ids=${current.id}${printerId ? `&printer=${printerId}` : ''}`} target="_blank"
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 bg-white hover:bg-gray-50"><Printer size={12} /> Tipărește</Link>
                    <button onClick={() => setAsDuplicate(true)}
                      className="px-2.5 py-1.5 rounded-lg text-xs border border-amber-200 text-amber-700 bg-white hover:bg-amber-50">Emite duplicat</button>
                  </div>
                </div>
              ) : (
                <>
                  {asDuplicate && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center gap-2">
                      Se emite un <b>duplicat</b> peste diploma existentă.
                      <button onClick={() => setAsDuplicate(false)} className="ml-auto underline">renunță</button>
                    </div>
                  )}
                  <div className="grid sm:grid-cols-2 gap-3">
                    <label className="block"><span className="block text-xs text-gray-500 mb-1">Număr diplomă</span>
                      <input className={inCls} value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} inputMode="numeric" /></label>
                    <label className="block"><span className="block text-xs text-gray-500 mb-1">Data eliberării</span>
                      <DateInputRO value={issueDate} onChange={setIssueDate} className={inCls} /></label>
                    {showPractice && (
                      <>
                        <label className="block"><span className="block text-xs text-gray-500 mb-1">Data probei practice</span>
                          <DateInputRO value={practiceDate} onChange={setPracticeDate} className={inCls} /></label>
                        <label className="block"><span className="block text-xs text-gray-500 mb-1">Locul probei practice</span>
                          <input className={inCls} value={practiceLocation} onChange={e => setPracticeLocation(e.target.value)} placeholder="ex. Limanu" /></label>
                      </>
                    )}
                    <label className="block sm:col-span-2"><span className="block text-xs text-gray-500 mb-1">Serie curs</span>
                      <input className={inCls} value={groupName} onChange={e => setGroupName(e.target.value)} placeholder="ex. 8-11 iunie 2026" /></label>
                  </div>
                  {!showPractice && <p className="text-[11px] text-gray-400">Seria {cat} nu tipărește rândul „Probă practică".</p>}
                </>
              )}

              {/* Previzualizare */}
              {sheet && (
                <div>
                  <div className="text-xs text-gray-500 mb-1.5">Previzualizare</div>
                  <div className="overflow-hidden rounded-lg border border-gray-200 bg-gray-50 mx-auto"
                    style={{ width: 1123 * PREVIEW_SCALE, height: 794 * PREVIEW_SCALE }}>
                    <div style={{ transform: `scale(${PREVIEW_SCALE})`, transformOrigin: 'top left' }}>
                      <DiplomaSheet data={sheet} fields={fields} color={color} category={cat} />
                    </div>
                  </div>
                </div>
              )}

              {(!current || asDuplicate) && (
                <div className="flex justify-end gap-2">
                  <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Anulează</button>
                  <button onClick={save} disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Award size={14} />} {saving ? 'Se emite…' : 'Emite diploma'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
