'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Shield } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

export default function NewClubPage() {
  const router = useRouter()
  const supabase = createSupabaseBrowserClient()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [shortDescription, setShortDescription] = useState('')
  const [website, setWebsite] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function onNameChange(v: string) {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Numele e obligatoriu.')
      return
    }
    if (!slug.trim()) {
      setError('Slug-ul e obligatoriu.')
      return
    }

    setSaving(true)

    const { data: seasonRow } = await supabase
      .from('ssyt_seasons')
      .select('id')
      .in('status', ['planning', 'active'])
      .order('year', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data: maxRow } = await supabase
      .from('ssyt_sport_clubs')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const nextOrder = (maxRow?.display_order ?? -1) + 1

    const { data, error: insertError } = await supabase
      .from('ssyt_sport_clubs')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        short_description: shortDescription.trim() || null,
        website: website.trim() || null,
        address: address.trim() || null,
        phone: phone.trim() || null,
        season_id: seasonRow?.id ?? null,
        display_order: nextOrder,
        is_active: true,
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError) {
      if (insertError.code === '23505') {
        setError('Slug-ul există deja. Folosește altul.')
      } else {
        setError(insertError.message)
      }
      return
    }

    router.push(`/ssyt/admin/cluburi/${data.id}`)
  }

  return (
    <div className="px-8 py-8 max-w-3xl">
      <Link
        href="/ssyt/admin/cluburi"
        className="inline-flex items-center gap-1 text-sm text-gray-500 mb-4 hover:text-gray-700"
      >
        <ArrowLeft size={14} /> Înapoi la cluburi
      </Link>

      <h1
        className="text-3xl font-semibold tracking-tight mb-1"
        style={{ color: '#0a1628', letterSpacing: '-0.02em' }}
      >
        <Shield size={26} className="inline mr-2 align-middle" style={{ color: '#FF6B35' }} />
        Adaugă club nou
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        Completezi datele de bază acum. Documentele, contactele și procedurile le adaugi în pașii
        următori, după salvare.
      </p>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-lg border p-6"
        style={{ borderColor: '#e2e8f0', background: '#fff' }}
      >
        <Field label="Nume club *">
          <input
            type="text"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="ex: Clubul Nautic Olimpia Constanța"
            required
          />
        </Field>

        <Field label="Slug (URL) *" hint="folosit în /portal/club/<slug>. Auto-generat din nume.">
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value)
              setSlugTouched(true)
            }}
            className="w-full px-3 py-2 rounded-md border text-sm font-mono"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="ex: cno-constanta"
            pattern="[a-z0-9-]+"
            required
          />
        </Field>

        <Field label="Scurtă descriere" hint="1-2 propoziții. Apar pe cardul din portal.">
          <textarea
            value={shortDescription}
            onChange={(e) => setShortDescription(e.target.value)}
            rows={2}
            maxLength={280}
            className="w-full px-3 py-2 rounded-md border text-sm"
            style={{ borderColor: '#cbd5e1' }}
            placeholder="ex: Club afiliat la FRY, cu tradiție de peste 40 de ani la malul mării."
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
              placeholder="ex: +40 241 ..."
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
            placeholder="ex: Faleza Cazino, Constanța"
          />
        </Field>

        {error && (
          <div className="text-sm rounded-md px-3 py-2" style={{ background: '#fef2f2', color: '#dc2626' }}>
            {error}
          </div>
        )}

        <div className="pt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 rounded-md text-sm font-medium transition disabled:opacity-50"
            style={{ background: '#FF6B35', color: '#fff' }}
          >
            {saving ? 'Se salvează...' : 'Salvează și continuă'}
          </button>
          <Link
            href="/ssyt/admin/cluburi"
            className="px-4 py-2 rounded-md text-sm text-gray-600 hover:bg-gray-100"
          >
            Anulează
          </Link>
        </div>
      </form>
    </div>
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
