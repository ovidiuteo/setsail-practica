import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getHeaderImage } from '@/lib/antete'

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

  const headerImageBuffer = getHeaderImage(session.locations?.header_image || null)
  const dateStr = session.session_date.replace(/-/g, '_')
  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun,
    TabStopType, PageNumber, Footer, Header
  } = await import('docx')

  // Rezolva capitania bazata pe locatie (#...# logic)
  const locName = (session.locations?.name || '').toLowerCase()
  let capitania = ''
  if (locName.includes('snagov')) {
    capitania = 'Căpităniei Port Snagov'
  } else if (locName.includes('mangalia') || locName.includes('limanu')) {
    capitania = 'Căpităniei Portului Mangalia'
  } else {
    capitania = `Căpităniei ${session.locations?.name || ''}`
  }

  // Date variabile
  const evaluatorNume = session.evaluators?.full_name || '................................'
  const evaluatorFunctie = session.evaluators?.title || '................................'
  const decizieANR = session.evaluators?.decision_number || '................................'
  const nrSolicitare = session.request_number || '……../….......……'
  const locatieDetaliata = session.locations?.location_detail ||
    `${session.locations?.name || ''}, jud. ${session.locations?.county || ''}`
  const barcaInmatriculare = session.boats?.registration || ''
  const barcaNume = session.boats?.name || '................................'
  const instructor = session.instructors?.full_name || '................................'
  const clasaCAA = session.class_caa || 'C/D'

  // Footer locatie
  const fl1 = session.locations?.footer_line1 || ''
  const fl2 = session.locations?.footer_line2 || ''
  const fl3 = session.locations?.footer_line3 || ''

  // Borduri tabel
  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const noBorder = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
  const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder }
  const cellM = { top: 60, bottom: 60, left: 100, right: 100 }

  // Latime pagina A4: 11906 - 1080(stg) - 720(dr) = 10106 DXA
  const CONTENT_W = 10106

  // Coloane tabel cursanti: Nr | Nume | Prenume | CNP | Clasa | Admis | Respins | Absent
  const colW = [400, 1600, 3106, 2000, 650, 750, 750, 750]
  // Total: 10006 ~ CONTENT_W

  function makeHeader(): any[] {
    if (headerImageBuffer) {
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 0 },
          children: [
            new ImageRun({
              data: headerImageBuffer,
              type: 'png',
              transformation: { width: 663, height: 107 },
            }),
          ],
        })
      ]
    }
    return [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'MINISTERUL TRANSPORTURILOR ȘI INFRASTRUCTURII', bold: true, size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'AUTORITATEA NAVALĂ ROMÂNĂ', bold: true, size: 20 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'CĂPITĂNIA ZONALĂ GIURGIU', bold: true, size: 20 })] }),
      new Paragraph({
        alignment: AlignmentType.LEFT,
        spacing: { after: 200 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: 'CĂPITĂNIA PORT SNAGOV', bold: true, size: 20 }),

        ]
      }),
    ]
  }

  // Tabel cursanti - header
  function makeStudentTable() {
    const headerRow = new TableRow({
      tableHeader: true,
      children: [
        new TableCell({ borders, width: { size: colW[0], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR }, verticalMerge: 'restart' as any,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nr.', bold: true, size: 22 })] }),
                     new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'crt.', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[1], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nume', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[2], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Prenume', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[3], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CNP', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[4], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Clasa', bold: true, size: 22 })] }),
                     new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CAA', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[5], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Admis', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[6], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Respins', bold: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[7], type: WidthType.DXA }, margins: cellM, shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Absent', bold: true, size: 22 })] })] }),
      ]
    })

    // Desparte Nume / Prenume din full_name
    function splitName(fullName: string) {
      const parts = fullName.trim().split(' ')
      if (parts.length <= 1) return { nume: fullName, prenume: '' }
      return { nume: parts[0], prenume: parts.slice(1).join(' ') }
    }

    const dataRows = students.map((s: any, idx: number) => {
      const { nume, prenume } = splitName(s.full_name || '')
      return new TableRow({
        height: { value: 400, rule: 'atLeast' as any },
        children: [
          new TableCell({ borders, width: { size: colW[0], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(s.order_in_session || idx + 1), size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[1], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: nume, size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[2], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: prenume, size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[3], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.cnp || '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[4], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.class_caa || clasaCAA, size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[5], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[6], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[7], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
        ]
      })
    })

    return new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: colW,
      rows: [headerRow, ...dataRows],
    })
  }

  // Tabel semnaturi
  function makeSignatureTable() {
    return new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: [4500, 1106, 4500],
      rows: [
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Evaluator/Examinator', bold: true, size: 20 })] })] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Reprezentant furnizor/instructor', bold: true, size: 20 })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: evaluatorNume, bold: true, size: 20 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: evaluatorFunctie, size: 16 })] }),
            ] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: instructor, bold: true, size: 20 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Nume, prenume)', size: 16 })] }),
            ] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: { top: 400, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '............................  ...........................', size: 20 })] })] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: { top: 400, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '............................  ...........................', size: 20 })] })] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Semnătură)', size: 16 })] })] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Semnătură)', size: 16 })] })] }),
        ]}),
      ]
    })
  }

  const children: any[] = [
    // Antet
    ...makeHeader(),

    // Nr. inregistrare
    new Paragraph({
      spacing: { before: 120, after: 200 },
      children: [new TextRun({ text: 'Nr. ........... / .....................', size: 20 })]
    }),

    // Titlu
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 300 },
      children: [new TextRun({ text: 'Proces – Verbal  Examen Practic', bold: true, size: 26 })]
    }),

    // Paragraful 1 - Subsemnatul
    new Paragraph({
      spacing: { after: 160 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: [
        new TextRun({ text: 'Subsemnatul ', size: 22 }),
        new TextRun({ text: evaluatorNume, bold: true, size: 22 }),
        new TextRun({ text: ', cu funcția ', size: 22 }),
        new TextRun({ text: evaluatorFunctie, bold: true, size: 22 }),
        new TextRun({ text: ', din cadrul ', size: 22 }),
        new TextRun({ text: capitania, bold: true, size: 22 }),
        new TextRun({ text: ', desemnat prin Decizia Directorului General al Autorității Navale Române nr. ', size: 22 }),
        new TextRun({ text: decizieANR, bold: true, size: 22 }),
        new TextRun({ text: ' în calitate de evaluator la examenele practice a cursurilor aprobate organizate de furnizorii de educație, formare profesională sau de perfecționare pentru obținerea certificatelor internaționale de conducător de ambarcațiune de agrement,', size: 22 }),
      ]
    }),

    // Paragraful 2 - Avand in vedere
    new Paragraph({
      spacing: { after: 160 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: [
        new TextRun({ text: 'Având în vedere prevederile ,,', size: 22 }),
        new TextRun({ text: 'Regulamentului privind cerințele minime de prătire, precum și condițiile de obținere a certificatelor internaționale de conducător de ambarcațiune de agrement', italics: true, size: 22 }),
        new TextRun({ text: '" aprobat prin Ordinul M.T. nr. 527/2016 cu modificările și completările în vigoare și ', size: 22 }),
      ]
    }),

    // Paragraful 3 - In baza solicitarii
    new Paragraph({
      spacing: { after: 240 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: [
        new TextRun({ text: 'În  baza solicitării furnizorului ', size: 22 }),
        new TextRun({ text: 'S.C. SET SAIL ADVERTISING SRL', bold: true, size: 22 }),
        new TextRun({ text: '  nr. ', size: 22 }),
        new TextRun({ text: nrSolicitare, bold: true, size: 22 }),
        new TextRun({ text: ', s-a desfășurat în locația ', size: 22 }),
        new TextRun({ text: locatieDetaliata, bold: true, size: 22 }),
        new TextRun({ text: ', cu ambarcațiunea nr. ', size: 22 }),
        new TextRun({ text: barcaInmatriculare, bold: true, size: 22 }),
        new TextRun({ text: ' ', size: 22 }),
        new TextRun({ text: barcaNume, bold: true, size: 22 }),
        new TextRun({ text: ', în prezența instructorului ', size: 22 }),
        new TextRun({ text: instructor, bold: true, size: 22 }),
        new TextRun({ text: ',  evaluarea/examinarea cunoștintelor practice ale candidaților enumerați mai jos, iar în baza fișei individuale de verificare a aptitudinilor am constatat următoarele:', size: 22 }),
      ]
    }),

    // Tabel cursanti
    makeStudentTable(),

    // Paragraf final
    new Paragraph({
      spacing: { before: 300, after: 300 },
      alignment: AlignmentType.BOTH,
      children: [
        new TextRun({ text: '\tDrept pentru care am încheiat prezentul proces-verbal  în două exemplare, un exemplar a fost înaintat furnizorului de educație, formare profesională sau de perfecționare în vederea emiterii certificatelor de absolvire curs după caz.', size: 22 }),
      ]
    }),

    // Tabel semnaturi
    makeSignatureTable(),

    // Footer locatie
    ...(fl1 ? [
      new Paragraph({ spacing: { before: 400, after: 40 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '_'.repeat(100), size: 14, color: '888888' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: fl1, size: 14, color: '444444' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: fl2, size: 14, color: '444444' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 0 }, children: [new TextRun({ text: fl3, size: 14, color: '444444' })] }),
    ] : []),
  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 284, right: 720, bottom: 720, left: 1080 }
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