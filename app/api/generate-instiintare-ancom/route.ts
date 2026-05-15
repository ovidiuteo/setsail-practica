import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// tip: 'curs-obtinere' | 'curs-prelungire' | 'examen-obtinere' | 'examen-prelungire'
// format: 'docx' | 'pdf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body
    const tip = body.tip || 'curs-obtinere'
    const format = body.format || 'docx'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: session } = await supabase
      .from('sessions')
      .select('*, locations(*), evaluators(*), instructors(*)')
      .eq('id', session_id)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    // Aducem antetul radio si stampila cu semnatura
    const { data: antetDoc } = await supabase
      .from('setsail_documents')
      .select('file_data')
      .eq('tip', 'antet_radio')
      .single()

    const { data: stampilaDoc } = await supabase
      .from('setsail_documents')
      .select('file_data')
      .eq('tip', 'stampila_cu_semnatura')
      .single()

    // Aducem info setsail pentru protocol ANCOM
    const { data: infoRows } = await supabase
      .from('setsail_info')
      .select('key, value')
      .in('key', ['protocol_ancom_valabil_pana'])
    const infoMap: Record<string,string> = {}
    for (const row of infoRows || []) infoMap[row.key] = row.value
    const protocolValabilPana = infoMap['protocol_ancom_valabil_pana'] || '31.12.2026'

    // Aducem numerele de solicitare alocate pentru aceasta sesiune
    // Intai cautam dupa session_id, daca nu gasim luam ultimele alocate global
    const { data: nrRowsSession } = await supabase
      .from('notification_numbers')
      .select('numar, document_tip, data_notificare, tip')
      .eq('session_id', session_id)
      .eq('tip', 'solicitare')
      .order('numar')
    
    const { data: nrRowsAll } = await supabase
      .from('notification_numbers')
      .select('numar, document_tip, data_notificare, tip')
      .eq('tip', 'solicitare')
      .order('numar', { ascending: false })

    // Folosim session_id specific daca exista, altfel ultimele globale per document_tip
    const nrRows = (nrRowsSession && nrRowsSession.length > 0) ? nrRowsSession : []
    
    const nrMap: Record<string, number> = {}
    for (const row of nrRows) {
      if (row.document_tip) nrMap[row.document_tip] = row.numar
    }
    // Daca nu avem per sesiune, luam ultimul global per document_tip
    if (Object.keys(nrMap).length === 0 && nrRowsAll && nrRowsAll.length > 0) {
      const seen = new Set<string>()
      for (const row of nrRowsAll) {
        if (row.document_tip && !seen.has(row.document_tip)) {
          nrMap[row.document_tip] = row.numar
          seen.add(row.document_tip)
        }
      }
    }

    const nrTipMap: Record<string, string> = {
      'curs-obtinere':    'curs-obtinere',
      'curs-prelungire':  'curs-prelungire',
      'examen-obtinere':  'examen-obtinere',
      'examen-prelungire':'examen-prelungire',
    }
    const nrCurent = nrMap[nrTipMap[tip]] ? String(nrMap[nrTipMap[tip]]) : ''
    const allRows = [...(nrRowsSession || []), ...(nrRowsAll || [])]
    const dataNrRow = allRows.find((r: any) => r.document_tip === tip)
    const dataNrFormatat = dataNrRow
      ? new Date(dataNrRow.data_notificare).toLocaleDateString('ro-RO')
      : new Date(session.session_date).toLocaleDateString('ro-RO')

    const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    const courseStartDate = session.course_start_date
      ? new Date(session.course_start_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
      : sessionDate
    const dateStr = session.session_date.replace(/-/g, '_')
    const dataCurenta = new Date(session.session_date).toLocaleDateString('ro-RO')

    const isPrelungire = tip.includes('prelungire')
    const isExamen = tip.includes('examen')

    const perioadaCurs = courseStartDate === sessionDate
      ? sessionDate
      : `${courseStartDate} - ${sessionDate}`

    let subiect = ''
    let corpText = ''
    let titluDoc = ''

    if (!isExamen && !isPrelungire) {
      titluDoc = 'Înștiințare organizare curs obținere LRC'
      subiect = 'Înștiințare cu privire la data de începere a cursului de pregătire în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de ${protocolValabilPana}, vă înștiințăm că vom organiza un curs de pregătire în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC în perioada ${perioadaCurs}.\n\nLocul de desfășurare al cursului este online.`
    } else if (!isExamen && isPrelungire) {
      titluDoc = 'Înștiințare organizare curs reconfirmare LRC'
      subiect = 'Înștiințare cu privire la data de începere a cursului de reconfirmare în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de ${protocolValabilPana}, vă înștiințăm că vom organiza un curs de reconfirmare în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC în perioada ${perioadaCurs}.\n\nLocul de desfășurare al cursului este online.`
    } else if (isExamen && !isPrelungire) {
      titluDoc = 'Înștiințare organizare examen obținere LRC'
      subiect = 'Înștiințare cu privire la data de desfășurare a examenului în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de ${protocolValabilPana}, vă înștiințăm că pe data de ${sessionDate}, organizam o sesiune de examinare în vederea obținerii certificatelor de operator radio, online.\n\nMembrii comisiei de examinare vor fi:\n- Drugan Ovidiu, instructor SetSail, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC\n- Drugan Sorin, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC`
    } else {
      titluDoc = 'Înștiințare organizare examen prelungire LRC'
      subiect = 'Înștiințare cu privire la data de desfășurare a examenului în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de ${protocolValabilPana}, vă înștiințăm că pe data de ${sessionDate}, orele 19.00, organizam o sesiune de examinare în vederea prelungirii valabilității certificatelor de operator radio, online.\n\nMembrii comisiei de examinare vor fi:\n- Drugan Ovidiu, instructor SetSail, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC\n- Drugan Sorin, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC`
    }

    if (format === 'pdf') {
      const antetHtml = antetDoc?.file_data
        ? `<img src="${antetDoc.file_data}" style="max-width:100%;height:auto;max-height:117px;display:block;"/>`
        : `<div style="font-weight:bold;font-size:13pt;text-align:center;">S.C. SET SAIL ADVERTISING S.R.L.</div>`

      const stampilaHtml = stampilaDoc?.file_data
        ? `<img src="${stampilaDoc.file_data}" style="height:110px;width:auto;display:block;margin:0 auto;"/>`
        : `<div style="font-style:italic;color:#666;">Semnătură și ștampilă</div>`

      // Construim paragrafele corpului
      const paragraphs = corpText.split('\n').map(line => {
        if (!line.trim()) return `<p style="margin:6px 0;"></p>`
        if (line.startsWith('-')) {
          return `<p style="margin:4px 0 4px 30px;">${line}</p>`
        }
        return `<p style="margin:6px 0;text-indent:40px;text-align:justify;">${line}</p>`
      }).join('')

      const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${titluDoc}</title>
<style>
  @page { size: A4 portrait; margin: 4mm 20mm 20mm 20mm; }
  @media print {
    html, body { background: white !important; padding: 0 !important; }
    body { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; }
    .no-print { display: none !important; }
  }
  html { background: #e0e0e0; padding: 20px; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    background: #fff;
    width: 170mm;
    min-height: 257mm;
    margin: 0 auto;
    padding: 4mm 20mm 20mm 20mm;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    box-sizing: border-box;
  }
  .antet { margin-bottom: 10px; }
  .nr-data { text-align: right; margin: 10px 0 14px 0; font-size: 11pt; }
  .catre { margin: 0 0 14px 0; line-height: 1; }
  .catre p { margin: 2px 0; font-size: 11pt; line-height: 1; }
  .subiect { margin: 10px 0 18px 0; font-size: 11pt; line-height: 1.22; }
  .titlu-centrat { text-align: center; font-size: 13pt; font-weight: bold; margin: 22px 0 18px 0; }
  .corp { font-size: 11pt; }
  .semnatura-bloc {
    margin-top: 36px;
    display: flex;
    justify-content: flex-end;
  }
  .semnatura-dreapta {
    text-align: center;
    min-width: 200px;
  }
  .semnatura-dreapta .cu-stima { font-size: 11pt; margin-bottom: 2px; }
  .semnatura-dreapta .firma { font-weight: bold; font-size: 11pt; margin-bottom: 2px; }
  .semnatura-dreapta .director { font-size: 10.5pt; margin-bottom: 0; }
</style>
</head>
<body>

  <!-- Antet -->
  <div class="antet">${antetHtml}</div>

  <!-- Nr si data -->
  <div class="nr-data"><strong>Nr. ${nrCurent || '......'} / ${dataNrFormatat}</strong></div>

  <!-- Catre -->
  <div class="catre">
    <p><strong>Către,</strong></p>
    <p>AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE</p>
    <p>ȘI REGLEMENTARE ÎN COMUNICAȚII</p>
  </div>

  <!-- Subiect -->
  <div class="subiect">
    <span style="font-weight:bold;">Subiect: </span><em>${subiect}</em>
  </div>

  <!-- Titlu -->
  <div class="titlu-centrat">Domnule Președinte,</div>

  <!-- Corp -->
  <div class="corp">${paragraphs}</div>

  <!-- Semnatura -->
  <div class="semnatura-bloc">
    <div class="semnatura-dreapta">
      <div class="cu-stima">Cu stimă,</div>
      <div class="firma">SC SET SAIL ADVERTISING SRL</div>
      <div class="director">director Cobianu Drugan Corina</div>
      ${stampilaHtml}
    </div>
  </div>

</body>
</html>`

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // ─── DOCX ──────────────────────────────────────────────────────────────
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      convertMillimetersToTwip, ImageRun
    } = await import('docx')

    const bold = (t: string, sz = 22) => new TextRun({ text: t, bold: true, size: sz, font: 'Arial' })
    const reg  = (t: string, sz = 22) => new TextRun({ text: t, size: sz, font: 'Arial' })
    const ital = (t: string, sz = 22) => new TextRun({ text: t, italics: true, size: sz, font: 'Arial' })
    const boldItal = (t: string, sz = 22) => new TextRun({ text: t, bold: true, italics: true, size: sz, font: 'Arial' })
    const para = (ch: any[], align = AlignmentType.LEFT as any, sp = 120, indent?: number) =>
      new Paragraph({ alignment: align, spacing: { before: sp, after: sp }, indent: indent ? { firstLine: indent } : undefined, children: ch })

    // Antet
    let headerImg: any[] = []
    if (antetDoc?.file_data) {
      try {
        const base64 = antetDoc.file_data.includes(',') ? antetDoc.file_data.split(',')[1] : antetDoc.file_data
        const buf = Buffer.from(base64, 'base64')
        const mt = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
        headerImg = [new Paragraph({
          alignment: AlignmentType.CENTER as any,
          spacing: { after: 200 },
          children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 600, height: 65 } })]
        })]
      } catch(e) { console.error(e) }
    }

    // Stampila cu semnatura
    let stampilaImg: any[] = []
    if (stampilaDoc?.file_data) {
      try {
        const base64 = stampilaDoc.file_data.includes(',') ? stampilaDoc.file_data.split(',')[1] : stampilaDoc.file_data
        const buf = Buffer.from(base64, 'base64')
        const mt = stampilaDoc.file_data.includes('png') ? 'png' : 'jpg'
        stampilaImg = [new Paragraph({
          alignment: AlignmentType.RIGHT as any,
          spacing: { before: 120, after: 0 },
          children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 160, height: 110 } })]
        })]
      } catch(e) { console.error(e) }
    }

    // Corp paragraphs
    const corpParas: any[] = []
    for (const line of corpText.split('\n')) {
      if (!line.trim()) {
        corpParas.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }))
      } else if (line.startsWith('-')) {
        corpParas.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED as any,
          spacing: { before: 80, after: 80 },
          indent: { left: 720 },
          children: [reg(line)]
        }))
      } else {
        const boldParts = line.split(/(\d{1,2} \w+ \d{4}|\d{1,2}\.\d{1,2}\.\d{4})/g)
        const children: any[] = boldParts.map(part =>
          /\d{1,2} \w+ \d{4}/.test(part) || /\d{1,2}\.\d{1,2}\.\d{4}/.test(part)
            ? bold(part)
            : reg(part)
        )
        corpParas.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED as any,
          spacing: { before: 80, after: 80 },
          indent: { firstLine: 720 },
          children
        }))
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(20),
            }
          }
        },
        children: [
          ...headerImg,
          para([reg('Nr. ' + (nrCurent || '......') + ' / ' + dataNrFormatat)], AlignmentType.RIGHT as any, 200),
          new Paragraph({ spacing: { before: 200, after: 60 }, children: [bold('Către,')] }),
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [reg('AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE')] }),
          new Paragraph({ spacing: { before: 0, after: 200 }, children: [reg('ȘI REGLEMENTARE ÎN COMUNICAȚII')] }),
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [bold('Subiect:   '), boldItal(subiect)]
          }),
          para([bold('Domnule Președinte,', 26)], AlignmentType.CENTER as any, 300),
          ...corpParas,
          new Paragraph({ spacing: { before: 600, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('Cu stimă,')] }),
          new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [bold('SC SET SAIL ADVERTISING SRL')] }),
          new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('director Cobianu Drugan Corina')] }),
          ...stampilaImg,
          new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Instiintare_ANCOM_${tip}_${dateStr}.docx"`
      }
    })

  } catch (err: any) {
    console.error('Instiintare ANCOM error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
