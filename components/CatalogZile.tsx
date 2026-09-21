'use client'
import { useMemo, useState } from 'react'
import { X, Check } from 'lucide-react'

// Zilele care intră în foaia de prezență: calendarul lunii (sau al celor două luni,
// dacă seria trece dintr-o lună în alta), cu toate zilele dintre începutul cursului
// și proba practică bifate. Se dau jos cu un click.
// Ziua se scrie pe catalog „Luni, 21.09".

export const ziISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function dinISO(s: string): Date | null {
  const [y, m, d] = String(s || '').slice(0, 10).split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : null
}

// „Luni, 21.09"
export function etichetaZi(iso: string): string {
  const d = dinISO(iso)
  if (!d) return iso
  const zi = d.toLocaleDateString('ro-RO', { weekday: 'long' })
  return `${zi.charAt(0).toLocaleUpperCase('ro-RO')}${zi.slice(1)}, ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Toate zilele dintre start și final (inclusiv)
export function zileIntre(start: string | null | undefined, final: string | null | undefined): string[] {
  const a = dinISO(start || ''), b = dinISO(final || '')
  if (!a || !b || b < a) return []
  const out: string[] = []
  for (const t = new Date(a); t <= b && out.length < 120; t.setDate(t.getDate() + 1)) out.push(ziISO(t))
  return out
}

const LUNI_RO = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']

export default function CatalogZile({ start, final, alese, onSalveaza, onClose, titlu, setTitlu, grupa, setGrupa }: {
  start: string | null | undefined
  final: string | null | undefined
  alese: string[]
  onSalveaza: (zile: string[]) => Promise<void> | void
  onClose: () => void
  titlu?: string
  setTitlu?: (v: string) => void
  grupa?: string
  setGrupa?: (v: string) => void
}) {
  const toate = useMemo(() => zileIntre(start, final), [start, final])
  const [sel, setSel] = useState<Set<string>>(new Set(alese.length ? alese : toate))
  const [salvez, setSalvez] = useState(false)

  // lunile acoperite de serie (una sau două)
  const luni = useMemo(() => {
    const chei = Array.from(new Set(toate.map(z => z.slice(0, 7))))
    return chei.map(cheie => {
      const [y, m] = cheie.split('-').map(Number)
      const zileLuna: string[] = []
      const nrZile = new Date(y, m, 0).getDate()
      for (let d = 1; d <= nrZile; d++) zileLuna.push(ziISO(new Date(y, m - 1, d)))
      // calendarul începe luni
      const prima = new Date(y, m - 1, 1).getDay()
      return { cheie, nume: `${LUNI_RO[m - 1]} ${y}`, gol: (prima + 6) % 7, zile: zileLuna }
    })
  }, [toate])

  function comuta(z: string) {
    if (!toate.includes(z)) return
    setSel(s => { const n = new Set(s); n.has(z) ? n.delete(z) : n.add(z); return n })
  }

  const alesOrdonat = toate.filter(z => sel.has(z))

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg my-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900">Setări catalog</h3>
            <p className="text-xs text-gray-400">Zilele bifate apar ca coloane pe foaia de prezență.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
        </div>

        <div className="p-5 space-y-4">
          {setTitlu && (
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Titlu</span>
              <input value={titlu || ''} onChange={e => setTitlu(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></label>
          )}
          {setGrupa && (
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Grupă</span>
              <input value={grupa || ''} onChange={e => setGrupa(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" /></label>
          )}

          {toate.length === 0 ? (
            <p className="text-sm text-gray-400">Seria nu are dată de început și dată de practică, așa că nu pot propune zile.</p>
          ) : luni.map(l => (
            <div key={l.cheie}>
              <div className="text-xs font-semibold text-gray-600 mb-1.5 capitalize">{l.nume}</div>
              <div className="grid grid-cols-7 gap-1 text-center">
                {['L', 'Ma', 'Mi', 'J', 'V', 'S', 'D'].map(z => (
                  <div key={z} className="text-[10px] text-gray-400 py-0.5">{z}</div>
                ))}
                {Array.from({ length: l.gol }).map((_, i) => <div key={'g' + i} />)}
                {l.zile.map(z => {
                  const inInterval = toate.includes(z)
                  const bifat = sel.has(z)
                  return (
                    <button key={z} type="button" onClick={() => comuta(z)} disabled={!inInterval}
                      title={inInterval ? etichetaZi(z) : 'În afara perioadei cursului'}
                      className={`h-8 rounded-lg text-xs font-medium border transition-colors ${
                        !inInterval ? 'border-transparent text-gray-300'
                          : bifat ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                      {Number(z.slice(8, 10))}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="text-xs text-gray-500">
            {alesOrdonat.length
              ? <>Pe catalog: {alesOrdonat.map(etichetaZi).join(' · ')}</>
              : 'Nicio zi bifată — catalogul iese fără coloane de zile.'}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
          <button onClick={() => setSel(new Set(toate))} className="px-3 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Toate zilele</button>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600 hover:bg-gray-50">Renunță</button>
          <button onClick={async () => { setSalvez(true); try { await onSalveaza(alesOrdonat); onClose() } finally { setSalvez(false) } }}
            disabled={salvez}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60" style={{ background: '#0a1628' }}>
            <Check size={14} /> Salvează
          </button>
        </div>
      </div>
    </div>
  )
}
