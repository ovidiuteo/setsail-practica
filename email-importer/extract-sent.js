/**
 * SetSail — Extract emails from Yahoo Sent folder
 * Versiune cu salvare progres — continuă de unde a rămas dacă se întrerupe
 * 
 * Rulare: node extract-sent.js
 */

import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import 'dotenv/config';

const YAHOO_USER     = process.env.YAHOO_USER     || 'ovidiuteo@yahoo.com';
const YAHOO_PASSWORD = process.env.YAHOO_APP_PASSWORD || 'uovhdjrnzlvvotvd';
const OUTPUT_FILE    = 'whitelist-sent.csv';
const PROGRESS_FILE  = 'extract-progress.json';
const BATCH_SIZE     = 200; // mesaje per conexiune

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function extractAddresses(parsed) {
  const addresses = new Set();
  for (const field of ['to', 'cc', 'bcc']) {
    const val = parsed[field];
    if (!val) continue;
    for (const group of (Array.isArray(val) ? val : [val])) {
      for (const addr of (group.value || [])) {
        if (addr.address?.includes('@')) {
          addresses.add(addr.address.trim().toLowerCase());
        }
      }
    }
  }
  return addresses;
}

function saveProgress(processed, addresses) {
  const data = {
    processed,
    addresses: Object.fromEntries(addresses),
    savedAt: new Date().toISOString(),
  };
  writeFileSync(PROGRESS_FILE, JSON.stringify(data), 'utf-8');
}

function loadProgress() {
  if (!existsSync(PROGRESS_FILE)) return { processed: 0, addresses: new Map() };
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8'));
    return {
      processed: data.processed || 0,
      addresses: new Map(Object.entries(data.addresses || {})),
    };
  } catch { return { processed: 0, addresses: new Map() }; }
}

function exportCSV(addresses, ownEmail) {
  const sorted = [...addresses.entries()]
    .filter(([email]) => email !== ownEmail.toLowerCase())
    .sort((a, b) => b[1].count - a[1].count);

  const lines = [
    'email_address,rule_type,notes,aparitii,ultima_data',
    ...sorted.map(([email, { count, lastSeen }]) =>
      `"${email}","whitelist","Din Sent Yahoo","${count}","${new Date(lastSeen).toLocaleDateString('ro-RO')}"`
    )
  ];

  writeFileSync(OUTPUT_FILE, lines.join('\n'), 'utf-8');
  return sorted.length;
}

async function connectImap() {
  const client = new ImapFlow({
    host: 'imap.mail.yahoo.com',
    port: 993,
    secure: true,
    auth: { user: YAHOO_USER, pass: YAHOO_PASSWORD },
    logger: false,
    connectionTimeout: 60000,
    socketTimeout: 60000,
  });
  await client.connect();
  return client;
}

async function extractSentEmails() {
  console.log('\n🚀 SetSail — Extragere adrese din Sent\n');

  // Încarcă progresul salvat
  let { processed, addresses } = loadProgress();
  if (processed > 0) {
    console.log(`📂 Progres anterior găsit: ${processed} mesaje procesate, ${addresses.size} adrese\n`);
  }

  // Prima conexiune — află totalul
  let client = await connectImap();
  console.log('✅ Conectat la Yahoo IMAP');

  const lock = await client.getMailboxLock('Sent');
  const total = client.mailbox.exists;
  lock.release();

  console.log(`📧 Total mesaje în Sent: ${total}`);
  console.log(`⏭️  Continuă de la mesajul: ${processed + 1}\n`);
  await client.logout();

  if (processed >= total) {
    console.log('✅ Toate mesajele au fost deja procesate!');
    const count = exportCSV(addresses, YAHOO_USER);
    console.log(`📊 ${count} adrese exportate în ${OUTPUT_FILE}`);
    return;
  }

  // Procesează în batch-uri mici cu reconectare
  let errors = 0;

  while (processed < total) {
    const start = processed + 1;
    const end   = Math.min(processed + BATCH_SIZE, total);

    process.stdout.write(`\r   Procesate: ${processed}/${total} — ${addresses.size} adrese unice`);

    let success = false;
    let retries = 3;

    while (!success && retries > 0) {
      try {
        client = await connectImap();
        const lock = await client.getMailboxLock('Sent');

        for await (const message of client.fetch(`${start}:${end}`, { source: true })) {
          try {
            const parsed = await simpleParser(message.source);
            const found  = extractAddresses(parsed);
            const date   = parsed.date || new Date();

            for (const email of found) {
              if (!isValidEmail(email)) continue;
              if (addresses.has(email)) {
                const e = addresses.get(email);
                e.count++;
                if (date > new Date(e.lastSeen)) e.lastSeen = date.toISOString();
              } else {
                addresses.set(email, { count: 1, lastSeen: date.toISOString() });
              }
            }
          } catch { errors++; }
        }

        lock.release();
        await client.logout();
        success = true;

      } catch (err) {
        retries--;
        try { await client.logout(); } catch (_) {}
        if (retries > 0) {
          await new Promise(r => setTimeout(r, 3000));
        }
      }
    }

    processed = end;

    // Salvează progresul la fiecare batch
    saveProgress(processed, addresses);
  }

  process.stdout.write('\n');

  // Export final CSV
  const count = exportCSV(addresses, YAHOO_USER);

  console.log(`\n✅ Gata!`);
  console.log(`   Mesaje procesate : ${processed}`);
  console.log(`   Adrese unice     : ${count}`);
  console.log(`   Erori            : ${errors}`);
  console.log(`   Fișier           : ${OUTPUT_FILE}`);
  console.log(`\n💡 Top 10 cele mai contactate:`);
  [...addresses.entries()]
    .filter(([e]) => e !== YAHOO_USER.toLowerCase())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .forEach(([email, { count }], i) => console.log(`   ${i+1}. ${email} (${count}x)`));

  console.log(`\n📥 Importă ${OUTPUT_FILE} în SetSail → Reguli → Import → Whitelist\n`);
}

extractSentEmails().catch(err => {
  console.error('\n❌ Eroare fatală:', err.message);
  console.log('💾 Progresul a fost salvat. Rulează din nou pentru a continua.');
  process.exit(1);
});
