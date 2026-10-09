'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { CURS_B } from '@/lib/curs-b/continut'
import { NotebookPen, HelpCircle, ChevronDown, ChevronUp, Loader2, ArrowLeft, Check, Download } from 'lucide-react'

// Cursul B/A pentru cursant: subiectele zilei, notele lui sub fiecare subiect și
// notele de curs (ale lui Radu Diaconescu) ascunse sub semnul întrebării.

// Linkul zilei, pregătit pentru încorporare. Merge linkul de embed copiat din
// YouTube („.../embed/..." sau codul <iframe …>), dar și adresa obișnuită.
function embedYouTube(url?: string): string | null {
  const u = String(url || '').trim()
  if (!u) return null
  // dacă s-a lipit tot codul <iframe …>, luăm adresa din src
  const dinIframe = /src=["']([^"']+)["']/i.exec(u)?.[1]
  const adresa = dinIframe || u
  if (/youtube(-nocookie)?\.com\/embed\//i.test(adresa)) return adresa
  const id = /youtu\.be\/([\w-]{6,})/.exec(adresa)?.[1]
    || /[?&]v=([\w-]{6,})/.exec(adresa)?.[1]
    || /youtube\.com\/(?:live|shorts)\/([\w-]{6,})/.exec(adresa)?.[1]
  return id ? `https://www.youtube.com/embed/${id}?rel=0` : null
}

// Semnul YouTube — plin (alb pe roșu) când filmul e deschis
function IconYouTube({ size = 18, plin = false }: { size?: number; plin?: boolean }) {
  const c = plin ? '#fff' : '#ff0000'
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.5" y="5" width="19" height="14" rx="4" stroke={c} strokeWidth="1.8" />
      <path fill={c} d="M10 8.5l6 3.5-6 3.5v-7z" />
    </svg>
  )
}

// Înregistrarea unei zile. Ține minte secunda la care s-a ajuns, ca filmul să
// pornească de acolo când îl redeschizi, și se oprește singur când se închide
// (iframe-ul dispare din pagină).
function FilmZi({ src, zi, start, onSecunda }: {
  src: string; zi: number; start: number; onSecunda: (zi: number, s: number) => void
}) {
  const ref = useRef<HTMLIFrameElement>(null)
  const adresa = `${src}${src.includes('?') ? '&' : '?'}enablejsapi=1&widgetid=${zi}${start ? `&start=${start}` : ''}`

  useEffect(() => {
    // cerem playerului să ne trimită starea (altfel nu primim nimic)
    const cere = () => ref.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'listening', id: zi, channel: 'widget' }), '*')
    const t = setInterval(cere, 1000)
    const stop = setTimeout(() => clearInterval(t), 8000)

    function laMesaj(e: MessageEvent) {
      if (!/\.youtube(-nocookie)?\.com$/.test(new URL(e.origin || 'https://x.invalid').hostname.replace(/^www\./, '.'))) return
      try {
        const d = typeof e.data === 'string' ? JSON.parse(e.data) : e.data
        const s = d?.info?.currentTime
        if (typeof s === 'number' && s > 0) onSecunda(zi, Math.floor(s))
      } catch { /* alt mesaj */ }
    }
    window.addEventListener('message', laMesaj)
    return () => { clearInterval(t); clearTimeout(stop); window.removeEventListener('message', laMesaj) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zi, src])

  return (
    <iframe ref={ref} src={adresa} title={`Ziua ${zi}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen className="w-full h-full" />
  )
}

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
  const [linkuri, setLinkuri] = useState<Record<string, string>>({})   // câte un link pe zi, din configurator
  const [filme, setFilme] = useState<Set<number>>(new Set())           // zilele cu înregistrarea deschisă
  const secunde = useRef<Record<number, number>>({})                   // unde a rămas filmul fiecărei zile
  const timere = useRef<Record<string, any>>({})
  const [descarc, setDescarc] = useState(false)
  const [helper, setHelperActiv] = useState(false)   // butoanele galbene cu notele de curs

  useEffect(() => {
    (async () => {
      const c = (new URLSearchParams(window.location.search).get('cod') || '').toUpperCase().trim()
      if (!c) { setStare('eroare'); setEroare('Lipsește codul de sesiune din adresă.'); return }
      setCod(c)
      let salvatLocal: { email?: string; student_id?: string } | null = null
      try { const raw = localStorage.getItem(`setsail_portal_${c}`); if (raw) salvatLocal = JSON.parse(raw) } catch {}
      if (!salvatLocal?.student_id || !salvatLocal?.email) { router.replace(`/portal?cod=${c}`); return }

      const { data: st } = await supabase.from('students')
        .select('id, full_name, email, sessions!session_id(curs_b_url_zi1, curs_b_url_zi2, curs_b_url_zi3)')
        .eq('id', salvatLocal.student_id).ilike('email', salvatLocal.email).maybeSingle()
      if (!st) { router.replace(`/portal?cod=${c}`); return }
      setStudentId(st.id); setNume(st.full_name || '')

      const r = await fetch(`/api/portal/curs-b?student_id=${st.id}&access_code=${encodeURIComponent(c)}`)
      const j = await r.json().catch(() => ({}))
      if (j.error) { setStare('eroare'); setEroare('Nu am putut încărca notele.'); return }
      setNote(j.note || {})

      // linkurile zilelor, puse din configurator
      const { data: info } = await supabase.from('setsail_info').select('key, value')
        .in('key', ['curs_b_url_zi1', 'curs_b_url_zi2', 'curs_b_url_zi3',
          'curs_b_helper_vizibil', 'curs_b_helper_studenti', 'curs_b_caiet_vizibil', 'curs_b_caiet_studenti'])
      const l: Record<string, string> = {}
      for (const r of (info || []) as any[]) if (r.value) l[r.key] = r.value
      // linkul pus pe seria cursantului ține locul celui implicit
      const aleSeriei: any = (st as any).sessions || {}
      for (const z of [1, 2, 3]) {
        const v = String(aleSeriei[`curs_b_url_zi${z}`] || '').trim()
        if (v) l[`curs_b_url_zi${z}`] = v
      }
      setLinkuri(l)

      // helperul se vede doar dacă e pornit și cursantul e pe listă
      try {
        const lista: string[] = JSON.parse(l.curs_b_helper_studenti || '[]')
        setHelperActiv(l.curs_b_helper_vizibil === '1' && lista.includes(st.id))
      } catch { setHelperActiv(false) }

      // caietul se deschide doar cursanților aleși din configurator
      let areCaiet = false
      try {
        const lista: string[] = JSON.parse(l.curs_b_caiet_studenti || '[]')
        areCaiet = l.curs_b_caiet_vizibil === '1' && lista.includes(st.id)
      } catch { areCaiet = false }
      if (!areCaiet) { router.replace(`/portal?cod=${c}`); return }

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

  const areFilm = (zi: number) => !!embedYouTube(linkuri[`curs_b_url_zi${zi}`])

  // o singură zi deschisă: celelalte se închid (și filmele lor se opresc), iar
  // ziua deschisă își arată filmul din start — oprit, de unde a rămas
  function deschideZi(zi: number) {
    setZiDeschisa(d => {
      const noua = d === zi ? null : zi
      setFilme(noua && areFilm(noua) ? new Set([noua]) : new Set())
      return noua
    })
  }

  // la prima încărcare, filmul zilei deschise apare singur
  useEffect(() => {
    if (ziDeschisa && areFilm(ziDeschisa)) setFilme(new Set([ziDeschisa]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkuri])

  // Referatul în format PDF, cu numele cursantului și notițele lui
  async function descarcaReferat() {
    setDescarc(true)
    try {
      const r = await fetch('/api/portal/curs-b/referat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId, access_code: cod }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); alert('Nu am putut face referatul: ' + (j.error || 'eroare')); return }
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `Referat Curs B - ${nume}.pdf`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e: any) {
      alert('Eroare: ' + (e?.message || e))
    } finally { setDescarc(false) }
  }

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
              <p className="mt-1">
                <span className="text-base font-bold text-gray-900">{nume}</span>
                <span className="text-xs text-gray-400"> · notele tale se salvează singure</span>
              </p>
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
              <div className="w-full flex items-center justify-between gap-3 px-6 py-4">
                <button onClick={() => deschideZi(zi.zi)} className="flex-1 min-w-0 text-left">
                  <div className="font-bold text-gray-900">Ziua {zi.zi} — {zi.titlu}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{zi.instructor}{zi.data ? ` · ${zi.data}` : ''} · {zi.subiecte.length} subiecte</div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {/* înregistrarea zilei, pusă din configurator */}
                  {linkuri[`curs_b_url_zi${zi.zi}`] && (
                    embedYouTube(linkuri[`curs_b_url_zi${zi.zi}`]) ? (
                      <button onClick={() => { setZiDeschisa(zi.zi); setFilme(f => { const n = new Set(f); n.has(zi.zi) ? n.delete(zi.zi) : n.add(zi.zi); return n }) }}
                        title={filme.has(zi.zi) ? 'Ascunde înregistrarea' : 'Vezi înregistrarea zilei'}
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-xl transition-colors ${
                          filme.has(zi.zi) ? 'bg-red-600' : 'bg-red-50 hover:bg-red-100'}`}>
                        <IconYouTube size={18} plin={filme.has(zi.zi)} />
                      </button>
                    ) : (
                      <a href={linkuri[`curs_b_url_zi${zi.zi}`]} target="_blank" rel="noopener noreferrer"
                        title="Materialele zilei"
                        className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100">
                        <IconYouTube size={18} />
                      </a>
                    )
                  )}
                  <button onClick={() => deschideZi(zi.zi)} className="text-gray-400">
                    {deschisaZi ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                </div>
              </div>

              {deschisaZi && (
                <div className="px-6 pb-6">
                  {/* filmul rămâne pe loc, iar subiectele curg pe sub el */}
                  {filme.has(zi.zi) && embedYouTube(linkuri[`curs_b_url_zi${zi.zi}`]) && (
                    <div className="sticky top-0 z-10 -mx-6 px-6 pt-1 pb-3 bg-white">
                      <div className="rounded-xl overflow-hidden border border-gray-200 bg-black" style={{ aspectRatio: '16 / 9' }}>
                        <FilmZi src={embedYouTube(linkuri[`curs_b_url_zi${zi.zi}`])!} zi={zi.zi}
                          start={secunde.current[zi.zi] || 0}
                          onSecunda={(z, sec) => { secunde.current[z] = sec }} />
                      </div>
                      {secunde.current[zi.zi] > 0 && (
                        <div className="text-[11px] text-gray-400 mt-1">
                          revine de unde ai rămas · {Math.floor(secunde.current[zi.zi] / 60)}:{String(secunde.current[zi.zi] % 60).padStart(2, '0')}
                        </div>
                      )}
                    </div>
                  )}
                  {zi.intro.length > 0 && (
                    <div className="mb-4 rounded-xl bg-gray-50 border border-gray-100 px-4 py-3 text-xs text-gray-500 whitespace-pre-line">
                      {zi.intro.join('\n')}
                    </div>
                  )}

                  <div className={`space-y-4 ${filme.has(zi.zi) ? 'max-h-[55vh] overflow-y-auto pr-1' : ''}`}>
                    {zi.subiecte.map(s => {
                      const vazut = deschise.has(s.cheie)
                      return (
                        <div key={s.cheie} className="rounded-xl border border-gray-100">
                          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-100">
                            <span className="font-semibold text-base text-gray-900">{s.titlu}</span>
                            {helper && <button onClick={() => comuta(s.cheie)}
                              title={vazut ? 'Ascunde notele de curs' : 'Vezi notele de curs'}
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-full border transition-colors shrink-0 ${
                                vazut ? 'bg-amber-400 border-amber-500 text-white' : 'bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200'}`}>
                              <HelpCircle size={12} />
                            </button>}
                          </div>

                          {helper && vazut && (
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

        {/* Referatul: notițele cursantului, în formatul lucrării de curs */}
        <div className="bg-white rounded-2xl p-6 shadow-2xl mb-10 text-center">
          <h2 className="font-bold text-gray-900">Referatul meu</h2>
          <p className="text-xs text-gray-500 mt-1 mb-4">
            Notițele tale, strânse în formatul lucrării de curs — copertă cu numele tău, cuprins și notele pe zile.
          </p>
          <button onClick={descarcaReferat} disabled={descarc || scrise === 0}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-40"
            style={{ background: '#0a1628' }}>
            {descarc ? <><Loader2 size={15} className="animate-spin" /> Se pregătește…</> : <><Download size={15} /> Descarcă referatul de B</>}
          </button>
          {scrise === 0 && <p className="text-[11px] text-gray-400 mt-2">Scrie întâi câteva notițe.</p>}
        </div>
      </div>
    </div>
  )
}
