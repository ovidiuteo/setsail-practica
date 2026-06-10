'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, RotateCcw, Check, Loader2, FileText } from 'lucide-react'
import { DOC_TEMPLATE_TYPES, fillDocTemplate } from '@/lib/doc-templates'

type Row = { doc_type: string; key: string; content: string }

export default function DocTemplatesPage() {
  const [docType, setDocType] = useState(DOC_TEMPLATE_TYPES[0].value)
  const [overrides, setOverrides] = useState<Record<string, string>>({}) // `${doc_type}:${key}` -> content
  const [drafts, setDrafts] = useState<Record<string, string>>({})       // editari nesalvate
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [savedKey, setSavedKey] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('doc_templates').select('doc_type, key, content').then(({ data }) => {
      const map: Record<string, string> = {}
      for (const r of (data || []) as Row[]) map[`${r.doc_type}:${r.key}`] = r.content
      setOverrides(map)
      setLoading(false)
    })
  }, [])

  const def = useMemo(() => DOC_TEMPLATE_TYPES.find(d => d.value === docType)!, [docType])

  const valueFor = (key: string, dflt: string) => {
    const id = `${docType}:${key}`
    if (id in drafts) return drafts[id]
    if (id in overrides) return overrides[id]
    return dflt
  }

  async function save(key: string, dflt: string) {
    const id = `${docType}:${key}`
    const content = valueFor(key, dflt)
    setSavingKey(id)
    if (content.trim() === dflt.trim()) {
      // identic cu default -> stergem override-ul (revine la default)
      await supabase.from('doc_templates').delete().eq('doc_type', docType).eq('key', key)
      setOverrides(o => { const n = { ...o }; delete n[id]; return n })
    } else {
      const { error } = await supabase.from('doc_templates')
        .upsert({ doc_type: docType, key, content, updated_at: new Date().toISOString() }, { onConflict: 'doc_type,key' })
      if (error) { alert('Eroare la salvare: ' + error.message); setSavingKey(null); return }
      setOverrides(o => ({ ...o, [id]: content }))
    }
    setDrafts(d => { const n = { ...d }; delete n[id]; return n })
    setSavingKey(null)
    setSavedKey(id); setTimeout(() => setSavedKey(k => k === id ? null : k), 2000)
  }

  async function resetToDefault(key: string) {
    const id = `${docType}:${key}`
    if (!confirm('Revii la textul default? Override-ul salvat se șterge.')) return
    await supabase.from('doc_templates').delete().eq('doc_type', docType).eq('key', key)
    setOverrides(o => { const n = { ...o }; delete n[id]; return n })
    setDrafts(d => { const n = { ...d }; delete n[id]; return n })
  }

  // Preview simplu: variabilele apar ca {{nume}} bold, *italic* respectat
  function Preview({ content }: { content: string }) {
    const vars: Record<string, string> = {}
    for (const p of def.placeholders) vars[p.name] = `[${p.name}]`
    const segs = fillDocTemplate(content, vars)
    return (
      <p className="text-xs text-gray-600 leading-relaxed bg-gray-50 border border-gray-100 rounded-lg p-3">
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

      {/* Fragmente */}
      <div className="space-y-5">
        {def.fragments.map(f => {
          const id = `${docType}:${f.key}`
          const isOverridden = id in overrides
          const isDirty = id in drafts
          return (
            <div key={f.key} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-sm text-gray-900">{f.label}</h3>
                  {isOverridden && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">modificat</span>}
                </div>
                <div className="flex items-center gap-2">
                  {isOverridden && (
                    <button onClick={() => resetToDefault(f.key)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500">
                      <RotateCcw size={11}/> Reset la default
                    </button>
                  )}
                  <button onClick={() => save(f.key, f.default)} disabled={savingKey === id || !isDirty}
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
              <Preview content={valueFor(f.key, f.default)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
