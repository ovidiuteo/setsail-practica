import "dotenv/config";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

const {
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REFRESH_TOKEN,
  SUPABASE_URL,
  SUPABASE_SERVICE_KEY,
} = process.env;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
  console.error("Lipsesc env vars Google. Rulează 'npm run auth' mai întâi.");
  process.exit(1);
}

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Lipsesc SUPABASE_URL / SUPABASE_SERVICE_KEY în .env.");
  process.exit(1);
}

async function main() {
  const oauth2 = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  oauth2.setCredentials({ refresh_token: GOOGLE_REFRESH_TOKEN });

  console.log("Testez Gmail API...");
  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  const profile = await gmail.users.getProfile({ userId: "me" });
  console.log(`  ✓ Cont: ${profile.data.emailAddress}`);
  console.log(`  ✓ Total mesaje: ${profile.data.messagesTotal}`);

  const sent = await gmail.users.messages.list({
    userId: "me",
    q: "in:sent",
    maxResults: 5,
  });
  const sentCount = sent.data.messages?.length ?? 0;
  console.log(`  ✓ Ultimele ${sentCount} mailuri din Sent: accesibile`);

  if (sent.data.messages && sent.data.messages.length > 0) {
    const last = await gmail.users.messages.get({
      userId: "me",
      id: sent.data.messages[0].id!,
      format: "metadata",
      metadataHeaders: ["Subject", "To", "Date"],
    });
    const headers = last.data.payload?.headers ?? [];
    const subj = headers.find((h) => h.name === "Subject")?.value ?? "(fără subject)";
    const to = headers.find((h) => h.name === "To")?.value ?? "?";
    const date = headers.find((h) => h.name === "Date")?.value ?? "?";
    console.log(`  ✓ Ultimul mail Sent:`);
    console.log(`      Către: ${to}`);
    console.log(`      Subject: ${subj}`);
    console.log(`      Dată: ${date}`);
  }

  console.log("\nTestez Supabase (service_role)...");
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, {
    auth: { persistSession: false },
  });

  const tables = ["mailing_templates", "mailing_threads", "mailing_drafts"];
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error(`  ✗ ${t}: ${error.message}`);
      process.exit(1);
    }
    console.log(`  ✓ ${t}: ${count ?? 0} rânduri (acces OK)`);
  }

  console.log("\n✓✓✓ Totul OK: Gmail API + Supabase. Putem trece la implementare.");
}

main().catch((e) => {
  console.error("\n✗ Eroare:", e.message || e);
  process.exit(1);
});
