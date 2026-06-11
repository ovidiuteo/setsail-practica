'use client'
import React, { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Printer, Check, Loader2, ArrowLeft } from 'lucide-react'
import {
  Diploma, DiplomaTemplate, TemplateFields,
  DEFAULT_TEMPLATE_FIELDS, DEFAULT_TEXT_COLOR,
} from '@/lib/diplomas'
import DiplomaSheet from '../DiplomaSheet'

// Pagină de print: ?printer=<id>&series=<A..S> (toată coada seriei)
// sau ?printer=<id>&series=<X>&ids=<id1,id2> (diplome specifice).
// Fără sidebar (exceptată în layout-ul admin). Fundalul nu se tipărește.

function PrintInner() {
  const params = useSearchParams()
  const router = useRouter()
  const printerId = params.get('printer') || ''
  const series = (params.get('series') || '').toUpperCase()
  const idsParam = params.get('ids')

  const [loading, setLoading] = useState(true)
  const [diplomas, setDiplomas] = useState<Diploma[]>([])
  const [fields, setFields] = useState<TemplateFields>(DEFAULT_TEMPLATE_FIELDS)
  const [color, setColor] = useState(DEFAULT_TEXT_COLOR)
  const [printerName, setPrinterName] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    let q = supabase.from('diplomas').select('*').eq('status', 1).eq('series', series).order('full_name')
    q = idsParam ? q.in('id', idsParam.split(',')) : q.eq('in_print_queue', true)
    const [{ data: dips }, { data: tpl }, { data: pr }] = await Promise.all([
      q,
      printerId
        ? supabase.from('diploma_templates').select('*').eq('printer_id', printerId).eq('category', series).maybeSingle()
        : Promise.resolve({ data: null } as any),
      printerId
        ? supabase.from('diploma_printers').select('name').eq('id', printerId).maybeSingle()
        : Promise.resolve({ data: null } as any),
    ])
    setDiplomas((dips || []) as Diploma[])
    const t = tpl as DiplomaTemplate | null
    if (t) {
      setFields({ ...DEFAULT_TEMPLATE_FIELDS, ...(t.fields || {}) })
      setColor(t.text_color || DEFAULT_TEXT_COLOR)
    }
    setPrinterName(pr?.name || '')
    setLoading(false)
  }, [series, idsParam, printerId])

  useEffect(() => { load() }, [load])

  async function confirmPrinted() {
    if (!confirm(`Confirmi că cele ${diplomas.length} diplome au ieșit corect? Vor fi marcate ca tipărite și scoase din coadă.`)) return
    setConfirming(true)
    const { error } = await supabase
      .from('diplomas')
      .update({ printed_at: new Date().toISOString(), in_print_queue: false })
      .in('id', diplomas.map(d => d.id))
    setConfirming(false)
    if (error) { alert('Eroare: ' + error.message); return }
    setConfirmed(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div>
      <style>{`
        @page { size: A4 landscape; margin: 0; }
        @media print {
          body { margin: 0 !important; background: #fff !important; }
          .no-print { display: none !important; }
          .diploma-bg { display: none !important; }
          .diploma-sheet { page-break-after: always; break-after: page; }
          .diploma-sheet:last-of-type { page-break-after: auto; break-after: auto; }
        }
        @media screen {
          .diploma-sheet {
            margin: 16px auto;
            box-shadow: 0 2px 12px rgba(0,0,0,.15);
            background: #fff;
          }
        }
      `}</style>

      {/* Bara de acțiuni — nu se tipărește */}
      <div className="no-print sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <ArrowLeft size={16} />
          </button>
          <div className="text-sm">
            <span className="font-semibold text-gray-900">Seria {series}</span>
            <span className="text-gray-500"> · {diplomas.length} diplome · imprimantă: {printerName || 'neselectată'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white hover:opacity-90"
            style={{ background: '#0a1628' }}>
            <Printer size={13} /> Print
          </button>
          {!idsParam && !confirmed && diplomas.length > 0 && (
            <button onClick={confirmPrinted} disabled={confirming}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50">
              {confirming ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              Confirmă tipărirea
            </button>
          )}
          {confirmed && (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
              <Check size={13} /> Marcate ca tipărite
            </span>
          )}
        </div>
      </div>

      {diplomas.length === 0 ? (
        <div className="p-12 text-center text-gray-400 text-sm">
          Nimic de tipărit pentru seria {series}.
        </div>
      ) : (
        diplomas.map(d => (
          <DiplomaSheet
            key={d.id}
            data={d}
            fields={fields}
            color={color}
            category={series}
          />
        ))
      )}
    </div>
  )
}

export default function PrintDiplomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    }>
      <PrintInner />
    </Suspense>
  )
}
