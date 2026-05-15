import { NextRequest, NextResponse } from 'next/server'

// Genereaza un singur HTML care contine toate 4 documente radio:
// 1. PV Obtinere, 2. Anexa PV Obtinere, 3. PV Prelungire, 4. Anexa PV Prelungire
// fiecare pe pagina ei (page-break intre ele).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 })
    }

    const docs: { endpoint: string; tip: string; label: string }[] = [
      { endpoint: '/api/generate-pv-radio',  tip: 'obtinere',   label: 'PV Obtinere' },
      { endpoint: '/api/generate-anexa-pv',  tip: 'obtinere',   label: 'Anexa Obtinere' },
      { endpoint: '/api/generate-pv-radio',  tip: 'prelungire', label: 'PV Prelungire' },
      { endpoint: '/api/generate-anexa-pv',  tip: 'prelungire', label: 'Anexa Prelungire' },
    ]

    const origin = req.nextUrl.origin

    const parts: { html: string; styles: string }[] = []

    for (const d of docs) {
      const res = await fetch(`${origin}${d.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, tip: d.tip, format: 'pdf' })
      })

      if (!res.ok) {
        const err = await res.text()
        console.error(`Eroare la ${d.label}:`, err)
        continue
      }

      const html = await res.text()
      parts.push(extractStyleAndBody(html))
    }

    // Combinam toate stilurile + body-urile
    const allStyles = parts.map(p => p.styles).join('\n')
    const allBodies = parts.map(p => `<section class="doc-page">${p.html}</section>`).join('\n')

    const combined = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<title>Toate Documentele Radio</title>
<style>
  @page { size: A4 portrait; margin: 10mm 12mm 10mm 12mm; }
  @media print {
    html, body {
      background: #fff !important;
      margin: 0 !important;
      padding: 0 !important;
    }
    .doc-page {
      page-break-after: always;
      break-after: page;
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: auto !important;
      min-height: 0 !important;
    }
    .doc-page:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .no-print { display: none !important; }
  }
  html { background: #e0e0e0; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    margin: 0;
    padding: 0;
    background: #e0e0e0;
  }
  .doc-page {
    background: #fff;
    margin: 20px auto;
    padding: 10mm 12mm;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    box-sizing: border-box;
    page-break-after: always;
    break-after: page;
    max-width: 210mm;
  }
  .doc-page:last-child {
    page-break-after: auto;
    break-after: auto;
  }
</style>
${allStyles}
</head>
<body>
${allBodies}
</body>
</html>`

    return new NextResponse(combined, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    })

  } catch (err: any) {
    console.error('Toate Documente Radio error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// Extrage tag-urile <style> si continutul <body>
function extractStyleAndBody(html: string): { html: string; styles: string } {
  // Extragem toate style-urile
  const styleMatches = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || []
  // Scoatem @page din style-urile interne ca sa nu se calce in conflict cu cel global
  const styles = styleMatches
    .map(s => s.replace(/@page\s*\{[^}]*\}/g, ''))
    .join('\n')

  // Extragem body-ul
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const bodyContent = bodyMatch ? bodyMatch[1] : ''

  return { html: bodyContent, styles }
}
