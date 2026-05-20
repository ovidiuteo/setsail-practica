'use client'
import React, { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import {
  ArrowLeft, Eye, EyeOff, PenTool, Check, X, Loader2
} from 'lucide-react'

type SignatureRow = {
  id: string
  full_name: string
  signature_data: string
  signature_pool: boolean
  signed_at: string | null
  created_at: string | null
}

export default function SemnaturiPage() {
  const [loading, setLoading] = useState(true)
  const [showAll, setShowAll] = useState(false)
  const [rows, setRows] = useState<SignatureRow[]>([])
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('id, full_name, signature_data, signature_pool, signed_at, created_at')
      .not('signature_data', 'is', null)
      .neq('signature_data', '')
      .order('signed_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false, nullsFirst: false })
    setRows((data || []) as SignatureRow[])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  async function togglePool(row: SignatureRow) {
    setTogglingId(row.id)
    const { error } = await supabase
      .from('students')
      .update({ signature_pool: !row.signature_pool })
      .eq('id', row.id)
    setTogglingId(null)
    if (error) { alert('Eroare: ' + error.message); return }
    // Optimistic local update + reload
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, signature_pool: !r.signature_pool } : r))
  }

  // Derived
  const visible = showAll ? rows : rows.filter(r => r.signature_pool)
  const totalInPool = rows.filter(r => r.signature_pool).length
  const total = rows.length

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link href="/admin"
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <PenTool size={18} className="text-purple-600" />
                Semnături
              </h1>
              <p className="text-xs text-gray-500">
                Bibliotecă globală de semnături cursanți, folosibilă în pool-ul random.
              </p>
            </div>
          </div>
        </div>

        {/* Stats + filter toggle */}
        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 text-sm">
            <div>
              <span className="text-gray-500">În pool: </span>
              <strong className="text-green-700">{totalInPool}</strong>
            </div>
            <div className="text-gray-300">·</div>
            <div>
              <span className="text-gray-500">Total cu semnătură: </span>
              <strong className="text-gray-900">{total}</strong>
            </div>
            <div className="text-gray-300">·</div>
            <div>
              <span className="text-gray-500">Afișate: </span>
              <strong className="text-gray-900">{visible.length}</strong>
            </div>
          </div>
          <button onClick={() => setShowAll(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">
            {showAll
              ? <><EyeOff size={12} />Arată doar pool random</>
              : <><Eye size={12} />Arată toate semnăturile</>}
          </button>
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          <div className="bg-white rounded-xl p-12 text-center text-gray-400 text-sm border border-gray-100">
            {showAll
              ? 'Nicio semnătură în baza de date.'
              : 'Niciun cursant nu este în pool. Apasă „Arată toate" pentru a vedea semnăturile disponibile și a le adăuga în pool.'}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4">
            {visible.map(r => {
              const isToggling = togglingId === r.id
              const dateStr = r.signed_at
                ? new Date(r.signed_at).toLocaleString('ro-RO', {
                    day: '2-digit', month: 'long', year: 'numeric',
                    hour: '2-digit', minute: '2-digit',
                  })
                : r.created_at
                  ? new Date(r.created_at).toLocaleDateString('ro-RO')
                  : '—'
              return (
                <div key={r.id}
                  className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                    r.signature_pool ? 'border-purple-200' : 'border-gray-100'
                  }`}>
                  {/* Semnătura */}
                  <div className="bg-gray-50 border-b border-gray-100 p-4 flex items-center justify-center"
                    style={{ height: 140 }}>
                    {r.signature_data ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.signature_data} alt={`Semnătura ${r.full_name}`}
                        style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                    ) : (
                      <span className="text-xs text-gray-400">(fără semnătură)</span>
                    )}
                  </div>
                  {/* Info + acțiune */}
                  <div className="p-4 space-y-2">
                    <div>
                      <div className="font-semibold text-sm text-gray-900 truncate" title={r.full_name}>
                        {r.full_name}
                      </div>
                      <div className="text-xs text-gray-400">{dateStr}</div>
                    </div>
                    <button onClick={() => togglePool(r)}
                      disabled={isToggling}
                      className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                        r.signature_pool
                          ? 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                          : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                      }`}>
                      {isToggling
                        ? <Loader2 size={12} className="animate-spin" />
                        : r.signature_pool
                          ? <><Check size={12} />În pool random</>
                          : <><X size={12} />Scos din pool</>}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
