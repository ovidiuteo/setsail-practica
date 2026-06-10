'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Check, Loader2, FileText, AlignLeft, AlignCenter, AlignRight, AlignJustify, Pin, PinOff } from 'lucide-react'
import { DOC_TEMPLATE_TYPES, fillDocTemplate, type DocAlign } from '@/lib/doc-templates'

type Row = { doc_type: string; key: string; content: string; align: string | null }
type Override = { content: string; align: string | null }

const ALIGN_OPTIONS: Array<{ value: DocAlign; label: string; Icon: any }> = [
  { value: 'left',    label: 'Stânga',   Icon: AlignLeft },
  { value: 'center',  label: 'Centrat',  Icon: AlignCenter },
  { value: 'right',   label: 'Dreapta',  Icon: AlignRight },
  { value: 'justify', label: 'Justify',  Icon: AlignJustify },
]

export default function DocTemplatesPage() {
  const [docType, setDocType] = useState(DOC_TEMPLATE_TYPES[0].value)
  const [overrides, setOverrides] = useState<Record<string, Override>>({})   // `${doc_type}:${key}` -> {content, align}
  const [drafts, setDrafts] = useState<Record<string, string>>({})           // editari text nesalvate
  const [draftsAlign, setDraftsAlign] = useState<Record<string, DocAlign>>({}) // editari aliniere nesalvate
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  // Preview cu sesiune reala: dropdown (empty default), pin persistent per tip de document
  const [sessOptions, setSessOptions] = useState<any[]>([])
  const [previewSessionId, setPreviewSessionId] = useState('')
  const [previewVars, setPreviewVars] = useState<Record<string, string> | null>(null)
  const [pinnedId, setPinnedId] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('doc_templates').select('doc_type, key, content, align').then(({ data }) => {
      const map: Record<string, Override> = {}
      for (const r of (data || []) as Row[]) map[`${r.doc_type}:${r.key}`] = { content: r.content, align: r.align }
      setOverrides(map)
      setLoading(false)
    })
  }, [])

  const def = useMemo(() => DOC_TEMPLATE_TYPES.find(d => d.value === docType)!, [docType])

  // Sesiuni existente (prezent -> trecut; cele viitoare nu sunt selectabile)
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10)
    supabase.from('sessions')
      .select('id, session_date, session_type, class_caa, locations(name)')
      .neq('session_type', 'absent')
      .lte('session_date', today)
      .order('session_date', { ascending: false })
      .then(({ data }) => setSessOptions(data || []))
  }, [])

  // Pin per tip de document (localStorage); fara pin, dropdown-ul porneste gol
  useEffect(() => {
    const pinned = typeof window !== 'undefined' ? localStorage.getItem(`docTplPin:${docType}`) : null
    setPinnedId(pinned)
    setPreviewSessionId(pinned || '')
  }, [docType])

  // La selectie: incarca sesiunea si construieste valorile reale pentru placeholder-e (oglinda generate-pv)
  useEffect(() => {
    if (!previewSessionId) { setPreviewVars(null); return }
    let cancelled = false
    ;(async () => {
      const { data: s } = await supabase.from('sessions')
        .select('*, locations(*), evaluators(*)').eq('id', previewSessionId).single()
      if (!s || cancelled) { if (!cancelled) setPreviewVars(null); return }
      const instrIds = [s.instructor_id, s.instructor_id_2, s.instructor_id_3].filter(Boolean)
      const boatIds = [s.boat_id, s.boat_id_2, s.boat_id_3].filter(Boolean)
      const [instrRes, boatRes] = await Promise.all([
        instrIds.length ? supabase.from('instructors').select('id, full_name').in('id', instrIds) : Promise.resolve({ data: [] as any[] }),
        boatIds.length ? supabase.from('boats').select('id, name, registration').in('id', boatIds) : Promise.resolve({ data: [] as any[] }),
      ])
      if (cancelled) return
      const iBy: Record<string, any> = Object.fromEntries((instrRes.data || []).map((r: any) => [r.id, r]))
      const bBy: Record<string, any> = Object.fromEntries((boatRes.data || []).map((r: any) => [r.id, r]))
      const oi = instrIds.map((iid: any) => iBy[iid]).filter(Boolean)
      const ob = boatIds.map((bid: any) => bBy[bid]).filter(Boolean)
      const locName = (s.locations?.name || '').toLowerCase()
      const capitania = locName.includes('snagov') ? 'Căpităniei Port Snagov'
        : (locName.includes('mangalia') || locName.includes('limanu')) ? 'Căpităniei Portului Mangalia'
        : `Căpităniei ${s.locations?.name || ''}`
      setPreviewVars({
        data_practica: s.session_date ? new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' }) : '',
        evaluator: s.evaluators?.full_name || '',
        functie_evaluator: s.evaluators?.title || '',
        capitania,
        decizie_anr: s.evaluators?.decision_number || '',
        furnizor: 'S.C. Set Sail Advertising S.R.L.',
        nr_solicitare: s.nr_instiintare_anr || '……../….......……',
        locatie: s.location_detail || s.locations?.location_detail || `${s.locations?.name || ''}, jud. ${s.locations?.county || ''}`,
        fraza_ambarcatiuni: ob.length > 1 ? 'cu ambarcațiunile' : 'cu ambarcațiunea',
        ambarcatiuni: ob.map((b: any) => `${b.name || ''}${b.registration ? ' ' + b.registration : ''}`.trim()).join(', '),
        fraza_instructori: oi.length > 1 ? 'în prezența instructorilor' : 'în prezența instructorului',
        instructori: oi.map((i: any) => i.full_name).join(', '),
      })
    })()
    return () => { cancelled = true }
  }, [previewSessionId])

  // Sesiunile potrivite tipului de document curent (pv_practica = non-radio)
  const sessForType = useMemo(() =>
    sessOptions.filter((s: any) => docType === 'pv_practica' ? !/radio|lrc/i.test(s.class_caa || '') : true),
  [sessOptions, docType])

  function pinCurrent() {
    if (!previewSessionId) return
    localStorage.setItem(`docTplPin:${docType}`, previewSessionId)
    setPinnedId(previewSessionId)
  }
  function clearPin() {
    localStorage.removeItem(`docTplPin:${docType}`)
    setPinnedId(null)
    setPreviewSessionId('')
  }

  const valueFor = (key: string, dflt: string) => {
    const id = `${docType}:${key}`
    if (id in drafts) return drafts[id]
    if (id in overrides) return overrides[id].content
    return dflt
  }
  const alignFor = (key: string, dfltAlign: DocAlign): DocAlign => {
    const id = `${docType}:${key}`
    if (id in draftsAlign) return draftsAlign[id]
    const ov = overrides[id]?.align
    return (ov as DocAlign) || dfltAlign
  }

  async function save(key: string, dflt: string, dfltAlign: DocAlign) {
    const id = `${docType}:${key}`
    const content = valueFor(key, dflt)
    const align = alignFor(key, dfltAlign)
    setSavingKey(id)
    const isDefault = content.trim() === dflt.trim() && align === dfltAlign
    if (isDefault) {
      // identic cu default -> stergem override-ul (revine la default)
      await supabase.from('doc_templates').delete().eq('doc_type', docType).eq('key', key)
      setOverrides(o => { const n = { ...o }; delete n[id]; return n })
    } else {
      const { error } = await supabase.from('doc_templates')
        .upsert({ doc_type: docType, key, content, align: align === dfltAlign ? null : align, updated_at: new Date().toISOString() }, { onConflict: 'doc_type,key' })
      if (error) { alert('Eroare la salvare: ' + error.message); setSavingKey(null); return }
      setOverrides(o => ({ ...o, [id]: { content, align: align === dfltAlign ? null : align } }))
    }
    setDrafts(d => { const n = { ...d }; delete n[id]; return n })
    setDraftsAlign(d => { const n = { ...d }; delete n[id]; return n })
    setSavingKey(null)
    setSavedKey(id); setTimeout(() => setSavedKey(k => k === id ? null : k), 2000)
  }

  async function resetToDefault(key: string) {
    const id = `${docType}:${key}`
    if (!confirm('Revii la textul și alinierea default? Override-ul salvat se șterge.')) return
    await supabase.from('doc_templates').delete().eq('doc_type', docType).eq('key', key)
    setOverrides(o => { const n = { ...o }; delete n[id]; return n })
    setDrafts(d => { const n = { ...d }; delete n[id]; return n })
    setDraftsAlign(d => { const n = { ...d }; delete n[id]; return n })
  }

  // Preview: cu sesiune selectata foloseste valori reale; altfel placeholder-e [nume]
  function Preview({ content, align }: { content: string; align: DocAlign }) {
    const vars: Record<string, string> = {}
    for (const p of def.placeholders) vars[p.name] = previewVars?.[p.name] ?? `[${p.name}]`
    const segs = fillDocTemplate(content, vars)
    return (
      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3"
        style={{ textAlign: align === 'justify' ? 'justify' : align }}>
        {segs.map((s, i) => (
          <span key={i} className={(s.bold ? 'font-semibold text-blue-700 ' : '') + (s.italics ? 'italic ' : '')}>{s.text}</span>
        ))}
      </p>
    )
  }

  if (loading) return <div className="p-8 text-center text-gray-400">Se încarcă...</div>

  return (
    <div className="p-8 max-w-4xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/configurare" className="text-gray-400 hover:text-gray-700"><ArrowLeft size={20}/></Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2" style={{ fontFamily: 'Georgia, serif' }}>
            <FileText size={22}/> Template-uri Documente
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Texte editabile pe fragmente pentru documentele oficiale generate. Layout-ul (tabele, antet, semnături) rămâne fix.
          </p>
        </div>
      </div>

      {/* Taburi per document */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {DOC_TEMPLATE_TYPES.map(d => (
          <button key={d.value} onClick={() => setDocType(d.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              docType === d.value ? 'border-purple-600 text-purple-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {d.label}
          </button>
        ))}
      </div>

      {/* Placeholder-e disponibile */}
      <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
        <div className="text-xs font-semibold text-blue-800 mb-2">Variabile disponibile (se completează automat la generare, apar bold în document)</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1">
          {def.placeholders.map(p => (
            <div key={p.name} className="text-xs text-blue-900">
              <code className="bg-white border border-blue-100 rounded px-1">{'{{' + p.name + '}}'}</code>
              <span className="text-blue-700/70 ml-1.5">{p.desc}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-blue-700/70 mt-2">
          <code className="bg-white border border-blue-100 rounded px-1">{'{{var:plain}}'}</code> = variabilă ne-bold ·{' '}
          <code className="bg-white border border-blue-100 rounded px-1">*text*</code> = text italic
        </p>
      </div>

      {/* Preview cu sesiune reala */}
      <div className="bg-white border border-gray-100 rounded-xl shadow-sm p-4 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-gray-700">Preview cu sesiune reală:</span>
        <select value={previewSessionId} onChange={e => setPreviewSessionId(e.target.value)}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-purple-400 min-w-[280px]">
          <option value="">— fără (placeholder-e) —</option>
          {sessForType.map((s: any) => {
            const d = s.session_date ? new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }) : '(fără dată)'
            return <option key={s.id} value={s.id}>{d} · {s.locations?.name || '—'} · {s.class_caa || ''}{s.session_type === 'clone' ? ' · clonă' : ''}</option>
          })}
        </select>
        <button onClick={pinCurrent} disabled={!previewSessionId}
          title={pinnedId && pinnedId === previewSessionId ? 'Sesiune fixată pentru acest model' : 'Fixează sesiunea selectată (rămâne la revenirea pe pagină)'}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border disabled:opacity-40 ${
            pinnedId && pinnedId === previewSessionId
              ? 'border-amber-300 bg-amber-50 text-amber-700'
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}>
          <Pin size={12}/> {pinnedId && pinnedId === previewSessionId ? 'Fixat' : 'Pin'}
        </button>
        {pinnedId && (
          <button onClick={clearPin}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-400 hover:text-red-500 hover:bg-red-50">
            <PinOff size={12}/> Clear pin
          </button>
        )}
        {previewVars && <span className="text-xs text-green-600 font-medium">✓ valori reale în preview</span>}
      </div>

      {/* Fragmente */}
      <div className="space-y-5">
        {def.fragments.map(f => {
          const id = `${docType}:${f.key}`
          const isOverridden = id in overrides
          const isDirty = id in drafts || id in draftsAlign
          const curAlign = alignFor(f.key, f.defaultAlign)
          return (
            <div key={f.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-gray-900">{f.label}</h3>
                  {isOverridden && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">modificat</span>}
                </div>
                <div className="flex items-center gap-2">
                  {/* Aliniere fata de foaie */}
                  <div className="flex rounded-lg border border-gray-200 overflow-hidden" title="Aliniere paragraf">
                    {ALIGN_OPTIONS.map(o => (
                      <button key={o.value} onClick={() => setDraftsAlign(d => ({ ...d, [id]: o.value }))}
                        title={o.label}
                        className={`px-2 py-1.5 ${curAlign === o.value ? 'bg-purple-100 text-purple-700' : 'text-gray-400 hover:bg-gray-50'}`}>
                        <o.Icon size={13}/>
                      </button>
                    ))}
                  </div>
                  {isOverridden && (
                    <button onClick={() => resetToDefault(f.key)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
                      <RotateCcw size={11}/> Reset la default
                    </button>
                  )}
                  <button onClick={() => save(f.key, f.default, f.defaultAlign)} disabled={savingKey === id || !isDirty}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-40"
                    style={{ background: '#059669' }}>
                    {savingKey === id ? <Loader2 size={11} className="animate-spin"/> : savedKey === id ? <Check size={11}/> : null}
                    {savedKey === id ? 'Salvat' : 'Salvează'}
                  </button>
                </div>
              </div>
              {f.hint && <p className="text-xs text-gray-400 mb-2">{f.hint}</p>}
              <textarea
                value={valueFor(f.key, f.default)}
                onChange={e => setDrafts(d => ({ ...d, [id]: e.target.value }))}
                rows={Math.min(8, Math.max(2, Math.ceil(valueFor(f.key, f.default).length / 110)))}
                spellCheck={false}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-400 mb-2"
              />
              <Preview content={valueFor(f.key, f.default)} align={curAlign} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
