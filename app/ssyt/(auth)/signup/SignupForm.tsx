'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

export default function SignupForm() {
  const router = useRouter()
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setSuccess(null)

    const supabase = createSupabaseBrowserClient()
    const fullName = (firstName + ' ' + lastName).trim()

    // 1. Creez user-ul Supabase
    const { data: signupData, error: signupErr } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    })

    if (signupErr) {
      setError(signupErr.message)
      setLoading(false)
      return
    }

    const newUserId = signupData.user?.id
    if (!newUserId) {
      setError('Eroare la crearea contului. Încearcă din nou.')
      setLoading(false)
      return
    }

    // 2. Verific match pe nume sau email
    // Caut participant unde first_name + ' ' + last_name = fullName sau email match
    const { data: candidates } = await supabase
      .from('ssyt_participants')
      .select('id, first_name, last_name, full_name, email, user_id')
      .or(`full_name.ilike.${fullName},email.eq.${email}`)
      .is('user_id', null)
      .limit(5)

    if (candidates && candidates.length === 1) {
      // Match unic → leg automat
      const match = candidates[0]
      const { error: linkErr } = await supabase
        .from('ssyt_participants')
        .update({
          user_id: newUserId,
          auth_status: 'active',
          email: match.email || email,
          phone: phone || null,
        })
        .eq('id', match.id)

      if (!linkErr) {
        setSuccess(`Cont creat și legat de profilul tău (${match.full_name}). Verifică email-ul pentru confirmare.`)
        setTimeout(() => router.push('/ssyt/portal'), 2000)
        setLoading(false)
        return
      }
    }

    // 3. Match ambigu sau lipsă → creez signup_request pentru aprobare admin
    await supabase.from('ssyt_signup_requests').insert({
      user_id: newUserId,
      email,
      full_name: fullName,
      phone: phone || null,
      status: 'pending',
      suggested_participant_id: candidates && candidates.length >= 1 ? candidates[0].id : null,
      notes: candidates && candidates.length > 1 ? `${candidates.length} potriviri găsite — necesită review manual` : null,
    })

    setSuccess('Contul a fost creat. Cererea ta de aprobare a fost trimisă către organizator. Vei fi notificat când e aprobată.')
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Prenume *</label>
          <input
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
        <div>
          <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Nume *</label>
          <input
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="w-full px-3 py-2 border rounded-md text-sm"
            style={{ borderColor: '#d1d5db' }}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Email *</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Telefon</label>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
      </div>
      <div>
        <label className="block text-xs font-medium uppercase tracking-wider text-gray-500 mb-1">Parolă *</label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 border rounded-md text-sm"
          style={{ borderColor: '#d1d5db' }}
        />
        <p className="text-xs text-gray-400 mt-1">Minim 6 caractere.</p>
      </div>

      {error && (
        <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(239,68,68,0.08)', color: '#EF4444' }}>
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm p-3 rounded-md" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
          {success}
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !!success}
        className="w-full py-2.5 rounded-md font-medium text-white transition hover:opacity-90 disabled:opacity-50"
        style={{ background: '#FF6B35' }}
      >
        {loading ? 'Se creează contul...' : 'Creează cont'}
      </button>
    </form>
  )
}
