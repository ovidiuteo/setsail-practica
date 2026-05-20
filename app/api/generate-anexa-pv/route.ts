import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { session_id } = await req.json()
  const tip = req.nextUrl.searchParams.get('tip') || 'obtinere'
  const format = req.nextUrl.searchParams.get('format') || 'docx'
  const isPrelungire = tip === 'prelungire'

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: session } = await supabase
    .from('sessions')
    .select('*, locations(*), evaluators(*), instructors(*)')
    .eq('id', session_id)
    .single()

  const { data: allStudents } = await supabase
    .from('students')
    .select('*')
    .eq('session_id', session_id)
    .eq('only_sailing', false)
    .order('order_in_session')

  if (!session || !allStudents) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Filtrăm cursanții după tipul examenului (Obținere / Prelungire)
  // și sortăm alfabetic, identic cu tabelul admin
  const students = allStudents
    .filter((s: any) => isPrelungire
      ? s.obtinere_prelungire === 'prelungire'
      : s.obtinere_prelungire !== 'prelungire')
    .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || '', 'ro'))

  const { data: antetDoc } = await supabase
    .from('setsail_documents')
    .select('file_data')
    .eq('tip', 'antet_radio')
    .single()

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateStr = session.session_date.replace(/-/g, '_')

  const pvTitlu = isPrelungire
    ? 'Anexă la proces verbal de examen de evaluare nr. ............... din...........'
    : 'Anexă la proces verbal de examen nr. ............... din...........'
  const scopTitlu = isPrelungire
    ? 'În vederea prelungirii valabilității certificatului general de operator pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit, GMDSS-LRC'
    : 'În vederea obținerii certificatului general de operator pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit, GMDSS-LRC'

  if (format === 'pdf') {
    const antetHtml = antetDoc?.file_data
      ? `<div style="text-align:center;margin-bottom:16px;"><img src="${antetDoc.file_data}" style="max-width:100%;height:auto;max-height:80px;"/></div>`
      : '<div style="text-align:center;font-weight:bold;font-size:13pt;margin-bottom:16px;">S.C. SET SAIL ADVERTISING S.R.L.</div>'

    const minRows = Math.max(students.length, 8)
    const dataRows = Array.from({ length: minRows }, (_, i) => {
      const s = students[i]
      const bd = s?.birth_date ? new Date(s.birth_date).toLocaleDateString('ro-RO') : ''
      // În modelul SetSail: primul cuvânt din full_name = NUME, restul = PRENUME
      const parts = (s?.full_name || '').split(/\s+/).filter(Boolean)
      const nume = parts[0] || ''
      const prenume = parts.length > 1 ? parts.slice(1).join(' ') : ''
      return `<tr>
        <td style="border:1px solid #000;padding:5px;text-align:center">${s ? i+1 : ''}</td>
        <td style="border:1px solid #000;padding:5px">${nume}</td>
        <td style="border:1px solid #000;padding:5px">${prenume}</td>
        <td style="border:1px solid #000;padding:5px">${bd}</td>
        <td style="border:1px solid #000;padding:5px">${s?.cnp || ''}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 15mm; }
  @media print { html,body{background:white!important;padding:0!important;} body{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;} }
  html { background:#e0e0e0; padding:20px; }
  body { font-family:Arial,sans-serif; font-size:10pt; background:#fff; width:180mm; margin:0 auto; padding:15mm; box-shadow:0 0 20px rgba(0,0,0,0.3); }
  table { width:100%; border-collapse:collapse; margin:12px 0; font-size:10pt; }
  th { background:#e9d5ff; font-weight:bold; text-align:center; padding:6px; border:1px solid #000; }
</style>
</head><body>
${antetHtml}
<p style="text-align:right;font-size:9pt"><strong>Nr. ................. din .................................</strong><br><span style="font-size:8pt">(nr. identic cu nr. de ieșire al pv)</span></p>
<p style="text-align:center;font-size:11pt"><strong>${pvTitlu}</strong></p>
<p style="text-align:center;font-size:10pt">${scopTitlu}</p>
<table>
  <tr>
    <th style="width:5%">Nr.<br>crt.</th>
    <th style="width:30%">NUME</th>
    <th style="width:25%">PRENUME</th>
    <th style="width:20%">DATA NAȘTERII</th>
    <th style="width:20%">CNP</th>
  </tr>
  ${dataRows}
</table>
<div style="margin-top:24px;display:grid;grid-template-columns:1fr 1fr;gap:20px;">
  <div><strong>Președinte comisie:</strong><br><br>...........................................</div>
  <div><strong>Membrii:</strong><br><br>...........................................................<br><br>...........................................................</div>
</div>
<p style="margin-top:24px;font-size:9pt;font-style:italic">Întocmit: …………………………….</p>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // DOCX
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun,
    convertMillimetersToTwip
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
  const cellM = { top: 60, bottom: 60, left: 80, right: 80 }
  const shade = { fill: 'E9D5FF', type: ShadingType.CLEAR }

  const bold = (t: string, sz = 18) => new TextRun({ text: t, bold: true, size: sz, font: 'Arial' })
  const reg = (t: string, sz = 17) => new TextRun({ text: t, size: sz, font: 'Arial' })
  const ital = (t: string, sz = 16) => new TextRun({ text: t, italics: true, size: sz, font: 'Arial' })
  const para = (ch: any[], align = AlignmentType.LEFT, sp = 60) =>
    new Paragraph({ alignment: align, spacing: { before: sp, after: sp }, children: ch })
  const cell = (ch: any[], opts?: any) => new TableCell({
    borders: opts?.b ?? borders,
    width: opts?.w ? { size: opts.w, type: WidthType.DXA } : undefined,
    columnSpan: opts?.span,
    shading: opts?.shade,
    margins: cellM,
    children: ch,
    verticalAlign: 'center' as any,
  })

  // Antet
  let headerImg: any[] = []
  if (antetDoc?.file_data) {
    try {
      const base64 = antetDoc.file_data.includes(',') ? antetDoc.file_data.split(',')[1] : antetDoc.file_data
      const buf = Buffer.from(base64, 'base64')
      const mt = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
      headerImg = [new Paragraph({
        spacing: { after: 100 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 700, height: 75 } })]
      })]
    } catch(e) { console.error(e) }
  }

  // A4 portrait: 210mm - 30mm = 180mm = ~10206 DXA
  const TW = 10206
  const colWidths = [500, 2800, 2200, 2000, 2706]

  const minRows = Math.max(students.length, 8)
  const dataRows = Array.from({ length: minRows }, (_, i) => {
    const s = students[i]
    const bd = s?.birth_date ? new Date(s.birth_date).toLocaleDateString('ro-RO') : ''
    const parts = (s?.full_name || '').split(/\s+/).filter(Boolean)
    const nume = parts[0] || ''
    const prenume = parts.length > 1 ? parts.slice(1).join(' ') : ''
    return new TableRow({ children: [
      cell([para([reg(s ? String(i+1) : '')])], { w: colWidths[0] }),
      cell([para([reg(nume)])], { w: colWidths[1] }),
      cell([para([reg(prenume)])], { w: colWidths[2] }),
      cell([para([reg(bd)])], { w: colWidths[3] }),
      cell([para([reg(s?.cnp || '')])], { w: colWidths[4] }),
    ]})
  })

  const headerRow = new TableRow({ tableHeader: true, children: [
    cell([para([bold('Nr. Crt', 16)])], { w: colWidths[0], shade }),
    cell([para([bold('NUME', 16)])], { w: colWidths[1], shade }),
    cell([para([bold('PRENUME', 16)])], { w: colWidths[2], shade }),
    cell([para([bold('DATA NAȘTERII', 16)])], { w: colWidths[3], shade }),
    cell([para([bold('CNP', 16)])], { w: colWidths[4], shade }),
  ]})

  const doc = new Document({
    sections: [{
      properties: {
        page: {
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
        // Nr. + nota (nr identic cu nr PV)
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [TW/2, TW/2],
          rows: [new TableRow({ children: [
            cell([para([reg('')])], { b: noBorders, w: TW/2 }),
            cell([
              para([bold('Nr. ................. din .................................', 17)], AlignmentType.RIGHT as any),
              para([ital('(nr. identic cu nr. de ieșire al pv)', 15)], AlignmentType.RIGHT as any),
            ], { b: noBorders, w: TW/2 }),
          ]})]
        }),
        new Paragraph({ spacing: { before: 120, after: 60 }, alignment: AlignmentType.CENTER, children: [bold(pvTitlu, 19)] }),
        new Paragraph({ spacing: { before: 60, after: 200 }, alignment: AlignmentType.CENTER, children: [bold(scopTitlu, 17)] }),
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: [headerRow, ...dataRows],
        }),
        new Paragraph({ spacing: { before: 300, after: 60 }, children: [] }),
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [TW/2, TW/2],
          rows: [new TableRow({ children: [
            cell([para([bold('Președinte comisie:', 17)]), para([reg('')]), para([reg('...............................................')])], { b: noBorders, w: TW/2 }),
            cell([para([bold('Membrii:', 17)]), para([reg('')]), para([reg('...............................................')]), para([reg('')]), para([reg('...............................................')])], { b: noBorders, w: TW/2 }),
          ]})]
        }),
        new Paragraph({ spacing: { before: 300, after: 60 }, children: [ital('Întocmit: ………………………………….', 16)] }),
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = isPrelungire
    ? `Anexa_PV_LRC_PRELUNGIRE_${dateStr}.docx`
    : `Anexa_PV_LRC_OBTINERE_${dateStr}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
