'use client'
import React, { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { ArrowLeft, Crosshair, Loader2, Save, Printer } from 'lucide-react'
import {
  DiplomaTemplate, TemplateFields, FieldBox,
  DIPLOMA_FIELD_DEFS, DEFAULT_TEMPLATE_FIELDS, DEFAULT_TEXT_COLOR, fieldBox,
} from '@/lib/diplomas'
import DiplomaSheet, { SheetData } from '../../DiplomaSheet'

// Calibrare șablon: trage câmpurile cu mouse-ul peste imaginea-model,
// ajustează fin cu săgețile (Shift = pași de 10px), apoi Salvează.
// „Test print" tipărește foaia cu datele de probă — pune o diplomă goală
// în imprimantă și verifică unde cade textul.

const SAMPLE: SheetData = {
  number: 10001,
  issue_date: new Date().toISOString().slice(0, 10),
  expiration: 'NELIMITAT',
  full_name: 'Popescu, Ion-Alexandru',
  cnp: '1851231123456',
  address: 'Str. Exemplu nr. 10, bl. 2, ap. 5',
  city: 'București, Sector 3',
  group_name: 'CDS 2026-1',
  practice_location: 'Limanu',
  practice_date: new Date().toISOString().slice(0, 10),
  show_practice: true,
}

export default function CalibrareSablonPage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [tpl, setTpl] = useState<DiplomaTemplate | null>(null)
  const [printerName, setPrinterName] = useState('')
  const [fields, setFields] = useState<TemplateFields>(DEFAULT_TEMPLATE_FIELDS)
  const [color, setColor] = useState(DEFAULT_TEXT_COLOR)
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  const [sample, setSample] = useState<SheetData>(SAMPLE)
  const [dirty, setDirty] = useState(false)
  const [printMode, setPrintMode] = useState(false)
  const drag = useRef<{ key: string; startX: number; startY: number; orig: FieldBox } | null>(null)

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('diploma_templates').select('*').eq('id', params.id).single()
      if (!data) { alert('Șablonul nu există'); return }
      const t = data as DiplomaTemplate
      setTpl(t)
      setFields({ ...DEFAULT_TEMPLATE_FIELDS, ...(t.fields || {}) })
      setColor(t.text_color || DEFAULT_TEXT_COLOR)
      const [{ data: pr }, { data: lastDip }] = await Promise.all([
        supabase.from('diploma_printers').select('name').eq('id', t.printer_id).maybeSingle(),
        supabase.from('diplomas').select('*').eq('series', t.category).order('number', { ascending: false }).limit(1).maybeSingle(),
      ])
      setPrinterName(pr?.name || '')
      if (lastDip) setSample(lastDip as SheetData)
      setLoading(false)
    })()
  }, [params.id])

  const setBox = useCallback((key: string, patch: Partial<FieldBox>) => {
    setFields(prev => ({ ...prev, [key]: { ...fieldBox(prev, key), ...patch } }))
    setDirty(true)
  }, [])

  // Drag pe câmpuri (coordonatele câmpului sunt relative la grupul lui)
  const onFieldPointerDown = useCallback((key: string, e: React.PointerEvent) => {
    e.preventDefault()
    setSelectedKey(key)
    drag.current = { key, startX: e.clientX, startY: e.clientY, orig: fieldBox(fields, key) }
    const onMove = (ev: PointerEvent) => {
      if (!drag.current) return
      const { key, startX, startY, orig } = drag.current
      setBox(key, {
        top: Math.round(orig.top + (ev.clientY - startY)),
        left: Math.round(orig.left + (ev.clientX - startX)),
      })
    }
    const onUp = () => {
      drag.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [fields, setBox])

  // Nudge cu săgețile pe câmpul selectat
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!selectedKey) return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      const step = e.shiftKey ? 10 : 1
      const box = fieldBox(fields, selectedKey)
      if (e.key === 'ArrowUp') { setBox(selectedKey, { top: box.top - step }); e.preventDefault() }
      if (e.key === 'ArrowDown') { setBox(selectedKey, { top: box.top + step }); e.preventDefault() }
      if (e.key === 'ArrowLeft') { setBox(selectedKey, { left: box.left - step }); e.preventDefault() }
      if (e.key === 'ArrowRight') { setBox(selectedKey, { left: box.left + step }); e.preventDefault() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectedKey, fields, setBox])

  async function save() {
    if (!tpl) return
    setSaving(true)
    const { error } = await supabase
      .from('diploma_templates')
      .update({ fields, text_color: color })
      .eq('id', tpl.id)
    setSaving(false)
    if (error) { alert('Eroare: ' + error.message); return }
    setDirty(false)
  }

  function testPrint() {
    setPrintMode(true)
    setTimeout(() => {
      window.print()
      setPrintMode(false)
    }, 100)
  }

  if (loading || !tpl) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  const selBox = selectedKey ? fieldBox(fields, selectedKey) : null
  const selDef = DIPLOMA_FIELD_DEFS.find(d => d.key === selectedKey)
  const groupKeys: { key: string; label: string }[] = [
    { key: 'base', label: 'Cotor (grup)' },
    { key: 'diploma', label: 'Diplomă (grup)' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          body { margin: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
          .diploma-bg { display: none !important; }
          /* sidebar-ul din layout + spațierile de ecran ar deplasa textul pe foaie */
          aside { display: none !important; }
          .calib-wrap { padding: 0 !important; gap: 0 !important; }
          .calib-sheet { box-shadow: none !important; }
        }
      `}</style>

      {/* Bara de sus */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/admin/diplome/sabloane" className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={16} />
          </Link>
          <div className="text-sm">
            <span className="font-semibold text-gray-900 flex items-center gap-1.5">
              <Crosshair size={14} className="text-amber-600" />
              Seria {tpl.category} · {printerName}
            </span>
            <span className="text-[11px] text-gray-500">
              Trage câmpurile cu mouse-ul · săgeți = 1px · Shift+săgeți = 10px
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-gray-600">
            Culoare text
            <input type="color" value={color} onChange={e => { setColor(e.target.value); setDirty(true) }}
              className="w-8 h-8 rounded border border-gray-200 cursor-pointer" />
          </label>
          <button onClick={testPrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 hover:bg-gray-50 bg-white">
            <Printer size={13} /> Test print
          </button>
          <button onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: '#0a1628' }}>
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {dirty ? 'Salvează calibrarea' : 'Salvat'}
          </button>
        </div>
      </div>

      <div className="calib-wrap flex gap-4 p-4 items-start">
        {/* Foaia */}
        <div className="calib-sheet shrink-0" style={{ background: '#fff', boxShadow: '0 2px 12px rgba(0,0,0,.15)' }}>
          <DiplomaSheet
            data={sample}
            fields={fields}
            color={color}
            category={tpl.category}
            interactive={!printMode}
            selectedKey={selectedKey}
            onFieldPointerDown={onFieldPointerDown}
          />
        </div>

        {/* Panou lateral */}
        <div className="no-print w-64 shrink-0 space-y-3 sticky top-20">
          {/* Offset grupuri */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 space-y-2">
            <div className="text-xs font-semibold text-gray-700">Offset grupuri</div>
            {groupKeys.map(g => {
              const b = fieldBox(fields, g.key)
              return (
                <div key={g.key} className="flex items-center gap-2 text-xs">
                  <span className="w-24 text-gray-500">{g.label}</span>
                  <NumInput value={b.top} onChange={v => setBox(g.key, { top: v })} title="Sus" />
                  <NumInput value={b.left} onChange={v => setBox(g.key, { left: v })} title="Stânga" />
                </div>
              )
            })}
            <p className="text-[10px] text-gray-400">
              Mută tot cotorul / tot corpul odată — util când imprimanta trage foaia diferit.
            </p>
          </div>

          {/* Câmp selectat */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 space-y-2">
            <div className="text-xs font-semibold text-gray-700">
              {selDef ? `Câmp: ${selDef.label}` : 'Niciun câmp selectat'}
            </div>
            {selBox && selectedKey && (
              <div className="space-y-1.5 text-xs">
                <LabeledNum label="Sus (top)" value={selBox.top} onChange={v => setBox(selectedKey, { top: v })} />
                <LabeledNum label="Stânga (left)" value={selBox.left} onChange={v => setBox(selectedKey, { left: v })} />
                <LabeledNum label="Lățime" value={selBox.width ?? 100} onChange={v => setBox(selectedKey, { width: v })} />
              </div>
            )}
            {!selBox && <p className="text-[10px] text-gray-400">Click pe un câmp de pe foaie pentru a-l selecta.</p>}
          </div>

          {/* Lista câmpurilor */}
          <div className="bg-white rounded-xl p-3 shadow-sm border border-gray-100">
            <div className="text-xs font-semibold text-gray-700 mb-1.5">Toate câmpurile</div>
            <div className="flex flex-wrap gap-1">
              {DIPLOMA_FIELD_DEFS.map(d => (
                <button key={d.key} onClick={() => setSelectedKey(d.key)}
                  className={`px-2 py-1 rounded text-[10px] font-medium border ${
                    selectedKey === d.key
                      ? 'bg-amber-500 border-amber-500 text-white'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function NumInput({ value, onChange, title }: { value: number; onChange: (v: number) => void; title: string }) {
  return (
    <input type="number" value={value} title={title}
      onChange={e => onChange(Number(e.target.value) || 0)}
      className="w-16 px-1.5 py-1 rounded border border-gray-200 text-xs font-mono" />
  )
}

function LabeledNum({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-gray-500">{label}</span>
      <NumInput value={value} onChange={onChange} title={label} />
    </label>
  )
}
