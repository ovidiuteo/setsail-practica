'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

const ROLE_OPTIONS = [
  'Helm / Timonier',
  'Trim randă',
  'Trim genoa',
  'Pit',
  'Mast',
  'Bowman / Provier',
  'Tactician',
  'Floater',
  'Crew support',
  'Nu știu încă',
]

type TeamOption = {
  id: string
  name: string
  short_name: string | null
  color_primary: string | null
}

type Props = {
  seasonId: string
  teams: TeamOption[]
}

export default function ApplyForm({ seasonId, teams }: Props) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState<{
    first_name: string
    last_name: string
    email: string
    phone: string
    date_of_birth: string
    sailing_experience: string
    regatta_experience: string
    preferred_roles: string[]
    availability_notes: string
    motivation: string
    preferred_team_id: string
    consent_gdpr: boolean
  }>({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    date_of_birth: '',
    sailing_experience: '',
    regatta_experience: '',
    preferred_roles: [],
    availability_notes: '',
    motivation: '',
    preferred_team_id: '',
    consent_gdpr: false,
  })

  function toggleRole(role: string) {
    setForm((f) => ({
      ...f,
      preferred_roles: f.preferred_roles.includes(role)
        ? f.preferred_roles.filter((r) => r !== role)
        : [...f.preferred_roles, role],
    }))
  }

  async function submit() {
    setError(null)
    if (!form.first_name.trim() || !form.last_name.trim() || !form.email.trim()) {
      setError('Prenume, nume și email sunt obligatorii.')
      return
    }
    if (!form.consent_gdpr) {
      setError('Trebuie să accepți politica de date pentru a aplica.')
      return
    }
    setSubmitting(true)
    const { error: err } = await supabase.from('ssyt_applications').insert({
      season_id: seasonId,
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim() || null,
      date_of_birth: form.date_of_birth || null,
      sailing_experience: form.sailing_experience.trim() || null,
      regatta_experience: form.regatta_experience.trim() || null,
      preferred_roles: form.preferred_roles.length > 0 ? form.preferred_roles : null,
      availability_notes: form.availability_notes.trim() || null,
      motivation: form.motivation.trim() || null,
      preferred_team_id: form.preferred_team_id || null,
      source: 'website',
      status: 'pending',
      consent_gdpr: true,
      consent_gdpr_at: new Date().toISOString(),
    })
    setSubmitting(false)
    if (err) {
      setError(err.message)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: 'rgba(16,185,129,0.12)' }}>
          <CheckCircle2 size={32} style={{ color: '#10B981' }} />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2" style={{ color: '#0a1628', letterSpacing: '-0.02em' }}>
          Mulțumim, am primit aplicarea ta!
        </h2>
        <p className="text-gray-600 mb-6 max-w-md mx-auto">
          Te contactăm în câteva zile pentru o scurtă discuție și apoi îți comunicăm decizia.
        </p>
        <button
          onClick={() => router.push('/ssyt')}
          className="px-5 py-2.5 rounded-md font-medium text-sm text-white"
          style={{ background: '#FF6B35' }}
        >
          Înapoi la SSYT
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <SectionTitle>Date personale</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Prenume" required>
          <input type="text" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="input" autoFocus />
        </Field>
        <Field label="Nume" required>
          <input type="text" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="input" />
        </Field>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Email" required>
          <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
        </Field>
        <Field label="Telefon">
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="input" placeholder="+40..." />
        </Field>
      </div>
      <Field label="Data nașterii">
        <input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="input md:w-1/2" />
      </Field>

      <SectionTitle>Experiență</SectionTitle>
      <Field label="Experiență sailing">
        <textarea
          value={form.sailing_experience}
          onChange={(e) => setForm({ ...form, sailing_experience: e.target.value })}
          rows={3}
          className="input"
          placeholder="ex: Curs practic SetSail 2024, 5 ieșiri pe Marea Neagră..."
        />
      </Field>
      <Field label="Experiență regatta (dacă există)">
        <textarea
          value={form.regatta_experience}
          onChange={(e) => setForm({ ...form, regatta_experience: e.target.value })}
          rows={3}
          className="input"
          placeholder="ex: am participat la Cupa X în 2023..."
        />
      </Field>

      <Field label="Roluri preferate la bord (poți alege mai multe)">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
          {ROLE_OPTIONS.map((role) => {
            const active = form.preferred_roles.includes(role)
            return (
              <button
                key={role}
                type="button"
                onClick={() => toggleRole(role)}
                className="text-left px-3 py-2 rounded-md text-xs font-medium transition border"
                style={{
                  background: active ? 'rgba(255,107,53,0.1)' : '#fff',
                  borderColor: active ? '#FF6B35' : '#e5e7eb',
                  color: active ? '#FF6B35' : '#0a1628',
                }}
              >
                {role}
              </button>
            )
          })}
        </div>
      </Field>

      <SectionTitle>Disponibilitate & preferințe</SectionTitle>
      <Field label="Note disponibilitate">
        <textarea
          value={form.availability_notes}
          onChange={(e) => setForm({ ...form, availability_notes: e.target.value })}
          rows={2}
          className="input"
          placeholder="ex: disponibil în weekend-uri, lipsesc între 1-15 iulie..."
        />
      </Field>

      {teams.length > 0 && (
        <Field label="Echipă preferată (opțional)">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
            <button
              type="button"
              onClick={() => setForm({ ...form, preferred_team_id: '' })}
              className="px-3 py-2 rounded-md text-xs font-medium transition border"
              style={{
                background: !form.preferred_team_id ? 'rgba(255,107,53,0.1)' : '#fff',
                borderColor: !form.preferred_team_id ? '#FF6B35' : '#e5e7eb',
                color: !form.preferred_team_id ? '#FF6B35' : '#0a1628',
              }}
            >
              Fără preferință
            </button>
            {teams.map((t) => {
              const active = form.preferred_team_id === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setForm({ ...form, preferred_team_id: t.id })}
                  className="px-3 py-2 rounded-md text-xs font-medium transition border flex items-center gap-1.5 justify-center"
                  style={{
                    background: active ? 'rgba(255,107,53,0.1)' : '#fff',
                    borderColor: active ? '#FF6B35' : '#e5e7eb',
                    color: active ? '#FF6B35' : '#0a1628',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: t.color_primary || '#4A5568' }}></span>
                  {t.short_name || t.name}
                </button>
              )
            })}
          </div>
        </Field>
      )}

      <Field label="De ce vrei să faci parte din SSYT?">
        <textarea
          value={form.motivation}
          onChange={(e) => setForm({ ...form, motivation: e.target.value })}
          rows={4}
          className="input"
          placeholder="Câteva cuvinte despre motivația ta..."
        />
      </Field>

      <div className="pt-4 border-t border-gray-100">
        <label className="inline-flex items-start gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={form.consent_gdpr}
            onChange={(e) => setForm({ ...form, consent_gdpr: e.target.checked })}
            className="mt-0.5"
          />
          <span className="text-gray-700">
            Sunt de acord ca datele mele să fie procesate de SetSail NauticSchool în scopul gestionării aplicării și a participării în programul SSYT.
          </span>
        </label>
      </div>

      <div className="flex items-center gap-3 pt-4">
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md font-medium text-white hover:opacity-90 transition disabled:opacity-50"
          style={{ background: '#FF6B35' }}
        >
          {submitting ? 'Se trimite...' : <><Send size={14} /> Trimite aplicarea</>}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          padding: 10px 12px;
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 pt-3 pb-1">{children}</h3>
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