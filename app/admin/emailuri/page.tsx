'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import {
  Mail, CheckCircle, Clock, Ban, Search, RefreshCw,
  ChevronDown, ChevronUp, Send, Sparkles, Pin, PinOff,
  Filter, X, Check, ChevronRight, CheckSquare, Square,
  Download, Calendar
} from 'lucide-react'
import Link from 'next/link'

type Email = {
  id: string
  from_address: string
  from_name: string | null
  subject: string
  body_text: string | null
  received_at: string
  status: 'analyzed' | 'pending' | 'whitelist'
  is_processed: boolean
  is_pinned: boolean
  is_replied: boolean
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
  batch_number: number | null
}

type Tab = 'pending' | 'whitelist' | 'analyzed'

const priorityConfig: Record<string, { label: string; color: string; bg: string }> = {
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
  const [tab, setTab]         = useState<Tab>('pending')
  const [emails, setEmails]   = useState<Email[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [expandedId, setExpandedId]   = useState<string | null>(null)
  const [activeReply, setActiveReply] = useState<{ id: string; text: string } | null>(null)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)

  // Whitelist checkboxes
  const [selectedIds, setSelectedIds]         = useState<Set<string>>(new Set())
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(new Set())

  // Pending AI proposals
  const [proposals, setProposals]             = useState<Record<string, 'whitelist' | 'blacklist'>>({})
  const [proposalReasons, setProposalReasons] = useState<Record<string, string>>({})
  const [classifying, setClassifying]         = useState(false)
  const [committing, setCommitting]           = useState(false)

  // Batch Query
  const [showBatch, setShowBatch]               = useState(false)
  const [batchPrompt, setBatchPrompt]           = useState('')
  const [batchQuerying, setBatchQuerying]       = useState(false)
  const [batchResults, setBatchResults]         = useState<{ id: string; relevance: string }[]>([])
  const [selectedBatches, setSelectedBatches]   = useState<number[]>([])
  const [batchAnalyzingId, setBatchAnalyzingId] = useState<string | null>(null)

  // Fetch modal
  const [showFetch, setShowFetch]           = useState(false)
  const [fetchMode, setFetchMode]           = useState<'new' | 'last' | 'interval'>('new')
  const [fetchLimit, setFetchLimit]         = useState(50)
  const [fetchDateFrom, setFetchDateFrom]   = useState('')
  const [fetchDateTo, setFetchDateTo]       = useState('')
  const [fetching, setFetching]             = useState(false)
  const [fetchResult, setFetchResult]       = useState<any>(null)

  // ── Load ──────────────────────────────────────────────────────────────────

  const loadEmails = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('emails')
      .select('*')
      .in('status', ['analyzed', 'pending', 'whitelist'])
      .eq('is_replied', false)
      .order('is_pinned', { ascending: false })
      .order('received_at', { ascending: false })
    setEmails(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadEmails() }, [loadEmails])

  // ── Derived lists ─────────────────────────────────────────────────────────

  const pending        = emails.filter(e => e.status === 'pending')
  const whitelistAll   = emails.filter(e => e.status === 'whitelist')
  const whitelistVisible = whitelistAll.filter(e => e.is_pinned || !e.is_processed)
  const pinnedEmails   = whitelistVisible.filter(e => e.is_pinned)
  const unpinnedEmails = whitelistVisible.filter(e => !e.is_pinned)
  const analyzed       = emails.filter(e => e.status === 'analyzed')

  const batchNumbersRaw = whitelistAll.map(e => e.batch_number).filter(Boolean) as number[]
  const batchNumbers    = batchNumbersRaw.filter((v, i) => batchNumbersRaw.indexOf(v) === i).sort((a, b) => b - a)

  const filterList = (list: Email[]) => {
    if (!search.trim()) return list
    const q = search.toLowerCase()
    return list.filter(e =>
      e.from_address.toLowerCase().includes(q) ||
      e.subject?.toLowerCase().includes(q) ||
      e.ai_summary?.toLowerCase().includes(q)
    )
  }

  // ── Fetch emails from Yahoo ───────────────────────────────────────────────

  async function fetchEmails() {
    setFetching(true)
    setFetchResult(null)
    try {
      const res = await fetch('/api/fetch-emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode:     fetchMode,
          limit:    fetchLimit,
          dateFrom: fetchDateFrom || null,
          dateTo:   fetchDateTo   || null,
        }),
      })
      const data = await res.json()
      setFetchResult(data)
      if (data.success) await loadEmails()
    } catch {
      setFetchResult({ error: 'Eroare de conexiune' })
    }
    setFetching(false)
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  async function togglePin(email: Email) {
    const val = !email.is_pinned
    await supabase.from('emails').update({ is_pinned: val }).eq('id', email.id)
    setEmails(prev => prev.map(e => e.id === email.id ? { ...e, is_pinned: val } : e))
  }

  async function markProcessed(ids: string[]) {
    const eligible = ids.filter(id => {
      const email = emails.find(e => e.id === id)
      return email && !email.is_pinned
    })
    if (!eligible.length) return
    await supabase.from('emails').update({ is_processed: true }).in('id', eligible)
    setEmails(prev => prev.map(e => eligible.includes(e.id) ? { ...e, is_processed: true } : e))
    setSelectedIds(new Set())
  }

  async function markReplied(emailId: string) {
    await supabase.from('emails').update({ is_replied: true }).eq('id', emailId)
    setEmails(prev => prev.filter(e => e.id !== emailId))
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
        body: JSON.stringify({
          type: 'analyze',
          emails: [{ from_address: email.from_address, subject: email.subject, body_text: email.body_text }],
        }),
      })
      const ai = await res.json()
      await supabase.from('emails').update({
        status: 'analyzed', is_processed: true, ...ai
      }).eq('id', email.id)
      setEmails(prev => prev.map(e =>
        e.id === email.id ? { ...e, status: 'analyzed', is_processed: true, ...ai } : e
      ))
    } catch (err) { console.error(err) }
    setAnalyzingId(null)
  }

  async function sendReply(emailId: string, text: string) {
    const now = new Date().toISOString()
    await supabase.from('emails').update({ reply_sent: text, reply_sent_at: now }).eq('id', emailId)
    setEmails(prev => prev.map(e => e.id === emailId ? { ...e, reply_sent: text, reply_sent_at: now } : e))
    setActiveReply(null)
  }

  // ── Pending actions ───────────────────────────────────────────────────────

  async function movePendingSelected(type: 'whitelist' | 'blacklist') {
    const ids = Array.from(pendingSelected)
    if (!ids.length) return
    for (const id of ids) {
      const email = emails.find(e => e.id === id)
      if (!email) continue
      await supabase.from('email_rules').upsert(
        { email_address: email.from_address, rule_type: type },
        { onConflict: 'email_address' }
      )
      await supabase.from('emails').update({
        status: type === 'whitelist' ? 'whitelist' : 'blacklisted'
      }).eq('id', id)
    }
    setPendingSelected(new Set())
    loadEmails()
  }

  async function classifyPending() {
    if (!pending.length) return
    setClassifying(true)
    try {
      const res = await fetch('/api/analyze-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'classify',
          emails: pending.map(e => ({ from_address: e.from_address, subject: e.subject, body_text: e.body_text })),
        }),
      })
      const data = await res.json()
      const newP: Record<string, 'whitelist' | 'blacklist'> = {}
      const newR: Record<string, string> = {}
      for (const p of data.proposals || []) {
        const email = pending[p.index]
        if (email) { newP[email.from_address] = p.proposal; newR[email.from_address] = p.reason }
      }
      setProposals(newP); setProposalReasons(newR)
    } catch (err) { console.error(err) }
    setClassifying(false)
  }

  async function commitProposals() {
    if (!Object.keys(proposals).length) return
    setCommitting(true)
    const toWL = pending.filter(e => proposals[e.from_address] === 'whitelist')
    const toBL = pending.filter(e => proposals[e.from_address] === 'blacklist')
    for (const email of toWL) {
      await supabase.from('email_rules').upsert({ email_address: email.from_address, rule_type: 'whitelist' }, { onConflict: 'email_address' })
      await supabase.from('emails').update({ status: 'whitelist' }).eq('id', email.id)
    }
    for (const email of toBL) {
      await supabase.from('email_rules').upsert({ email_address: email.from_address, rule_type: 'blacklist' }, { onConflict: 'email_address' })
      await supabase.from('emails').update({ status: 'blacklisted' }).eq('id', email.id)
    }
    setProposals({}); setProposalReasons({})
    setCommitting(false); loadEmails()
  }

  // ── Batch Query ───────────────────────────────────────────────────────────

  function openBatchQuery() {
    setSelectedBatches(batchNumbers); setBatchResults([]); setBatchPrompt('')
    setShowBatch(true)
  }

  async function runBatchQuery() {
    if (!batchPrompt.trim()) return
    setBatchQuerying(true); setBatchResults([])
    const toQuery = emails.filter(e =>
      e.status === 'whitelist' &&
      (selectedBatches.length === 0 || selectedBatches.includes(e.batch_number as number))
    )
    if (!toQuery.length) { setBatchQuerying(false); return }
    try {
      const res = await fetch('/api/analyze-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'batch_query', prompt: batchPrompt,
          emails: toQuery.map(e => ({ id: e.id, from_address: e.from_address, subject: e.subject, body_text: e.body_text })),
        }),
      })
      const data = await res.json()
      setBatchResults(data.results || [])
    } catch (err) { console.error(err) }
    setBatchQuerying(false)
  }

  // ── Checkbox helpers ──────────────────────────────────────────────────────

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  function togglePendingSelect(id: string) {
    setPendingSelected(prev => {
      const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
    })
  }

  // ── Email Card ────────────────────────────────────────────────────────────

  function EmailCard({ email, showCheckbox = false }: { email: Email; showCheckbox?: boolean }) {
    const expanded   = expandedId === email.id
    const pri        = priorityConfig[email.ai_priority as string]
    const isReplying = activeReply?.id === email.id
    const isSelected = selectedIds.has(email.id)

    return (
      <div className={`bg-white rounded-xl border transition-all ${
        email.is_pinned ? 'border-yellow-300 shadow-md' :
        expanded ? 'border-gray-200 shadow-md' : 'border-gray-100 shadow-sm hover:border-gray-200'
      }`}>
        <div className="p-4 flex items-start gap-3">
          {showCheckbox && !email.is_pinned && (
            <button onClick={() => toggleSelect(email.id)} className="mt-0.5 shrink-0 text-gray-300 hover:text-gray-600">
              {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
            </button>
          )}
          {email.is_pinned && <div className="mt-1 shrink-0"><Pin size={13} className="text-yellow-500" /></div>}

          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold cursor-pointer"
            style={{ background: '#0a1628' }} onClick={() => setExpandedId(expanded ? null : email.id)}>
            {(email.from_name?.[0] || email.from_address[0]).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(expanded ? null : email.id)}>
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-medium text-gray-900 text-sm">{email.from_name || email.from_address}</span>
              {email.from_name && <span className="text-xs text-gray-400">{email.from_address}</span>}
              {pri && <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: pri.bg, color: pri.color }}>{pri.label}</span>}
              {email.category && <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-600">{categoryLabel[email.category] || email.category}</span>}
              {email.reply_sent && <span className="flex items-center gap-1 text-xs text-green-600"><Send size={10} /> Trimis</span>}
              {email.batch_number && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">#{email.batch_number}</span>}
            </div>
            <div className="text-sm font-medium text-gray-800 truncate">{email.subject}</div>
            {email.ai_summary && !expanded && <div className="text-xs text-gray-500 mt-0.5 truncate">{email.ai_summary}</div>}
            {!email.ai_summary && !expanded && email.body_text && <div className="text-xs text-gray-400 mt-0.5 truncate">{email.body_text.slice(0, 80)}</div>}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-400">{new Date(email.received_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}</span>

            {email.status === 'whitelist' && (
              <button onClick={e => { e.stopPropagation(); analyzeEmail(email) }} disabled={analyzingId === email.id}
                title="Analizează cu Claude"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                style={{ background: '#0a1628' }}>
                {analyzingId === email.id ? <RefreshCw size={11} className="animate-spin" /> : <Sparkles size={11} />}
                <span className="hidden sm:inline ml-0.5">AI</span>
              </button>
            )}

            {email.status === 'whitelist' && (
              <button onClick={e => { e.stopPropagation(); togglePin(email) }} title={email.is_pinned ? 'Scoate pin' : 'Pin'}
                className={`p-1.5 rounded-lg transition-colors ${email.is_pinned ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-yellow-400'}`}>
                {email.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
              </button>
            )}

            <button onClick={() => setExpandedId(expanded ? null : email.id)} className="p-1 text-gray-300 hover:text-gray-500">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

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
                      <span>📎</span><span className="font-medium text-gray-700">{att.filename}</span>
                      <span className="text-gray-400">({Math.round(att.size_bytes / 1024)}KB)</span>
                      <button onClick={() => navigator.clipboard.writeText(att.search_query)} className="ml-1 text-blue-500 hover:underline">🔍</button>
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

            {email.status === 'whitelist' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100 flex-wrap">
                <button onClick={() => analyzeEmail(email)} disabled={analyzingId === email.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#0a1628' }}>
                  {analyzingId === email.id ? <><RefreshCw size={11} className="animate-spin" /> Analizez...</> : <><Sparkles size={11} /> Analizează cu Claude</>}
                </button>
                {!email.is_pinned && (
                  <button onClick={() => markProcessed([email.id])}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Check size={11} /> Marchează Procesat
                  </button>
                )}
              </div>
            )}

            {email.status === 'analyzed' && (
              <div className="flex gap-2 pt-2 border-t border-gray-100">
                <button onClick={() => markReplied(email.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-green-200 text-green-700 hover:bg-green-50">
                  <Send size={11} /> Replied — elimină din listă
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ── Pending Card ──────────────────────────────────────────────────────────

  function PendingCard({ email }: { email: Email }) {
    const proposal   = proposals[email.from_address]
    const reason     = proposalReasons[email.from_address]
    const isSelected = pendingSelected.has(email.id)
    return (
      <div className={`bg-white rounded-xl border shadow-sm transition-all ${
        proposal === 'whitelist' ? 'border-green-200' :
        proposal === 'blacklist' ? 'border-red-200' :
        isSelected ? 'border-blue-200' : 'border-gray-100'
      }`}>
        <div className="p-4 flex items-start gap-3">
          <button onClick={() => togglePendingSelect(email.id)} className="mt-0.5 shrink-0 text-gray-300 hover:text-gray-600">
            {isSelected ? <CheckSquare size={16} className="text-blue-500" /> : <Square size={16} />}
          </button>
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
            style={{ background: '#0a1628' }}>
            {(email.from_name?.[0] || email.from_address[0]).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <span className="font-medium text-gray-900 text-sm">{email.from_name || email.from_address}</span>
              {email.from_name && <span className="text-xs text-gray-400">{email.from_address}</span>}
            </div>
            <div className="text-sm text-gray-700 truncate">{email.subject}</div>
            {reason && (
              <div className={`mt-1 text-xs px-2 py-0.5 rounded-full inline-flex items-center gap-1 ${
                proposal === 'whitelist' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                <Sparkles size={10} /> {reason}
              </div>
            )}
            {!reason && email.body_text && <div className="text-xs text-gray-400 mt-0.5 truncate">{email.body_text.slice(0, 80)}</div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-gray-400 mr-1">{new Date(email.received_at).toLocaleDateString('ro-RO', { day: '2-digit', month: 'short' })}</span>
            <button onClick={() => setProposals(p => ({ ...p, [email.from_address]: 'whitelist' }))}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                proposal === 'whitelist' ? 'bg-green-500 text-white' : 'border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
              }`}>
              <CheckCircle size={11} /> WL
            </button>
            <button onClick={() => setProposals(p => ({ ...p, [email.from_address]: 'blacklist' }))}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                proposal === 'blacklist' ? 'bg-red-500 text-white' : 'border border-gray-200 text-gray-500 hover:border-red-300 hover:text-red-500'
              }`}>
              <Ban size={11} /> BL
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  const tabs = [
    { id: 'pending'   as Tab, label: 'Pending',    count: pending.length,          icon: Clock },
    { id: 'whitelist' as Tab, label: 'Whitelist',  count: whitelistVisible.length,  icon: CheckCircle },
    { id: 'analyzed'  as Tab, label: 'Analizate',  count: analyzed.length,          icon: Sparkles },
  ]

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>Emailuri</h1>
          <p className="text-gray-500 text-sm mt-1">
            {pending.length} pending · {whitelistVisible.length} whitelist · {analyzed.length} analizate
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/emailuri/reguli"
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            Reguli
          </Link>
          <button onClick={loadEmails}
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:bg-gray-50">
            <RefreshCw size={14} />
          </button>
          <button onClick={() => { setFetchResult(null); setShowFetch(true) }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white hover:opacity-90"
            style={{ background: '#0a1628' }}>
            <Download size={14} /> Fetch Yahoo
          </button>
        </div>
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
            <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${
              tab === id ? 'bg-[#0a1628] text-white' : 'bg-gray-100 text-gray-500'
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input className="w-full border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
          placeholder="Caută după expeditor, subiect..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      {/* ── Tab: Pending ── */}
      {tab === 'pending' && (
        <div className="space-y-3">
          {loading ? <div className="py-12 text-center text-gray-400">Se încarcă...</div>
          : pending.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Clock size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun email pending.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{pending.length} emailuri pending</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {pendingSelected.size > 0 ? `${pendingSelected.size} selectate`
                      : Object.keys(proposals).length > 0
                        ? `${Object.values(proposals).filter(p => p === 'whitelist').length} → WL · ${Object.values(proposals).filter(p => p === 'blacklist').length} → BL propuse`
                        : 'Selectează manual sau folosește AI Propuneri'}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setPendingSelected(new Set(pending.map(e => e.id)))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <CheckSquare size={12} /> Toate
                  </button>
                  <button onClick={() => setPendingSelected(new Set())}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Square size={12} /> Niciunul
                  </button>
                  {pendingSelected.size > 0 && (
                    <>
                      <button onClick={() => movePendingSelected('whitelist')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                        style={{ background: '#059669' }}>
                        <CheckCircle size={12} /> WL ({pendingSelected.size})
                      </button>
                      <button onClick={() => movePendingSelected('blacklist')}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                        style={{ background: '#ef4444' }}>
                        <Ban size={12} /> BL ({pendingSelected.size})
                      </button>
                    </>
                  )}
                  <button onClick={classifyPending} disabled={classifying}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                    {classifying ? <><RefreshCw size={13} className="animate-spin" /> Analizez...</> : <><Sparkles size={13} /> AI Propuneri</>}
                  </button>
                  {Object.keys(proposals).length > 0 && (
                    <button onClick={commitProposals} disabled={committing}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                      style={{ background: '#0a1628' }}>
                      {committing ? <><RefreshCw size={13} className="animate-spin" /> Se aplică...</> : <><Check size={13} /> Commit ({Object.keys(proposals).length})</>}
                    </button>
                  )}
                </div>
              </div>
              {filterList(pending).map(e => <PendingCard key={e.id} email={e} />)}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Whitelist ── */}
      {tab === 'whitelist' && (
        <div className="space-y-3">
          {loading ? <div className="py-12 text-center text-gray-400">Se încarcă...</div>
          : whitelistVisible.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <CheckCircle size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun email în whitelist.</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 shadow-sm flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-gray-900 text-sm">
                    {whitelistVisible.length} emailuri
                    {pinnedEmails.length > 0 && <span className="ml-2 text-xs text-yellow-600">· {pinnedEmails.length} 📌 pinned</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {selectedIds.size > 0 ? `${selectedIds.size} selectate` : 'Selectează pentru acțiuni în masă'}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => setSelectedIds(new Set(unpinnedEmails.map(e => e.id)))}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <CheckSquare size={12} /> Toate
                  </button>
                  <button onClick={() => setSelectedIds(new Set())}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-600 hover:bg-gray-50">
                    <Square size={12} /> Niciunul
                  </button>
                  {selectedIds.size > 0 && (
                    <button onClick={() => markProcessed(Array.from(selectedIds))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-90"
                      style={{ background: '#059669' }}>
                      <Check size={12} /> Procesat ({selectedIds.size})
                    </button>
                  )}
                  <button onClick={openBatchQuery}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50">
                    <Filter size={12} /> Batch Query
                  </button>
                </div>
              </div>

              {pinnedEmails.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 px-1">
                    <Pin size={12} className="text-yellow-500" />
                    <span className="text-xs font-medium text-yellow-600">Pinned ({pinnedEmails.length})</span>
                  </div>
                  {filterList(pinnedEmails).map(e => <EmailCard key={e.id} email={e} />)}
                </div>
              )}

              {unpinnedEmails.length > 0 && (
                <div className="space-y-2">
                  {pinnedEmails.length > 0 && (
                    <div className="px-1 pt-2">
                      <span className="text-xs font-medium text-gray-400">Neprocesate ({unpinnedEmails.length})</span>
                    </div>
                  )}
                  {filterList(unpinnedEmails).map(e => <EmailCard key={e.id} email={e} showCheckbox />)}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── Tab: Analizate ── */}
      {tab === 'analyzed' && (
        <div className="space-y-3">
          {loading ? <div className="py-12 text-center text-gray-400">Se încarcă...</div>
          : analyzed.length === 0 ? (
            <div className="py-12 text-center text-gray-400">
              <Sparkles size={32} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">Niciun email analizat încă.</p>
            </div>
          ) : filterList(analyzed).map(e => <EmailCard key={e.id} email={e} />)}
        </div>
      )}

      {/* ── Fetch Modal ── */}
      {showFetch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900">Fetch emailuri Yahoo</h2>
                <p className="text-xs text-gray-400 mt-0.5">Importă emailuri noi din INBOX</p>
              </div>
              <button onClick={() => setShowFetch(false)} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="px-6 py-5 space-y-5">
              <div className="space-y-2">
                {[
                  { id: 'new',      label: 'Emailuri noi',        desc: 'De la ultimul fetch încoace', icon: '🆕' },
                  { id: 'last',     label: 'Ultimele X emailuri', desc: 'Specifică numărul dorit',     icon: '📥' },
                  { id: 'interval', label: 'Interval de date',    desc: 'Alege perioada',              icon: '📅' },
                ].map(opt => (
                  <button key={opt.id} onClick={() => setFetchMode(opt.id as any)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                      fetchMode === opt.id ? 'border-[#0a1628] bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <span className="text-lg">{opt.icon}</span>
                    <div className="flex-1">
                      <div className={`text-sm font-medium ${fetchMode === opt.id ? 'text-[#0a1628]' : 'text-gray-700'}`}>{opt.label}</div>
                      <div className="text-xs text-gray-400">{opt.desc}</div>
                    </div>
                    {fetchMode === opt.id && <Check size={14} className="text-[#0a1628] shrink-0" />}
                  </button>
                ))}
              </div>

              {fetchMode === 'last' && (
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1.5 block">Număr emailuri</label>
                  <input type="number" min={1} max={500}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    value={fetchLimit} onChange={e => setFetchLimit(parseInt(e.target.value) || 20)} />
                  <p className="text-xs text-gray-400 mt-1">Maximum 500 per fetch</p>
                </div>
              )}

              {fetchMode === 'interval' && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">De la</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={fetchDateFrom} onChange={e => setFetchDateFrom(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1.5 block">Până la</label>
                    <input type="date" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                      value={fetchDateTo} onChange={e => setFetchDateTo(e.target.value)} />
                  </div>
                </div>
              )}

              {fetchResult && (
                <div className={`p-3 rounded-xl text-sm ${fetchResult.error ? 'bg-red-50 border border-red-100 text-red-700' : 'bg-green-50 border border-green-100'}`}>
                  {fetchResult.error ? <p>❌ {fetchResult.error}</p> : (
                    <div className="space-y-1">
                      <p className="font-medium text-green-800">✅ Batch #{fetchResult.batchNumber} importat</p>
                      <div className="text-xs text-green-700 space-y-0.5">
                        <p>📥 Importate: <strong>{fetchResult.stats?.imported}</strong></p>
                        <p>✅ Whitelist: <strong>{fetchResult.stats?.whitelist}</strong></p>
                        <p>⏳ Pending: <strong>{fetchResult.stats?.pending}</strong></p>
                        <p>· Existente: <strong>{fetchResult.stats?.skipped}</strong></p>
                        <p>✗ Blacklist ignorate: <strong>{fetchResult.stats?.blacklisted}</strong></p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex justify-between shrink-0">
              <button onClick={() => setShowFetch(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">
                {fetchResult?.success ? 'Închide' : 'Anulează'}
              </button>
              <button onClick={fetchEmails} disabled={fetching || (fetchMode === 'interval' && !fetchDateFrom)}
                className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                style={{ background: '#0a1628' }}>
                {fetching ? <><RefreshCw size={13} className="animate-spin" /> Se importă...</> : <><Download size={13} /> Fetch</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Batch Query Modal ── */}
      {showBatch && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <div>
                <h2 className="font-semibold text-gray-900">Batch Query</h2>
                <p className="text-xs text-gray-400 mt-0.5">Filtrează emailurile din whitelist cu o întrebare în limbaj natural</p>
              </div>
              <button onClick={() => setShowBatch(false)} className="text-gray-300 hover:text-gray-600"><X size={18} /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
              {batchNumbers.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Filtrează după batch</div>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedBatches(selectedBatches.length === batchNumbers.length ? [] : [...batchNumbers])}
                      className="px-2.5 py-1 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50">
                      {selectedBatches.length === batchNumbers.length ? 'Deselectează toate' : 'Selectează toate'}
                    </button>
                    {batchNumbers.map(b => (
                      <button key={b}
                        onClick={() => setSelectedBatches(prev => prev.includes(b) ? prev.filter(x => x !== b) : [...prev, b])}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          selectedBatches.includes(b) ? 'bg-[#0a1628] text-white' : 'border border-gray-200 text-gray-500'
                        }`}>
                        Batch #{b}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-medium text-gray-500 mb-2">Întrebarea ta</div>
                <div className="flex gap-2">
                  <input className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder='ex: "care au legătură cu expediții?" sau "cine e la curs radio?"'
                    value={batchPrompt} onChange={e => setBatchPrompt(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && runBatchQuery()} />
                  <button onClick={runBatchQuery} disabled={batchQuerying || !batchPrompt.trim()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
                    style={{ background: '#0a1628' }}>
                    {batchQuerying ? <><RefreshCw size={13} className="animate-spin" /> Caut...</> : <><Sparkles size={13} /> Caută</>}
                  </button>
                </div>
              </div>

              {batchResults.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">{batchResults.length} emailuri relevante</div>
                  <div className="space-y-2">
                    {batchResults.map(result => {
                      const email = emails.find(e => e.id === result.id)
                      if (!email) return null
                      const isAnalyzing = batchAnalyzingId === email.id
                      const isDone      = email.status === 'analyzed'
                      return (
                        <div key={result.id} className={`p-3 rounded-xl border ${isDone ? 'border-green-100 bg-green-50' : 'border-gray-100 bg-gray-50'}`}>
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-gray-900 truncate">{email.from_name || email.from_address}</span>
                                {email.batch_number && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-200 text-gray-500">#{email.batch_number}</span>}
                                {email.is_pinned && <Pin size={11} className="text-yellow-500" />}
                              </div>
                              <div className="text-xs text-gray-600 truncate mb-1">{email.subject}</div>
                              <div className="text-xs text-blue-600 flex items-center gap-1">
                                <Sparkles size={10} /> {result.relevance}
                              </div>
                              {isDone && email.ai_summary && <div className="text-xs text-green-700 mt-1">{email.ai_summary}</div>}
                            </div>
                            <button
                              onClick={async () => { setBatchAnalyzingId(email.id); await analyzeEmail(email); setBatchAnalyzingId(null) }}
                              disabled={isAnalyzing || isDone}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 ${
                                isDone ? 'bg-green-100 text-green-600 cursor-default' : 'text-white hover:opacity-90 disabled:opacity-60'
                              }`}
                              style={isDone ? {} : { background: '#0a1628' }}>
                              {isAnalyzing ? <><RefreshCw size={11} className="animate-spin" /> Analizez...</>
                                : isDone ? <><Check size={11} /> Analizat</>
                                : <><ChevronRight size={11} /> Analizează</>}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {batchResults.length === 0 && batchPrompt && !batchQuerying && (
                <div className="py-6 text-center text-gray-400 text-sm">Niciun email relevant găsit.</div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex justify-end">
              <button onClick={() => setShowBatch(false)} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700">Închide</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
