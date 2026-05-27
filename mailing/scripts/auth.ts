import { google } from "googleapis";
import http from "node:http";
import { URL } from "node:url";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { exec } from "node:child_process";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.labels",
  "https://www.googleapis.com/auth/spreadsheets",
];

const PORT = 4444;
const REDIRECT_URI = `http://localhost:${PORT}/`;
const CRED_PATH = "credentials/client_secret.json";
const ENV_PATH = ".env";

type Creds = {
  installed: {
    client_id: string;
    client_secret: string;
  };
};

function loadCreds(): { id: string; secret: string } {
  if (!existsSync(CRED_PATH)) {
    console.error(`Lipsește ${CRED_PATH}. Pune client_secret.json acolo.`);
    process.exit(1);
  }
  const raw = readFileSync(CRED_PATH, "utf8");
  const json = JSON.parse(raw) as Creds;
  return { id: json.installed.client_id, secret: json.installed.client_secret };
}

function openBrowser(url: string) {
  const cmd =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, () => {});
}

function appendEnv(key: string, value: string) {
  let body = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, "utf8") : "";
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, "m");
  if (re.test(body)) {
    body = body.replace(re, line);
  } else {
    if (body && !body.endsWith("\n")) body += "\n";
    body += line + "\n";
  }
  writeFileSync(ENV_PATH, body);
}

async function main() {
  const { id, secret } = loadCreds();
  const oauth2 = new google.auth.OAuth2(id, secret, REDIRECT_URI);

  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
  });

  console.log("\nDeschid browser-ul pentru autorizare...");
  console.log("Dacă nu se deschide automat, copiază manual URL-ul:\n");
  console.log(authUrl + "\n");

  const code: string = await new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const url = new URL(req.url || "/", REDIRECT_URI);
        const c = url.searchParams.get("code");
        const err = url.searchParams.get("error");
        if (err) {
          res.writeHead(400, { "Content-Type": "text/html; charset=utf-8" });
          res.end(`<h1>Eroare: ${err}</h1><p>Închide fila.</p>`);
          server.close();
          reject(new Error(err));
          return;
        }
        if (c) {
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(
            "<h1>Autorizare reușită ✓</h1><p>Poți închide această filă și revenii în terminal.</p>",
          );
          server.close();
          resolve(c);
          return;
        }
        res.writeHead(404);
        res.end();
      } catch (e) {
        reject(e as Error);
      }
    });
    server.listen(PORT, () => {
      openBrowser(authUrl);
    });
    server.on("error", reject);
  });

  console.log("\nCod primit. Schimb cu tokens...");
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    console.error(
      "\nNu am primit refresh_token. Probabil ai mai autorizat aceeași app înainte.",
    );
    console.error(
      "Mergi la https://myaccount.google.com/permissions, șterge SetSail Mailing, apoi rulează scriptul din nou.",
    );
    process.exit(1);
  }

  appendEnv("GOOGLE_CLIENT_ID", id);
  appendEnv("GOOGLE_CLIENT_SECRET", secret);
  appendEnv("GOOGLE_REFRESH_TOKEN", tokens.refresh_token);

  console.log("\n✓ Refresh token salvat în .env");
  console.log("  GOOGLE_CLIENT_ID=...");
  console.log("  GOOGLE_CLIENT_SECRET=...");
  console.log("  GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token.slice(0, 12) + "...");
  console.log("\nGata. Poți rula 'npm run verify' pentru testul de acces.");
}

main().catch((e) => {
  console.error("\nEroare:", e);
  process.exit(1);
});
