'use client'
import { useEffect, useState } from 'react'
import { useCurrentUser } from '@/lib/ssyt/useCurrentUser'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function PortalProfilePage() {
  const { user, participant, loading } = useCurrentUser()
  const [form, setForm] = useState<any>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dataLoading, setDataLoading] = useState(true)

  useEffect(() => {
    if (loading || !participant) return
    async function load() {
      const supabase = createSupabaseBrowserClient()
      const { data } = await supabase
        .from('ssyt_participants')
        .select('id, first_name, last_name, email, phone, photo_url, notes, dietary_restrictions, emergency_contact, t_shirt_size')
        .eq('id', participant.id)
        .maybeSingle()
      setForm({
        id: data?.id,
        first_name: data?.first_name || '',
        last_name: data?.last_name || '',
        phone: data?.phone || '',
        photo_url: data?.photo_url || '',
        dietary_restrictions: data?.dietary_restrictions || '',
        emergency_contact: data?.emergency_contact || '',
        t_shirt_size: data?.t_shirt_size || '',
        notes: data?.notes || '',
      })
      setDataLoading(false)
    }
    load()
  }, [participant, loading])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase
      .from('ssyt_participants')
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || null,
        photo_url: form.photo_url || null,
        dietary_restrictions: form.dietary_restrictions || null,
        emergency_contact: form.emergency_contact || null,
        t_shirt_size: form.t_shirt_size || null,
        notes: form.notes || null,
      })
      .eq('id', form.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  if (loading || dataLoading || !form) {
    return <div className="max-w-3xl mx-auto px-6 py-8 text-sm text-gray-400">Se încarcă...</div>
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="mb-6">
        <p className="text-xs font-medium uppercase tracking-wider mb-1" style={{ color: '#FF6B35' }}>Profil</p>
        <h1 className="text-3xl font-semibold tracking-tight" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Date personale
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Actualizează datele tale. Email-ul nu poate fi schimbat direct (contactează organizatorul).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Email</label>
          <input value={user?.email || ''} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50 text-gray-500" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Prenume *</label>
            <input required value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Nume *</label>
            <input required value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Telefon</label>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Photo URL</label>
          <input type="url" value={form.photo_url} onChange={(e) => setForm({ ...form, photo_url: e.target.value })} placeholder="https://..." className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Mărime tricou</label>
            <select value={form.t_shirt_size} onChange={(e) => setForm({ ...form, t_shirt_size: e.target.value })} className="w-full px-3 py-2 border rounded-md text-sm">
              <option value="">—</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Contact urgență</label>
            <input value={form.emergency_contact} onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })} placeholder="Nume + telefon" className="w-full px-3 py-2 border rounded-md text-sm" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Restricții alimentare</label>
          <input value={form.dietary_restrictions} onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })} placeholder="Vegetarian, alergii, etc." className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Notițe</label>
          <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-md text-sm" />
        </div>

        {error && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>{error}</div>}
        {success && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>Profil salvat cu succes.</div>}

        <button type="submit" disabled={saving} className="py-2 px-5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: '#FF6B35' }}>
          {saving ? 'Se salvează...' : 'Salvează modificările'}
        </button>
      </form>
    </div>
  )
}
