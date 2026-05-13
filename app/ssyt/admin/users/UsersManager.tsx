'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Copy, Check, Send, Mail, UserPlus, Pause, Play, Shield, Trash2, AlertCircle, X, Inbox } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/ssyt/supabase-browser'

type UserRow = {
  participant_id: string
  full_name: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  user_id: string | null
  auth_status: string
  participant_status: string
  has_placeholder_email: boolean
  last_sign_in_at: string | null
  admin_level: string | null
  team_name: string | null
  team_color: string | null
}

type SignupRequest = {
  id: string
  user_id: string
  email: string
  full_name: string
  status: string
  notes: string | null
  created_at: string
}

async function callAPI(action: string, params: any = {}) {
  const supabase = createSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('Nu ești logat.')

  const res = await fetch('/api/ssyt/admin/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...params }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || 'Eroare necunoscută')
  return data
}

export default function UsersManager({
  initialUsers, initialSignupRequests,
}: {
  initialUsers: UserRow[]
  initialSignupRequests: SignupRequest[]
}) {
  const router = useRouter()
  const [users] = useState<UserRow[]>(initialUsers)
  const [signupRequests] = useState<SignupRequest[]>(initialSignupRequests)
  const [filter, setFilter] = useState<'all' | 'no_account' | 'invited' | 'active' | 'suspended' | 'admin'>('all')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [resultModal, setResultModal] = useState<{ title: string; data: any } | null>(null)

  async function action(label: string, fn: () => Promise<any>, key: string) {
    setBusy(key)
    try {
      const data = await fn()
      if (data) setResultModal({ title: label, data })
      router.refresh()
    } catch (e: any) {
      alert('Eroare: ' + e.message)
    } finally {
      setBusy(null)
    }
  }

  const filtered = users.filter((u) => {
    if (filter === 'no_account' && u.user_id) return false
    if (filter === 'invited' && u.auth_status !== 'invited') return false
    if (filter === 'active' && u.auth_status !== 'active') return false
    if (filter === 'suspended' && u.auth_status !== 'suspended') return false
    if (filter === 'admin' && !u.admin_level) return false
    if (search && !u.full_name.toLowerCase().includes(search.toLowerCase()) && !u.email?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {/* Inbox cereri signup pending */}
      {signupRequests.length > 0 && (
        <div className="rounded-lg p-4 mb-6" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Inbox size={16} style={{ color: '#F59E0B' }} />
            <h3 className="font-semibold text-sm" style={{ color: '#92400E' }}>
              {signupRequests.length} cereri de signup pending
            </h3>
          </div>
          <div className="space-y-2">
            {signupRequests.map((r) => (
              <div key={r.id} className="rounded-md p-3 flex items-center gap-3" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
                <div className="flex-1">
                  <div className="font-medium text-sm" style={{ color: '#0a1628' }}>{r.full_name}</div>
                  <div className="text-xs text-gray-500">{r.email}</div>
                  {r.notes && <div className="text-xs text-amber-600 mt-1">⚠ {r.notes}</div>}
                </div>
                <span className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString('ro-RO')}</span>
                {/* TODO: butoane Aprobă/Respinge cu legare la participant */}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filtre */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Caută nume sau email..."
          className="px-3 py-1.5 border rounded-md text-sm flex-1 min-w-[200px]"
          style={{ borderColor: '#d1d5db' }}
        />
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="px-3 py-1.5 border rounded-md text-sm" style={{ borderColor: '#d1d5db', background: '#fff' }}>
          <option value="all">Toți ({users.length})</option>
          <option value="no_account">Fără cont ({users.filter((u) => !u.user_id).length})</option>
          <option value="invited">Invitați ({users.filter((u) => u.auth_status === 'invited').length})</option>
          <option value="active">Activi ({users.filter((u) => u.auth_status === 'active').length})</option>
          <option value="suspended">Suspendați ({users.filter((u) => u.auth_status === 'suspended').length})</option>
          <option value="admin">Cu rol admin ({users.filter((u) => u.admin_level).length})</option>
        </select>
        <span className="text-xs text-gray-500">{filtered.length} rezultate</span>
      </div>

      {/* Tabel */}
      <div className="rounded-lg overflow-x-auto" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
        <table className="w-full text-sm" style={{ minWidth: 1200 }}>
          <thead style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
            <tr>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Nume</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Email</th>
              <th className="text-left px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Echipă</th>
              <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Cont</th>
              <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Rol admin</th>
              <th className="text-center px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Ultim login</th>
              <th className="text-right px-4 py-2 text-xs font-medium uppercase tracking-wider text-gray-500">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.participant_id} className="hover:bg-gray-50" style={{ borderTop: '1px solid #f3f4f6' }}>
                <td className="px-4 py-2">
                  <Link href={`/ssyt/admin/participants/${u.participant_id}`} className="font-medium hover:underline" style={{ color: '#0a1628' }}>
                    {u.full_name}
                  </Link>
                </td>
                <td className="px-4 py-2 text-xs">
                  <span className={u.has_placeholder_email ? 'text-amber-600' : 'text-gray-700'}>
                    {u.email}
                  </span>
                  {u.has_placeholder_email && <span className="ml-1 text-[9px] uppercase tracking-wider" style={{ color: '#F59E0B' }}>placeholder</span>}
                </td>
                <td className="px-4 py-2 text-xs">
                  {u.team_name ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: u.team_color || '#4A5568' }}></span>
                      {u.team_name}
                    </span>
                  ) : (
                    <span className="text-gray-400 italic">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center">
                  <StatusBadge status={u.auth_status} hasAccount={!!u.user_id} />
                </td>
                <td className="px-4 py-2 text-center">
                  {u.user_id ? (
                    <RoleSelect
                      currentLevel={u.admin_level}
                      participantId={u.participant_id}
                      busy={busy === `role-${u.participant_id}`}
                      onChange={(newLevel) => action('Rol actualizat', () => callAPI('set_admin_level', { participantId: u.participant_id, level: newLevel }), `role-${u.participant_id}`)}
                    />
                  ) : (
                    <span className="text-xs text-gray-300">—</span>
                  )}
                </td>
                <td className="px-4 py-2 text-center text-xs text-gray-500">
                  {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ro-RO') : '—'}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="inline-flex items-center gap-1">
                    {!u.user_id && (
                      <button
                        onClick={() => action('Cont creat', () => callAPI('create_user', { participantId: u.participant_id }), `create-${u.participant_id}`)}
                        disabled={busy === `create-${u.participant_id}`}
                        className="px-2 py-1 rounded text-xs font-medium transition hover:opacity-80 disabled:opacity-50 inline-flex items-center gap-1"
                        style={{ background: '#FF6B35', color: '#fff' }}
                        title="Creează cont"
                      >
                        <UserPlus size={11} />
                        <span>Creează</span>
                      </button>
                    )}
                    {u.user_id && (
                      <>
                        <button
                          onClick={() => action('Link de primă logare', () => callAPI('generate_invite_link', { participantId: u.participant_id }), `link-${u.participant_id}`)}
                          disabled={busy === `link-${u.participant_id}`}
                          className="text-gray-500 hover:text-gray-900 p-1.5 disabled:opacity-50"
                          title="Generează link primul login"
                        >
                          <Send size={13} />
                        </button>
                        {u.auth_status === 'suspended' ? (
                          <button
                            onClick={() => action('Reactivat', () => callAPI('reactivate', { participantId: u.participant_id }), `react-${u.participant_id}`)}
                            disabled={busy === `react-${u.participant_id}`}
                            className="text-green-600 hover:text-green-800 p-1.5 disabled:opacity-50"
                            title="Reactivează"
                          >
                            <Play size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => { if (confirm('Suspendă contul?')) action('Suspendat', () => callAPI('suspend', { participantId: u.participant_id }), `susp-${u.participant_id}`) }}
                            disabled={busy === `susp-${u.participant_id}`}
                            className="text-amber-600 hover:text-amber-800 p-1.5 disabled:opacity-50"
                            title="Suspendă"
                          >
                            <Pause size={13} />
                          </button>
                        )}
                        <button
                          onClick={() => { if (confirm('Ștergi DEFINITIV contul? Participantul rămâne în DB dar fără cont.')) action('Cont șters', () => callAPI('delete_account', { participantId: u.participant_id }), `del-${u.participant_id}`) }}
                          disabled={busy === `del-${u.participant_id}`}
                          className="text-red-600 hover:text-red-800 p-1.5 disabled:opacity-50"
                          title="Șterge cont"
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal cu rezultat (parola temporara sau link) */}
      {resultModal && (
        <ResultModal modal={resultModal} onClose={() => setResultModal(null)} />
      )}
    </div>
  )
}

function StatusBadge({ status, hasAccount }: { status: string; hasAccount: boolean }) {
  if (!hasAccount) {
    return <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: 'rgba(156,163,175,0.15)', color: '#6B7280' }}>fără cont</span>
  }
  const config: Record<string, { color: string; label: string }> = {
    invited: { color: '#F59E0B', label: 'invitat' },
    active: { color: '#10B981', label: 'activ' },
    suspended: { color: '#EF4444', label: 'suspendat' },
    no_account: { color: '#9CA3AF', label: 'fără cont' },
  }
  const c = config[status] || { color: '#9CA3AF', label: status }
  return (
    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium" style={{ background: `${c.color}15`, color: c.color }}>
      {c.label}
    </span>
  )
}

function RoleSelect({ currentLevel, participantId, busy, onChange }: { currentLevel: string | null; participantId: string; busy: boolean; onChange: (v: string) => void }) {
  return (
    <select
      value={currentLevel || ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={busy}
      className="text-xs px-2 py-1 rounded border"
      style={{ borderColor: '#d1d5db', background: '#fff' }}
    >
      <option value="">— niciun rol —</option>
      <option value="viewer">viewer</option>
      <option value="editor">editor</option>
      <option value="admin">admin</option>
      <option value="super_admin">super_admin</option>
    </select>
  )
}

function ResultModal({ modal, onClose }: { modal: { title: string; data: any }; onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  function copy(value: string, key: string) {
    navigator.clipboard.writeText(value)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,22,40,0.6)' }} onClick={onClose}>
      <div className="bg-white rounded-lg max-w-xl w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h3 className="font-semibold tracking-tight text-lg" style={{ color: '#0a1628' }}>{modal.title}</h3>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>

        {modal.data.tempPassword && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Parolă temporară (vizibilă doar acum, copiaz-o!):</p>
            <div className="rounded-md p-3 flex items-center gap-2" style={{ background: '#FEF3C7', border: '1px solid #F59E0B' }}>
              <code className="flex-1 font-mono text-sm" style={{ color: '#92400E' }}>{modal.data.tempPassword}</code>
              <button onClick={() => copy(modal.data.tempPassword, 'pwd')} className="px-2 py-1 rounded text-xs font-medium" style={{ background: '#F59E0B', color: '#fff' }}>
                {copied === 'pwd' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}

        {modal.data.email && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Email:</p>
            <div className="rounded-md p-3 flex items-center gap-2" style={{ background: '#f8f9fa', border: '1px solid #e5e7eb' }}>
              <code className="flex-1 font-mono text-sm" style={{ color: '#0a1628' }}>{modal.data.email}</code>
              <button onClick={() => copy(modal.data.email, 'email')} className="px-2 py-1 rounded text-xs font-medium hover:bg-gray-200" style={{ color: '#0a1628' }}>
                {copied === 'email' ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </div>
          </div>
        )}

        {modal.data.link && (
          <div className="mb-3">
            <p className="text-xs text-gray-500 mb-1">Link primul login (1 utilizare, expiră în 24h):</p>
            <div className="rounded-md p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid #10B981' }}>
              <code className="block font-mono text-[10px] break-all mb-2" style={{ color: '#0a1628' }}>{modal.data.link}</code>
              <div className="flex items-center gap-2">
                <button onClick={() => copy(modal.data.link, 'link')} className="px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1" style={{ background: '#10B981', color: '#fff' }}>
                  {copied === 'link' ? <Check size={12} /> : <Copy size={12} />}
                  <span>Copiază link</span>
                </button>
                <a href={modal.data.link} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded text-xs font-medium hover:opacity-80 inline-flex items-center gap-1" style={{ background: '#FF6B35', color: '#fff' }}>
                  Deschide în tab nou
                </a>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">💡 Trimite acest link membrului prin WhatsApp/SMS. La click setează parolă proprie.</p>
          </div>
        )}

        {modal.data.success && !modal.data.link && !modal.data.tempPassword && (
          <p className="text-sm text-green-600">✓ Acțiune realizată cu succes.</p>
        )}
      </div>
    </div>
  )
}
