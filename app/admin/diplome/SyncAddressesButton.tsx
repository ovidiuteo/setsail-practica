'use client'
import React, { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Loader2, RefreshCw } from 'lucide-react'
import { Diploma } from '@/lib/diplomas'

// Sincronizează adresele de pe diplome cu profilurile cursanților.
// Folosit când diplomele au fost generate ÎNAINTE de „Normalizare adrese" pe sesiune:
// profilul are acum adresa curată, diploma a rămas cu varianta veche.
// Cursantul se găsește prin student_id sau, în lipsă, după CNP.

type SyncChange = {
  id: string
  full_name: string
  series: string
  number: number
  address_before: string
  address_after: string
  city_before: string
  city_after: string
}

export default function SyncAddressesButton({ diplomas, onSaved }: {
  diplomas: Diploma[]
  onSaved: () => void
}) {
  const [changes, setChanges] = useState<SyncChange[] | null>(null)
  const [busy, setBusy] = useState(false)

  async function compute() {
    setBusy(true)
    const active = diplomas.filter(d => d.status === 1)
    const studentIds = Array.from(new Set(active.map(d => d.student_id).filter(Boolean))) as string[]
    const cnps = Array.from(new Set(active.filter(d => !d.student_id && d.cnp).map(d => d.cnp))) as string[]

    const byId: Record<string, any> = {}
    const byCnp: Record<string, any> = {}
    if (studentIds.length) {
      const { data } = await supabase.from('students').select('id, cnp, address, city, county').in('id', studentIds)
      for (const st of data || []) byId[st.id] = st
    }
    if (cnps.length) {
      const { data } = await supabase.from('students').select('id, cnp, address, city, county').in('cnp', cnps)
      for (const st of data || []) byCnp[st.cnp] = st
    }

    const found: SyncChange[] = []
    for (const d of active) {
      const st = (d.student_id && byId[d.student_id]) || (d.cnp && byCnp[d.cnp]) || null
      if (!st) continue
      const addressAfter = (st.address || '').trim()
      const cityAfter = [st.city, st.county].filter(Boolean).map((p: string) => p.trim()).join(', ')
      const addressBefore = (d.address || '').trim()
      const cityBefore = (d.city || '').trim()
      if (addressAfter !== addressBefore || cityAfter !== cityBefore) {
        found.push({
          id: d.id, full_name: d.full_name, series: d.series, number: d.number,
          address_before: addressBefore, address_after: addressAfter,
          city_before: cityBefore, city_after: cityAfter,
        })
      }
    }
    setBusy(false)
    if (found.length === 0) { alert('Toate diplomele au adresele sincronizate cu profilurile cursanților.'); return }
    setChanges(found)
  }

  async function apply() {
    if (!changes) return
    setBusy(true)
    for (const ch of changes) {
      const { error } = await supabase.from('diplomas')
        .update({ address: ch.address_after || null, city: ch.city_after || null })
        .eq('id', ch.id)
      if (error) { alert('Eroare: ' + error.message); setBusy(false); return }
    }
    setBusy(false)
    setChanges(null)
    onSaved()
  }

  return (
    <>
      <button onClick={compute} disabled={busy}
        title="Preia adresa și orașul din profilurile cursanților pe diplomele existente"
        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white disabled:opacity-50">
        {busy && !changes ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        Sincronizează adrese
      </button>

      {changes && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && setChanges(null)}>
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-sm text-gray-900">Sincronizare adrese — {changes.length} diplome de actualizat</h3>
              <p className="text-xs text-gray-500">Adresa și orașul se preiau din profilul cursantului. Verifică și aplică.</p>
            </div>
            <div className="overflow-auto px-5 py-3 flex-1">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3">Diplomă</th>
                    <th className="py-2 pr-3">Adresă</th>
                    <th className="py-2">Oraș, județ</th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map(ch => (
                    <tr key={ch.id} className="border-b border-gray-50 align-top">
                      <td className="py-2 pr-3 whitespace-nowrap">
                        <span className="font-mono text-gray-500">{ch.series} {ch.number}</span>{' '}
                        <span className="font-medium text-gray-900">{ch.full_name}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {ch.address_before !== ch.address_after ? (
                          <>
                            <div className="text-red-500 line-through">{ch.address_before || '—'}</div>
                            <div className="text-emerald-700">{ch.address_after || '—'}</div>
                          </>
                        ) : <span className="text-gray-400">{ch.address_before || '—'}</span>}
                      </td>
                      <td className="py-2">
                        {ch.city_before !== ch.city_after ? (
                          <>
                            <div className="text-red-500 line-through">{ch.city_before || '—'}</div>
                            <div className="text-emerald-700">{ch.city_after || '—'}</div>
                          </>
                        ) : <span className="text-gray-400">{ch.city_before || '—'}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setChanges(null)} disabled={busy}
                className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
                Anulează
              </button>
              <button onClick={apply} disabled={busy}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#059669' }}>
                {busy ? 'Se aplică...' : `Aplică ${changes.length} modificări`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
