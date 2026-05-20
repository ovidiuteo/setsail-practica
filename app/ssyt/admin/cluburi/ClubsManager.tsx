'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowUp, ArrowDown, Eye, EyeOff, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

type Club = {
  id: string
  slug: string
  name: string
  short_description: string | null
  logo_url: string | null
  display_order: number
  is_active: boolean
  created_at: string | null
}

type AppsCounts = Record<string, { active: number; total: number }>

export default function ClubsManager({
  clubs: initialClubs,
  appsCounts,
}: {
  clubs: Club[]
  appsCounts: AppsCounts
}) {
  const router = useRouter()
  const [clubs, setClubs] = useState<Club[]>(initialClubs)
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string>('')

  const supabase = createSupabaseBrowserClient()

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= clubs.length) return

    const a = clubs[index]
    const b = clubs[target]

    const next = [...clubs]
    next[index] = { ...b }
    next[target] = { ...a }
    setClubs(next)

    const { error: e1 } = await supabase
      .from('ssyt_sport_clubs')
      .update({ display_order: b.display_order })
      .eq('id', a.id)
    const { error: e2 } = await supabase
      .from('ssyt_sport_clubs')
      .update({ display_order: a.display_order })
      .eq('id', b.id)

    if (e1 || e2) {
      setMsg('Eroare la salvare ordine.')
      setClubs(initialClubs)
    } else {
      setMsg('Ordinea a fost salvată.')
      startTransition(() => router.refresh())
    }
  }

  async function toggleActive(club: Club) {
    const { error } = await supabase
      .from('ssyt_sport_clubs')
      .update({ is_active: !club.is_active })
      .eq('id', club.id)
    if (error) {
      setMsg('Eroare la activare/dezactivare.')
      return
    }
    setClubs((cs) => cs.map((c) => (c.id === club.id ? { ...c, is_active: !c.is_active } : c)))
    startTransition(() => router.refresh())
  }

  async function remove(club: Club) {
    if (!confirm(`Sigur ștergi clubul „${club.name}"? Aplicațiile active vor fi blocate.`)) return
    const { error } = await supabase.from('ssyt_sport_clubs').delete().eq('id', club.id)
    if (error) {
      setMsg('Eroare la ștergere: ' + error.message)
      return
    }
    setClubs((cs) => cs.filter((c) => c.id !== club.id))
    startTransition(() => router.refresh())
  }

  if (clubs.length === 0) {
    return (
      <div
        className="rounded-lg border border-dashed py-12 text-center"
        style={{ borderColor: '#cbd5e1', background: '#fff' }}
      >
        <p className="text-gray-500 mb-3">Niciun club configurat încă.</p>
        <Link
          href="/ssyt/admin/cluburi/nou"
          className="inline-block px-4 py-2 rounded-md text-sm font-medium"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          Adaugă primul club
        </Link>
      </div>
    )
  }

  return (
    <div>
      {msg && (
        <div className="mb-3 text-xs text-gray-500" aria-live="polite">
          {msg}
        </div>
      )}

      <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#f1f5f9', color: '#475569' }}>
              <th className="px-3 py-2 text-left font-medium w-24">Ordine</th>
              <th className="px-3 py-2 text-left font-medium">Club</th>
              <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Slug</th>
              <th className="px-3 py-2 text-center font-medium">Aplicații</th>
              <th className="px-3 py-2 text-center font-medium">Activ</th>
              <th className="px-3 py-2 text-right font-medium">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((club, i) => {
              const counts = appsCounts[club.id] ?? { active: 0, total: 0 }
              return (
                <tr key={club.id} className="border-t" style={{ borderColor: '#e2e8f0' }}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => move(i, -1)}
                        disabled={i === 0 || pending}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mută sus"
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        onClick={() => move(i, 1)}
                        disabled={i === clubs.length - 1 || pending}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Mută jos"
                      >
                        <ArrowDown size={14} />
                      </button>
                      <span className="text-xs text-gray-400 ml-1">#{club.display_order}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Link
                      href={`/ssyt/admin/cluburi/${club.id}`}
                      className="font-medium hover:underline"
                      style={{ color: '#0a1628' }}
                    >
                      {club.name}
                    </Link>
                    {club.short_description && (
                      <div className="text-xs text-gray-500 line-clamp-1">{club.short_description}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500 font-mono hidden md:table-cell">{club.slug}</td>
                  <td className="px-3 py-2 text-center">
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span className="font-semibold" style={{ color: '#FF6B35' }}>
                        {counts.active}
                      </span>
                      <span className="text-gray-400">/ {counts.total}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      onClick={() => toggleActive(club)}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title={club.is_active ? 'Dezactivează' : 'Activează'}
                    >
                      {club.is_active ? (
                        <Eye size={16} style={{ color: '#16a34a' }} />
                      ) : (
                        <EyeOff size={16} style={{ color: '#94a3b8' }} />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="inline-flex items-center gap-1">
                      <Link
                        href={`/ssyt/admin/cluburi/${club.id}`}
                        className="p-1.5 rounded hover:bg-gray-100"
                        title="Editează"
                      >
                        <SettingsIcon size={16} style={{ color: '#475569' }} />
                      </Link>
                      <button
                        onClick={() => remove(club)}
                        disabled={counts.active > 0}
                        className="p-1.5 rounded hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={
                          counts.active > 0
                            ? 'Nu poți șterge un club cu aplicații active'
                            : 'Șterge club'
                        }
                      >
                        <Trash2 size={16} style={{ color: '#dc2626' }} />
                      </button>
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
}
