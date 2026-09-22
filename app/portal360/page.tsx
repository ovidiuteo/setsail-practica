'use client'
import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Cursant360 } from '@/lib/c360'
import { fDisplay, fBody, C, disp, fmtData, fmtBani, fmtSume, initiale, prenume } from '@/components/c360/ui'
import {
  Home, BookOpen, Anchor, Compass, User, Bell, Wallet, ChevronRight, Play, Video, MessageCircle, Users,
  ExternalLink, CalendarDays, MapPin, Ship, Award, Check, Circle, Heart, Mail, LogOut, Loader2, FileText, ArrowRight,
} from 'lucide-react'

type Tab = 'acasa' | 'invatare' | 'practica' | 'descopera' | 'cont'
const STORE = 'setsail-portal360'
const FAV = 'setsail-portal360-fav'
const OFFICE = 'office@setsail.ro'

function citeste<T>(k: string, def: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def } catch { return def }
}
function scrie(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { } }
function sterge(k: string) { try { localStorage.removeItem(k) } catch { } }

export default function Portal360Page() {
  return <Suspense fallback={null}><Portal360 /></Suspense>
}

function Portal360() {
  const sp = useSearchParams()
  const [cod, setCod] = useState(sp.get('cod') || '')
  const [email, setEmail] = useState(sp.get('email') || '')
  const [d, setD] = useState<Cursant360 | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [pornit, setPornit] = useState(false)
  const [tab, setTab] = useState<Tab>('acasa')

  async function intra(c: string, e: string, memoreaza = true) {
    setBusy(true); setErr('')
    const r = await fetch('/api/c360/portal', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cod: c, email: e }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setErr(j.error || 'Nu am putut intra.'); if (!memoreaza) sterge(STORE); return }
    if (memoreaza) scrie(STORE, { cod: c.toUpperCase().trim(), email: e.trim() })
    setD(j)
  }

  // Intrarea e permanentă: codul seriei + emailul se păstrează pe dispozitiv
  useEffect(() => {
    const s = citeste<{ cod: string; email: string } | null>(STORE, null)
    const qc = (sp.get('cod') || '').toUpperCase().trim()
    if (s?.cod && s?.email && (!qc || qc === s.cod)) { setCod(s.cod); setEmail(s.email); intra(s.cod, s.email, false).then(() => scrie(STORE, s)) }
    setPornit(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { window.scrollTo(0, 0) }, [tab])

  const wrap = `${fDisplay.variable} ${fBody.variable}`
  const base = { fontFamily: 'var(--c360-body), system-ui, sans-serif', color: C.ink, background: '#F6F2EA' }

  if (!d) {
    return (
      <div className={`${wrap} min-h-screen flex flex-col`} style={base}>
        <div className="px-6 pt-14 pb-10 rounded-b-[28px] relative overflow-hidden" style={{ background: C.navy, color: '#fff' }}>
          <div aria-hidden className="absolute rounded-full" style={{ right: -90, top: -60, width: 260, height: 260, border: '1px solid rgba(245,200,66,.2)' }} />
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-6" style={{ background: C.gold, color: C.navy }}><Ship size={22} /></div>
          <h1 className="text-3xl font-semibold m-0" style={disp}>Portalul tău SetSail</h1>
          <p className="mt-2 text-sm" style={{ color: '#B7C4D6' }}>Cursuri, practică, plăți și documente — toate într-un loc.</p>
        </div>
        <form onSubmit={e => { e.preventDefault(); intra(cod, email) }} className="px-6 py-8 flex flex-col gap-4 w-full max-w-[480px] mx-auto">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Codul seriei
            <input value={cod} onChange={e => setCod(e.target.value.toUpperCase())} autoCapitalize="characters" autoComplete="off" required
              className="h-12 px-4 rounded-2xl border bg-white text-base font-mono tracking-wider" style={{ borderColor: '#DDD5C6' }} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">Emailul cu care te-ai înscris
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required
              className="h-12 px-4 rounded-2xl border bg-white text-base" style={{ borderColor: '#DDD5C6' }} />
          </label>
          {err && <div className="text-sm rounded-xl px-4 py-3" style={{ background: '#FDECEA', color: C.bad }}>{err}</div>}
          <button disabled={busy || !pornit} className="h-12 rounded-2xl text-base font-bold flex items-center justify-center gap-2" style={{ background: C.navy, color: '#fff' }}>
            {busy ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}Intră în portal
          </button>
          <p className="text-xs text-center" style={{ color: C.muted }}>Codul seriei îl găsești în emailul de înscriere. Rămâi conectat pe acest dispozitiv.</p>
        </form>
      </div>
    )
  }

  function iesi() { sterge(STORE); setD(null); setEmail(''); setTab('acasa') }

  return (
    <div className={`${wrap} min-h-screen`} style={base}>
      <div className="max-w-[480px] mx-auto pb-28">
        {tab === 'acasa' && <Acasa d={d} go={setTab} />}
        {tab === 'invatare' && <Invatare d={d} />}
        {tab === 'practica' && <Practica d={d} />}
        {tab === 'descopera' && <Descopera d={d} />}
        {tab === 'cont' && <Cont d={d} iesi={iesi} />}
      </div>
      <BaraJos tab={tab} setTab={setTab} alerta={Object.values(d.financiar.sold).some(v => v > 0) || d.indicatori.documenteLipsa > 0} />
    </div>
  )
}

/* ---------- Bara de jos ---------- */

function BaraJos({ tab, setTab, alerta }: { tab: Tab; setTab: (t: Tab) => void; alerta: boolean }) {
  const items: Array<[Tab, string, any]> = [['acasa', 'Acasă', Home], ['invatare', 'Învățare', BookOpen], ['practica', 'Practică', Anchor], ['descopera', 'Descoperă', Compass], ['cont', 'Cont', User]]
  return (
    <nav aria-label="Navigare portal" className="fixed bottom-0 inset-x-0 bg-white border-t z-40" style={{ borderColor: '#EAE4D8', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="max-w-[480px] mx-auto grid grid-cols-5 px-1.5 pt-2 pb-3">
        {items.map(([k, t, I]) => {
          const on = tab === k
          return (
            <button key={k} onClick={() => setTab(k)} aria-current={on ? 'page' : undefined} className="flex flex-col items-center gap-1 text-[11px]" style={{ color: on ? C.navy : C.muted, fontWeight: on ? 800 : 700 }}>
              <span className="w-[54px] h-8 rounded-2xl flex items-center justify-center relative" style={on ? { background: C.gold } : {}}>
                <I size={20} />
                {k === 'cont' && alerta && !on && <span className="absolute top-0.5 right-3 w-2 h-2 rounded-full" style={{ background: '#C2410C' }} />}
              </span>{t}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/* ---------- Bucăți comune ---------- */

const cardCls = 'bg-white border rounded-[20px]'
const cardSt = { borderColor: '#EAE4D8' }
const H2 = ({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) =>
  <div className="flex items-center justify-between"><h2 className="text-[19px] font-semibold m-0" style={disp}>{children}</h2>{right}</div>
const H1 = ({ children }: { children: React.ReactNode }) => <h1 className="text-[30px] font-semibold m-0" style={disp}>{children}</h1>

function DataBloc({ d }: { d: string }) {
  const [zi, luna] = fmtData(d, false).split(' ')
  return (
    <div className="w-[52px] h-14 rounded-xl flex flex-col items-center justify-center shrink-0" style={{ background: '#F6F2EA' }}>
      <span className="text-[11px] font-extrabold" style={{ color: C.warn }}>{(luna || '').replace('.', '').toUpperCase()}</span>
      <span className="text-[22px] font-semibold leading-none" style={disp}>{zi}</span>
    </div>
  )
}

const RES_ICON = { zoom: Video, whatsapp: MessageCircle, video: Play, materiale: BookOpen, comunitate: Users }
const RES_BG = { zoom: '#2d8cff', whatsapp: '#25d366', video: '#7c3aed', materiale: C.sea, comunitate: C.navy }

function Resursa({ r }: { r: Cursant360['resurse'][number] }) {
  const I = RES_ICON[r.tip]
  return (
    <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 border-b last:border-b-0" style={{ borderColor: '#F0EBE1' }}>
      <span className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: RES_BG[r.tip] }}><I size={18} /></span>
      <span className="flex-1 min-w-0"><span className="block text-sm font-bold">{r.titlu}</span><span className="block text-xs truncate" style={{ color: C.muted }}>{r.url.replace(/^https?:\/\//, '')}</span></span>
      <ExternalLink size={16} style={{ color: C.muted }} />
    </a>
  )
}

function pct(d: Cursant360) {
  const n = d.pasi.length
  return n ? Math.round((d.pasi.filter(p => p.stare === 'gata').length / n) * 100) : 0
}

/* ---------- Acasă ---------- */

function Acasa({ d, go }: { d: Cursant360; go: (t: Tab) => void }) {
  const cur = d.inscrieri[0]
  const urm = d.pasi.find(p => p.stare === 'curent')
  const p = pct(d)
  const rest = Object.fromEntries(Object.entries(d.financiar.sold).filter(([, v]) => v > 0))
  const todo: Array<{ t: string; s: string; icon: any; tab?: Tab; href?: string; urgent?: boolean }> = []
  if (Object.keys(rest).length) todo.push({ t: `Plătește restul de ${fmtSume(rest)}`, s: d.financiar.urmatoareaScadenta ? `scadent ${fmtData(d.financiar.urmatoareaScadenta)}` : 'vezi detaliile în Cont', icon: Wallet, tab: 'cont', urgent: true })
  if (cur && cur.stareCursant === 'pending') todo.push({ t: 'Completează-ți datele pentru dosar', s: 'act de identitate și semnătură', icon: FileText, href: '/portal' })
  for (const x of d.documente.filter(x => !x.ok && x.nume !== 'Date completate în portal')) todo.push({ t: `Încarcă: ${x.nume.toLowerCase()}`, s: 'din portalul seriei', icon: FileText, href: '/portal' })
  const video = d.resurse.find(r => r.tip === 'video') || d.resurse.find(r => r.tip === 'materiale') || d.resurse.find(r => r.tip === 'zoom')
  const prog = cur && d.programari.find(x => x.sessionId === cur.sessionId)
  const viitoare = d.pasi.filter(x => x.stare !== 'gata' && x.data).slice(0, 3)

  const ora = new Date().getHours()
  const salut = ora < 12 ? 'Bună dimineața,' : ora < 18 ? 'Bună ziua,' : 'Bună seara,'
  const circ = 2 * Math.PI * 33

  return (
    <>
      <header className="px-5 pt-6 pb-7 rounded-b-[28px] flex flex-col gap-5 relative overflow-hidden" style={{ background: C.navy, color: '#fff' }}>
        <div aria-hidden className="absolute rounded-full" style={{ right: -90, top: -60, width: 260, height: 260, border: '1px solid rgba(245,200,66,.2)' }} />
        <div className="flex items-center justify-between relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-[14px] flex items-center justify-center font-semibold text-lg" style={{ ...disp, background: C.gold, color: C.navy }}>{initiale(d.persoana.full_name)}</div>
            <div><div className="text-[13px]" style={{ color: '#9FB0C7' }}>{salut}</div><div className="text-[22px] font-semibold" style={disp}>{prenume(d.persoana.full_name)}</div></div>
          </div>
          <button onClick={() => go('cont')} aria-label={todo.length ? `${todo.length} lucruri de făcut` : 'Contul meu'} className="w-11 h-11 rounded-[14px] border flex items-center justify-center relative" style={{ borderColor: 'rgba(255,255,255,.18)' }}>
            <Bell size={20} />{todo.length > 0 && <span className="absolute top-2 right-2.5 w-2 h-2 rounded-full" style={{ background: C.gold }} />}
          </button>
        </div>
        {urm ? (
          <div className="rounded-[20px] p-4 flex items-center gap-4 relative" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }}>
            <svg viewBox="0 0 80 80" className="w-20 h-20 shrink-0" aria-label={`Parcurs ${p}%`}>
              <circle cx="40" cy="40" r="33" fill="none" stroke="rgba(255,255,255,.14)" strokeWidth="8" />
              <circle cx="40" cy="40" r="33" fill="none" stroke={C.gold} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${(circ * p) / 100} ${circ}`} transform="rotate(-90 40 40)" />
              <text x="40" y="46" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="600" style={disp}>{p}%</text>
            </svg>
            <div className="flex flex-col gap-1"><div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.gold }}>Următorul pas</div>
              <div className="text-xl font-semibold" style={disp}>{urm.titlu}</div>
              <div className="text-[13px]" style={{ color: '#B7C4D6' }}>{urm.data ? fmtData(urm.data) : 'în curând'}{d.indicatori.zilePana != null && d.indicatori.zilePana > 0 ? <> · în <b className="text-white">{d.indicatori.zilePana} {d.indicatori.zilePana === 1 ? 'zi' : 'zile'}</b></> : null}</div>
            </div>
          </div>
        ) : cur ? (
          <div className="rounded-[20px] p-4 relative" style={{ background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)' }}>
            <div className="text-xl font-semibold" style={disp}>Ai parcurs tot programul</div><div className="text-[13px]" style={{ color: '#B7C4D6' }}>{cur.program}</div>
          </div>
        ) : null}
      </header>

      <main className="px-5 pt-5 flex flex-col gap-5">
        {todo.length > 0 && (
          <section className={`${cardCls} p-[18px] flex flex-col gap-3.5`} style={cardSt}>
            <H2 right={<span className="text-xs" style={{ color: C.muted }}>{todo.length} de făcut</span>}>De făcut</H2>
            {todo.map((x, i) => {
              const inner = (
                <>
                  <span className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0" style={x.urgent ? { background: '#FDE3C2', color: C.warn } : { background: C.seaBg, color: C.sea }}><x.icon size={18} /></span>
                  <span className="flex-1 text-left"><b className="text-sm block">{x.t}</b><span className="text-xs" style={{ color: x.urgent ? C.warn : C.muted }}>{x.s}</span></span>
                  <ChevronRight size={20} style={{ color: C.muted }} />
                </>
              )
              const cls = `flex items-center gap-3 ${x.urgent ? 'p-3 rounded-[14px]' : ''}`
              const st = x.urgent ? { background: '#FFF6E8' } : {}
              return x.tab ? <button key={i} onClick={() => go(x.tab!)} className={cls} style={st}>{inner}</button>
                : <a key={i} href={x.href} className={cls} style={st}>{inner}</a>
            })}
          </section>
        )}

        {video && (
          <section className="flex flex-col gap-3">
            <H2>Continuă să înveți</H2>
            <a href={video.url} target="_blank" rel="noopener noreferrer" className="block rounded-[20px] overflow-hidden bg-white border" style={cardSt}>
              <div className="h-[150px] relative flex items-center justify-center" style={{ background: 'linear-gradient(160deg,#103A66 0%,#1B6E99 55%,#2EA8D8 100%)' }}>
                <svg viewBox="0 0 390 150" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden><path d="M0 110 C 60 92 110 128 180 108 S 300 86 390 106 L390 150 L0 150 Z" fill="rgba(255,255,255,.10)" /><path d="M0 128 C 70 114 130 142 210 126 S 330 110 390 124 L390 150 L0 150 Z" fill="rgba(255,255,255,.12)" /></svg>
                <span className="w-[60px] h-[60px] rounded-full flex items-center justify-center relative" style={{ background: C.gold, color: C.navy }}><Play size={24} fill="currentColor" /></span>
              </div>
              <div className="px-4 py-3.5"><b className="text-[15px]">{video.titlu}</b></div>
            </a>
          </section>
        )}

        {cur && (
          <section className={`${cardCls} p-[18px] flex flex-col gap-3.5`} style={cardSt}>
            <div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>Practica ta</div>
              <h2 className="text-[19px] font-semibold mt-1 mb-0" style={disp}>{cur.locatie || cur.program}{cur.dataExamen ? ` · ${fmtData(cur.dataExamen, false)}` : ''}</h2></div>
              <SesBadge s={cur.stareSesiune} /></div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
              {cur.barci.length > 0 && <span className="flex items-center gap-1.5"><Ship size={16} style={{ color: C.sea }} />{cur.barci.join(', ')}</span>}
              {cur.instructori.length > 0 && <span className="flex items-center gap-1.5"><User size={16} style={{ color: C.sea }} />{cur.instructori.join(', ')}</span>}
              {prog && <span className="flex items-center gap-1.5"><CalendarDays size={16} style={{ color: C.sea }} />{fmtData(prog.data, false)}, {prog.de}–{prog.pana}</span>}
            </div>
            <button onClick={() => go('practica')} className="self-end text-[13px] font-extrabold" style={{ color: C.sea }}>Detalii →</button>
          </section>
        )}

        <section className="grid grid-cols-3 gap-2.5" aria-label="Statistici">
          <Stat v={String(d.inscrieri.length)} t={d.inscrieri.length === 1 ? 'serie' : 'serii'} />
          <Stat v={`${d.pasi.filter(x => x.stare === 'gata').length}/${d.pasi.length}`} t="pași parcurși" />
          <Stat v={String(d.diplome.filter(x => x.activa).length)} t={d.diplome.filter(x => x.activa).length === 1 ? 'diplomă' : 'diplome'} />
        </section>

        {viitoare.length > 0 && (
          <section className="flex flex-col gap-3">
            <H2>Urmează</H2>
            {viitoare.map((x, i) => (
              <div key={i} className={`${cardCls} p-3.5 flex gap-3.5 items-center`} style={cardSt}>
                <DataBloc d={x.data!} />
                <div className="flex-1"><b className="text-sm">{x.titlu}</b><div className="text-xs" style={{ color: C.muted }}>{x.detaliu || cur?.program}</div></div>
              </div>
            ))}
          </section>
        )}

        {d.evenimente[0] && (
          <button onClick={() => go('descopera')} className="flex gap-3.5 items-center p-[18px] rounded-[20px] text-left" style={{ background: C.gold, color: C.navy }}>
            <div className="flex-1"><div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: '#5C4A08' }}>Următoarea serie</div>
              <div className="text-xl font-semibold mt-1" style={disp}>{d.evenimente[0].titlu}</div>
              <div className="text-[13px] mt-1">{fmtData(d.evenimente[0].data)}{d.evenimente[0].locatie ? ` · ${d.evenimente[0].locatie}` : ''}</div></div>
            <span className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={{ background: C.navy, color: C.gold }}><ArrowRight size={20} /></span>
          </button>
        )}
      </main>
    </>
  )
}

function Stat({ v, t }: { v: string; t: string }) {
  return <div className={`${cardCls} p-3.5`} style={cardSt}><div className="text-2xl font-semibold" style={disp}>{v}</div><div className="text-xs" style={{ color: C.muted }}>{t}</div></div>
}

function SesBadge({ s }: { s: string }) {
  const m: Record<string, [string, string, string]> = { active: ['În desfășurare', C.okBg, C.ok], draft: ['În pregătire', C.seaBg, C.sea], completed: ['Încheiată', '#F1ECE2', '#3D4654'] }
  const [t, bg, fg] = m[s] || ['', '', '']
  return t ? <span className="px-2.5 py-1 rounded-full text-xs font-bold shrink-0" style={{ background: bg, color: fg }}>{t}</span> : null
}

/* ---------- Învățare ---------- */

function Invatare({ d }: { d: Cursant360 }) {
  const p = pct(d)
  return (
    <main className="px-5 pt-6 flex flex-col gap-5">
      <H1>Învățare</H1>
      <section className={`${cardCls} p-[18px] flex flex-col gap-3.5`} style={cardSt}>
        <div><div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: C.muted }}>{d.inscrieri[0]?.program || 'Programul tău'}</div>
          <div className="text-[22px] font-semibold mt-1" style={disp}>Ai parcurs {p}% din drum</div></div>
        <div className="h-2.5 rounded-full" style={{ background: '#EFE9DD' }}><div className="h-2.5 rounded-full" style={{ width: `${p}%`, background: 'linear-gradient(90deg,#1B6E99,#2EA8D8)' }} /></div>
        <ol className="flex flex-col gap-2 m-0 p-0 list-none">
          {d.pasi.map((x, i) => (
            <li key={i} className="flex items-center gap-2.5 text-[13px]">
              {x.stare === 'gata' ? <Check size={16} style={{ color: C.ok }} /> : x.stare === 'curent' ? <span className="w-4 h-4 rounded-full border-[3px]" style={{ borderColor: C.sea }} /> : <Circle size={16} style={{ color: '#C9BFAD' }} />}
              <span className={x.stare === 'curent' ? 'font-bold' : ''} style={{ color: x.stare === 'viitor' ? C.muted : C.ink }}>{x.titlu}</span>
              <span className="ml-auto text-xs" style={{ color: C.muted }}>{x.data ? fmtData(x.data, false) : ''}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="flex flex-col gap-2.5">
        <H2>Cursul tău</H2>
        {d.resurse.length ? <div className={`${cardCls} overflow-hidden`} style={cardSt}>{d.resurse.map(r => <Resursa key={r.url} r={r} />)}</div>
          : <div className={`${cardCls} p-4 text-sm`} style={{ ...cardSt, color: C.muted }}>Linkurile pentru curs (Zoom, materiale, înregistrări) apar aici imediat ce le publică instructorul.</div>}
      </section>
    </main>
  )
}

/* ---------- Practică ---------- */

function Practica({ d }: { d: Cursant360 }) {
  return (
    <main className="px-5 pt-6 flex flex-col gap-5">
      <H1>Practică</H1>
      {d.inscrieri.length === 0 && <div className="text-sm" style={{ color: C.muted }}>Nu ești programat încă la o practică.</div>}
      {d.inscrieri.map((i, k) => {
        const prog = d.programari.find(x => x.sessionId === i.sessionId)
        return (
          <section key={i.studentId} className="rounded-[22px] overflow-hidden" style={k === 0 ? { background: C.navy, color: '#fff' } : { background: '#fff', border: '1px solid #EAE4D8' }}>
            {k === 0 && (
              <div className="h-[110px] relative" style={{ background: 'linear-gradient(170deg,#103A66 0%,#1B6E99 70%,#2EA8D8 100%)' }}>
                <svg viewBox="0 0 390 110" preserveAspectRatio="none" className="absolute inset-0 w-full h-full" aria-hidden><path d="M250 18 L250 84 L300 84 Z" fill="rgba(255,255,255,.85)" /><path d="M246 26 L246 84 L206 84 Z" fill="rgba(255,255,255,.6)" /><path d="M196 88 L310 88 L298 98 L208 98 Z" fill="#0A1628" /><path d="M0 96 C 60 88 120 104 190 96 S 320 88 390 96 L390 110 L0 110 Z" fill="rgba(10,22,40,.55)" /></svg>
                <span className="absolute left-3.5 top-3.5"><SesBadge s={i.stareSesiune} /></span>
              </div>
            )}
            <div className="p-[18px] flex flex-col gap-3">
              <div><div className="text-[22px] font-semibold" style={disp}>{i.program}</div>
                <div className="text-[13px]" style={{ color: k === 0 ? '#B7C4D6' : C.muted }}>{i.dataExamen ? fmtData(i.dataExamen) : 'dată de stabilit'}{i.oraExamen ? ` · ${i.oraExamen}` : ''}{i.clasa ? ` · clasa ${i.clasa}` : ''}</div></div>
              <div className="grid grid-cols-2 gap-2.5 text-[13px]">
                <Box k={k} t="Ambarcațiune" v={i.barci.join(', ') || '—'} />
                <Box k={k} t="Instructor" v={i.instructori.join(', ') || '—'} />
                {i.dataCurs && <Box k={k} t="Început curs" v={fmtData(i.dataCurs)} />}
                <Box k={k} t="Locație" v={i.locatie || '—'} />
              </div>
              {prog && (
                <div className="rounded-[14px] p-3 flex flex-col gap-1.5 text-[13px]" style={{ background: k === 0 ? 'rgba(245,200,66,.12)' : C.seaBg }}>
                  <div className="flex items-center gap-2 font-bold"><CalendarDays size={16} />Ești programat {fmtData(prog.data, false)}, {prog.de}–{prog.pana}</div>
                  {prog.colegi.length > 0 && <div className="flex items-center gap-2" style={{ opacity: .85 }}><Users size={15} />Colegi de interval: {prog.colegi.join(', ')}</div>}
                </div>
              )}
              {i.locatie && (
                <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(i.locatie)}`} target="_blank" rel="noopener noreferrer"
                  className="h-11 rounded-[14px] border flex items-center justify-center gap-2 text-sm font-bold" style={{ borderColor: k === 0 ? 'rgba(255,255,255,.25)' : '#DDD5C6' }}>
                  <MapPin size={17} />Cum ajung
                </a>
              )}
            </div>
          </section>
        )
      })}
      <a href="/portal" className={`${cardCls} p-4 flex items-center gap-3`} style={cardSt}>
        <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: C.seaBg, color: C.sea }}><CalendarDays size={18} /></span>
        <span className="flex-1"><b className="text-sm block">Programează-te sau schimbă intervalul</b><span className="text-xs" style={{ color: C.muted }}>în portalul seriei, cu codul și emailul tău</span></span>
        <ChevronRight size={20} style={{ color: C.muted }} />
      </a>
    </main>
  )
}

function Box({ k, t, v }: { k: number; t: string; v: string }) {
  return <div className="rounded-xl px-3 py-2.5" style={{ background: k === 0 ? 'rgba(255,255,255,.07)' : '#F6F2EA' }}>
    <div className="text-[11px] font-bold uppercase" style={{ color: k === 0 ? '#9FB0C7' : C.muted }}>{t}</div><b>{v}</b></div>
}

/* ---------- Descoperă ---------- */

function Descopera({ d }: { d: Cursant360 }) {
  const [fav, setFav] = useState<string[]>([])
  useEffect(() => { setFav(citeste<string[]>(FAV, [])) }, [])
  function toggle(id: string) {
    const n = fav.includes(id) ? fav.filter(x => x !== id) : [...fav, id]
    setFav(n); scrie(FAV, n)
  }
  const favorite = useMemo(() => d.evenimente.filter(e => fav.includes(e.sessionId)), [d.evenimente, fav])
  const interes = (e: Cursant360['evenimente'][number]) =>
    `mailto:${OFFICE}?subject=${encodeURIComponent(`Mă interesează: ${e.titlu} — ${fmtData(e.data)}`)}&body=${encodeURIComponent(`Bună ziua,\n\naș vrea detalii despre ${e.titlu} din ${fmtData(e.data)}${e.locatie ? ` (${e.locatie})` : ''}.\n\n${d.persoana.full_name}`)}`

  return (
    <main className="px-5 pt-6 flex flex-col gap-5">
      <H1>Descoperă</H1>
      <section className="flex flex-col gap-2.5">
        <H2>Înscrierile mele</H2>
        <div className="flex gap-2.5 overflow-x-auto -mx-5 px-5 pb-1 snap-x">
          {d.inscrieri.map(i => {
            const [t, bg, fg] = i.stareSesiune === 'completed' ? ['Finalizat', C.okBg, C.ok] : i.stareSesiune === 'active' ? ['În curs', C.seaBg, C.sea] : ['Urmează', '#F1ECE2', '#3D4654']
            return (
              <div key={i.studentId} className={`${cardCls} w-[170px] shrink-0 p-3.5 flex flex-col gap-2 snap-start`} style={cardSt}>
                <span className="self-start px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: bg, color: fg }}>{t}</span>
                <b className="text-sm">{i.program}</b>
                <div className="text-xs" style={{ color: C.muted }}>{i.dataExamen ? fmtData(i.dataExamen) : '—'}</div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <H2>Serii viitoare</H2>
        {d.evenimente.length === 0 ? <div className={`${cardCls} p-4 text-sm`} style={{ ...cardSt, color: C.muted }}>Nu sunt serii noi anunțate acum.</div>
          : <div className={`${cardCls} px-3.5`} style={cardSt}>
            {d.evenimente.map(e => {
              const on = fav.includes(e.sessionId)
              return (
                <div key={e.sessionId} className="flex items-center gap-3 py-3 border-b last:border-b-0" style={{ borderColor: '#F0EBE1' }}>
                  <DataBloc d={e.data} />
                  <div className="flex-1 min-w-0"><b className="text-sm">{e.titlu}</b><div className="text-xs truncate" style={{ color: C.muted }}>{e.locatie || '—'}{e.clasa ? ` · ${e.clasa}` : ''}</div>
                    <a href={interes(e)} className="text-xs font-extrabold" style={{ color: C.sea }}>Mă interesează →</a></div>
                  <button onClick={() => toggle(e.sessionId)} aria-pressed={on} aria-label={on ? 'Scoate din favorite' : 'Adaugă la favorite'}
                    className="w-11 h-11 rounded-full flex items-center justify-center shrink-0" style={on ? { background: '#FCE8EC', color: '#C0264E' } : { border: '1px solid #DDD5C6', color: C.muted }}>
                    <Heart size={18} fill={on ? 'currentColor' : 'none'} />
                  </button>
                </div>
              )
            })}
          </div>}
      </section>

      {favorite.length > 0 && (
        <section className={`${cardCls} p-4 flex flex-col gap-2.5`} style={cardSt}>
          <H2 right={<span className="text-xs" style={{ color: C.muted }}>{favorite.length} salvate</span>}>Favorite</H2>
          <div className="flex flex-wrap gap-2">{favorite.map(e => <span key={e.sessionId} className="px-3 py-2 rounded-full text-xs font-bold" style={{ background: '#FCE8EC', color: '#A3123A' }}>{e.titlu} · {fmtData(e.data, false)}</span>)}</div>
        </section>
      )}

      <a href={`mailto:${OFFICE}?subject=${encodeURIComponent('Vreau să recomand un prieten')}`} className="flex gap-3.5 items-center p-4 rounded-[20px]" style={{ background: C.navy, color: '#fff' }}>
        <span className="w-11 h-11 rounded-[14px] flex items-center justify-center shrink-0" style={{ background: C.gold, color: C.navy }}><Users size={20} /></span>
        <span className="flex-1"><b className="text-[15px] block">Adu un prieten la bord</b><span className="text-xs" style={{ color: '#B7C4D6' }}>scrie-ne și îl contactăm noi</span></span>
        <ChevronRight size={20} />
      </a>
    </main>
  )
}

/* ---------- Cont ---------- */

function Cont({ d, iesi }: { d: Cursant360; iesi: () => void }) {
  const f = d.financiar
  const p = d.persoana
  const rest = Object.fromEntries(Object.entries(f.sold).filter(([, v]) => v > 0))
  const areRest = Object.keys(rest).length > 0
  const total = Object.values(f.datorat).reduce((a, b) => a + b, 0)
  const platit = Object.values(f.platit).reduce((a, b) => a + b, 0)

  return (
    <main className="px-5 pt-6 flex flex-col gap-5">
      <div className="flex items-center gap-3.5">
        <div className="w-[60px] h-[60px] rounded-[18px] flex items-center justify-center text-2xl font-semibold" style={{ ...disp, background: C.navy, color: C.gold }}>{initiale(p.full_name)}</div>
        <div><h1 className="text-2xl font-semibold m-0" style={disp}>{p.full_name}</h1><div className="text-[13px]" style={{ color: C.muted }}>{p.class_caa ? `Cursant clasa ${p.class_caa}` : 'Cursant SetSail'}</div></div>
      </div>

      {total > 0 && (
        <section className="rounded-[22px] bg-white p-[18px] flex flex-col gap-3.5 border" style={{ borderColor: areRest ? '#F0C9A0' : '#EAE4D8' }}>
          <div className="flex items-start justify-between gap-3">
            <div><div className="text-[11px] font-bold uppercase tracking-[0.08em]" style={{ color: areRest ? C.warn : C.ok }}>{areRest ? 'De plată' : 'Totul achitat'}</div>
              <div className="text-[32px] font-semibold" style={disp}>{areRest ? fmtSume(rest) : fmtSume(f.platit)}</div>
              {f.urmatoareaScadenta && areRest && <div className="text-[13px]" style={{ color: C.muted }}>scadent {fmtData(f.urmatoareaScadenta)}</div>}</div>
          </div>
          <div className="h-2 rounded-full" style={{ background: '#EFE9DD' }}><div className="h-2 rounded-full" style={{ width: `${Math.min(100, (platit / total) * 100)}%`, background: C.ok }} /></div>
          <div className="text-xs" style={{ color: C.muted }}>Ai achitat <b style={{ color: C.ink }}>{fmtSume(f.platit)}</b> din {fmtSume(f.datorat)}</div>
          <div className="flex flex-col gap-1.5 text-[13px]">
            {f.obligatii.map(o => <div key={o.id} className="flex justify-between gap-3"><span>{o.program}</span><b className="tabular-nums">{o.suma - o.platit > 0 ? `rest ${fmtBani(o.suma - o.platit, o.moneda)}` : 'achitat'}</b></div>)}
          </div>
          {areRest && <a href={`mailto:${OFFICE}?subject=${encodeURIComponent(`Plată — ${p.full_name}`)}`} className="h-12 rounded-[14px] flex items-center justify-center gap-2 font-bold" style={{ background: C.gold, color: C.navy }}><Wallet size={18} />Cere datele de plată</a>}
        </section>
      )}

      {f.plati.length > 0 && (
        <section className={`${cardCls} px-4`} style={cardSt}>
          <h2 className="text-[19px] font-semibold mt-3.5 mb-0.5" style={disp}>Plăți &amp; facturi</h2>
          {f.plati.map(x => (
            <div key={x.id} className="flex items-center gap-3 py-3.5 border-b last:border-b-0 text-sm" style={{ borderColor: '#F0EBE1' }}>
              <span className="w-9 h-9 rounded-[10px] flex items-center justify-center" style={{ background: C.okBg, color: C.ok }}><FileText size={18} /></span>
              <span className="flex-1"><b>{x.facturaNr ? `Factura ${x.facturaNr}` : 'Plată înregistrată'}</b><br /><span className="text-xs" style={{ color: C.muted }}>{fmtData(x.platitLa)}{x.metoda ? ` · ${x.metoda}` : ''}</span></span>
              <b className="tabular-nums">{fmtBani(x.suma, x.moneda)}</b>
            </div>
          ))}
        </section>
      )}

      <section className={`${cardCls} px-4`} style={cardSt}>
        <h2 className="text-[19px] font-semibold mt-3.5 mb-0.5" style={disp}>Datele mele</h2>
        {([['Email', p.email], ['Telefon', p.phone], ['CNP', p.cnp], ['Act identitate', [p.ci_series, p.ci_number].filter(Boolean).join(' ')], ['Adresă', [p.address, p.city, p.county].filter(Boolean).join(', ')]] as [string, string][]).map(([k, v]) => (
          <div key={k} className="flex gap-3 py-3 border-b last:border-b-0 text-sm" style={{ borderColor: '#F0EBE1' }}><span className="w-28 shrink-0" style={{ color: C.muted }}>{k}</span><span className="break-words min-w-0">{v || '—'}</span></div>
        ))}
      </section>

      <section className={`${cardCls} px-4`} style={cardSt}>
        <h2 className="text-[19px] font-semibold mt-3.5 mb-0.5" style={disp}>Documente</h2>
        {d.documente.map(x => (
          <div key={x.nume} className="flex items-center gap-3 py-3 border-b last:border-b-0 text-sm" style={{ borderColor: '#F0EBE1' }}>
            {x.ok ? <Check size={18} style={{ color: C.ok }} /> : <Circle size={18} style={{ color: C.warn }} />}
            <span className="flex-1" style={x.ok ? {} : { fontWeight: 700 }}>{x.nume}</span>
            {!x.ok && <a href="/portal" className="h-9 px-3 rounded-xl text-[13px] font-bold flex items-center" style={{ background: C.navy, color: '#fff' }}>Completează</a>}
          </div>
        ))}
      </section>

      <section className={`${cardCls} p-4 flex flex-col gap-3`} style={cardSt}>
        <h2 className="text-[19px] font-semibold m-0" style={disp}>Brevete &amp; diplome</h2>
        {d.diplome.filter(x => x.activa).length === 0
          ? <div className="flex items-center gap-3 p-3 rounded-[14px] border-[1.5px] border-dashed" style={{ borderColor: '#C9BFAD' }}><Award size={22} style={{ color: C.muted }} /><div><b className="text-sm">Diploma ta</b><div className="text-xs" style={{ color: C.muted }}>apare aici după practică și examen</div></div></div>
          : d.diplome.filter(x => x.activa).map(x => (
            <div key={x.id} className="flex items-center gap-3 p-3 rounded-[14px]" style={{ background: '#FFF6D6' }}>
              <span className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: C.gold, color: C.navy }}><Award size={20} /></span>
              <div><b className="text-sm">Seria {x.serie} nr. {x.numar}</b><div className="text-xs" style={{ color: C.muted }}>emisă {fmtData(x.emisa)}{x.livrata ? ` · livrată ${fmtData(x.livrata)}` : x.tiparita ? ' · tipărită, în curs de livrare' : ''}</div></div>
            </div>
          ))}
      </section>

      <a href={`mailto:${OFFICE}`} className="h-11 rounded-[14px] border flex items-center justify-center gap-2 text-sm font-bold bg-white" style={{ borderColor: '#DDD5C6' }}><Mail size={17} />Scrie-ne</a>
      <button onClick={iesi} className="h-11 rounded-[14px] border flex items-center justify-center gap-2 text-sm font-bold" style={{ borderColor: '#E8C4BF', color: C.bad }}><LogOut size={17} />Deconectare</button>
    </main>
  )
}
