import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getHeaderImage } from '@/lib/antete'
import { fillDocTemplate, fragmentDefault } from '@/lib/doc-templates'

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

  // Instructori si ambarcatiuni secundare (pana la 3) — coloane fara FK, le luam dupa id si pastram ordinea
  const instructorIds = [session.instructor_id, session.instructor_id_2, session.instructor_id_3].filter(Boolean)
  const boatIds = [session.boat_id, session.boat_id_2, session.boat_id_3].filter(Boolean)
  const [{ data: instrRows }, { data: boatRows }] = await Promise.all([
    instructorIds.length ? supabase.from('instructors').select('id, full_name, signature_data').in('id', instructorIds) : Promise.resolve({ data: [] as any[] }),
    boatIds.length ? supabase.from('boats').select('id, name, registration').in('id', boatIds) : Promise.resolve({ data: [] as any[] }),
  ])
  const instrById: Record<string, any> = Object.fromEntries((instrRows || []).map((r: any) => [r.id, r]))
  const boatById: Record<string, any> = Object.fromEntries((boatRows || []).map((r: any) => [r.id, r]))
  const orderedInstr = instructorIds.map((id: string) => instrById[id]).filter(Boolean)
  const orderedBoats = boatIds.map((id: string) => boatById[id]).filter(Boolean)

  const headerImageBuffer = getHeaderImage(session.locations?.header_image || null)
  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  // Sufix _lista_N pentru clonele unei sesiuni principale (principala rămâne fără sufix).
  // N = poziția (cronologică) + 2 — adică principala e implicit lista 1, prima clonă = lista 2.
  let listaSuffix = ''
  if (session.parent_session_id) {
    // Doar clonele (NU și sesiunea de absenți care e tot copilă a principalei)
    const { data: siblings } = await supabase
      .from('sessions')
      .select('id, created_at')
      .eq('parent_session_id', session.parent_session_id)
      .eq('session_type', 'clone')
      .order('created_at', { ascending: true })
    const idx = (siblings ?? []).findIndex((s: any) => s.id === session_id)
    listaSuffix = `_lista_${Math.max(idx, 0) + 2}`
  }
  // Nume locație sanitizat (păstrăm doar litere/cifre, fără spații/diacritice problematice în filename)
  const locSlug = (session.locations?.name || 'Sesiune')
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip diacritics
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const fileBase = `PV_Practica_${session.session_date}_${locSlug}${listaSuffix}`

  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, ImageRun,
    TabStopType, PageNumber, Footer, Header, convertMillimetersToTwip,
    VerticalAlign,
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
  const nrSolicitare = session.nr_instiintare_anr || '……../….......……'
  const locatieDetaliata = session.location_detail ||
    session.locations?.location_detail ||
    `${session.locations?.name || ''}, jud. ${session.locations?.county || ''}`
  // Mai multe ambarcatiuni: "Nume Inmatriculare" pe fiecare, separate cu virgula
  const barcaText = orderedBoats.length
    ? orderedBoats.map((b: any) => `${b.name || ''}${b.registration ? ' ' + b.registration : ''}`.trim()).join(', ')
    : '................................'
  // Mai multi instructori: nume separate cu virgula
  const instructor = orderedInstr.length
    ? orderedInstr.map((i: any) => i.full_name).join(', ')
    : '................................'
  const multiBoats = orderedBoats.length > 1
  const multiInstr = orderedInstr.length > 1
  // La campul de semnatura din PV: doar PRIMUL instructor + semnatura lui
  const firstInstructorName = orderedInstr[0]?.full_name || '................................'
  function dataUrlToImage(dataUrl: string | null | undefined): { data: Buffer; type: 'png' | 'jpg' | 'gif' } | null {
    const m = /^data:image\/(png|jpe?g|gif);base64,(.+)$/i.exec(dataUrl || '')
    if (!m) return null
    const t = m[1].toLowerCase()
    return { data: Buffer.from(m[2], 'base64'), type: t === 'jpeg' || t === 'jpg' ? 'jpg' : (t as 'png' | 'gif') }
  }
  const firstSignature = dataUrlToImage(orderedInstr[0]?.signature_data)
  const clasaCAA = session.class_caa || 'C/D'

  // Template-uri editabile (admin → Template-uri Documente); fallback la default-urile din lib
  const { data: tplRows } = await supabase
    .from('doc_templates').select('key, content').eq('doc_type', 'pv_practica')
  const tplOverrides: Record<string, string> = Object.fromEntries((tplRows || []).map((r: any) => [r.key, r.content]))
  const tpl = (key: string) => tplOverrides[key] ?? fragmentDefault('pv_practica', key)
  const tplVars: Record<string, string> = {
    data_practica: sessionDate,
    evaluator: evaluatorNume,
    functie_evaluator: evaluatorFunctie,
    capitania,
    decizie_anr: decizieANR,
    furnizor: 'S.C. Set Sail Advertising S.R.L.',
    nr_solicitare: nrSolicitare,
    locatie: locatieDetaliata,
    fraza_ambarcatiuni: multiBoats ? 'cu ambarcațiunile' : 'cu ambarcațiunea',
    ambarcatiuni: barcaText,
    fraza_instructori: multiInstr ? 'în prezența instructorilor' : 'în prezența instructorului',
    instructori: instructor,
  }

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

  // Coloane fixe
  const COL_NR   = 270
  const COL_CNP  = 1800
  const COL_CLASA = 600
  const COL_ADMIS = 680
  const COL_RESP  = 680
  const COL_ABS   = 680
  const FIXED_TOTAL = COL_NR + COL_CNP + COL_CLASA + COL_ADMIS + COL_RESP + COL_ABS // 5220
  const NAME_TOTAL = CONTENT_W - FIXED_TOTAL // 4786 DXA pentru Nume + Prenume

  // Calculeaza latimea coloanei Nume bazat pe cel mai lung cuvant unic din lista
  // Un cuvant DXA aprox: 1 caracter ~ 115 DXA la 11pt
  const CHAR_WIDTH = 115
  const CELL_PADDING = 200 // padding stanga+dreapta

  function calcNumeWidth(students: any[]): number {
    let maxSingleWordLen = 0
    for (const s of students) {
      const parts = (s.full_name || '').trim().split(' ')
      // Primul cuvant = numele de familie
      const numeLen = (parts[0] || '').length
      // Daca sunt doua cuvinte si primul e mai scurt decat al doilea, comparam
      const secondLen = parts.length > 1 ? parts[1].length : 0
      // Numele preia dimensiunea celui mai lung cuvant UNIC (un singur cuvant)
      const maxForThis = Math.max(numeLen, secondLen)
      if (maxForThis > maxSingleWordLen) maxSingleWordLen = maxForThis
    }
    const numeW = Math.min(
      Math.max(maxSingleWordLen * CHAR_WIDTH + CELL_PADDING, 1200), // minim 1200
      NAME_TOTAL - 1200 // lasa cel putin 1200 pentru prenume
    )
    return numeW
  }

  const COL_NUME = calcNumeWidth(students)
  const COL_PRENUME = NAME_TOTAL - COL_NUME
  const colW = [COL_NR, COL_NUME, COL_PRENUME, COL_CNP, COL_CLASA, COL_ADMIS, COL_RESP, COL_ABS]
  // Total: 10006 ~ CONTENT_W

  function makeHeader(): any[] {
    if (headerImageBuffer) {
      return [
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: headerImageBuffer,
              type: 'png',
              transformation: { width: 663, height: 86 },
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
        new TableCell({ borders, width: { size: colW[0], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER, verticalMerge: 'restart' as any,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nr.', italics: true, size: 22 })] }),
                     new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'crt.', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[1], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nume', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[2], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Prenume', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[3], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CNP', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[4], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Clasa', italics: true, size: 22 })] }),
                     new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'CAA', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[5], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Admis', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[6], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Respins', italics: true, size: 22 })] })] }),
        new TableCell({ borders, width: { size: colW[7], type: WidthType.DXA }, margins: cellM, shading: { fill: 'FFFFFF', type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Absent', italics: true, size: 22 })] })] }),
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
        height: { value: 200, rule: 'atLeast' as any },
        children: [
          new TableCell({ borders, width: { size: colW[0], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(s.order_in_session || idx + 1), size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[1], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: nume, size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[2], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: prenume, size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[3], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: s.cnp || '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[4], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: (s.class_caa || clasaCAA).replace(',', '+'), size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[5], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[6], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
          new TableCell({ borders, width: { size: colW[7], type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })] }),
        ]
      })
    })

    // Adauga randuri goale pana la minim configurat per locatie (0 = exact cati sunt)
    const MIN_ROWS = session.locations?.min_table_rows ?? 18
    const emptyRowsNeeded = Math.max(0, MIN_ROWS - dataRows.length)
    const emptyRows = Array.from({ length: emptyRowsNeeded }, (_, i) =>
      new TableRow({
        height: { value: 200, rule: 'atLeast' as any },
        children: colW.map((w, ci) =>
          new TableCell({
            borders,
            width: { size: w, type: WidthType.DXA },
            margins: cellM,
            children: [new Paragraph({ children: [new TextRun({ text: '', size: 22 })] })]
          })
        )
      })
    )

    return new Table({
      width: { size: colW.reduce((a,b)=>a+b,0), type: WidthType.DXA },
      columnWidths: colW,
      rows: [headerRow, ...dataRows, ...emptyRows],
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
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: firstInstructorName, bold: true, size: 20 })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Nume, prenume)', size: 16 })] }),
            ] }),
        ]}),
        new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: { top: 240, bottom: 80, left: 100, right: 100 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '............................  ...........................', size: 20 })] })] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: { top: 240, bottom: 80, left: 100, right: 100 },
            children: [ firstSignature
              ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ data: firstSignature.data, type: firstSignature.type, transformation: { width: 130, height: 55 } })] })
              : new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: '............................  ...........................', size: 20 })] }) ] }),
        ]}),
        ...(locName.includes('snagov') ? [new TableRow({ children: [
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Semnătură)', size: 16 })] })] }),
          new TableCell({ borders: noBorders, width: { size: 1106, type: WidthType.DXA }, margins: cellM, children: [new Paragraph({ children: [] })] }),
          new TableCell({ borders: noBorders, width: { size: 4500, type: WidthType.DXA }, margins: cellM,
            children: [new Paragraph({ spacing: { after: 0 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: '(Semnătură)', size: 16 })] })] }),
        ]})] : []),
      ]
    })
  }

  const children: any[] = [
    // 2 paragrafe goale înainte de antet (împing antetul mai jos)
    new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),
    new Paragraph({ children: [new TextRun({ text: '', size: 22 })] }),

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
      children: fillDocTemplate(tpl('titlu'), tplVars).map(s => new TextRun({ text: s.text, bold: true, italics: s.italics, size: 26 }))
    }),

    // Limanu: "Incheiat astazi [data probei practice]" + un paragraf gol, inainte de Subsemnatul
    ...(locName.includes('limanu') ? [
      new Paragraph({
        spacing: { after: 0 },
        indent: { firstLine: 720 },
        alignment: AlignmentType.BOTH,
        children: fillDocTemplate(tpl('incheiat_limanu'), tplVars).map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: 22 }))
      }),
      new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: '', size: 22 })] }),
    ] : []),

    // Paragraful 1 - Subsemnatul
    new Paragraph({
      spacing: { after: 0 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: fillDocTemplate(tpl('p1_subsemnatul'), tplVars).map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: 22 }))
    }),

    // Paragraful 2 - Avand in vedere
    new Paragraph({
      spacing: { after: 0 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: fillDocTemplate(tpl('p2_regulament'), tplVars).map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: 22 }))
    }),

    // Paragraful 3 - In baza solicitarii
    new Paragraph({
      spacing: { after: 0 },
      indent: { firstLine: 720 },
      alignment: AlignmentType.BOTH,
      children: fillDocTemplate(tpl('p3_solicitare'), tplVars).map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: 22 }))
    }),

    // Tabel cursanti
    makeStudentTable(),

    // Paragraf final
    new Paragraph({
      spacing: { before: 0, after: 0 },
      alignment: AlignmentType.BOTH,
      children: fillDocTemplate(tpl('final'), tplVars).map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: 22 }))
    }),

    // Tabel semnaturi
    makeSignatureTable(),

  ]

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 0, right: 720, bottom: 113, left: 1080, footer: 113 }
        }
      },
      footers: fl1 ? {
        default: new Footer({
          children: [
            new Paragraph({
              border: { top: { style: BorderStyle.SINGLE, size: 6, color: '888888', space: 4 } },
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 40 },
              children: [new TextRun({ text: fl1, size: 14, color: '444444' })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 40 },
              children: [new TextRun({ text: fl2, size: 14, color: '444444' })]
            }),
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { after: 0 },
              children: [new TextRun({ text: fl3, size: 14, color: '444444' })]
            }),
          ]
        })
      } : undefined,
      children,
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const uint8 = new Uint8Array(buffer)

  return new NextResponse(uint8, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${fileBase}.docx"`,
    }
  })
}
