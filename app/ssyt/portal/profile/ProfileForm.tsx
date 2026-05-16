'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ProfileForm({ initial }: { initial: any }) {
  const router = useRouter()
  const [form, setForm] = useState({
    phone: initial.phone || '',
    photo_url: initial.photo_url || '',
    dietary_restrictions: initial.dietary_restrictions || '',
    emergency_contact: initial.emergency_contact || '',
    t_shirt_size: initial.t_shirt_size || '',
  })
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    const res = await fetch('/api/ssyt/portal-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Eroare la salvare.'); return }
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-lg p-6" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
      {/* Read-only fields */}
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Nume complet</label>
        <input value={initial.full_name || ''} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50 text-gray-500" />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Email</label>
        <input value={initial.email || ''} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50 text-gray-500" />
      </div>
      {initial.cnp && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">CNP</label>
          <input value={initial.cnp} disabled className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50 text-gray-500 font-mono" />
        </div>
      )}
      {initial.date_of_birth && (
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Data nașterii</label>
          <input
            value={new Date(initial.date_of_birth).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}
            disabled
            className="w-full px-3 py-2 border rounded-md text-sm bg-gray-50 text-gray-500"
          />
        </div>
      )}

      <div className="pt-3 border-t" style={{ borderColor: '#e5e7eb' }}>
        <p className="text-xs uppercase tracking-wider text-gray-500 mb-3 font-medium">Date editabile</p>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Telefon</label>
        <input
          type="tel"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Photo URL</label>
        <input
          type="url"
          value={form.photo_url}
          onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
          placeholder="https://..."
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Mărime tricou</label>
          <select
            value={form.t_shirt_size}
            onChange={(e) => setForm({ ...form, t_shirt_size: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          >
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
          <input
            value={form.emergency_contact}
            onChange={(e) => setForm({ ...form, emergency_contact: e.target.value })}
            placeholder="Nume + telefon"
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Restricții alimentare</label>
        <input
          value={form.dietary_restrictions}
          onChange={(e) => setForm({ ...form, dietary_restrictions: e.target.value })}
          placeholder="Vegetarian, alergii, etc."
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>

      {error && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>{error}</div>}
      {success && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>Profil salvat cu succes.</div>}

      <button type="submit" disabled={saving} className="py-2 px-5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? 'Se salvează...' : 'Salvează modificările'}
      </button>
    </form>
  )
}
