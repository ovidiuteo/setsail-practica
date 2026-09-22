'use client'
import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Cursant360 } from '@/lib/c360'
import { fDisplay, fBody, C, disp, fmtData, fmtBani, fmtSume, initiale } from '@/components/c360/ui'
import {
  Ship, LayoutGrid, IdCard, Wallet, BookOpen, Anchor, CalendarDays, Award, StickyNote, ArrowLeft,
  Search, Mail, Phone, MapPin, Link2, Check, Copy, Plus, Trash2, FileText, Video, MessageCircle,
  Users, ExternalLink, Loader2, AlertCircle, Circle, Sparkles, Save,
} from 'lucide-react'

const SECTIUNI = [
  { id: 'prezentare', label: 'Prezentare', icon: LayoutGrid },
  { id: 'financiar', label: 'Financiar', icon: Wallet },
  { id: 'inscrieri', label: 'Înscrieri & practică', icon: Anchor },
  { id: 'invatare', label: 'Învățare', icon: BookOpen },
  { id: 'date', label: 'Date & documente', icon: IdCard },
  { id: 'diplome', label: 'Diplome', icon: Award },
  { id: 'evenimente', label: 'Oportunități', icon: Sparkles },
  { id: 'notite', label: 'Notițe interne', icon: StickyNote },
]

const card = 'bg-white border rounded-2xl'
const cardStyle = { borderColor: C.line }
const lbl = 'text-[11px] font-bold uppercase tracking-[0.08em]'

export default function Cursant360Admin() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [d, setD] = useState<Cursant360 | null>(null)
  const [err, setErr] = useState('')
  const [copiat, setCopiat] = useState(false)

  const incarca = useCallback(async () => {
    const r = await fetch(`/api/c360/admin?id=${id}`, { cache: 'no-store' })
    const j = await r.json()
    if (!r.ok) { setErr(j.error || 'Eroare la încărcare'); return }
    setD(j)
    document.title = `360 · ${j.persoana.full_name}`
  }, [id])
  useEffect(() => { incarca() }, [incarca])

  function copiazaLink() {
    const cod = d?.inscrieri.find(i => i.codSerie)?.codSerie
    if (!cod) return
    navigator.clipboard.writeText(`${location.origin}/portal360?cod=${encodeURIComponent(cod)}`)
    setCopiat(true); setTimeout(() => setCopiat(false), 1800)
  }

  const wrap = `${fDisplay.variable} ${fBody.variable}`
  if (err) return <div className={`${wrap} p-10 text-red-700 flex items-center gap-2`} style={{ fontFamily: 'var(--c360-body)' }}><AlertCircle size={18} />{err}</div>
  if (!d) return <div className={`${wrap} p-10 flex items-center gap-2`} style={{ color: C.muted }}><Loader2 className="animate-spin" size={18} />Se încarcă fișa 360…</div>

  const p = d.persoana
  const f = d.financiar
  const areSold = Object.values(f.sold).some(v => v > 0)
  const cur = d.inscrieri[0]

  return (
    <div className={`${wrap} flex min-h-screen`} style={{ fontFamily: 'var(--c360-body), system-ui, sans-serif', color: C.ink, background: '#EEF0EC' }}>
      {/* Bara 360 */}
      <nav aria-label="Secțiuni Cursant 360" className="hidden lg:flex flex-col gap-1 shrink-0 sticky top-0 h-screen overflow-y-auto"
        style={{ width: 232, background: C.navy, color: '#C9D3E0', padding: '24px 14px' }}>
        <div className="flex items-center gap-3 px-2 pb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.gold, color: C.navy }}><Ship size={18} /></div>
          <div><div className="text-white text-lg font-semibold" style={disp}>Cursant 360</div><div className="text-[11px]" style={{ color: '#8FA0B8' }}>SetSail · practica</div></div>
        </div>
        {SECTIUNI.map(s => (
          <a key={s.id} href={`#${s.id}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 hover:text-white transition-colors">
            <s.icon size={17} />{s.label}
          </a>
        ))}
        <div className="mt-auto pt-4 border-t border-white/10 flex flex-col gap-1">
          <Link href={`/admin/cursanti/${d.seedId}`} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 hover:text-white"><FileText size={17} />Fișa clasică</Link>
          <Link href="/admin/cursanti" className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/10 hover:text-white"><ArrowLeft size={17} />Toți cursanții</Link>
        </div>
      </nav>

      <main className="flex-1 min-w-0 px-5 lg:px-10 py-7 flex flex-col gap-5">
        {/* Bara de sus */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[13px]" style={{ color: C.muted }}>
            <Link href="/admin/cursanti" className="hover:underline" style={{ color: C.sea }}>Cursanți</Link><span>/</span>
            {cur && <><span>{cur.program}</span><span>/</span></>}
            <span className="font-semibold" style={{ color: C.ink }}>{p.full_name}</span>
          </div>
          <CautaCursant onPick={sid => router.push(`/admin/cursanti/360/${sid}`)} />
        </div>

        {/* Antet */}
        <section id="prezentare" className="relative overflow-hidden rounded-2xl p-6 lg:p-7 flex flex-wrap gap-6 items-center scroll-mt-4" style={{ background: C.navy, color: '#fff' }}>
          <div aria-hidden className="absolute rounded-full" style={{ right: -60, top: -80, width: 340, height: 340, border: '1px solid rgba(245,200,66,.18)' }} />
          <div aria-hidden className="absolute rounded-full" style={{ right: 40, top: -20, width: 220, height: 220, border: '1px solid rgba(46,168,216,.22)' }} />
          <div className="w-[84px] h-[84px] rounded-3xl flex items-center justify-center text-3xl font-semibold shrink-0" style={{ ...disp, background: C.gold, color: C.navy }}>{initiale(p.full_name)}</div>
          <div className="flex-1 min-w-[280px] flex flex-col gap-2.5 relative">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl lg:text-4xl font-semibold m-0" style={disp}>{p.full_name}</h1>
              {p.class_caa && <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: 'rgba(245,200,66,.16)', color: C.gold }}>Clasa {p.class_caa}</span>}
              {cur && <StarePortal s={cur.stareCursant} />}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm" style={{ color: '#B7C4D6' }}>
              {p.email && <span className="flex items-center gap-1.5"><Mail size={15} />{p.email}</span>}
              {p.phone && <span className="flex items-center gap-1.5"><Phone size={15} />{p.phone}</span>}
              {(p.city || p.county) && <span className="flex items-center gap-1.5"><MapPin size={15} />{[p.city, p.county].filter(Boolean).join(', ')}</span>}
              <span className="flex items-center gap-1.5"><CalendarDays size={15} />{d.inscrieri.length} {d.inscrieri.length === 1 ? 'serie' : 'serii'}{d.inscrieri.length ? ` · din ${fmtData(d.inscrieri[d.inscrieri.length - 1].creatLa, true)}` : ''}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 relative">
            {p.email && <a href={`mailto:${p.email}`} className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold" style={{ background: C.gold, color: C.navy }}><Mail size={16} />Trimite email</a>}
            <button onClick={copiazaLink} className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold border" style={{ borderColor: 'rgba(255,255,255,.28)' }}>
              {copiat ? <Check size={16} /> : <Link2 size={16} />}{copiat ? 'Copiat' : 'Link portal 360'}
            </button>
            <a href="#financiar" className="h-10 px-4 rounded-xl flex items-center gap-2 text-sm font-semibold border" style={{ borderColor: 'rgba(255,255,255,.28)' }}><Plus size={16} />Adaugă plată</a>
          </div>
        </section>

        {/* Parcurs */}
        {d.pasi.length > 0 && (
          <section className={`${card} px-6 py-5`} style={cardStyle} aria-label="Parcursul cursantului">
            <div className="flex flex-wrap justify-between gap-2 mb-4">
              <div className={lbl} style={{ color: C.muted }}>Parcurs · {cur?.program}</div>
              {d.indicatori.urmatorulPas && <div className="text-[13px]" style={{ color: C.muted }}>Pasul următor: <b style={{ color: C.ink }}>{d.indicatori.urmatorulPas}{d.pasi.find(x => x.stare === 'curent')?.data ? ` — ${fmtData(d.pasi.find(x => x.stare === 'curent')!.data)}` : ''}</b></div>}
            </div>
            <Parcurs pasi={d.pasi} />
          </section>
        )}

        {/* Indicatori */}
        <section className="grid grid-cols-2 xl:grid-cols-5 gap-4" aria-label="Indicatori">
          <Kpi titlu="Total de plată" val={fmtSume(f.datorat)} sub={`${f.obligatii.length} ${f.obligatii.length === 1 ? 'program' : 'programe'}`} />
          <Kpi titlu="Sold de plată" val={fmtSume(f.sold)} sub={f.urmatoareaScadenta ? `scadent ${fmtData(f.urmatoareaScadenta)}` : areSold ? 'fără scadență' : 'achitat'} warn={areSold} />
          <Kpi titlu="Încasat" val={fmtSume(f.platit)} sub={`${f.plati.length} ${f.plati.length === 1 ? 'plată' : 'plăți'}`} />
          <Kpi titlu="Pasul următor" val={d.indicatori.zilePana != null ? (d.indicatori.zilePana <= 0 ? 'azi' : `${d.indicatori.zilePana} zile`) : '—'} sub={d.indicatori.urmatorulPas || 'parcurs încheiat'} />
          <Kpi titlu="Documente lipsă" val={String(d.indicatori.documenteLipsa)} sub={d.indicatori.documenteLipsa ? 'de cerut cursantului' : 'dosar complet'} warn={d.indicatori.documenteLipsa > 0} />
        </section>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_372px] gap-6 items-start">
          <div className="flex flex-col gap-6 min-w-0">
            <Financiar d={d} onChange={incarca} />
            <Inscrieri d={d} />
            <Invatare d={d} />
          </div>
          <aside className="flex flex-col gap-6">
            <DatePersonale d={d} />
            <Diplome d={d} />
            <Oportunitati d={d} />
            <Notite d={d} />
          </aside>
        </div>
      </main>
    </div>
  )
}

function StarePortal({ s }: { s: string }) {
  const m: Record<string, [string, string, string]> = {
    signed: ['Date completate', 'rgba(76,201,140,.16)', '#7FE0B0'],
    pending: ['Așteaptă datele', 'rgba(245,200,66,.14)', C.gold],
    absent: ['Absent', 'rgba(255,255,255,.1)', '#DCE4EE'],
  }
  const [t, bg, fg] = m[s] || [s || '—', 'rgba(255,255,255,.1)', '#DCE4EE']
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1.5" style={{ background: bg, color: fg }}><span className="w-[7px] h-[7px] rounded-full" style={{ background: fg }} />{t}</span>
}

function Kpi({ titlu, val, sub, warn }: { titlu: string; val: string; sub: string; warn?: boolean }) {
  return (
    <div className="rounded-2xl border px-5 py-4 flex flex-col gap-1.5" style={warn ? { background: '#FFF8EF', borderColor: '#F0C9A0' } : { background: '#fff', borderColor: C.line }}>
      <div className={lbl} style={{ color: warn ? C.warn : C.muted }}>{titlu}</div>
      <div className="text-[26px] font-semibold leading-tight" style={{ ...disp, color: warn ? C.warn : C.ink }}>{val}</div>
      <div className="text-xs" style={{ color: warn ? C.warn : C.muted }}>{sub}</div>
    </div>
  )
}

function Parcurs({ pasi }: { pasi: Cursant360['pasi'] }) {
  return (
    <ol className="grid gap-0" style={{ gridTemplateColumns: `repeat(${pasi.length}, minmax(0, 1fr))` }}>
      {pasi.map((x, i) => {
        const gata = x.stare === 'gata', curent = x.stare === 'curent'
        const next = pasi[i + 1]
        return (
          <li key={i} className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center">
              {gata ? <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white" style={{ background: C.ok }}><Check size={15} strokeWidth={3} /></span>
                : curent ? <span className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-white" style={{ border: `3px solid ${C.sea}` }}><span className="w-2 h-2 rounded-full" style={{ background: C.sea }} /></span>
                  : <span className="w-7 h-7 rounded-full shrink-0 bg-white" style={{ border: '2px solid #C3C9C0' }} />}
              {next && <span className="h-[3px] flex-1" style={{ background: gata && next.stare !== 'viitor' ? C.ok : gata ? C.ok : '#DADFD8' }} />}
            </div>
            <div className="text-[13px] font-bold pr-2" style={{ color: curent ? C.sea : C.ink }}>{x.titlu}</div>
            <div className="text-xs pr-2" style={{ color: C.muted }}>{x.data ? fmtData(x.data) : '—'}{x.detaliu ? ` · ${x.detaliu}` : ''}</div>
          </li>
        )
      })}
    </ol>
  )
}

function Titlu({ icon: I, children, right }: { icon: any; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2.5"><I size={19} style={{ color: C.sea }} /><h2 className="text-[22px] font-semibold m-0" style={disp}>{children}</h2></div>
      {right}
    </div>
  )
}

/* ---------- Financiar ---------- */

function Financiar({ d, onChange }: { d: Cursant360; onChange: () => void }) {
  const f = d.financiar
  const [form, setForm] = useState<null | 'obligatie' | 'plata'>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const azi = new Date().toISOString().slice(0, 10)
  const [o, setO] = useState({ program: d.inscrieri[0]?.program || '', suma: '', moneda: 'EUR', scadenta: '', note: '' })
  const [pl, setPl] = useState({ obligatie_id: '', suma: '', moneda: 'EUR', platit_la: azi, metoda: 'transfer bancar', factura_nr: '', note: '' })

  async function post(body: any) {
    setBusy(true); setMsg('')
    const r = await fetch('/api/c360/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) { setMsg(j.error || 'Eroare'); return false }
    await onChange(); return true
  }

  const total = Object.values(f.datorat).reduce((a, b) => a + b, 0)
  const platit = Object.values(f.platit).reduce((a, b) => a + b, 0)
  const pct = total > 0 ? Math.min(100, (platit / total) * 100) : 0

  const inp = 'h-10 px-3 rounded-lg border text-sm bg-white w-full'
  return (
    <section id="financiar" className={`${card} p-6 flex flex-col gap-5 scroll-mt-4`} style={cardStyle}>
      <Titlu icon={Wallet} right={
        <div className="flex gap-2">
          <button onClick={() => setForm(form === 'obligatie' ? null : 'obligatie')} className="h-9 px-4 rounded-lg border text-sm font-semibold flex items-center gap-1.5" style={{ borderColor: '#D5D9D2' }}><Plus size={15} />Program de plată</button>
          <button onClick={() => setForm(form === 'plata' ? null : 'plata')} className="h-9 px-4 rounded-lg text-sm font-semibold text-white flex items-center gap-1.5" style={{ background: C.ink }}><Plus size={15} />Încasare</button>
        </div>
      }>Financiar &amp; facturare</Titlu>

      {total > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex justify-between text-[13px]"><span><b>{fmtSume(f.platit)}</b> încasat din <b>{fmtSume(f.datorat)}</b></span>{Object.values(f.sold).some(v => v > 0) && <span style={{ color: C.warn }} className="font-semibold">rest {fmtSume(Object.fromEntries(Object.entries(f.sold).filter(([, v]) => v > 0)))}</span>}</div>
          <div className="h-3 rounded-md overflow-hidden flex" style={{ background: '#E7EAE4' }}>
            <div style={{ width: `${pct}%`, background: C.sea }} />
            <div style={{ width: `${100 - pct}%`, background: 'repeating-linear-gradient(45deg,#F6D9B8 0 6px,#FBEBD8 6px 12px)' }} />
          </div>
        </div>
      )}

      {form === 'obligatie' && (
        <form onSubmit={async e => { e.preventDefault(); if (await post({ action: 'obligatie', student_id: d.inscrieri[0]?.studentId || d.seedId, ...o })) { setForm(null); setO({ ...o, suma: '', note: '' }) } }}
          className="grid grid-cols-2 md:grid-cols-5 gap-3 p-4 rounded-xl" style={{ background: '#F6F7F4' }}>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Program / serviciu<input required className={inp} value={o.program} onChange={e => setO({ ...o, program: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Sumă<input required inputMode="decimal" className={inp} value={o.suma} onChange={e => setO({ ...o, suma: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Monedă<select className={inp} value={o.moneda} onChange={e => setO({ ...o, moneda: e.target.value })}><option>EUR</option><option>RON</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Scadență<input type="date" className={inp} value={o.scadenta} onChange={e => setO({ ...o, scadenta: e.target.value })} /></label>
          <label className="col-span-2 md:col-span-4 flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Notă internă<input className={inp} value={o.note} onChange={e => setO({ ...o, note: e.target.value })} /></label>
          <button disabled={busy} className="self-end h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.ink }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvează</button>
        </form>
      )}
      {form === 'plata' && (
        <form onSubmit={async e => { e.preventDefault(); if (await post({ action: 'plata', student_id: d.inscrieri[0]?.studentId || d.seedId, ...pl })) { setForm(null); setPl({ ...pl, suma: '', factura_nr: '', note: '' }) } }}
          className="grid grid-cols-2 md:grid-cols-6 gap-3 p-4 rounded-xl" style={{ background: '#F6F7F4' }}>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Pentru<select className={inp} value={pl.obligatie_id} onChange={e => {
            const ob = f.obligatii.find(x => x.id === e.target.value)
            setPl({ ...pl, obligatie_id: e.target.value, moneda: ob?.moneda || pl.moneda, suma: ob && !pl.suma ? String(Math.max(0, ob.suma - ob.platit)) : pl.suma })
          }}><option value="">— general —</option>{f.obligatii.map(x => <option key={x.id} value={x.id}>{x.program}</option>)}</select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Sumă<input required inputMode="decimal" className={inp} value={pl.suma} onChange={e => setPl({ ...pl, suma: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Monedă<select className={inp} value={pl.moneda} onChange={e => setPl({ ...pl, moneda: e.target.value })}><option>EUR</option><option>RON</option></select></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Data<input type="date" className={inp} value={pl.platit_la} onChange={e => setPl({ ...pl, platit_la: e.target.value })} /></label>
          <label className="flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Metodă<select className={inp} value={pl.metoda} onChange={e => setPl({ ...pl, metoda: e.target.value })}><option>transfer bancar</option><option>card</option><option>numerar</option><option>voucher</option></select></label>
          <label className="col-span-2 flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Nr. factură<input className={inp} value={pl.factura_nr} onChange={e => setPl({ ...pl, factura_nr: e.target.value })} /></label>
          <label className="col-span-2 md:col-span-3 flex flex-col gap-1 text-xs font-semibold" style={{ color: C.muted }}>Notă internă<input className={inp} value={pl.note} onChange={e => setPl({ ...pl, note: e.target.value })} /></label>
          <button disabled={busy} className="self-end h-10 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.ink }}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}Salvează</button>
        </form>
      )}
      {msg && <div className="text-sm" style={{ color: C.bad }}>{msg}</div>}

      {f.obligatii.length === 0 && f.plati.length === 0 ? (
        <div className="text-sm rounded-xl p-4" style={{ background: '#F6F7F4', color: C.muted }}>Nicio sumă înregistrată încă. Adaugă un <b>program de plată</b> (ce are de achitat) și apoi <b>încasările</b>, cu numărul facturii.</div>
      ) : (
        <>
          {f.obligatii.length > 0 && (
            <table className="w-full text-sm border-collapse">
              <thead><tr className="text-left">{['Program', 'Preț', 'Plătit', 'Sold', 'Status', ''].map((h, i) => <th key={i} className={`${lbl} py-2 border-b ${i > 0 && i < 5 ? 'text-right' : ''}`} style={{ color: C.muted, borderColor: C.line }}>{h}</th>)}</tr></thead>
              <tbody>
                {f.obligatii.map(o => {
                  const sold = Math.round((o.suma - o.platit) * 100) / 100
                  const st = sold <= 0 ? ['Achitat', C.okBg, C.ok] : o.platit > 0 ? ['Parțial', C.warnBg, C.warn] : ['Neachitat', C.warnBg, C.warn]
                  return (
                    <tr key={o.id} className="border-b" style={{ borderColor: '#EEF0EC' }}>
                      <td className="py-3"><div className="font-bold">{o.program}</div><div className="text-xs" style={{ color: C.muted }}>{o.scadenta ? `scadent ${fmtData(o.scadenta)}` : 'fără scadență'}{o.note ? ` · ${o.note}` : ''}</div></td>
                      <td className="text-right tabular-nums">{fmtBani(o.suma, o.moneda)}</td>
                      <td className="text-right tabular-nums">{fmtBani(o.platit, o.moneda)}</td>
                      <td className="text-right tabular-nums font-bold" style={{ color: sold > 0 ? C.warn : C.muted }}>{fmtBani(Math.max(0, sold), o.moneda)}</td>
                      <td className="text-right"><span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: st[1], color: st[2] }}>{st[0]}</span></td>
                      <td className="text-right w-10"><button aria-label={`Șterge ${o.program}`} onClick={() => confirm(`Ștergi programul „${o.program}”? Plățile legate rămân, fără legătură.`) && post({ action: 'sterge_obligatie', id: o.id })} className="p-1.5 rounded-md hover:bg-red-50" style={{ color: C.muted }}><Trash2 size={15} /></button></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {f.plati.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className={lbl} style={{ color: C.muted }}>Încasări &amp; facturi</div>
              <div className="grid md:grid-cols-2 gap-2">
                {f.plati.map(x => (
                  <div key={x.id} className="flex items-center justify-between gap-3 text-[13px] px-3 py-2.5 rounded-xl" style={{ background: '#F6F7F4' }}>
                    <span className="flex items-center gap-2.5 min-w-0"><FileText size={17} style={{ color: C.ok }} className="shrink-0" />
                      <span className="min-w-0"><b>{x.facturaNr || 'fără factură'}</b> · {x.metoda || '—'}<br /><span style={{ color: C.muted }}>{fmtData(x.platitLa)}{x.obligatieId ? ` · ${f.obligatii.find(o => o.id === x.obligatieId)?.program || ''}` : ''}{x.note ? ` · ${x.note}` : ''}</span></span>
                    </span>
                    <span className="flex items-center gap-2 shrink-0"><b className="tabular-nums">{fmtBani(x.suma, x.moneda)}</b>
                      <button aria-label="Șterge încasarea" onClick={() => confirm('Ștergi această încasare?') && post({ action: 'sterge_plata', id: x.id })} className="p-1 rounded-md hover:bg-red-50" style={{ color: C.muted }}><Trash2 size={14} /></button></span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}

/* ---------- Înscrieri & practică ---------- */

function Inscrieri({ d }: { d: Cursant360 }) {
  return (
    <section id="inscrieri" className={`${card} p-6 flex flex-col gap-5 scroll-mt-4`} style={cardStyle}>
      <Titlu icon={Anchor}>Înscrieri &amp; practică</Titlu>
      {d.inscrieri.length === 0 && <div className="text-sm" style={{ color: C.muted }}>Nicio serie.</div>}
      {d.inscrieri.map((i, k) => {
        const prog = d.programari.find(p => p.sessionId === i.sessionId)
        return (
          <div key={i.studentId} className="rounded-xl border p-4 flex flex-col gap-3" style={{ borderColor: k === 0 ? '#F5C842' : C.line, background: k === 0 ? '#FFFDF3' : '#fff' }}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-bold">{i.program}{i.clasa ? ` · clasa ${i.clasa}` : ''}{i.doarNavigatie ? ' · doar navigație' : ''}</div>
                <div className="text-xs" style={{ color: C.muted }}>{i.locatie || '—'} · cod serie <span className="font-mono">{i.codSerie || '—'}</span> · {i.tipSesiune || 'serie'}</div>
              </div>
              <div className="flex gap-2 items-center">
                <StareSesiune s={i.stareSesiune} />
                <Link href={`/admin/sesiuni/${i.sessionId}`} className="text-xs font-bold flex items-center gap-1" style={{ color: C.sea }}>Sesiunea<ExternalLink size={12} /></Link>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
              <Info t="Curs" v={i.dataCurs ? fmtData(i.dataCurs) : '—'} />
              <Info t="Practică / examen" v={i.dataExamen ? fmtData(i.dataExamen) : '—'} s={i.oraExamen} />
              <Info t="Instructor" v={i.instructori.join(', ') || '—'} />
              <Info t="Ambarcațiune" v={i.barci.join(', ') || '—'} />
            </div>
            {prog && (
              <div className="flex flex-wrap items-center gap-3 text-[13px] rounded-lg px-3 py-2.5" style={{ background: C.seaBg }}>
                <CalendarDays size={16} style={{ color: C.sea }} />
                <span>Programat la practică <b>{fmtData(prog.data)}, {prog.de}–{prog.pana}</b></span>
                {prog.colegi.length > 0 && <span className="flex items-center gap-1.5" style={{ color: C.muted }}><Users size={14} />cu {prog.colegi.join(', ')}</span>}
              </div>
            )}
          </div>
        )
      })}
    </section>
  )
}

function StareSesiune({ s }: { s: string }) {
  const m: Record<string, [string, string, string]> = { active: ['Activă', C.okBg, C.ok], draft: ['Pregătire', C.seaBg, C.sea], completed: ['Finalizată', '#F1F2EE', '#3D4654'] }
  const [t, bg, fg] = m[s] || [s || '—', '#F1F2EE', '#3D4654']
  return <span className="px-2.5 py-1 rounded-full text-xs font-bold" style={{ background: bg, color: fg }}>{t}</span>
}

function Info({ t, v, s }: { t: string; v: string; s?: string }) {
  return <div className="rounded-lg border px-3 py-2.5" style={{ borderColor: C.line }}><div className={lbl} style={{ color: C.muted }}>{t}</div><div className="font-bold mt-1">{v}</div>{s && <div style={{ color: C.muted }}>{s}</div>}</div>
}

/* ---------- Învățare ---------- */

const RES_ICON = { zoom: Video, whatsapp: MessageCircle, video: Video, materiale: BookOpen, comunitate: Users }

function Invatare({ d }: { d: Cursant360 }) {
  return (
    <section id="invatare" className={`${card} p-6 flex flex-col gap-4 scroll-mt-4`} style={cardStyle}>
      <Titlu icon={BookOpen}>Învățare</Titlu>
      {d.resurse.length === 0
        ? <div className="text-sm" style={{ color: C.muted }}>Seriile cursantului nu au linkuri de curs completate (Zoom, arhivă video, materiale). Le adaugi din pagina sesiunii.</div>
        : <div className="grid md:grid-cols-2 gap-2">
          {d.resurse.map(r => {
            const I = RES_ICON[r.tip]
            return (
              <a key={r.url} href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-3 py-3 rounded-xl border hover:bg-[#F6F7F4]" style={{ borderColor: C.line }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: C.seaBg, color: C.sea }}><I size={17} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{r.titlu}</span><span className="block text-xs truncate" style={{ color: C.muted }}>{r.url.replace(/^https?:\/\//, '')}</span></span>
                <ExternalLink size={14} style={{ color: C.muted }} />
              </a>
            )
          })}
        </div>}
      <div className="text-xs rounded-lg px-3 py-2.5" style={{ background: '#F6F7F4', color: C.muted }}>Progresul pe module, vizionările și scorurile la testele grilă vor apărea aici după ce testul și materialele înregistrează activitatea cursantului.</div>
    </section>
  )
}

/* ---------- Coloana dreaptă ---------- */

function DatePersonale({ d }: { d: Cursant360 }) {
  const p = d.persoana
  const rows: [string, string][] = [
    ['CNP', p.cnp], ['Act identitate', [p.ci_series, p.ci_number].filter(Boolean).join(' ') + (p.expiry_date ? ` · exp. ${p.expiry_date}` : '')],
    ['Născut', p.birth_date], ['Cetățenie', p.nationality],
    ['Adresă', [p.address, p.city, p.county, p.country && p.country !== 'Romania' ? p.country : ''].filter(Boolean).join(', ')],
    ['Clasa CAA', p.class_caa], ['Livrare diplomă', [p.livrare_tip, p.livrare_adresa].filter(Boolean).join(' · ')],
  ]
  return (
    <section id="date" className={`${card} p-5 flex flex-col gap-4 scroll-mt-4`} style={cardStyle}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold m-0" style={disp}>Date personale</h2>
        <Link href={`/admin/cursanti/${d.seedId}`} className="h-8 px-3 rounded-lg border text-[13px] font-semibold flex items-center" style={{ borderColor: '#D5D9D2' }}>Editează</Link></div>
      <dl className="grid grid-cols-[110px_minmax(0,1fr)] gap-x-3 gap-y-2.5 text-[13px] m-0">
        {rows.map(([k, v]) => <Fragment key={k}><dt style={{ color: C.muted }}>{k}</dt><dd className="m-0 break-words">{v || '—'}</dd></Fragment>)}
      </dl>
      <div className="border-t pt-3 flex flex-col gap-2.5" style={{ borderColor: '#EEF0EC' }}>
        <div className={lbl} style={{ color: C.muted }}>Documente</div>
        {d.documente.map(x => (
          <div key={x.nume} className="flex justify-between items-center text-[13px]">
            <span className="flex items-center gap-2.5" style={x.ok ? {} : { color: C.warn, fontWeight: 700 }}>{x.ok ? <Check size={16} style={{ color: C.ok }} /> : <Circle size={16} />}{x.nume}</span>
            <span style={{ color: C.muted }}>{x.ok ? (x.detaliu ? fmtData(x.detaliu) : 'da') : 'lipsă'}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Diplome({ d }: { d: Cursant360 }) {
  return (
    <section id="diplome" className={`${card} p-5 flex flex-col gap-3 scroll-mt-4`} style={cardStyle}>
      <h2 className="text-xl font-semibold m-0" style={disp}>Diplome</h2>
      {d.diplome.length === 0 ? <div className="text-[13px]" style={{ color: C.muted }}>Nicio diplomă emisă. O emiți din fișa clasică.</div>
        : d.diplome.map(x => (
          <div key={x.id} className="flex items-center gap-3 text-[13px] px-3 py-2.5 rounded-xl" style={{ background: x.activa ? '#FFF6D6' : '#F6F7F4' }}>
            <Award size={18} style={{ color: x.activa ? C.navy : C.muted }} />
            <div className="flex-1"><b>Seria {x.serie} nr. {x.numar}</b>{!x.activa && ' · anulată'}<div style={{ color: C.muted }}>emisă {fmtData(x.emisa)}{x.tiparita ? ` · tipărită ${fmtData(x.tiparita)}` : ''}{x.livrata ? ` · livrată ${fmtData(x.livrata)}` : ''}</div></div>
          </div>
        ))}
    </section>
  )
}

function Oportunitati({ d }: { d: Cursant360 }) {
  return (
    <section id="evenimente" className={`${card} p-5 flex flex-col gap-3 scroll-mt-4`} style={{ borderColor: C.gold }}>
      <div className="flex items-center gap-2.5"><span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: C.gold, color: C.navy }}><Sparkles size={16} /></span><h2 className="text-xl font-semibold m-0" style={disp}>Oportunități</h2></div>
      <div className="text-xs" style={{ color: C.muted }}>Serii viitoare în care nu e înscris — de propus.</div>
      {d.evenimente.length === 0 ? <div className="text-[13px]" style={{ color: C.muted }}>Nicio serie viitoare programată.</div>
        : d.evenimente.slice(0, 5).map(e => (
          <div key={e.sessionId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: '#F6F7F4' }}>
            <div className="w-12 text-center shrink-0"><div className="text-[10px] font-extrabold" style={{ color: C.warn }}>{fmtData(e.data, false).split(' ')[1]?.toUpperCase()}</div><div className="text-xl font-semibold leading-none" style={disp}>{fmtData(e.data, false).split(' ')[0]}</div></div>
            <div className="flex-1 min-w-0 text-[13px]"><b>{e.titlu}</b><div className="truncate" style={{ color: C.muted }}>{e.locatie || '—'}{e.clasa ? ` · ${e.clasa}` : ''}</div></div>
            {d.persoana.email && <a href={`mailto:${d.persoana.email}?subject=${encodeURIComponent(`${e.titlu} — ${fmtData(e.data)}`)}`} aria-label={`Propune ${e.titlu}`} className="p-2 rounded-lg hover:bg-white" style={{ color: C.sea }}><Mail size={16} /></a>}
          </div>
        ))}
    </section>
  )
}

function Notite({ d }: { d: Cursant360 }) {
  const [t, setT] = useState(d.notite)
  const [st, setSt] = useState<'' | 'saving' | 'ok'>('')
  async function save() {
    setSt('saving')
    await fetch('/api/c360/admin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'notite', student_id: d.seedId, notes: t }) })
    setSt('ok'); setTimeout(() => setSt(''), 1500)
  }
  return (
    <section id="notite" className={`${card} p-5 flex flex-col gap-3 scroll-mt-4`} style={{ ...cardStyle, background: '#FFFDF5' }}>
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold m-0" style={disp}>Notițe interne</h2><span className="text-xs" style={{ color: C.muted }}>vizibile doar echipei</span></div>
      <label htmlFor="c360-note" className="sr-only">Notițe interne</label>
      <textarea id="c360-note" value={t} onChange={e => setT(e.target.value)} rows={5} className="rounded-xl border p-3 text-[13px] bg-white resize-y" style={{ borderColor: C.line }} placeholder="Scrie o notiță…" />
      <button onClick={save} disabled={st === 'saving' || t === d.notite && st !== 'ok'} className="h-9 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50" style={{ background: C.ink }}>
        {st === 'saving' ? <Loader2 size={15} className="animate-spin" /> : st === 'ok' ? <Check size={15} /> : <Save size={15} />}{st === 'ok' ? 'Salvat' : 'Salvează notițele'}
      </button>
    </section>
  )
}

/* ---------- Căutare ---------- */

function CautaCursant({ onPick }: { onPick: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [res, setRes] = useState<Array<{ id: string; full_name: string; email: string }>>([])
  useEffect(() => {
    const s = q.trim()
    if (s.length < 3) { setRes([]); return }
    const t = setTimeout(async () => {
      const pat = `%${s.replace(/[%,()]/g, ' ')}%`
      const { data } = await supabase.from('students').select('id, full_name, email').or(`full_name.ilike.${pat},email.ilike.${pat}`).order('created_at', { ascending: false }).limit(8)
      setRes(data || [])
    }, 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative">
      <label htmlFor="c360-q" className="sr-only">Caută cursant</label>
      <div className="flex items-center gap-2 h-10 w-[320px] max-w-full px-3 bg-white border rounded-xl" style={{ borderColor: '#D5D9D2', color: C.muted }}>
        <Search size={17} /><input id="c360-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Caută cursant, email…" className="flex-1 outline-none text-sm bg-transparent" style={{ color: C.ink }} />
      </div>
      {res.length > 0 && (
        <ul className="absolute right-0 top-11 z-30 w-[320px] bg-white border rounded-xl shadow-lg py-1" style={{ borderColor: C.line }}>
          {res.map(r => <li key={r.id}><button onClick={() => { setQ(''); setRes([]); onPick(r.id) }} className="w-full text-left px-3 py-2 hover:bg-[#F6F7F4] text-sm"><b>{r.full_name}</b><div className="text-xs truncate" style={{ color: C.muted }}>{r.email}</div></button></li>)}
        </ul>
      )}
    </div>
  )
}
