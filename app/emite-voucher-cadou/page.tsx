'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'

type Tip = 'cds' | 'motor' | 'valoric'
type Form = { nume: string; prenume: string; observatii: string; sesiune: string; locatie: string; orar: string; suma: string }

const TEMPLATE: Record<Tip, string> = { cds: '/vouchere/cds.jpg', motor: '/vouchere/motor.jpg', valoric: '/vouchere/valoric.jpg' }
const TIP_LABEL: Record<Tip, string> = { cds: 'Curs de Yachting (CDS)', motor: 'Conducător motor', valoric: 'Voucher valoric' }

// Poziții text ca fracțiuni din lățime/înălțime (ușor de ajustat)
const POS: any = {
  cds: {
    nume: { x: 0.205, y: 0.79, size: 0.055 },
    sesiune: { x: 0.762, y: 0.30, size: 0.05 },
    locatie: { x: 0.762, y: 0.435, size: 0.05 },
    orar: { x: 0.762, y: 0.57, size: 0.05 },
  },
  motor: {
    nume: { x: 0.205, y: 0.79, size: 0.055 },
    sesiune: { x: 0.762, y: 0.30, size: 0.05 },
    locatie: { x: 0.762, y: 0.435, size: 0.05 },
    orar: { x: 0.762, y: 0.57, size: 0.05 },
  },
  valoric: {
    suma: { x: 0.238, y: 0.72, cy: 0.70, rw: 0.11, rh: 0.06, size: 0.11 },
    name: { x: 0.72, y: 0.60, size: 0.075 },
    obs: { x: 0.72, y: 0.14, size: 0.032 },
  },
}
const BLUE = '#1c6cb0', GOLD = '#b5893c'

export default function EmiteVoucher() {
  const token = useSearchParams().get('token') || ''
  const [state, setState] = useState<'loading' | 'ok' | 'denied'>('loading')
  const [tip, setTip] = useState<Tip>('cds')
  const [form, setForm] = useState<Form>({ nume: '', prenume: '', observatii: '', sesiune: '', locatie: '', orar: '', suma: '650' })
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgs = useRef<Record<string, HTMLImageElement>>({})

  useEffect(() => {
    fetch(`/api/voucher-cadou?token=${encodeURIComponent(token)}`).then(r => setState(r.ok ? 'ok' : 'denied')).catch(() => setState('denied'))
  }, [token])

  const draw = useCallback(() => {
    const cv = canvasRef.current; if (!cv) return
    const img = imgs.current[tip]
    if (!img) {
      const im = new Image()
      im.onload = () => { imgs.current[tip] = im; draw() }
      im.src = TEMPLATE[tip]
      return
    }
    const W = img.naturalWidth, H = img.naturalHeight
    cv.width = W; cv.height = H
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(img, 0, 0, W, H)
    const P = POS[tip]
    const full = `${form.nume} ${form.prenume}`.trim()
    if (tip === 'valoric') {
      // acoperă suma tipărită și rescrie
      ctx.save(); ctx.fillStyle = '#ffffff'; ctx.beginPath()
      ctx.ellipse(P.suma.x * W, P.suma.cy * H, P.suma.rw * W, P.suma.rh * H, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore()
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'
      ctx.fillStyle = GOLD; ctx.font = `bold ${P.suma.size * H}px Arial`
      ctx.fillText(`${(form.suma || '').trim() || '650'} €`, P.suma.x * W, P.suma.y * H)
      if (full) { ctx.fillStyle = GOLD; ctx.font = `italic ${P.name.size * H}px Georgia, serif`; ctx.fillText(full, P.name.x * W, P.name.y * H) }
      if (form.observatii) { ctx.fillStyle = '#e8e2d0'; ctx.font = `italic ${P.obs.size * H}px Georgia, serif`; ctx.fillText(form.observatii, P.obs.x * W, P.obs.y * H) }
    } else {
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = BLUE
      const put = (t: string, f: any) => { if (!t) return; ctx.font = `italic bold ${f.size * H}px Arial`; ctx.fillText(t, f.x * W, f.y * H) }
      put(full, P.nume)
      put(form.sesiune, P.sesiune)
      put(form.locatie, P.locatie)
      put(form.orar, P.orar)
    }
  }, [tip, form])

  useEffect(() => { if (state === 'ok') draw() }, [state, draw])

  const fileName = `Te vrem la bord, ${`${form.nume} ${form.prenume}`.trim() || 'SetSail'}`

  async function record() {
    if (saved) return
    await fetch('/api/voucher-cadou', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, tip, ...form }),
    }).catch(() => {})
    setSaved(true)
  }
  async function saveJpg() {
    setBusy(true); await record()
    const cv = canvasRef.current!
    cv.toBlob(b => { if (b) { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = fileName + '.jpg'; a.click() } setBusy(false) }, 'image/jpeg', 0.95)
  }
  async function savePdf() {
    setBusy(true); await record()
    const cv = canvasRef.current!
    const url = cv.toDataURL('image/jpeg', 0.95)
    const landscape = cv.width >= cv.height
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${fileName}</title>
<style>@page{size:A4 ${landscape ? 'landscape' : 'portrait'};margin:12mm}*{margin:0}img{width:100%;height:auto;display:block}</style></head>
<body><img src="${url}"><script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`)
      w.document.close()
    }
    setBusy(false)
  }

  if (state === 'loading') return <div className="min-h-screen flex items-center justify-center text-gray-400">Se încarcă…</div>
  if (state === 'denied') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0b1220', color: '#cdd9e5', fontFamily: 'system-ui', textAlign: 'center', padding: 24 }}>
      <div><h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Acces restricționat</h1><p style={{ color: '#8aa0b3', fontSize: 14 }}>Link invalid sau token lipsă.</p></div>
    </div>
  )

  const isCourse = tip !== 'valoric'
  const inCls = 'w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200'
  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-1">Emitere voucher SetSail</h1>
        <p className="text-sm text-gray-500 mb-5">Alege tipul, completează datele și descarcă voucherul (JPG sau PDF).</p>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Formular */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 space-y-4">
            <div>
              <span className="block text-xs text-gray-500 mb-1.5">Tip voucher</span>
              <div className="flex flex-wrap gap-1.5">
                {(['cds', 'motor', 'valoric'] as Tip[]).map(t => (
                  <button key={t} onClick={() => { setTip(t); setSaved(false) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${tip === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                    {TIP_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="block text-xs text-gray-500 mb-1">Nume</span>
                <input className={inCls} value={form.nume} onChange={e => { setForm(f => ({ ...f, nume: e.target.value })); setSaved(false) }} /></label>
              <label className="block"><span className="block text-xs text-gray-500 mb-1">Prenume</span>
                <input className={inCls} value={form.prenume} onChange={e => { setForm(f => ({ ...f, prenume: e.target.value })); setSaved(false) }} /></label>
            </div>
            {isCourse ? (
              <div className="grid grid-cols-1 gap-3">
                <label className="block"><span className="block text-xs text-gray-500 mb-1">Sesiune</span>
                  <input className={inCls} value={form.sesiune} onChange={e => { setForm(f => ({ ...f, sesiune: e.target.value })); setSaved(false) }} placeholder="ex. 3-6 august" /></label>
                <label className="block"><span className="block text-xs text-gray-500 mb-1">Locație</span>
                  <input className={inCls} value={form.locatie} onChange={e => { setForm(f => ({ ...f, locatie: e.target.value })); setSaved(false) }} /></label>
                <label className="block"><span className="block text-xs text-gray-500 mb-1">Orar cursuri</span>
                  <input className={inCls} value={form.orar} onChange={e => { setForm(f => ({ ...f, orar: e.target.value })); setSaved(false) }} /></label>
              </div>
            ) : (
              <label className="block"><span className="block text-xs text-gray-500 mb-1">Sumă (€)</span>
                <input className={inCls} value={form.suma} onChange={e => { setForm(f => ({ ...f, suma: e.target.value })); setSaved(false) }} placeholder="650" /></label>
            )}
            <label className="block"><span className="block text-xs text-gray-500 mb-1">Observații {tip === 'valoric' && <span className="text-gray-400">(text sus pe voucher)</span>}</span>
              <input className={inCls} value={form.observatii} onChange={e => { setForm(f => ({ ...f, observatii: e.target.value })); setSaved(false) }} /></label>

            <div className="flex gap-2 pt-1">
              <button onClick={saveJpg} disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50" style={{ background: '#0a1628' }}>Salvează JPG</button>
              <button onClick={savePdf} disabled={busy} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">Salvează PDF</button>
            </div>
            <p className="text-xs text-gray-400">Fișier: „{fileName}"</p>
          </div>

          {/* Preview */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 self-start">
            <div className="text-xs text-gray-400 mb-2">Previzualizare</div>
            <canvas ref={canvasRef} className="w-full h-auto rounded-lg border border-gray-100" />
          </div>
        </div>
      </div>
    </div>
  )
}
