// ============================================================================
// SSYT2026 - Template renderer pentru documente club sportiv
// ============================================================================
// Inlocuieste placeholderii {{nume}} etc. din HTML-ul unui template cu valori
// reale din profilul participantului si datele clubului.
//
// Pentru imagini (CI, semnatura) genereaza signed URLs (24h) din storage.
// ============================================================================

import { getPortalSupabase } from './portal-session'

const BUCKET = 'ssyt-participant-uploads'
const SIGNED_URL_TTL = 60 * 60 * 24

export type RenderContext = {
  participant: ParticipantData
  club: ClubData
  signedUrls: { ci: string | null; signature: string | null }
}

type ParticipantData = {
  first_name?: string | null
  last_name?: string | null
  full_name?: string | null
  email?: string | null
  phone?: string | null
  date_of_birth?: string | null
  cnp?: string | null
  ci_seria?: string | null
  ci_numar?: string | null
  ci_emis_de?: string | null
  ci_emisa_la?: string | null
  ci_image_url?: string | null
  signature_image_url?: string | null
  adresa_completa?: string | null
  loc_nasterii?: string | null
  judet_nasterii?: string | null
  cetatenia?: string | null
}

type ClubData = {
  name?: string | null
  address?: string | null
  phone?: string | null
  website?: string | null
}

function formatDateRo(input: string | null | undefined): string {
  if (!input) return ''
  const d = new Date(input)
  if (isNaN(d.getTime())) return String(input)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mm}.${d.getFullYear()}`
}

function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return ''
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function buildSignedUrls(
  participant: ParticipantData
): Promise<{ ci: string | null; signature: string | null }> {
  const supabase = getPortalSupabase()

  const ciPath = participant.ci_image_url
  const sigPath = participant.signature_image_url

  const [ciRes, sigRes] = await Promise.all([
    ciPath
      ? supabase.storage.from(BUCKET).createSignedUrl(ciPath, SIGNED_URL_TTL)
      : Promise.resolve(null),
    sigPath
      ? supabase.storage.from(BUCKET).createSignedUrl(sigPath, SIGNED_URL_TTL)
      : Promise.resolve(null),
  ])

  return {
    ci: ciRes?.data?.signedUrl ?? null,
    signature: sigRes?.data?.signedUrl ?? null,
  }
}

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/gi

export function renderTemplate(html: string, ctx: RenderContext): string {
  const { participant, club, signedUrls } = ctx
  const today = formatDateRo(new Date().toISOString())

  const semnaturaImg = signedUrls.signature
    ? `<img src="${escapeHtml(signedUrls.signature)}" alt="Semnătură" class="signature-img" />`
    : '<span class="placeholder-line">__________________________</span>'

  const ciImg = signedUrls.ci
    ? `<img src="${escapeHtml(signedUrls.ci)}" alt="CI" class="ci-img" />`
    : '<span class="placeholder-line">(poza CI nu este încărcată în portal)</span>'

  const locSemnatura = signedUrls.signature
    ? semnaturaImg
    : '<span class="placeholder-line">__________________________</span>'

  const map: Record<string, string> = {
    prenume: escapeHtml(participant.first_name),
    nume: escapeHtml(participant.last_name),
    nume_complet: escapeHtml(participant.full_name),
    email: escapeHtml(participant.email),
    telefon: escapeHtml(participant.phone),
    data_nasterii: escapeHtml(formatDateRo(participant.date_of_birth)),
    cnp: escapeHtml(participant.cnp),
    ci_seria: escapeHtml(participant.ci_seria),
    ci_numar: escapeHtml(participant.ci_numar),
    ci_emis_de: escapeHtml(participant.ci_emis_de),
    ci_emisa_la: escapeHtml(formatDateRo(participant.ci_emisa_la)),
    adresa: escapeHtml(participant.adresa_completa),
    loc_nasterii: escapeHtml(participant.loc_nasterii),
    judet_nasterii: escapeHtml(participant.judet_nasterii),
    cetatenia: escapeHtml(participant.cetatenia || 'Română'),
    nume_club: escapeHtml(club.name),
    adresa_club: escapeHtml(club.address),
    telefon_club: escapeHtml(club.phone),
    website_club: escapeHtml(club.website),
    data_curenta: today,
    semnatura_img: semnaturaImg,
    ci_img: ciImg,
    loc_semnatura: locSemnatura,
  }

  return html.replace(PLACEHOLDER_RE, (_match, key: string) => {
    const k = key.toLowerCase()
    return Object.prototype.hasOwnProperty.call(map, k) ? map[k] : `{{${k}}}`
  })
}

export const PLACEHOLDER_CATALOG: Array<{ key: string; label: string; sample: string }> = [
  { key: 'prenume', label: 'Prenume', sample: 'Corina' },
  { key: 'nume', label: 'Nume', sample: 'Cobianu-Drugan' },
  { key: 'nume_complet', label: 'Nume complet', sample: 'Corina Cobianu-Drugan' },
  { key: 'email', label: 'Email', sample: 'corina@exemplu.ro' },
  { key: 'telefon', label: 'Telefon', sample: '+40 7XX XXX XXX' },
  { key: 'data_nasterii', label: 'Data nașterii', sample: '15.03.1985' },
  { key: 'cnp', label: 'CNP', sample: '2850315123456' },
  { key: 'ci_seria', label: 'CI seria', sample: 'RR' },
  { key: 'ci_numar', label: 'CI număr', sample: '123456' },
  { key: 'ci_emis_de', label: 'CI emisă de', sample: 'SPCEP Sector 1' },
  { key: 'ci_emisa_la', label: 'CI emisă la', sample: '01.01.2020' },
  { key: 'adresa', label: 'Adresă completă', sample: 'Str. Exemplu nr. 12, București' },
  { key: 'loc_nasterii', label: 'Loc nașterii', sample: 'București' },
  { key: 'judet_nasterii', label: 'Județul nașterii', sample: 'Sector 1' },
  { key: 'cetatenia', label: 'Cetățenia', sample: 'Română' },
  { key: 'nume_club', label: 'Nume club', sample: 'Santa Clara Yachting' },
  { key: 'adresa_club', label: 'Adresă club', sample: 'Str. Sabinelor 8, Sector 5' },
  { key: 'telefon_club', label: 'Telefon club', sample: '+40 722 ...' },
  { key: 'website_club', label: 'Website club', sample: 'https://...' },
  { key: 'data_curenta', label: 'Data curentă', sample: '15.05.2026' },
  { key: 'semnatura_img', label: '🖋️ Imaginea semnăturii', sample: '[img semnătură]' },
  { key: 'ci_img', label: '🆔 Imaginea CI', sample: '[img CI]' },
  { key: 'loc_semnatura', label: 'Loc pt. semnătură (img sau linie)', sample: '[img/linie]' },
]

export function buildPrintHtml(documentTitle: string, body: string): string {
  const safeTitle = escapeHtml(documentTitle)
  return `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8" />
<title>${safeTitle}</title>
<style>
  @page { size: A4; margin: 1.5cm 2cm; }
  html, body { margin: 0; padding: 0; background: #f1f5f9; }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    line-height: 1.45;
    color: #000;
  }
  h1, h2, h3 { font-weight: bold; margin: 0.5em 0; }
  p { margin: 0.5em 0; }
  .signature-img { max-width: 180px; max-height: 80px; height: auto; vertical-align: middle; }
  .ci-img { max-width: 360px; max-height: 240px; height: auto; border: 1px solid #ccc; }
  .placeholder-line { color: #999; font-style: italic; font-family: sans-serif; }
  .container {
    max-width: 21cm;
    margin: 30px auto;
    padding: 2cm 2.5cm;
    background: #fff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    background: #FF6B35;
    color: #fff;
    padding: 10px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 13px;
  }
  .toolbar button {
    background: #fff;
    color: #FF6B35;
    border: none;
    padding: 6px 14px;
    border-radius: 4px;
    font-weight: 600;
    cursor: pointer;
    font-size: 13px;
  }
  @media print {
    .toolbar { display: none; }
    .container { margin: 0; padding: 0; box-shadow: none; max-width: none; background: #fff; }
    html, body { background: #fff; }
  }
</style>
</head>
<body>
<div class="toolbar">
  <span><strong>Ctrl+P</strong> (sau ⌘P pe Mac) → „Save as PDF" → orientare <strong>Portret</strong>, format <strong>A4</strong>.</span>
  <button onclick="window.print()">🖨️ Printează</button>
</div>
<div class="container">
${body}
</div>
<script>
  window.addEventListener('load', function() {
    setTimeout(function() { window.print(); }, 500);
  });
</script>
</body>
</html>`
}
