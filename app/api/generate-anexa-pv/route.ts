import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const session_id = body.session_id
  const tip = req.nextUrl.searchParams.get('tip') || body.tip || 'obtinere'
  const format = req.nextUrl.searchParams.get('format') || body.format || 'docx'
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

  // Filtrăm cursanții după clasa CAA:
  // - Prelungire: doar "Prelungire LRC"
  // - Obținere:   "Obtinere LRC" + "Radio"
  const students = allStudents
    .filter((s: any) => {
      const c = String(s.class_caa || '').toLowerCase().trim()
      return isPrelungire
        ? c.includes('prelungire')
        : (c.includes('obtinere') || c.includes('obținere') || c === 'radio')
    })
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

  // Numere preluate de la PV: documentul (titlu) + ieșire (sus, identic cu PV)
  const docTip = isPrelungire ? 'pv-prelungire' : 'pv-obtinere'
  const { data: nrRows } = await supabase.from('notification_numbers')
    .select('numar, data_notificare, tip')
    .eq('session_id', session_id).eq('document_tip', docTip)
    .in('tip', ['pv_ancom', 'nr_iesire_ancom'])
  const fmtNrDate = (d: string | null | undefined) => d ? d.split('-').reverse().join('.') : '...............'
  const docNrRow = (nrRows || []).find((r: any) => r.tip === 'pv_ancom')
  const iesNrRow = (nrRows || []).find((r: any) => r.tip === 'nr_iesire_ancom')
  const docNrTxt = docNrRow ? String(docNrRow.numar) : '...............'
  const docNrDate = fmtNrDate(docNrRow?.data_notificare)
  const iesNrTxt = iesNrRow ? String(iesNrRow.numar) : '...............'
  const iesNrDate = fmtNrDate(iesNrRow?.data_notificare)

  // Comisia = instructorii sesiunii (Instructor 1 = președinte, 2 & 3 = membri) + semnături
  type ComisiePers = { full_name: string; signature_data: string | null }
  const instrIds = [session.instructor_id, (session as any).instructor_id_2, (session as any).instructor_id_3].filter(Boolean) as string[]
  let comisie: ComisiePers[] = []
  if (instrIds.length) {
    const { data: instrs } = await supabase.from('instructors').select('id, full_name, signature_data').in('id', instrIds)
    comisie = instrIds.map(id => (instrs || []).find((i: any) => i.id === id)).filter(Boolean)
      .map((i: any) => ({ full_name: i.full_name, signature_data: i.signature_data || null }))
  }
  const presedinte: ComisiePers | null = comisie[0] || null
  const membri: ComisiePers[] = comisie.slice(1)

  // Ștampila SetSail (fără semnătură), originală — lângă președinte
  const { data: stampilaDoc } = await supabase.from('setsail_documents')
    .select('file_data').eq('tip', 'stampila_fara_semnatura').maybeSingle()
  const stampilaData: string | null = stampilaDoc?.file_data || null

  // Data examenului (data practicii) — pentru "Întocmit:"
  const examDateRo = fmtNrDate(session.session_date)

  // Formateaza data nasterii robust: birth_date poate fi "dd.mm.yyyy" (din OCR/portal)
  // sau "yyyy-mm-dd" (ISO). new Date("17.02.1983") => Invalid Date, deci parsam manual.
  function formatBirthDate(raw: string | null | undefined): string {
    if (!raw) return ''
    const s = String(raw).trim()
    let m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/)        // dd.mm.yyyy / dd-mm-yyyy
    if (m) return `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3]}`
    m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)                       // yyyy-mm-dd (ISO)
    if (m) return `${m[3].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[1]}`
    const d = new Date(s)
    if (!isNaN(d.getTime())) return d.toLocaleDateString('ro-RO')
    return s   // necunoscut — afișăm valoarea brută, niciodată "Invalid Date"
  }

  const pvTitlu = isPrelungire
    ? `Anexă la proces verbal de examen de evaluare nr. ${docNrTxt} din ${docNrDate}`
    : `Anexă la proces verbal de examen nr. ${docNrTxt} din ${docNrDate}`
  const scopTitlu = isPrelungire
    ? 'În vederea prelungirii valabilității certificatului general de operator pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit, GMDSS-LRC'
    : 'În vederea obținerii certificatului general de operator pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit, GMDSS-LRC'

  if (format === 'pdf') {
    const antetHtml = antetDoc?.file_data
      ? `<div style="margin-bottom:16px;"><img src="${antetDoc.file_data}" style="width:100%;height:auto;display:block;"/></div>`
      : '<div style="text-align:center;font-weight:bold;font-size:13pt;margin-bottom:16px;">S.C. SET SAIL ADVERTISING S.R.L.</div>'

    const minRows = Math.max(students.length, 8)
    const dataRows = Array.from({ length: minRows }, (_, i) => {
      const s = students[i]
      const bd = formatBirthDate(s?.birth_date)
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
<p style="text-align:right;font-size:9pt"><strong>Nr. ${iesNrTxt} din ${iesNrDate}</strong><br><span style="font-size:8pt">(nr. identic cu nr. de ieșire al pv)</span></p>
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
<div style="margin-top:24px;display:grid;grid-template-columns:auto auto 1fr auto;gap:20px;align-items:start;">
  <div>
    <strong>Președinte comisie:</strong><br>
    <span style="display:inline-block;margin-top:6px;font-weight:bold;">${presedinte ? presedinte.full_name : '...........................................'}</span>
    ${presedinte?.signature_data ? `<div style="margin-top:2px;"><img src="${presedinte.signature_data}" style="max-height:55px;max-width:100%;"/></div>` : ''}
  </div>
  <div>
    ${stampilaData ? `<img src="${stampilaData}" style="max-height:110px;max-width:160px;"/>` : ''}
  </div>
  <div></div>
  <div>
    <strong>Membrii:</strong>
    ${membri.length
      ? membri.map(m => `<div style="margin-top:10px;font-weight:bold;">${m.full_name}</div>${m.signature_data ? `<div style="margin-top:2px;"><img src="${m.signature_data}" style="max-height:55px;max-width:100%;"/></div>` : ''}`).join('')
      : '<br><br>...........................................................'}
  </div>
</div>
<p style="margin-top:24px;font-size:9pt;font-style:italic">Întocmit: ${examDateRo}</p>
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
      // Lățime = lățimea conținutului (180mm ≈ 680px), înălțime proporțională
      const meta = await sharp(buf).metadata()
      const W = 680
      const H = (meta.width && meta.height) ? Math.round(W * meta.height / meta.width) : 75
      headerImg = [new Paragraph({
        spacing: { after: 100 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: W, height: H } })]
      })]
    } catch(e) { console.error(e) }
  }

  // Ștampila (lângă președinte, aliniată stânga) — originală
  let stampImg: any[] = []
  if (stampilaData) {
    try {
      const base64 = stampilaData.includes(',') ? stampilaData.split(',')[1] : stampilaData
      const buf = Buffer.from(base64, 'base64')
      const mt = stampilaData.includes('png') ? 'png' : 'jpg'
      stampImg = [new Paragraph({ alignment: AlignmentType.LEFT, spacing: { before: 40 }, children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 150, height: 95 } })] })]
    } catch(e) { console.error(e) }
  }
  // Paragraf cu semnătura unei persoane din comisie
  const sigPara = (dataUrl: string | null): any[] => {
    if (!dataUrl) return []
    try {
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      const buf = Buffer.from(base64, 'base64')
      const mt = dataUrl.includes('png') ? 'png' : 'jpg'
      return [new Paragraph({ spacing: { before: 20, after: 0 }, children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 120, height: 50 } })] })]
    } catch { return [] }
  }

  // A4 portrait: 210mm - 30mm = 180mm = ~10206 DXA
  const TW = 10206
  const colWidths = [500, 2800, 2200, 2000, 2706]

  const minRows = Math.max(students.length, 8)
  const dataRows = Array.from({ length: minRows }, (_, i) => {
    const s = students[i]
    const bd = formatBirthDate(s?.birth_date)
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
              para([bold(`Nr. ${iesNrTxt} din ${iesNrDate}`, 17)], AlignmentType.RIGHT as any),
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
          columnWidths: [3000, 2200, 1800, 3206],
          rows: [new TableRow({ children: [
            cell([para([bold('Președinte comisie:', 17)]), para([bold(presedinte ? presedinte.full_name : '...............................................', 17)]), ...(presedinte ? sigPara(presedinte.signature_data) : [])], { b: noBorders, w: 3000 }),
            cell(stampImg.length ? stampImg : [para([reg('')])], { b: noBorders, w: 2200 }),
            cell([para([reg('')])], { b: noBorders, w: 1800 }),
            cell([para([bold('Membrii:', 17)]), ...(membri.length ? membri.flatMap((m: ComisiePers) => [para([bold(m.full_name, 17)]), ...sigPara(m.signature_data)]) : [para([reg('')]), para([reg('...............................................')])])], { b: noBorders, w: 3206 }),
          ]})]
        }),
        new Paragraph({ spacing: { before: 300, after: 60 }, children: [ital(`Întocmit: ${examDateRo}`, 16)] }),
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
