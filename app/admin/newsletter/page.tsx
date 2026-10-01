'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, Upload, Search, Trash2, BellOff, Bell, X, Loader2, Check } from 'lucide-react'
import CopyColoana from '@/components/CopyColoana'

// Lista de newsletter: cine primește anunțurile SetSail. Contactele vin din
// formularele de pe landing și din seriile de curs (importate din MySQL).

type Contact = {
  id: string; email: string; nume: string | null; prenume: string | null
  serie: string | null; data_serie: string | null; source: string
  note: string | null; dezabonat_la: string | null; created_at: string
}

const zz = (iso: string | null) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '')
  return m ? `${m[3]}.${m[2]}.${m[1]}` : ''
}

export default function NewsletterPage() {
  const [contacte, setContacte] = useState<Contact[] | null>(null)
  const [cauta, setCauta] = useState('')
  const [serie, setSerie] = useState('toate')
  const [doarAbonati, setDoarAbonati] = useState(true)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importSursa, setImportSursa] = useState('serii curs')
  const [lucru, setLucru] = useState(false)
  const [nota, setNota] = useState<string | null>(null)

  const incarca = useCallback(async () => {
    const r = await fetch('/api/newsletter/admin')
    const j = await r.json().catch(() => ({}))
    if (j.error) { setContacte([]); return }
    setContacte(j.contacte)
  }, [])
  useEffect(() => { incarca() }, [incarca])

  async function api(body: Record<string, unknown>) {
    const r = await fetch('/api/newsletter/admin', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const j = await r.json().catch(() => ({}))
    if (!r.ok || j.error) throw new Error(j.error || 'Eroare')
    return j
  }

  const serii = useMemo(
    () => Array.from(new Set((contacte || []).map(c => c.serie).filter(Boolean) as string[])),
    [contacte])

  const lista = useMemo(() => {
    const q = cauta.trim().toLowerCase()
    return (contacte || []).filter(c => {
      if (doarAbonati && c.dezabonat_la) return false
      if (serie !== 'toate' && (c.serie || '') !== serie) return false
      if (!q) return true
      return [c.email, c.nume, c.prenume, c.serie].some(v => String(v || '').toLowerCase().includes(q))
    })
  }, [contacte, cauta, serie, doarAbonati])

  async function importa() {
    if (!importText.trim()) return
    setLucru(true)
    try {
      const j = await api({ action: 'import', text: importText, sursa: importSursa })
      setNota(`${j.adaugate} contacte noi · ${j.actualizate} actualizate din ${j.randuri} rânduri`)
      setImportText(''); setImportOpen(false)
      await incarca()
    } catch (e: any) { alert(e.message) }
    finally { setLucru(false) }
  }

  async function dezabonare(c: Contact) {
    const off = !c.dezabonat_la
    setContacte(cs => (cs || []).map(x => x.id === c.id ? { ...x, dezabonat_la: off ? new Date().toISOString() : null } : x))
    try { await api({ action: 'dezabonare', id: c.id, off }) } catch { incarca() }
  }

  async function sterge(c: Contact) {
    if (!confirm(`Ștergi definitiv ${c.email} din lista de newsletter?`)) return
    try { await api({ action: 'sterge', id: c.id }); await incarca() } catch (e: any) { alert(e.message) }
  }

  async function editeaza(c: Contact, camp: 'nume' | 'prenume' | 'serie' | 'note', val: string) {
    if ((c[camp] || '') === val) return
    setContacte(cs => (cs || []).map(x => x.id === c.id ? { ...x, [camp]: val } : x))
    try { await api({ action: 'editeaza', id: c.id, [camp]: val }) } catch { incarca() }
  }

  function exportaCsv() {
    const cap = ['email', 'nume', 'prenume', 'serie', 'data serie', 'sursa']
    const randuri = lista.map(c => [c.email, c.nume || '', c.prenume || '', c.serie || '', zz(c.data_serie), c.source])
    const csv = [cap, ...randuri].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const dezabonati = (contacte || []).filter(c => c.dezabonat_la).length
  const inp = 'px-2 py-1 rounded border border-transparent hover:border-gray-200 focus:border-blue-300 focus:outline-none bg-transparent w-full text-sm'

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <Link href="/admin/configurare" className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 mb-1">
            <ArrowLeft size={12} /> Configurare
          </Link>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Newsletter</h1>
          <p className="text-gray-500 text-sm mt-1">
            {contacte === null ? 'Se încarcă…' : <>{contacte.length} contacte · {contacte.length - dezabonati} abonate{dezabonati > 0 && <> · <span className="text-red-500">{dezabonati} dezabonate</span></>}</>}
            {nota && <span className="ml-2 text-green-600">{nota}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportaCsv}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <Download size={14} /> Export CSV
          </button>
          <button onClick={() => setImportOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" style={{ background: '#0a1628' }}>
            <Upload size={14} /> Importă contacte
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={cauta} onChange={e => setCauta(e.target.value)} placeholder="Caută după email, nume, serie…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <select value={serie} onChange={e => setSerie(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="toate">Toate seriile</option>
          {serii.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-gray-600 px-3 py-2 rounded-lg border border-gray-200 bg-white">
          <input type="checkbox" checked={doarAbonati} onChange={e => setDoarAbonati(e.target.checked)} />
          Doar abonații
        </label>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {contacte === null ? (
          <div className="p-12 text-center text-gray-400"><Loader2 size={18} className="inline animate-spin mr-2" /> Se încarcă…</div>
        ) : lista.length === 0 ? (
          <div className="p-12 text-center text-gray-400">Niciun contact pentru filtrele alese.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-left text-xs font-medium text-gray-500">
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">
                    <div className="flex items-center gap-2">Email
                      <CopyColoana valori={lista.map(c => c.email)} titlu="Copiază emailurile afișate" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">
                    <div className="flex items-center gap-2">Prenume
                      <CopyColoana valori={lista.map(c => c.prenume || '')} titlu="Copiază prenumele" eticheta="Prenume" />
                    </div>
                  </th>
                  <th className="px-4 py-3">Serie</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3">Sursă</th>
                  <th className="px-4 py-3">Observații</th>
                  <th className="w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {lista.map((c, i) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${c.dezabonat_la ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-2 text-xs text-gray-400">{i + 1}</td>
                    <td className="px-4 py-2 text-gray-800">{c.email}</td>
                    <td className="px-2 py-1"><input defaultValue={c.nume || ''} onBlur={e => editeaza(c, 'nume', e.target.value)} className={inp} /></td>
                    <td className="px-2 py-1"><input defaultValue={c.prenume || ''} onBlur={e => editeaza(c, 'prenume', e.target.value)} className={inp} /></td>
                    <td className="px-2 py-1"><input defaultValue={c.serie || ''} onBlur={e => editeaza(c, 'serie', e.target.value)} className={`${inp} text-xs text-gray-500`} /></td>
                    <td className="px-4 py-2 text-xs text-gray-500 whitespace-nowrap">{zz(c.data_serie) || '—'}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{c.source}</td>
                    <td className="px-2 py-1"><input defaultValue={c.note || ''} onBlur={e => editeaza(c, 'note', e.target.value)} placeholder="—" className={`${inp} text-xs text-gray-500`} /></td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1 justify-end">
                        <button onClick={() => dezabonare(c)} title={c.dezabonat_la ? 'Repune pe listă' : 'Scoate de pe listă'}
                          className={`p-1.5 rounded ${c.dezabonat_la ? 'text-green-600 hover:bg-green-50' : 'text-gray-300 hover:text-amber-600 hover:bg-amber-50'}`}>
                          {c.dezabonat_la ? <Bell size={14} /> : <BellOff size={14} />}
                        </button>
                        <button onClick={() => sterge(c)} title="Șterge definitiv"
                          className="p-1.5 rounded text-gray-300 hover:text-red-500 hover:bg-red-50">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {lista.length > 0 && (
        <div className="mt-3 text-xs text-gray-400 text-right">{lista.length} contacte afișate</div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setImportOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-semibold text-gray-900">Importă contacte</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Lipește rândurile din phpMyAdmin sau Excel: email, nume, prenume, serie, dată — separate prin TAB sau virgulă.
                  Un singur email pe rând merge și el.
                </p>
              </div>
              <button onClick={() => setImportOpen(false)} className="text-gray-400 hover:text-gray-700"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <textarea value={importText} onChange={e => setImportText(e.target.value)} rows={12}
                placeholder={'ion@exemplu.ro\tPopescu\tIon\tCurs intensiv 8-11 iunie 2026\t2026-06-08'}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <label className="flex items-center gap-2 text-xs text-gray-600">
                Sursă:
                <input value={importSursa} onChange={e => setImportSursa(e.target.value)}
                  className="px-2 py-1 rounded border border-gray-200 text-xs" />
              </label>
              <p className="text-[11px] text-gray-400">
                Emailurile care există deja nu se dublează: li se actualizează seria, dacă rândul nou e dintr-o serie mai recentă.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100">
              <button onClick={() => setImportOpen(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 text-gray-600">Renunță</button>
              <button onClick={importa} disabled={lucru || !importText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>
                {lucru ? <><Loader2 size={14} className="animate-spin" /> Se importă…</> : <><Check size={14} /> Importă</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
