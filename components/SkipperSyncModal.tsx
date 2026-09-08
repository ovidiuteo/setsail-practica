'use client'
import type { SyncResult } from '@/lib/skipper-result'

// Rezultatul sincronizării cu grupa de pe skipper. Se deschide singur după
// sincronizare (butonul nu cere confirmare, doar raportează la final).
export default function SkipperSyncModal({ rezultat, eroare, onClose }: {
  rezultat?: SyncResult | null
  eroare?: string | null
  onClose: () => void
}) {
  if (!rezultat && !eroare) return null
  const n = rezultat?.adaugati.length || 0

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">Sincronizare cu skipper</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
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
          <button onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-900 hover:bg-gray-50">
            Închide
          </button>
        </div>
      </div>
    </div>
  )
}
