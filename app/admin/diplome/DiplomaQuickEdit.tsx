'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, Save, X } from 'lucide-react'
import { Diploma, DiplomaCategory, DIPLOMA_CATEGORIES } from '@/lib/diplomas'
import DateInputRO from './DateInputRO'

// Editare rapidă a diplomelor, comună paginilor /admin/diplome și /admin/diplome/coada:
//  - DiplomaEditModal: click pe nume → modal cu datele diplomei
//  - InlineNumber: click pe număr → editare pe loc
// La modificarea datelor de persoană (nume/adresă/oraș) sau a numărului, un dialog
// cu trei opțiuni decide: La toate diplomele cursantului / Doar aici / Anulează.

// Diplomele aceluiași cursant (fără cea curentă): după student_id, CNP sau nume.
// Interogări separate + dedup — numele conține virgulă și ar strica sintaxa or().
async function fetchPersonDiplomas(d: Diploma): Promise<Diploma[]> {
  const queries = []
  if (d.student_id) queries.push(supabase.from('diplomas').select('*').eq('student_id', d.student_id).eq('status', 1))
  if (d.cnp) queries.push(supabase.from('diplomas').select('*').eq('cnp', d.cnp).eq('status', 1))
  if (!queries.length) queries.push(supabase.from('diplomas').select('*').eq('full_name', d.full_name).eq('status', 1))
  const results = await Promise.all(queries)
  const byId: Record<string, Diploma> = {}
  for (const { data } of results) for (const row of (data || []) as Diploma[]) byId[row.id] = row
  delete byId[d.id]
  return Object.values(byId)
}

// Renumerotare cu păstrarea diferenței. Ordinea actualizărilor evită coliziunile
// cu constraint-ul unique pe number (delta pozitiv → întâi numerele mari).
async function applyNumberShift(targets: { id: string; old: number }[], delta: number) {
  const sorted = [...targets].sort((a, b) => delta > 0 ? b.old - a.old : a.old - b.old)
  for (const t of sorted) {
    const { error } = await supabase.from('diplomas').update({ number: t.old + delta }).eq('id', t.id)
    if (error) throw new Error(`Numărul ${t.old + delta} nu a putut fi setat: ${error.message}`)
  }
}

// ── Dialog cu opțiuni multiple (înlocuiește confirm-ul nativ OK/Cancel) ──
// „Anulează" e mereu prezent; restul butoanelor sunt configurabile per întrebare.

type ChoiceOption = { key: string; label: string; primary?: boolean }
type ChoiceState = { message: string; options: ChoiceOption[]; resolve: (c: string) => void } | null

function useChoiceDialog() {
  const [state, setState] = useState<ChoiceState>(null)

  function ask(message: string, options: ChoiceOption[]): Promise<string> {
    return new Promise<string>(resolve => setState({ message, options, resolve }))
  }

  function pick(c: string) {
    state?.resolve(c)
    setState(null)
  }

  const dialog = state ? (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => pick('cancel')}>
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
        <p className="text-sm text-gray-800 whitespace-pre-line">{state.message}</p>
        <div className="mt-4 flex justify-end gap-2 flex-wrap">
          <button onClick={() => pick('cancel')}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
            Anulează
          </button>
          {state.options.map(o => (
            <button key={o.key} onClick={() => pick(o.key)}
              className={o.primary
                ? 'px-4 py-1.5 rounded-lg text-xs font-medium text-white'
                : 'px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-300 text-gray-700 hover:bg-gray-50'}
              style={o.primary ? { background: '#0a1628' } : undefined}>
              {o.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  return { ask, dialog }
}

// Schimbă numărul unei diplome; dacă cursantul mai are diplome, întreabă prin `ask`.
// Returnează false dacă utilizatorul a anulat.
async function changeNumber(
  diploma: Diploma,
  newNumber: number,
  ask: (message: string, options: ChoiceOption[]) => Promise<string>,
): Promise<boolean> {
  const delta = newNumber - diploma.number
  if (!delta) return true
  const others = await fetchPersonDiplomas(diploma)
  let targets = [{ id: diploma.id, old: diploma.number }]
  if (others.length > 0) {
    const list = others.map(o => `${o.series} ${o.number}`).join(', ')
    const choice = await ask(
      `Cursantul mai are ${others.length} diplome (${list}).\nRenumerotezi toate diplomele păstrând diferența față de noul număr, sau doar diploma curentă?`,
      [
        { key: 'only', label: 'Doar aici' },
        { key: 'all', label: `La toate (${others.length + 1})`, primary: true },
      ],
    )
    if (choice === 'cancel') return false
    if (choice === 'all') targets = targets.concat(others.map(o => ({ id: o.id, old: o.number })))
  }
  await applyNumberShift(targets, delta)
  return true
}

export function InlineNumber({ diploma, onSaved }: { diploma: Diploma; onSaved: () => void }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)
  const { ask, dialog } = useChoiceDialog()

  async function commit() {
    const n = parseInt(val, 10)
    if (isNaN(n) || n === diploma.number) { setEditing(false); return }
    setBusy(true)
    try {
      const done = await changeNumber(diploma, n, ask)
      if (done) onSaved()
    } catch (e: any) {
      alert(e.message || e)
    }
    setBusy(false)
    setEditing(false)
  }

  if (busy) return <>{dialog}<Loader2 size={13} className="animate-spin text-gray-400" /></>
  if (editing) {
    return (
      <>
        {dialog}
        <input
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value.replace(/\D/g, ''))}
          onBlur={commit}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
          className="w-20 px-1.5 py-0.5 rounded border border-amber-400 text-sm font-mono focus:outline-none"
        />
      </>
    )
  }
  return (
    <button
      onClick={() => { setVal(String(diploma.number)); setEditing(true) }}
      title="Click pentru a edita numărul"
      className="font-mono font-semibold text-gray-900 hover:text-amber-600 hover:underline decoration-dotted"
    >
      {diploma.number}
    </button>
  )
}

export function DiplomaEditModal({ diploma, onClose, onSaved }: {
  diploma: Diploma; onClose: () => void; onSaved: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [number, setNumber] = useState(String(diploma.number))
  const [series, setSeries] = useState<DiplomaCategory>(diploma.series)
  const [fullName, setFullName] = useState(diploma.full_name)
  const [address, setAddress] = useState(diploma.address || '')
  const [city, setCity] = useState(diploma.city || '')
  const [cnp, setCnp] = useState(diploma.cnp || '')
  const [practiceLocation, setPracticeLocation] = useState(diploma.practice_location || '')
  const [practiceDate, setPracticeDate] = useState(diploma.practice_date || '')
  const { ask, dialog } = useChoiceDialog()

  async function save() {
    const n = parseInt(number, 10)
    if (!fullName.trim() || isNaN(n)) { alert('Numărul și numele sunt obligatorii.'); return }
    setBusy(true)
    try {
      // Câmpurile de persoană modificate → La toate / Doar aici / Anulează
      const personPatch: Record<string, any> = {}
      if (fullName.trim() !== diploma.full_name) personPatch.full_name = fullName.trim()
      if ((address.trim() || null) !== (diploma.address || null)) personPatch.address = address.trim() || null
      if ((city.trim() || null) !== (diploma.city || null)) personPatch.city = city.trim() || null

      if (Object.keys(personPatch).length > 0) {
        const others = await fetchPersonDiplomas(diploma)
        // Profilul de cursant legat de diplomă (după student_id sau, în lipsă, după CNP)
        let studentId = diploma.student_id
        if (!studentId && diploma.cnp) {
          const { data: st } = await supabase.from('students').select('id').eq('cnp', diploma.cnp).limit(1).maybeSingle()
          studentId = st?.id || null
        }

        if (others.length > 0 || studentId) {
          const list = others.length ? ` (${others.map(o => `${o.series} ${o.number}`).join(', ')})` : ''
          const options: ChoiceOption[] = []
          options.push({ key: 'only', label: 'Doar aici' })
          if (others.length > 0) options.push({ key: 'alldiplomas', label: `Doar diplome, toate (${others.length + 1})` })
          if (studentId) options.push({ key: 'everywhere', label: 'Da, peste tot', primary: true })

          const choice = await ask(
            `Ai modificat datele de persoană.\nCursantul${others.length ? ` mai are ${others.length} diplome${list}` : ''}${others.length && studentId ? ' și' : ''}${studentId ? ' are profil de cursant în aplicație' : ''}.\nUnde aplici modificarea?`,
            options,
          )
          if (choice === 'cancel') { setBusy(false); return }
          if ((choice === 'alldiplomas' || choice === 'everywhere') && others.length > 0) {
            const { error } = await supabase.from('diplomas').update(personPatch).in('id', others.map(o => o.id))
            if (error) throw new Error(error.message)
          }
          if (choice === 'everywhere' && studentId) {
            // Profilul are oraș și județ separate — diploma le ține combinate "Oraș, Județ"
            const studentPatch: Record<string, any> = {}
            if (personPatch.full_name) studentPatch.full_name = personPatch.full_name
            if ('address' in personPatch) studentPatch.address = personPatch.address
            if ('city' in personPatch) {
              const parts = (personPatch.city || '').split(',').map((p: string) => p.trim())
              studentPatch.city = parts[0] || null
              studentPatch.county = parts.slice(1).join(', ') || null
            }
            const { error } = await supabase.from('students').update(studentPatch).eq('id', studentId)
            if (error) throw new Error('Profil cursant: ' + error.message)
          }
        }
      }

      // Diploma curentă (fără număr — el se schimbă separat, cu logica de renumerotare)
      const { error } = await supabase.from('diplomas').update({
        series,
        full_name: fullName.trim(),
        address: address.trim() || null,
        city: city.trim() || null,
        cnp: cnp.trim() || null,
        practice_location: practiceLocation.trim() || null,
        practice_date: practiceDate || null,
      }).eq('id', diploma.id)
      if (error) throw new Error(error.message)

      if (n !== diploma.number) {
        const done = await changeNumber(diploma, n, ask)
        if (!done) {
          // numărul a fost anulat, dar restul câmpurilor s-au salvat deja
          onSaved()
          setBusy(false)
          return
        }
      }

      onSaved()
      onClose()
    } catch (e: any) {
      alert('Eroare: ' + (e.message || e))
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      {dialog}
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full" onClick={e => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">
            Diploma {diploma.series} nr. {diploma.number}
          </h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100"><X size={14} /></button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3">
          <Field label="Număr">
            <input value={number} onChange={e => setNumber(e.target.value.replace(/\D/g, ''))} className={inputCls} />
          </Field>
          <Field label="Serie">
            <select value={series} onChange={e => setSeries(e.target.value as DiplomaCategory)} className={inputCls}>
              {DIPLOMA_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          <div className="col-span-2">
            <Field label="Nume complet">
              <input value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="col-span-2">
            <Field label="Adresă (stradă, număr)">
              <input value={address} onChange={e => setAddress(e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Oraș, județ">
            <input value={city} onChange={e => setCity(e.target.value)} className={inputCls} />
          </Field>
          <Field label="CNP">
            <input value={cnp} onChange={e => setCnp(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Locația probei practice">
            <input value={practiceLocation} onChange={e => setPracticeLocation(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Data probei practice">
            <DateInputRO value={practiceDate} onChange={setPracticeDate} className={inputCls} />
          </Field>
        </div>
        <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} disabled={busy}
            className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
            Anulează
          </button>
          <button onClick={save} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
            style={{ background: '#0a1628' }}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvează
          </button>
        </div>
      </div>
    </div>
  )
}

const inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  )
}
