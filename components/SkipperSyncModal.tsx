'use client'
import { useState } from 'react'
import type { SyncResult } from '@/lib/skipper-result'

// Rezultatul sincronizării cu grupa de pe skipper. Se deschide singur după
// sincronizare (butonul nu cere confirmare, doar raportează la final).
// Cei care nu mai sunt pe skipper se șterg la închiderea modalului, dacă nu s-a
// bifat „undo" — până atunci nu s-a atins nimic, deci undo e gratuit.
export default function SkipperSyncModal({ rezultat, eroare, onClose, onSterge }: {
  rezultat?: SyncResult | null
  eroare?: string | null
  onClose: () => void
  onSterge?: (ids: string[]) => void | Promise<void>
}) {
  const [undo, setUndo] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!rezultat && !eroare) return null
  const n = rezultat?.adaugati.length || 0
  const deSters = rezultat?.de_sters || []

  async function inchide() {
    if (deSters.length && !undo && onSterge) {
      setBusy(true)
      await onSterge(deSters.map(x => x.id))
      setBusy(false)
    }
    setUndo(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      // cu ștergeri în așteptare se închide doar din buton, ca să fie limpede ce urmează
      onClick={e => { if (e.target === e.currentTarget && !deSters.length) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">Sincronizare cu skipper</h3>
          <button onClick={inchide} disabled={busy} className="text-gray-400 hover:text-gray-700 text-xl leading-none disabled:opacity-50">×</button>
        </div>

        <div className="p-5">
          {eroare ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{eroare}</div>
          ) : rezultat && (
            <>
              <div className={`text-lg font-semibold ${n ? 'text-emerald-700' : 'text-gray-700'}`}>
                {n === 0 ? 'Zero cursanți noi'
                  : n === 1 ? 'Un cursant nou adăugat'
                  : `${n} cursanți noi adăugați`}
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Grupa {rezultat.grupa} · {rezultat.total_skipper} cursanți pe skipper
                {rezultat.dry_run ? ' · test, nu s-a scris nimic' : ''}
              </p>

              {n > 0 && (
                <ul className="mt-3 space-y-1">
                  {rezultat.adaugati.map(nume => (
                    <li key={nume} className="text-sm text-gray-800 flex items-start gap-1.5">
                      <span className="text-emerald-600">+</span>{nume}
                    </li>
                  ))}
                </ul>
              )}

              {/* Cei care nu mai sunt pe skipper */}
              {deSters.length > 0 && (
                <div className={`mt-4 rounded-lg border p-3 ${undo ? 'border-gray-200 bg-gray-50' : 'border-red-200 bg-red-50'}`}>
                  <div className={`text-sm font-semibold ${undo ? 'text-gray-600' : 'text-red-700'}`}>
                    {undo
                      ? `${deSters.length} ${deSters.length === 1 ? 'cursant păstrat' : 'cursanți păstrați'}`
                      : `${deSters.length} ${deSters.length === 1 ? 'cursant eliminat' : 'cursanți eliminați'}`}
                  </div>
                  <ul className="mt-2 space-y-1">
                    {deSters.map(s => (
                      <li key={s.id} className={`text-sm flex items-start gap-1.5 ${undo ? 'text-gray-500' : 'text-red-900'}`}>
                        <span>{undo ? '·' : '−'}</span>{s.full_name}
                      </li>
                    ))}
                  </ul>
                  <label className="mt-3 flex items-start gap-2 text-xs cursor-pointer select-none">
                    <input type="checkbox" checked={undo} onChange={e => setUndo(e.target.checked)}
                      className="mt-0.5 w-3.5 h-3.5 accent-gray-600 cursor-pointer" />
                    <span className={undo ? 'text-gray-700' : 'text-red-800'}>
                      <b>UNDO</b> — păstrează-i în serie
                      <span className="block text-gray-500 mt-0.5">
                        {undo
                          ? 'Rămân în listă; nu se șterge nimic.'
                          : 'Nebifat: la închidere sunt scoși din serie. Cine mai e înscris în altă serie rămâne acolo; cine era doar aici dispare din sistem.'}
                      </span>
                    </span>
                  </label>
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1 text-xs text-gray-500">
                {rezultat.existau.length > 0 && (
                  <div>{rezultat.existau.length} erau deja în listă</div>
                )}
                {rezultat.preluati.length > 0 && (
                  <div>
                    Pentru {rezultat.preluati.length} am preluat datele și documentele din sistem
                    (erau deja înscriși în altă serie).
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
          <button onClick={inchide} disabled={busy}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-50">
            {busy ? 'Se aplică…'
              : deSters.length && !undo ? `Închide și elimină ${deSters.length}`
              : 'Închide'}
          </button>
        </div>
      </div>
    </div>
  )
}
