/**
 * SetSail — IMAP Email Fetcher + Claude AI Analyzer
 * 
 * Logica de filtrare:
 *  - Whitelist → import + analiză Claude completă
 *  - Blacklist → skip total, nu se stochează
 *  - Necunoscut → salvat ca 'pending' fără analiză Claude
 * 
 * Instalare: npm install imapflow mailparser @supabase/supabase-js dotenv
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import 'dotenv/config';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

const IMAP_CONFIGS = {
  gmail: {
    host: 'imap.gmail.com', port: 993, secure: true,
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD },
  },
  yahoo: {
    host: 'imap.mail.yahoo.com', port: 993, secure: true,
    auth: { user: process.env.YAHOO_USER, pass: process.env.YAHOO_APP_PASSWORD },
  },
};

const PROVIDER    = process.env.MAIL_PROVIDER || 'gmail';
const FETCH_LIMIT = parseInt(process.env.FETCH_LIMIT || '20');
const MAILBOX     = process.env.MAILBOX || 'INBOX';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { realtime: { transport: ws } });

async function loadRules() {
  const whitelist = new Set();
  const blacklist = new Set();
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('email_rules')
      .select('email_address, rule_type')
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('❌ Nu pot încărca regulile:', error.message);
      break;
    }
    for (const rule of data || []) {
      if (rule.rule_type === 'whitelist') whitelist.add(rule.email_address.toLowerCase());
      if (rule.rule_type === 'blacklist') blacklist.add(rule.email_address.toLowerCase());
    }
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`📋 Reguli încărcate: ${whitelist.size} whitelist, ${blacklist.size} blacklist\n`);
  return { whitelist, blacklist };
}

async function analyzeWithClaude({ from, subject, bodyText }) {
  const prompt = `Ești asistentul platformei SetSail — o platformă de navigație sportivă care gestionează studenți, instructori și sesiuni de antrenament.

Analizează acest email și răspunde DOAR cu un obiect JSON valid, fără text suplimentar, fără markdown.

EMAIL:
De la: ${from}
Subiect: ${subject}
Conținut:
${bodyText?.slice(0, 2000) || '(fără conținut text)'}

Returnează exact acest JSON:
{
  "category": "access_request|support|authentication|notification|spam|other",
  "ai_summary": "rezumat scurt în 1-2 propoziții",
  "ai_sentiment": "positive|neutral|negative",
  "ai_priority": "high|medium|low",
  "reply_suggestion_1": "Răspuns în stilul SetSail — profesional dar specific platformei. Începe direct cu salutul.",
  "reply_suggestion_2": "Răspuns formal — ton oficial, distant, structurat. Începe cu Stimate/Stimată...",
  "reply_suggestion_3": "Răspuns friendly — ton cald, direct, prietenos."
}

Răspunsurile să fie în aceeași limbă cu emailul și complete, gata de trimis.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const data = await response.json();
    const text = data.content?.[0]?.text || '{}';
    return JSON.parse(text.replace(/```json|```/g, '').trim());
  } catch (err) {
    console.error(`  ⚠️  Claude API error: ${err.message}`);
    return null;
  }
}

function parseAttachments(parsed, from, subject) {
  if (!parsed.attachments?.length) return [];
  return parsed.attachments.map(att => ({
    filename:     att.filename || 'unknown',
    mime_type:    att.contentType || 'application/octet-stream',
    size_bytes:   att.size || 0,
    search_query: `from:${from} subject:"${subject}" has:attachment${att.filename ? ` filename:${att.filename}` : ''}`,
  }));
}

async function fetchAndImportEmails() {
  const imapConfig = IMAP_CONFIGS[PROVIDER];
  if (!imapConfig?.auth?.user || !imapConfig?.auth?.pass) {
    console.error(`❌ Credențialele IMAP pentru ${PROVIDER} lipsesc din .env`);
    process.exit(1);
  }

  console.log(`\n🚀 SetSail Email Importer`);
  console.log(`   Provider : ${PROVIDER}`);
  console.log(`   Mailbox  : ${MAILBOX}`);
  console.log(`   Limit    : ${FETCH_LIMIT} mailuri\n`);

  const { whitelist, blacklist } = await loadRules();
  const client = new ImapFlow({ ...imapConfig, logger: false });

  try {
    await client.connect();
    console.log(`✅ Conectat la ${PROVIDER} IMAP\n`);
    const lock = await client.getMailboxLock(MAILBOX);

    try {
      const total    = client.mailbox.exists;
      const startSeq = Math.max(1, total - FETCH_LIMIT + 1);
      console.log(`📬 Total mailuri în ${MAILBOX}: ${total}`);
      console.log(`📥 Procesez ultimele ${FETCH_LIMIT} (seq ${startSeq}–${total})...\n`);

      let stats = { analyzed: 0, pending: 0, blacklisted: 0, skipped: 0, errors: 0 };

      for await (const message of client.fetch(`${startSeq}:*`, { source: true, uid: true })) {
        try {
          const parsed      = await simpleParser(message.source);
          const messageId   = parsed.messageId || `${PROVIDER}-uid-${message.uid}`;
          const fromAddress = (parsed.from?.value?.[0]?.address || 'unknown').toLowerCase();
          const fromName    = parsed.from?.value?.[0]?.name || null;
          const toAddress   = parsed.to?.value?.[0]?.address || imapConfig.auth.user;
          const subject     = parsed.subject || '(fără subiect)';
          const bodyText    = parsed.text || null;
          const bodyHtml    = parsed.html || null;
          const receivedAt  = parsed.date?.toISOString() || new Date().toISOString();

          // Deduplicare
          const { data: existing } = await supabase
            .from('emails').select('id').eq('message_id', messageId).maybeSingle();
          if (existing) { process.stdout.write('·'); stats.skipped++; continue; }

          // BLACKLIST → skip total
          if (blacklist.has(fromAddress)) {
            process.stdout.write('✗'); stats.blacklisted++; continue;
          }

          const isWhitelisted = whitelist.has(fromAddress);
          process.stdout.write('\n');

          if (isWhitelisted) {
            console.log(`📧 [WHITELIST] ${fromAddress} — ${subject}`);
            console.log(`   🤖 Analizez cu Claude...`);
          } else {
            console.log(`📧 [PENDING]   ${fromAddress} — ${subject}`);
          }

          let ai = null;
          if (isWhitelisted) {
            ai = await analyzeWithClaude({ from: fromAddress, subject, bodyText });
          }

          const attachments = parseAttachments(parsed, fromAddress, subject);

          const { error } = await supabase.from('emails').insert({
            message_id:         messageId,
            from_address:       fromAddress,
            from_name:          fromName,
            to_address:         toAddress,
            subject:            subject,
            body_text:          bodyText,
            body_html:          bodyHtml,
            received_at:        receivedAt,
            mail_provider:      PROVIDER,
            imap_uid:           message.uid,
            attachments:        attachments,
            status:             isWhitelisted ? 'analyzed' : 'pending',
            is_processed:       isWhitelisted,
            category:           ai?.category           || null,
            ai_summary:         ai?.ai_summary         || null,
            ai_sentiment:       ai?.ai_sentiment       || null,
            ai_priority:        ai?.ai_priority        || null,
            reply_suggestion_1: ai?.reply_suggestion_1 || null,
            reply_suggestion_2: ai?.reply_suggestion_2 || null,
            reply_suggestion_3: ai?.reply_suggestion_3 || null,
          });

          if (error) {
            console.error(`   ❌ Supabase error: ${error.message}`);
            stats.errors++;
          } else if (isWhitelisted) {
            console.log(`   ✅ Analizat | ${ai?.category} | ${ai?.ai_priority} priority`);
            stats.analyzed++;
          } else {
            console.log(`   ⏳ Salvat ca pending`);
            stats.pending++;
          }

        } catch (msgErr) {
          console.error(`   ⚠️  Eroare mesaj: ${msgErr.message}`);
          stats.errors++;
        }
      }

      console.log(`\n${'─'.repeat(50)}`);
      console.log(`✅ Import complet`);
      console.log(`   ✅ Analizate  : ${stats.analyzed}`);
      console.log(`   ⏳ Pending    : ${stats.pending}`);
      console.log(`   ✗  Blacklist  : ${stats.blacklisted} (ignorate)`);
      console.log(`   ·  Existente  : ${stats.skipped}`);
      console.log(`   ❌ Erori      : ${stats.errors}`);
      console.log(`${'─'.repeat(50)}\n`);

    } finally { lock.release(); }
  } finally {
    await client.logout();
    console.log('👋 Deconectat\n');
  }
}

fetchAndImportEmails().catch(err => {
  console.error('❌ Eroare fatală:', err.message);
  process.exit(1);
});
