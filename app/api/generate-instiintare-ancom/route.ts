import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// tip: 'curs-obtinere' | 'curs-prelungire' | 'examen-obtinere' | 'examen-prelungire'
// format: 'docx' | 'pdf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body
    const tip = body.tip || 'curs-obtinere'
    const format = body.format || 'docx'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: session } = await supabase
      .from('sessions')
      .select('*, locations(*), evaluators(*), instructors(*)')
      .eq('id', session_id)
      .single()

    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    const { data: info } = await supabase
      .from('setsail_info')
      .select('key, value')

    const { data: antetDoc } = await supabase
      .from('setsail_documents')
      .select('file_data')
      .eq('tip', 'antet_radio')
      .single()

    const infoMap: Record<string, string> = {}
    for (const row of info || []) infoMap[row.key] = row.value

    const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    const courseStartDate = session.course_start_date
      ? new Date(session.course_start_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
      : sessionDate
    const dateStr = session.session_date.replace(/-/g, '_')

    // Notificarea are o singura data ca "1/5.02.2026" - un numar secvential si data
    // Vom lasa campul de nr gol (se completeaza manual)

    // Construim textul subiectului si corpului in functie de tip
    const isPrelungire = tip.includes('prelungire')
    const isExamen = tip.includes('examen')

    let subiect = ''
    let corpText = ''
    let titluDoc = ''

    const cursStart = courseStartDate
    const cursEnd = sessionDate
    const perioadaCurs = cursStart === cursEnd
      ? cursEnd
      : `${cursStart} - ${cursEnd}`

    if (!isExamen && !isPrelungire) {
      // curs-obtinere
      titluDoc = 'Înștiințare organizare curs obținere LRC'
      subiect = 'Înștiințare cu privire la data de începere a cursului de pregătire în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de 31.12.2026, vă înștiințăm că vom organiza un curs de pregătire în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC în perioada ${perioadaCurs}.\n\nLocul de desfășurare al cursului este online.`
    } else if (!isExamen && isPrelungire) {
      // curs-prelungire
      titluDoc = 'Înștiințare organizare curs reconfirmare LRC'
      subiect = 'Înștiințare cu privire la data de începere a cursului de reconfirmare în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de 31.12.2026, vă înștiințăm că vom organiza un curs de reconfirmare în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC în perioada ${perioadaCurs}.\n\nLocul de desfășurare al cursului este online.`
    } else if (isExamen && !isPrelungire) {
      // examen-obtinere
      titluDoc = 'Înștiințare organizare examen obținere LRC'
      subiect = 'Înștiințare cu privire la data de desfășurare a examenului în vederea obținerii certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      const eval1 = session.evaluators?.full_name || '...'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de 31.12.2026, vă înștiințăm că pe data de ${sessionDate}, organizam o sesiune de examinare în vederea obținerii certificatelor de operator radio, online.\n\nMembrii comisiei de examinare vor fi:\n- Drugan Ovidiu, instructor SetSail, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC\n- Drugan Sorin, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC`
    } else {
      // examen-prelungire
      titluDoc = 'Înștiințare organizare examen prelungire LRC'
      subiect = 'Înștiințare cu privire la data de desfășurare a examenului în vederea prelungirii valabilității certificatelor de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit de tip GMDSS-LRC'
      corpText = `Subscrisa SC SET SAIL ADVERTISING SRL, cu datele de identificare din antet, în baza pct. 3, lit. a) și c) din cadrul protocolului de colaborare dintre instituțiile noastre valabil până la data de 31.12.2026, vă înștiințăm că pe data de ${sessionDate}, orele 19.00, organizam o sesiune de examinare în vederea prelungirii valabilității certificatelor de operator radio, online.\n\nMembrii comisiei de examinare vor fi:\n- Drugan Ovidiu, instructor SetSail, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC\n- Drugan Sorin, deținător al certificatului de operator radio pentru ambarcațiuni de agrement în serviciile mobil maritim și mobil maritim prin satelit GMDSS-LRC`
    }

    // PDF
    if (format === 'pdf') {
      const antetHtml = antetDoc?.file_data
        ? `<div style="text-align:center;margin-bottom:8px;"><img src="${antetDoc.file_data}" style="max-width:100%;height:auto;max-height:85px;"/></div>`
        : '<div style="text-align:center;font-weight:bold;font-size:13pt;">S.C. SET SAIL ADVERTISING S.R.L.</div>'

      const corpHtml = corpText.split('\n').map(line =>
        line.trim() ? `<p style="text-indent:${line.startsWith('-') ? '0' : '40px'};margin:4px 0;">${line}</p>` : '<p style="margin:8px 0;"></p>'
      ).join('')

      const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm; }
  @media print { html,body{background:white!important;padding:0!important;} body{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;} }
  html { background:#e0e0e0; padding:20px; }
  body { font-family:Arial,sans-serif; font-size:11pt; background:#fff; width:170mm; margin:0 auto; padding:20mm; box-shadow:0 0 20px rgba(0,0,0,0.3); line-height:1.5; }
</style>
</head><body>
${antetHtml}
<p style="text-align:right;margin-top:20px;"><strong>...... / ${new Date(session.session_date).toLocaleDateString('ro-RO')}</strong></p>
<p><strong>Către,</strong><br>AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE<br>ȘI REGLEMENTARE ÎN COMUNICAȚII</p>
<p style="margin-top:20px;"><strong>Subiect:</strong> <em>${subiect}</em></p>
<p style="text-align:center;font-size:14pt;margin:30px 0;"><strong>Domnule Președinte,</strong></p>
${corpHtml}
<div style="margin-top:50px;text-align:right;">
  <p>Cu stimă,<br><strong>SC SET SAIL ADVERTISING SRL</strong><br>director Cobianu Drugan Corina</p>
  <div style="height:80px;"></div>
</div>
</body></html>`

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // DOCX
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      convertMillimetersToTwip, ImageRun, UnderlineType
    } = await import('docx')

    const bold = (t: string, sz = 22) => new TextRun({ text: t, bold: true, size: sz, font: 'Arial' })
    const reg = (t: string, sz = 22) => new TextRun({ text: t, size: sz, font: 'Arial' })
    const ital = (t: string, sz = 22) => new TextRun({ text: t, italics: true, size: sz, font: 'Arial' })
    const boldItal = (t: string, sz = 22) => new TextRun({ text: t, bold: true, italics: true, size: sz, font: 'Arial' })
    const para = (ch: any[], align = AlignmentType.LEFT, sp = 120, indent?: number) =>
      new Paragraph({ alignment: align as any, spacing: { before: sp, after: sp }, indent: indent ? { firstLine: indent } : undefined, children: ch })

    // Antet imagine
    let headerImg: any[] = []
    if (antetDoc?.file_data) {
      try {
        const base64 = antetDoc.file_data.includes(',') ? antetDoc.file_data.split(',')[1] : antetDoc.file_data
        const buf = Buffer.from(base64, 'base64')
        const mt = antetDoc.file_data.includes('png') ? 'png' : 'jpg'
        headerImg = [new Paragraph({
          alignment: AlignmentType.CENTER as any,
          spacing: { after: 200 },
          children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 600, height: 65 } })]
        })]
      } catch(e) { console.error(e) }
    }

    // Corp paragraphs
    const corpParas: any[] = []
    for (const line of corpText.split('\n')) {
      if (!line.trim()) {
        corpParas.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }))
      } else if (line.startsWith('-')) {
        corpParas.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED as any,
          spacing: { before: 80, after: 80 },
          indent: { left: 720 },
          children: [reg(line)]
        }))
      } else {
        // Gasim textul bold (datele)
        const children: any[] = []
        // Procesam textul pentru bold pe date
        const boldParts = line.split(/(\d{1,2} \w+ \d{4}|\d{1,2}\.\d{1,2}\.\d{4}|[\d]+ - [\d\w ]+\d{4})/g)
        for (const part of boldParts) {
          if (/\d{1,2} \w+ \d{4}/.test(part) || /\d{1,2}\.\d{1,2}\.\d{4}/.test(part)) {
            children.push(bold(part))
          } else {
            children.push(reg(part, 22))
          }
        }
        corpParas.push(new Paragraph({
          alignment: AlignmentType.JUSTIFIED as any,
          spacing: { before: 80, after: 80 },
          indent: { firstLine: 720 },
          children: children.length > 0 ? children : [reg(line)]
        }))
      }
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20),
              right: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20),
              left: convertMillimetersToTwip(20),
            }
          }
        },
        children: [
          ...headerImg,
          // Nr si data - aliniat dreapta
          para([reg('...... / ' + new Date(session.session_date).toLocaleDateString('ro-RO'))], AlignmentType.RIGHT as any, 200),
          // Catre
          new Paragraph({ spacing: { before: 200, after: 60 }, children: [bold('Către,')] }),
          new Paragraph({ spacing: { before: 0, after: 0 }, children: [reg('AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE')] }),
          new Paragraph({ spacing: { before: 0, after: 200 }, children: [reg('ȘI REGLEMENTARE ÎN COMUNICAȚII')] }),
          // Subiect
          new Paragraph({
            spacing: { before: 200, after: 200 },
            children: [bold('Subiect:   '), boldItal(subiect)]
          }),
          // Domnule Presedinte
          para([bold('Domnule Președinte,', 26)], AlignmentType.CENTER as any, 300),
          // Corp
          ...corpParas,
          // Semnatura
          new Paragraph({ spacing: { before: 600, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('Cu stimă,')] }),
          new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [bold('SC SET SAIL ADVERTISING SRL')] }),
          new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('director Cobianu Drugan Corina')] }),
          new Paragraph({ spacing: { before: 800, after: 0 }, children: [] }),
        ]
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    const filename = `Instiintare_ANCOM_${tip}_${dateStr}.docx`

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    })

  } catch (err: any) {
    console.error('Instiintare ANCOM error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
