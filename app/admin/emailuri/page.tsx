'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mail, CheckCircle, Clock, Ban, Search,
  ChevronDown, ChevronUp, Send, Sparkles, RefreshCw,
  AlertCircle, ExternalLink
} from 'lucide-react'
import Link from 'next/link'

type Email = {
  id: string
  from_address: string
  from_name: string | null
  subject: string
  body_text: string | null
  received_at: string
  status: 'analyzed' | 'pending'
  category: string | null
  ai_summary: string | null
  ai_sentiment: string | null
  ai_priority: string | null
  reply_suggestion_1: string | null
  reply_suggestion_2: string | null
  reply_suggestion_3: string | null
  reply_sent: string | null
  reply_sent_at: string | null
  attachments: any[]
}

type Rule = { id: string; email_address: string; rule_type: string }
type Tab = 'analyzed' | 'pending' | 'rules'

const priorityConfig = {
  high:   { label: 'Urgentă', color: '#ef4444', bg: '#fef2f2' },
  medium: { label: 'Normală', color: '#d97706', bg: '#fffbeb' },
  low:    { label: 'Scăzută', color: '#6b7280', bg: '#f9fafb' },
}
const sentimentIcon: Record<string, string> = { positive: '😊', neutral: '😐', negative: '😟' }
const categoryLabel: Record<string, string> = {
  access_request: 'Cerere acces', support: 'Suport',
  authentication: 'Autentificare', notification: 'Notificare',
  spam: 'Spam', other: 'Altele',
}

export default function EmailuriPage() {
  const [tab, setTab]           = useState<Tab>('analyzed')
  const [emails, setEmails]     = useState<Email[]>([])
  const [rules, setRules]       = useState<Rule[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeReply, setActiveReply] = useState<{ id: string; text: string } | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: em }, { data: ru }] = await Promise.all([
      supabase.from('emails').select('*').in('status', ['analyzed', 'pending']).order('received_at', { ascending: false }),
      supabase.from('email_rules').select('id, email_address, rule_type'),
    ])
    setEmails(em || [])
    setRules(ru || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  const analyzed = emails.filter(e => e.status === 'analyzed')
  const pending  = emails.filter(e => e.status === 'pending')
  const whitelist = rules.filter(r => r.rule_type === 'whitelist')
  const blacklist = rules.filter(r => r.rule_type === 'blacklist')

  const filtered = (list: Email[]) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(e =>
      e.from_address.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.ai_summary?.toLowerCase().includes(q)
    )
  }

  async function moveToWhitelist(email: Email) {
    await supabase.from('email_rules').upsert(
      { email_address: email.from_address, rule_type: 'whitelist' },
      { onConflict: 'email_address' }
    )
    await analyzeEmail(email)
  }

  async function moveToBlacklist(email: Email) {
    await supabase.from('email_rules').upsert(
      { email_address: email.from_address, rule_type: 'blacklist' },
      { onConflict: 'email_address' }
    )
    await supabase.from('emails').update({ status: 'blacklisted' }).eq('id', email.id)
    setEmails(prev => prev.filter(e => e.id !== email.id))
  }

  async function analyzeEmail(email: Email) {
    setAnalyzingId(email.id)
    try {
      const res = await fetch('/api/analyze-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: email.from_address, subject: email.subject, bodyText: email.body_text }),
      })
      const ai = await res.json()
      await supabase.from('emails').update({ status: 'analyzed', is_processed: true, ...ai }).eq('id', email.id)
      setEmails(prev => prev.map(e => e.id === email.id ? { ...e, status: 'analyzed', ...ai } : e))
    } catch (err) { console.error(err) }
    setAnalyzingId(null)
  }

  async function sendReply(emailId: string, text: string) {
    const now = new Date().toISOString()
    await supabase.from('emails').update({ reply_sent: text, reply_sent_at: now }).eq('id', emailId)
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, reply_sent: text, reply_sent_at: now } : e))
    setActiveReply(null)
  }

  // ── Email Card ──────────────────────────────────────────────────────────────

  function EmailCard({ email }: { email: Email }) {
    const expanded   = expandedId === email.id
    const pri        = priorityConfig[email.ai_priority as keyof typeof priorityConfig]
    const isReplying = activeReply?.id === email.id

    return (
      <div className={`bg-white rounded-xl border transition-all ${expanded ? 'border-gray-200 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200'}`}>
        <button className="w-full text-left p-4 flex items-start gap-3"
          onClick={() => setExpandedId(expanded ? null : email.id)}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
            style={{ background: '#0a1628' }}>
            {(email.from_name?.[0] || email.from_address[0]).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-medium text-gray-900 text-sm">{email.from_name || email.from_address}</span>
              {email.from_name && <span className="text-xs text-gray-400">{email.from_address}</span>}
              {pri && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span>}
              {email.category && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{categoryLabel[email.category] || email.category}</span>}
              {email.reply_sent && <span className="flex items-center gap-1 text-xs text-green-600"><Send size={10} /> Trimis</span>}
              {email.attachments?.length > 0 && <span className="text-xs text-blue-500">📎 {email.attachments.length}</span>}
            </div>
            <div className="text-sm font-medium text-gray-800 truncate">{email.subject}</div>
            {email.ai_summary && !expanded && <div className="text-xs text-gray-500 mt-0.5 truncate">{email.ai_summary}</div>}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-gray-400">{new Date(email.received_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}</span>
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </button>

        {expanded && (
          <div className="px-4 pb-4 border-t border-gray-50 pt-4 space-y-4">
            {email.ai_summary && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 border border-blue-100">
                <Sparkles size={14} className="text-blue-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-medium text-blue-700 mb-0.5">Rezumat AI</div>
                  <div className="text-sm text-blue-800">{email.ai_summary}</div>
                  {email.ai_sentiment && <div className="text-xs text-blue-500 mt-1">{sentimentIcon[email.ai_sentiment]} {email.ai_sentiment}</div>}
                </div>
              </div>
            )}

            {email.body_text && (
              <div className="p-3 rounded-lg bg-gray-50 text-xs text-gray-600 font-mono max-h-32 overflow-y-auto whitespace-pre-wrap">
                {email.body_text.slice(0, 600)}{email.body_text.length > 600 ? '...' : ''}
              </div>
            )}

            {email.attachments?.length > 0 && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Atașamente</div>
                <div className="flex flex-wrap gap-2">
                  {email.attachments.map((att: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-xs">
                      <span>📎</span>
                      <span className="font-medium text-gray-700">{att.filename}</span>
                      <span className="text-gray-400">({Math.round(att.size_bytes / 1024)}KB)</span>
                      <button onClick={() => navigator.clipboard.writeText(att.search_query)}
                        className="ml-1 text-blue-500 hover:underline" title="Copiază query de căutare">🔍</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(email.reply_suggestion_1 || email.reply_suggestion_2 || email.reply_suggestion_3) && !email.reply_sent && (
              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Propuneri răspuns</div>
                <div className="space-y-2">
                  {[
                    { label: 'Stil SetSail', text: email.reply_suggestion_1, color: '#0a1628' },
                    { label: 'Formal',       text: email.reply_suggestion_2, color: '#1e3a6e' },
                    { label: 'Friendly',     text: email.reply_suggestion_3, color: '#059669' },
                  ].filter(r => r.text).map((r, i) => (
                    <div key={i} className="p-3 rounded-lg border border-gray-100 bg-gray-50">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold" style={{ color: r.color }}>{r.label}</span>
                        <button onClick={() => setActiveReply({ id: email.id, text: r.text! })}
                          className="text-xs px-2 py-1 rounded-lg text-white hover:opacity-90" style={{ background: r.color }}>
                          Folosește
                        </button>
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-3">{r.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {email.reply_sent && (
              <div className="p-3 rounded-lg border border-green-100 bg-green-50">
                <div className="text-xs font-medium text-green-700 mb-1 flex items-center gap-1">
                  <Send size={11} /> Trimis la {new Date(email.reply_sent_at!).toLocaleDateString('ro-RO')}
                </div>
                <p className="text-xs text-green-800 line-clamp-3">{email.reply_sent}</p>
              </div>
            )}

            {isReplying && (
              <div className="p-3 rounded-lg border border-blue-200 bg-blue-50">
                <div className="text-xs font-medium text-blue-700 mb-2">Editează răspunsul</div>
                <textarea className="w-full border border-blue-200 rounded-lg p-2.5 text-xs text-gray-800 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-blue-300"
                  rows={6} value={activeReply.text}
                  onChange={e => setActiveReply({ ...activeReply, text: e.target.value })} />
                <div className="flex gap-2 mt-2">
                  <button onClick={() => sendReply(email.id, activeReply.text)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: '#059669' }}>
                    <Send size={11} /> Marchează ca trimis
                  </button>
                  <button onClick={() => setActiveReply(null)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
                    Anulează
                  </button>
                </div>
              </div>
            )}

            {email.status === 'pending' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => moveToWhitelist(email)} disabled={analyzingId === email.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#059669' }}>
                  {analyzingId === email.id
                    ? <><RefreshCw size={11} className="animate-spin" /> Analizez...</>
                    : <><CheckCircle size={11} /> Whitelist + Analizează</>}
                </button>
                <button onClick={() => moveToBlacklist(email)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50">
                  <Ban size={11} /> Blacklist + Șterge
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Tabs ────────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'analyzed' as Tab, label: 'Analizate',    count: analyzed.length, icon: CheckCircle },
    { id: 'pending'  as Tab, label: 'În așteptare', count: pending.length,  icon: Clock },
    { id: 'rules'    as Tab, label: 'Reguli',       icon: Ban },
  ]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Emailuri</h1>
          <p className="text-gray-500 text-sm mt-1">
            {whitelist.length} whitelist · {blacklist.length} blacklist · {pending.length} în așteptare
          </p>
        </div>
        <button onClick={loadAll}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90"
          style={{ background: '#0a1628' }}>
          <RefreshCw size={14} /> Reîncarcă
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === id ? 'border-[#0a1628] text-[#0a1628]' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon size={14} />
            {label}
            {count !== undefined && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
                tab === id ? 'bg-[#0a1628] text-white' : 'bg-gray-100 text-gray-500'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      {tab !== 'rules' && (
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
            placeholder="Caută după expeditor, subiect, rezumat..."
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      )}

      {/* ── Tab: Analizate ── */}
      {tab === 'analyzed' && (
        <div className="space-y-3">
          {loading ? (
            <div className="py-12 text-center text-gray-400">Se încarcă...</div>
          ) : filtered(analyzed).length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Mail size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun email analizat încă.</p>
            </div>
          ) : filtered(analyzed).map(e => <EmailCard key={e.id} email={e} />)}
        </div>
      )}

      {/* ── Tab: Pending ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-100 mb-2">
              <AlertCircle size={14} className="text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                Emailuri de la expeditori necunoscuți. Decide per email: <strong>Whitelist + Analizează</strong> sau <strong>Blacklist + Șterge</strong>.
              </p>
            </div>
          )}
          {loading ? (
            <div className="py-12 text-center text-gray-400">Se încarcă...</div>
          ) : filtered(pending).length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun email în așteptare.</p>
            </div>
          ) : filtered(pending).map(e => <EmailCard key={e.id} email={e} />)}
        </div>
      )}

      {/* ── Tab: Reguli ── */}
      {tab === 'rules' && (
        <div className="space-y-4">
          {/* Stats rapide */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle size={15} className="text-green-500" />
                <span className="font-semibold text-gray-900">Whitelist</span>
                <span className="ml-auto text-2xl font-bold text-green-600" style={{ fontFamily: 'Georgia, serif' }}>{whitelist.length}</span>
              </div>
              <p className="text-xs text-gray-400">Adrese analizate automat cu Claude</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <Ban size={15} className="text-red-400" />
                <span className="font-semibold text-gray-900">Blacklist</span>
                <span className="ml-auto text-2xl font-bold text-red-500" style={{ fontFamily: 'Georgia, serif' }}>{blacklist.length}</span>
              </div>
              <p className="text-xs text-gray-400">Adrese ignorate complet</p>
            </div>
          </div>

          {/* Link spre pagina dedicată */}
          <Link href="/admin/emailuri/reguli"
            className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-100 shadow-sm hover:border-gray-200 hover:shadow-md transition-all group">
            <div>
              <div className="font-semibold text-gray-900 mb-0.5">Gestionează listele</div>
              <div className="text-xs text-gray-400">Adaugă, șterge, importă din CSV/Excel, exportă</div>
            </div>
            <ExternalLink size={16} className="text-gray-300 group-hover:text-gray-500 transition-colors" />
          </Link>
        </div>
      )}
    </div>
  )
}