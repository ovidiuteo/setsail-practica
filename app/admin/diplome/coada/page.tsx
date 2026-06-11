'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Printer, Loader2, ListX, AlertTriangle } from 'lucide-react'
import { Diploma, DiplomaPrinter, DIPLOMA_CATEGORIES, formatDiplomaDate } from '@/lib/diplomas'
import { DiplomaEditModal, InlineNumber } from '../DiplomaQuickEdit'
import SyncAddressesButton from '../SyncAddressesButton'

export default function CoadaTiparirePage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Diploma[]>([])
  const [printers, setPrinters] = useState<DiplomaPrinter[]>([])
  const [templates, setTemplates] = useState<{ printer_id: string; category: string }[]>([])
  const [printerId, setPrinterId] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)
  const [modalDiploma, setModalDiploma] = useState<Diploma | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: dips }, { data: prs }, { data: tpls }] = await Promise.all([
      supabase.from('diplomas').select('*').eq('in_print_queue', true).eq('status', 1).order('full_name'),
      supabase.from('diploma_printers').select('*').eq('active', true).order('name'),
      supabase.from('diploma_templates').select('printer_id, category'),
    ])
    setRows((dips || []) as Diploma[])
    const printersList = (prs || []) as DiplomaPrinter[]
    setPrinters(printersList)
    setTemplates(tpls || [])
    setPrinterId(prev => prev || printersList[0]?.id || '')
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function removeFromQueue(d: Diploma) {
    setBusyId(d.id)
    const { error } = await supabase.from('diplomas').update({ in_print_queue: false }).eq('id', d.id)
    setBusyId(null)
    if (error) { alert('Eroare: ' + error.message); return }
    setRows(prev => prev.filter(r => r.id !== d.id))
  }

  const bySeries = useMemo(() => {
    const map: Record<string, Diploma[]> = {}
    for (const d of rows) map[d.series] = [...(map[d.series] || []), d]
    return map
  }, [rows])

  const hasTemplate = useCallback(
    (series: string) => templates.some(t => t.printer_id === printerId && t.category === series),
    [templates, printerId],
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-5">

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin/diplome" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Printer size={18} className="text-amber-600" />
                Tipărire listă
              </h1>
              <p className="text-xs text-gray-500">
                Diplomele se tipăresc pe serii (foile pre-tipărite diferă). Alege imprimanta, apoi printează fiecare serie.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SyncAddressesButton diplomas={rows} onSaved={loadAll} />
            <label className="flex items-center gap-2 text-sm">
              <span className="text-xs text-gray-500">Imprimantă:</span>
              <select value={printerId} onChange={e => setPrinterId(e.target.value)}
                className="px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white">
                {printers.length === 0 && <option value="">— nicio imprimantă —</option>}
                {printers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
        </div>

        {printers.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle size={16} />
            Nu există imprimante definite. Adaugă una în
            <Link href="/admin/diplome/sabloane" className="underline font-medium">Șabloane & imprimante</Link>.
          </div>
        )}

        {rows.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm border border-gray-100">
            Lista de tipărire e goală. Trimite diplome la tipărire din registru sau generează unele noi.
          </div>
        ) : (
          DIPLOMA_CATEGORIES.filter(s => bySeries[s]?.length).map(s => (
            <div key={s} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/60">
                <div className="font-semibold text-sm text-gray-900">
                  Seria {s} <span className="text-gray-400 font-normal">· {bySeries[s].length} diplome</span>
                </div>
                <div className="flex items-center gap-2">
                  {printerId && !hasTemplate(s) && (
                    <span className="text-[11px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={12} /> fără șablon calibrat — se folosesc pozițiile implicite
                    </span>
                  )}
                  <Link
                    href={printerId ? `/admin/diplome/print?printer=${printerId}&series=${s}` : '#'}
                    target="_blank"
                    aria-disabled={!printerId}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white ${printerId ? 'hover:opacity-90' : 'opacity-40 pointer-events-none'}`}
                    style={{ background: '#0a1628' }}>
                    <Printer size={12} /> Printează seria {s}
                  </Link>
                </div>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                    <th className="px-4 py-2">Nr.</th>
                    <th className="px-4 py-2">Nume</th>
                    <th className="px-4 py-2">CNP</th>
                    <th className="px-4 py-2">Adresă</th>
                    <th className="px-4 py-2">Oraș, județ</th>
                    <th className="px-4 py-2">Probă practică</th>
                    <th className="px-4 py-2">Eliberată</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {bySeries[s].map(d => (
                    <tr key={d.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60">
                      <td className="px-4 py-2 w-20">
                        <InlineNumber diploma={d} onSaved={loadAll} />
                      </td>
                      <td className="px-4 py-2">
                        <button onClick={() => setModalDiploma(d)} title="Click pentru a edita datele diplomei"
                          className="font-medium text-gray-900 hover:text-amber-600 hover:underline decoration-dotted text-left">
                          {d.full_name}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-gray-500 font-mono">{d.cnp || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{d.address || '—'}</td>
                      <td className="px-4 py-2 text-gray-600">{d.city || '—'}</td>
                      <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                        {d.practice_location || d.practice_date ? (
                          <span className={d.show_practice ? '' : 'text-gray-400 line-through'}
                            title={d.show_practice ? undefined : 'Nu se tipărește pe această serie'}>
                            Probă practică: {d.practice_location || '?'} / {formatDiplomaDate(d.practice_date) || '?'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatDiplomaDate(d.issue_date)}</td>
                      <td className="px-4 py-2 text-right w-12">
                        {busyId === d.id
                          ? <Loader2 size={14} className="animate-spin text-gray-400 inline" />
                          : (
                            <button onClick={() => removeFromQueue(d)} title="Scoate din coadă"
                              className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                              <ListX size={14} />
                            </button>
                          )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        )}

        {modalDiploma && (
          <DiplomaEditModal
            diploma={modalDiploma}
            onClose={() => setModalDiploma(null)}
            onSaved={loadAll}
          />
        )}

      </div>
    </div>
  )
}
