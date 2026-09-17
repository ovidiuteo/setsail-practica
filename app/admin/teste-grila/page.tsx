'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SquareCheckBig, Plus, Pencil, Trash2, Upload, Search, X, Check, Loader2, AlertCircle, ChevronRight, ImageIcon, ImageOff } from 'lucide-react'

type Sectiune = { id: string; cod: string; nume: string; parent_id: string | null; categorii: string[]; ordine: number }
type Raspuns = { text: string; corect: boolean }
type Intrebare = {
  id: string; sectiune_id: string; nr: number | null; intrebare: string
  raspunsuri: Raspuns[]; explicatie: string; sursa: string; imagine: string | null; activ: boolean; updated_at: string
}
type ConfigTest = { categorie: string; total: number; minim: number }
type StructuraTest = { categorie: string; sectiune_id: string; nr_intrebari: number }
type RandImport = { intrebare: string; raspunsuri: Raspuns[]; explicatie?: string }

// Categoriile de navigație; B și A vin mai târziu
const CATEGORII = [
  { cod: 'C', activ: true },
  { cod: 'D', activ: true },
  { cod: 'B', activ: false },
  { cod: 'A', activ: false },
] as const

const LITERE = 'abcdefgh'
const urlImagine = (nume: string) =>
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/grila-imagini/${encodeURIComponent(nume)}`

export default function TesteGrilaPage() {
  const [sectiuni, setSectiuni] = useState<Sectiune[]>([])
  const [intrebari, setIntrebari] = useState<Intrebare[]>([])
  const [config, setConfig] = useState<ConfigTest[]>([])
  const [structura, setStructura] = useState<StructuraTest[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [cat, setCat] = useState<string>('C')
  const [secId, setSecId] = useState<string | null>(null)
  const [cauta, setCauta] = useState('')
  const [editez, setEditez] = useState<Intrebare | 'nou' | null>(null)
  const [import_, setImport] = useState(false)

  const incarca = useCallback(async () => {
    try {
      const res = await fetch('/api/teste-grila', { cache: 'no-store' })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Eroare la încărcare')
      setSectiuni(j.sectiuni); setIntrebari(j.intrebari); setConfig(j.config || []); setStructura(j.structura || []); setErr(null)
    } catch (e: any) { setErr(e.message) }
    finally { setLoading(false) }
  }, [])

  // Categoria și secțiunea rămân în URL (refresh / link direct)
  useEffect(() => {
    const u = new URLSearchParams(window.location.search)
    const c = u.get('cat'); if (c && CATEGORII.some(x => x.cod === c && x.activ)) setCat(c)
    const s = u.get('sec'); if (s) setSecId(`cod:${s}`)
    incarca()
  }, [incarca])

  const dinCategorie = useMemo(() => sectiuni.filter(s => s.categorii.includes(cat)), [sectiuni, cat])
  const principale = useMemo(() => dinCategorie.filter(s => !s.parent_id).sort((a, b) => a.ordine - b.ordine), [dinCategorie])
  const copii = useCallback((id: string) => dinCategorie.filter(s => s.parent_id === id).sort((a, b) => a.ordine - b.ordine), [dinCategorie])

  // Secțiunea aleasă (din URL vine ca cod); implicit prima din categorie
  const sectiune = useMemo(() => {
    if (secId?.startsWith('cod:')) return dinCategorie.find(s => s.cod === secId.slice(4)) || principale[0]
    return dinCategorie.find(s => s.id === secId) || principale[0]
  }, [secId, dinCategorie, principale])

  useEffect(() => {
    if (!sectiune) return
    const u = new URL(window.location.href)
    u.searchParams.set('cat', cat); u.searchParams.set('sec', sectiune.cod)
    window.history.replaceState(null, '', u.toString())
  }, [cat, sectiune])

  const numar = (id: string) => intrebari.filter(q => q.sectiune_id === id).length
  const numarCuCopii = (id: string) => numar(id) + copii(id).reduce((n, c) => n + numar(c.id), 0)
  const totalCategorie = dinCategorie.reduce((n, s) => n + numar(s.id), 0)
  const inTest = (id: string) => structura.find(x => x.categorie === cat && x.sectiune_id === id)?.nr_intrebari || 0
  const inTestCuCopii = (id: string) => inTest(id) + copii(id).reduce((n, c) => n + inTest(c.id), 0)
  const cfg = config.find(c => c.categorie === cat)

  // O secțiune cu subsecțiuni arată întrebările tuturor, grupate
  const grupuri = sectiune ? [sectiune, ...copii(sectiune.id)] : []
  const q = cauta.trim().toLowerCase()
  const potrivire = (x: Intrebare) => !q || x.intrebare.toLowerCase().includes(q) || x.raspunsuri.some(r => r.text.toLowerCase().includes(q))
  const listaGrupuri = grupuri
    .map(g => ({ sec: g, items: intrebari.filter(x => x.sectiune_id === g.id && potrivire(x)) }))
    .filter(g => g.items.length)
  const totalVizibile = listaGrupuri.reduce((n, g) => n + g.items.length, 0)

  async function sterge(x: Intrebare) {
    if (!confirm(`Ștergi întrebarea ${x.nr ?? ''}?\n\n${x.intrebare}`)) return
    const res = await fetch('/api/teste-grila', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: x.id }) })
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error || 'Ștergerea a eșuat'); return }
    setIntrebari(xs => xs.filter(y => y.id !== x.id))
  }

  const parinte = sectiune?.parent_id ? sectiuni.find(s => s.id === sectiune.parent_id) : null
  const comunaCu = sectiune ? sectiune.categorii.filter(c => c !== cat) : []
  // unde se adaugă / importă: în secțiunea aleasă sau, la una cu subsecțiuni, într-o subsecțiune
  const tinte = sectiune ? (copii(sectiune.id).length ? copii(sectiune.id) : [sectiune]) : []

  return (
    <div className="max-w-6xl mx-auto px-5 py-8">
      <div className="flex items-center gap-2.5 mb-5">
        <div className="rounded-lg p-1.5" style={{ background: '#f5c842' }}>
          <SquareCheckBig size={18} style={{ color: '#0a1628' }} />
        </div>
        <h1 className="text-2xl font-extrabold text-[#0a2a4e]">TESTE GRILĂ ANR</h1>
      </div>

      {/* Categorii */}
      <div className="flex gap-1 border-b border-slate-200 mb-6">
        {CATEGORII.map(c => (
          <button key={c.cod} disabled={!c.activ}
            onClick={() => { setCat(c.cod); setSecId(null); setCauta('') }}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
              cat === c.cod ? 'border-[#f5c842] text-[#0a2a4e]'
                : c.activ ? 'border-transparent text-slate-500 hover:text-slate-800'
                : 'border-transparent text-slate-300 cursor-not-allowed'}`}>
            Categoria {c.cod}
            {!c.activ && <span className="ml-1.5 text-[10px] font-normal">în curând</span>}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Se încarcă…</div>
      ) : err ? (
        <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5"><AlertCircle size={16} /> {err}</div>
      ) : (
        <div className="grid md:grid-cols-[270px_1fr] gap-6">
          {/* Secțiuni */}
          <aside className="bg-white rounded-xl border border-slate-200 p-2 h-fit">
            <div className="px-2 pt-1.5 pb-2 border-b border-slate-100 mb-1">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 flex justify-between">
                <span>Categoria {cat}</span><span>{totalCategorie} întrebări</span>
              </div>
              {cfg && (
                <div className="text-xs text-slate-600 mt-1">
                  Test: <b>{cfg.total}</b> întrebări, minim <b>{cfg.minim}</b> corecte
                </div>
              )}
            </div>
            {principale.map(s => (
              <div key={s.id}>
                <SectiuneBtn s={s} activ={sectiune?.id === s.id} nr={numarCuCopii(s.id)} test={inTestCuCopii(s.id)} onClick={() => setSecId(s.id)} />
                {copii(s.id).map(c => (
                  <SectiuneBtn key={c.id} s={c} copil activ={sectiune?.id === c.id} nr={numar(c.id)} test={inTest(c.id)} onClick={() => setSecId(c.id)} />
                ))}
              </div>
            ))}
            <div className="px-2 pt-2 mt-1 border-t border-slate-100 text-[10px] text-slate-400">
              <span className="inline-block px-1 rounded bg-amber-100 text-amber-800 mr-1">test 3</span>
              = câte întrebări intră în test din secțiune
            </div>
          </aside>

          {/* Întrebări */}
          <section className="min-w-0">
            {sectiune && (
              <>
                <div className="flex items-start justify-between gap-3 flex-wrap mb-4">
                  <div>
                    <div className="text-xs text-slate-400 flex items-center gap-1">
                      Categoria {cat}{parinte && <><ChevronRight size={12} />{parinte.nume}</>}
                    </div>
                    <h2 className="text-lg font-bold text-[#0a2a4e]">{sectiune.nume}</h2>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {comunaCu.length ? `Comună cu categoria ${comunaCu.join(', ')}` : `Doar pentru categoria ${cat}`}
                      {' · '}{numarCuCopii(sectiune.id)} întrebări
                      {inTestCuCopii(sectiune.id) > 0 && <> · <b>{inTestCuCopii(sectiune.id)}</b> în testul {cat}</>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setImport(true)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-slate-200 text-slate-700 hover:bg-slate-50">
                      <Upload size={14} /> Import Excel
                    </button>
                    <button onClick={() => setEditez('nou')}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#0a1628]" style={{ background: '#f5c842' }}>
                      <Plus size={14} /> Întrebare nouă
                    </button>
                  </div>
                </div>

                {numarCuCopii(sectiune.id) > 0 && (
                  <div className="relative mb-4 max-w-sm">
                    <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input value={cauta} onChange={e => setCauta(e.target.value)} placeholder="Caută în întrebări și răspunsuri…"
                      className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]" />
                    {q && <div className="text-[11px] text-slate-400 mt-1">{totalVizibile} rezultate</div>}
                  </div>
                )}

                {totalVizibile === 0 ? (
                  <div className="bg-white rounded-xl border border-dashed border-slate-200 py-14 text-center text-sm text-slate-400">
                    {q ? 'Nicio întrebare nu corespunde căutării.' : 'Nicio întrebare încă. Adaugă una sau importă din Excel.'}
                  </div>
                ) : (
                  <div className="space-y-6">
                    {listaGrupuri.map(g => (
                      <div key={g.sec.id}>
                        {grupuri.length > 1 && (
                          <h3 className="text-sm font-bold text-[#0a2a4e] mb-2 flex items-center gap-2">
                            {g.sec.nume}
                            <span className="text-[11px] font-normal text-slate-400">{g.items.length} întrebări{inTest(g.sec.id) ? ` · ${inTest(g.sec.id)} în test` : ''}</span>
                          </h3>
                        )}
                        <ol className="space-y-3">
                          {g.items.map(x => (
                            <IntrebareCard key={x.id} x={x} onEdit={() => setEditez(x)} onDelete={() => sterge(x)} />
                          ))}
                        </ol>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      )}

      {editez && sectiune && (
        <IntrebareModal tinte={editez === 'nou' ? tinte : sectiuni.filter(s => s.id === editez.sectiune_id)}
          intrebare={editez === 'nou' ? null : editez} onClose={() => setEditez(null)}
          onSaved={x => { setIntrebari(xs => xs.some(y => y.id === x.id) ? xs.map(y => y.id === x.id ? x : y) : [...xs, x]); setEditez(null) }} />
      )}
      {import_ && sectiune && (
        <ImportModal tinte={tinte} onClose={() => setImport(false)}
          onImported={xs => { setIntrebari(ys => [...ys, ...xs]); setImport(false) }} />
      )}
    </div>
  )
}

function SectiuneBtn({ s, activ, nr, test, copil, onClick }: { s: Sectiune; activ: boolean; nr: number; test: number; copil?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 rounded-lg text-sm text-left transition-colors ${copil ? 'pl-6 pr-2 py-1.5' : 'px-2 py-2'} ${
        activ ? 'bg-[#0a1628] text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
      <span className={`min-w-0 truncate ${copil ? 'text-[13px]' : 'font-medium'}`}>{copil && '↳ '}{s.nume}</span>
      <span className="flex items-center gap-1 shrink-0">
        {test > 0 && <span className={`text-[10px] px-1 rounded ${activ ? 'bg-[#f5c842] text-[#0a1628]' : 'bg-amber-100 text-amber-800'}`}>test {test}</span>}
        <span className={`text-[11px] px-1.5 rounded-full ${activ ? 'bg-white/15' : nr ? 'bg-slate-100 text-slate-600' : 'text-slate-300'}`}>{nr}</span>
      </span>
    </button>
  )
}

function ImagineIntrebare({ nume, className }: { nume: string; className?: string }) {
  const [lipsa, setLipsa] = useState(false)
  if (lipsa) {
    return (
      <div className={`flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-2 py-1 w-fit ${className || ''}`}>
        <ImageOff size={13} /> Imagine lipsă: {nume}
      </div>
    )
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={urlImagine(nume)} alt={nume} onError={() => setLipsa(true)} className={`max-h-56 max-w-full rounded-md border border-slate-100 ${className || ''}`} />
}

function IntrebareCard({ x, onEdit, onDelete }: { x: Intrebare; onEdit: () => void; onDelete: () => void }) {
  return (
    <li className="bg-white rounded-xl border border-slate-200 p-4 group">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-7 h-7 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">{x.nr ?? '–'}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-[#0a2a4e]">{x.intrebare}</div>
          {x.imagine && <ImagineIntrebare nume={x.imagine} className="mt-2" />}
          <ul className="mt-2 space-y-1">
            {x.raspunsuri.map((r, i) => (
              <li key={i} className={`flex items-start gap-2 text-sm rounded-md px-2 py-1 ${r.corect ? 'bg-emerald-50 text-emerald-800 font-medium' : 'text-slate-600'}`}>
                <span className="shrink-0 w-4">{LITERE[i]})</span>
                <span className="flex-1">{r.text}</span>
                {r.corect && <Check size={15} className="shrink-0 text-emerald-600 mt-0.5" />}
              </li>
            ))}
          </ul>
          {x.explicatie && <div className="mt-2 text-xs text-slate-500 italic">{x.explicatie}</div>}
        </div>
        <div className="flex gap-1 opacity-60 group-hover:opacity-100">
          <button onClick={onEdit} title="Editează" className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"><Pencil size={14} /></button>
          <button onClick={onDelete} title="Șterge" className="p-1.5 rounded-md text-red-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>
    </li>
  )
}

const citesteDataUrl = (f: File) => new Promise<string>((ok, fail) => {
  const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(f)
})

function IntrebareModal({ tinte, intrebare, onClose, onSaved }: {
  tinte: Sectiune[]; intrebare: Intrebare | null; onClose: () => void; onSaved: (x: Intrebare) => void
}) {
  const [sectiuneId, setSectiuneId] = useState(intrebare?.sectiune_id || tinte[0]?.id || '')
  const [text, setText] = useState(intrebare?.intrebare || '')
  const [rasp, setRasp] = useState<Raspuns[]>(intrebare?.raspunsuri?.length ? intrebare.raspunsuri : [
    { text: '', corect: true }, { text: '', corect: false }, { text: '', corect: false },
  ])
  const [explicatie, setExplicatie] = useState(intrebare?.explicatie || '')
  const [imagine, setImagine] = useState<string | null>(intrebare?.imagine || null)
  const [urc, setUrc] = useState(false)
  const [busy, setBusy] = useState(false)

  async function incarcaImagine(f: File) {
    if (f.size > 3 * 1024 * 1024) { alert('Imaginea are peste 3 MB.'); return }
    setUrc(true)
    try {
      const res = await fetch('/api/teste-grila', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'imagine', nume: f.name, data: await citesteDataUrl(f) }),
      })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Încărcarea a eșuat'); return }
      setImagine(j.imagine)
    } catch { alert('Conexiune eșuată') }
    finally { setUrc(false) }
  }

  async function salveaza() {
    setBusy(true)
    try {
      const res = await fetch('/api/teste-grila', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', id: intrebare?.id, sectiune_id: sectiuneId, intrebare: text, raspunsuri: rasp, explicatie, imagine }),
      })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Salvarea a eșuat'); return }
      onSaved(j.intrebare)
    } catch { alert('Conexiune eșuată') }
    finally { setBusy(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-[#0a2a4e]">{intrebare ? `Editează întrebarea ${intrebare.nr ?? ''}` : 'Întrebare nouă'}</h3>
            {tinte.length === 1 && <p className="text-xs text-slate-400">{tinte[0].nume}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {tinte.length > 1 && (
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1">Subsecțiunea</span>
              <select className={inp} value={sectiuneId} onChange={e => setSectiuneId(e.target.value)}>
                {tinte.map(t => <option key={t.id} value={t.id}>{t.nume}</option>)}
              </select>
            </label>
          )}
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">Întrebarea</span>
            <textarea rows={3} className={inp} value={text} onChange={e => setText(e.target.value)} />
          </label>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Imagine (opțional)</span>
            {imagine ? (
              <div className="flex items-start gap-3">
                <ImagineIntrebare nume={imagine} />
                <button type="button" onClick={() => setImagine(null)} className="text-xs text-red-500 hover:underline">Elimină</button>
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 cursor-pointer hover:bg-slate-50">
                {urc ? <Loader2 size={13} className="animate-spin" /> : <ImageIcon size={13} />} Încarcă imagine
                <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) incarcaImagine(f) }} />
              </label>
            )}
          </div>
          <div>
            <span className="block text-xs text-slate-500 mb-1">Răspunsuri — bifează răspunsul corect</span>
            <div className="space-y-2">
              {rasp.map((r, i) => (
                <div key={i} className="flex items-start gap-2">
                  <button type="button" title="Răspuns corect"
                    onClick={() => setRasp(rs => rs.map((x, j) => ({ ...x, corect: j === i })))}
                    className={`mt-1.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${r.corect ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 text-transparent hover:border-emerald-400'}`}>
                    <Check size={13} />
                  </button>
                  <span className="mt-2 text-sm text-slate-400 w-4">{LITERE[i]})</span>
                  <textarea rows={1} className={inp} value={r.text} onChange={e => setRasp(rs => rs.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} />
                  {rasp.length > 2 && (
                    <button type="button" onClick={() => setRasp(rs => { const n = rs.filter((_, j) => j !== i); if (!n.some(x => x.corect)) n[0].corect = true; return n })}
                      className="mt-2 text-slate-300 hover:text-red-500"><X size={15} /></button>
                  )}
                </div>
              ))}
            </div>
            {rasp.length < 6 && (
              <button type="button" onClick={() => setRasp(rs => [...rs, { text: '', corect: false }])}
                className="mt-2 text-xs text-blue-600 hover:underline">+ încă un răspuns</button>
            )}
          </div>
          <label className="block">
            <span className="block text-xs text-slate-500 mb-1">Explicație / sursă (opțional)</span>
            <textarea rows={2} className={inp} value={explicatie} onChange={e => setExplicatie(e.target.value)} placeholder="ex. HG 1704/2024, art. …" />
          </label>
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Renunță</button>
          <button onClick={salveaza} disabled={busy || urc}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0a1628] disabled:opacity-60" style={{ background: '#f5c842' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Salvează
          </button>
        </div>
      </div>
    </div>
  )
}

// Import din Excel. Două formate:
//  • simplu: Nr | Întrebare | Răspuns a | 1/0 | Răspuns b | 1/0 | …
//  • ca în fișierele „INTREBARI CLASA …": Nr | Intrebare | Sectiune | URL | Explicatii | Raspuns 1 | URL | Data | Raspuns 2 | URL | Data | …
function parseRanduri(rows: any[][]): RandImport[] {
  const cap = (rows[0] || []).map(c => String(c ?? '').trim().toLowerCase())
  const iR1 = cap.indexOf('raspuns 1')
  const out: RandImport[] = []
  if (iR1 >= 0) {
    const iExpl = cap.findIndex(c => c.startsWith('explica'))
    for (const r of rows.slice(1)) {
      const cel = r.map(c => String(c ?? '').replace(/\s+/g, ' ').trim())
      if (!cel[1]) continue
      const raspunsuri: Raspuns[] = []
      for (let i = iR1; i < cel.length && cap[i]?.startsWith('raspuns'); i += 3) {
        if (cel[i]) raspunsuri.push({ text: cel[i], corect: cel[i + 2] === '1' })
      }
      if (raspunsuri.length) out.push({ intrebare: cel[1], raspunsuri, explicatie: iExpl >= 0 ? cel[iExpl] : '' })
    }
    return out
  }
  for (const r of rows) {
    const cel = r.map(c => String(c ?? '').trim())
    // prima coloană e numărul dacă e numerică
    const start = /^\d+$/.test(cel[0]) ? 1 : 0
    const intrebare = cel[start]
    if (!intrebare) continue
    const raspunsuri: Raspuns[] = []
    for (let i = start + 1; i < cel.length; i += 2) {
      if (!cel[i]) continue
      raspunsuri.push({ text: cel[i], corect: cel[i + 1] === '1' })
    }
    if (raspunsuri.length) out.push({ intrebare, raspunsuri })
  }
  return out
}

function ImportModal({ tinte, onClose, onImported }: {
  tinte: Sectiune[]; onClose: () => void; onImported: (xs: Intrebare[]) => void
}) {
  const [sectiuneId, setSectiuneId] = useState(tinte[0]?.id || '')
  const [randuri, setRanduri] = useState<RandImport[]>([])
  const [sursa, setSursa] = useState('')
  const [lipit, setLipit] = useState('')
  const [busy, setBusy] = useState(false)

  async function dinFisier(f: File) {
    const XLSX = await import('xlsx')
    const wb = XLSX.read(await f.arrayBuffer())
    // prima foaie care are rânduri într-unul din formatele așteptate
    for (const sn of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json<any[]>(wb.Sheets[sn], { header: 1, defval: '' })
      const r = parseRanduri(rows)
      if (r.length) { setRanduri(r); setSursa(f.name); return }
    }
    alert('Nu am găsit rânduri în formatul: Nr | Întrebare | Răspuns | 1/0 | Răspuns | 1/0 …')
  }

  function dinLipit(t: string) {
    setLipit(t)
    setRanduri(parseRanduri(t.split(/\r?\n/).map(l => l.split('\t'))))
  }

  const invalide = randuri.filter(r => r.raspunsuri.filter(x => x.corect).length !== 1 || r.raspunsuri.length < 2).length

  async function importa() {
    setBusy(true)
    try {
      const res = await fetch('/api/teste-grila', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'import', sectiune_id: sectiuneId, intrebari: randuri, sursa }),
      })
      const j = await res.json()
      if (!res.ok) { alert(j.error || 'Importul a eșuat'); return }
      onImported(j.intrebari)
    } catch { alert('Conexiune eșuată') }
    finally { setBusy(false) }
  }

  const inp = 'w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#f5c842]'
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="font-semibold text-[#0a2a4e]">Import întrebări</h3>
            {tinte.length === 1 && <p className="text-xs text-slate-400">în {tinte[0].nume}</p>}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          {tinte.length > 1 && (
            <label className="block">
              <span className="block text-xs text-slate-500 mb-1">Importă în subsecțiunea</span>
              <select className={inp} value={sectiuneId} onChange={e => setSectiuneId(e.target.value)}>
                {tinte.map(t => <option key={t.id} value={t.id}>{t.nume}</option>)}
              </select>
            </label>
          )}
          <p className="text-xs text-slate-500">
            Format pe rând: <b>Nr | Întrebare | Răspuns a | 1/0 | Răspuns b | 1/0 …</b> (1 = corect) sau tabelul „INTREBARI CLASA …" (Nr | Intrebare | Sectiune | URL | Explicatii | Raspuns 1 | URL | Data …). Numerele continuă după ultima întrebare din secțiune.
          </p>
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { const f = e.target.files?.[0]; if (f) dinFisier(f) }}
            className="text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:text-xs file:font-medium" />
          <textarea rows={4} value={lipit} onChange={e => dinLipit(e.target.value)} placeholder="…sau lipește rândurile copiate din Excel"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#f5c842]" />
          {randuri.length > 0 && (
            <div className="rounded-lg border border-slate-100">
              <div className="px-3 py-2 text-xs border-b border-slate-100 flex justify-between">
                <span className="font-medium text-slate-700">{randuri.length} întrebări găsite</span>
                {invalide > 0 && <span className="text-red-600">{invalide} fără exact un răspuns corect</span>}
              </div>
              <ol className="max-h-64 overflow-y-auto divide-y divide-slate-50">
                {randuri.map((r, i) => (
                  <li key={i} className="px-3 py-2 text-xs">
                    <div className="font-medium text-slate-700">{i + 1}. {r.intrebare}</div>
                    <div className="text-slate-500">
                      {r.raspunsuri.map((x, j) => <span key={j} className={x.corect ? 'text-emerald-700 font-medium' : ''}>{LITERE[j]}) {x.text}{j < r.raspunsuri.length - 1 ? ' · ' : ''}</span>)}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border border-slate-200 text-slate-600 hover:bg-slate-50">Renunță</button>
          <button onClick={importa} disabled={busy || !randuri.length || invalide > 0 || !sectiuneId}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-[#0a1628] disabled:opacity-50" style={{ background: '#f5c842' }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Importă {randuri.length || ''}
          </button>
        </div>
      </div>
    </div>
  )
}
