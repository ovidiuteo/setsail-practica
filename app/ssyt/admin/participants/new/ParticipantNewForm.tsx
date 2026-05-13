'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

type TeamOption = { id: string; name: string; short_name: string | null; color_primary: string | null }

export default function ParticipantNewForm({ teams }: { teams: TeamOption[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    email: '',
    phone: '',
    date_of_birth: '',
    cnp: '',
    sailing_experience: '',
    regatta_experience: '',
    motivation: '',
    status: 'active' as const,
    notes: '',
    consent_gdpr: true,
    consent_public_profile: false,
    team_id: '',
    membership_type: 'core' as const,
  })

  async function save() {
    setError(null)
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('Prenume, nume și email sunt obligatorii.')
      return
    }

    setSaving(true)

    const insertData: any = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      nickname: form.nickname.trim() || null,
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      cnp: form.cnp.trim() || null,
      sailing_experience: form.sailing_experience.trim() || null,
      regatta_experience: form.regatta_experience.trim() || null,
      motivation: form.motivation.trim() || null,
      status: form.status,
      notes: form.notes.trim() || null,
      consent_gdpr: form.consent_gdpr,
      consent_gdpr_at: form.consent_gdpr ? new Date().toISOString() : null,
      consent_public_profile: form.consent_public_profile,
      accepted_at: form.status === 'accepted' || form.status === 'active' ? new Date().toISOString() : null,
    }

    const { data: participant, error: err } = await supabase
      .from('ssyt_participants')
      .insert(insertData)
      .select('id')
      .single()

    if (err) {
      setSaving(false)
      setError(err.message)
      return
    }

    // Daca a fost ales o echipa, cream si membership
    if (form.team_id && participant) {
      const { error: mErr } = await supabase
        .from('ssyt_team_memberships')
        .insert({
          team_id: form.team_id,
          participant_id: participant.id,
          membership_type: form.membership_type,
          status: 'active',
        })
      if (mErr) {
        setSaving(false)
        setError('Participant creat dar nu am putut adăuga în echipă: ' + mErr.message)
        return
      }
    }

    router.push(`/ssyt/admin/participants/${participant.id}`)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Prenume" required>
          <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" autoFocus />
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
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as any })} className="input">
            <option value="applied">applied</option>
            <option value="accepted">accepted</option>
            <option value="active">active</option>
            <option value="waitlist">waitlist</option>
            <option value="inactive">inactive</option>
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

      {/* Asignare directă la echipă */}
      <div className="rounded-lg p-4 mt-2" style={{ background: '#f8f9fa', border: '1px solid #e5e7eb' }}>
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Asignare la echipă (opțional)</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Field label="Echipă">
            <select value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })} className="input">
              <option value="">— nu asigna acum —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </Field>
          {form.team_id && (
            <Field label="Tip membership">
              <select value={form.membership_type} onChange={(e) => setForm({ ...form, membership_type: e.target.value as any })} className="input">
                <option value="core">core</option>
                <option value="occasional">occasional</option>
              </select>
            </Field>
          )}
        </div>
      </div>

      {/* Consimțământe */}
      <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.consent_gdpr} onChange={(e) => setForm({ ...form, consent_gdpr: e.target.checked })} />
          <span className="text-gray-700">Consimțământ GDPR acordat</span>
        </label>
        <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={form.consent_public_profile} onChange={(e) => setForm({ ...form, consent_public_profile: e.target.checked })} />
          <span className="text-gray-700">Profil public (vizibil pe site)</span>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 px-5 py-2 rounded-md font-medium text-sm text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {saving ? 'Se salvează...' : <><Save size={14} /> Creează participant</>}
        </button>
        <button onClick={() => router.back()} className="text-sm text-gray-500 hover:text-gray-900">
          Anulează
        </button>
        {error && <span className="text-sm text-red-600 ml-auto">{error}</span>}
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
