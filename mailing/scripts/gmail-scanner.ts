/**
 * gmail-scanner — scanează Sent folder, clusterizează mailurile cu Claude,
 * propune templates noi în mailing_templates (is_proposed=true).
 *
 * Rulare: npm run scan -- --months=3 --max=200 --dry-run
 *   --months   câte luni înapoi să citească (default 3)
 *   --max      câte mesaje maxim să proceseze (default 200)
 *   --dry-run  nu insera nimic în DB; doar log + scrie raport markdown
 */

import dotenv from "dotenv";
dotenv.config({ override: true });
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";

// ─── Config ──────────────────────────────────────────────────────────────────

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? "true"];
  }),
);

const MONTHS_BACK = parseInt(args.months || "3", 10);
const MAX_MESSAGES = parseInt(args.max || "200", 10);
const DRY_RUN = args["dry-run"] === "true";
const BATCH_SIZE_INTENT = 25;
const MIN_CLUSTER_SIZE = 3;
const MODEL = "claude-sonnet-4-6";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
  ANTHROPIC_API_KEY,
} = process.env;

if (!GOOGLE_REFRESH_TOKEN || !SUPABASE_SERVICE_KEY || !ANTHROPIC_API_KEY) {
  console.error(
    "Lipsesc env vars: GOOGLE_REFRESH_TOKEN, SUPABASE_SERVICE_KEY și/sau ANTHROPIC_API_KEY",
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });
const gmail = google.gmail({ version: "v1", auth: oauth2 });

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
  auth: { persistSession: false },
});

const claude = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// ─── Tipuri ──────────────────────────────────────────────────────────────────

type SentMessage = {
  id: string;
  threadId: string;
  subject: string;
  to: string;
  date: string;
  bodyText: string;
};

type IntentLabel = {
  index: number;
  intent: string;
  category: "scoala" | "expeditii" | "sales" | "admin" | "altele";
};

type Template = {
  key: string;
  label: string;
  category: IntentLabel["category"];
  subject: string;
  body_text: string;
  variables: string[];
};

// ─── Fetch + curățare ────────────────────────────────────────────────────────

function decodeBody(part: any): string {
  if (!part) return "";
  if (part.body?.data) {
    return Buffer.from(part.body.data, "base64url").toString("utf8");
  }
  if (part.parts) {
    const textPart = part.parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf8");
    }
    const htmlPart = part.parts.find((p: any) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = Buffer.from(htmlPart.body.data, "base64url").toString("utf8");
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    }
    for (const p of part.parts) {
      const r = decodeBody(p);
      if (r) return r;
    }
  }
  return "";
}

function cleanBody(raw: string): string {
  let body = raw;
  // taie quoted reply: "On ... wrote:" și tot ce urmează
  body = body.replace(/\n+On .+ wrote:[\s\S]*$/i, "");
  body = body.replace(/\n+Pe .+ a scris:[\s\S]*$/i, "");
  body = body.replace(/\n+În data de .+ a scris:[\s\S]*$/i, "");
  body = body.replace(/\n+-+\s*Original Message\s*-+[\s\S]*$/i, "");
  // taie linii cu > la început (quoted)
  body = body.split("\n").filter((l) => !l.startsWith(">")).join("\n");
  // colaps whitespace
  body = body.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return body;
}

function shouldKeep(m: SentMessage): boolean {
  if (m.bodyText.length < 100) return false;
  if (m.bodyText.length > 5000) return false;
  if (/^(re:\s*){3,}/i.test(m.subject)) return false;
  return true;
}

async function fetchSent(): Promise<SentMessage[]> {
  console.log(`📥 Listez Sent (ultimele ${MONTHS_BACK} luni, max ${MAX_MESSAGES})...`);
  const messages: SentMessage[] = [];
  let pageToken: string | undefined;
  let listed = 0;

  while (listed < MAX_MESSAGES) {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: `in:sent newer_than:${MONTHS_BACK}m`,
      maxResults: Math.min(100, MAX_MESSAGES - listed),
      pageToken,
    });
    const ids = (res.data.messages ?? []).map((m) => m.id!);
    if (!ids.length) break;

    for (const id of ids) {
      try {
        const full = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "full",
        });
        const headers = full.data.payload?.headers ?? [];
        const subject = headers.find((h) => h.name === "Subject")?.value ?? "";
        const to = headers.find((h) => h.name === "To")?.value ?? "";
        const date = headers.find((h) => h.name === "Date")?.value ?? "";
        const raw = decodeBody(full.data.payload);
        const bodyText = cleanBody(raw);
        const msg: SentMessage = {
          id,
          threadId: full.data.threadId!,
          subject,
          to,
          date,
          bodyText,
        };
        if (shouldKeep(msg)) messages.push(msg);
      } catch (e) {
        console.warn(`  ⚠️  skip ${id}: ${(e as Error).message}`);
      }
      listed++;
      if (listed >= MAX_MESSAGES) break;
    }

    pageToken = res.data.nextPageToken ?? undefined;
    if (!pageToken) break;
    process.stdout.write(`\r  listate: ${listed}, păstrate: ${messages.length}`);
  }
  process.stdout.write("\n");
  console.log(`✅ ${messages.length} mesaje păstrate după curățare (din ${listed} listate)`);
  return messages;
}

// ─── Etapă 1: clasificare intent per mesaj ──────────────────────────────────

async function labelIntents(messages: SentMessage[]): Promise<IntentLabel[]> {
  console.log(`\n🏷️  Etichetez intent pentru ${messages.length} mesaje...`);
  const labels: IntentLabel[] = [];

  for (let i = 0; i < messages.length; i += BATCH_SIZE_INTENT) {
    const batch = messages.slice(i, i + BATCH_SIZE_INTENT);
    const list = batch
      .map(
        (m, idx) =>
          `${i + idx}. SUBJECT: ${m.subject.slice(0, 100)}\n   PREVIEW: ${m.bodyText.slice(0, 250).replace(/\n/g, " ")}`,
      )
      .join("\n\n");

    const prompt = `Ești un asistent care analizează mailuri trimise de SetSail (școală yachting + expediții nautice).

Pentru fiecare mail din lista de mai jos, identifică INTENȚIA în 2-4 cuvinte simple în română, lowercase, fără diacritice.

Exemple intent: "raspuns cerere info", "confirmare inscriere", "trimitere oferta", "instructiuni curs", "factura urmare", "reminder document", "felicitari finalizare".

CATEGORII permise: scoala (cursuri/certificări), expeditii (charter/voiaje), sales (oferte/pre-vânzare), admin (instituțional/birocratic), altele.

Mailuri:
${list}

Returnează DOAR un JSON array de exact ${batch.length} obiecte cu indecșii ${i}..${i + batch.length - 1}, fără markdown:
[{"index": ${i}, "intent": "...", "category": "..."}, ...]`;

    try {
      const res = await claude.messages.create({
        model: MODEL,
        max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      });
      const text = (res.content[0] as any).text || "";
      const cleaned = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(cleaned) as IntentLabel[];
      labels.push(...parsed);
      process.stdout.write(`\r  procesate: ${labels.length}/${messages.length}`);
    } catch (e) {
      console.warn(`\n  ⚠️  batch ${i}: ${(e as Error).message}`);
    }
  }
  process.stdout.write("\n");
  return labels;
}

// ─── Etapă 2: pentru fiecare cluster, propune template ──────────────────────

function groupByIntent(
  messages: SentMessage[],
  labels: IntentLabel[],
): Map<string, { intent: string; category: IntentLabel["category"]; msgs: SentMessage[] }> {
  const map = new Map<string, { intent: string; category: IntentLabel["category"]; msgs: SentMessage[] }>();
  for (const l of labels) {
    const m = messages[l.index];
    if (!m) continue;
    const key = `${l.category}::${l.intent.toLowerCase().trim()}`;
    if (!map.has(key)) map.set(key, { intent: l.intent, category: l.category, msgs: [] });
    map.get(key)!.msgs.push(m);
  }
  return map;
}

async function proposeTemplate(
  intent: string,
  category: IntentLabel["category"],
  msgs: SentMessage[],
): Promise<Template | null> {
  const samples = msgs
    .slice(0, 8) // max 8 exemple per cluster
    .map(
      (m, i) =>
        `--- Exemplu ${i + 1} ---\nSUBJECT: ${m.subject}\nBODY:\n${m.bodyText.slice(0, 1500)}`,
    )
    .join("\n\n");

  const prompt = `Ești un asistent care creează template-uri canonice de email pentru SetSail.

Analizează aceste ${msgs.length} mailuri care toate au intenția "${intent}" (categoria: ${category}). Identifică structura comună și creează UN SINGUR template canonic.

Reguli:
- key: snake_case scurt în română fără diacritice, max 40 chars
- label: titlu lizibil cu emoji opțional, max 60 chars
- subject: subiectul canonic, înlocuiește părțile care variază cu {{variabila}}
- body_text: corpul canonic în română, înlocuiește variabilele cu {{variabila}}
- variables: array cu numele variabilelor folosite (fără {{}})
- Păstrează tonul și structura medie a exemplelor
- Variabile comune: {{nume}}, {{data}}, {{ora}}, {{locatie}}, {{suma}}, {{curs}}, {{expeditie}}

EXEMPLE:
${samples}

Returnează DOAR JSON valid (fără markdown), cu structura:
{"key":"...","label":"...","category":"${category}","subject":"...","body_text":"...","variables":["..."]}`;

  try {
    const res = await claude.messages.create({
      model: MODEL,
      max_tokens: 2500,
      messages: [{ role: "user", content: prompt }],
    });
    const text = (res.content[0] as any).text || "";
    const cleaned = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned) as Template;
  } catch (e) {
    console.warn(`  ⚠️  template "${intent}": ${(e as Error).message}`);
    return null;
  }
}

// ─── Persistență ─────────────────────────────────────────────────────────────

async function saveTemplate(
  tpl: Template,
  sourceIds: string[],
): Promise<"inserted" | "exists" | "error"> {
  const { error } = await supabase.from("mailing_templates").insert({
    key: tpl.key,
    label: tpl.label,
    category: tpl.category,
    subject: tpl.subject,
    body_text: tpl.body_text,
    variables: tpl.variables,
    is_active: false,
    is_proposed: true,
    source_message_ids: sourceIds,
  });
  if (!error) return "inserted";
  if (error.code === "23505") return "exists";
  console.error(`  ✗ ${tpl.key}: ${error.message}`);
  return "error";
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🚀 gmail-scanner ${DRY_RUN ? "(DRY RUN)" : ""}\n`);

  const messages = await fetchSent();
  if (messages.length === 0) {
    console.log("Niciun mesaj de procesat.");
    return;
  }

  const labels = await labelIntents(messages);
  const groups = groupByIntent(messages, labels);

  const eligible = [...groups.entries()].filter(([, g]) => g.msgs.length >= MIN_CLUSTER_SIZE);
  console.log(`\n🎯 ${eligible.length} clustere cu ≥${MIN_CLUSTER_SIZE} mesaje:`);
  for (const [key, g] of eligible) {
    console.log(`  • ${key}  (${g.msgs.length} mesaje)`);
  }

  const report: string[] = [
    `# Raport gmail-scanner — ${new Date().toISOString()}`,
    ``,
    `- Mesaje procesate: ${messages.length}`,
    `- Clustere eligibile: ${eligible.length}`,
    `- Mod: ${DRY_RUN ? "dry-run" : "save to DB"}`,
    ``,
    `## Templates propuse`,
    ``,
  ];

  let inserted = 0, existsCount = 0, errors = 0;

  console.log(`\n📝 Generez template-uri canonice...`);
  for (const [groupKey, g] of eligible) {
    console.log(`  → ${groupKey}`);
    const tpl = await proposeTemplate(g.intent, g.category, g.msgs);
    if (!tpl) {
      errors++;
      continue;
    }
    const sourceIds = g.msgs.map((m) => m.id);
    report.push(`### ${tpl.label}`);
    report.push(`- **key:** \`${tpl.key}\``);
    report.push(`- **category:** ${tpl.category}`);
    report.push(`- **variables:** ${tpl.variables.join(", ") || "(niciuna)"}`);
    report.push(`- **source messages:** ${sourceIds.length}`);
    report.push(`- **subject:** ${tpl.subject}`);
    report.push(``);
    report.push("```");
    report.push(tpl.body_text);
    report.push("```");
    report.push(``);

    if (!DRY_RUN) {
      const status = await saveTemplate(tpl, sourceIds);
      if (status === "inserted") inserted++;
      else if (status === "exists") existsCount++;
      else errors++;
    }
  }

  // Salvează raportul
  const outDir = "output";
  mkdirSync(outDir, { recursive: true });
  const reportPath = join(outDir, `scan-report-${Date.now()}.md`);
  writeFileSync(reportPath, report.join("\n"), "utf8");

  console.log(`\n─────────────────────────────────────`);
  console.log(`✅ Gata`);
  console.log(`   Inserate     : ${inserted}`);
  console.log(`   Deja existau : ${existsCount}`);
  console.log(`   Erori        : ${errors}`);
  console.log(`   Raport       : ${reportPath}`);
}

main().catch((e) => {
  console.error("\n✗ Eroare:", e);
  process.exit(1);
});
