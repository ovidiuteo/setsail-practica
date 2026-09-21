'use client'
import { useState } from 'react'
import { Presentation, Circle, X, Check, Loader2 } from 'lucide-react'

// Cum vrea cursantul materialele de curs (ales în portal): în sală, easybox Sameday
// sau la o adresă prin curier. Iconița se vede în listele de cursanți; la easybox și
// adresă, click pe ea deschide datele de contact și butonul „Trimis".

export type Livrare = {
  livrare_tip?: string | null
  livrare_adresa?: string | null
  livrare_contact?: string | null
  livrare_telefon?: string | null
  livrare_email?: string | null
  livrare_trimis_la?: string | null
}

const TITLU: Record<string, string> = {
  sala: 'Ridică materialele în sala de curs',
  easybox: 'Easybox Sameday',
  domiciliu: 'Curier, la adresa de domiciliu',
  alta: 'Curier, la altă adresă',
}

// Ordinea la sortare: neales → sală → easybox → adresă; pachetele trimise trec după cele netrimise
export function livrareRang(s: Livrare): number {
  const tip = s.livrare_tip || ''
  const baza = tip === 'sala' ? 1 : tip === 'easybox' ? 2 : (tip === 'domiciliu' || tip === 'alta') ? 3 : 0
  return baza * 2 + (s.livrare_trimis_la ? 1 : 0)
}

// Curier: remorca plină, albastru
function IconCurier({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="1.5" y="6" width="11" height="9.5" rx="1.5" fill="#2563eb" />
      <path d="M12.5 9.5h4l4 3.5v2.5h-8z" fill="#fff" />
      <circle cx="7" cy="18" r="2" fill="#fff" />
      <circle cx="17.5" cy="18" r="2" fill="#fff" />
    </svg>
  )
}

// Sigla Sameday: pătrat roșu cu „s"
function SiglaSameday({ size = 18 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-[4px] font-extrabold text-white leading-none"
      style={{ background: '#e62e2d', width: size, height: size, fontSize: Math.round(size * 0.66) }}>s</span>
  )
}

export function LivrareIcon({ tip, size = 18, trimis }: { tip?: string | null; size?: number; trimis?: boolean }) {
  const icon = tip === 'sala' ? <Presentation size={size} className="text-green-600" />
    : tip === 'easybox' ? <SiglaSameday size={size} />
    : (tip === 'domiciliu' || tip === 'alta') ? <IconCurier size={size} />
    : <Circle size={size} className="text-orange-400" />
  // pachet trimis: iconița stă într-un cerc verde
  if (!trimis) return icon
  return (
    <span className="inline-flex items-center justify-center rounded-full bg-green-100 ring-2 ring-green-500"
      style={{ width: size + 12, height: size + 12 }}>{icon}</span>
  )
}

export default function LivrareCell({ s, nume, onTrimis }: {
  s: Livrare
  nume?: string
  // marchează / anulează trimiterea pachetului; primește data ISO sau null
  onTrimis?: (trimisLa: string | null) => Promise<void> | void
}) {
  const [deschis, setDeschis] = useState(false)
  const [salvez, setSalvez] = useState(false)
  const tip = s.livrare_tip || null
  const trimis = !!s.livrare_trimis_la
  const titlu = (tip ? TITLU[tip] || tip : 'Nu a ales cum primește materialele')
    + (trimis ? ' · pachet trimis' : '')
  const areDetalii = tip === 'easybox' || tip === 'domiciliu' || tip === 'alta'

  async function schimbaTrimis() {
    if (!onTrimis) return
    setSalvez(true)
    try { await onTrimis(trimis ? null : new Date().toISOString()) } finally { setSalvez(false) }
  }

  if (!areDetalii) {
    return <span title={titlu} className="inline-flex items-center justify-center"><LivrareIcon tip={tip} trimis={trimis} /></span>
  }
  return (
    <>
      <button type="button" onClick={e => { e.stopPropagation(); setDeschis(true) }} title={titlu}
        className="p-1 rounded hover:bg-gray-100 transition-colors">
        <LivrareIcon tip={tip} trimis={trimis} />
      </button>
      {deschis && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={e => { e.stopPropagation(); setDeschis(false) }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2 min-w-0">
                <LivrareIcon tip={tip} size={20} trimis={trimis} />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">{nume || 'Livrare materiale'}</div>
                  <div className="text-xs text-gray-400">{TITLU[tip] || tip}</div>
                </div>
              </div>
              <button onClick={() => setDeschis(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="px-5 py-4 space-y-3 text-sm">
              <div>
                <div className="text-[11px] uppercase tracking-wide text-gray-400 mb-0.5">
                  {tip === 'easybox' ? 'Easybox ales' : tip === 'domiciliu' ? 'Adresa de livrare (DOMI)' : 'Adresa de livrare'}
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
            {onTrimis && (
              <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                {trimis && (
                  <span className="text-xs text-green-700">
                    Trimis {new Date(s.livrare_trimis_la as string).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                  </span>
                )}
                <button onClick={schimbaTrimis} disabled={salvez}
                  className={`ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 ${
                    trimis
                      ? 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      : 'text-white bg-green-600 hover:bg-green-700'}`}>
                  {salvez ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  {trimis ? 'Anulează trimiterea' : 'Trimis'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
