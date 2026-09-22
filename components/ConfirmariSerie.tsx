'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2, X, Loader2, Download, ChevronUp, ChevronDown } from 'lucide-react'
import { timelineScopeLabel } from '@/lib/timeline-scope'

// Confirmările unei serii: itemuri cu stare (Pending / Confirmat / Probleme),
// ora apăsării, observații și un termen față de o dată a seriei.
// Itemurile se păstrează pe tipul de curs, deci trec la fiecare serie nouă de același fel.

type Item = {
  id: string; descriere: string; ordine: number; zile: number | null; reper: string | null
  termen: string | null; stare: 'pending' | 'confirmat' | 'probleme'; stare_la: string | null; note: string
}
type Reper = { key: string; label: string; data: string | null }

const STARI = {
  pending:   { eticheta: 'Pending',   cls: 'bg-orange-50 text-orange-700 border-orange-300' },
  confirmat: { eticheta: 'Confirmat', cls: 'bg-green-50 text-green-700 border-green-400' },
  probleme:  { eticheta: 'Probleme',  cls: 'bg-red-50 text-red-700 border-red-400' },
} as const
// fiecare click trece la starea următoare
const URMATOAREA: Record<Item['stare'], Item['stare']> = { pending: 'confirmat', confirmat: 'probleme', probleme: 'pending' }

const zz = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}
const stampila = (iso: string | null) => iso
  ? new Date(iso).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  : ''

// Contor cu săgeți sus/jos pentru numărul de zile (negativ = înainte de reper)
function ContorZile({ valoare, onChange }: { valoare: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center border border-gray-200 rounded-lg overflow-hidden">
      <input type="number" value={valoare} onChange={e => onChange(Math.trunc(Number(e.target.value)) || 0)}
        className="w-14 px-2 py-1 text-sm text-center focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
      <span className="flex flex-col border-l border-gray-200">
        <button type="button" onClick={() => onChange(valoare + 1)} className="px-1 hover:bg-gray-50"><ChevronUp size={11} /></button>
        <button type="button" onClick={() => onChange(valoare - 1)} className="px-1 hover:bg-gray-50 border-t border-gray-200"><ChevronDown size={11} /></button>
      </span>
    </span>
  )
}

export default function ConfirmariSerie({ sessionId, token }: { sessionId: string; token: string }) {
  const [itemuri, setItemuri] = useState<Item[] | null>(null)
  const [repere, setRepere] = useState<Reper[]>([])
  const [scope, setScope] = useState('')
  const [adaug, setAdaug] = useState(false)
  const [nou, setNou] = useState({ descriere: '', cuTermen: false, zile: -3, reper: 'start_curs' })
  const [importOpen, setImportOpen] = useState(false)
  const [surse, setSurse] = useState<{ scope: string; itemuri: number }[] | null>(null)
  const [lucru, setLucru] = useState<string | null>(null)

  const api = useCallback(async (body: Record<string, unknown>) => {
    const r = await fetch('/api/roster/checklist', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, token, ...body }),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Eroare')
    return j
  }, [sessionId, token])

  const incarca = useCallback(async () => {
    const r = await fetch(`/api/roster/checklist?session_id=${sessionId}&token=${encodeURIComponent(token)}`)
    const j = await r.json().catch(() => ({}))
    if (j.error) return
    setItemuri(j.itemuri); setRepere(j.repere); setScope(j.scope)
  }, [sessionId, token])
  useEffect(() => { incarca() }, [incarca])

  async function schimbaStare(it: Item) {
    const stare = URMATOAREA[it.stare]
    const stare_la = stare === 'pending' ? null : new Date().toISOString()
    setItemuri(xs => (xs || []).map(x => x.id === it.id ? { ...x, stare, stare_la } : x))
    try { await api({ action: 'stare', id: it.id, stare }) } catch { incarca() }
  }

  async function salveazaNota(it: Item, note: string) {
    if (note === it.note) return
    setItemuri(xs => (xs || []).map(x => x.id === it.id ? { ...x, note } : x))
    try { await api({ action: 'note', id: it.id, note }) } catch { incarca() }
  }

  async function editeaza(it: Item, camp: Partial<Pick<Item, 'descriere' | 'zile' | 'reper'>>) {
    setItemuri(xs => (xs || []).map(x => x.id === it.id ? { ...x, ...camp } : x))
    try { await api({ action: 'editeaza', id: it.id, ...camp }); incarca() } catch { incarca() }
  }

  async function sterge(it: Item) {
    if (!confirm(`Ștergi itemul „${it.descriere}"? Dispare de la toate seriile de tip ${timelineScopeLabel(scope)}.`)) return
    setLucru(it.id)
    try { await api({ action: 'sterge', id: it.id }); await incarca() } catch (e: any) { alert(e.message) }
    finally { setLucru(null) }
  }

  async function adauga() {
    if (!nou.descriere.trim()) return
    setLucru('nou')
    try {
      await api({ action: 'adauga', descriere: nou.descriere, zile: nou.cuTermen ? nou.zile : null, reper: nou.cuTermen ? nou.reper : null })
      setNou({ descriere: '', cuTermen: false, zile: -3, reper: 'start_curs' }); setAdaug(false)
      await incarca()
    } catch (e: any) { alert(e.message) }
    finally { setLucru(null) }
  }

  async function deschideImport() {
    setImportOpen(true); setSurse(null)
    try { const j = await api({ action: 'surse' }); setSurse(j.surse) } catch { setSurse([]) }
  }
  async function importa(din: string) {
    setLucru('import')
    try {
      const j = await api({ action: 'import', scope: din })
      alert(j.adaugate ? `Am adăugat ${j.adaugate} itemuri.` : 'Toate itemurile existau deja.')
      setImportOpen(false); await incarca()
    } catch (e: any) { alert(e.message) }
    finally { setLucru(null) }
  }

  const azi = new Date().toISOString().slice(0, 10)
  const selectCls = 'px-2 py-1 rounded-lg border border-gray-200 text-sm bg-white'

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 max-w-4xl">
      <div className="flex items-start justify-between gap-3 mb-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm text-gray-900">Confirmări</h3>
          <p className="text-xs text-gray-400">
            Itemurile se păstrează pentru toate seriile de tip {timelineScopeLabel(scope)}. Click pe stare: Pending → Confirmat → Probleme.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={deschideImport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Download size={13} /> Import itemuri de la alte tipuri de cursuri
          </button>
          <button onClick={() => setAdaug(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#0a1628' }}>
            <Plus size={13} /> Adaugă item
          </button>
        </div>
      </div>

      {adaug && (
        <div className="mb-4 p-3 rounded-xl border border-blue-100 bg-blue-50/40 space-y-2">
          <input autoFocus value={nou.descriere} onChange={e => setNou(v => ({ ...v, descriere: e.target.value }))}
            onKeyDown={e => { if (e.key === 'Enter') adauga() }}
            placeholder="Descriere, ex: Confirmat barca cu marina"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white" />
          <label className="flex items-center gap-2 text-xs text-gray-600 flex-wrap">
            <input type="checkbox" checked={nou.cuTermen} onChange={e => setNou(v => ({ ...v, cuTermen: e.target.checked }))} />
            Termen limită:
            {nou.cuTermen && (<>
              <ContorZile valoare={nou.zile} onChange={z => setNou(v => ({ ...v, zile: z }))} />
              <span>zile față de</span>
              <select value={nou.reper} onChange={e => setNou(v => ({ ...v, reper: e.target.value }))} className={selectCls}>
                {repere.map(r => <option key={r.key} value={r.key}>{r.label}{r.data ? ` (${zz(r.data)})` : ''}</option>)}
              </select>
            </>)}
          </label>
          <div className="flex justify-end gap-2">
            <button onClick={() => setAdaug(false)} className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 bg-white">Renunță</button>
            <button onClick={adauga} disabled={lucru === 'nou' || !nou.descriere.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
              {lucru === 'nou' ? 'Se adaugă…' : 'Adaugă'}
            </button>
          </div>
        </div>
      )}

      {itemuri === null ? (
        <div className="py-6 text-center text-sm text-gray-400"><Loader2 size={16} className="inline animate-spin mr-1" /> Se încarcă…</div>
      ) : itemuri.length === 0 ? (
        <div className="py-6 text-center text-sm text-gray-400">Niciun item încă. Adaugă unul sau importă de la alt tip de curs.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {itemuri.map(it => {
            const st = STARI[it.stare]
            const intarziat = it.termen && it.stare !== 'confirmat' && it.termen < azi
            return (
              <div key={it.id} className="py-3 flex items-start gap-3 group">
                <div className="shrink-0 w-28 text-center">
                  <button onClick={() => schimbaStare(it)}
                    className={`w-full px-2 py-1.5 rounded-lg border-2 text-xs font-semibold ${st.cls}`}>
                    {st.eticheta}
                  </button>
                  {it.stare_la && <div className="text-[10px] text-gray-400 mt-1">{stampila(it.stare_la)}</div>}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <input defaultValue={it.descriere}
                    onBlur={e => { const v = e.target.value.trim(); if (v && v !== it.descriere) editeaza(it, { descriere: v }) }}
                    className="w-full text-sm font-medium text-gray-900 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-300 rounded px-1.5 py-0.5 focus:outline-none" />
                  <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 px-1.5">
                    {it.reper ? (<>
                      <span>Termen:</span>
                      <ContorZile valoare={it.zile ?? 0} onChange={z => editeaza(it, { zile: z })} />
                      <span>zile față de</span>
                      <select value={it.reper} onChange={e => editeaza(it, { reper: e.target.value })} className={selectCls}>
                        {repere.map(r => <option key={r.key} value={r.key}>{r.label}{r.data ? ` (${zz(r.data)})` : ''}</option>)}
                      </select>
                      {it.termen && (
                        <span className={`font-medium ${intarziat ? 'text-red-600' : 'text-gray-700'}`}>
                          → {zz(it.termen)}{intarziat ? ' (depășit)' : ''}
                        </span>
                      )}
                      <button onClick={() => editeaza(it, { zile: null, reper: null })} title="Fără termen" className="text-gray-300 hover:text-gray-600"><X size={12} /></button>
                    </>) : (
                      <button onClick={() => editeaza(it, { zile: -3, reper: 'start_curs' })} className="text-blue-600 hover:underline">+ termen limită</button>
                    )}
                  </div>
                  <textarea defaultValue={it.note} rows={1} placeholder="Observații…"
                    onBlur={e => salveazaNota(it, e.target.value)}
                    className="w-full text-xs text-gray-600 bg-transparent border border-transparent hover:border-gray-200 focus:border-blue-300 rounded px-1.5 py-1 focus:outline-none resize-y placeholder:text-gray-300" />
                </div>
                <button onClick={() => sterge(it)} disabled={lucru === it.id} title="Șterge itemul"
                  className="shrink-0 p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 opacity-60 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Import itemuri</h3>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-2">
              {surse === null ? (
                <div className="text-sm text-gray-400"><Loader2 size={14} className="inline animate-spin mr-1" /> Se încarcă…</div>
              ) : surse.length === 0 ? (
                <div className="text-sm text-gray-400">Celelalte tipuri de curs nu au încă itemuri.</div>
              ) : surse.map(s => (
                <button key={s.scope} onClick={() => importa(s.scope)} disabled={lucru === 'import'}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm disabled:opacity-50">
                  <span className="text-gray-800">{timelineScopeLabel(s.scope)}</span>
                  <span className="text-xs text-gray-400">{s.itemuri} itemuri</span>
                </button>
              ))}
              <p className="text-[11px] text-gray-400 pt-1">Itemurile cu aceeași descriere nu se dublează.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
