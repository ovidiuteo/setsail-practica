/**
 * SetSail — Extract emails from Yahoo Sent folder
 * 
 * Extrage adresele din To / CC / BCC din folderul Sent
 * și exportă un CSV gata de importat în whitelist.
 * 
 * Instalare: npm install imapflow mailparser dotenv
 * Rulare:    node extract-sent.js
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { writeFileSync } from 'fs';
import 'dotenv/config';

// ─── Config ────────────────────────────────────────────────────────────────

const YAHOO_USER     = process.env.YAHOO_USER     || 'ovidiuteo@yahoo.com';
const YAHOO_PASSWORD = process.env.YAHOO_APP_PASSWORD || 'uovhdjrnzlvvotvd';

// Yahoo Sent folder — încearcă în ordine până găsește unul valid
const SENT_FOLDERS = ['Sent', 'Sent Messages', 'Sent Items', '&BB8EQgQ,BEAEMAQyBDsENQQ9BD0ESwQ1-'];

const OUTPUT_FILE  = 'whitelist-sent.csv';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractAddresses(parsed) {
  const addresses = new Set();

  const fields = ['to', 'cc', 'bcc'];
  for (const field of fields) {
    const val = parsed[field];
    if (!val) continue;
    const list = Array.isArray(val) ? val : [val];
    for (const group of list) {
      for (const addr of (group.value || [])) {
        if (addr.address && addr.address.includes('@')) {
          addresses.add(addr.address.trim().toLowerCase());
        }
      }
    }
  }

  return addresses;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function extractSentEmails() {
  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: { user: YAHOO_USER, pass: YAHOO_PASSWORD },
    logger: false,
  });

  console.log('\n🚀 SetSail — Extragere adrese din Sent\n');

  await client.connect();
  console.log('✅ Conectat la Yahoo IMAP\n');

  // ── Găsește folderul Sent ─────────────────────────────────────────────────

  let sentFolder = null;
  const folderList = await client.list();
  const folders = folderList.map(f => f.path);

  console.log('📁 Foldere disponibile:');
  folders.forEach(f => console.log(`   ${f}`));
  console.log('');

  for (const candidate of SENT_FOLDERS) {
    if (folders.some(f => f.toLowerCase() === candidate.toLowerCase())) {
      sentFolder = folders.find(f => f.toLowerCase() === candidate.toLowerCase());
      break;
    }
  }

  // Fallback: caută orice folder care conține "sent"
  if (!sentFolder) {
    sentFolder = folders.find(f => f.toLowerCase().includes('sent'));
  }

  if (!sentFolder) {
    console.error('❌ Nu am găsit folderul Sent. Foldere disponibile:', folders);
    await client.logout();
    return;
  }

  console.log(`📬 Folosesc folderul: "${sentFolder}"\n`);

  // ── Fetch mesaje ──────────────────────────────────────────────────────────

  const lock = await client.getMailboxLock(sentFolder);
  const allAddresses = new Map(); // email -> { count, lastSeen }

  try {
    const total = client.mailbox.exists;
    console.log(`📧 Total mesaje în Sent: ${total}`);
    console.log('⏳ Extrag adresele (durează câteva minute pentru inbox mare)...\n');

    let processed = 0;
    let errors    = 0;

    for await (const message of client.fetch('1:*', { source: true })) {
      try {
        const parsed = await simpleParser(message.source);
        const found  = extractAddresses(parsed);
        const date   = parsed.date || new Date();

        for (const email of found) {
          if (!isValidEmail(email)) continue;
          if (allAddresses.has(email)) {
            const entry = allAddresses.get(email);
            entry.count++;
            if (date > entry.lastSeen) entry.lastSeen = date;
          } else {
            allAddresses.set(email, { count: 1, lastSeen: date });
          }
        }

        processed++;
        if (processed % 100 === 0) {
          process.stdout.write(`\r   Procesate: ${processed}/${total} — ${allAddresses.size} adrese unice găsite`);
        }

      } catch (err) {
        errors++;
      }
    }

    process.stdout.write('\n');
    console.log(`\n✅ Procesare completă: ${processed} mesaje, ${errors} erori\n`);

  } finally {
    lock.release();
  }

  await client.logout();
  console.log('👋 Deconectat\n');

  // ── Export CSV ────────────────────────────────────────────────────────────

  if (allAddresses.size === 0) {
    console.log('⚠️  Nu s-au găsit adrese de email.');
    return;
  }

  // Sortează după numărul de apariții (cele mai frecvente primele)
  const sorted = [...allAddresses.entries()]
    .sort((a, b) => b[1].count - a[1].count);

  // Exclude propriul cont
  const filtered = sorted.filter(([email]) => email !== YAHOO_USER.toLowerCase());

  const csvLines = [
    'email_address,rule_type,notes,aparitii,ultima_data',
    ...filtered.map(([email, { count, lastSeen }]) =>
      `"${email}","whitelist","Din Sent Yahoo","${count}","${lastSeen.toLocaleDateString('ro-RO')}"`
    )
  ];

  writeFileSync(OUTPUT_FILE, csvLines.join('\n'), 'utf-8');

  console.log(`📊 Rezultate:`);
  console.log(`   Total adrese unice : ${filtered.length}`);
  console.log(`   Fișier exportat    : ${OUTPUT_FILE}`);
  console.log(`\n💡 Top 10 cele mai contactate:`);
  filtered.slice(0, 10).forEach(([email, { count }], i) => {
    console.log(`   ${i + 1}. ${email} (${count}x)`);
  });
  console.log(`\n✅ Gata! Importă ${OUTPUT_FILE} în pagina Reguli → Import → Whitelist\n`);
}

extractSentEmails().catch(err => {
  console.error('❌ Eroare fatală:', err.message);
  process.exit(1);
});