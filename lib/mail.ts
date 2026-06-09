// ============================================================================
// Transactional email via Resend (no Google account / no 2FA needed).
// Best-effort: never throws to the caller; silently skips if not configured.
// Env (set in Vercel): RESEND_API_KEY. Optional: LEADS_NOTIFY_TO, RESEND_FROM.
// Resend free tier (no verified domain) sends only to your Resend account
// email — create the Resend account with office@setsail.ro.
// ============================================================================
import 'server-only'

const KEY = process.env.RESEND_API_KEY
const TO = process.env.LEADS_NOTIFY_TO || 'office@setsail.ro'
const FROM = process.env.RESEND_FROM || 'SetSail Lead-uri <onboarding@resend.dev>'

export function mailConfigured(): boolean {
  return Boolean(KEY)
}

type SendResult = { ok: boolean; skipped?: boolean; error?: string; id?: string; to?: string }

async function sendMail(subject: string, html: string, toOverride?: string): Promise<SendResult> {
  if (!mailConfigured()) return { ok: false, skipped: true, error: 'RESEND_API_KEY lipsește (nu e setat în Vercel).' }
  const to = toOverride || TO
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
    })
    const j: any = await res.json().catch(() => ({}))
    if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${j?.message || JSON.stringify(j).slice(0, 200)}`, to }
    return { ok: true, id: j?.id, to }
  } catch (e: any) {
    return { ok: false, error: e?.message || 'fetch failed', to }
  }
}

export function mailEnvDebug() {
  return {
    hasKey: Boolean(process.env.RESEND_API_KEY),
    notifyTo: process.env.LEADS_NOTIFY_TO || '(unset → default office@setsail.ro)',
    from: process.env.RESEND_FROM || '(default onboarding@resend.dev)',
  }
}

type Lead = { name?: string; email?: string; phone?: string; message?: string; leadType?: string; voucher?: string }

function leadHtml(kind: string, lead: Lead) {
  const esc = (s?: string) => (s || '').replace(/[<>&]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as Record<string, string>)[c]))
  const row = (k: string, v?: string) =>
    v ? `<tr><td style="padding:4px 14px 4px 0;color:#64748b;vertical-align:top">${k}</td><td style="padding:4px 0;font-weight:600;color:#0a2a4e">${esc(v)}</td></tr>` : ''
  return `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:540px">
      <h2 style="color:#0a2a4e;margin:0 0 4px">Lead nou — ${kind}</h2>
      <p style="color:#64748b;margin:0 0 14px;font-size:13px">${new Date().toLocaleString('ro-RO')}</p>
      <table style="border-collapse:collapse;font-size:14px">
        ${row('Nume', lead.name)}
        ${row('Telefon', lead.phone)}
        ${row('Email', lead.email)}
        ${row('Tip', lead.leadType)}
        ${row('Voucher', lead.voucher)}
        ${row('Mesaj', lead.message)}
      </table>
    </div>`
}

// Returns the send result — used by the diagnostic test endpoint.
export async function sendLeadEmail(kind: 'CDS' | 'Radio GMDSS', lead: Lead, toOverride?: string): Promise<SendResult> {
  const who = lead.name || lead.phone || lead.email || 'fără nume'
  return sendMail(`Lead nou ${kind}: ${who}`, leadHtml(kind, lead), toOverride)
}

// Fire-and-forget from lead routes — never blocks/fails lead capture.
export async function notifyNewLead(kind: 'CDS' | 'Radio GMDSS', lead: Lead) {
  try { await sendLeadEmail(kind, lead) } catch { /* best-effort */ }
}
