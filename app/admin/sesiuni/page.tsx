'use client'
import { useEffect, useState } from 'react'
import { supabase, Session } from '@/lib/supabase'
import Link from 'next/link'
import { Plus, Copy, ExternalLink, Trash2 } from 'lucide-react'

const statusMap: Record<string, { label: string; color: string }> = {
  draft: { label: 'Ciornă', color: '#6b7280' },
  active: { label: 'Activă', color: '#d97706' },
  completed: { label: 'Finalizată', color: '#059669' },
}

export default function SesiuniPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('sessions')
      .select('*, locations(name, county), evaluators(full_name), instructors(full_name), boats(name)')
      .order('session_date', { ascending: false })
    setSessions(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSession(id: string) {
    if (!confirm('Ștergi sesiunea și toți cursanții asociați?')) return
    await supabase.from('sessions').delete().eq('id', id)
    load()
  }

  function copyCode(code: string) {
    const url = `${window.location.origin}/portal?cod=${code}`
    navigator.clipboard.writeText(url)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>
            Sesiuni Practică
          </h1>
          <p className="text-gray-500 text-sm mt-1">{sessions.length} sesiuni</p>
        </div>
        <Link href="/admin/sesiuni/nou"
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white"
          style={{ background: '#0a1628' }}
        >
          <Plus size={16} /> Sesiune nouă
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Se încarcă...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-3">Nicio sesiune creată.</p>
          <Link href="/admin/sesiuni/nou" className="text-blue-600 hover:underline text-sm">Creează prima sesiune →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => {
            const st = statusMap[s.status] || statusMap.draft
            return (
              <div key={s.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-gray-900">
                      {new Date(s.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-medium" style={{ background: st.color + '15', color: st.color }}>
                      {st.label}
                    </span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Clasa {s.class_caa}</span>
                  </div>
                  <div className="text-sm text-gray-500 flex flex-wrap gap-x-4 gap-y-1">
                    <span>📍 {s.locations?.name}, {s.locations?.county}</span>
                    <span>⛵ {s.boats?.name || '—'}</span>
                    <span>👤 {s.instructors?.full_name || '—'}</span>
                    <span>🏛️ {s.evaluators?.full_name || '—'}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => copyCode(s.access_code)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-200 hover:bg-gray-50 transition-colors"
                    title="Copiază link portal"
                  >
                    <Copy size={12} />
                    {copied === s.access_code ? '✓ Copiat!' : s.access_code}
                  </button>
                  <Link href={`/admin/sesiuni/${s.id}`}
                    className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-gray-900 transition-colors"
                  >
                    <ExternalLink size={14} />
                  </Link>
                  <button onClick={() => deleteSession(s.id)}
                    className="p-2 rounded-lg border border-red-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
