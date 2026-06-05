'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Loader2, Save, Trash2, RefreshCw, Upload,
  Image as ImageIcon, FileText, Users, ShieldAlert, Eye,
} from 'lucide-react'

const display = 'font-[family-name:var(--font-playfair)]'

// ---------- path helpers (immutable) ----------
type Path = (string | number)[]
function getPath(obj: any, path: Path): any {
  return path.reduce((o, k) => (o == null ? o : o[k]), obj)
}
function setPath(obj: any, path: Path, val: any): any {
  const clone: any = Array.isArray(obj) ? [...obj] : { ...obj }
  let cur = clone
  for (let i = 0; i < path.length - 1; i++) {
    const k = path[i]
    const nxt = cur[k]
    cur[k] = Array.isArray(nxt) ? [...nxt] : { ...nxt }
    cur = cur[k]
  }
  cur[path[path.length - 1]] = val
  return clone
}

export default function LandingAdminPage() {
  const [token, setToken] = useState<string | null>(null)
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [tab, setTab] = useState<'content' | 'leads'>('leads')
  const [draft, setDraft] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<string>('')
  const [err, setErr] = useState('')

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token')
    setToken(t)
    ;(async () => {
      const v = await fetch(`/api/cds-landing/verify?token=${encodeURIComponent(t || '')}`).then((r) => r.json()).catch(() => ({ valid: false }))
      if (!v.valid) { setPhase('denied'); return }
      const c = await fetch('/api/cds-landing/content').then((r) => r.json()).catch(() => null)
      setDraft(c?.content || {})
      setPhase('ready')
    })()
  }, [])

  const update = useCallback((path: Path, val: any) => setDraft((d: any) => setPath(d, path, val)), [])

  async function save() {
    setSaving(true); setErr('')
    try {
      const res = await fetch('/api/cds-landing/content', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, content: draft }),
      })
      const json = await res.json()
      if (!res.ok || !json.ok) { setErr(json.error || 'Salvare eșuată.'); return }
      setSavedAt(new Date().toLocaleTimeString('ro-RO'))
    } catch { setErr('Conexiune eșuată.') }
    finally { setSaving(false) }
  }

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className={`${display} text-2xl font-bold text-[#0a2a4e] mb-2`}>Acces refuzat</h1>
          <p className="text-slate-500 text-sm">Token invalid sau lipsă. Găsești link-ul corect în panoul de administrare → <span className="font-medium">Configurare</span>.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-[family-name:var(--font-inter)]">
      {/* top bar */}
      <header className="sticky top-0 z-30 bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-5 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="font-bold text-[#0a2a4e]">Editor Landing — Curs CDS</h1>
            <p className="text-xs text-slate-400">Modifică textele și imaginile paginii publice</p>
          </div>
          <div className="flex items-center gap-2">
            <a href="/curs-yachting-cds" target="_blank" className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 transition"><Eye size={15} /> Vezi pagina</a>
            {tab === 'content' && (
              <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg bg-[#0a2a4e] text-white font-semibold hover:bg-[#103a66] transition disabled:opacity-60">
                {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Salvează
              </button>
            )}
          </div>
        </div>
        {/* tabs */}
        <div className="max-w-5xl mx-auto px-5 flex gap-1">
          {([['leads', 'Lead-uri', Users], ['content', 'Conținut', FileText]] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${tab === k ? 'border-[#2ea8d8] text-[#0a2a4e]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
              <Icon size={15} /> {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-5 py-6">
        {err && <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5">{err}</div>}
        {tab === 'content'
          ? <ContentEditor draft={draft} update={update} token={token!} />
          : <LeadsTab token={token!} />}
      </main>

      {/* floating save state */}
      {tab === 'content' && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-30">
          <button onClick={save} disabled={saving} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-[#f5b528] text-[#0a2a4e] font-bold shadow-lg hover:bg-[#e0a014] transition disabled:opacity-60">
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Save size={17} />}
            {savedAt ? `Salvat ${savedAt}` : 'Salvează modificările'}
          </button>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Reusable field inputs
// ============================================================
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-xl border border-slate-200 mb-5">
      <h2 className="px-5 py-3 border-b border-slate-100 font-semibold text-[#0a2a4e] text-sm">{title}</h2>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  )
}

function Txt({ label, value, onChange, rec, area }: { label: string; value: string; onChange: (v: string) => void; rec?: number; area?: boolean }) {
  const len = (value || '').length
  const over = rec ? len > rec : false
  const cls = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2ea8d8] focus:border-transparent'
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        {rec ? <span className={`text-[11px] ${over ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>{len}/{rec} rec.</span> : null}
      </div>
      {area
        ? <textarea className={cls} rows={3} value={value || ''} onChange={(e) => onChange(e.target.value)} />
        : <input className={cls} value={value || ''} onChange={(e) => onChange(e.target.value)} />}
    </label>
  )
}

function ListTxt({ label, items, onChange, rec }: { label: string; items: string[]; onChange: (v: string[]) => void; rec?: number }) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="space-y-2 mt-1">
        {(items || []).map((it, i) => (
          <Txt key={i} label={`#${i + 1}`} value={it} rec={rec} onChange={(v) => { const n = [...items]; n[i] = v; onChange(n) }} />
        ))}
      </div>
    </div>
  )
}

function ImageField({ label, value, onChange, token, slot, dims }: { label: string; value: string; onChange: (v: string) => void; token: string; slot: string; dims: string }) {
  const [busy, setBusy] = useState(false)
  const [e, setE] = useState('')
  async function upload(file: File) {
    setBusy(true); setE('')
    const fd = new FormData()
    fd.append('file', file); fd.append('token', token); fd.append('slot', slot)
    try {
      const res = await fetch('/api/cds-landing/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok || !json.ok) { setE(json.error || 'Upload eșuat.'); return }
      onChange(json.url)
    } catch { setE('Conexiune eșuată.') }
    finally { setBusy(false) }
  }
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-500 flex items-center gap-1.5"><ImageIcon size={13} /> {label}</span>
        <span className="text-[11px] text-[#2ea8d8] font-medium">Recomandat: {dims}</span>
      </div>
      <div className="flex gap-3 items-center">
        {value
          ? <img src={value} alt="" className="w-20 h-14 object-cover rounded-md border border-slate-200 shrink-0" />
          : <div className="w-20 h-14 rounded-md bg-slate-100 flex items-center justify-center text-slate-300 shrink-0"><ImageIcon size={18} /></div>}
        <div className="flex-1 min-w-0">
          <input className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-600 mb-2" placeholder="URL imagine sau încarcă →" value={value || ''} onChange={(ev) => onChange(ev.target.value)} />
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer transition">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />} Încarcă imagine
            <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) upload(f) }} />
          </label>
        </div>
      </div>
      {e && <p className="text-xs text-red-500 mt-2">{e}</p>}
    </div>
  )
}

// ============================================================
// Content editor — all sections
// ============================================================
function ContentEditor({ draft, update, token }: { draft: any; update: (p: Path, v: any) => void; token: string }) {
  const g = (p: Path) => getPath(draft, p)
  const T = (p: Path, label: string, opts?: { rec?: number; area?: boolean }) =>
    <Txt label={label} value={g(p)} rec={opts?.rec} area={opts?.area} onChange={(v) => update(p, v)} />

  return (
    <div>
      {/* NAV */}
      <Card title="Bara de sus (navigație)">
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['nav', 'brandTitle'], 'Nume brand', { rec: 16 })}
          {T(['nav', 'brandSubtitle'], 'Subtitlu brand', { rec: 20 })}
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(g(['nav', 'links']) || []).map((l: any, i: number) => (
            <Txt key={i} label={`Etichetă meniu #${i + 1}`} value={l.label} rec={16} onChange={(v) => update(['nav', 'links', i, 'label'], v)} />
          ))}
        </div>
        {T(['nav', 'cta'], 'Buton înscriere', { rec: 18 })}
      </Card>

      {/* HERO */}
      <Card title="Secțiune Hero (prima vizibilă)">
        {T(['hero', 'eyebrow'], 'Etichetă mică (eyebrow)', { rec: 30 })}
        <div className="grid sm:grid-cols-3 gap-4">
          {T(['hero', 'titleLine1'], 'Titlu rând 1', { rec: 26 })}
          {T(['hero', 'titleLine2'], 'Titlu rând 2', { rec: 26 })}
          {T(['hero', 'titleAccent'], 'Titlu accent (cyan)', { rec: 22 })}
        </div>
        {T(['hero', 'subtitle'], 'Subtitlu', { rec: 160, area: true })}
        <div className="grid sm:grid-cols-3 gap-3">
          {(g(['hero', 'benefits']) || []).map((b: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`Beneficiu #${i + 1} — titlu`} value={b.title} rec={22} onChange={(v) => update(['hero', 'benefits', i, 'title'], v)} />
              <Txt label="subtitlu" value={b.sub} rec={22} onChange={(v) => update(['hero', 'benefits', i, 'sub'], v)} />
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['hero', 'ctaLabel'], 'Buton principal (CTA)', { rec: 40 })}
          {T(['hero', 'urgency'], 'Text urgență', { rec: 40 })}
        </div>
        <ImageField label="Imagine fundal hero" value={g(['hero', 'image'])} token={token} slot="hero" dims="2400×1600 px (peisaj)" onChange={(v) => update(['hero', 'image'], v)} />
      </Card>

      {/* VALUE */}
      <Card title="Secțiune „Un skill care îți schimbă libertatea”">
        {T(['value', 'eyebrow'], 'Eyebrow', { rec: 28 })}
        {T(['value', 'title'], 'Titlu', { rec: 48 })}
        {T(['value', 'subtitle'], 'Subtitlu', { rec: 170, area: true })}
        <div className="grid sm:grid-cols-3 gap-3">
          {(g(['value', 'cards']) || []).map((card: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`Card #${i + 1} — titlu`} value={card.title} rec={26} onChange={(v) => update(['value', 'cards', i, 'title'], v)} />
              <Txt label="descriere" value={card.desc} rec={150} area onChange={(v) => update(['value', 'cards', i, 'desc'], v)} />
              <ImageField label="imagine" value={card.image} token={token} slot={`value-${i}`} dims="400×400 px (pătrat)" onChange={(v) => update(['value', 'cards', i, 'image'], v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* TIMELINE */}
      <Card title="Structura cursului (4 zile)">
        {T(['timeline', 'eyebrow'], 'Eyebrow', { rec: 24 })}
        {T(['timeline', 'title'], 'Titlu', { rec: 60 })}
        <div className="grid sm:grid-cols-2 gap-3">
          {(g(['timeline', 'days']) || []).map((day: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`Ziua ${i + 1} — titlu`} value={day.title} rec={26} onChange={(v) => update(['timeline', 'days', i, 'title'], v)} />
              <ListTxt label="puncte" items={day.items} rec={36} onChange={(v) => update(['timeline', 'days', i, 'items'], v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* BENEFITS */}
      <Card title="„Vei putea să:” + de ce cursul nostru">
        {T(['benefits', 'eyebrow'], 'Eyebrow', { rec: 26 })}
        {T(['benefits', 'title'], 'Titlu', { rec: 24 })}
        <ListTxt label="Checklist (ce vei putea face)" items={g(['benefits', 'items'])} rec={70} onChange={(v) => update(['benefits', 'items'], v)} />
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['benefits', 'badgeValue'], 'Badge — valoare', { rec: 8 })}
          {T(['benefits', 'badgeLabel'], 'Badge — etichetă', { rec: 30 })}
        </div>
        <ImageField label="Imagine secțiune" value={g(['benefits', 'image'])} token={token} slot="benefits" dims="900×600 px" onChange={(v) => update(['benefits', 'image'], v)} />
        <div className="grid sm:grid-cols-2 gap-3">
          {(g(['benefits', 'why']) || []).map((w: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`Avantaj #${i + 1} — titlu`} value={w.title} rec={30} onChange={(v) => update(['benefits', 'why', i, 'title'], v)} />
              <Txt label="descriere" value={w.desc} rec={90} area onChange={(v) => update(['benefits', 'why', i, 'desc'], v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* FOR WHOM */}
      <Card title="Pentru cine este cursul">
        {T(['forWhom', 'eyebrow'], 'Eyebrow', { rec: 30 })}
        <div className="grid sm:grid-cols-2 gap-3">
          {(g(['forWhom', 'cards']) || []).map((card: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`#${i + 1} — titlu`} value={card.title} rec={26} onChange={(v) => update(['forWhom', 'cards', i, 'title'], v)} />
              <Txt label="descriere" value={card.desc} rec={70} onChange={(v) => update(['forWhom', 'cards', i, 'desc'], v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* ENROLL */}
      <Card title="Bloc dată + înscriere">
        {T(['enroll', 'eyebrow'], 'Eyebrow', { rec: 20 })}
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['enroll', 'dateBig'], 'Data mare (Enter = rând nou)', { rec: 16, area: true })}
          {T(['enroll', 'dateSub'], 'Subtitlu dată', { rec: 30 })}
        </div>
        <ListTxt label="Puncte (ultimul = evidențiat auriu)" items={g(['enroll', 'points'])} rec={44} onChange={(v) => update(['enroll', 'points'], v)} />
        {T(['enroll', 'cardTitle'], 'Titlu card înscriere', { rec: 34 })}
        <ListTxt label="Puncte card" items={g(['enroll', 'cardPoints'])} rec={34} onChange={(v) => update(['enroll', 'cardPoints'], v)} />
        <div className="grid sm:grid-cols-3 gap-4">
          {T(['enroll', 'priceValue'], 'Preț', { rec: 16 })}
          {T(['enroll', 'priceUnit'], 'Unitate preț', { rec: 16 })}
          {T(['enroll', 'priceBadge'], 'Badge preț', { rec: 16 })}
        </div>
        {T(['enroll', 'ctaLabel'], 'Buton CTA', { rec: 24 })}
        {T(['enroll', 'ctaNote'], 'Notă sub buton', { rec: 70 })}
        {T(['enroll', 'bonusTitle'], 'Titlu bonus', { rec: 30 })}
        <ListTxt label="Bonusuri" items={g(['enroll', 'bonusItems'])} rec={44} onChange={(v) => update(['enroll', 'bonusItems'], v)} />
      </Card>

      {/* TESTIMONIALS */}
      <Card title="Testimoniale">
        {T(['testimonials', 'eyebrow'], 'Eyebrow', { rec: 30 })}
        {T(['testimonials', 'title'], 'Titlu', { rec: 40 })}
        <div className="grid sm:grid-cols-3 gap-3">
          {(g(['testimonials', 'items']) || []).map((t: any, i: number) => (
            <div key={i} className="space-y-2 border border-slate-100 rounded-lg p-3">
              <Txt label={`#${i + 1} — citat`} value={t.quote} rec={180} area onChange={(v) => update(['testimonials', 'items', i, 'quote'], v)} />
              <Txt label="nume" value={t.name} rec={24} onChange={(v) => update(['testimonials', 'items', i, 'name'], v)} />
              <Txt label="oraș" value={t.city} rec={24} onChange={(v) => update(['testimonials', 'items', i, 'city'], v)} />
              <ImageField label="poză" value={t.image} token={token} slot={`testimonial-${i}`} dims="160×160 px (pătrat)" onChange={(v) => update(['testimonials', 'items', i, 'image'], v)} />
            </div>
          ))}
        </div>
      </Card>

      {/* FINAL CTA */}
      <Card title="Secțiune finală CTA">
        {T(['finalCta', 'eyebrow'], 'Eyebrow', { rec: 40 })}
        {T(['finalCta', 'title'], 'Titlu', { rec: 40 })}
        {T(['finalCta', 'subtitle'], 'Subtitlu', { rec: 160, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['finalCta', 'ctaLabel'], 'Buton CTA', { rec: 24 })}
          {T(['finalCta', 'phone'], 'Telefon', { rec: 20 })}
        </div>
        <ImageField label="Imagine fundal" value={g(['finalCta', 'image'])} token={token} slot="final" dims="2000×1200 px (peisaj)" onChange={(v) => update(['finalCta', 'image'], v)} />
      </Card>

      {/* FOOTER */}
      <Card title="Footer">
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['footer', 'brandTitle'], 'Nume brand', { rec: 16 })}
          {T(['footer', 'brandSubtitle'], 'Subtitlu brand', { rec: 20 })}
        </div>
        {T(['footer', 'about'], 'Descriere', { rec: 160, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['footer', 'linksTitle'], 'Titlu coloană linkuri', { rec: 20 })}
          {T(['footer', 'infoTitle'], 'Titlu coloană info', { rec: 20 })}
        </div>
        <div className="grid sm:grid-cols-3 gap-4">
          {T(['footer', 'address'], 'Adresă', { rec: 30 })}
          {T(['footer', 'phone'], 'Telefon', { rec: 20 })}
          {T(['footer', 'email'], 'Email', { rec: 30 })}
        </div>
        {T(['footer', 'newsletterTitle'], 'Titlu newsletter', { rec: 20 })}
        {T(['footer', 'newsletterText'], 'Text newsletter', { rec: 60 })}
        {T(['footer', 'copyright'], 'Copyright', { rec: 70 })}
      </Card>

      {/* LEAD FORM */}
      <Card title="Formular de înscriere (popup)">
        {T(['leadForm', 'title'], 'Titlu', { rec: 30 })}
        {T(['leadForm', 'subtitle'], 'Subtitlu', { rec: 120, area: true })}
        <div className="grid sm:grid-cols-2 gap-4">
          {T(['leadForm', 'nameLabel'], 'Etichetă nume', { rec: 24 })}
          {T(['leadForm', 'phoneLabel'], 'Etichetă telefon', { rec: 20 })}
          {T(['leadForm', 'emailLabel'], 'Etichetă email', { rec: 20 })}
          {T(['leadForm', 'messageLabel'], 'Etichetă mesaj', { rec: 30 })}
        </div>
        {T(['leadForm', 'submitLabel'], 'Buton trimite', { rec: 30 })}
        {T(['leadForm', 'successTitle'], 'Titlu confirmare', { rec: 24 })}
        {T(['leadForm', 'successMsg'], 'Mesaj confirmare', { rec: 140, area: true })}
      </Card>
    </div>
  )
}

// ============================================================
// Leads tab
// ============================================================
const STATUSES = ['nou', 'contactat', 'inscris', 'respins'] as const
const STATUS_STYLE: Record<string, string> = {
  nou: 'bg-blue-50 text-blue-700',
  contactat: 'bg-amber-50 text-amber-700',
  inscris: 'bg-emerald-50 text-emerald-700',
  respins: 'bg-slate-100 text-slate-500',
}

function LeadsTab({ token }: { token: string }) {
  const [leads, setLeads] = useState<any[] | null>(null)
  const [filter, setFilter] = useState<string>('all')

  const load = useCallback(async () => {
    const json = await fetch(`/api/cds-landing/leads?token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null)
    setLeads(json?.leads || [])
  }, [token])

  useEffect(() => { load() }, [load])

  async function setStatus(id: string, status: string) {
    setLeads((ls) => (ls || []).map((l) => (l.id === id ? { ...l, status } : l)))
    await fetch('/api/cds-landing/leads', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, id, status }) })
  }
  async function remove(id: string) {
    if (!confirm('Ștergi acest lead?')) return
    setLeads((ls) => (ls || []).filter((l) => l.id !== id))
    await fetch(`/api/cds-landing/leads?token=${encodeURIComponent(token)}&id=${id}`, { method: 'DELETE' })
  }

  if (leads === null) return <div className="text-center text-slate-400 py-16"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>

  const shown = filter === 'all' ? leads : leads.filter((l) => l.status === filter)
  const counts = STATUSES.reduce((a, s) => ({ ...a, [s]: leads.filter((l) => l.status === s).length }), {} as Record<string, number>)

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setFilter('all')} className={`px-3 py-1.5 rounded-full text-xs font-medium ${filter === 'all' ? 'bg-[#0a2a4e] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>Toate ({leads.length})</button>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filter === s ? 'bg-[#0a2a4e] text-white' : 'bg-white border border-slate-200 text-slate-600'}`}>{s} ({counts[s]})</button>
          ))}
        </div>
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50"><RefreshCw size={13} /> Reîncarcă</button>
      </div>

      {shown.length === 0 ? (
        <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">Niciun lead {filter !== 'all' ? `cu status „${filter}”` : 'încă'}.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs text-slate-400 text-left">
                <th className="px-4 py-3">Data</th><th className="px-4 py-3">Nume</th><th className="px-4 py-3">Contact</th><th className="px-4 py-3">Mesaj</th><th className="px-4 py-3">Status</th><th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {shown.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleDateString('ro-RO')}<br />{new Date(l.created_at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td className="px-4 py-3 font-medium text-[#0a2a4e]">{l.name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {l.phone && <div><a href={`tel:${l.phone}`} className="hover:text-[#2ea8d8]">{l.phone}</a></div>}
                    {l.email && <div><a href={`mailto:${l.email}`} className="hover:text-[#2ea8d8]">{l.email}</a></div>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px]">{l.message || '—'}</td>
                  <td className="px-4 py-3">
                    <select value={l.status} onChange={(e) => setStatus(l.id, e.target.value)} className={`text-xs font-medium rounded-full px-2.5 py-1 border-0 cursor-pointer ${STATUS_STYLE[l.status] || ''}`}>
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(l.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 transition"><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
