'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Indexul cu token al seriilor de radio în lucru — de aici se intră în listele de cursanți.
// Seriile noi apar automat; nu e nevoie de un link nou la fiecare serie.

type Row = {
  id: string; class_caa: string | null
  session_date: string | null; course_start_date: string | null
  status: string; location: string | null
  roster_token: string | null; students: number
}

const STATUS: Record<string, { label: string; cls: string }> = {
  focus:  { label: 'Focus',  cls: 'bg-purple-50 text-purple-700 border-purple-200' },
  active: { label: 'Activă', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  draft:  { label: 'Ciornă', cls: 'bg-gray-100 text-gray-600 border-gray-200' },
}

// „5-7 oct 2026" din datele de început și de examen
function interval(s: Row): string {
  if (!s.session_date) return '—'
  const luna = (d: Date) => d.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '')
  const end = new Date(s.session_date)
  const start = s.course_start_date ? new Date(s.course_start_date) : null
  if (start && !isNaN(+start) && +start !== +end) {
    return start.getMonth() === end.getMonth()
      ? `${start.getDate()}-${end.getDate()} ${luna(end)} ${end.getFullYear()}`
      : `${start.getDate()} ${luna(start)} - ${end.getDate()} ${luna(end)} ${end.getFullYear()}`
  }
  return `${end.getDate()} ${luna(end)} ${end.getFullYear()}`
}

export default function SeriiRadioPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 p-8 text-center text-gray-400">Se încarcă…</div>}>
      <SeriiRadio />
    </Suspense>
  )
}

function SeriiRadio() {
  const token = useSearchParams().get('token') || ''
  const [rows, setRows] = useState<Row[] | null>(null)
  const [denied, setDenied] = useState(false)

  const load = useCallback(async () => {
    const r = await fetch(`/api/radio-index?token=${encodeURIComponent(token)}`)
    if (r.status === 403) { setDenied(true); return }
    const j = await r.json()
    setRows(j.sessions || [])
  }, [token])
  useEffect(() => { load(); document.title = 'Serii radio' }, [load])

  if (denied) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#cdd9e5', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Acces restricționat</h1><p style={{ color: '#8aa0b3', fontSize: 14 }}>Link invalid sau token lipsă.</p></div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Serii radio</h1>
        <p className="text-sm text-gray-500 mt-1 mb-5">
          Seriile în lucru (focus, active și ciorne). Apasă pe o serie pentru lista de cursanți.
        </p>

        {rows === null ? (
          <div className="text-center text-gray-400 py-16">Se încarcă…</div>
        ) : rows.length === 0 ? (
          <div className="text-center text-gray-400 py-16">Nicio serie de radio în lucru.</div>
        ) : (
          <div className="space-y-2">
            {rows.map(s => {
              const st = STATUS[s.status] || { label: s.status, cls: 'bg-gray-100 text-gray-600 border-gray-200' }
              return (
                <a key={s.id} href={`/sesiune/${s.id}/cursanti?token=${s.roster_token || ''}`}
                  className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 hover:border-blue-300 hover:shadow transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900">
                      Curs {(s.class_caa || 'Radio').trim()} {interval(s)}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {s.students} {s.students === 1 ? 'cursant' : 'cursanți'}
                      {s.location ? ` · ${s.location}` : ''}
                    </div>
                  </div>
                  <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-lg border ${st.cls}`}>{st.label}</span>
                  <span className="shrink-0 text-gray-300">›</span>
                </a>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
