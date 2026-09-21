// Pagini printabile (A4) pentru o serie: foaia de prezență și pagina cu cele 3 coduri QR.
// Folosite din pagina de admin și din lista de cursanți cu token.
import { scopeForSession } from '@/lib/timeline-scope'

export function titleCaseRo(s: string): string {
  return (s || '').toLocaleLowerCase('ro-RO').replace(/(^|[\s\-])([a-zăâîșț])/g, (_m, sep, ch) => sep + ch.toLocaleUpperCase('ro-RO'))
}

// Construiește foaia de prezență A4 landscape (HTML printabil)

export function buildAttendanceHtml(titlu: string, grupa: string, zile: string[], names: string[]): string {
  const esc = (s: string) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  // „Mierc, 23.09" -> ziua pe primul rând, data dedesubt
  // o săptămână nouă începe luni: linia din stânga coloanei e mai groasă
  const clase = zile.map((z, i) => 'day' + (i > 0 && /^luni/i.test(String(z).trim()) ? ' saptamana' : ''))
  const dayCols = zile.map((z, i) => {
    const [zi, data] = String(z).split(',')
    return `<th class="${clase[i]}">${esc(zi.trim())}${data ? `<span class="d">${esc(data.trim())}</span>` : ''}</th>`
  }).join('')
  const celuleZile = clase.map(c => `<td class="${c}"></td>`).join('')
  // lățimi fixe: numele cât cel mai lung nume + 2 taburi (~16 caractere),
  // zilele cât cel mai lat cap de coloană, mărit cu 50%
  const maxNume = names.reduce((m, n) => Math.max(m, (n || '').length), 4)
  const latNume = maxNume + 16
  const maxZi = zile.reduce((m, z) => Math.max(m, ...String(z).split(',').map(x => x.trim().length)), 5)
  const latZi = Math.ceil((maxZi + 2) * 1.5)
  const rows = names.map((n, i) => `<tr><td class="nr">${i + 1}</td><td class="name">${esc(n)}</td>${celuleZile}</tr>`).join('')
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>${esc(titlu)}</title>
<style>
  @page { size: A4 landscape; margin: 12mm; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  body { margin:0; font-family: Arial, Helvetica, sans-serif; color:#222; }
  h1 { text-align:center; font-size:16pt; font-weight:bold; margin:0 0 16px; }
  .grupa { font-weight:bold; font-size:12.5pt; margin:0 0 10px; }
  table { width:auto; border-collapse:collapse; table-layout:fixed; }
  th, td { border:1px solid #b9b9b9; padding:6px 8px; font-size:11pt; }
  th { background:#d9e7cd; font-weight:bold; text-align:center; }
  td.nr, th.nr { width:1%; white-space:nowrap; text-align:center; color:#333; }
  td.name, th.name { text-align:left; width:${latNume}ch; }
  /* coloanele zilelor: cât textul din cap, restul spațiului rămâne numelui */
  th.day, td.day { width:${latZi}ch; white-space:nowrap; text-align:center; }
  th.day .d { display:block; font-weight:normal; font-size:9.5pt; }
  /* trecerea într-o săptămână nouă */
  th.saptamana, td.saptamana { border-left-width:2.5px; border-left-color:#8a8a8a; }
  tr { height:26px; }
</style></head>
<body>
  <h1>${esc(titlu)}</h1>
  <div class="grupa">${esc(grupa)}</div>
  <table>
    <thead><tr><th class="nr">Nr.</th><th class="name">Nume</th>${dayCols}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload=function(){setTimeout(function(){window.focus();window.print();},350);};<\/script>
</body></html>`
}

export function whatsappText(sess: any): { label: string; sub: string; comunitate: boolean } {
  const comunitate = scopeForSession(sess) === 'curs_cd_snagov'
  return comunitate
    ? { label: 'COMUNITATE SETSAIL WHATSAPP', sub: 'Scaneaza pentru a intra in comunitate', comunitate }
    : { label: 'GRUP WHATSAPP', sub: 'Scaneaza pentru a intra in grup', comunitate }
}

export function buildQrPdfHtml(luna: string, an: string, imgs: { portal: string; skipper: string; whatsapp: string },
  wa: { label: string; sub: string } = { label: 'GRUP WHATSAPP', sub: 'Scaneaza pentru a intra in grup' }): string {
  const NAVY = '#0B3D6B', GREEN = '#26AE61', BORDER = '#CCD6DE', GRAY = '#6b7a86'
  return `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8">
<title>SETSAIL CDS ${luna} ${an}</title>
<style>
  @page { size: A4 portrait; margin: 0; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html,body { margin:0; padding:0; }
  .page { position:relative; width:210mm; height:297mm; margin:0 auto; font-family:Arial,Helvetica,sans-serif; color:#222; overflow:hidden; }
  .title { position:absolute; top:14mm; left:0; right:0; text-align:center; font-size:26pt; font-weight:bold; color:${NAVY}; letter-spacing:0.5px; }
  .rule { position:absolute; top:27mm; left:50%; transform:translateX(-50%); width:106mm; height:2px; background:${NAVY}; }
  .subtitle { position:absolute; top:30mm; left:0; right:0; text-align:center; font-size:12pt; color:${GRAY}; }
  .card { position:absolute; width:64mm; background:#fff; border:1px solid ${BORDER}; border-radius:4mm; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.06); z-index:1; }
  .band { height:8mm; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:bold; font-size:9.5pt; letter-spacing:0.5px; text-align:center; }
  .qr { display:block; width:53mm; height:53mm; margin:5mm auto 3mm; object-fit:contain; }
  .sub { position:absolute; width:64mm; text-align:center; font-size:8.5pt; color:${GRAY}; z-index:1; }
  .footer { position:absolute; bottom:12mm; left:0; right:0; text-align:center; font-size:9pt; color:${GRAY}; }
  svg.tri { position:absolute; inset:0; width:210mm; height:297mm; z-index:0; }
</style></head>
<body>
<div class="page">
  <svg class="tri" viewBox="0 0 210 297" preserveAspectRatio="none">
    <line x1="105" y1="81.5" x2="63" y2="189.5" stroke="${BORDER}" stroke-width="0.5" stroke-dasharray="2 2"/>
    <line x1="105" y1="81.5" x2="147" y2="189.5" stroke="${BORDER}" stroke-width="0.5" stroke-dasharray="2 2"/>
    <line x1="63" y1="189.5" x2="147" y2="189.5" stroke="${BORDER}" stroke-width="0.5" stroke-dasharray="2 2"/>
  </svg>

  <div class="title">SETSAIL CDS ${luna} ${an}</div>
  <div class="rule"></div>
  <div class="subtitle">Scaneaza codurile QR de mai jos</div>

  <div class="card" style="left:73mm; top:42mm;">
    <div class="band" style="background:${NAVY};">UPLOAD CI PENTRU PRACTICA</div>
    <img class="qr" src="${imgs.portal}"/>
  </div>
  <div class="sub" style="left:73mm; top:113mm;">setsail-practica.vercel.app</div>

  <div class="card" style="left:31mm; top:150mm;">
    <div class="band" style="background:${NAVY};">PLATFORMA SETSAIL</div>
    <img class="qr" src="${imgs.skipper}"/>
  </div>
  <div class="sub" style="left:31mm; top:221mm;">skipper.setsail.ro &nbsp;·&nbsp; Simulator examen</div>

  <div class="card" style="left:115mm; top:150mm;">
    <div class="band" style="background:${GREEN};${wa.label.length > 25 ? 'font-size:8.5pt;letter-spacing:0.2px;' : ''}">${wa.label}</div>
    <img class="qr" src="${imgs.whatsapp}"/>
  </div>
  <div class="sub" style="left:115mm; top:221mm;">${wa.sub}</div>

  <div class="footer">SetSail NauticSchool &nbsp;·&nbsp; setsail.ro</div>
</div>
<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},400);};</script>
</body></html>`
}
