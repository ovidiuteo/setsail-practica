/**
 * SetSail — IMAP Email Fetcher + Claude AI Analyzer
 * 
 * Ce face:
 *  1. Se conectează la Gmail/Yahoo via IMAP
 *  2. Descarcă mailurile noi (ultimele N sau de la o dată)
 *  3. Le trimite la Claude API pentru analiză + 3 propuneri de răspuns
 *  4. Salvează totul în Supabase (tabelul emails)
 * 
 * Instalare dependențe:
 *   npm install imapflow mailparser @supabase/supabase-js dotenv
 * 
 * Configurare .env (vezi .env.example)
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

// ─── Config ────────────────────────────────────────────────────────────────

const SUPABASE_URL  = process.env.SUPABASE_URL  || 'https://tzrwwnenkgzwgocmlaon.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY; // service_role key (din Supabase → Settings → API)
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;

// Configurări IMAP — setează în .env
const IMAP_CONFIGS = {
  gmail: {
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD, // App Password, nu parola contului
    },
  },
  yahoo: {
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: {
      user: process.env.YAHOO_USER,
      pass: process.env.YAHOO_APP_PASSWORD,
    },
  },
};

const PROVIDER = process.env.MAIL_PROVIDER || 'gmail'; // 'gmail' sau 'yahoo'
const FETCH_LIMIT = parseInt(process.env.FETCH_LIMIT || '20'); // câte mailuri la o rulare
const MAILBOX = process.env.MAILBOX || 'INBOX';

// ─── Supabase ───────────────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── Claude API ─────────────────────────────────────────────────────────────

async function analyzeWithClaude(emailData) {
  const { from, subject, bodyText, provider } = emailData;

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
  "reply_suggestion_1": "Răspuns în stilul SetSail — profesional dar specific platformei, menționează sesiuni/navigație dacă e relevant. Începe direct cu salutul.",
  "reply_suggestion_2": "Răspuns formal — ton oficial, distant, structurat. Începe cu 'Stimate/Stimată...'",
  "reply_suggestion_3": "Răspuns friendly — ton cald, direct, prietenos. Folosește prenumele dacă îl știi."
}

Reguli:
- category: alege cea mai potrivită
- ai_priority: 'high' dacă e urgentă/problemă tehnică, 'medium' dacă e întrebare normală, 'low' dacă e informativ/spam
- Răspunsurile să fie în aceeași limbă cu emailul primit
- Răspunsurile să fie complete, gata de trimis (nu scheletale)`;

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

    // Curăță eventualele backtick-uri de markdown
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);

  } catch (err) {
    console.error(`  ⚠️  Claude API error: ${err.message}`);
    return {
      category: 'other',
      ai_summary: 'Analiză indisponibilă',
      ai_sentiment: 'neutral',
      ai_priority: 'medium',
      reply_suggestion_1: null,
      reply_suggestion_2: null,
      reply_suggestion_3: null,
    };
  }
}

// ─── Construiește search_query pentru Gmail/Yahoo ────────────────────────────

function buildAttachmentSearchQuery({ from, subject, provider, filename }) {
  const base = provider === 'gmail'
    ? `from:${from} subject:"${subject}" has:attachment`
    : `from:${from} subject:"${subject}" has:attachment`;

  return filename ? `${base} filename:${filename}` : base;
}

// ─── Parser atașamente ───────────────────────────────────────────────────────

function parseAttachments(parsed, from, subject, provider) {
  if (!parsed.attachments || parsed.attachments.length === 0) return [];

  return parsed.attachments.map(att => ({
    filename:     att.filename || 'unknown',
    mime_type:    att.contentType || 'application/octet-stream',
    size_bytes:   att.size || 0,
    search_query: buildAttachmentSearchQuery({
      from,
      subject: subject || '',
      provider,
      filename: att.filename,
    }),
  }));
}

// ─── Main fetch ──────────────────────────────────────────────────────────────

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

  const client = new ImapFlow({ ...imapConfig, logger: false });

  try {
    await client.connect();
    console.log(`✅ Conectat la ${PROVIDER} IMAP\n`);

    const lock = await client.getMailboxLock(MAILBOX);

    try {
      // Ia ultimele N mailuri
      const total = client.mailbox.exists;
      const startSeq = Math.max(1, total - FETCH_LIMIT + 1);
      const range = `${startSeq}:*`;

      console.log(`📬 Total mailuri în ${MAILBOX}: ${total}`);
      console.log(`📥 Procesez ultimele ${FETCH_LIMIT} (seq ${startSeq}–${total})...\n`);

      let imported = 0;
      let skipped  = 0;
      let errors   = 0;

      for await (const message of client.fetch(range, {
        source: true,
        uid: true,
        flags: true,
      })) {
        try {
          const parsed = await simpleParser(message.source);

          const messageId   = parsed.messageId || `${PROVIDER}-uid-${message.uid}`;
          const fromAddress = parsed.from?.value?.[0]?.address || 'unknown';
          const fromName    = parsed.from?.value?.[0]?.name || null;
          const toAddress   = parsed.to?.value?.[0]?.address || imapConfig.auth.user;
          const subject     = parsed.subject || '(fără subiect)';
          const bodyText    = parsed.text || null;
          const bodyHtml    = parsed.html || null;
          const receivedAt  = parsed.date?.toISOString() || new Date().toISOString();

          // Verifică dacă mailul există deja (deduplicare prin message_id)
          const { data: existing } = await supabase
            .from('emails')
            .select('id')
            .eq('message_id', messageId)
            .maybeSingle();

          if (existing) {
            process.stdout.write('·'); // deja importat
            skipped++;
            continue;
          }

          process.stdout.write('\n');
          console.log(`📧 [${fromAddress}] ${subject}`);
          console.log(`   🤖 Analizez cu Claude...`);

          // Analiză Claude
          const ai = await analyzeWithClaude({ from: fromAddress, subject, bodyText, provider: PROVIDER });

          // Atașamente (doar metadate)
          const attachments = parseAttachments(parsed, fromAddress, subject, PROVIDER);

          // Insert în Supabase
          const { error } = await supabase.from('emails').insert({
            message_id:          messageId,
            from_address:        fromAddress,
            from_name:           fromName,
            to_address:          toAddress,
            subject:             subject,
            body_text:           bodyText,
            body_html:           bodyHtml,
            received_at:         receivedAt,
            category:            ai.category,
            ai_summary:          ai.ai_summary,
            ai_sentiment:        ai.ai_sentiment,
            ai_priority:         ai.ai_priority,
            reply_suggestion_1:  ai.reply_suggestion_1,
            reply_suggestion_2:  ai.reply_suggestion_2,
            reply_suggestion_3:  ai.reply_suggestion_3,
            mail_provider:       PROVIDER,
            imap_uid:            message.uid,
            attachments:         attachments,
            is_processed:        true,
          });

          if (error) {
            console.error(`   ❌ Supabase error: ${error.message}`);
            errors++;
          } else {
            console.log(`   ✅ Salvat | ${ai.category} | ${ai.ai_priority} priority | ${attachments.length} atașamente`);
            imported++;
          }

        } catch (msgErr) {
          console.error(`   ⚠️  Eroare la procesare mesaj: ${msgErr.message}`);
          errors++;
        }
      }

      console.log(`\n${'─'.repeat(50)}`);
      console.log(`✅ Import complet`);
      console.log(`   Importate : ${imported}`);
      console.log(`   Existente : ${skipped}`);
      console.log(`   Erori     : ${errors}`);
      console.log(`${'─'.repeat(50)}\n`);

    } finally {
      lock.release();
    }

  } finally {
    await client.logout();
    console.log('👋 Deconectat de la IMAP\n');
  }
}

// ─── Run ─────────────────────────────────────────────────────────────────────

fetchAndImportEmails().catch(err => {
  console.error('❌ Eroare fatală:', err.message);
  process.exit(1);
});
