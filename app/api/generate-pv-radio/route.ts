import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'

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
  // Sortăm alfabetic ca în tabelul admin
  const students = allStudents
    .filter((s: any) => {
      const c = String(s.class_caa || '').toLowerCase().trim()
      return isPrelungire
        ? c.includes('prelungire')
        : (c.includes('obtinere') || c.includes('obținere') || c === 'radio')
    })
    .sort((a: any, b: any) => (a.full_name || '').localeCompare(b.full_name || '', 'ro'))

  // Aducem scorurile examenului radio (dacă există)
  const { data: examRow } = await supabase
    .from('radio_exams')
    .select('id')
    .eq('session_id', session_id)
    .maybeSingle()

  const answerByStudent: Record<string, any> = {}
  if (examRow?.id) {
    const { data: ans } = await supabase
      .from('radio_exam_answers')
      .select('student_id, grila_score, translation_score, simulator_score, status')
      .eq('exam_id', examRow.id)
    for (const a of (ans || [])) {
      answerByStudent[a.student_id] = a
    }
  }

  function getScores(s: any) {
    const a = answerByStudent[s?.id]
    if (!a) return { grila: '', trad: '', sim: '', result: '' }
    const grila = typeof a.grila_score === 'number' ? `${a.grila_score} / 20` : ''
    const trad = (typeof a.translation_score === 'number' && a.translation_score > 0) ? `${a.translation_score}/5` : ''
    const sim = (typeof a.simulator_score === 'number' && a.simulator_score !== null) ? String(a.simulator_score) : ''
    // Admis dacă cursantul a submis examenul (status nu mai e 'in_progress')
    const result = a.status && a.status !== 'in_progress' ? 'Admis' : ''
    return { grila, trad, sim, result }
  }

  // Antetul Radio
  const { data: antetDoc } = await supabase
    .from('setsail_documents')
    .select('file_data')
    .eq('tip', 'antet_radio')
    .single()

  const dateStr = session.session_date.replace(/-/g, '_')
  // Titlu doc (eticheta tab + nume default la print → PDF)
  const MONTHS_RO = ['ianuarie','februarie','martie','aprilie','mai','iunie','iulie','august','septembrie','octombrie','noiembrie','decembrie']
  const [, mm, dd] = session.session_date.split('-')
  const dayMonth = `${parseInt(dd)} ${MONTHS_RO[parseInt(mm) - 1] || ''}`.trim()
  const docTitle = `pv ${isPrelungire ? 'prelungire' : 'obtinere'} LRC ${dayMonth} SetSail`
  const tipLabel = isPrelungire
    ? 'PRELUNGIRII VALABILITĂȚII'
    : 'OBȚINERII'

  // === Numere (document + ieșire) + comisie + ștampilă ===
  const docTip = isPrelungire ? 'pv-prelungire' : 'pv-obtinere'
  const { data: nrRows } = await supabase.from('notification_numbers')
    .select('numar, data_notificare, tip')
    .eq('session_id', session_id).eq('document_tip', docTip)
    .in('tip', ['pv_ancom', 'nr_iesire_ancom'])
  const fmtNrDate = (d: string | null | undefined) => d ? d.split('-').reverse().join('.') : '...............'
  const docNrRow = (nrRows || []).find((r: any) => r.tip === 'pv_ancom')
  const iesNrRow = (nrRows || []).find((r: any) => r.tip === 'nr_iesire_ancom')
  const docNrTxt = docNrRow ? String(docNrRow.numar) : '..........'
  const docNrDate = fmtNrDate(docNrRow?.data_notificare)
  const iesNrTxt = iesNrRow ? String(iesNrRow.numar) : '..........'
  const iesNrDate = fmtNrDate(iesNrRow?.data_notificare)

  // Comisia = instructorii sesiunii: Instructor 1 = președinte, Instructor 2 & 3 = membri.
  // Fiecare are semnătura proprie (signature_data) afișată lângă nume.
  type ComisiePers = { full_name: string; signature_data: string | null }
  const instrIds = [session.instructor_id, (session as any).instructor_id_2, (session as any).instructor_id_3].filter(Boolean) as string[]
  let comisie: ComisiePers[] = []
  if (instrIds.length) {
    const { data: instrs } = await supabase.from('instructors').select('id, full_name, signature_data').in('id', instrIds)
    comisie = instrIds
      .map(id => (instrs || []).find((i: any) => i.id === id))
      .filter(Boolean)
      .map((i: any) => ({ full_name: i.full_name, signature_data: i.signature_data || null }))
  }
  const presedinte: ComisiePers | null = comisie[0] || null
  const membri: ComisiePers[] = comisie.slice(1)   // Instructor 2 (+3); dacă nu există 3 → un singur membru

  // Ștampila SetSail (FĂRĂ semnătură), originală (fără normalizare), lângă numele președintelui
  const { data: stampilaDoc } = await supabase.from('setsail_documents')
    .select('file_data').eq('tip', 'stampila_fara_semnatura').maybeSingle()
  const stampilaData: string | null = stampilaDoc?.file_data || null

  // PDF format
  if (format === 'pdf') {
    const antetHtml = antetDoc?.file_data
      ? `<div style="margin-bottom:20px;"><img src="${antetDoc.file_data}" style="width:100%;height:auto;display:block;"/></div>`
      : '<div style="text-align:center;font-weight:bold;font-size:14pt;margin-bottom:20px;">S.C. SET SAIL ADVERTISING S.R.L.</div>'

    const pvTitle = isPrelungire
      ? 'PROCES VERBAL EXAMEN DE EVALUARE<br>ÎN VEDEREA PRELUNGIRII VALABILITĂȚII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'
      : 'PROCES VERBAL DE EXAMEN<br>ÎN VEDEREA OBȚINERII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'

    const tableHeader = isPrelungire
      ? `<tr class="pvhead" style="background:#e9d5ff">
          <th style="border:1px solid #000;padding:6px;width:5%">Nr.<br>crt.</th>
          <th style="border:1px solid #000;padding:6px;width:35%">Numele și prenumele</th>
          <th style="border:1px solid #000;padding:6px;width:40%">Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:20%">Rezultat examen de evaluare</th>
        </tr>`
      : `<tr class="pvhead" style="background:#e9d5ff">
          <th style="border:1px solid #000;padding:6px;width:5%">Nr.<br>crt.</th>
          <th style="border:1px solid #000;padding:6px;width:25%">Numele și prenumele</th>
          <th style="border:1px solid #000;padding:6px;width:25%">Cunoștințe generale GMDSS, regulamente (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:20%">Limba engleză – frazeologie standard (scris)</th>
          <th style="border:1px solid #000;padding:6px;width:15%">Simulare trafic GMDSS și exerciții SAR (practic)</th>
          <th style="border:1px solid #000;padding:6px;width:10%">Rezultat</th>
        </tr>`

    const minRows = Math.max(students.length, 8)
    const dataRows = Array.from({length: minRows}, (_, i) => {
      const s = students[i]
      const sc = s ? getScores(s) : { grila: '', trad: '', sim: '', result: '' }
      if (isPrelungire) {
        return `<tr>
          <td style="border:1px solid #000;padding:6px;text-align:center">${s ? i+1 : ''}</td>
          <td style="border:1px solid #000;padding:6px">${s?.full_name || ''}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.grila}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.result}</td>
        </tr>`
      } else {
        return `<tr>
          <td style="border:1px solid #000;padding:6px;text-align:center">${s ? i+1 : ''}</td>
          <td style="border:1px solid #000;padding:6px">${s?.full_name || ''}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.grila}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.trad}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.sim}</td>
          <td style="border:1px solid #000;padding:6px;text-align:center">${sc.result}</td>
        </tr>`
      }
    }).join('')

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  @media print { html,body { background:white!important; padding:0!important; } body { box-shadow:none!important; margin:0!important; padding:0!important; width:auto!important; } }
  html { background:#e0e0e0; padding:20px; }
  body { font-family:Arial,sans-serif; font-size:10pt; background:#fff; width:180mm; margin:0 auto; padding:15mm; box-shadow:0 0 20px rgba(0,0,0,0.3); }
  h2 { text-align:center; font-size:11pt; margin:10px 0; }
  table { width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt; }
  th { font-weight:bold; text-align:center; vertical-align:middle; }
</style>
</head><body>
${antetHtml}
<p style="text-align:right;font-size:9pt">Nr. ieșire: <strong>${iesNrTxt}</strong> din <strong>${iesNrDate}</strong></p>
<h2>${pvTitle}</h2>
<p style="text-align:center;font-size:10pt"><strong>Nr. ${docNrTxt} din ${docNrDate}</strong></p>
<table>${tableHeader}${dataRows}</table>
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
<p style="font-size:8pt;margin-top:15px;font-style:italic">Procesul verbal se va completa în conformitate cu decizia 543/2017-Art. 16${isPrelungire ? ', alin. (1) lit. a)' : ''}.</p>
</body></html>`

    return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  // DOCX format
  try {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun, VerticalAlign,
    convertMillimetersToTwip
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellM = { top: 60, bottom: 60, left: 80, right: 80 }
  const shade = { fill: 'E9D5FF', type: ShadingType.SOLID }

  const bold = (t: string, size = 18) => new TextRun({ text: t, bold: true, size, font: 'Arial' })
  const reg = (t: string, size = 17) => new TextRun({ text: t, size, font: 'Arial' })
  const para = (ch: any[], align: any = AlignmentType.LEFT, sp = 60) =>
    new Paragraph({ alignment: align, spacing: { before: sp, after: sp }, children: ch })

  const cell = (ch: any[], opts?: any) => new TableCell({
    borders: opts?.borders ?? borders,
    width: opts?.w ? { size: opts.w, type: WidthType.DXA } : undefined,
    columnSpan: opts?.span,
    shading: opts?.shade,
    margins: cellM,
    children: ch,
    verticalAlign: VerticalAlign.CENTER,
  })

  // Antet imagine
  let headerImg: any[] = []
  if (antetDoc?.file_data) {
    try {
      const base64 = antetDoc.file_data.includes(',') ? antetDoc.file_data.split(',')[1] : antetDoc.file_data
      const buf = Buffer.from(base64, 'base64')
      const mt = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
      // Lățime = lățimea conținutului (180mm ≈ 680px), înălțime proporțională
      const meta = await sharp(buf).metadata()
      const W = 680
      const H = (meta.width && meta.height) ? Math.round(W * meta.height / meta.width) : 70
      headerImg = [new Paragraph({
        spacing: { after: 100 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: W, height: H } })]
      })]
    } catch(e) { console.error(e) }
  }

  // Ștampila SetSail (cu semnătură) — pt. lângă președintele comisiei
  let stampImg: any[] = []
  if (stampilaData) {
    try {
      const base64 = stampilaData.includes(',') ? stampilaData.split(',')[1] : stampilaData
      const buf = Buffer.from(base64, 'base64')
      const mt = stampilaData.includes('png') ? 'png' : 'jpg'
      stampImg = [new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { before: 40 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 150, height: 95 } })]
      })]
    } catch(e) { console.error(e) }
  }

  // Paragraf cu semnătura unei persoane (din data URL) — pt. comisie
  const sigPara = (dataUrl: string | null): any[] => {
    if (!dataUrl) return []
    try {
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      const buf = Buffer.from(base64, 'base64')
      const mt = dataUrl.includes('png') ? 'png' : 'jpg'
      return [new Paragraph({ spacing: { before: 20, after: 0 }, children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 120, height: 50 } })] })]
    } catch { return [] }
  }

  // Titlu
  const titleText = isPrelungire
    ? 'PROCES VERBAL EXAMEN DE EVALUARE\nÎN VEDEREA PRELUNGIRII VALABILITĂȚII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'
    : 'PROCES VERBAL DE EXAMEN\nÎN VEDEREA OBȚINERII CERTIFICATULUI GENERAL DE OPERATOR PENTRU AMBARCAȚIUNI DE AGREMENT ÎN SERVICIILE MOBIL MARITIM ȘI MOBIL MARITIM PRIN SATELIT, GMDSS-LRC'

  const titleParagraphs = titleText.split('\n').map(line =>
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 80 }, children: [bold(line, 20)] })
  )

  // Total content width portrait A4 = 210mm - 30mm margins = 180mm = ~10206 DXA
  const TW = 10206

  // Tabel cursanti
  const minRows = Math.max(students.length, 8)

  let headerRow: any
  let colWidths: number[]

  if (isPrelungire) {
    // 4 coloane (proporțional pe lățimea portrait)
    colWidths = [340, 2686, 4700, 2480]
    headerRow = new TableRow({ tableHeader: true, children: [
      cell([para([bold('Nr.\ncrt.', 16)], AlignmentType.CENTER)], { w: colWidths[0], shade }),
      cell([para([bold('Numele și prenumele', 16)], AlignmentType.CENTER)], { w: colWidths[1], shade }),
      cell([para([bold('Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)', 16)], AlignmentType.CENTER)], { w: colWidths[2], shade }),
      cell([para([bold('Rezultat examen de evaluare', 16)], AlignmentType.CENTER)], { w: colWidths[3], shade }),
    ]})
  } else {
    // 6 coloane (proporțional pe lățimea portrait)
    colWidths = [340, 2150, 2556, 1610, 1880, 1670]
    headerRow = new TableRow({ tableHeader: true, children: [
      cell([para([bold('Nr.\ncrt.', 15)], AlignmentType.CENTER)], { w: colWidths[0], shade }),
      cell([para([bold('Numele și prenumele', 15)], AlignmentType.CENTER)], { w: colWidths[1], shade }),
      cell([para([bold('Cunoștințe generale despre sistemul GMDSS, regulamente interne și internaționale de radiocomunicații (scris)', 15)], AlignmentType.CENTER)], { w: colWidths[2], shade }),
      cell([para([bold('Limba engleză – frazeologie standard (scris)', 15)], AlignmentType.CENTER)], { w: colWidths[3], shade }),
      cell([para([bold('Simulare trafic GMDSS și exerciții de căutare și salvare SAR (proba practică)', 15)], AlignmentType.CENTER)], { w: colWidths[4], shade }),
      cell([para([bold('Rezultat examen de evaluare', 15)], AlignmentType.CENTER)], { w: colWidths[5], shade }),
    ]})
  }

  const dataRows = Array.from({ length: minRows }, (_, i) => {
    const s = students[i]
    const sc = s ? getScores(s) : { grila: '', trad: '', sim: '', result: '' }
    const centered = (txt: string) => new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 60, after: 60 },
      children: [reg(txt, 16)],
    })
    if (isPrelungire) {
      return new TableRow({ children: [
        cell([centered(s ? String(i+1) : '')], { w: colWidths[0] }),
        cell([para([reg(s?.full_name || '', 16)])], { w: colWidths[1] }),
        cell([centered(sc.grila)], { w: colWidths[2] }),
        cell([centered(sc.result)], { w: colWidths[3] }),
      ]})
    } else {
      return new TableRow({ children: [
        cell([centered(s ? String(i+1) : '')], { w: colWidths[0] }),
        cell([para([reg(s?.full_name || '', 16)])], { w: colWidths[1] }),
        cell([centered(sc.grila)], { w: colWidths[2] }),
        cell([centered(sc.trad)], { w: colWidths[3] }),
        cell([centered(sc.sim)], { w: colWidths[4] }),
        cell([centered(sc.result)], { w: colWidths[5] }),
      ]})
    }
  })

  const studentsTable = new Table({
    width: { size: TW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [headerRow, ...dataRows],
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
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
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 120 }, children: [bold('Nr. ieșire: ', 16), reg(iesNrTxt, 16), reg(' din ', 16), reg(iesNrDate, 16)] }),
        ...titleParagraphs,
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [bold(`Nr. ${docNrTxt} din ${docNrDate}`, 18)] }),
        studentsTable,
        new Paragraph({ spacing: { before: 240, after: 60 }, children: [] }),
        new Table({
          width: { size: TW, type: WidthType.DXA },
          columnWidths: [3000, 2200, 1800, 3206],
          rows: [
            new TableRow({ children: [
              cell([para([bold('Președinte comisie:', 17)]), para([bold(presedinte ? presedinte.full_name : '...............................................', 17)]), ...(presedinte ? sigPara(presedinte.signature_data) : [])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, w: 3000 }),
              cell(stampImg.length ? stampImg : [para([reg('')])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, w: 2200 }),
              cell([para([reg('')])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, w: 1800 }),
              cell([para([bold('Membrii:', 17)]), ...(membri.length ? membri.flatMap((m: ComisiePers) => [para([bold(m.full_name, 17)]), ...sigPara(m.signature_data)]) : [para([reg('')]), para([reg('...............................................')])])], { borders: { top: { style: BorderStyle.NONE, size:0,color:'FFFFFF'}, bottom:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, left:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}, right:{style:BorderStyle.NONE,size:0,color:'FFFFFF'}}, w: 3206 }),
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
  } catch (err: any) {
    console.error('PV Radio DOCX error:', err)
    return NextResponse.json({ error: err.message || 'DOCX generation failed' }, { status: 500 })
  }
}
