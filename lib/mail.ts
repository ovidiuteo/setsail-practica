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

async function sendMail(subject: string, html: string) {
  if (!mailConfigured()) return
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => '')
    throw new Error(`Resend ${res.status}: ${t.slice(0, 200)}`)
  }
}

type Lead = { name?: string; email?: string; phone?: string; message?: string; leadType?: string; voucher?: string }

export async function notifyNewLead(kind: 'CDS' | 'Radio GMDSS', lead: Lead) {
  const esc = (s?: string) => (s || '').replace(/[<>&]/g, (c) => (({ '<': '&lt;', '>': '&gt;', '&': '&amp;' } as Record<string, string>)[c]))
  const row = (k: string, v?: string) =>
    v ? `<tr><td style="padding:4px 14px 4px 0;color:#64748b;vertical-align:top">${k}</td><td style="padding:4px 0;font-weight:600;color:#0a2a4e">${esc(v)}</td></tr>` : ''
  const html = `
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
  const who = lead.name || lead.phone || lead.email || 'fără nume'
  try {
    await sendMail(`Lead nou ${kind}: ${who}`, html)
  } catch {
    /* best-effort — never block lead capture on email */
  }
}
