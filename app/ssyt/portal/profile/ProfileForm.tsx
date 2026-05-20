'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FileText, CheckCircle2 } from 'lucide-react'

export default function ProfileForm({ initial }: { initial: any }) {
  const router = useRouter()
  const [form, setForm] = useState({
    phone: initial.phone || '',
    photo_url: initial.photo_url || '',
    dietary_restrictions: initial.dietary_restrictions || '',
    emergency_contact: initial.emergency_contact || '',
    t_shirt_size: initial.t_shirt_size || '',
    ci_seria: initial.ci_seria || '',
    ci_numar: initial.ci_numar || '',
    ci_emis_de: initial.ci_emis_de || '',
    ci_emisa_la: initial.ci_emisa_la || '',
    loc_nasterii: initial.loc_nasterii || '',
    judet_nasterii: initial.judet_nasterii || '',
    cetatenia: initial.cetatenia || 'Română',
    adresa_completa: initial.adresa_completa || '',
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

      <div className="pt-3 border-t" style={{ borderColor: '#e5e7eb' }}>
        <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
          <p className="text-xs uppercase tracking-wider text-gray-500 font-medium">
            <FileText size={12} className="inline mr-1 align-middle" />
            Date pentru documente oficiale
          </p>
          <Link
            href="/ssyt/portal/profile/identitate"
            className="text-xs underline"
            style={{ color: '#FF6B35' }}
          >
            Upload poză CI + semnătură →
          </Link>
        </div>
        <p className="text-xs text-gray-400">
          Folosite la generarea cererilor către cluburi sportive (CI, declarații, formulare adeziune).
        </p>
        {initial.ci_image_url && initial.signature_image_url && (
          <p className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: '#16a34a' }}>
            <CheckCircle2 size={12} /> CI și semnătura sunt încărcate
          </p>
        )}
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
          Adresa completă (domiciliu)
        </label>
        <input
          value={form.adresa_completa}
          onChange={(e) => setForm({ ...form, adresa_completa: e.target.value })}
          placeholder="Str. Exemplu nr. 12, bl. A, sc. 1, et. 3, ap. 15, sector 1, București"
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
            Loc nașterii (oraș)
          </label>
          <input
            value={form.loc_nasterii}
            onChange={(e) => setForm({ ...form, loc_nasterii: e.target.value })}
            placeholder="ex: București"
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">
            Județul nașterii
          </label>
          <input
            value={form.judet_nasterii}
            onChange={(e) => setForm({ ...form, judet_nasterii: e.target.value })}
            placeholder="ex: Sector 1 sau Constanța"
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Cetățenia</label>
        <input
          value={form.cetatenia}
          onChange={(e) => setForm({ ...form, cetatenia: e.target.value })}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">CI seria</label>
          <input
            value={form.ci_seria}
            onChange={(e) =>
              setForm({ ...form, ci_seria: e.target.value.toUpperCase().slice(0, 2) })
            }
            placeholder="ex: RR"
            maxLength={2}
            className="w-full px-3 py-2 border rounded-md text-sm font-mono uppercase"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">CI număr</label>
          <input
            value={form.ci_numar}
            onChange={(e) => setForm({ ...form, ci_numar: e.target.value.replace(/\D/g, '').slice(0, 8) })}
            placeholder="ex: 123456"
            className="w-full px-3 py-2 border rounded-md text-sm font-mono"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">CI emisă de</label>
          <input
            value={form.ci_emis_de}
            onChange={(e) => setForm({ ...form, ci_emis_de: e.target.value })}
            placeholder="ex: SPCEP Sector 1"
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">CI emisă la data</label>
          <input
            type="date"
            value={form.ci_emisa_la}
            onChange={(e) => setForm({ ...form, ci_emisa_la: e.target.value })}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
      </div>

      {error && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>{error}</div>}
      {success && <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>Profil salvat cu succes.</div>}

      <button type="submit" disabled={saving} className="py-2 px-5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50" style={{ background: '#FF6B35' }}>
        {saving ? 'Se salvează...' : 'Salvează modificările'}
      </button>
    </form>
  )
}
