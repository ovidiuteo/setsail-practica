import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

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
    .order('order_in_session')

  if (!session || !students) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateStr = session.session_date.replace(/-/g, '_')

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun, PageBreak
  } = await import('docx')

  // Determina imaginea antet bazată pe locație
  const headerImageKey = session.locations?.header_image || null
  let headerImageBuffer: Buffer | null = null
  let headerImageType: 'jpg' | 'png' = 'jpg'

  if (headerImageKey) {
    // Caută fișierul în public folder
    const extensions = ['jpg', 'jpeg', 'png']
    for (const ext of extensions) {
      const imgPath = path.join(process.cwd(), 'public', `${headerImageKey}.${ext}`)
      if (fs.existsSync(imgPath)) {
        headerImageBuffer = fs.readFileSync(imgPath)
        headerImageType = ext === 'png' ? 'png' : 'jpg'
        break
      }
    }
    // Fallback: încearcă și fără extensie specificată
    if (!headerImageBuffer) {
      const imgPath = path.join(process.cwd(), 'public', `${headerImageKey}.png`)
      if (fs.existsSync(imgPath)) {
        headerImageBuffer = fs.readFileSync(imgPath)
        headerImageType = 'png'
      }
    }
  }

  // Dacă nu am găsit imagine specifică, caută snagov ca fallback
  if (!headerImageBuffer) {
    const fallbackPath = path.join(process.cwd(), 'public', 'antet_snagov.png')
    if (fs.existsSync(fallbackPath)) {
      headerImageBuffer = fs.readFileSync(fallbackPath)
      headerImageType = 'png'
    }
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 60, bottom: 60, left: 80, right: 80 }

  function makeHeaderParagraph(): any[] {
    if (headerImageBuffer) {
      // Antet grafic — imagine lățime completă, aliniată stânga
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 200 },
          children: [
            new ImageRun({
              data: headerImageBuffer,
              type: headerImageType,
              transformation: {
                width: 500,  // ~14cm — lățimea imaginii în document
                height: 80,  // proporțional cu originalul
              },
            })
          ]
        })
      ]
    } else {
      // Fallback text dacă nu există imagine
      return [
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'MINISTERUL TRANSPORTURILOR ȘI INFRASTRUCTURII', bold: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'AUTORITATEA NAVALĂ ROMÂNĂ', bold: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 }, children: [new TextRun({ text: 'CĂPITĂNIA ZONALĂ GIURGIU', bold: true, size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: 'CĂPITĂNIA PORT SNAGOV', bold: true, size: 20 })] }),
      ]
    }
  }

  function makeStudentRows() {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ borders, width: { size: 700, type: WidthType.DXA }, margins: cellMargins, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nr. crt', bold: true, size: 16 })] })] }),
        new TableCell({ borders, width: { size: 3500, type: WidthType.DXA }, margins: cellMargins, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'NUMELE SI PRENUMELE', bold: true, size: 16 })] })] }),
        new TableCell({ borders, width: { size: 2200, type: WidthType.DXA }, margins: cellMargins, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CNP', bold: true, size: 16 })] })] }),
        new TableCell({ borders, width: { size: 1200, type: WidthType.DXA }, margins: cellMargins, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CLASA CAA', bold: true, size: 16 })] })] }),
        new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'STATUS Admis/Respins/Absent', bold: true, size: 16 })] })] }),
      ]
    })

    const displayRows = [...students]
    while (displayRows.length < 20) displayRows.push(null as any)

    const dataRows = displayRows.map((s: any, idx: number) => new TableRow({
      height: { value: 400, rule: 'atLeast' },
      children: [
        new TableCell({ borders, width: { size: 700, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s ? String(s.order_in_session || idx + 1) : '', size: 16 })] })] }),
        new TableCell({ borders, width: { size: 3500, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: s?.full_name || '', size: 16 })] })] }),
        new TableCell({ borders, width: { size: 2200, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s?.cnp || '', size: 16 })] })] }),
        new TableCell({ borders, width: { size: 1200, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s?.class_caa || '', size: 16 })] })] }),
        new TableCell({ borders, width: { size: 2000, type: WidthType.DXA }, margins: cellMargins, children: [new Paragraph({ children: [new TextRun({ text: '', size: 16 })] })] }),
      ]
    }))

    return [headerRow, ...dataRows]
  }

  const children: any[] = [
    // Antet grafic
    ...makeHeaderParagraph(),

    // Număr înregistrare
    new Paragraph({ alignment: AlignmentType.LEFT, spacing: { after: 100 }, children: [new TextRun({ text: 'Nr................/............................', size: 18 })] }),

    // Titlu
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200 }, children: [new TextRun({ text: 'Proces – Verbal  Examen Practic', bold: true, size: 28 })] }),

    // Corp text
    new Paragraph({ spacing: { after: 120 }, children: [
      new TextRun({ text: '\tSubsemnatul ', size: 18 }),
      new TextRun({ text: session.evaluators?.full_name || '...', bold: true, size: 18 }),
      new TextRun({ text: ', ', size: 18 }),
      new TextRun({ text: session.evaluators?.title || '...', size: 18 }),
      new TextRun({ text: ' desemnat prin Decizia Directorului General al Autorității Navale Române nr. ', size: 18 }),
      new TextRun({ text: session.evaluators?.decision_number || '...', bold: true, size: 18 }),
      new TextRun({ text: ' în calitate de evaluator la examenele practice a cursurilor aprobate organizate de furnizorii de educație, formare profesională sau de perfecționare pentru obținerea certificatelor internaționale de conducător de ambarcațiune de agrement,', size: 18 }),
    ]}),

    new Paragraph({ spacing: { after: 120 }, children: [
      new TextRun({ text: '\tAvând în vedere prevederile,,Regulamentului privind cerințele minime de prătire, precum și condițiile de obținere a certificatelor internaționale de conducător de ambarcațiune de agrement" aprobat prin Ordinul MT nr. 527/2016 cu modificările și completările în vigoare și ', size: 18 }),
    ]}),

    new Paragraph({ spacing: { after: 200 }, children: [
      new TextRun({ text: '\tÎn  baza solicitării furnizorului…', size: 18 }),
      new TextRun({ text: 'SET SAIL ADVERTISING SRL', bold: true, size: 18 }),
      new TextRun({ text: '…, nr……../….......…… s-a desfășurat în locația…', size: 18 }),
      new TextRun({ text: `${session.locations?.name?.toUpperCase() || ''}, JUD. ${session.locations?.county?.toUpperCase() || ''}`, bold: true, size: 18 }),
      new TextRun({ text: '……,cu ambarcațiunea…', size: 18 }),
      new TextRun({ text: session.boats?.name?.toUpperCase() || '...', bold: true, size: 18 }),
      new TextRun({ text: '…, în prezența instructorului …', size: 18 }),
      new TextRun({ text: session.instructors?.full_name?.toUpperCase() || '...', bold: true, size: 18 }),
      new TextRun({ text: '…, evaluarea/examinarea cunoștintelor practice ale candidaților enumerați mai jos, și în baza fișei individuale de verificare a aptitudinilor am constatat următoarele:', size: 18 }),
    ]}),

    // Tabel cursanți
    new Table({
      width: { size: 9600, type: WidthType.DXA },
      columnWidths: [700, 3500, 2200, 1200, 2000],
      rows: makeStudentRows(),
    }),

    new Paragraph({ spacing: { before: 300, after: 120 }, children: [
      new TextRun({ text: '\tDrept pentru care am încheiat prezentul proces-verbal în două exemplare, un exemplar a fost înaintat furnizorului de educație, formare profesională sau de perfecționare în vederea emiterii certificatelor de absolvire curs după caz.', size: 18 }),
    ]}),

    // Semnături
    new Paragraph({ spacing: { before: 400, after: 120 }, tabStops: [{ type: 'right', position: 9360 }], children: [
      new TextRun({ text: 'Evaluator/Examinator', bold: true, size: 18 }),
      new TextRun({ text: '\t', size: 18 }),
      new TextRun({ text: 'Reprezentant furnizor/instructor', bold: true, size: 18 }),
    ]}),
    new Paragraph({ spacing: { after: 80 }, tabStops: [{ type: 'right', position: 9360 }], children: [
      new TextRun({ text: 'Nume, prenume', size: 18 }),
      new TextRun({ text: '\t', size: 18 }),
      new TextRun({ text: 'Nume, prenume', size: 18 }),
    ]}),
    new Paragraph({ spacing: { after: 80 }, tabStops: [{ type: 'right', position: 9360 }], children: [
      new TextRun({ text: '', size: 18 }),
      new TextRun({ text: '\t', size: 18 }),
      new TextRun({ text: session.instructors?.full_name?.toUpperCase() || '', bold: true, size: 18 }),
    ]}),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 1080 }
        }
      },
      children,
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="PV_Practic_${dateStr}.docx"`,
    }
  })
}