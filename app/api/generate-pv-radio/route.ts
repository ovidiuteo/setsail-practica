import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { session_id } = body
  // Citim tip si format din query params (URL) sau din body
  const tip = req.nextUrl.searchParams.get('tip') || body.tip || 'obtinere'
  const format = req.nextUrl.searchParams.get('format') || body.format || 'docx'
  const isPrelungire = tip === 'prelungire'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: session } = await supabase
    .from('sessions')
    .select('*, locations(*), boats(*), evaluators(*), instructors(*)')
    .eq('id', session_id)
    .single()

  const { data: students } = await supabase
    .from('students')
    .select('*')
    .eq('session_id', session_id)
    .eq('only_sailing', false)
    .order('order_in_session')

  if (!session || !students) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Antetul Radio
  const { data: antetDoc } = await supabase
    .from('setsail_documents')
    .select('file_data')
    .eq('tip', 'antet_radio')
    .single()

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateStr = session.session_date.replace(/-/g, '_')
  const tipLabel = isPrelungire
    ? 'PRELUNGIRII VALABILITĂȚII'
    : 'OBȚINERII'

  // PDF format
  if (format === 'pdf') {
    const antetHtml = antetDoc?.file_data
      ? `<div style="text-align:center;margin-bottom:20px;"><img src="${antetDoc.file_data}" style="max-width:100%;height:auto;max-height:80px;"/></div>`
      : '<div style="text-align:center;font-weight:bold;font-size:14pt;margin-bottom:20px;">S.C. SET SAIL ADVERTISING S.R.L.</div>'

    const pvTitle = isPrelungire
      ? 'PROCES VERBAL EXAMEN DE EVALUARE<br>ÎN VEDEREA PRELUNGIRII VALABILITĂȚII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'
      : 'PROCES VERBAL DE EXAMEN<br>ÎN VEDEREA OBȚINERII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'

    const tableHeader = isPrelungire
      ? `<tr style="background:#e9d5ff">
          <th style="border:1px solid #000;padding:6px;width:5%">Nr.<br>crt.</th>
          <th style="border:1px solid #000;padding:6px;width:35%">Numele și prenumele</th>
          <th style="border:1px solid #000;padding:6px;width:40%">Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:20%">Rezultat examen de evaluare</th>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px;font-size:9pt"></td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt"></td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">Se va completa: nr. răspunsuri corecte / 20 de întrebări</td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">În funcție de rezultat se va completa: Admis sau Respins</td>
        </tr>`
      : `<tr style="background:#e9d5ff">
          <th style="border:1px solid #000;padding:6px;width:5%">Nr.<br>crt.</th>
          <th style="border:1px solid #000;padding:6px;width:25%">Numele și prenumele</th>
          <th style="border:1px solid #000;padding:6px;width:25%">Cunoștințe generale GMDSS, regulamente (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:20%">Limba engleză – frazeologie standard (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:15%">Simulare trafic GMDSS și exerciții SAR (practic)</th>
          <th style="border:1px solid #000;padding:6px;width:10%">Rezultat</th>
        </tr>
        <tr>
          <td style="border:1px solid #000;padding:4px;font-size:9pt"></td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt"></td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">nr. răsp. corecte / 20 întrebări</td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">nr. răsp. corecte / 5 întrebări</td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">Notare 1-10</td>
          <td style="border:1px solid #000;padding:4px;font-size:9pt">Admis / Respins</td>
        </tr>`

    const minRows = Math.max(students.length, 8)
    const dataRows = Array.from({length: minRows}, (_, i) => {
      const s = students[i]
      if (isPrelungire) {
        return `<tr>
          <td style="border:1px solid #000;padding:6px;text-align:center">${s ? i+1 : ''}</td>
          <td style="border:1px solid #000;padding:6px">${s?.full_name || ''}</td>
          <td style="border:1px solid #000;padding:6px"></td>
          <td style="border:1px solid #000;padding:6px"></td>
        </tr>`
      } else {
        return `<tr>
          <td style="border:1px solid #000;padding:6px;text-align:center">${s ? i+1 : ''}</td>
          <td style="border:1px solid #000;padding:6px">${s?.full_name || ''}</td>
          <td style="border:1px solid #000;padding:6px"></td>
          <td style="border:1px solid #000;padding:6px"></td>
          <td style="border:1px solid #000;padding:6px"></td>
          <td style="border:1px solid #000;padding:6px"></td>
        </tr>`
      }
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { size: A4 landscape; margin: 15mm; }
  @media print { html,body { background:white!important; padding:0!important; } body { box-shadow:none!important; margin:0!important; padding:0!important; width:auto!important; } }
  html { background:#e0e0e0; padding:20px; }
  body { font-family:Arial,sans-serif; font-size:10pt; background:#fff; width:267mm; margin:0 auto; padding:15mm; box-shadow:0 0 20px rgba(0,0,0,0.3); }
  h2 { text-align:center; font-size:11pt; margin:10px 0; }
  table { width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt; }
  th { font-weight:bold; text-align:center; vertical-align:middle; }
</style>
</head><body>
${antetHtml}
<p style="text-align:right;font-size:9pt">Nr. ................. din .................................</p>
<h2>${pvTitle}</h2>
<p style="text-align:center;font-size:10pt"><strong>Nr. ...... din ...........</strong></p>
<p style="font-size:9pt">Data examinării: <strong>${sessionDate}</strong> &nbsp;&nbsp; Locația: <strong>${session.locations?.name || ''}</strong></p>
<table>${tableHeader}${dataRows}</table>
<div style="margin-top:20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
  <div><strong>Președinte comisie:</strong><br><br>...........................................</div>
  <div><strong>Membrii:</strong><br><br>...........................................................<br><br>...........................................................</div>
</div>
<p style="font-size:8pt;margin-top:15px;font-style:italic">Procesul verbal se va completa în conformitate cu decizia 543/2017-Art. 16${isPrelungire ? ', alin. (1) lit. a)' : ''}.</p>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // DOCX format
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun,
    convertMillimetersToTwip
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellM = { top: 60, bottom: 60, left: 80, right: 80 }
  const shade = { fill: 'E9D5FF', type: ShadingType.CLEAR }

  const bold = (t: string, size = 18) => new TextRun({ text: t, bold: true, size, font: 'Arial' })
  const reg = (t: string, size = 17) => new TextRun({ text: t, size, font: 'Arial' })
  const para = (ch: any[], align = AlignmentType.LEFT, sp = 60) =>
    new Paragraph({ alignment: align, spacing: { before: sp, after: sp }, children: ch })

  const cell = (ch: any[], opts?: any) => new TableCell({
    borders: opts?.borders ?? borders,
    width: opts?.w ? { size: opts.w, type: WidthType.DXA } : undefined,
    columnSpan: opts?.span,
    shading: opts?.shade,
    margins: cellM,
    children: ch,
    verticalAlign: 'center' as any,
  })

  // Antet imagine
  let headerImg: any[] = []
  if (antetDoc?.file_data) {
    try {
      const base64 = antetDoc.file_data.includes(',') ? antetDoc.file_data.split(',')[1] : antetDoc.file_data
      const buf = Buffer.from(base64, 'base64')
      const mt = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
      headerImg = [new Paragraph({
        spacing: { after: 100 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 940, height: 80 } })]
      })]
    } catch(e) { console.error(e) }
  }

  // Titlu
  const titleText = isPrelungire
    ? 'PROCES VERBAL EXAMEN DE EVALUARE\nÎN VEDEREA PRELUNGIRII VALABILITĂȚII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'
    : 'PROCES VERBAL DE EXAMEN\nÎN VEDEREA OBȚINERII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'

  const titleParagraphs = titleText.split('\n').map(line =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [bold(line, 20)] })
  )

  // Total content width landscape A4 = 297mm - 30mm margins = 267mm = ~15189 DXA
  const TW = 15189

  // Tabel cursanti
  const minRows = Math.max(students.length, 8)

  let headerRow: any, subHeaderRow: any
  let colWidths: number[]

  if (isPrelungire) {
    // 4 coloane
    colWidths = [500, 4000, 7000, 3689]
    headerRow = new TableRow({ tableHeader: true, children: [
      cell([para([bold('Nr.\ncrt.', 16)])], { w: colWidths[0], shade }),
      cell([para([bold('Numele și prenumele', 16)])], { w: colWidths[1], shade }),
      cell([para([bold('Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)', 16)])], { w: colWidths[2], shade }),
      cell([para([bold('Rezultat examen de evaluare', 16)])], { w: colWidths[3], shade }),
    ]})
    subHeaderRow = new TableRow({ children: [
      cell([para([reg('')])], { w: colWidths[0] }),
      cell([para([reg('')])], { w: colWidths[1] }),
      cell([para([reg('Se va completa: nr. răspunsuri corecte / 20 de întrebări', 15)])], { w: colWidths[2] }),
      cell([para([reg('În funcție de rezultat se va completa: Admis sau Respins', 15)])], { w: colWidths[3] }),
    ]})
  } else {
    // 6 coloane
    colWidths = [500, 3200, 3800, 2400, 2800, 2489]
    headerRow = new TableRow({ tableHeader: true, children: [
      cell([para([bold('Nr.\ncrt.', 15)])], { w: colWidths[0], shade }),
      cell([para([bold('Numele și prenumele', 15)])], { w: colWidths[1], shade }),
      cell([para([bold('Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)', 15)])], { w: colWidths[2], shade }),
      cell([para([bold('Limba engleză – frazeologie standard (scris)', 15)])], { w: colWidths[3], shade }),
      cell([para([bold('Simulare trafic GMDSS și exerciții de căutare și salvare SAR (proba practică)', 15)])], { w: colWidths[4], shade }),
      cell([para([bold('Rezultat examen de evaluare', 15)])], { w: colWidths[5], shade }),
    ]})
    subHeaderRow = new TableRow({ children: [
      cell([para([reg('')])], { w: colWidths[0] }),
      cell([para([reg('')])], { w: colWidths[1] }),
      cell([para([reg('Se va completa: nr. răspunsuri corecte / 20 de întrebări', 15)])], { w: colWidths[2] }),
      cell([para([reg('Se va completa: nr. răspunsuri corecte / 5 întrebări', 15)])], { w: colWidths[3] }),
      cell([para([reg('Notare de la 1 la 10', 15)])], { w: colWidths[4] }),
      cell([para([reg('În funcție de rezultat se va completa: Admis sau Respins', 15)])], { w: colWidths[5] }),
    ]})
  }

  const dataRows = Array.from({ length: minRows }, (_, i) => {
    const s = students[i]
    if (isPrelungire) {
      return new TableRow({ children: [
        cell([para([reg(s ? String(i+1) : '', 16)])], { w: colWidths[0] }),
        cell([para([reg(s?.full_name || '', 16)])], { w: colWidths[1] }),
        cell([para([reg('')])], { w: colWidths[2] }),
        cell([para([reg('')])], { w: colWidths[3] }),
      ]})
    } else {
      return new TableRow({ children: [
        cell([para([reg(s ? String(i+1) : '', 16)])], { w: colWidths[0] }),
        cell([para([reg(s?.full_name || '', 16)])], { w: colWidths[1] }),
        cell([para([reg('')])], { w: colWidths[2] }),
        cell([para([reg('')])], { w: colWidths[3] }),
        cell([para([reg('')])], { w: colWidths[4] }),
        cell([para([reg('')])], { w: colWidths[5] }),
      ]})
    }
  })

  const studentsTable = new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, subHeaderRow, ...dataRows],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 16838, height: 11906, orientation: 'landscape' as any },
          margin: {
            top: convertMillimetersToTwip(15),
            right: convertMillimetersToTwip(15),
            bottom: convertMillimetersToTwip(15),
            left: convertMillimetersToTwip(15),
          }
        }
      },
      children: [
        ...headerImg,
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 120 }, children: [reg('Nr. ................. din .................................', 17)] }),
        ...titleParagraphs,
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [bold('Nr. ...... din ...........', 18)] }),
        new Paragraph({ spacing: { before: 0, after: 120 }, children: [bold('Data examinării: ', 17), reg(sessionDate, 17), reg('    Locația: ', 17), bold(session.locations?.name || '', 17)] }),
        studentsTable,
        new Paragraph({ spacing: { before: 240, after: 60 }, children: [] }),
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [TW/2, TW/2],
          rows: [
            new TableRow({ children: [
              cell([para([bold('Președinte comisie:', 17)]), para([reg('')]), para([reg('...............................................')])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'fff'}, bottom:{style:BorderStyle.NONE,size:0,color:'fff'}, left:{style:BorderStyle.NONE,size:0,color:'fff'}, right:{style:BorderStyle.NONE,size:0,color:'fff'}}, w: TW/2 }),
              cell([para([bold('Membrii:', 17)]), para([reg('')]), para([reg('...............................................')]), para([reg('')]), para([reg('...............................................')])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'fff'}, bottom:{style:BorderStyle.NONE,size:0,color:'fff'}, left:{style:BorderStyle.NONE,size:0,color:'fff'}, right:{style:BorderStyle.NONE,size:0,color:'fff'}}, w: TW/2 }),
            ]})
          ]
        }),
        new Paragraph({ spacing: { before: 200, after: 60 }, children: [new TextRun({ text: `Mențiune: Procesul verbal se va completa în conformitate cu decizia 543/2017-Art. 16${isPrelungire ? ', alin. (1) lit. a)' : ''}.`, italics: true, size: 16, font: 'Arial' })] }),
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = isPrelungire
    ? `PV_LRC_PRELUNGIRE_${dateStr}.docx`
    : `PV_LRC_OBTINERE_${dateStr}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}