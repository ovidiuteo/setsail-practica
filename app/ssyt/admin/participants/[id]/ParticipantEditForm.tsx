'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save, Check } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export default function ParticipantEditForm({ participant }: { participant: any }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: participant.first_name || '',
    last_name: participant.last_name || '',
    nickname: participant.nickname || '',
    email: participant.email || '',
    phone: participant.phone || '',
    date_of_birth: participant.date_of_birth || '',
    cnp: participant.cnp || '',
    sailing_experience: participant.sailing_experience || '',
    regatta_experience: participant.regatta_experience || '',
    motivation: participant.motivation || '',
    status: participant.status || 'applied',
    notes: participant.notes || '',
    consent_public_profile: !!participant.consent_public_profile,
    consent_gdpr: !!participant.consent_gdpr,
  })

  async function handleSave() {
    setSaving(true)
    setError(null)
    setSaved(false)

    const updates: any = {
      first_name: form.first_name,
      last_name: form.last_name,
      nickname: form.nickname || null,
      email: form.email,
      phone: form.phone || null,
      date_of_birth: form.date_of_birth || null,
      cnp: form.cnp || null,
      sailing_experience: form.sailing_experience || null,
      regatta_experience: form.regatta_experience || null,
      motivation: form.motivation || null,
      status: form.status,
      notes: form.notes || null,
      consent_public_profile: form.consent_public_profile,
      consent_gdpr: form.consent_gdpr,
    }

    // Daca tocmai a fost acceptat, salvam accepted_at
    if (form.status === 'accepted' && !participant.accepted_at) {
      updates.accepted_at = new Date().toISOString()
    }
    if (form.consent_gdpr && !participant.consent_gdpr_at) {
      updates.consent_gdpr_at = new Date().toISOString()
    }

    const { error: err } = await supabase
      .from('ssyt_participants')
      .update(updates)
      .eq('id', participant.id)

    setSaving(false)
    if (err) {
      setError(err.message)
      return
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Prenume" required>
          <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" />
        </Field>
        <Field label="Nume" required>
          <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nickname">
          <input type="text" value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} className="input" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input">
            <option value="applied">applied</option>
            <option value="accepted">accepted</option>
            <option value="active">active</option>
            <option value="waitlist">waitlist</option>
            <option value="inactive">inactive</option>
            <option value="rejected">rejected</option>
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Email" required>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
        </Field>
        <Field label="Telefon">
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Data nașterii">
          <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="input" />
        </Field>
        <Field label="CNP">
          <input type="text" value={form.cnp} onChange={(e) => setForm({ ...form, cnp: e.target.value })} className="input font-mono" />
        </Field>
      </div>

      <Field label="Experiență sailing">
        <textarea value={form.sailing_experience} onChange={(e) => setForm({ ...form, sailing_experience: e.target.value })} rows={2} className="input" />
      </Field>

      <Field label="Experiență regatta">
        <textarea value={form.regatta_experience} onChange={(e) => setForm({ ...form, regatta_experience: e.target.value })} rows={2} className="input" />
      </Field>

      <Field label="Motivație">
        <textarea value={form.motivation} onChange={(e) => setForm({ ...form, motivation: e.target.value })} rows={2} className="input" />
      </Field>

      <Field label="Note interne">
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="input" />
      </Field>

      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.consent_gdpr} onChange={(e) => setForm({ ...form, consent_gdpr: e.target.checked })} />
          <span className="text-gray-700">Consimțământ GDPR</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.consent_public_profile} onChange={(e) => setForm({ ...form, consent_public_profile: e.target.checked })} />
          <span className="text-gray-700">Profil public (vizibil pe site)</span>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Salvează</>}
        </button>
        {saved && <span className="inline-flex items-center gap-1 text-sm text-green-600"><Check size={14} /> Salvat</span>}
        {error && <span className="text-sm text-red-600">Eroare: {error}</span>}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 14px;
          background: #fff;
          color: #0a1628;
          transition: border-color 0.15s;
        }
        .input:focus {
          outline: none;
          border-color: #FF6B35;
          box-shadow: 0 0 0 2px rgba(255,107,53,0.15);
        }
      `}</style>
    </div>
  )
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  )
}