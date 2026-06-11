'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Settings2, Plus, Loader2, Trash2, Crosshair } from 'lucide-react'
import {
  DiplomaPrinter, DiplomaTemplate, DIPLOMA_CATEGORIES,
  DEFAULT_TEMPLATE_FIELDS, DEFAULT_TEXT_COLOR,
} from '@/lib/diplomas'

export default function SabloanePage() {
  const [loading, setLoading] = useState(true)
  const [printers, setPrinters] = useState<DiplomaPrinter[]>([])
  const [templates, setTemplates] = useState<DiplomaTemplate[]>([])
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [startNumber, setStartNumber] = useState<number | ''>('')

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: prs }, { data: tpls }, { data: settings }] = await Promise.all([
      supabase.from('diploma_printers').select('*').order('name'),
      supabase.from('diploma_templates').select('*'),
      supabase.from('diploma_settings').select('start_number').eq('id', 1).maybeSingle(),
    ])
    setPrinters((prs || []) as DiplomaPrinter[])
    setTemplates((tpls || []) as DiplomaTemplate[])
    setStartNumber(settings?.start_number ?? 10000)
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function addPrinter() {
    const name = newName.trim()
    if (!name) return
    setBusy(true)
    const { error } = await supabase.from('diploma_printers').insert({ name })
    setBusy(false)
    if (error) { alert('Eroare: ' + error.message); return }
    setNewName('')
    loadAll()
  }

  async function deletePrinter(p: DiplomaPrinter) {
    if (!confirm(`Ștergi imprimanta „${p.name}" și șabloanele ei calibrate?`)) return
    const { error } = await supabase.from('diploma_printers').delete().eq('id', p.id)
    if (error) { alert('Eroare: ' + error.message); return }
    loadAll()
  }

  // Deschide (sau creează la prima accesare) șablonul pentru (imprimantă, categorie)
  async function openTemplate(printerId: string, category: string) {
    const existing = templates.find(t => t.printer_id === printerId && t.category === category)
    if (existing) {
      window.location.href = `/admin/diplome/sabloane/${existing.id}`
      return
    }
    const { data, error } = await supabase
      .from('diploma_templates')
      .insert({ printer_id: printerId, category, fields: DEFAULT_TEMPLATE_FIELDS, text_color: DEFAULT_TEXT_COLOR })
      .select('id')
      .single()
    if (error || !data) { alert('Eroare: ' + (error?.message || 'insert')); return }
    window.location.href = `/admin/diplome/sabloane/${data.id}`
  }

  async function saveStartNumber() {
    if (startNumber === '') return
    const { error } = await supabase.from('diploma_settings').update({ start_number: Number(startNumber) }).eq('id', 1)
    if (error) { alert('Eroare: ' + error.message); return }
    alert('Salvat. Numerotarea nu coboară sub acest număr.')
  }

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

        <div className="flex items-center gap-3">
          <Link href="/admin/diplome" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Settings2 size={18} className="text-amber-600" />
              Șabloane & imprimante
            </h1>
            <p className="text-xs text-gray-500">
              Fiecare imprimantă are propriile calibrări per serie (offsetul de alimentare diferă de la o imprimantă la alta).
            </p>
          </div>
        </div>

        {/* Adaugă imprimantă */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPrinter()}
            placeholder="Nume imprimantă nouă (ex: HP LaserJet birou)"
            className="flex-1 min-w-[240px] px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
          <button onClick={addPrinter} disabled={busy || !newName.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-50"
            style={{ background: '#0a1628' }}>
            <Plus size={13} /> Adaugă imprimantă
          </button>
        </div>

        {/* Imprimante + grila de șabloane */}
        {printers.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm border border-gray-100">
            Nicio imprimantă. Adaugă una mai sus, apoi calibrează șabloanele pe serii.
          </div>
        ) : (
          printers.map(p => (
            <div key={p.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="font-semibold text-sm text-gray-900">{p.name}</div>
                <button onClick={() => deletePrinter(p)} title="Șterge imprimanta"
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600">
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {DIPLOMA_CATEGORIES.map(cat => {
                  const tpl = templates.find(t => t.printer_id === p.id && t.category === cat)
                  return (
                    <button key={cat} onClick={() => openTemplate(p.id, cat)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                        tpl
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                      }`}>
                      <Crosshair size={12} />
                      Seria {cat} {tpl ? '· calibrat' : '· necalibrat'}
                    </button>
                  )
                })}
              </div>
            </div>
          ))
        )}

        {/* Setări numerotare */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex items-center gap-3 flex-wrap">
          <div className="text-sm">
            <div className="font-semibold text-gray-900">Număr de start al seriei noi</div>
            <div className="text-xs text-gray-500">Registrul nou pornește de aici; numerele cresc secvențial și nu coboară sub această valoare.</div>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <input type="number" value={startNumber}
              onChange={e => setStartNumber(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono" />
            <button onClick={saveStartNumber}
              className="px-4 py-2 rounded-lg text-xs font-semibold text-white"
              style={{ background: '#0a1628' }}>
              Salvează
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
