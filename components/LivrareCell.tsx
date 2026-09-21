'use client'
import { useState } from 'react'
import { Presentation, Truck, Circle, X } from 'lucide-react'

// Cum vrea cursantul materialele de curs (ales în portal): în sală, easybox Sameday
// sau la o adresă prin curier. Iconița se vede în listele de cursanți; la easybox și
// adresă, click pe ea deschide datele de contact pentru curier.

export type Livrare = {
  livrare_tip?: string | null
  livrare_adresa?: string | null
  livrare_contact?: string | null
  livrare_telefon?: string | null
  livrare_email?: string | null
}

const TITLU: Record<string, string> = {
  sala: 'Ridică materialele în sala de curs',
  easybox: 'Easybox Sameday',
  domiciliu: 'Curier, la adresa de domiciliu',
  alta: 'Curier, la altă adresă',
}

// Sigla Sameday: pătrat roșu cu „s"
function SiglaSameday({ size = 18 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[4px] font-extrabold text-white leading-none"
      style={{ background: '#e62e2d', width: size, height: size, fontSize: Math.round(size * 0.66) }}>s</span>
  )
}

export function LivrareIcon({ tip, size = 18 }: { tip?: string | null; size?: number }) {
  if (tip === 'sala') return <Presentation size={size} className="text-green-600" />
  if (tip === 'easybox') return <SiglaSameday size={size} />
  if (tip === 'domiciliu' || tip === 'alta') return <Truck size={size} className="text-blue-600" />
  return <Circle size={size} className="text-orange-400" />
}

export default function LivrareCell({ s, nume }: { s: Livrare; nume?: string }) {
  const [deschis, setDeschis] = useState(false)
  const tip = s.livrare_tip || null
  const titlu = tip ? TITLU[tip] || tip : 'Nu a ales cum primește materialele'
  const areDetalii = tip === 'easybox' || tip === 'domiciliu' || tip === 'alta'

  if (!areDetalii) {
    return <span title={titlu} className="inline-flex items-center justify-center"><LivrareIcon tip={tip} /></span>
  }
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setDeschis(true) }} title={titlu}
        className="p-1 rounded hover:bg-gray-100 transition-colors">
        <LivrareIcon tip={tip} />
      </button>
      {deschis && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={e => { e.stopPropagation(); setDeschis(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <LivrareIcon tip={tip} size={20} />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{nume || 'Livrare materiale'}</div>
                  <div className="text-xs text-gray-400">{titlu}</div>
                </div>
              </div>
              <button onClick={() => setDeschis(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">
                  {tip === 'easybox' ? 'Easybox ales' : 'Adresa de livrare'}
                </div>
                <div className="text-gray-800 whitespace-pre-wrap">{s.livrare_adresa?.trim() || '—'}</div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Persoană de contact</div>
                <div className="text-gray-800">{s.livrare_contact?.trim() || '—'}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Telefon</div>
                  {s.livrare_telefon?.trim()
                    ? <a href={`tel:${s.livrare_telefon.trim()}`} className="text-blue-600 hover:underline">{s.livrare_telefon}</a>
                    : <span className="text-gray-400">—</span>}
                </div>
                <div className="min-w-0">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">Email</div>
                  {s.livrare_email?.trim()
                    ? <a href={`mailto:${s.livrare_email.trim()}`} className="text-blue-600 hover:underline break-all">{s.livrare_email}</a>
                    : <span className="text-gray-400">—</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
