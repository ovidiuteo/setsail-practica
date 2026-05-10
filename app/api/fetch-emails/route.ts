import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
)

// ─── IMAP fetch logic (server-side) ──────────────────────────────────────────

async function loadRules() {
  const whitelist = new Set<string>()
  const blacklist = new Set<string>()
  let from = 0
  const pageSize = 1000

  while (true) {
    const { data } = await supabase
      .from('email_rules')
      .select('email_address, rule_type')
      .range(from, from + pageSize - 1)
    for (const rule of data || []) {
      if (rule.rule_type === 'whitelist') whitelist.add(rule.email_address.toLowerCase())
      if (rule.rule_type === 'blacklist') blacklist.add(rule.email_address.toLowerCase())
    }
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return { whitelist, blacklist }
}

function parseAttachments(parsed: any, from: string, subject: string) {
  if (!parsed.attachments?.length) return []
  return parsed.attachments.map((att: any) => ({
    filename:     att.filename || 'unknown',
    mime_type:    att.contentType || 'application/octet-stream',
    size_bytes:   att.size || 0,
    search_query: `from:${from} subject:"${subject}" has:attachment${att.filename ? ` filename:${att.filename}` : ''}`,
  }))
}

export async function POST(req: NextRequest) {
  const { mode, limit, dateFrom, dateTo } = await req.json()

  const YAHOO_USER = process.env.YAHOO_USER
  const YAHOO_PASS = process.env.YAHOO_APP_PASSWORD

  if (!YAHOO_USER || !YAHOO_PASS) {
    return NextResponse.json({ error: 'IMAP credentials missing' }, { status: 500 })
  }

  try {
    // Dynamic imports (server-side only)
    const { ImapFlow }    = await import('imapflow')
    const { simpleParser } = await import('mailparser')

    const { whitelist, blacklist } = await loadRules()

    // Batch number
    const { data: maxBatch } = await supabase
      .from('emails').select('batch_number')
      .order('batch_number', { ascending: false }).limit(1).maybeSingle()
    const batchNumber = (maxBatch?.batch_number || 0) + 1

    // Last fetch date (for 'new' mode)
    const { data: lastEmail } = await supabase
      .from('emails').select('received_at')
      .order('received_at', { ascending: false }).limit(1).maybeSingle()
    const lastFetchDate = lastEmail?.received_at ? new Date(lastEmail.received_at) : null

    const client = new ImapFlow({
      host: 'imap.mail.yahoo.com',
      port: 993,
      secure: true,
      auth: { user: YAHOO_USER, pass: YAHOO_PASS },
      logger: false,
    })

    await client.connect()
    const lock = await client.getMailboxLock('INBOX')

    let fetchRange = '1:*'
    const total = (client.mailbox as any).exists

    if (mode === 'last') {
      // Ultimele X emailuri
      const n = Math.min(limit || 20, 500)
      const start = Math.max(1, total - n + 1)
      fetchRange = `${start}:*`
    } else if (mode === 'new') {
      // Emailuri noi de la ultimul fetch
      // Vom filtra după dată post-fetch
      const n = Math.min(200, total)
      const start = Math.max(1, total - n + 1)
      fetchRange = `${start}:*`
    } else if (mode === 'interval') {
      // Interval — luăm ultimele 500 și filtrăm
      const n = Math.min(500, total)
      const start = Math.max(1, total - n + 1)
      fetchRange = `${start}:*`
    }

    const stats = { imported: 0, skipped: 0, blacklisted: 0, errors: 0, whitelist: 0, pending: 0 }
    const fromDate = dateFrom ? new Date(dateFrom) : null
    const toDate   = dateTo   ? new Date(dateTo)   : null

    try {
      for await (const message of client.fetch(fetchRange, { source: true, uid: true })) {
        try {
          const parsed      = await simpleParser(message.source)
          const receivedAt  = parsed.date || new Date()

          // Filtrare după dată
          if (mode === 'new' && lastFetchDate && receivedAt <= lastFetchDate) continue
          if (mode === 'interval') {
            if (fromDate && receivedAt < fromDate) continue
            if (toDate   && receivedAt > toDate)   continue
          }

          const messageId   = parsed.messageId || `yahoo-uid-${message.uid}`
          const fromAddress = (parsed.from?.value?.[0]?.address || 'unknown').toLowerCase()
          const fromName    = parsed.from?.value?.[0]?.name || null
          const toAddress   = parsed.to?.value?.[0]?.address || YAHOO_USER
          const subject     = parsed.subject || '(fără subiect)'
          const bodyText    = parsed.text || null
          const bodyHtml    = (parsed as any).html || null

          // Deduplicare
          const { data: existing } = await supabase
            .from('emails').select('id').eq('message_id', messageId).maybeSingle()
          if (existing) { stats.skipped++; continue }

          // Blacklist → skip
          if (blacklist.has(fromAddress)) { stats.blacklisted++; continue }

          const isWhitelisted = whitelist.has(fromAddress)
          const attachments   = parseAttachments(parsed, fromAddress, subject)

          const { error } = await supabase.from('emails').insert({
            message_id:    messageId,
            from_address:  fromAddress,
            from_name:     fromName,
            to_address:    toAddress,
            subject:       subject,
            body_text:     bodyText,
            body_html:     bodyHtml,
            received_at:   receivedAt.toISOString(),
            mail_provider: 'yahoo',
            imap_uid:      message.uid,
            attachments:   attachments,
            status:        isWhitelisted ? 'whitelist' : 'pending',
            is_processed:  false,
            is_pinned:     false,
            is_replied:    false,
            batch_number:  batchNumber,
          })

          if (error) { stats.errors++; continue }
          stats.imported++
          if (isWhitelisted) stats.whitelist++; else stats.pending++

        } catch { stats.errors++ }
      }
    } finally {
      lock.release()
    }

    await client.logout()

    return NextResponse.json({
      success: true,
      batchNumber,
      stats,
      lastFetchDate: lastFetchDate?.toISOString() || null,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
