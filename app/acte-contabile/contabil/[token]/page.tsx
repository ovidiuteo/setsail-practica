'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, FileText, Download, Eye, X, FolderArchive, FileSpreadsheet } from 'lucide-react'

type Doc = {
  id: string
  categorie: string
  nume: string | null
  data_doc: string | null
  luna: string | null
  file_name: string | null
  file_type: string | null
  file_size: number | null
  url: string | null
  created_at: string
}

const CAT_LABEL: Record<string, string> = {
  extras_cont: 'Extras de cont',
  sumar_facturi: 'Sumar lunar facturi',
  factura: 'Facturi',
  chitanta: 'Chitanțe',
  extras: 'Extrase bancare',
  contract: 'Contracte',
  bon: 'Bonuri fiscale',
  altele: 'Altele',
}
const CAT_ORDER = ['extras_cont', 'sumar_facturi', 'factura', 'chitanta', 'extras', 'contract', 'bon', 'altele']
const LUNA_LABEL = (m: string) => m.charAt(0).toUpperCase() + m.slice(1)

function fmtSize(n: number | null) {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}
function docKind(d: Doc): 'pdf' | 'image' | 'other' {
  const t = (d.file_type || '').toLowerCase()
  const n = (d.file_name || '').toLowerCase()
  if (t === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
  if (t.startsWith('image/') || /\.(jpe?g|png|webp|avif|heic|gif)$/.test(n)) return 'image'
  return 'other'
}

export default function ContabilPage({ params }: { params: { token: string } }) {
  const token = params.token
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [meta, setMeta] = useState<{ label: string; full: string } | null>(null)
  const [luna, setLuna] = useState('')
  const [docs, setDocs] = useState<Doc[]>([])
  const [preview, setPreview] = useState<Doc | null>(null)
  const [zipping, setZipping] = useState(false)

  useEffect(() => {
    ;(async () => {
      const j = await fetch(`/api/acte-contabile/contabil/data?token=${encodeURIComponent(token)}`)
        .then(r => r.json()).catch(() => ({ ok: false }))
      if (!j.ok) { setPhase('denied'); return }
      setMeta(j.meta || null); setLuna(j.luna || ''); setDocs(j.docs || [])
      setPhase('ready')
    })()
  }, [token])

  async function downloadAll() {
    setZipping(true)
    try {
      const res = await fetch(`/api/acte-contabile/contabil/zip?token=${encodeURIComponent(token)}`)
      if (!res.ok) { alert('Nu există fișiere de descărcat.'); return }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `acte-${luna}.zip`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } finally { setZipping(false) }
  }

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-[#0a1628] mb-2">Link invalid</h1>
          <p className="text-slate-500 text-sm">Acest link nu mai este valid. Solicită un link nou persoanei care ți l-a trimis.</p>
        </div>
      </div>
    )
  }

  const groups = CAT_ORDER
    .map(cat => ({ cat, items: docs.filter(d => d.categorie === cat) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 bg-[#0a1628] text-white">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="rounded-lg p-2" style={{ background: '#f5c842' }}><FileText size={18} style={{ color: '#0a1628' }} /></div>
            <div>
              <h1 className="font-bold leading-tight">Acte contabile — {meta?.label} · {LUNA_LABEL(luna)}</h1>
              <p className="text-xs text-white/50">{meta?.full} · acces read-only pentru contabil</p>
            </div>
          </div>
          {docs.length > 0 && (
            <button onClick={downloadAll} disabled={zipping}
              className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg font-semibold text-[#0a1628] disabled:opacity-60" style={{ background: '#f5c842' }}>
              {zipping ? <Loader2 size={15} className="animate-spin" /> : <FolderArchive size={15} />} Descarcă toată luna
            </button>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 py-6">
        {docs.length === 0 ? (
          <div className="text-center text-slate-400 py-20 bg-white rounded-xl border border-slate-200">Niciun document încărcat pentru această lună.</div>
        ) : (
          <div className="space-y-6">
            {groups.map(g => (
              <section key={g.cat}>
                <h2 className="text-sm font-bold text-[#0a1628] mb-2 uppercase tracking-wide">{CAT_LABEL[g.cat] || g.cat} <span className="text-xs font-normal text-slate-400">({g.items.length})</span></h2>
                <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50">
                  {g.items.map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="font-medium text-[#0a1628] truncate">{d.nume || d.file_name || 'document'}</div>
                        <div className="text-xs text-slate-400 truncate">
                          {d.file_name && d.nume ? d.file_name + ' · ' : ''}{d.file_size ? fmtSize(d.file_size) : ''}{d.data_doc ? ` · ${new Date(d.data_doc).toLocaleDateString('ro-RO')}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {d.url && (
                          <button onClick={() => setPreview(d)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#0a1628]" style={{ background: '#f5c842' }} title="Previzualizează">
                            <Eye size={14} /> Vezi
                          </button>
                        )}
                        {d.url && (
                          <a href={d.url} target="_blank" rel="noreferrer" download={d.file_name || undefined}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-slate-200 text-slate-600 hover:bg-slate-50" title="Descarcă">
                            <Download size={14} /> Descarcă
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 text-center mt-6">Acces doar pentru vizualizare și descărcare. Pentru modificări, contactează emitentul.</p>
      </main>

      {preview && <PreviewModal doc={preview} onClose={() => setPreview(null)} />}
    </div>
  )
}

function PreviewModal({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  const kind = docKind(doc)
  const title = doc.nume || doc.file_name || 'document'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 shrink-0">
          <div className="min-w-0">
            <div className="font-semibold text-[#0a1628] truncate">{title}</div>
            <div className="text-xs text-slate-400 truncate">{CAT_LABEL[doc.categorie] || doc.categorie}{doc.file_name ? ` · ${doc.file_name}` : ''}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {doc.url && (
              <a href={doc.url} target="_blank" rel="noreferrer" download={doc.file_name || undefined}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-[#0a1628]" style={{ background: '#f5c842' }}>
                <Download size={15} /> Descarcă
              </a>
            )}
            <button onClick={onClose} className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Închide"><X size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-auto bg-slate-100 flex items-center justify-center min-h-[50vh]">
          {!doc.url ? <div className="text-slate-400 text-sm p-10">Documentul nu este disponibil.</div>
            : kind === 'pdf' ? <iframe src={doc.url} title={title} className="w-full h-[80vh] bg-white" />
            : kind === 'image' ? <img src={doc.url} alt={title} className="max-w-full max-h-[80vh] object-contain" />
            : (
              <div className="text-center p-10">
                <FileSpreadsheet size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 text-sm mb-4">Previzualizarea nu este disponibilă pentru acest tip de fișier.</p>
                <a href={doc.url} target="_blank" rel="noreferrer" download={doc.file_name || undefined}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-[#0a1628]" style={{ background: '#f5c842' }}>
                  <Download size={15} /> Descarcă fișierul
                </a>
              </div>
            )}
        </div>
      </div>
    </div>
  )
}
