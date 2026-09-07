'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, Loader2, X } from 'lucide-react'
import { slotDateLabel } from '@/lib/practice-slots'

// Programarea cursantului la un interval de practică (curs C/D Snagov).
// Verde deschis = liber; cu cât se ocupă, cu atât verdele e mai închis;
// plin = chenar roșu și „Interval ocupat".

type Slot = { from: string; to: string; taken: number; full: boolean }
type State = {
  config: { enabled: boolean; date: string | null }
  capacity: number
  date: string | null
  slots: Slot[]
  mine: { from: string; to: string } | null
}

// gol = verde deschis; pe măsură ce se ocupă, verdele se închide în patru trepte
const EMPTY = 'bg-green-50 border-green-200'
const SHADES = ['bg-green-100 border-green-300', 'bg-green-200 border-green-400',
  'bg-green-300 border-green-500', 'bg-green-400 border-green-600']

function shade(taken: number, capacity: number): string {
  if (taken <= 0) return EMPTY
  const step = Math.min(SHADES.length, Math.max(1, Math.ceil((taken / Math.max(1, capacity)) * SHADES.length)))
  return SHADES[step - 1]
}

export default function PracticeBooking({ studentId, accessCode }: { studentId: string; accessCode: string }) {
  const [st, setSt] = useState<State | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const r = await fetch(`/api/practice-booking?student_id=${studentId}&access_code=${encodeURIComponent(accessCode)}`)
    if (!r.ok) { setSt(null); return }
    setSt(await r.json())
  }, [studentId, accessCode])
  useEffect(() => { load() }, [load])

  async function book(s: Slot) {
    if (st?.mine?.from === s.from) return
    if (s.full) return
    const zi = slotDateLabel(st?.date)
    if (!confirm(`Confirmați intervalul de practică ${s.from}–${s.to} h, în ziua de ${zi}?`)) return
    setBusy(s.from); setErr(null)
    const r = await fetch('/api/practice-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, access_code: accessCode, slot_from: s.from }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setErr(j.error || 'Programarea nu a reușit.'); load(); return }
    setSt(j)
  }
  async function cancel() {
    if (!confirm('Anulați programarea la practică?')) return
    setBusy('cancel'); setErr(null)
    const r = await fetch('/api/practice-booking', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, access_code: accessCode }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (r.ok) setSt(j)
  }

  // Cât timp administratorul n-a deschis programarea, cardul nu apare deloc
  if (!st || !st.config.enabled || !st.date || !st.slots.length) return null

  return (
    <div className="bg-white rounded-2xl p-6 shadow-2xl">
      <h2 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
        <CalendarClock size={17} className="text-[#0a1628]" /> Programare la practică
      </h2>
      <p className="text-xs text-gray-400 mb-4">
        Ziua de practică: <b className="text-gray-600">{slotDateLabel(st.date)}</b>.
        Alegeți un interval — {st.capacity} {st.capacity === 1 ? 'loc' : 'locuri'} pe interval.
      </p>

      {st.mine && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5">
          <Check size={15} className="text-blue-600 shrink-0" />
          <span className="text-sm text-blue-900 flex-1">
            Sunteți programat la <b>{st.mine.from}–{st.mine.to}</b>. Puteți alege alt interval oricând.
          </span>
          <button onClick={cancel} disabled={busy === 'cancel'}
            className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-100 disabled:opacity-50">
            <X size={12} /> Anulează
          </button>
        </div>
      )}

      {err && <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {st.slots.map(s => {
          const mine = st.mine?.from === s.from
          const libere = Math.max(0, st.capacity - s.taken)
          return (
            <button key={s.from} onClick={() => book(s)} disabled={busy === s.from || (s.full && !mine)}
              className={`rounded-xl border-2 px-3 py-3 text-left transition-all disabled:cursor-not-allowed ${
                mine ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : s.full ? 'border-red-400 bg-red-50/60'
                : `${shade(s.taken, st.capacity)} hover:brightness-95`}`}>
              <div className="text-sm font-bold text-gray-900">{s.from}–{s.to}</div>
              <div className="text-[11px] mt-0.5">
                {busy === s.from ? <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> se salvează…</span>
                  : mine ? <span className="text-blue-700 font-medium">Programarea ta</span>
                  : s.full ? <span className="text-red-600 font-semibold">Interval ocupat</span>
                  : <span className="text-gray-600">{libere} {libere === 1 ? 'loc liber' : 'locuri libere'}</span>}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
