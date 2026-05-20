'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowUp, ArrowDown, ListOrdered } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import type { ProcedureRow } from './ClubEditor'

export default function ProceduresTab({
  clubId,
  initial,
}: {
  clubId: string
  initial: ProcedureRow[]
}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [steps, setSteps] = useState<ProcedureRow[]>(initial)
  const [error, setError] = useState('')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [link, setLink] = useState('')
  const [adding, setAdding] = useState(false)

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!title.trim()) {
      setError('Titlul e obligatoriu.')
      return
    }
    setAdding(true)
    const nextStep = (steps[steps.length - 1]?.step_no ?? 0) + 1

    const { data, error: err } = await supabase
      .from('ssyt_club_procedures')
      .insert({
        club_id: clubId,
        step_no: nextStep,
        title: title.trim(),
        description_md: description.trim() || null,
        optional_link: link.trim() || null,
      })
      .select('*')
      .single()

    setAdding(false)
    if (err) {
      setError(err.message)
      return
    }

    setSteps((s) => [...s, data as ProcedureRow])
    setTitle('')
    setDescription('')
    setLink('')
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Sigur ștergi pasul?')) return
    const { error: err } = await supabase.from('ssyt_club_procedures').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setSteps((s) => s.filter((p) => p.id !== id))
    router.refresh()
  }

  async function move(index: number, dir: -1 | 1) {
    const target = index + dir
    if (target < 0 || target >= steps.length) return

    const a = steps[index]
    const b = steps[target]

    const next = [...steps]
    next[index] = { ...b, step_no: a.step_no }
    next[target] = { ...a, step_no: b.step_no }
    setSteps(next)

    await supabase.from('ssyt_club_procedures').update({ step_no: b.step_no }).eq('id', a.id)
    await supabase.from('ssyt_club_procedures').update({ step_no: a.step_no }).eq('id', b.id)
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        {steps.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Niciun pas configurat. Adaugă primul pas mai jos.
          </div>
        ) : (
          <ol className="divide-y" style={{ borderColor: '#e2e8f0' }}>
            {steps.map((step, i) => (
              <li key={step.id} className="px-4 py-3 flex items-start gap-3">
                <div
                  className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold"
                  style={{ background: '#fff7ed', color: '#FF6B35' }}
                >
                  {step.step_no}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm" style={{ color: '#0a1628' }}>
                    {step.title}
                  </div>
                  {step.description_md && (
                    <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{step.description_md}</div>
                  )}
                  {step.optional_link && (
                    <a
                      href={step.optional_link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline mt-1 inline-block"
                      style={{ color: '#FF6B35' }}
                    >
                      {step.optional_link}
                    </a>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => move(i, -1)}
                    disabled={i === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mută sus"
                  >
                    <ArrowUp size={14} />
                  </button>
                  <button
                    onClick={() => move(i, 1)}
                    disabled={i === steps.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mută jos"
                  >
                    <ArrowDown size={14} />
                  </button>
                  <button
                    onClick={() => remove(step.id)}
                    className="p-1 rounded hover:bg-red-50"
                    title="Șterge"
                  >
                    <Trash2 size={14} style={{ color: '#dc2626' }} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <form
        onSubmit={add}
        className="rounded-lg border p-4 space-y-3"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        <h3 className="text-sm font-medium" style={{ color: '#0a1628' }}>
          <ListOrdered size={14} className="inline mr-1.5 align-middle" />
          Adaugă pas
        </h3>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
            Titlu *
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="ex: Trimite cererea de înscriere"
            required
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
            Descriere (opțional)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="Detalii suplimentare pentru cursant"
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
            Link opțional
          </span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            className="w-full px-2 py-1.5 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="https://..."
          />
        </label>

        {error && (
          <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={adding}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium disabled:opacity-50"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Plus size={14} />
          {adding ? 'Se adaugă...' : 'Adaugă pas'}
        </button>
      </form>
    </div>
  )
}
