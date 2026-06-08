'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Save, Trash2, RefreshCw, FileText, Users, ShieldAlert, Eye, CalendarDays, TrendingUp } from 'lucide-react'

const API = '/api/radio-landing'

type Path = (string | number)[]
function getPath(obj: any, path: Path): any { return path.reduce((o, k) => (o == null ? o : o[k]), obj) }
function setPath(obj: any, path: Path, val: any): any {
  const clone: any = Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = clone
  for (let i = 0; i < path.length - 1; i++) { const k = path[i]; const nxt = cur[k]; cur[k] = Array.isArray(nxt) ? [...nxt] : { ...nxt }; cur = cur[k] }
  cur[path[path.length - 1]] = val
  return clone
}

export default function RadioAdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [tab, setTab] = useState<'leads' | 'content'>('leads')
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    ;(async () => {
      const v = await fetch(`${API}/verify?token=${encodeURIComponent(t || '')}`).then((r) => r.json()).catch(() => ({ valid: false }))
      if (!v.valid) { setPhase('denied'); return }
      const c = await fetch(`${API}/content`).then((r) => r.json()).catch(() => null)
      setDraft(c?.content || {})
      setPhase('ready')
    })()
  }, [])

  const update = useCallback((path: Path, val: any) => setDraft((d: any) => setPath(d, path, val)), [])

  async function save() {
    setSaving(true); setErr('')
    try {
      const res = await fetch(`${API}/content`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, content: draft }) })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'Salvare eșuată.'); return }
      setSavedAt(new Date().toLocaleTimeString('ro-RO'))
    } catch { setErr('Conexiune eșuată.') } finally { setSaving(false) }
  }

  if (phase === 'checking') return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  if (phase === 'denied') return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
        <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
        <h1 className="text-2xl font-bold text-[#0a2a4e] mb-2">Acces refuzat</h1>
        <p className="text-slate-500 text-sm">Token invalid sau lipsă. Găsești link-ul corect în panoul de administrare → <span className="font-medium">Configurare</span>.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-[family-name:var(--font-inter)]">
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div><h1 className="font-bold text-[#0a2a4e]">Editor Landing — Radio GMDSS/LRC</h1><p className="text-xs text-slate-400">Modifică textele paginii publice</p></div>
          <div className="flex items-center gap-2">
            <a href="/curs-radio-gmdss-lrc" target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition"><Eye size={15} /> Vezi pagina</a>
            {tab === 'content' && <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-[#0a2a4e] text-white font-semibold hover:bg-[#103a66] transition disabled:opacity-60">{saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvează</button>}
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-5 flex gap-1">
          {([['leads', 'Lead-uri', Users], ['content', 'Conținut', FileText]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === k ? 'border-[#2ea8d8] text-[#0a2a4e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}><Icon size={15} /> {label}</button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {err && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{err}</div>}
        {tab === 'content' ? <ContentEditor draft={draft} update={update} /> : <LeadsTab token={token!} />}
      </main>

      {tab === 'content' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f5b528] text-[#0a2a4e] font-bold shadow-lg hover:brightness-95 transition disabled:opacity-60">{saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}{savedAt ? `Salvat ${savedAt}` : 'Salvează modificările'}</button>
        </div>
      )}
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 mb-5">
      <h2 className="px-5 py-3 border-b border-slate-100 font-semibold text-[#0a2a4e] text-sm">{title}</h2>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}
function Txt({ label, value, onChange, rec, area }: { label: string; value: string; onChange: (v: string) => void; rec?: number; area?: boolean }) {
  const len = (value || '').length, over = rec ? len > rec : false
  const cls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2ea8d8] focus:border-transparent'
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1"><span className="text-xs font-medium text-slate-500">{label}</span>{rec ? <span className={`text-[11px] ${over ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{len}/{rec} rec.</span> : null}</div>
      {area ? <textarea className={cls} rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} /> : <input className={cls} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  )
}
function ListTxt({ label, items, onChange, rec }: { label: string; items: string[]; onChange: (v: string[]) => void; rec?: number }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="space-y-2 mt-1">{(items || []).map((it, i) => <Txt key={i} label={`#${i + 1}`} value={it} rec={rec} onChange={(v) => { const n = [...items]; n[i] = v; onChange(n) }} />)}</div>
    </div>
  )
}

function ContentEditor({ draft, update }: { draft: any; update: (p: Path, v: any) => void }) {
  const g = (p: Path) => getPath(draft, p)
  const T = (p: Path, label: string, opts?: { rec?: number; area?: boolean }) => <Txt label={label} value={g(p)} rec={opts?.rec} area={opts?.area} onChange={(v) => update(p, v)} />
  return (
    <div>
      <Card title="Bara de sus (navigație)">
        <div className="grid sm:grid-cols-2 gap-4">{T(['nav', 'brandTitle'], 'Nume brand', { rec: 16 })}{T(['nav', 'brandSubtitle'], 'Subtitlu brand', { rec: 20 })}</div>
        <div className="grid sm:grid-cols-4 gap-3">{(g(['nav', 'links']) || []).map((l: any, i: number) => <Txt key={i} label={`Meniu #${i + 1}`} value={l.label} rec={16} onChange={(v) => update(['nav', 'links', i, 'label'], v)} />)}</div>
        {T(['nav', 'cta'], 'Buton înscriere', { rec: 18 })}
      </Card>

      <Card title="Hero (prima secțiune)">
        {T(['hero', 'eyebrow'], 'Etichetă mică', { rec: 50 })}
        <div className="grid sm:grid-cols-3 gap-4">{T(['hero', 'titleLine1'], 'Titlu rând 1', { rec: 26 })}{T(['hero', 'titleLine2'], 'Titlu rând 2', { rec: 26 })}{T(['hero', 'titleAccent'], 'Titlu accent (cyan)', { rec: 26 })}</div>
        {T(['hero', 'subtitle'], 'Subtitlu', { rec: 150, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">{T(['hero', 'ctaPrimary'], 'Buton principal', { rec: 36 })}{T(['hero', 'ctaSecondary'], 'Buton secundar', { rec: 24 })}</div>
        <div className="grid sm:grid-cols-3 gap-3">{(g(['hero', 'stats']) || []).map((s: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`Statistică #${i + 1} — valoare`} value={s.value} rec={6} onChange={(v) => update(['hero', 'stats', i, 'value'], v)} /><Txt label="etichetă" value={s.label} rec={18} onChange={(v) => update(['hero', 'stats', i, 'label'], v)} /></div>
        ))}</div>
        <div className="border border-slate-100 rounded-lg p-3 space-y-3">
          <p className="text-xs font-semibold text-slate-500">Panou GMDSS (consola din dreapta)</p>
          <div className="grid sm:grid-cols-2 gap-3">{T(['hero', 'console', 'title'], 'Titlu panou', { rec: 28 })}{T(['hero', 'console', 'channel'], 'Canal', { rec: 4 })}</div>
          <div className="grid sm:grid-cols-2 gap-3">{T(['hero', 'console', 'mmsiLabel'], 'Etichetă MMSI', { rec: 8 })}{T(['hero', 'console', 'mmsi'], 'MMSI', { rec: 14 })}</div>
          <div className="grid grid-cols-4 gap-2">{(g(['hero', 'console', 'chips']) || []).map((ch: string, i: number) => <Txt key={i} label={`Chip ${i + 1}`} value={ch} rec={8} onChange={(v) => { const n = [...g(['hero', 'console', 'chips'])]; n[i] = v; update(['hero', 'console', 'chips'], n) }} />)}</div>
          {T(['hero', 'console', 'distressLabel'], 'Text buton roșu', { rec: 12 })}
        </div>
      </Card>

      <Card title="Examen de certificat (highlight verde)">
        <div className="grid sm:grid-cols-2 gap-4">{T(['examHighlight', 'title'], 'Titlu', { rec: 24 })}{T(['examHighlight', 'detail'], 'Detaliu (dată/oră/Zoom)', { rec: 44 })}</div>
      </Card>

      <Card title="Ce acoperă cursul (grid)">
        {T(['coverage', 'eyebrow'], 'Eyebrow', { rec: 24 })}{T(['coverage', 'title'], 'Titlu', { rec: 40 })}
        <div className="grid sm:grid-cols-2 gap-3">{(g(['coverage', 'items']) || []).map((it: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`#${i + 1} — titlu`} value={it.title} rec={22} onChange={(v) => update(['coverage', 'items', i, 'title'], v)} /><Txt label="descriere" value={it.desc} rec={60} onChange={(v) => update(['coverage', 'items', i, 'desc'], v)} /></div>
        ))}</div>
      </Card>

      <Card title="Structura cursului (3 seri)">
        {T(['timeline', 'eyebrow'], 'Eyebrow', { rec: 24 })}{T(['timeline', 'title'], 'Titlu', { rec: 40 })}
        {T(['timeline', 'examBadge'], 'Bandă examen (seara 3)', { rec: 30 })}
        <div className="grid sm:grid-cols-3 gap-3">{(g(['timeline', 'days']) || []).map((day: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`Seara ${i + 1} — titlu`} value={day.title} rec={28} onChange={(v) => update(['timeline', 'days', i, 'title'], v)} /><ListTxt label="puncte" items={day.items} rec={36} onChange={(v) => update(['timeline', 'days', i, 'items'], v)} /></div>
        ))}</div>
      </Card>

      <Card title="„Vei putea să:” + de ce cursul nostru">
        {T(['benefits', 'eyebrow'], 'Eyebrow', { rec: 24 })}{T(['benefits', 'title'], 'Titlu', { rec: 24 })}
        <ListTxt label="Checklist" items={g(['benefits', 'items'])} rec={70} onChange={(v) => update(['benefits', 'items'], v)} />
        <div className="grid sm:grid-cols-2 gap-3">{(g(['benefits', 'why']) || []).map((w: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`Avantaj #${i + 1} — titlu`} value={w.title} rec={30} onChange={(v) => update(['benefits', 'why', i, 'title'], v)} /><Txt label="descriere" value={w.desc} rec={100} area onChange={(v) => update(['benefits', 'why', i, 'desc'], v)} /></div>
        ))}</div>
      </Card>

      <Card title="Pentru cine este cursul">
        {T(['forWhom', 'eyebrow'], 'Eyebrow', { rec: 30 })}
        <div className="grid sm:grid-cols-2 gap-3">{(g(['forWhom', 'cards']) || []).map((card: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`#${i + 1} — titlu`} value={card.title} rec={26} onChange={(v) => update(['forWhom', 'cards', i, 'title'], v)} /><Txt label="descriere" value={card.desc} rec={60} onChange={(v) => update(['forWhom', 'cards', i, 'desc'], v)} /></div>
        ))}</div>
      </Card>

      <Card title="Bloc dată + înscriere">
        {T(['enroll', 'eyebrow'], 'Eyebrow', { rec: 24 })}
        <div className="grid sm:grid-cols-2 gap-4">{T(['enroll', 'dateBig'], 'Data mare (Enter = rând nou)', { rec: 16, area: true })}{T(['enroll', 'dateSub'], 'Subtitlu dată', { rec: 44 })}</div>
        <ListTxt label="Puncte (ultimul = auriu)" items={g(['enroll', 'points'])} rec={40} onChange={(v) => update(['enroll', 'points'], v)} />
        {T(['enroll', 'examNote'], 'Notă examen (verde, sub puncte)', { rec: 36 })}
        {T(['enroll', 'cardTitle'], 'Titlu card', { rec: 34 })}
        <ListTxt label="Puncte card" items={g(['enroll', 'cardPoints'])} rec={34} onChange={(v) => update(['enroll', 'cardPoints'], v)} />
        <div className="grid sm:grid-cols-2 gap-4">{T(['enroll', 'priceGrad'], 'Preț absolvent (mare)', { rec: 10 })}{T(['enroll', 'priceGradUnit'], 'Unitate absolvent', { rec: 28 })}</div>
        <div className="grid sm:grid-cols-2 gap-4">{T(['enroll', 'priceRenew'], 'Preț reînnoire (mare)', { rec: 10 })}{T(['enroll', 'priceRenewUnit'], 'Unitate reînnoire', { rec: 24 })}</div>
        {T(['enroll', 'priceStd'], 'Tarif standard (mic)', { rec: 50 })}
        {T(['enroll', 'ctaLabel'], 'Buton CTA', { rec: 24 })}{T(['enroll', 'ctaNote'], 'Notă sub buton', { rec: 70 })}
        {T(['enroll', 'bonusTitle'], 'Titlu bonus', { rec: 30 })}
        <ListTxt label="Bonusuri" items={g(['enroll', 'bonusItems'])} rec={40} onChange={(v) => update(['enroll', 'bonusItems'], v)} />
      </Card>

      <Card title="Testimoniale">
        {T(['testimonials', 'eyebrow'], 'Eyebrow', { rec: 30 })}{T(['testimonials', 'title'], 'Titlu', { rec: 40 })}
        <div className="grid sm:grid-cols-3 gap-3">{(g(['testimonials', 'items']) || []).map((t: any, i: number) => (
          <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3"><Txt label={`#${i + 1} — citat`} value={t.quote} rec={150} area onChange={(v) => update(['testimonials', 'items', i, 'quote'], v)} /><Txt label="nume" value={t.name} rec={24} onChange={(v) => update(['testimonials', 'items', i, 'name'], v)} /><Txt label="oraș" value={t.city} rec={24} onChange={(v) => update(['testimonials', 'items', i, 'city'], v)} /></div>
        ))}</div>
      </Card>

      <Card title="Secțiune finală CTA">
        {T(['finalCta', 'eyebrow'], 'Eyebrow', { rec: 40 })}{T(['finalCta', 'title'], 'Titlu', { rec: 40 })}{T(['finalCta', 'subtitle'], 'Subtitlu', { rec: 150, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">{T(['finalCta', 'ctaLabel'], 'Buton CTA', { rec: 24 })}{T(['finalCta', 'phone'], 'Telefon', { rec: 20 })}</div>
      </Card>

      <Card title="Footer">
        <div className="grid sm:grid-cols-2 gap-4">{T(['footer', 'brandTitle'], 'Nume brand', { rec: 16 })}{T(['footer', 'brandSubtitle'], 'Subtitlu brand', { rec: 20 })}</div>
        {T(['footer', 'about'], 'Descriere', { rec: 160, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">{T(['footer', 'linksTitle'], 'Titlu coloană linkuri', { rec: 20 })}{T(['footer', 'infoTitle'], 'Titlu coloană info', { rec: 20 })}</div>
        <div className="grid sm:grid-cols-3 gap-4">{T(['footer', 'address'], 'Adresă', { rec: 30 })}{T(['footer', 'phone'], 'Telefon', { rec: 20 })}{T(['footer', 'email'], 'Email', { rec: 30 })}</div>
        {T(['footer', 'newsletterTitle'], 'Titlu newsletter', { rec: 20 })}{T(['footer', 'newsletterText'], 'Text newsletter', { rec: 60 })}{T(['footer', 'copyright'], 'Copyright', { rec: 70 })}
      </Card>

      <Card title="Formular de înscriere (popup)">
        {T(['leadForm', 'title'], 'Titlu', { rec: 30 })}{T(['leadForm', 'subtitle'], 'Subtitlu', { rec: 120, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">{T(['leadForm', 'nameLabel'], 'Etichetă nume', { rec: 24 })}{T(['leadForm', 'phoneLabel'], 'Etichetă telefon', { rec: 20 })}{T(['leadForm', 'emailLabel'], 'Etichetă email', { rec: 20 })}{T(['leadForm', 'messageLabel'], 'Etichetă mesaj', { rec: 30 })}</div>
        {T(['leadForm', 'submitLabel'], 'Buton trimite', { rec: 30 })}{T(['leadForm', 'successTitle'], 'Titlu confirmare', { rec: 24 })}{T(['leadForm', 'successMsg'], 'Mesaj confirmare', { rec: 140, area: true })}
      </Card>
    </div>
  )
}

const STATUSES = ['nou', 'contactat', 'inscris', 'respins'] as const
const STATUS_STYLE: Record<string, string> = { nou: 'bg-blue-50 text-blue-700', contactat: 'bg-amber-50 text-amber-700', inscris: 'bg-emerald-50 text-emerald-700', respins: 'bg-slate-100 text-slate-500' }

function LeadsTab({ token }: { token: string }) {
  const [leads, setLeads] = useState<any[] | null>(null)
  const [filter, setFilter] = useState('all')
  const [stats, setStats] = useState<{ total: number; today: number; last7: number } | null>(null)

  const load = useCallback(async () => {
    const json = await fetch(`${API}/leads?token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null)
    setLeads(json?.leads || [])
    const s = await fetch(`${API}/stats?token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null)
    if (s && typeof s.total === 'number') setStats(s)
  }, [token])
  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: string) {
    setLeads((ls) => (ls || []).map((l) => (l.id === id ? { ...l, status } : l)))
    await fetch(`${API}/leads`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, id, status }) })
  }
  async function remove(id: string) {
    if (!confirm('Ștergi acest lead?')) return
    setLeads((ls) => (ls || []).filter((l) => l.id !== id))
    await fetch(`${API}/leads?token=${encodeURIComponent(token)}&id=${id}`, { method: 'DELETE' })
  }

  if (leads === null) return <div className="text-center text-slate-400 py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
  const shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter)
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: leads.filter((l) => l.status === s).length }), {} as Record<string, number>)
  const visitCards = [
    { icon: Eye, label: 'Total vizite', value: stats?.total, hint: 'de la lansare' },
    { icon: CalendarDays, label: 'Azi', value: stats?.today, hint: 'vizite astăzi' },
    { icon: TrendingUp, label: 'Ultimele 7 zile', value: stats?.last7, hint: 'vizite / săptămână' },
  ]

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-5">
        {visitCards.map(({ icon: Icon, label, value, hint }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <span className="w-10 h-10 rounded-lg bg-[#eef4fb] text-[#2ea8d8] flex items-center justify-center shrink-0"><Icon size={18} /></span>
            <div className="min-w-0"><p className="text-2xl font-extrabold text-[#0a2a4e] leading-none">{value ?? '—'}</p><p className="text-xs text-slate-500 mt-1 truncate">{label}<span className="hidden sm:inline text-slate-400"> · {hint}</span></p></div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === 'all' ? 'bg-[#0a2a4e] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Toate ({leads.length})</button>
          {STATUSES.map((s) => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === s ? 'bg-[#0a2a4e] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{s} ({counts[s]})</button>)}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"><RefreshCw size={13} /> Reîncarcă</button>
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">Niciun lead {filter !== 'all' ? `cu status „${filter}”` : 'încă'}.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="bg-slate-50 text-xs text-slate-400 text-left"><th className="px-4 py-3">Data</th><th className="px-4 py-3">Nume</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Mesaj</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th></tr></thead>
            <tbody className="divide-y divide-slate-50">
              {shown.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('ro-RO')}<br />{new Date(l.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 font-medium text-[#0a2a4e]">{l.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{l.phone && <div><a href={`tel:${l.phone}`} className="hover:text-[#2ea8d8]">{l.phone}</a></div>}{l.email && <div><a href={`mailto:${l.email}`} className="hover:text-[#2ea8d8]">{l.email}</a></div>}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px]">{l.message || '—'}</td>
                  <td className="px-4 py-3"><select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${STATUS_STYLE[l.status] || ''}`}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></td>
                  <td className="px-4 py-3 text-right"><button onClick={() => remove(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition"><Trash2 size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
