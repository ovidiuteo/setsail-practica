'use client'
import { useCallback, useEffect, useState } from 'react'
import { CalendarClock, Check, Loader2, X } from 'lucide-react'
import { slotDateLabel } from '@/lib/practice-slots'

// Programarea cursantului la un interval de practică (curs C/D Snagov).
// Verde deschis = liber; cu cât se ocupă, cu atât verdele e mai închis;
// plin = chenar roșu și „Interval ocupat".

type Slot = { from: string; to: string; taken: number; full: boolean }
type Incoming = { id: string; from: string; to: string; date: string; requester: string }
type State = {
  config: { enabled: boolean; date: string | null }
  capacity: number
  date: string | null
  slots: Slot[]
  mine: { from: string; to: string } | null
  myRequest: { id: string; from: string; to: string; status: string; date: string; declined: number; waiting: number } | null
  incoming: Incoming | null
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
  const [urgentFor, setUrgentFor] = useState<Slot | null>(null)  // modalul de urgență
  const [sent, setSent] = useState(false)                        // confirmarea trimiterii
  const [picking, setPicking] = useState(false)                  // colegul își alege alt interval

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
  // ── Cerere de urgență pe un interval plin ──
  async function sendUrgent() {
    if (!urgentFor) return
    setBusy('urgent'); setErr(null)
    const r = await fetch('/api/practice-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, access_code: accessCode, action: 'swap_request', slot_from: urgentFor.from }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(null); setUrgentFor(null)
    if (!r.ok) { setErr(j.error || 'Cererea nu a putut fi trimisă.'); return }
    setSt(j); setSent(true)
  }

  // ── Răspunsul meu la cererea unui coleg ──
  async function answer(no: true): Promise<void>
  async function answer(no: false, newSlot: string): Promise<void>
  async function answer(no: boolean, newSlot?: string) {
    if (!st?.incoming) return
    setBusy('answer'); setErr(null)
    const r = await fetch('/api/practice-booking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId, access_code: accessCode, action: 'swap_answer',
        request_id: st.incoming.id, answer: no ? 'no' : 'yes', new_slot_from: newSlot,
      }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (!r.ok) { setErr(j.error || 'Răspunsul nu a putut fi salvat.'); load(); return }
    setPicking(false); setSt(j)
  }

  async function cancelRequest() {
    setBusy('cancelreq'); setErr(null)
    const r = await fetch('/api/practice-booking', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, access_code: accessCode, action: 'cancel_request' }),
    })
    const j = await r.json().catch(() => ({}))
    setBusy(null)
    if (r.ok) setSt(j)
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

      {/* Cererea mea de urgență, cu numărul de refuzuri și de răspunsuri așteptate */}
      {st.myRequest?.status === 'pending' && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>Cerere de urgență trimisă pentru <b>{st.myRequest.from}–{st.myRequest.to}</b>.</span>
            <span className="font-semibold">
              {st.myRequest.declined} {st.myRequest.declined === 1 ? 'refuz' : 'refuzuri'} · {st.myRequest.waiting} pending
            </span>
            <button onClick={cancelRequest} disabled={busy === 'cancelreq'} className="underline text-amber-700 hover:text-amber-900 text-xs">
              retrage cererea
            </button>
          </div>
          {st.myRequest.waiting === 0 && (
            <p className="mt-1 text-xs text-amber-800">
              Toți colegii din interval au refuzat. Puteți retrage cererea și alege un interval liber.
            </p>
          )}
        </div>
      )}
      {st.myRequest?.status === 'accepted' && st.mine?.from === st.myRequest.from && (
        <div className="mb-4 rounded-xl border border-green-300 bg-green-50 px-3 py-2.5 text-sm text-green-900">
          Un coleg v-a cedat locul — sunteți programat la <b>{st.myRequest.from}–{st.myRequest.to}</b>.
        </div>
      )}

      {/* Cererea unui coleg, la care trebuie să răspund */}
      {st.incoming && (
        <div className="mb-4 rounded-xl border-2 border-amber-400 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-900 leading-relaxed">
            Colegul dvs. <b>{st.incoming.requester}</b> nu poate participa la practică decât în intervalul{' '}
            <b>{st.incoming.from}–{st.incoming.to}</b>, din ziua <b>{slotDateLabel(st.incoming.date)}</b>.
            Vă permite programul să îi cedați locul și să alegeți alt interval pentru practica dvs.?
          </p>
          {!picking ? (
            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <button onClick={() => answer(true)} disabled={busy === 'answer'}
                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
                NU, AM PROGRAMUL FIX
              </button>
              <button onClick={() => setPicking(true)} disabled={busy === 'answer'}
                className="flex-1 px-3 py-2.5 rounded-xl text-xs font-bold text-white bg-green-600 hover:bg-green-700 disabled:opacity-60">
                DA, POT ALEGE ALT INTERVAL
              </button>
            </div>
          ) : (
            <p className="mt-3 text-xs font-medium text-amber-800">
              Alegeți mai jos intervalul în care vă mutați — locul dvs. îi revine colegului.
              <button onClick={() => setPicking(false)} className="ml-2 underline font-normal">renunț</button>
            </p>
          )}
        </div>
      )}

      {err && <p className="mb-3 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{err}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {st.slots.map(s => {
          const mine = st.mine?.from === s.from
          const libere = Math.max(0, st.capacity - s.taken)
          const linie = (
            <>
              <div className="text-sm font-bold text-gray-900">{s.from}–{s.to}</div>
              <div className="text-[11px] mt-0.5">
                {busy === s.from ? <span className="text-gray-500 flex items-center gap-1"><Loader2 size={10} className="animate-spin" /> se salvează…</span>
                  : mine ? <span className="text-blue-700 font-medium">Programarea ta</span>
                  : s.full ? <span className="text-red-600 font-semibold">Interval ocupat</span>
                  : <span className="text-gray-600">{libere} {libere === 1 ? 'loc liber' : 'locuri libere'}</span>}
              </div>
            </>
          )

          // Interval plin: nu se poate rezerva, dar la hover apare „Urgență".
          // Dacă am deja o cerere trimisă pe el, în locul butonului stă eticheta „pending".
          const asteapta = st.myRequest?.status === 'pending' && st.myRequest.from === s.from
          if (s.full && !mine) return (
            <div key={s.from} className="group relative rounded-xl border-2 border-red-400 bg-red-50/60 px-3 py-3">
              {linie}
              {asteapta ? (
                <span title={`${st.myRequest!.declined} refuzuri · ${st.myRequest!.waiting} în așteptare`}
                  className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-lg bg-amber-400 text-amber-950 text-[10px] font-bold uppercase tracking-wide">
                  pending {st.myRequest!.waiting}
                </span>
              ) : !picking && (
                <button onClick={() => { setUrgentFor(s); setErr(null) }}
                  className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide
                             opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-700">
                  Urgență
                </button>
              )}
            </div>
          )

          return (
            <button key={s.from} onClick={() => picking ? answer(false, s.from) : book(s)} disabled={busy === s.from || (picking && mine)}
              className={`rounded-xl border-2 px-3 py-3 text-left transition-all disabled:cursor-not-allowed ${
                mine ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                : `${shade(s.taken, st.capacity)} hover:brightness-95`}`}>
              {linie}
            </button>
          )
        })}
      </div>

      {/* Modal: trimiterea cererii de urgență */}
      {urgentFor && (
        <Modal onClose={() => setUrgentFor(null)}>
          <p className="text-sm text-gray-700 leading-relaxed">
            Sesiunea este ocupată integral. Dacă aveți o urgență și nu puteți ajunge decât în acel interval
            puteți trimite o solicitare colegilor pentru a vă ceda locul, în funcție și de programul lor.
            <b className="block mt-2 text-gray-900">Trimiteți cererea de urgență?</b>
          </p>
          <div className="mt-5 flex gap-2 justify-end">
            <button onClick={() => setUrgentFor(null)}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">Nu</button>
            <button onClick={sendUrgent} disabled={busy === 'urgent'}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60">
              {busy === 'urgent' ? 'Se trimite…' : 'Da, trimite'}
            </button>
          </div>
        </Modal>
      )}

      {/* Modal: confirmarea trimiterii */}
      {sent && (
        <Modal onClose={() => setSent(false)}>
          <p className="text-sm text-gray-700 leading-relaxed">
            Cererea dvs. a fost trimisă colegilor, reveniți în portal pentru verificarea rezultatului.
          </p>
          <div className="mt-5 flex justify-end">
            <button onClick={() => setSent(false)}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: '#0a1628' }}>Am înțeles</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={onClose} className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-xl w-full max-w-md p-5">
        {children}
      </div>
    </div>
  )
}
