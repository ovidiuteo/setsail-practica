'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react'

type Milestone = {
  id: string
  scope: string
  code: string
  label: string
  anchor: string
  offset_days: number
  color: string
  order_index: number
}
type Period = {
  id: string
  scope: string
  label: string
  from_milestone_code: string
  to_milestone_code: string
  color_day: string
  color_weekend: string
  order_index: number
}

const SCOPES: Array<{ value: 'practica' | 'radio_lrc'; label: string }> = [
  { value: 'practica', label: 'Practică (A/B/C/D)' },
  { value: 'radio_lrc', label: 'Radio LRC' },
]

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

type SessionLite = {
  id: string
  session_date: string | null
  created_at: string | null
  course_start_date: string | null
  practice_start_date: string | null
  class_caa: string | null
  access_code: string | null
  session_type: string | null
  locations: { name: string } | null
}

function scopeForSession(s: SessionLite): 'radio_lrc' | 'practica' {
  const c = (s.class_caa || '').toLowerCase()
  return (c.includes('radio') || c.includes('lrc')) ? 'radio_lrc' : 'practica'
}

export default function TimelineConfigPage() {
  const [scope, setScope] = useState<'practica' | 'radio_lrc'>('radio_lrc')
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [periods, setPeriods] = useState<Period[]>([])
  const [sessions, setSessions] = useState<SessionLite[]>([])
  const [previewSessionId, setPreviewSessionId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: ms }, { data: ps }, { data: sess }] = await Promise.all([
      supabase.from('timeline_milestones').select('*').order('order_index'),
      supabase.from('timeline_periods').select('*').order('order_index'),
      supabase.from('sessions')
        .select('id, session_date, created_at, course_start_date, practice_start_date, class_caa, access_code, session_type, locations(name)')
        .eq('session_type', 'principal')
        .order('session_date', { ascending: false }),
    ])
    setMilestones((ms || []) as Milestone[])
    setPeriods((ps || []) as Period[])
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
  const scopedPeriods = periods.filter(p => p.scope === scope).sort((a,b) => a.order_index - b.order_index)

  async function addMilestone() {
    const nextOrder = Math.max(0, ...scopedMilestones.map(m => m.order_index)) + 1
    const code = `m${Date.now().toString().slice(-6)}`
    const { data, error } = await supabase.from('timeline_milestones').insert({
      scope, code, label: 'Milestone nou', anchor: 'session_date', offset_days: 0,
      color: '#3b82f6', order_index: nextOrder,
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

  async function addPeriod() {
    const nextOrder = Math.max(0, ...scopedPeriods.map(p => p.order_index)) + 1
    const firstMs = scopedMilestones[0]?.code || 'creation'
    const secondMs = scopedMilestones[1]?.code || 'exam'
    const { data, error } = await supabase.from('timeline_periods').insert({
      scope, label: 'Perioadă nouă',
      from_milestone_code: firstMs, to_milestone_code: secondMs,
      color_day: '#bbf7d0', color_weekend: '#86efac', order_index: nextOrder,
    }).select().single()
    if (error) { alert('Eroare: ' + error.message); return }
    setPeriods([...periods, data as Period])
  }

  async function updatePeriod(id: string, patch: Partial<Period>) {
    setSavingId(id)
    const { error } = await supabase.from('timeline_periods').update({
      ...patch, updated_at: new Date().toISOString(),
    }).eq('id', id)
    setSavingId(null)
    if (error) { alert('Eroare: ' + error.message); return }
    setPeriods(periods.map(p => p.id === id ? { ...p, ...patch } as Period : p))
  }

  async function deletePeriod(p: Period) {
    if (!confirm(`Ștergi perioada „${p.label}"?`)) return
    const { error } = await supabase.from('timeline_periods').delete().eq('id', p.id)
    if (error) { alert('Eroare: ' + error.message); return }
    setPeriods(periods.filter(x => x.id !== p.id))
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
          const exactMs = (msDates as any[]).find(m => m.date.getTime() === d.getTime())
          const period = scopedPeriods.find(p => {
            const from = (msDates as any[]).find(m => m.code === p.from_milestone_code)?.date
            const to = (msDates as any[]).find(m => m.code === p.to_milestone_code)?.date
            if (!from || !to) return false
            return d.getTime() >= from.getTime() && d.getTime() < to.getTime()
          })
          let bg = '#e5e7eb'
          let label = ''
          if (exactMs) { bg = exactMs.color; label = exactMs.label }
          else if (period) { bg = isWeekend ? period.color_weekend : period.color_day; label = period.label }
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
        <div className="flex gap-2 border-b border-gray-200">
          {SCOPES.map(s => (
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
              <span className="text-xs text-gray-400 italic">Nicio sesiune {scope === 'radio_lrc' ? 'Radio LRC' : 'Practică'} disponibilă. Preview cu sesiune fictivă.</span>
            )}
          </div>
          {renderPreview()}
          <p className="text-xs text-gray-400 mt-2">
            Modificările la milestones / perioade se aplică <strong>tuturor sesiunilor {scope === 'radio_lrc' ? 'Radio LRC' : 'Practică'}</strong>.
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
            <button onClick={addMilestone}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: '#7c3aed' }}>
              <Plus size={12}/>Adaugă milestone
            </button>
          </div>
          <div className="space-y-2">
            {scopedMilestones.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3 text-center">Nicio milestone definită.</p>
            )}
            {scopedMilestones.map(m => (
              <div key={m.id} className="grid grid-cols-12 gap-2 items-center p-2 border border-gray-100 rounded-lg">
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Cod</label>
                  <input type="text" value={m.code}
                    onChange={e => setMilestones(milestones.map(x => x.id === m.id ? {...x, code: e.target.value} : x))}
                    onBlur={e => updateMilestone(m.id, { code: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs font-mono focus:outline-none focus:border-purple-400"/>
                </div>
                <div className="col-span-3">
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
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Offset</label>
                  <input type="number" value={m.offset_days}
                    onChange={e => setMilestones(milestones.map(x => x.id === m.id ? {...x, offset_days: parseInt(e.target.value)||0} : x))}
                    onBlur={e => updateMilestone(m.id, { offset_days: parseInt(e.target.value)||0 })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:border-purple-400"/>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Culoare</label>
                  <div className="flex gap-1 items-center">
                    <input type="color" value={m.color}
                      onChange={e => updateMilestone(m.id, { color: e.target.value })}
                      className="w-7 h-7 border border-gray-200 rounded cursor-pointer"/>
                    <span className="text-xs font-mono text-gray-500">{m.color}</span>
                  </div>
                </div>
                <div className="col-span-1 flex justify-end">
                  {savingId === m.id && <Loader2 size={12} className="animate-spin text-gray-400 mr-1"/>}
                  <button onClick={() => deleteMilestone(m)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Periods */}
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold text-sm text-gray-900">Perioade</h3>
              <p className="text-xs text-gray-400 mt-0.5">
                Intervale între 2 milestones. Au culoare zi + culoare weekend (mai saturată).
              </p>
            </div>
            <button onClick={addPeriod}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ background: '#7c3aed' }}>
              <Plus size={12}/>Adaugă perioadă
            </button>
          </div>
          <div className="space-y-2">
            {scopedPeriods.length === 0 && (
              <p className="text-xs text-gray-400 italic py-3 text-center">Nicio perioadă definită.</p>
            )}
            {scopedPeriods.map(p => (
              <div key={p.id} className="grid grid-cols-12 gap-2 items-center p-2 border border-gray-100 rounded-lg">
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Label</label>
                  <input type="text" value={p.label}
                    onChange={e => setPeriods(periods.map(x => x.id === p.id ? {...x, label: e.target.value} : x))}
                    onBlur={e => updatePeriod(p.id, { label: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:border-purple-400"/>
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">De la milestone</label>
                  <select value={p.from_milestone_code}
                    onChange={e => updatePeriod(p.id, { from_milestone_code: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-purple-400">
                    {scopedMilestones.map(m => <option key={m.id} value={m.code}>{m.label}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Până la milestone</label>
                  <select value={p.to_milestone_code}
                    onChange={e => updatePeriod(p.id, { to_milestone_code: e.target.value })}
                    className="w-full px-2 py-1 border border-gray-200 rounded text-xs bg-white focus:outline-none focus:border-purple-400">
                    {scopedMilestones.map(m => <option key={m.id} value={m.code}>{m.label}</option>)}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Zi</label>
                  <input type="color" value={p.color_day}
                    onChange={e => updatePeriod(p.id, { color_day: e.target.value })}
                    className="w-7 h-7 border border-gray-200 rounded cursor-pointer"/>
                </div>
                <div className="col-span-1">
                  <label className="block text-[10px] uppercase text-gray-400 mb-0.5">Weekend</label>
                  <input type="color" value={p.color_weekend}
                    onChange={e => updatePeriod(p.id, { color_weekend: e.target.value })}
                    className="w-7 h-7 border border-gray-200 rounded cursor-pointer"/>
                </div>
                <div className="col-span-1 flex justify-end">
                  {savingId === p.id && <Loader2 size={12} className="animate-spin text-gray-400 mr-1"/>}
                  <button onClick={() => deletePeriod(p)}
                    className="p-1.5 rounded hover:bg-red-50 text-gray-400 hover:text-red-600">
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
