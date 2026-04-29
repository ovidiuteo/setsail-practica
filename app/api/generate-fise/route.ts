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

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, PageBreak, ImageRun
  } = await import('docx')

  const border = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
  const borders = { top: border, bottom: border, left: border, right: border }
  const cellMargins = { top: 80, bottom: 80, left: 100, right: 100 }

  const evalRows = [
    {
      req: 'Verificarea inițială a ambarcațiunii înainte de plecare de la cheu, a situației traficului din jurul ambarcațiunii, a condițiilor meteo.',
      apt: 'Verificare stare tehnică a echipamentelor din dotare și a echipamentelor de siguranță (colaci salvare, veste salvare, echipament comunicații, aparatura/echipamente ambarcațiune, mod funcționare motor/instalație guvernare, VHF, etc.)',
    },
    {
      req: 'Demonstrare cunoștinţe de marinărie.',
      apt: 'Recunoaștere/folosire accesorii punte, parâme, recunoaștere/executare noduri marinărești, volte, etc.',
    },
    {
      req: 'Demonstrare cunoștinţe de manevră a ambarcațiunii.',
      apt: 'Operarea ambarcației (plecare de la cheu/acostare la cheu/ancorare, modul de molare a parâmelor, darea parâmelor și mod de luare a voltelor), conduita la întâlnirea și/sau depășirea altei nave.',
    },
    {
      req: 'Demonstrare cunoștinţe de salvare/prevenire poluare.',
      apt: 'Manevra de om la apă (recuperarea în siguranță a unui colac de salvare aflat la apă), folosirea dispozitivelor și a echipamentelor de salvare a vieții, prevenirea și combaterea incendiilor, evitarea poluării.',
    },
  ]

  function makeStudentSection(s: any, isLast: boolean): any[] {
    const children: any[] = [
      // Antet grafic dacă există, altfel text
      ...(headerImageBuffer ? [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 160 },
          children: [
            new ImageRun({
              data: headerImageBuffer,
              type: headerImageType,
              transformation: { width: 624, height: 99 },
            }),
            new TextRun({ text: '     Anexa 10', size: 18 }),
          ]
        })
      ] : [
        new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { after: 60 },
          children: [new TextRun({ text: 'Anexa 10', size: 18 })] }),
      ]),

      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
        children: [new TextRun({ text: 'Fișă de verificare aptitudini', bold: true, size: 24 })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
        children: [new TextRun({ text: 'pentru conducerea și manevra ambarcațiunii de agrement', bold: true, size: 20 })] }),

      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: 'Pentru obținerea Certificatului Internațional de Conducător de ambarcațiune de agrement', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: 'CLASA:  ......', bold: true, size: 18 }),
        new TextRun({ text: s.class_caa || session.class_caa, bold: true, size: 18 }),
        new TextRun({ text: '....................', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: 'Perioada de desfășurare curs:  ..............', bold: true, size: 18 }),
        new TextRun({ text: sessionDate, bold: true, size: 18 }),
        new TextRun({ text: '.....................................', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: 'Numele și prenumele candidatului:  ....', bold: true, size: 18 }),
        new TextRun({ text: s.full_name || '', bold: true, size: 18 }),
        new TextRun({ text: '..', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 80 }, children: [
        new TextRun({ text: 'CNP:  ....', bold: true, size: 18 }),
        new TextRun({ text: s.cnp || '...................................', bold: true, size: 18 }),
        new TextRun({ text: '....', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 200 }, children: [
        new TextRun({ text: 'Document de identitate: ...................', bold: true, size: 18 }),
        new TextRun({ text: s.id_document || '.....................', bold: true, size: 18 }),
        new TextRun({ text: '...................', bold: true, size: 18 }),
      ]}),

      new Paragraph({ spacing: { after: 120 },
        children: [new TextRun({ text: 'Verificări: ', bold: true, size: 18 })] }),

      // Eval table
      new Table({
        width: { size: 9600, type: WidthType.DXA },
        columnWidths: [3600, 4200, 1800],
        rows: [
          // Header
          new TableRow({ tableHeader: true, children: [
            new TableCell({ borders, margins: cellMargins, width: { size: 3600, type: WidthType.DXA },
              shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Cerinţe', bold: true, size: 18 })] })] }),
            new TableCell({ borders, margins: cellMargins, width: { size: 4200, type: WidthType.DXA },
              shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Aptitudini', bold: true, size: 18 })] })] }),
            new TableCell({ borders, margins: cellMargins, width: { size: 1800, type: WidthType.DXA },
              shading: { fill: 'D0D0D0', type: ShadingType.CLEAR },
              children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Observaţii (admis / respins)', bold: true, size: 18 })] })] }),
          ]}),
          ...evalRows.map(row => new TableRow({
            height: { value: 1200, rule: 'atLeast' },
            children: [
              new TableCell({ borders, margins: cellMargins, width: { size: 3600, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row.req, bold: true, size: 16 })] })] }),
              new TableCell({ borders, margins: cellMargins, width: { size: 4200, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: row.apt, size: 16 })] })] }),
              new TableCell({ borders, margins: cellMargins, width: { size: 1800, type: WidthType.DXA },
                children: [new Paragraph({ children: [new TextRun({ text: '', size: 16 })] })] }),
            ]
          })),
        ]
      }),

      new Paragraph({ spacing: { before: 200, after: 120 }, children: [
        new TextRun({ text: '       Rezultat evaluare finală .......................................................................(admis/respins)', size: 18 }),
      ]}),

      new Paragraph({ spacing: { before: 200, after: 120 },
        tabStops: [{ type: 'right', position: 9360 }],
        children: [
          new TextRun({ text: `Data : ........${sessionDate}..................`, size: 18 }),
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: 'Intocmit,', size: 18 }),
        ]
      }),

      new Paragraph({ spacing: { after: 80 },
        tabStops: [{ type: 'right', position: 9360 }],
        children: [
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: 'Nume și prenume/semnătura', size: 18 }),
        ]
      }),

      new Paragraph({ spacing: { before: 200, after: 80 },
        tabStops: [{ type: 'right', position: 9360 }],
        children: [
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: '............................ ...........................', size: 18 }),
        ]
      }),

      new Paragraph({ spacing: { before: 200, after: 80 },
        tabStops: [{ type: 'right', position: 9360 }],
        children: [
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: 'Nume și prenume/semnătura cursant', size: 18 }),
        ]
      }),

      new Paragraph({ spacing: { after: 80 },
        tabStops: [{ type: 'right', position: 9360 }],
        children: [
          new TextRun({ text: '\t', size: 18 }),
          new TextRun({ text: `..............${s.full_name || '....'}.........`, size: 18 }),
        ]
      }),
    ]

    // Add page break between students (except last)
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
  const dateStr = session.session_date.replace(/-/g, '_')
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="Fise_Anexa10_${dateStr}.docx"`,
    }
  })
}