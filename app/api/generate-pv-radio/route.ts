import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { session_id } = await req.json()

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

  // Antetul Radio din setsail_documents
  const { data: antetDoc } = await supabase
    .from('setsail_documents')
    .select('file_data')
    .eq('tip', 'antet_radio')
    .single()

  const dateStr = session.session_date.replace(/-/g, '_')
  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun,
    PageNumber, Footer, convertMillimetersToTwip
  } = await import('docx')

  // Antet Radio ca imagine
  let headerChildren: any[] = []
  if (antetDoc?.file_data) {
    try {
      const base64 = antetDoc.file_data.includes(',')
        ? antetDoc.file_data.split(',')[1]
        : antetDoc.file_data
      const imgBuffer = Buffer.from(base64, 'base64')
      const mediaType = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
      headerChildren = [
        new Paragraph({
          spacing: { after: 0 },
          children: [
            new ImageRun({
              data: imgBuffer,
              type: mediaType as 'png' | 'jpg',
              transformation: { width: 700, height: 75 },
            })
          ]
        })
      ]
    } catch (e) {
      console.error('Antet radio error:', e)
    }
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
  const cellM = { top: 60, bottom: 60, left: 80, right: 80 }
  const cellMSm = { top: 30, bottom: 30, left: 80, right: 80 }

  const bold = (text: string, size = 18) => new TextRun({ text, bold: true, size, font: 'Arial' })
  const reg = (text: string, size = 18) => new TextRun({ text, size, font: 'Arial' })
  const cell = (children: any[], opts?: { borders?: any; width?: number; margins?: any; span?: number; shade?: any }) =>
    new TableCell({
      borders: opts?.borders ?? borders,
      width: opts?.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      columnSpan: opts?.span,
      shading: opts?.shade,
      margins: opts?.margins ?? cellM,
      children,
    })

  const para = (children: any[], align = AlignmentType.LEFT, spacing = 60) =>
    new Paragraph({ alignment: align, spacing: { before: spacing, after: spacing }, children })

  // Clasele CAA pentru Radio
  const clasaRaw = (session.class_caa || '').toUpperCase()
  const isLRC = clasaRaw.includes('LRC') || clasaRaw.includes('PRELUNGIRE')
  const clasaLabel = clasaRaw.includes('PRELUNGIRE') ? 'Prelungire LRC' : clasaRaw.includes('LRC') ? 'Obținere LRC' : clasaRaw

  const minRows = Math.max(students.length, 10)

  // Titlu document
  const titleRows = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 100 },
      children: [bold('PROCES VERBAL', 24)]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 100 },
      children: [bold('privind desfășurarea examinării practice pentru obținerea', 20)]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 0, after: 200 },
      children: [bold(`Certificatului de Operator Radio — ${clasaLabel}`, 20)]
    }),
  ]

  // Info sesiune
  const infoTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [
        cell([para([bold('Data examinării: '), reg(sessionDate)])], { borders: noBorders }),
        cell([para([bold('Locația: '), reg(session.locations?.name || '')])], { borders: noBorders }),
      ]}),
      new TableRow({ children: [
        cell([para([bold('Instructor: '), reg(session.instructors?.full_name || '')])], { borders: noBorders }),
        cell([para([bold('Evaluator: '), reg(session.evaluators?.full_name || '')])], { borders: noBorders }),
      ]}),
    ]
  })

  // Tabel cursanti
  const colW = [500, 2800, 1400, 1400, 1800, 1200, 1200]
  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      cell([para([bold('Nr.')])], { width: colW[0], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('Nume și prenume')])], { width: colW[1], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('CNP')])], { width: colW[2], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('Data nașterii')])], { width: colW[3], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('Nr. document')])], { width: colW[4], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('Nota')])], { width: colW[5], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
      cell([para([bold('Obs.')])], { width: colW[6], shade: { fill: 'E8E8E8', type: ShadingType.SOLID } }),
    ]
  })

  const dataRows: any[] = []
  for (let i = 0; i < minRows; i++) {
    const s = students[i]
    dataRows.push(new TableRow({
      children: [
        cell([para([reg(s ? String(i+1) : '')])], { width: colW[0] }),
        cell([para([reg(s?.full_name || '')])], { width: colW[1] }),
        cell([para([reg(s?.cnp || '')])], { width: colW[2] }),
        cell([para([reg(s?.birth_date || '')])], { width: colW[3] }),
        cell([para([reg(s ? `${s.ci_series || ''} ${s.ci_number || ''}`.trim() : '')])], { width: colW[4] }),
        cell([para([reg('')])], { width: colW[5] }),
        cell([para([reg('')])], { width: colW[6] }),
      ]
    }))
  }

  const studentsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow, ...dataRows],
  })

  // Semnatura evaluator
  const sigSection = [
    new Paragraph({ spacing: { before: 400, after: 200 }, children: [reg('')] }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [
          cell([para([bold('Evaluator ANCOM: '), reg(session.evaluators?.full_name || '')])], { borders: noBorders }),
          cell([para([bold('Semnătura:')])], { borders: noBorders }),
        ]}),
        new TableRow({ children: [
          cell([para([reg('')])], { borders: noBorders }),
          cell([para([reg(''), reg(''), reg('')])], { borders: noBorders }),
        ]}),
      ]
    })
  ]

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
      headers: headerChildren.length > 0 ? {
        default: { options: { children: headerChildren } } as any
      } : undefined,
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [reg('Pagina '), new TextRun({ children: [PageNumber.CURRENT], font: 'Arial', size: 16 }), reg(' din '), new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Arial', size: 16 })],
          })]
        })
      },
      children: [
        ...titleRows,
        infoTable,
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
        studentsTable,
        ...sigSection,
      ]
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="PV_Radio_${dateStr}.docx"`
    }
  })
}
