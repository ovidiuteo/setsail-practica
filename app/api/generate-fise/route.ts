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
  const headerImageType: 'png' = 'png'

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateStr = session.session_date.replace(/-/g, '_')

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak, ImageRun,
    TabStopType, TabStopPosition
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 }

  const evalRows = [
    {
      req: 'Verificarea iniţială a ambarcaţiunii înainte de plecare de la cheu, a situaţiei traficului din jurul ambarcaţiunii, a condiţiilor meteo.',
      apt: 'Verificare stare tehnică a echipamentelor din dotare şi a echipamentelor de siguranţă (colaci salvare, veste salvare, echipament comunicaţii, aparatura/echipamente ambarcaţiune, mod funcţionare motor/instalaţie guvernare, VHF, etc.)',
    },
    {
      req: 'Demonstrare cunostinţe de marinărie.',
      apt: 'Recunoaştere/folosire accesorii punte, parâme, recunoaştere/executare noduri marinăreşti, volte, etc.',
    },
    {
      req: 'Demonstrare cunostinţe de manevră a ambarcaţiunii.',
      apt: 'Operarea ambarcaţiunii (plecare de la cheu/acostare la cheu/ancorare, modul de molare a parâmelor, darea parâmelor şi mod de luare a voltelor), conduita la întâlnirea şi/sau depăşirea altei nave.',
    },
    {
      req: 'Demonstrare cunostinţe de salvare/prevenire poluare.',
      apt: 'Manevra de om la apă (recuperarea în siguranţă a unui colac de salvare aflat la apă), folosirea dispozitivelor şi a echipamentelor de salvare a vieţii, prevenirea şi combaterea incendiilor, evitarea poluării.',
    },
  ]

  // Content width in DXA: A4 (11906) - left(1080) - right(720) = 10106
  const CONTENT_W = 10106
  const COL1 = 3400  // Cerinte
  const COL2 = 5006  // Aptitudini
  const COL3 = 1700  // Observatii

  function dot(text: string): string {
    // Return text if exists, else dashes
    return text || '___________________________________'
  }

  function makeStudentSection(s: any, isLast: boolean): any[] {
    const ciDoc = s.ci_series && s.ci_number
      ? `${s.ci_series} ${s.ci_number}`
      : (s.id_document || '___________________________')

    const children: any[] = []

    // ── NU ANTET ──

    // ── TITLU ──
    children.push(
      new Paragraph({
        spacing: { before: 160, after: 40 },
        children: [
          new TextRun({ text: 'Fișă de verificare aptitudini', bold: true, size: 30 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 160 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: 'pentru conducerea și manevra ambarcațiunii de agrement', bold: true, size: 30 }),
          new TextRun({ text: '\t', size: 30 }),
          new TextRun({ text: 'Anexa 10', size: 27 }),
        ]
      }),
    )

    // ── DATE CANDIDAT ──
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'Pentru obţinerea Certificatului Internaţional de Conducător de ambarcațiune de agrement', bold: true, size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 80 },
        children: [
          new TextRun({ text: 'CLASA:  ', bold: true, size: 27 }),
          new TextRun({ text: s.class_caa || session.class_caa || '___________', bold: true, size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({ text: 'Perioada de desfăşurare curs:  ', bold: true, size: 27 }),
          new TextRun({ text: sessionDate, size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: 'Numele şi prenumele candidatului:  ', bold: true, size: 27 }),
          new TextRun({ text: s.full_name || '_______________________________________________', size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 160 },
        children: [
          new TextRun({ text: 'CNP:  ', bold: true, size: 27 }),
          new TextRun({ text: dot(s.cnp), size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 200 },
        children: [
          new TextRun({ text: 'Document de identitate: ', bold: true, size: 27 }),
          new TextRun({ text: ciDoc, size: 27 }),
        ]
      }),
    )

    // ── TABEL VERIFICĂRI ──
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: 'Verificări: ', bold: true, size: 27 })]
      }),
      new Table({
        width: { size: CONTENT_W, type: WidthType.DXA },
        columnWidths: [COL1, COL2, COL3],
        rows: [
          // Header
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({
                borders, margins: cellMargins, width: { size: COL1, type: WidthType.DXA },
                shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Cerinţe', bold: true, size: 27 })] })]
              }),
              new TableCell({
                borders, margins: cellMargins, width: { size: COL2, type: WidthType.DXA },
                shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Aptitudini', bold: true, size: 27 })] })]
              }),
              new TableCell({
                borders, margins: cellMargins, width: { size: COL3, type: WidthType.DXA },
                shading: { fill: 'E8E8E8', type: ShadingType.CLEAR },
                children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Observaţii (admis / respins)', bold: true, size: 24 })] })]
              }),
            ]
          }),
          // Data rows
          ...evalRows.map(row => new TableRow({
            children: [
              new TableCell({
                borders, margins: cellMargins, width: { size: COL1, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row.req, bold: true, size: 26 })] })]
              }),
              new TableCell({
                borders, margins: cellMargins, width: { size: COL2, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row.apt, size: 26 })] })]
              }),
              new TableCell({
                borders, margins: cellMargins, width: { size: COL3, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: '', size: 26 })] })]
              }),
            ]
          }))
        ]
      })
    )

    // ── REZULTAT ──
    children.push(
      new Paragraph({
        spacing: { before: 200, after: 200 },
        children: [
          new TextRun({ text: '       Rezultat evaluare finală .......................................................................(admis/respins)', size: 27 }),
        ]
      })
    )

    // ── SEMNĂTURI ──
    // Rând: Data stânga, Intocmit dreapta
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: `Data : ${sessionDate}`, size: 27 }),
          new TextRun({ text: '\t', size: 27 }),
          new TextRun({ text: 'Intocmit,', size: 27 }),
        ]
      }),
      // Evaluator - numele autorității dreapta
      new Paragraph({
        spacing: { after: 80 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: '', size: 27 }),
          new TextRun({ text: '\t', size: 27 }),
          new TextRun({ text: 'Nume şi prenume/semnătura', size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 200 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
        children: [
          new TextRun({ text: '', size: 27 }),
          new TextRun({ text: '\t', size: 27 }),
          new TextRun({ text: session.evaluators?.full_name || '............................', bold: true, size: 27 }),
        ]
      }),
    )

    // Semnătură cursant — stânga
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: 'Nume şi prenume/semnătura cursant', size: 27 }),
        ]
      }),
      new Paragraph({
        spacing: { after: 60 },
        children: [
          new TextRun({ text: s.full_name || '............................', bold: true, size: 27 }),
        ]
      }),
    )

    // Imaginea semnăturii digitale dacă există
    if (s.signature_data) {
      try {
        const sigBase64 = s.signature_data.includes(',')
          ? s.signature_data.split(',')[1]
          : s.signature_data
        const sigBuffer = Buffer.from(sigBase64, 'base64')
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new ImageRun({
                data: sigBuffer,
                type: 'png',
                transformation: { width: 160, height: 55 },
              })
            ]
          })
        )
      } catch { /* ignoră dacă semnătura nu poate fi citită */ }
    }

    children.push(
      new Paragraph({
        spacing: { after: 40 },
        children: [new TextRun({ text: '............................ ...........................', size: 27 })]
      })
    )

    // Page break între cursanți
    if (!isLast) {
      children.push(new Paragraph({ children: [new PageBreak()] }))
    }

    return children
  }

  const allChildren: any[] = []
  students.forEach((s: any, i: number) => {
    makeStudentSection(s, i === students.length - 1).forEach(c => allChildren.push(c))
  })

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 284, right: 720, bottom: 720, left: 1080 }
        }
      },
      children: allChildren,
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Fise_Anexa10_${dateStr}.docx"`,
    }
  })
}
