'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CURS_B } from '@/lib/curs-b/continut'
import { NotebookPen, HelpCircle, ChevronDown, ChevronUp, Loader2, ArrowLeft, Check } from 'lucide-react'

// Cursul B/A pentru cursant: subiectele zilei, notele lui sub fiecare subiect și
// notele de curs (ale lui Radu Diaconescu) ascunse sub semnul întrebării.

export default function CursBPage() {
  const router = useRouter()
  const [stare, setStare] = useState<'incarc' | 'gata' | 'eroare'>('incarc')
  const [eroare, setEroare] = useState('')
  const [cod, setCod] = useState('')
  const [studentId, setStudentId] = useState('')
  const [nume, setNume] = useState('')
  const [note, setNote] = useState<Record<string, string>>({})
  const [deschise, setDeschise] = useState<Set<string>>(new Set())
  const [ziDeschisa, setZiDeschisa] = useState<number | null>(1)
  const [salvat, setSalvat] = useState<string | null>(null)
  const timere = useRef<Record<string, any>>({})

  useEffect(() => {
    (async () => {
      const c = (new URLSearchParams(window.location.search).get('cod') || '').toUpperCase().trim()
      if (!c) { setStare('eroare'); setEroare('Lipsește codul de sesiune din adresă.'); return }
      setCod(c)
      let salvatLocal: { email?: string; student_id?: string } | null = null
      try { const raw = localStorage.getItem(`setsail_portal_${c}`); if (raw) salvatLocal = JSON.parse(raw) } catch {}
      if (!salvatLocal?.student_id || !salvatLocal?.email) { router.replace(`/portal?cod=${c}`); return }

      const { data: st } = await supabase.from('students')
        .select('id, full_name, email').eq('id', salvatLocal.student_id).ilike('email', salvatLocal.email).maybeSingle()
      if (!st) { router.replace(`/portal?cod=${c}`); return }
      setStudentId(st.id); setNume(st.full_name || '')

      const r = await fetch(`/api/portal/curs-b?student_id=${st.id}&access_code=${encodeURIComponent(c)}`)
      const j = await r.json().catch(() => ({}))
      if (j.error) { setStare('eroare'); setEroare('Nu am putut încărca notele.'); return }
      setNote(j.note || {})
      setStare('gata')
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Notele se salvează singure, la o secundă după ce te-ai oprit din scris
  const salveaza = useCallback((cheie: string, text: string) => {
    clearTimeout(timere.current[cheie])
    timere.current[cheie] = setTimeout(async () => {
      await fetch('/api/portal/curs-b', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, access_code: cod, cheie, text }),
      }).catch(() => {})
      setSalvat(cheie)
      setTimeout(() => setSalvat(s => (s === cheie ? null : s)), 1500)
    }, 1000)
  }, [studentId, cod])

  const comuta = (cheie: string) => setDeschise(s => {
    const n = new Set(s); n.has(cheie) ? n.delete(cheie) : n.add(cheie); return n
  })

  if (stare === 'incarc') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>
      <div className="text-white/70 text-sm flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> Se încarcă cursul…</div>
    </div>
  )
  if (stare === 'eroare') return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm text-center">
        <p className="text-sm text-gray-700">{eroare}</p>
        <a href={`/portal?cod=${cod}`} className="mt-4 inline-block text-sm text-blue-600 hover:underline">← Înapoi la portal</a>
      </div>
    </div>
  )

  const scrise = Object.values(note).filter(t => String(t || '').trim()).length

  return (
    <div className="min-h-screen p-4 pb-16" style={{ background: 'linear-gradient(135deg, #0a1628 0%, #162b55 100%)' }}>
      <div className="w-full max-w-3xl mx-auto mt-6">
        <a href={`/portal?cod=${cod}`} className="inline-flex items-center gap-1.5 text-white/60 hover:text-white text-sm mb-4">
          <ArrowLeft size={14} /> Portalul meu
        </a>

        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl" style={{ background: '#7dd3fc' }}>
                  <NotebookPen size={18} className="text-sky-900" />
                </span>
                Curs B/A — caietul meu
              </h1>
              <p className="text-xs text-gray-400 mt-1">{nume} · notele tale se salvează singure</p>
            </div>
            <span className="text-xs text-gray-400">{scrise} subiecte cu notițe</span>
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Sub fiecare subiect ai loc pentru notițele tale. Semnul întrebării deschide notele de curs
            strânse de un fost cursant (Radu Diaconescu, 2023) — sunt o orientare, nu înlocuiesc ce spune instructorul.
          </p>
        </div>

        {CURS_B.map(zi => {
          const deschisaZi = ziDeschisa === zi.zi
          return (
            <div key={zi.zi} className="bg-white rounded-2xl shadow-2xl mb-4 overflow-hidden">
              <button onClick={() => setZiDeschisa(d => (d === zi.zi ? null : zi.zi))}
                className="w-full flex items-center justify-between gap-3 px-6 py-4 text-left hover:bg-gray-50">
                <div>
                  <div className="font-bold text-gray-900">Ziua {zi.zi} — {zi.titlu}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{zi.instructor}{zi.data ? ` · ${zi.data}` : ''} · {zi.subiecte.length} subiecte</div>
                </div>
                {deschisaZi ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {deschisaZi && (
                <div className="px-6 pb-6">
                  {zi.intro.length > 0 && (
                    <div className="mb-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-500 whitespace-pre-line">
                      {zi.intro.join('\n')}
                    </div>
                  )}

                  <div className="space-y-4">
                    {zi.subiecte.map(s => {
                      const vazut = deschise.has(s.cheie)
                      return (
                        <div key={s.cheie} className="rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                            <span className="font-semibold text-sm text-gray-900">{s.titlu}</span>
                            <button onClick={() => comuta(s.cheie)}
                              title={vazut ? 'Ascunde notele de curs' : 'Vezi notele de curs'}
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-full border transition-colors ${
                                vazut ? 'bg-amber-400 border-amber-500 text-white' : 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'}`}>
                              <HelpCircle size={15} />
                            </button>
                          </div>

                          {vazut && (
                            <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-100">
                              <div className="text-[11px] font-semibold text-amber-800 uppercase tracking-wide mb-1.5">Note de curs</div>
                              <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                                {s.continut.join('\n')}
                              </div>
                            </div>
                          )}

                          <div className="px-4 py-3">
                            {salvat === s.cheie && (
                              <div className="flex justify-end mb-1">
                                <span className="text-[11px] text-green-600 flex items-center gap-1"><Check size={11} /> salvat</span>
                              </div>
                            )}
                            <textarea
                              defaultValue={note[s.cheie] || ''}
                              onChange={e => { const v = e.target.value; setNote(n => ({ ...n, [s.cheie]: v })); salveaza(s.cheie, v) }}
                              rows={3}
                              placeholder="Idei principale"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-base focus:outline-none focus:ring-2 focus:ring-sky-200 resize-y" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
