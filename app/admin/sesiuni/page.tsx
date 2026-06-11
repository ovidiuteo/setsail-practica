'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Copy, ExternalLink, Trash2, Pencil, Check, X } from 'lucide-react'
import { resolveColor } from '@/lib/timeline-colors'
import { scopeForSession, DEFAULT_TIMELINE_SCOPE, TIMELINE_SCOPES } from '@/lib/timeline-scope'

const statusMap: Record<string, { label: string; color: string }> = {
  draft:     { label: 'Ciornă',     color: '#6b7280' },
  focus:     { label: 'Focus',      color: '#7c3aed' },
  active: { label: 'Activă', color: '#d97706' },
  completed: { label: 'Finalizată', color: '#059669' },
}

// ---------- Timeline progress bar ----------
const DAY_MS = 24 * 60 * 60 * 1000
const MONTHS_RO_FULL = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie']
const DAYS_RO = ['duminică','luni','marți','miercuri','joi','vineri','sâmbătă']

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x }
function fmtDateRO(d: Date): string {
  return `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO_FULL[d.getMonth()]} ${d.getFullYear()}`
}

export type TimelineMilestone = {
  id: string; scope: string; code: string; label: string
  anchor: string; offset_days: number
  color: string
  color_day: string | null
  color_weekend: string | null
  order_index: number
}
export type TimelineConfig = { milestones: TimelineMilestone[] }

function getAnchorDate(session: any, anchor: string): Date | null {
  const raw = session?.[anchor]
  if (raw) return startOfDay(new Date(raw))
  // Fallback: dacă ancora e goală, folosim session_date
  if (session?.session_date) return startOfDay(new Date(session.session_date))
  return null
}

function SessionTimeline({ session, config }: { session: any; config: Record<string, TimelineConfig> }) {
  const scope = scopeForSession(session)
  const scopeCfg = config[scope] || config[DEFAULT_TIMELINE_SCOPE] || { milestones: [] }

  // Calculez datele tuturor milestone-urilor pentru această sesiune
  const milestoneDates = scopeCfg.milestones.map(m => {
    const anchor = getAnchorDate(session, m.anchor)
    return {
      ...m,
      date: anchor ? new Date(anchor.getTime() + m.offset_days * DAY_MS) : null,
    }
  }).filter(m => m.date !== null) as (TimelineMilestone & { date: Date })[]

  if (milestoneDates.length < 2) return null

  // Sortăm milestones după dată ca să găsim ușor „precedentul" pentru fiecare zi
  const sorted = [...milestoneDates].sort((a, b) => a.date.getTime() - b.date.getTime())
  const startTs = sorted[0].date.getTime()
  const endTs = sorted[sorted.length - 1].date.getTime()
  const today = startOfDay(new Date())

  const nDays = Math.max(1, Math.round((endTs - startTs) / DAY_MS) + 1)
  const days: Date[] = []
  for (let i = 0; i < nDays; i++) {
    days.push(new Date(startTs + i * DAY_MS))
  }

  return (
    <div className="relative w-full h-4 flex bg-gray-50 rounded-t-xl overflow-visible">
      {days.map((d, i) => {
        const dDay = d.getDay()
        const isWeekend = dDay === 0 || dDay === 6
        const isToday = d.getTime() === today.getTime()
        const t = d.getTime()

        // 1) Verific milestone EXACT pe ziua respectivă
        const exactMs = sorted.find(m => m.date.getTime() === t)
        // 2) Milestone precedent (cel mai recent ≤ d, dar nu egal cu exact dacă există)
        const previousMs = !exactMs
          ? [...sorted].reverse().find(m => m.date.getTime() <= t)
          : null

        let bg = '#e5e7eb'
        let label = ''
        if (exactMs) {
          // Dacă „event" e 'none' folosim verdele default global
          bg = exactMs.color === 'none' ? (isWeekend ? '#86efac' : '#bbf7d0') : exactMs.color
          label = exactMs.label
        } else if (previousMs) {
          bg = resolveColor(
            isWeekend ? previousMs.color_weekend : previousMs.color_day,
            previousMs.color,
            isWeekend ? 'weekend' : 'day',
          )
          label = previousMs.label
        }

        const ctx: string[] = []
        if (isToday) ctx.push('astăzi')
        if (label) ctx.push(label)
        if (isWeekend && !exactMs) ctx.push('weekend')
        const tooltipText = `${fmtDateRO(d)}${ctx.length ? ' · ' + ctx.join(' · ') : ''}`

        return (
          <div key={i} className="flex-1 relative group h-full"
            style={{
              background: bg,
              minWidth: 2,
              borderRight: i < days.length - 1 ? '1px solid #d1d5db' : undefined,
            }}>
            {isToday && (
              // Cursor today = un sfert de zi, centrat orizontal, semi-transparent roșu
              <div className="absolute inset-y-0 pointer-events-none"
                style={{ left: '37.5%', width: '25%', background: 'rgba(220, 38, 38, 0.55)',
                         borderLeft: '1.5px solid #b91c1c', borderRight: '1.5px solid #b91c1c' }}>
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 shadow" />
              </div>
            )}
            <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                             px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg">
              {tooltipText}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function SesiuniPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [studentCounts, setStudentCounts] = useState<Record<string,{total:number,absenti:number}>>({})
  const [filter, setFilter] = useState<'active'|'all'>('active') // active = exclude completed
  const [refs, setRefs] = useState({ locations: [], boats: [], evaluators: [], instructors: [] } as any)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [timelineCfg, setTimelineCfg] = useState<Record<string, TimelineConfig>>({})

  async function load() {
    const [{ data: s }, loc, boat, ev, instr, tlMs] = await Promise.all([
      supabase.from('sessions').select('*, locations(name, county), evaluators(full_name), instructors(full_name), boats(name)').order('session_date', { ascending: true }).order('created_at', { ascending: true }),
      supabase.from('locations').select('*').order('name'),
      supabase.from('boats').select('*').order('name'),
      supabase.from('evaluators').select('*').order('full_name'),
      supabase.from('instructors').select('*').order('full_name'),
      supabase.from('timeline_milestones').select('*').order('order_index'),
    ])
    const allSess = s || []
    setSessions(allSess)
    // Fetch student counts per session
    const { data: allStudents } = await supabase.from('students').select('session_id, portal_status')
    const counts: Record<string, {total:number, absenti:number}> = {}
    for (const st of (allStudents||[])) {
      if (!counts[st.session_id]) counts[st.session_id] = {total:0, absenti:0}
      counts[st.session_id].total++
      if (st.portal_status === 'absent') counts[st.session_id].absenti++
    }
    setStudentCounts(counts)
    setRefs({ locations: loc.data || [], boats: boat.data || [], evaluators: ev.data || [], instructors: instr.data || [] })
    // Group timeline config by scope
    const cfg: Record<string, TimelineConfig> = {}
    for (const m of (tlMs.data || []) as TimelineMilestone[]) {
      if (!cfg[m.scope]) cfg[m.scope] = { milestones: [] }
      cfg[m.scope].milestones.push(m)
    }
    setTimelineCfg(cfg)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSession(id: string) {
    if (!confirm('Ștergi sesiunea și toți cursanții asociați?')) return
    await supabase.from('sessions').delete().eq('id', id)
    setSessions(ss => ss.filter(s => s.id !== id))
  }

  function copyCode(code: string) {
    const url = `${window.location.origin}/portal?cod=${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  function startEdit(s: any) {
    setEditingId(s.id)
    setEditValues({
      course_start_date: s.course_start_date || '',
      practice_start_date: s.practice_start_date || '',
      session_date: s.session_date,
      location_id: s.location_id,
      boat_id: s.boat_id || '',
      boat_id_2: s.boat_id_2 || '',
      boat_id_3: s.boat_id_3 || '',
      evaluator_id: s.evaluator_id,
      instructor_id: s.instructor_id,
      instructor_id_2: s.instructor_id_2 || '',
      instructor_id_3: s.instructor_id_3 || '',
      class_caa: s.class_caa,
      status: s.status,
      timeline_scope: s.timeline_scope || '',
      notes: s.notes || '',
      request_number: s.request_number || '',
      nr_instiintare_anr: s.nr_instiintare_anr || '',
      nr_document_ancom: s.nr_document_ancom || '',
      location_detail: s.location_detail || '',
      skipper_url: s.skipper_url || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditValues({})
  }

  async function saveEdit(id: string) {
    setSaving(true)
    // Postgres respinge '' pentru coloane date/uuid — convertim la null.
    const nullableEmpty = [
      'course_start_date', 'session_date', 'practice_start_date',
      'location_id', 'boat_id', 'boat_id_2', 'boat_id_3',
      'evaluator_id', 'instructor_id', 'instructor_id_2', 'instructor_id_3', 'timeline_scope',
    ]
    const payload: any = { ...editValues }
    for (const col of nullableEmpty) if (payload[col] === '') payload[col] = null
    const { data } = await supabase.from('sessions')
      .update(payload)
      .eq('id', id)
      .select('*, locations(name, county), evaluators(full_name), instructors(full_name), boats(name)')
      .single()
    if (data) setSessions(ss => ss.map(s => s.id === id ? data : s))
    // Nr. instiintare ANR setat pe principala se propaga la clone
    const editedSess = sessions.find((s: any) => s.id === id)
    if (editedSess?.session_type === 'principal' && payload.nr_instiintare_anr) {
      await supabase.from('sessions')
        .update({ nr_instiintare_anr: payload.nr_instiintare_anr })
        .eq('parent_session_id', id).eq('session_type', 'clone')
      setSessions(ss => ss.map((s: any) =>
        (s.parent_session_id === id && s.session_type === 'clone')
          ? { ...s, nr_instiintare_anr: payload.nr_instiintare_anr } : s))
    }
    // Statusul principalei se propaga la clone (focus ramane doar pe principala)
    if (editedSess?.session_type === 'principal' && payload.status && payload.status !== editedSess.status) {
      const cloneStatus = payload.status === 'focus' ? 'active' : payload.status
      await supabase.from('sessions')
        .update({ status: cloneStatus })
        .eq('parent_session_id', id).eq('session_type', 'clone')
      setSessions(ss => ss.map((s: any) =>
        (s.parent_session_id === id && s.session_type === 'clone')
          ? { ...s, status: cloneStatus } : s))
    }
    setEditingId(null)
    setEditValues({})
    setSaving(false)
  }

  const selectCls = "border border-blue-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
  const inputCls = "border border-blue-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Sesiuni Practică
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {sessions.filter((s:any)=>s.session_type==='principal').length} sesiuni
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={()=>setFilter('active')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${filter==='active'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}>
              Active
            </button>
            <button onClick={()=>setFilter('all')}
              className={`px-3 py-2 text-xs font-medium transition-colors ${filter==='all'?'bg-gray-900 text-white':'text-gray-500 hover:bg-gray-50'}`}>
              Toate
            </button>
          </div>
          <Link href="/admin/sesiuni/nou"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
            style={{ background: '#0a1628' }}
          >
            <Plus size={16} /> Sesiune nouă
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Se încarcă...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-3">Nicio sesiune creată.</p>
          <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">Creează prima sesiune →</Link>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Tree view - grupam sesiunile principale cu clonele si absentii lor */}
          {sessions
            .filter((s: any) => s.session_type === 'principal')
            .filter((s: any) => filter === 'all' || s.status !== 'completed')
            .map((principal: any) => {
            const clones = sessions.filter((s: any) => s.session_type === 'clone' && s.parent_session_id === principal.id)
            const absentSess = sessions.find((s: any) => s.session_type === 'absent' && s.parent_session_id === principal.id)
            const principalCount = studentCounts[principal.id] || {total:0, absenti:0}
            const cloneCounts = clones.map((c: any) => studentCounts[c.id] || {total:0, absenti:0})
            const absentCount = absentSess ? (studentCounts[absentSess.id] || {total:0, absenti:0}) : null
            const totalAll = principalCount.total + cloneCounts.reduce((sum: number, c: any) => sum + c.total, 0)

            const s = principal
            const st = statusMap[s.status] || statusMap.draft
            const isEditing = editingId === s.id

            return (
              <div key={s.id} className="space-y-0">
                {/* SESIUNEA PRINCIPALA */}
                <div className={`bg-white rounded-xl shadow-sm border transition-colors overflow-visible ${isEditing ? 'border-blue-200' : 'border-gray-100'}`}>
                {/* Timeline progress bar */}
                <SessionTimeline session={s} config={timelineCfg} />
                {isEditing ? (
                  /* Edit mode */
                  <div className="p-5">
                    <div className="grid grid-cols-3 gap-3 mb-3">
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Data start curs</div>
                        <input type="date" className={inputCls + ' w-full'}
                          value={editValues.course_start_date || ''}
                          onChange={e => setEditValues((v: any) => ({ ...v, course_start_date: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Data start practică</div>
                        <input type="date" className={inputCls + ' w-full'}
                          value={editValues.practice_start_date || ''}
                          onChange={e => setEditValues((v: any) => ({ ...v, practice_start_date: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Data examen</div>
                        <input type="date" className={inputCls + ' w-full'}
                          value={editValues.session_date}
                          onChange={e => setEditValues((v: any) => ({ ...v, session_date: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Clasa CAA</div>
                          <select className={selectCls + ' w-full'} value={editValues.class_caa}
                          onChange={e => setEditValues((v: any) => ({ ...v, class_caa: e.target.value }))}>
                          <option value="A">A</option>
                          <option value="B">B</option>
                          <option value="C">C</option>
                          <option value="D">D</option>
                          <option value="C,D">C și D</option>
                          <option value="Radio">Radio</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Status</div>
                        <select className={selectCls + ' w-full'} value={editValues.status}
                          onChange={e => setEditValues((v: any) => ({ ...v, status: e.target.value }))}>
                          <option value="draft">Ciornă</option>
                          <option value="active">Activă</option>
                          <option value="completed">Finalizată</option>
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Locație</div>
                        <select className={selectCls + ' w-full'} value={editValues.location_id}
                          onChange={e => {
                            const locId = e.target.value
                            const loc = refs.locations.find((l: any) => l.id === locId)
                            const defaultDetail = loc ? `${loc.name}, jud. ${loc.county}` : ''
                            setEditValues((v: any) => ({ ...v, location_id: locId, location_detail: defaultDetail }))
                          }}>
                          <option value="">— Selectează —</option>
                          {refs.locations.map((l: any) => <option key={l.id} value={l.id}>{l.name}, {l.county}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Ambarcațiune</div>
                        <select className={selectCls + ' w-full'} value={editValues.boat_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, boat_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Ambarcațiune 2</div>
                        <select className={selectCls + ' w-full'} value={editValues.boat_id_2||''}
                          onChange={e => setEditValues((v: any) => ({ ...v, boat_id_2: e.target.value }))}>
                          <option value="">— niciuna —</option>
                          {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Ambarcațiune 3</div>
                        <select className={selectCls + ' w-full'} value={editValues.boat_id_3||''}
                          onChange={e => setEditValues((v: any) => ({ ...v, boat_id_3: e.target.value }))}>
                          <option value="">— niciuna —</option>
                          {refs.boats.map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Evaluator ANR</div>
                        <select className={selectCls + ' w-full'} value={editValues.evaluator_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, evaluator_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.evaluators.map((e: any) => <option key={e.id} value={e.id}>{e.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Instructor SetSail</div>
                        <select className={selectCls + ' w-full'} value={editValues.instructor_id}
                          onChange={e => setEditValues((v: any) => ({ ...v, instructor_id: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Instructor 2</div>
                        <select className={selectCls + ' w-full'} value={editValues.instructor_id_2||''}
                          onChange={e => setEditValues((v: any) => ({ ...v, instructor_id_2: e.target.value }))}>
                          <option value="">— niciunul —</option>
                          {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Instructor 3</div>
                        <select className={selectCls + ' w-full'} value={editValues.instructor_id_3||''}
                          onChange={e => setEditValues((v: any) => ({ ...v, instructor_id_3: e.target.value }))}>
                          <option value="">— niciunul —</option>
                          {refs.instructors.map((i: any) => <option key={i.id} value={i.id}>{i.full_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Categorie timeline</div>
                        <select className={selectCls + ' w-full'} value={editValues.timeline_scope || ''}
                          onChange={e => setEditValues((v: any) => ({ ...v, timeline_scope: e.target.value }))}>
                          <option value="">— Selectează —</option>
                          {TIMELINE_SCOPES.map(sc => <option key={sc.value} value={sc.value}>{sc.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Locație detaliată</div>
                        <input className={inputCls + ' w-full'} value={editValues.location_detail}
                          onChange={e => setEditValues((v: any) => ({ ...v, location_detail: e.target.value }))}
                          placeholder={refs.locations.find((l: any) => l.id === editValues.location_id)?.location_detail || 'ex: Lac Snagov – complex Delta Snagov, strada Nicolae Grigorescu, sat Izvorani, comuna Ciolpani'} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Nr. solicitare furnizor</div>
                        <input className={inputCls + ' w-full'} value={editValues.request_number}
                          onChange={e => setEditValues((v: any) => ({ ...v, request_number: e.target.value }))}
                          placeholder="ex: 16/ 23.08.2024" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Nr. înștiintare reg ANR</div>
                        <input className={inputCls + ' w-full'} value={editValues.nr_instiintare_anr}
                          onChange={e => setEditValues((v: any) => ({ ...v, nr_instiintare_anr: e.target.value }))} />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Nr. documente PV</div>
                        <input className={inputCls + ' w-full'} value={editValues.nr_document_ancom}
                          onChange={e => setEditValues((v: any) => ({ ...v, nr_document_ancom: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <div className="text-xs text-gray-400 mb-1">Link skipper.setsail.ro</div>
                        <input className={inputCls + ' w-full'} value={editValues.skipper_url}
                          onChange={e => setEditValues((v: any) => ({ ...v, skipper_url: e.target.value }))}
                          placeholder="https://skipper.setsail.ro/admin/groups/224" />
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 mb-1">Observații</div>
                        <input className={inputCls + ' w-full'} value={editValues.notes}
                          onChange={e => setEditValues((v: any) => ({ ...v, notes: e.target.value }))}
                          placeholder="Condiții meteo, etc." />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={cancelEdit}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
                        <X size={12} /> Anulează
                      </button>
                      <button onClick={() => saveEdit(s.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
                        style={{ background: '#059669' }}>
                        <Check size={12} /> {saving ? 'Se salvează...' : 'Salvează'}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* View mode */
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-semibold text-gray-900">
                          {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </span>
                        <div className="relative group">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80 transition-opacity"
                          style={{ background: st.color + '15', color: st.color }}>
                          {st.label} ▾
                        </span>
                        <div className="absolute left-0 top-6 z-50 hidden group-hover:flex flex-col bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-32">
                          {(['draft','active','focus','completed'] as const).map(sv => (
                            <button key={sv} onClick={async(e)=>{
              e.stopPropagation()
              await supabase.from('sessions').update({status:sv}).eq('id',s.id)
              // Actualizeaza si clonele cu acelasi status (fara focus)
              const cloneStatus = sv === 'focus' ? 'active' : sv
              await supabase.from('sessions').update({status:cloneStatus}).eq('parent_session_id',s.id).eq('session_type','clone')
              setSessions(ss=>ss.map(x=>{
                if(x.id===s.id) return {...x,status:sv}
                if(x.parent_session_id===s.id && x.session_type==='clone') return {...x,status:cloneStatus}
                return x
              }))
            }}
                              className="px-3 py-2 text-xs text-left hover:bg-gray-50 transition-colors font-medium"
                              style={{color:{draft:'#6b7280',active:'#d97706',focus:'#7c3aed',completed:'#059669'}[sv]}}>
                              {{draft:'Ciornă',active:'Activă',focus:'Focus',completed:'Finalizată'}[sv]}
                            </button>
                          ))}
                        </div>
                      </div>
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                          Clasa {s.class_caa.replace(',','+')} · {principalCount.total} cursanți
                        </span>
                      {s.is_clone && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">Clonă</span>}
                      </div>
                      <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-0.5">
                        <span>📍 {s.locations?.name}, {s.locations?.county}</span>
                        <span>⛵ {s.boats?.name || '—'}</span>
                        <span>👤 {s.instructors?.full_name || '—'}</span>
                        <span>🏛️ {s.evaluators?.full_name || '—'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      <button onClick={() => copyCode(s.access_code)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-200 hover:bg-gray-50 transition-colors"
                        title="Copiază link portal">
                        <Copy size={12} />
                        {copied === s.access_code ? '✓ Copiat!' : s.access_code}
                      </button>
                      <button onClick={() => startEdit(s)}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-blue-50 hover:border-blue-200 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Editează sesiunea">
                        <Pencil size={14} />
                      </button>
                      <Link href={`/admin/sesiuni/${s.id}`}
                        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
                        title="Deschide sesiunea">
                        <ExternalLink size={14} />
                      </Link>
                      <button onClick={() => deleteSession(s.id)}
                        className="p-2 rounded-lg border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                        title="Șterge sesiunea">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
                {/* CLONE */}
                {clones.map((clone: any, ci: number) => {
                  const cloneCount = cloneCounts[ci] || {total:0, absenti:0}
                  const cloneSt = statusMap[clone.status] || statusMap.draft
                  const isEditingClone = editingId === clone.id
                  return (
                    <div key={clone.id} className="ml-6 flex gap-0">
                      <div className="flex flex-col items-center mr-2 pt-4">
                        <div className="w-px h-4 bg-blue-200"/>
                        <div className="w-3 h-px bg-blue-200"/>
                      </div>
                      <div className={`flex-1 bg-white rounded-xl shadow-sm border mb-1 transition-colors ${isEditingClone ? 'border-blue-300' : 'border-blue-100'}`}>
                        {isEditingClone ? (
                          <div className="p-4">
                            <div className="text-xs font-medium text-blue-600 mb-3">✎ Editare clonă</div>
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              <div><label className="text-xs text-gray-400 mb-1 block">Data practică</label>
                                <input type="date" className={inputCls} value={editValues.session_date||''} onChange={e=>setEditValues((v:any)=>({...v,session_date:e.target.value}))}/></div>
                              <div><label className="text-xs text-gray-400 mb-1 block">Locație</label>
                                <select className={selectCls} value={editValues.location_id||''} onChange={e=>setEditValues((v:any)=>({...v,location_id:e.target.value}))}>
                                  <option value="">—</option>
                                  {refs.locations.map((l:any)=><option key={l.id} value={l.id}>{l.name}</option>)}
                                </select></div>
                              <div><label className="text-xs text-gray-400 mb-1 block">Ambarcațiune</label>
                                <select className={selectCls} value={editValues.boat_id||''} onChange={e=>setEditValues((v:any)=>({...v,boat_id:e.target.value}))}>
                                  <option value="">—</option>
                                  {refs.boats.map((b:any)=><option key={b.id} value={b.id}>{b.name}</option>)}
                                </select></div>
                              <div><label className="text-xs text-gray-400 mb-1 block">Instructor</label>
                                <select className={selectCls} value={editValues.instructor_id||''} onChange={e=>setEditValues((v:any)=>({...v,instructor_id:e.target.value}))}>
                                  <option value="">—</option>
                                  {refs.instructors.map((i:any)=><option key={i.id} value={i.id}>{i.full_name}</option>)}
                                </select></div>
                              <div><label className="text-xs text-gray-400 mb-1 block">Evaluator ANR</label>
                                <select className={selectCls} value={editValues.evaluator_id||''} onChange={e=>setEditValues((v:any)=>({...v,evaluator_id:e.target.value}))}>
                                  <option value="">—</option>
                                  {refs.evaluators.map((e:any)=><option key={e.id} value={e.id}>{e.full_name}</option>)}
                                </select></div>
                              <div><label className="text-xs text-gray-400 mb-1 block">Clasă CAA</label>
                                <select className={selectCls} value={editValues.class_caa||''} onChange={e=>setEditValues((v:any)=>({...v,class_caa:e.target.value}))}>
                                  {['C,D','B','C','D','B,C,D'].map(c=><option key={c} value={c}>{c.replace(',','+')}</option>)}
                                </select></div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button onClick={cancelEdit} className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50">Anulează</button>
                              <button onClick={()=>saveEdit(clone.id)} disabled={saving}
                                className="px-3 py-1.5 text-xs rounded-lg font-medium text-white disabled:opacity-50" style={{background:'#059669'}}>
                                {saving?'Se salvează...':'✓ Salvează'}
                              </button>
                            </div>
                          </div>
                        ) : (
                        <div className="p-3 flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs text-blue-400 font-medium">⎇ Clonă</span>
                              <span className="font-medium text-gray-800 text-sm">
                                {new Date(clone.session_date).toLocaleDateString('ro-RO', {day:'2-digit',month:'long',year:'numeric'})}
                              </span>
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{background:cloneSt.color+'15',color:cloneSt.color}}>{cloneSt.label}</span>
                              <span className="text-xs text-gray-400">
                                Clasa {clone.class_caa.replace(',','+')} · {cloneCount.total} cursanți
                              </span>
                            </div>
                            <div className="text-xs text-gray-400 flex gap-3">
                              <span>📍 {clone.locations?.name}{clone.locations?.county ? `, ${clone.locations.county}` : ''}</span>
                              <span>⛵ {clone.boats?.name||'—'}</span>
                              <span>👤 {clone.instructors?.full_name||'—'}</span>
                              <span>🏛️ {clone.evaluators?.full_name||'—'}</span>
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <div className="relative group">
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer hover:opacity-80"
                                style={{background:cloneSt.color+'15',color:cloneSt.color}}>
                                {cloneSt.label} ▾
                              </span>
                              <div className="absolute right-0 top-6 z-50 hidden group-hover:flex flex-col bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-28">
                                {(['draft','active','completed'] as const).map(sv => (
                                  <button key={sv} onClick={async(e)=>{e.stopPropagation();await supabase.from('sessions').update({status:sv}).eq('id',clone.id);setSessions(ss=>ss.map(x=>x.id===clone.id?{...x,status:sv}:x))}}
                                    className="px-3 py-1.5 text-xs text-left hover:bg-gray-50 font-medium"
                                    style={{color:{draft:'#6b7280',active:'#d97706',completed:'#059669'}[sv]}}>
                                    {{draft:'Ciornă',active:'Activă',completed:'Finalizată'}[sv]}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <button onClick={()=>startEdit(clone)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"><Pencil size={13}/></button>
                            <Link href={`/admin/sesiuni/${principal.id}`}
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-400 hover:text-gray-700 transition-colors">
                              <ExternalLink size={13}/>
                            </Link>
                            <button onClick={async()=>{
                              if (!window.confirm('Ștergi clona?\n\nCursanții vor fi mutați înapoi la sesiunea principală.')) return
                              // Mutam cursantii la principal
                              const { data: cloneStudents } = await supabase.from('students').select('*').eq('session_id', clone.id)
                              if (cloneStudents && cloneStudents.length > 0) {
                                const { data: principalStudents } = await supabase.from('students').select('order_in_session').eq('session_id', principal.id).order('order_in_session', {ascending:false}).limit(1)
                                const maxOrder = principalStudents?.[0]?.order_in_session || 0
                                for (let i = 0; i < cloneStudents.length; i++) {
                                  await supabase.from('students').update({ session_id: principal.id, order_in_session: maxOrder + i + 1 }).eq('id', cloneStudents[i].id)
                                }
                              }
                              // Stergem sesiunea absent a clonei
                              const cloneAbsent = sessions.find((s:any) => s.parent_session_id === clone.id && s.session_type === 'absent')
                              if (cloneAbsent) await supabase.from('sessions').delete().eq('id', cloneAbsent.id)
                              // Stergem clona
                              await supabase.from('sessions').delete().eq('id', clone.id)
                              await load()
                            }}
                              className="p-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                              title="Șterge clona">
                              <Trash2 size={13}/>
                            </button>
                          </div>
                        </div>
                        )}
                      </div>
                    </div>
                  )
                })}
                {/* ABSENTI */}
                {absentCount && absentCount.total > 0 && (
                  <div className="ml-6 flex gap-0">
                    <div className="flex flex-col items-center mr-2 pt-4">
                      <div className="w-px h-4 bg-red-200"/>
                      <div className="w-3 h-px bg-red-200"/>
                    </div>
                    <div className="flex-1 bg-red-50 rounded-xl border border-red-100 mb-1">
                      <div className="p-3 flex items-center gap-3">
                        <span className="text-xs text-red-500 font-medium">⚠ Absenți</span>
                        <span className="text-xs text-red-600 font-semibold">{absentCount.total} cursanți</span>
                        <span className="text-xs text-red-400">în așteptare pentru reprogramare</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* INFO TOTAL */}
                <div className="ml-6 mb-2">
                  <span className="text-xs text-gray-400">
                    Total: <strong>{totalAll}</strong> cursanți
                    {clones.length > 0 && <>
                      {' · '}{clones.length + 1} liste ({principalCount.total}
                      {clones.map((c:any,ci:number) => <span key={c.id}> – {cloneCounts[ci]?.total||0}</span>)})
                    </>}
                    {absentCount && absentCount.total > 0 && <> · <span className="text-red-500">{absentCount.total} absenți</span></>}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}