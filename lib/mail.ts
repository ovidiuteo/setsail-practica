// ============================================================================
// Transactional email via Google Workspace SMTP (office@setsail.ro).
// Best-effort: never throws to the caller; silently skips if not configured.
// Env (set in Vercel): SMTP_USER, SMTP_PASS (app password). Optional:
// SMTP_HOST (smtp.gmail.com), SMTP_PORT (465), LEADS_NOTIFY_TO, SMTP_FROM.
// ============================================================================
import 'server-only'
import nodemailer from 'nodemailer'

const HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const PORT = Number(process.env.SMTP_PORT || 465)
const USER = process.env.SMTP_USER
const PASS = process.env.SMTP_PASS
const TO = process.env.LEADS_NOTIFY_TO || USER || 'office@setsail.ro'
const FROM = process.env.SMTP_FROM || USER

export function mailConfigured(): boolean {
  return Boolean(USER && PASS)
}

async function sendMail(subject: string, html: string) {
  if (!mailConfigured()) return
  const transporter = nodemailer.createTransport({
    host: HOST,
    port: PORT,
    secure: PORT === 465,
    auth: { user: USER!, pass: PASS! },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 8000,
  })
  await transporter.sendMail({
    from: FROM,
    to: TO,
    subject,
    html,
    text: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  })
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
