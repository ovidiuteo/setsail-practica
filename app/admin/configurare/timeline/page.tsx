'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Loader2, RotateCcw, ArrowDownUp } from 'lucide-react'
import { resolveColor, defaultDayColor, defaultWeekendColor } from '@/lib/timeline-colors'
import { TIMELINE_SCOPES, scopeForSession, timelineScopeLabel, DEFAULT_TIMELINE_SCOPE, type TimelineScope } from '@/lib/timeline-scope'

type Milestone = {
  id: string
  scope: string
  code: string
  label: string
  anchor: string
  offset_days: number
  color: string
  color_day: string | null
  color_weekend: string | null
  order_index: number
}

const ANCHORS: Array<{ value: string; label: string }> = [
  { value: 'created_at', label: 'Data creării sesiunii' },
  { value: 'course_start_date', label: 'Data început curs' },
  { value: 'practice_start_date', label: 'Data început practică' },
  { value: 'session_date', label: 'Data examenului' },
]

const MONTHS_RO = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie']
const DAYS_RO = ['duminică','luni','marți','miercuri','joi','vineri','sâmbătă']
const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x }
function fmtDateRO(d: Date) { return `${DAYS_RO[d.getDay()]}, ${d.getDate()} ${MONTHS_RO[d.getMonth()]} ${d.getFullYear()}` }
function isValidHex(v: string): boolean { return /^#[0-9a-fA-F]{6}$/.test(v) }

// Input text pentru HEX, sincronizat cu valoarea externă (cu commit on blur sau Enter)
function HexInput({ value, onCommit, disabled = false }: { value: string; onCommit: (v: string) => void; disabled?: boolean }) {
  const [local, setLocal] = useState(value)
  useEffect(() => { setLocal(value) }, [value])
  const commit = () => {
    if (isValidHex(local)) onCommit(local.toLowerCase())
    else setLocal(value) // revert la valoarea validă curentă
  }
  return (
    <input type="text" value={local} disabled={disabled}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
      placeholder="#rrggbb"
      className={`w-20 px-1.5 py-0.5 border border-gray-200 rounded text-[11px] font-mono uppercase focus:outline-none focus:border-purple-400 disabled:opacity-30 disabled:bg-gray-50`}
    />
  )
}

type SessionLite = {
  id: string
  session_date: string | null
  created_at: string | null
  course_start_date: string | null
  practice_start_date: string | null
  class_caa: string | null
  access_code: string | null
  session_type: string | null
  timeline_scope: string | null
  locations: { name: string } | null
}

export default function TimelineConfigPage() {
  const [scope, setScope] = useState<TimelineScope>(DEFAULT_TIMELINE_SCOPE)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [sessions, setSessions] = useState<SessionLite[]>([])
  const [previewSessionId, setPreviewSessionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: ms }, { data: sess }] = await Promise.all([
      supabase.from('timeline_milestones').select('*').order('order_index'),
      supabase.from('sessions')
        .select('id, session_date, created_at, course_start_date, practice_start_date, class_caa, access_code, session_type, timeline_scope, locations(name)')
        .eq('session_type', 'principal')
        .order('session_date', { ascending: false }),
    ])
    setMilestones((ms || []) as Milestone[])
    setSessions((sess || []) as unknown as SessionLite[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // Sesiuni din scope-ul curent; auto-selectare la schimbarea scope-ului
  const sessionsInScope = sessions.filter(s => scopeForSession(s) === scope)
  useEffect(() => {
    const stillValid = previewSessionId && sessionsInScope.some(s => s.id === previewSessionId)
    if (!stillValid && sessionsInScope.length > 0) {
      setPreviewSessionId(sessionsInScope[0].id)
    } else if (sessionsInScope.length === 0) {
      setPreviewSessionId('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, sessions.length])

  const scopedMilestones = milestones.filter(m => m.scope === scope).sort((a,b) => a.order_index - b.order_index)

  async function addMilestone() {
    const nextOrder = Math.max(0, ...scopedMilestones.map(m => m.order_index)) + 1
    const code = `m${Date.now().toString().slice(-6)}`
    const { data, error } = await supabase.from('timeline_milestones').insert({
      scope, code, label: 'Milestone nou', anchor: 'session_date', offset_days: 0,
      color: '#3b82f6', color_day: null, color_weekend: null, order_index: nextOrder,
    }).select().single()
    if (error) { alert('Eroare: ' + error.message); return }
    setMilestones([...milestones, data as Milestone])
  }

  async function updateMilestone(id: string, patch: Partial<Milestone>) {
    setSavingId(id)
    const { error } = await supabase.from('timeline_milestones').update({
      ...patch, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSavingId(null)
    if (error) { alert('Eroare: ' + error.message); return }
    setMilestones(milestones.map(m => m.id === id ? { ...m, ...patch } as Milestone : m))
  }

  async function deleteMilestone(m: Milestone) {
    if (!confirm(`Ștergi milestone „${m.label}"?`)) return
    const { error } = await supabase.from('timeline_milestones').delete().eq('id', m.id)
    if (error) { alert('Eroare: ' + error.message); return }
    setMilestones(milestones.filter(x => x.id !== m.id))
  }

  // Reordonare cronologică: setează order_index conform datelor calculate (anchor + offset)
  async function reorderChronologically() {
    const today = startOfDay(new Date())
    const selected = sessionsInScope.find(s => s.id === previewSessionId)
    const baseSession: any = selected ? selected : {
      created_at: new Date(today.getTime() - 10 * DAY_MS).toISOString(),
      course_start_date: new Date(today.getTime() - 8 * DAY_MS).toISOString(),
      practice_start_date: new Date(today.getTime() - 3 * DAY_MS).toISOString(),
      session_date: new Date(today.getTime() + 7 * DAY_MS).toISOString(),
    }
    // Calculez data efectivă pentru fiecare milestone din scope
    const dated = scopedMilestones.map(m => {
      const raw = baseSession[m.anchor] || baseSession.session_date
      const anchor = raw ? startOfDay(new Date(raw)) : today
      return { m, date: new Date(anchor.getTime() + m.offset_days * DAY_MS) }
    }).sort((a, b) => a.date.getTime() - b.date.getTime())

    setSavingId('reorder')
    // Update toate într-o singură repriză
    for (let i = 0; i < dated.length; i++) {
      if (dated[i].m.order_index !== i) {
        await supabase.from('timeline_milestones').update({
          order_index: i,
          updated_at: new Date().toISOString(),
        }).eq('id', dated[i].m.id)
      }
    }
    setSavingId(null)
    // Actualizăm state local
    setMilestones(milestones.map(orig => {
      const idx = dated.findIndex(d => d.m.id === orig.id)
      return idx >= 0 ? { ...orig, order_index: idx } : orig
    }))
  }

  // Când utilizatorul schimbă manual culoarea „zi", auto-completează „weekend" cu derivata
  // (doar dacă weekend e null sau e tot derivat din event)
  async function setMilestoneDayColor(m: Milestone, newDay: string) {
    const patch: Partial<Milestone> = { color_day: newDay }
    // Auto-derivate weekend doar dacă cel actual e null sau e exact derivata din event
    const eventDerivedWeekend = defaultWeekendColor(m.color)
    if (m.color_weekend === null || m.color_weekend === eventDerivedWeekend) {
      // Calculăm o nuanță saturată din noul day
      const newWeekend = newDay === 'none' ? 'none' : defaultWeekendColor(newDay)
      patch.color_weekend = newWeekend
    }
    await updateMilestone(m.id, patch)
  }

  // Preview: folosește sesiunea selectată (sau fictivă dacă nu există nimic)
  function buildPreviewDays() {
    const today = startOfDay(new Date())
    const selected = sessionsInScope.find(s => s.id === previewSessionId)
    const baseSession: any = selected ? selected : {
      created_at: new Date(today.getTime() - 10 * DAY_MS).toISOString(),
      course_start_date: new Date(today.getTime() - 8 * DAY_MS).toISOString(),
      practice_start_date: new Date(today.getTime() - 3 * DAY_MS).toISOString(),
      session_date: new Date(today.getTime() + 7 * DAY_MS).toISOString(),
    }
    const msDates = scopedMilestones.map(m => {
      const anchorRaw = baseSession[m.anchor] || baseSession.session_date
      if (!anchorRaw) return null
      const anchor = startOfDay(new Date(anchorRaw))
      return { ...m, date: new Date(anchor.getTime() + m.offset_days * DAY_MS) }
    }).filter(Boolean) as (Milestone & { date: Date })[]
    if (msDates.length < 2) return { days: [], msDates: [] }
    const times = msDates.map(m => m.date.getTime()).sort((a,b) => a-b)
    const start = times[0]
    const end = times[times.length - 1]
    const n = Math.max(1, Math.round((end - start) / DAY_MS) + 1)
    const days: Date[] = []
    for (let i = 0; i < n; i++) days.push(new Date(start + i * DAY_MS))
    return { days, msDates, today }
  }

  function renderPreview() {
    const { days, msDates } = buildPreviewDays()
    if (!days.length) {
      return <p className="text-sm text-gray-400 italic">Adaugă cel puțin 2 milestones ca să vezi preview-ul.</p>
    }
    const today = startOfDay(new Date())
    return (
      <div className="relative w-full h-6 flex bg-gray-50 rounded overflow-visible">
        {days.map((d, i) => {
          const isWeekend = d.getDay() === 0 || d.getDay() === 6
          const isToday = d.getTime() === today.getTime()
          const t = d.getTime()
          const sortedMs = ([...msDates] as any[]).sort((a, b) => a.date.getTime() - b.date.getTime())
          const exactMs = sortedMs.find(m => m.date.getTime() === t)
          const prevMs = !exactMs ? [...sortedMs].reverse().find(m => m.date.getTime() <= t) : null
          let bg = '#e5e7eb'
          let label = ''
          if (exactMs) {
            bg = exactMs.color === 'none' ? (isWeekend ? '#86efac' : '#bbf7d0') : exactMs.color
            label = exactMs.label
          } else if (prevMs) {
            bg = resolveColor(
              isWeekend ? prevMs.color_weekend : prevMs.color_day,
              prevMs.color,
              isWeekend ? 'weekend' : 'day',
            )
            label = prevMs.label
          }
          return (
            <div key={i} className="flex-1 relative group h-full"
              style={{ background: bg, minWidth: 4, borderRight: i < days.length - 1 ? '1px solid #d1d5db' : undefined }}>
              {isToday && (
                <div className="absolute inset-y-0 pointer-events-none"
                  style={{ left: '37.5%', width: '25%', background: 'rgba(220, 38, 38, 0.55)',
                           borderLeft: '1.5px solid #b91c1c', borderRight: '1.5px solid #b91c1c' }}>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-red-600 shadow" />
                </div>
              )}
              <span className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50
                               px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap pointer-events-none shadow-lg">
                {fmtDateRO(d)}{label ? ' · ' + label : ''}{isToday ? ' · astăzi' : ''}{isWeekend && !exactMs ? ' · weekend' : ''}
              </span>
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin text-gray-400" size={32}/></div>
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/admin/configurare" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18}/>
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Timeline sesiuni</h1>
            <p className="text-xs text-gray-500">Configurare milestones + perioade colorate pe bara de progres a fiecărei sesiuni.</p>
          </div>
        </div>

        {/* Scope tabs */}
        <div className="flex flex-wrap gap-2 border-b border-gray-200">
          {TIMELINE_SCOPES.map(s => (
            <button key={s.value} onClick={() => setScope(s.value)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
                scope === s.value ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {s.label}
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div className="text-xs font-semibold text-gray-700">Preview pe sesiune</div>
            {sessionsInScope.length > 0 ? (
              <select value={previewSessionId}
                onChange={e => setPreviewSessionId(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 min-w-[260px]">
                {sessionsInScope.map(s => {
                  const d = s.session_date
                    ? new Date(s.session_date).toLocaleDateString('ro-RO', { day:'2-digit', month:'short', year:'numeric' })
                    : '(fără dată)'
                  const loc = s.locations?.name || ''
                  return <option key={s.id} value={s.id}>{d} · {loc || '—'} · {s.class_caa || ''}</option>
                })}
              </select>
            ) : (
              <span className="text-xs text-gray-400 italic">Nicio sesiune „{timelineScopeLabel(scope)}" disponibilă. Preview cu sesiune fictivă.</span>
            )}
          </div>
          {renderPreview()}
          <p className="text-xs text-gray-400 mt-2">
            Modificările la milestones / perioade se aplică <strong>tuturor sesiunilor „{timelineScopeLabel(scope)}"</strong>.
            Sesiunea selectată e doar pentru previzualizare.
          </p>
        </div>

        {/* Milestones */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Milestones</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Puncte cheie pe timeline. Fiecare are o ancoră (câmp din sesiune) + offset (zile înainte/după) + culoare proprie.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={reorderChronologically}
                disabled={savingId === 'reorder' || scopedMilestones.length < 2}
                title="Reordonează milestones-urile în ordine cronologică pe baza datelor calculate"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {savingId === 'reorder' ? <Loader2 size={12} className="animate-spin"/> : <ArrowDownUp size={12}/>}
                Sortează cronologic
              </button>
              <button onClick={addMilestone}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                style={{ background: '#7c3aed' }}>
                <Plus size={12}/>Adaugă milestone
              </button>
            </div>
          </div>
          <div className="space-y-2">
            {scopedMilestones.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3 text-center">Nicio milestone definită.</p>
            )}
            {scopedMilestones.map(m => {
              const derivedDay = defaultDayColor(m.color)
              const derivedWeekend = defaultWeekendColor(m.color)
              const dayIsNone = m.color_day === 'none'
              const wkIsNone = m.color_weekend === 'none'
              const effectiveDay = dayIsNone ? '#ffffff' : (m.color_day || derivedDay)
              const effectiveWeekend = wkIsNone ? '#ffffff' : (m.color_weekend || derivedWeekend)
              const dayIsDefault = m.color_day === null || m.color_day === derivedDay
              const wkIsDefault = m.color_weekend === null || m.color_weekend === derivedWeekend
              return (
                <div key={m.id} className="border border-gray-100 rounded-lg p-3 space-y-2 bg-white">
                  {/* Rândul 1: meta */}
                  <div className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Cod</label>
                      <input type="text" value={m.code}
                        onChange={e => setMilestones(milestones.map(x => x.id === m.id ? {...x, code: e.target.value} : x))}
                        onBlur={e => updateMilestone(m.id, { code: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:border-purple-400"/>
                    </div>
                    <div className="col-span-4">
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Label</label>
                      <input type="text" value={m.label}
                        onChange={e => setMilestones(milestones.map(x => x.id === m.id ? {...x, label: e.target.value} : x))}
                        onBlur={e => updateMilestone(m.id, { label: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-purple-400"/>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Ancoră</label>
                      <select value={m.anchor}
                        onChange={e => updateMilestone(m.id, { anchor: e.target.value })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-purple-400">
                        {ANCHORS.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Offset (zile)</label>
                      <input type="number" value={m.offset_days}
                        onChange={e => setMilestones(milestones.map(x => x.id === m.id ? {...x, offset_days: parseInt(e.target.value)||0} : x))}
                        onBlur={e => updateMilestone(m.id, { offset_days: parseInt(e.target.value)||0 })}
                        className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:border-purple-400"/>
                    </div>
                    <div className="col-span-1 flex justify-end items-center gap-1 pb-0.5">
                      {savingId === m.id && <Loader2 size={12} className="animate-spin text-gray-400"/>}
                      <button onClick={() => deleteMilestone(m)}
                        className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                        <Trash2 size={12}/>
                      </button>
                    </div>
                  </div>
                  {/* Rândul 2: culori */}
                  <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-gray-100">
                    {/* Event */}
                    <div>
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Culoare event (ziua)</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={m.color}
                          onChange={e => updateMilestone(m.id, { color: e.target.value })}
                          className="w-7 h-7 border border-gray-200 rounded cursor-pointer"/>
                        <HexInput value={m.color} onCommit={v => updateMilestone(m.id, { color: v })} />
                      </div>
                    </div>
                    {/* Day */}
                    <div>
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Zi (până la următorul)</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={effectiveDay}
                          onChange={e => setMilestoneDayColor(m, e.target.value)}
                          disabled={dayIsNone}
                          className="w-7 h-7 border border-gray-200 rounded cursor-pointer disabled:opacity-30"/>
                        <HexInput value={effectiveDay} disabled={dayIsNone}
                          onCommit={v => setMilestoneDayColor(m, v)} />
                        <label className="flex items-center gap-0.5 text-[10px] text-gray-500 cursor-pointer">
                          <input type="checkbox" checked={dayIsNone}
                            onChange={e => updateMilestone(m.id, { color_day: e.target.checked ? 'none' : derivedDay })}
                            className="w-3 h-3"/>none
                        </label>
                        <button onClick={() => updateMilestone(m.id, { color_day: null, color_weekend: null })}
                          disabled={dayIsDefault && wkIsDefault}
                          title="Revino la culorile default derivate din event"
                          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-30">
                          <RotateCcw size={10}/>default
                        </button>
                      </div>
                    </div>
                    {/* Weekend */}
                    <div>
                      <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Weekend</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={effectiveWeekend}
                          onChange={e => updateMilestone(m.id, { color_weekend: e.target.value })}
                          disabled={wkIsNone}
                          className="w-7 h-7 border border-gray-200 rounded cursor-pointer disabled:opacity-30"/>
                        <HexInput value={effectiveWeekend} disabled={wkIsNone}
                          onCommit={v => updateMilestone(m.id, { color_weekend: v })} />
                        <label className="flex items-center gap-0.5 text-[10px] text-gray-500 cursor-pointer">
                          <input type="checkbox" checked={wkIsNone}
                            onChange={e => updateMilestone(m.id, { color_weekend: e.target.checked ? 'none' : derivedWeekend })}
                            className="w-3 h-3"/>none
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

      </div>
    </div>
  )
}
