'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Plus, Upload, Trash2, X, Pencil, Loader2, FileText, RefreshCw } from 'lucide-react'

// Documentele unei serii: descrierea (comună tuturor seriilor de același fel) și
// fișierul urcat pentru seria curentă. Fișierele stau în Storage, ca și cele din admin.

type Doc = {
  id: string
  label: string
  fisier: { id: string; file_name: string; mime_type: string | null; size: number | null; url: string | null } | null
}

const marime = (n?: number | null) => !n ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`

export default function DocumenteSerie({ sessionId, token }: { sessionId: string; token: string }) {
  const [documente, setDocumente] = useState<Doc[] | null>(null)
  const [categorie, setCategorie] = useState('')
  const [nou, setNou] = useState('')
  const [adaug, setAdaug] = useState(false)
  const [lucru, setLucru] = useState<string | null>(null)
  const [editez, setEditez] = useState<string | null>(null)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})

  const incarca = useCallback(async () => {
    const r = await fetch(`/api/roster/documente?session_id=${sessionId}&token=${encodeURIComponent(token)}`)
    const j = await r.json().catch(() => ({}))
    if (j.error) { setDocumente([]); return }
    setDocumente(j.documente); setCategorie(j.categorie || '')
  }, [sessionId, token])
  useEffect(() => { incarca() }, [incarca])

  async function api(body: Record<string, unknown>) {
    const r = await fetch('/api/roster/documente', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, ...body }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Eroare')
    return j
  }

  async function adauga() {
    if (!nou.trim()) return
    setLucru('nou')
    try { await api({ action: 'adauga', label: nou }); setNou(''); setAdaug(false); await incarca() }
    catch (e: any) { alert(e.message) } finally { setLucru(null) }
  }

  async function redenumeste(d: Doc, label: string) {
    setEditez(null)
    if (!label.trim() || label === d.label) return
    setDocumente(ds => (ds || []).map(x => x.id === d.id ? { ...x, label } : x))
    try { await api({ action: 'editeaza', id: d.id, label }) } catch { incarca() }
  }

  async function stergeDocument(d: Doc) {
    if (!confirm(`Ștergi „${d.label}"? Dispare descrierea de la toate seriile de acest fel, împreună cu fișierele urcate pe ea.`)) return
    setLucru(d.id)
    try { await api({ action: 'sterge', id: d.id }); await incarca() }
    catch (e: any) { alert(e.message) } finally { setLucru(null) }
  }

  async function stergeFisier(d: Doc) {
    if (!d.fisier || !confirm(`Ștergi fișierul „${d.fisier.file_name}"? Descrierea rămâne.`)) return
    setLucru(d.id)
    try { await api({ action: 'sterge_fisier', id: d.fisier.id }); await incarca() }
    catch (e: any) { alert(e.message) } finally { setLucru(null) }
  }

  // Fișierul urcă direct în Storage, printr-un URL semnat — nu trece prin server
  async function urca(d: Doc, file: File) {
    setLucru(d.id)
    try {
      const semn = await api({ action: 'sign', file_name: file.name, mime_type: file.type, size: file.size })
      const { createClient } = await import('@supabase/supabase-js')
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
      const { error } = await sb.storage.from('session-files').uploadToSignedUrl(semn.key, semn.token, file, { contentType: file.type })
      if (error) throw error
      await api({
        action: 'record', storage_key: semn.key, file_type_id: d.id,
        file_name: file.name, mime_type: file.type, size: file.size,
      })
      await incarca()
    } catch (e: any) {
      alert('Încărcare eșuată: ' + (e?.message || e))
    } finally { setLucru(null) }
  }

  const btn = 'inline-flex items-center justify-center w-7 h-7 rounded-lg border transition-colors'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-3xl">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Documentele seriei</h3>
          <p className="text-xs text-gray-400">
            Descrierile se păstrează pentru toate seriile {categorie === 'ancom' ? 'de radio' : 'ANR'}; fișierul e al seriei curente.
            Aceleași fișiere apar și în admin, la secțiunea de fișiere a sesiunii.
          </p>
        </div>
        <button onClick={() => setAdaug(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#0a1628' }}>
          <Plus size={13} /> Adaugă document
        </button>
      </div>

      {adaug && (
        <div className="mb-4 p-3 rounded-xl border border-blue-100 bg-blue-50/40 flex gap-2">
          <input autoFocus value={nou} onChange={e => setNou(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') adauga() }}
            placeholder="Descriere, ex: Proces verbal obținere"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
          <button onClick={adauga} disabled={lucru === 'nou' || !nou.trim()}
            className="px-3 py-2 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
            {lucru === 'nou' ? 'Se adaugă…' : 'Adaugă'}
          </button>
          <button onClick={() => setAdaug(false)} className="px-3 py-2 rounded-lg text-xs border border-gray-200 text-gray-600 bg-white">Renunță</button>
        </div>
      )}

      {documente === null ? (
        <div className="py-6 text-center text-sm text-gray-400"><Loader2 size={16} className="inline animate-spin mr-1" /> Se încarcă…</div>
      ) : documente.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">Niciun document încă. Adaugă o descriere și încarcă fișierul.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {documente.map(d => (
            <div key={d.id} className="py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-[12rem]">
                {editez === d.id ? (
                  <input autoFocus defaultValue={d.label}
                    onBlur={e => redenumeste(d, e.target.value.trim())}
                    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditez(null) }}
                    className="w-full px-2 py-1 rounded-lg border border-blue-300 text-sm focus:outline-none" />
                ) : (
                  <div className="text-sm font-medium text-gray-900">{d.label}</div>
                )}
                {d.fisier ? (
                  <a href={d.fisier.url || '#'} target="_blank" rel="noopener noreferrer"
                    className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-blue-700 hover:underline">
                    <FileText size={12} /> {d.fisier.file_name}
                    <span className="text-gray-400">{marime(d.fisier.size)}</span>
                  </a>
                ) : (
                  <div className="mt-0.5 text-xs text-gray-300">fără fișier</div>
                )}
              </div>

              <input ref={el => { inputs.current[d.id] = el }} type="file" className="hidden"
                accept="application/pdf,.pdf,.docx,.doc,image/*"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) urca(d, f) }} />

              <div className="flex items-center gap-1.5 shrink-0">
                {lucru === d.id ? (
                  <span className="text-xs text-gray-400 px-2"><Loader2 size={13} className="inline animate-spin mr-1" /> lucrez…</span>
                ) : (<>
                  <button onClick={() => inputs.current[d.id]?.click()} title={d.fisier ? 'Înlocuiește fișierul' : 'Încarcă fișierul'}
                    className={`${btn} border-blue-200 text-blue-600 hover:bg-blue-50 w-auto px-2.5 gap-1.5 text-xs font-medium`}>
                    {d.fisier ? <><RefreshCw size={13} /> Înlocuiește</> : <><Upload size={13} /> Încarcă</>}
                  </button>
                  <button onClick={() => setEditez(d.id)} title="Editează descrierea"
                    className={`${btn} border-gray-200 text-gray-500 hover:bg-gray-50`}>
                    <Pencil size={13} />
                  </button>
                  <button onClick={() => stergeFisier(d)} disabled={!d.fisier} title="Șterge fișierul încărcat"
                    className={`${btn} border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-30`}>
                    <Trash2 size={13} />
                  </button>
                  <button onClick={() => stergeDocument(d)} title="Șterge documentul (descriere + fișier)"
                    className={`${btn} border-red-300 bg-red-50 text-red-600 hover:bg-red-100`}>
                    <X size={14} />
                  </button>
                </>)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
