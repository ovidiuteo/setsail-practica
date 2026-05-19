import { NextRequest, NextResponse } from 'next/server'

// Genereaza un singur HTML care contine toate 4 instiintarile,
// fiecare pe pagina ei (page-break intre ele).
// Parametri:
//   session_id: required
//   cu_stampila: true (default) | false - forwardeaza catre fiecare subapel
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body
    const cuStampila = body.cu_stampila !== false  // default true

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    const tipuri = ['curs-obtinere', 'examen-obtinere', 'curs-prelungire', 'examen-prelungire']

    const origin = req.nextUrl.origin

    const htmlParts: string[] = []

    for (const tip of tipuri) {
      const res = await fetch(`${origin}/api/generate-instiintare-ancom`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, tip, format: 'pdf', cu_stampila: cuStampila })
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`Eroare la ${tip}:`, err)
        continue
      }

      const html = await res.text()
      htmlParts.push(extractBody(html))
    }

    // Titlu doc dinamic in functie de cu/fara stampila (apare in numele PDF la Save as)
    const titluDoc = cuStampila
      ? 'Toate Înștiințările ANCOM'
      : 'Toate Înștiințările ANCOM (fără ștampilă)'

    const combined = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<title>${titluDoc}</title>
<style>
  @page { size: A4 portrait; margin: 5mm 18mm 15mm 18mm; }
  @media print {
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
      width: auto !important;
      min-height: 0 !important;
      box-shadow: none !important;
    }
    .doc-section {
      page-break-after: always;
      break-after: page;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: auto !important;
      min-height: 0 !important;
      max-width: none !important;
    }
    .doc-section:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .no-print { display: none !important; }
  }
  html { background: #e0e0e0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    margin: 0;
    padding: 0;
    background: #e0e0e0;
  }
  .doc-section {
    background: #fff;
    max-width: 210mm;
    min-height: 297mm;
    margin: 20px auto;
    padding: 5mm 18mm 15mm 18mm;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
  }
  .doc-section:last-child {
    page-break-after: auto;
    break-after: auto;
  }
  /* Stiluri locale - paragrafele din document */
  .doc-section p { margin: 6px 0; }
  .doc-section .antet { margin-bottom: 10px; }
  .doc-section .nr-data { text-align: right; margin: 10px 0 14px 0; font-size: 11pt; }
  .doc-section .catre { margin: 0 0 14px 0; line-height: 1; }
  .doc-section .catre p { margin: 2px 0; font-size: 11pt; line-height: 1; }
  .doc-section .subiect { margin: 10px 0 18px 0; font-size: 11pt; line-height: 1.22; }
  .doc-section .titlu-centrat { text-align: center; font-size: 13pt; font-weight: bold; margin: 22px 0 18px 0; }
  .doc-section .corp { font-size: 11pt; }
  .doc-section .corp p { margin: 6px 0; }
  .doc-section .semnatura-bloc { margin-top: 36px; display: flex; justify-content: flex-end; }
  .doc-section .semnatura-dreapta { text-align: center; min-width: 200px; }
  .doc-section .semnatura-dreapta .cu-stima { font-size: 11pt; margin-bottom: 2px; }
  .doc-section .semnatura-dreapta .firma { font-weight: bold; font-size: 11pt; margin-bottom: 2px; }
  .doc-section .semnatura-dreapta .director { font-size: 10.5pt; margin-bottom: 0; }
</style>
</head>
<body>
${htmlParts.map(p => `<section class="doc-section">${p}</section>`).join('\n')}
</body>
</html>`

    return new NextResponse(combined, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (err: any) {
    console.error('Toate Instiintari ANCOM error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Extrage continutul dintre <body> si </body> dintr-un HTML complet.
function extractBody(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  return bodyMatch ? bodyMatch[1] : ''
}
