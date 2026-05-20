'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Mail } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import type { ContactRow } from './ClubEditor'

const CONTACT_TYPES = [
  { value: 'general', label: 'General' },
  { value: 'inscriere', label: 'Înscriere' },
  { value: 'contabilitate', label: 'Contabilitate' },
  { value: 'gdpr', label: 'GDPR' },
  { value: 'antrenor', label: 'Antrenor' },
  { value: 'altul', label: 'Altul' },
] as const

export default function ContactsTab({
  clubId,
  initial,
}: {
  clubId: string
  initial: ContactRow[]
}) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [contacts, setContacts] = useState<ContactRow[]>(initial)
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)

  // form pentru contact nou
  const [type, setType] = useState('general')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [label, setLabel] = useState('')

  async function add(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!email.trim()) {
      setError('Email obligatoriu.')
      return
    }
    setAdding(true)

    const maxOrder = contacts.reduce((m, c) => Math.max(m, c.display_order), -1)

    const { data, error: err } = await supabase
      .from('ssyt_club_contacts')
      .insert({
        club_id: clubId,
        contact_type: type,
        name: name.trim() || null,
        email: email.trim(),
        label: label.trim() || null,
        display_order: maxOrder + 1,
      })
      .select('*')
      .single()

    setAdding(false)

    if (err) {
      setError(err.message)
      return
    }

    setContacts((cs) => [...cs, data as ContactRow])
    setName('')
    setEmail('')
    setLabel('')
    setType('general')
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Sigur ștergi acest contact?')) return
    const { error: err } = await supabase.from('ssyt_club_contacts').delete().eq('id', id)
    if (err) {
      setError(err.message)
      return
    }
    setContacts((cs) => cs.filter((c) => c.id !== id))
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <div
        className="rounded-lg border overflow-hidden"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        {contacts.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Niciun contact configurat. Adaugă mai jos primul email.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#f1f5f9', color: '#475569' }}>
                <th className="px-3 py-2 text-left font-medium">Tip</th>
                <th className="px-3 py-2 text-left font-medium">Nume / Rol</th>
                <th className="px-3 py-2 text-left font-medium">Email</th>
                <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Etichetă</th>
                <th className="px-3 py-2 text-right font-medium">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => {
                const tDef = CONTACT_TYPES.find((t) => t.value === c.contact_type)
                return (
                  <tr key={c.id} className="border-t" style={{ borderColor: '#e2e8f0' }}>
                    <td className="px-3 py-2">
                      <span
                        className="inline-block text-xs px-2 py-0.5 rounded-full"
                        style={{ background: '#fff7ed', color: '#FF6B35' }}
                      >
                        {tDef?.label ?? c.contact_type}
                      </span>
                    </td>
                    <td className="px-3 py-2">{c.name ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{c.email}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 hidden md:table-cell">
                      {c.label ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => remove(c.id)}
                        className="p-1.5 rounded hover:bg-red-50"
                        title="Șterge"
                      >
                        <Trash2 size={14} style={{ color: '#dc2626' }} />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <form
        onSubmit={add}
        className="rounded-lg border p-4 space-y-3"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        <h3 className="text-sm font-medium" style={{ color: '#0a1628' }}>
          <Mail size={14} className="inline mr-1.5 align-middle" />
          Adaugă contact
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
              Tip
            </span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border text-sm"
              style={{ borderColor: '#cbd5e1' }}
            >
              {CONTACT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
              Nume / Rol
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border text-sm"
              style={{ borderColor: '#cbd5e1' }}
              placeholder="ex: Secretariat"
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
              Email *
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border text-sm"
              style={{ borderColor: '#cbd5e1' }}
              required
            />
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
              Etichetă
            </span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-2 py-1.5 rounded-md border text-sm"
              style={{ borderColor: '#cbd5e1' }}
              placeholder="ex: program L-V 9-17"
            />
          </label>
        </div>

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
          {adding ? 'Se adaugă...' : 'Adaugă'}
        </button>
      </form>
    </div>
  )
}
