'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Save, Check, RotateCcw } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import { ADMIN_NAV, orderNav, type NavItem } from '@/lib/ssyt/admin-nav'

export default function SidebarOrderForm({ seasonId, initialOrder }: { seasonId: string; initialOrder?: string[] | null }) {
  const router = useRouter()
  const [items, setItems] = useState<NavItem[]>(orderNav(initialOrder))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function move(index: number, dir: -1 | 1) {
    const j = index + dir
    if (j < 0 || j >= items.length) return
    const next = [...items]
    ;[next[index], next[j]] = [next[j], next[index]]
    setItems(next)
    setSaved(false)
  }

  function reset() {
    setItems(ADMIN_NAV)
    setSaved(false)
  }

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const supabase = createSupabaseBrowserClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) { setError('Nu ești logat ca admin.'); setSaving(false); return }
      const res = await fetch('/api/ssyt/admin/sidebar-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ season_id: seasonId, order: items.map((i) => i.href) }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || 'Eroare'); setSaving(false); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <p className="text-xs text-gray-500 mb-4">Reordonează butoanele din bara laterală admin. Schimbarea se aplică tuturor adminilor.</p>

      <div className="rounded-lg overflow-hidden mb-4" style={{ border: '1px solid #e5e7eb' }}>
        {items.map((item, i) => {
          const Icon = item.icon
          return (
            <div key={item.href} className="flex items-center gap-3 px-3 py-2" style={{ borderTop: i === 0 ? 'none' : '1px solid #f3f4f6', background: '#fff' }}>
              <span className="text-xs text-gray-400 w-5 text-right tabular-nums">{i + 1}</span>
              <span className="w-7 h-7 rounded flex items-center justify-center flex-shrink-0" style={{ background: '#0a1628', color: '#FF6B35' }}>
                <Icon size={14} />
              </span>
              <span className="flex-1 text-sm font-medium" style={{ color: '#0a1628' }}>{item.label}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="Sus">
                  <ArrowUp size={14} className="text-gray-500" />
                </button>
                <button onClick={() => move(i, 1)} disabled={i === items.length - 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="Jos">
                  <ArrowDown size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-50" style={{ background: '#FF6B35' }}>
          {saved ? <Check size={14} /> : <Save size={14} />} {saving ? 'Se salvează...' : saved ? 'Salvat' : 'Salvează ordinea'}
        </button>
        <button onClick={reset} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-600 hover:text-gray-900" title="Revino la ordinea default">
          <RotateCcw size={14} /> Default
        </button>
        {error && <span className="text-xs text-red-600 ml-2">{error}</span>}
      </div>
    </div>
  )
}
