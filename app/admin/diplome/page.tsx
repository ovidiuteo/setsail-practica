'use client'
import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  Award, Plus, Printer, Search, Loader2, Wand2, Settings2,
  Ban, RotateCcw, Pencil, PackageCheck, ListPlus, ListX,
} from 'lucide-react'
import { Diploma, DIPLOMA_CATEGORIES, formatDiplomaDate } from '@/lib/diplomas'
import { DiplomaEditModal, InlineNumber } from './DiplomaQuickEdit'
import SyncAddressesButton from './SyncAddressesButton'

const SERIES_COLORS: Record<string, string> = {
  A: 'bg-sky-100 text-sky-700',
  B: 'bg-indigo-100 text-indigo-700',
  C: 'bg-emerald-100 text-emerald-700',
  D: 'bg-amber-100 text-amber-700',
  S: 'bg-purple-100 text-purple-700',
}

export default function DiplomePage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Diploma[]>([])
  const [search, setSearch] = useState('')
  const [showCancelled, setShowCancelled] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [modalDiploma, setModalDiploma] = useState<Diploma | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('diplomas')
      .select('*')
      .order('number', { ascending: false })
    setRows((data || []) as Diploma[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function patch(d: Diploma, fields: Partial<Diploma>, optimistic = true) {
    setBusyId(d.id)
    const { error } = await supabase.from('diplomas').update(fields).eq('id', d.id)
    setBusyId(null)
    if (error) { alert('Eroare: ' + error.message); return }
    if (optimistic) setRows(prev => prev.map(r => r.id === d.id ? { ...r, ...fields } : r))
  }

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (!showCancelled && r.status !== 1) return false
      if (!q) return true
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.cnp || '').includes(q) ||
        String(r.number).includes(q) ||
        (r.group_name || '').toLowerCase().includes(q)
      )
    })
  }, [rows, search, showCancelled])

  const queueCount = rows.filter(r => r.in_print_queue && r.status === 1).length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award size={18} className="text-amber-600" />
              Diplome
            </h1>
            <p className="text-xs text-gray-500">
              Registrul diplomelor emise — tipărire pe foile pre-tipărite, cu șabloane per imprimantă.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <SyncAddressesButton diplomas={rows} onSaved={loadAll} />
            <Link href="/admin/diplome/sabloane"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white">
              <Settings2 size={13} /> Șabloane & imprimante
            </Link>
            <Link href="/admin/diplome/coada"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white">
              <Printer size={13} /> Tipărire listă
              {queueCount > 0 && (
                <span className="bg-amber-500 text-white rounded-full px-1.5 py-0.5 text-[10px] font-bold">{queueCount}</span>
              )}
            </Link>
            <Link href="/admin/diplome/nou"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-100 bg-white">
              <Plus size={13} /> Adaugă manual
            </Link>
            <Link href="/admin/diplome/genereaza"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90"
              style={{ background: '#0a1628' }}>
              <Wand2 size={13} /> Generează din sesiune
            </Link>
          </div>
        </div>

        {/* Căutare + filtre */}
        <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Caută după nume, CNP, număr sau serie curs..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
            <input type="checkbox" checked={showCancelled} onChange={e => setShowCancelled(e.target.checked)} />
            Arată și diplomele anulate
          </label>
          <div className="text-xs text-gray-400">{visible.length} din {rows.length}</div>
        </div>

        {/* Secțiuni per serie */}
        {visible.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm border border-gray-100">
            Nicio diplomă. Generează din sesiune sau adaugă manual.
          </div>
        ) : (
          DIPLOMA_CATEGORIES.filter(s => visible.some(d => d.series === s)).map(serie => {
            const rows = visible.filter(d => d.series === serie)
            return (
          <div key={serie} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50/60">
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${SERIES_COLORS[serie] || 'bg-gray-100 text-gray-600'}`}>
                Seria {serie}
              </span>
              <span className="text-xs text-gray-400">{rows.length} diplome</span>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-gray-400 border-b border-gray-100">
                  <th className="px-4 py-3">Nr.</th>
                  <th className="px-4 py-3">Nume</th>
                  <th className="px-4 py-3">Adresă</th>
                  <th className="px-4 py-3">Oraș, județ</th>
                  <th className="px-4 py-3">Probă practică</th>
                  <th className="px-4 py-3">CNP</th>
                  <th className="px-4 py-3">Eliberată</th>
                  <th className="px-4 py-3">Serie curs</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Acțiuni</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(d => {
                  const busy = busyId === d.id
                  return (
                    <tr key={d.id} className={`border-b border-gray-50 hover:bg-gray-50/60 ${d.status !== 1 ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-2.5">
                        <InlineNumber diploma={d} onSaved={loadAll} />
                      </td>
                      <td className="px-4 py-2.5">
                        <button onClick={() => setModalDiploma(d)} title="Click pentru a edita datele diplomei"
                          className="font-medium text-gray-900 hover:text-amber-600 hover:underline decoration-dotted text-left">
                          {d.full_name}
                        </button>
                      </td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{d.address || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs">{d.city || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600 text-xs whitespace-nowrap">
                        {d.practice_location || d.practice_date ? (
                          <span className={d.show_practice ? '' : 'text-gray-400 line-through'}
                            title={d.show_practice ? undefined : 'Nu se tipărește pe această serie'}>
                            Probă practică: {d.practice_location || '?'} / {formatDiplomaDate(d.practice_date) || '?'}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{d.cnp || '—'}</td>
                      <td className="px-4 py-2.5 text-gray-600">{formatDiplomaDate(d.issue_date)}</td>
                      <td className="px-4 py-2.5 text-gray-600">{d.group_name || '—'}</td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1">
                          {d.status !== 1 && <Badge cls="bg-red-100 text-red-700">Anulată</Badge>}
                          {d.in_print_queue && <Badge cls="bg-amber-100 text-amber-700">În coadă</Badge>}
                          {d.printed_at && <Badge cls="bg-emerald-100 text-emerald-700">Tipărită</Badge>}
                          {d.delivered_at && <Badge cls="bg-sky-100 text-sky-700">Livrată</Badge>}
                          {d.duplicate && <Badge cls="bg-gray-100 text-gray-600">Duplicat</Badge>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          {busy ? <Loader2 size={14} className="animate-spin text-gray-400" /> : (
                            <>
                              <IconBtn title="Editează" href={`/admin/diplome/${d.id}`}>
                                <Pencil size={13} />
                              </IconBtn>
                              {d.status === 1 && (d.in_print_queue ? (
                                <IconBtn title="Scoate din coadă" onClick={() => patch(d, { in_print_queue: false })}>
                                  <ListX size={13} />
                                </IconBtn>
                              ) : (
                                <IconBtn title="Trimite la tipărire" onClick={() => patch(d, { in_print_queue: true, duplicate: !!d.printed_at })}>
                                  <ListPlus size={13} />
                                </IconBtn>
                              ))}
                              {d.status === 1 && d.printed_at && !d.delivered_at && (
                                <IconBtn title="Marchează ca livrată" onClick={() => patch(d, { delivered_at: new Date().toISOString() })}>
                                  <PackageCheck size={13} />
                                </IconBtn>
                              )}
                              {d.status === 1 ? (
                                <IconBtn title="Anulează diploma" onClick={() => {
                                  if (confirm(`Anulezi diploma nr. ${d.number} (${d.full_name})?`)) patch(d, { status: 0, in_print_queue: false })
                                }}>
                                  <Ban size={13} className="text-red-500" />
                                </IconBtn>
                              ) : (
                                <IconBtn title="Reactivează" onClick={() => patch(d, { status: 1 })}>
                                  <RotateCcw size={13} className="text-emerald-600" />
                                </IconBtn>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </div>
            )
          })
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

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${cls}`}>{children}</span>
}

function IconBtn({ title, onClick, href, children }: {
  title: string; onClick?: () => void; href?: string; children: React.ReactNode
}) {
  const cls = 'p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition-colors'
  if (href) return <Link href={href} title={title} className={cls}>{children}</Link>
  return <button onClick={onClick} title={title} className={cls}>{children}</button>
}
