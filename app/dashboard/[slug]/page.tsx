'use client'

import { useEffect, useState } from 'react'
import { Loader2, ShieldAlert, ExternalLink, LayoutDashboard } from 'lucide-react'

type PublicLink = { id: string; title: string; description: string | null; url: string; icon: string | null }
type PublicData = { name: string; slug: string; description: string | null }

export default function DashboardPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [phase, setPhase] = useState<'checking' | 'denied' | 'ready'>('checking')
  const [data, setData] = useState<PublicData | null>(null)
  const [links, setLinks] = useState<PublicLink[]>([])

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token') || ''
    ;(async () => {
      const j = await fetch(`/api/dashboards/public?slug=${encodeURIComponent(slug)}&token=${encodeURIComponent(t)}`)
        .then(r => r.json()).catch(() => ({ valid: false }))
      if (!j.valid) { setPhase('denied'); return }
      setData(j.dashboard); setLinks(j.links || []); setPhase('ready')
    })()
  }, [slug])

  if (phase === 'checking') {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se verifică accesul…</div>
  }
  if (phase === 'denied') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-10 max-w-md text-center">
          <div className="w-14 h-14 rounded-full bg-red-50 text-red-500 flex items-center justify-center mx-auto mb-5"><ShieldAlert className="w-8 h-8" /></div>
          <h1 className="text-2xl font-bold text-[#0a1628] mb-2">Acces refuzat</h1>
          <p className="text-slate-500 text-sm">Token invalid sau lipsă. Folosește linkul complet primit de la administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-[#0a1628] text-white">
        <div className="max-w-3xl mx-auto px-5 py-6 flex items-center gap-3">
          <div className="rounded-lg p-2.5" style={{ background: '#f5c842' }}>
            <LayoutDashboard size={20} style={{ color: '#0a1628' }} />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">{data?.name}</h1>
            <p className="text-xs text-white/50">{data?.description || 'Dashboard personal'}</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8">
        {links.length === 0 ? (
          <div className="text-center text-slate-400 py-16 bg-white rounded-xl border border-slate-200">
            Niciun link configurat încă.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {links.map(l => (
              <a key={l.id} href={l.url} target="_blank" rel="noreferrer"
                className="group bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3 hover:border-[#2ea8d8] hover:shadow-md transition-all">
                <div className="text-2xl shrink-0 leading-none mt-0.5">{l.icon || '🔗'}</div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-[#0a1628] flex items-center gap-1.5">
                    {l.title}
                    <ExternalLink size={13} className="text-slate-300 group-hover:text-[#2ea8d8] transition-colors" />
                  </div>
                  {l.description && <p className="text-sm text-slate-500 mt-0.5">{l.description}</p>}
                </div>
              </a>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-400 text-center mt-8">
          Acest link este personal. Nu îl distribui — oricine îl are accesează aceste resurse.
        </p>
      </main>
    </div>
  )
}
