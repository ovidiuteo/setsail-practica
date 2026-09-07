'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CalendarClock, Loader2 } from 'lucide-react'
import { scopeForSession } from '@/lib/timeline-scope'
import {
  configFromSession, buildSlots, slotCapacity, slotDateLabel,
  SLOT_MINUTES, START_HOURS, END_HOURS, BOATS, PER_BOAT, PER_SLOT,
} from '@/lib/practice-slots'

// Configurarea programării la practică + cine s-a înscris pe fiecare interval.
// Apare doar la cursurile C/D (Snagov), unde se face programarea pe ore.

type Booking = { student_id: string; slot_from: string; slot_to: string }

export default function PracticeSlotsCard({ sess, students }: { sess: any; students: any[] }) {
  const [cfg, setCfg] = useState(() => configFromSession(sess))
  const [saving, setSaving] = useState(false)
  const [bookings, setBookings] = useState<Booking[] | null>(null)

  useEffect(() => { setCfg(configFromSession(sess)) }, [sess])
  useEffect(() => {
    supabase.from('practice_bookings').select('student_id, slot_from, slot_to').eq('session_id', sess.id)
      .then(({ data }) => setBookings(data || []))
  }, [sess.id])

  if (scopeForSession(sess) !== 'curs_cd_snagov') return null

  const slots = buildSlots(cfg)
  const capacity = slotCapacity(cfg)
  const nameOf = (id: string) => students.find(s => s.id === id)?.full_name || '—'

  async function save(patch: Partial<typeof cfg>) {
    const next = { ...cfg, ...patch }
    setCfg(next); setSaving(true)
    await supabase.from('sessions').update({
      practice_booking_enabled: next.enabled,
      practice_slot_minutes: next.minutes,
      practice_start_hour: next.startHour,
      practice_end_hour: next.endHour,
      practice_boats: next.boats,
      practice_per_boat: next.perBoat,
      practice_per_slot: next.perSlot,
    }).eq('id', sess.id)
    setSaving(false)
  }

  // Ziua practicii: goală = revine la implicit (ziua dinaintea examenului)
  async function saveDate(d: string | null) {
    setSaving(true)
    await supabase.from('sessions').update({ practice_start_date: d }).eq('id', sess.id)
    sess.practice_start_date = d
    setCfg(configFromSession(sess))
    setSaving(false)
  }

  const sel = 'border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200'
  const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <label className="flex items-center justify-between gap-3 text-xs text-gray-600">
      <span>{label}</span>{children}
    </label>
  )

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
          <CalendarClock size={15} className="text-gray-400" /> Programare la practică
        </h3>
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          {saving && <Loader2 size={12} className="animate-spin text-gray-400" />}
          <input type="checkbox" checked={cfg.enabled} onChange={e => save({ enabled: e.target.checked })} className="accent-emerald-600" />
          Deschisă cursanților
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mb-4">
        <span>Ziua practicii:</span>
        <input type="date" value={cfg.date || ''} onChange={e => saveDate(e.target.value || null)}
          className="border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-200" />
        <b className="text-gray-600">{cfg.date ? slotDateLabel(cfg.date) : 'nestabilită'}</b>
        {!sess.practice_start_date && cfg.date
          ? <span className="text-gray-300">(implicit: ziua dinaintea examenului)</span>
          : sess.practice_start_date && (
            <button onClick={() => saveDate(null)} className="text-gray-400 underline hover:text-gray-600">
              revino la ziua dinaintea examenului
            </button>
          )}
        <span>· {capacity} {capacity === 1 ? 'loc' : 'locuri'} pe interval</span>
      </div>

      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 mb-4">
        <Row label="Durata intervalului">
          <select value={cfg.minutes} onChange={e => save({ minutes: +e.target.value })} className={sel}>
            {SLOT_MINUTES.map(m => <option key={m} value={m}>{m === 90 ? '1½ ore' : m === 60 ? '1 oră' : '2 ore'}</option>)}
          </select>
        </Row>
        <Row label="Ambarcațiuni">
          <select value={cfg.boats} onChange={e => save({ boats: +e.target.value })} className={sel}>
            {BOATS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Row>
        <Row label="Prima oră">
          <select value={cfg.startHour} onChange={e => save({ startHour: +e.target.value })} className={sel}>
            {START_HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </Row>
        <Row label="Locuri pe barcă">
          <select value={cfg.perBoat} onChange={e => save({ perBoat: +e.target.value })} className={sel}>
            {PER_BOAT.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Row>
        <Row label="Ultima oră">
          <select value={cfg.endHour} onChange={e => save({ endHour: +e.target.value })} className={sel}>
            {END_HOURS.map(h => <option key={h} value={h}>{h}:00</option>)}
          </select>
        </Row>
        <Row label="Maxim pe interval">
          <select value={cfg.perSlot} onChange={e => save({ perSlot: +e.target.value })} className={sel}>
            {PER_SLOT.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </Row>
      </div>

      {!slots.length ? (
        <p className="text-xs text-amber-600">Intervalul orar ales nu încape nicio ședință — mărește fereastra sau scurtează durata.</p>
      ) : (
        <div className="space-y-1.5">
          {slots.map(s => {
            const inSlot = (bookings || []).filter(b => b.slot_from === s.from)
            const full = inSlot.length >= capacity
            return (
              <div key={s.from} className={`flex items-start gap-3 rounded-lg border px-3 py-2 text-xs ${
                full ? 'border-red-300 bg-red-50/60' : inSlot.length ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                <span className="font-semibold text-gray-800 whitespace-nowrap">{s.from}–{s.to}</span>
                <span className="flex-1 text-gray-600">
                  {inSlot.length ? inSlot.map(b => nameOf(b.student_id)).join(', ') : <span className="text-gray-300">liber</span>}
                </span>
                <span className={`whitespace-nowrap font-medium ${full ? 'text-red-600' : 'text-gray-400'}`}>
                  {inSlot.length}/{capacity}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
