'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X, UserPlus, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/ssyt/supabase'

export default function ApplicationDecisionForm({ application, teams }: { application: any; teams: any[] }) {
  const router = useRouter()
  const [status, setStatus] = useState(application.status)
  const [decisionNotes, setDecisionNotes] = useState(application.decision_notes || '')
  const [targetTeamId, setTargetTeamId] = useState(application.preferred_team_id || '')
  const [membershipType, setMembershipType] = useState('core')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const hasCreatedParticipant = !!application.created_participant_id

  async function saveStatus() {
    setSaving(true)
    setError(null)
    setMessage(null)
    const { error: err } = await supabase
      .from('ssyt_applications')
      .update({
        status,
        decision_notes: decisionNotes || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', application.id)
    setSaving(false)
    if (err) { setError(err.message); return }
    setMessage('Status actualizat')
    router.refresh()
  }

  async function acceptAndCreate() {
    setSaving(true)
    setError(null)
    setMessage(null)

    // 1. Verific daca exista deja participant cu acelasi email
    const { data: existing } = await supabase
      .from('ssyt_participants')
      .select('id')
      .eq('email', application.email)
      .maybeSingle()

    let participantId: string

    if (existing) {
      participantId = existing.id
    } else {
      // 2. Creez participant
      const { data: created, error: pErr } = await supabase
        .from('ssyt_participants')
        .insert({
          first_name: application.first_name,
          last_name: application.last_name,
          email: application.email,
          phone: application.phone,
          date_of_birth: application.date_of_birth,
          sailing_experience: application.sailing_experience,
          regatta_experience: application.regatta_experience,
          motivation: application.motivation,
          student_id: application.student_id,
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          consent_gdpr: true,
          consent_gdpr_at: application.consent_gdpr_at || new Date().toISOString(),
        })
        .select('id')
        .single()
      if (pErr || !created) {
        setSaving(false)
        setError(pErr?.message || 'Nu am putut crea participantul.')
        return
      }
      participantId = created.id
    }

    // 3. Daca am team selectat, creez si membership
    if (targetTeamId) {
      const { error: mErr } = await supabase
        .from('ssyt_team_memberships')
        .insert({
          team_id: targetTeamId,
          participant_id: participantId,
          membership_type: membershipType,
          status: 'active',
        })
      // Ignor eroare daca exista deja membership
      if (mErr && !mErr.message.includes('duplicate')) {
        setSaving(false)
        setError('Participant creat dar nu am putut adăuga în echipă: ' + mErr.message)
        return
      }
    }

    // 4. Update application
    await supabase
      .from('ssyt_applications')
      .update({
        status: 'accepted',
        decision_notes: decisionNotes || null,
        reviewed_at: new Date().toISOString(),
        created_participant_id: participantId,
      })
      .eq('id', application.id)

    setSaving(false)
    setMessage('Participant creat și adăugat în echipă!')
    router.refresh()
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg p-5" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <h3 className="text-xs font-medium uppercase tracking-wider text-gray-500 mb-3">Decizie</h3>

        {hasCreatedParticipant && (
          <div className="mb-3 p-3 rounded-md text-xs" style={{ background: 'rgba(16,185,129,0.08)', color: '#10B981' }}>
            <Check size={12} className="inline mr-1" />
            Participant creat: <Link href={`/ssyt/admin/participants/${application.created_participant_id}`} className="underline font-medium">{application.created_participant?.full_name}</Link>
          </div>
        )}

        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Status</label>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3" style={{ borderColor: '#d1d5db' }}>
          <option value="pending">pending</option>
          <option value="accepted">accepted</option>
          <option value="waitlist">waitlist</option>
          <option value="occasional">occasional</option>
          <option value="rejected">rejected</option>
          <option value="needs_discussion">needs_discussion</option>
        </select>

        <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Note interne</label>
        <textarea
          value={decisionNotes}
          onChange={(e) => setDecisionNotes(e.target.value)}
          rows={3}
          placeholder="Note vizibile doar admin..."
          className="w-full px-3 py-2 border rounded-md text-sm mb-3"
          style={{ borderColor: '#d1d5db' }}
        />

        <button
          onClick={saveStatus}
          disabled={saving}
          className="w-full px-4 py-2 rounded-md text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          style={{ background: '#0a1628' }}
        >
          {saving ? '...' : 'Salvează decizie'}
        </button>
      </div>

      {/* Quick accept */}
      {!hasCreatedParticipant && (
        <div className="rounded-lg p-5" style={{ background: 'rgba(255,107,53,0.04)', border: '1px solid rgba(255,107,53,0.3)' }}>
          <h3 className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#FF6B35' }}>
            <UserPlus size={12} className="inline mr-1" />
            Accept rapid
          </h3>
          <p className="text-xs text-gray-600 mb-3">
            Acceptă aplicarea și creează participant + (opțional) adaugă-l direct într-o echipă.
          </p>

          <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Alocare echipă</label>
          <select value={targetTeamId} onChange={(e) => setTargetTeamId(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3" style={{ borderColor: '#d1d5db' }}>
            <option value="">— nu aloca acum —</option>
            {teams.map((t: any) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          {targetTeamId && (
            <>
              <label className="block text-xs uppercase tracking-wider text-gray-500 mb-1">Tip membership</label>
              <select value={membershipType} onChange={(e) => setMembershipType(e.target.value)} className="w-full px-3 py-2 border rounded-md text-sm mb-3" style={{ borderColor: '#d1d5db' }}>
                <option value="core">core</option>
                <option value="occasional">occasional</option>
              </select>
            </>
          )}

          <button
            onClick={acceptAndCreate}
            disabled={saving}
            className="w-full px-4 py-2 rounded-md text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            style={{ background: '#FF6B35' }}
          >
            {saving ? 'Se procesează...' : <><UserPlus size={14} className="inline mr-1" /> Accept și creează participant</>}
          </button>
        </div>
      )}

      {message && (
        <div className="rounded-md p-3 text-xs" style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
          <Check size={12} className="inline mr-1" /> {message}
        </div>
      )}
      {error && (
        <div className="rounded-md p-3 text-xs" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
          <AlertCircle size={12} className="inline mr-1" /> {error}
        </div>
      )}
    </div>
  )
}