'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'
import type { ClubRow } from './ClubEditor'

export default function InfoTab({ club }: { club: ClubRow }) {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [name, setName] = useState(club.name)
  const [slug, setSlug] = useState(club.slug)
  const [shortDescription, setShortDescription] = useState(club.short_description ?? '')
  const [descriptionMd, setDescriptionMd] = useState(club.description_md ?? '')
  const [logoUrl, setLogoUrl] = useState(club.logo_url ?? '')
  const [address, setAddress] = useState(club.address ?? '')
  const [website, setWebsite] = useState(club.website ?? '')
  const [phone, setPhone] = useState(club.phone ?? '')
  const [isActive, setIsActive] = useState(club.is_active)

  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setMsg('')
    setError('')
    setSaving(true)

    const { error: e1 } = await supabase
      .from('ssyt_sport_clubs')
      .update({
        name: name.trim(),
        slug: slug.trim(),
        short_description: shortDescription.trim() || null,
        description_md: descriptionMd.trim() || null,
        logo_url: logoUrl.trim() || null,
        address: address.trim() || null,
        website: website.trim() || null,
        phone: phone.trim() || null,
        is_active: isActive,
      })
      .eq('id', club.id)

    setSaving(false)
    if (e1) {
      setError(e1.code === '23505' ? 'Slug-ul există deja la alt club.' : e1.message)
      return
    }
    setMsg('Salvat.')
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-4 rounded-lg border p-6" style={{ borderColor: '#e2e8f0', background: '#fff' }}>
      <Field label="Nume club *">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{ borderColor: '#cbd5e1' }}
          required
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Slug *" hint="folosit în /portal/club/<slug>">
          <input
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm font-mono"
            style={{ borderColor: '#cbd5e1' }}
            pattern="[a-z0-9-]+"
            required
          />
        </Field>

        <Field label="Logo URL" hint="link absolut spre o imagine">
          <input
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="https://..."
          />
        </Field>
      </div>

      <Field label="Scurtă descriere" hint="apar pe cardul din portal (max 280 char)">
        <textarea
          value={shortDescription}
          onChange={(e) => setShortDescription(e.target.value)}
          rows={2}
          maxLength={280}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{ borderColor: '#cbd5e1' }}
        />
      </Field>

      <Field label="Descriere completă (markdown)" hint="apare pe pagina de detalii">
        <textarea
          value={descriptionMd}
          onChange={(e) => setDescriptionMd(e.target.value)}
          rows={8}
          className="w-full px-3 py-2 rounded-md border text-sm font-mono"
          style={{ borderColor: '#cbd5e1' }}
          placeholder="# Despre club\n\nText markdown..."
        />
      </Field>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Website">
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="https://..."
          />
        </Field>

        <Field label="Telefon">
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
          />
        </Field>
      </div>

      <Field label="Adresă">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full px-3 py-2 rounded-md border text-sm"
          style={{ borderColor: '#cbd5e1' }}
        />
      </Field>

      <label className="inline-flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded"
        />
        Club activ (vizibil în portal)
      </label>

      {error && (
        <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
          {error}
        </div>
      )}
      {msg && (
        <div className="text-sm rounded-md px-3 py-2" style={{ background: '#f0fdf4', color: '#16a34a' }}>
          {msg}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
          style={{ background: '#FF6B35', color: '#fff' }}
        >
          <Save size={14} />
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </button>
      </div>
    </form>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
        {label}
      </span>
      {children}
      {hint && <span className="block text-xs text-gray-400 mt-1">{hint}</span>}
    </label>
  )
}
