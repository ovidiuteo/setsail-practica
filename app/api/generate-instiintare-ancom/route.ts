import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { ancomDocType, fillDocTemplate, fragmentDefault, fragmentDefaultAlign, type DocAlign, type Segment } from '@/lib/doc-templates'

// tip: 'curs-obtinere' | 'curs-prelungire' | 'examen-obtinere' | 'examen-prelungire'
// format: 'docx' | 'pdf'
// cu_stampila: true (default) | false — daca false, NU include stampila/semnatura in document

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body
    const tip = body.tip || 'curs-obtinere'
    const format = body.format || 'docx'
    const cuStampila = body.cu_stampila !== false  // default true, devine false doar daca e trimis explicit false

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

    // Aducem persoanele de contact bifate la sesiune, sortate alfabetic
    const contactIds: string[] = session.contact_person_ids || []
    let persContact1 = 'Drugan Ovidiu'
    let persContact2 = 'Drugan Sorin'
    if (contactIds.length > 0) {
      const { data: contacts } = await supabase
        .from('contact_persons')
        .select('id, full_name')
        .in('id', contactIds)
        .order('full_name')
      const sorted = (contacts || []).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name, 'ro'))
      if (sorted[0]) persContact1 = sorted[0].full_name
      if (sorted[1]) persContact2 = sorted[1].full_name
    }

    // Aducem antetul radio si stampila cu semnatura
    const { data: antetDoc } = await supabase
      .from('setsail_documents')
      .select('file_data')
      .eq('tip', 'antet_radio')
      .single()

    const { data: stampilaDoc } = await supabase
      .from('setsail_documents')
      .select('file_data')
      .eq('tip', 'stampila_cu_semnatura')
      .single()

    // Aducem info setsail pentru protocol ANCOM
    const { data: infoRows } = await supabase
      .from('setsail_info')
      .select('key, value')
      .in('key', ['protocol_ancom_valabil_pana'])
    const infoMap: Record<string,string> = {}
    for (const row of infoRows || []) infoMap[row.key] = row.value
    const protocolValabilPana = infoMap['protocol_ancom_valabil_pana'] || '31.12.2026'

    // Aducem numerele de solicitare alocate pentru aceasta sesiune
    // Intai cautam dupa session_id, daca nu gasim luam ultimele alocate global
    const { data: nrRowsSession } = await supabase
      .from('notification_numbers')
      .select('numar, document_tip, data_notificare, tip')
      .eq('session_id', session_id)
      .eq('tip', 'solicitare')
      .order('numar')
    
    const { data: nrRowsAll } = await supabase
      .from('notification_numbers')
      .select('numar, document_tip, data_notificare, tip')
      .eq('tip', 'solicitare')
      .order('numar', { ascending: false })

    // Folosim session_id specific daca exista, altfel ultimele globale per document_tip
    const nrRows = (nrRowsSession && nrRowsSession.length > 0) ? nrRowsSession : []
    
    const nrMap: Record<string, number> = {}
    for (const row of nrRows) {
      if (row.document_tip) nrMap[row.document_tip] = row.numar
    }
    // Daca nu avem per sesiune, luam ultimul global per document_tip
    if (Object.keys(nrMap).length === 0 && nrRowsAll && nrRowsAll.length > 0) {
      const seen = new Set<string>()
      for (const row of nrRowsAll) {
        if (row.document_tip && !seen.has(row.document_tip)) {
          nrMap[row.document_tip] = row.numar
          seen.add(row.document_tip)
        }
      }
    }

    const nrTipMap: Record<string, string> = {
      'curs-obtinere':    'curs-obtinere',
      'curs-prelungire':  'curs-prelungire',
      'examen-obtinere':  'examen-obtinere',
      'examen-prelungire':'examen-prelungire',
    }
    // Numărul care apare pe înștiințare e cel din registrul „Înștiințări ANCOM"
    // (numărul de ieșire). Vechile numere de „solicitare" rămân doar ca rezervă.
    const { data: iesireRows } = await supabase
      .from('notification_numbers')
      .select('numar, document_tip, data_notificare, tip')
      .eq('session_id', session_id)
      .in('tip', ['instiintari_ancom', 'nr_iesire_ancom'])
      .order('numar', { ascending: false })
    const iesirePentru = (t: string) => {
      const ale = (iesireRows || []).filter((r: any) => r.document_tip === t)
      return ale.find((r: any) => r.tip === 'instiintari_ancom') || ale[0]
    }

    const allRows = [...(nrRowsSession || []), ...(nrRowsAll || [])]
    const roData = (d: string) => {
      const [y, m, dd] = String(d || '').slice(0, 10).split('-').map(Number)
      return y && m && dd ? new Date(y, m - 1, dd).toLocaleDateString('ro-RO') : ''
    }
    // Numărul și data afișate pentru un anumit document
    const nrPentru = (t: string) => {
      const ies = iesirePentru(t)
      const vechi = allRows.find((r: any) => r.document_tip === t)
      return {
        nr: ies ? String(ies.numar) : (nrMap[nrTipMap[t]] ? String(nrMap[nrTipMap[t]]) : ''),
        data: ies ? roData(ies.data_notificare)
          : vechi ? roData(vechi.data_notificare)
          : roData(session.session_date),
      }
    }

    const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
      day: '2-digit', month: 'long', year: 'numeric'
    })
    const courseStartDate = session.course_start_date
      ? new Date(session.course_start_date).toLocaleDateString('ro-RO', { day: '2-digit', month: 'long', year: 'numeric' })
      : sessionDate
    const dateStr = session.session_date.replace(/-/g, '_')
    const dataCurenta = new Date(session.session_date).toLocaleDateString('ro-RO')

    const perioadaCurs = courseStartDate === sessionDate
      ? sessionDate
      : `${courseStartDate} - ${sessionDate}`

    // Cele patru înștiințări, în ordinea în care se depun
    const TOATE_TIPURILE = ['curs-obtinere', 'examen-obtinere', 'curs-prelungire', 'examen-prelungire']
    const tipuri: string[] = body.toate === true ? TOATE_TIPURILE : [tip]

    // Template-uri editabile (admin → Template-uri Documente → Înștiințări ANCOM);
    // fără override în DB, textele sunt exact cele istorice din lib/doc-templates.
    const { data: tplRows } = await supabase
      .from('doc_templates').select('doc_type, key, content, align')
      .in('doc_type', TOATE_TIPURILE.map(ancomDocType))
    const tplOverride: Record<string, { content: string; align: string | null }> = {}
    for (const r of (tplRows || []) as any[]) tplOverride[`${r.doc_type}:${r.key}`] = { content: r.content, align: r.align }
    const tpl = (t: string, key: string) =>
      tplOverride[`${ancomDocType(t)}:${key}`]?.content ?? fragmentDefault(ancomDocType(t), key)
    const tplAlign = (t: string, key: string): DocAlign =>
      (tplOverride[`${ancomDocType(t)}:${key}`]?.align as DocAlign) || fragmentDefaultAlign(ancomDocType(t), key)

    const tplVars: Record<string, string> = {
      protocol_valabil_pana: protocolValabilPana,
      perioada_curs: perioadaCurs,
      data_start_curs: courseStartDate,
      data_examen: sessionDate,
      ora_examen: session.exam_time ? String(session.exam_time).slice(0, 5) : '',
      pers_contact_1: persContact1,
      pers_contact_2: persContact2,
    }

    // Textele fiecărui tip de înștiințare — apelate o dată sau de patru ori
    const textePentru = (t: string) => ({
      titluDoc: fillDocTemplate(tpl(t, 'titlu_doc'), tplVars).map(s => s.text).join(''),
      subiect: fillDocTemplate(tpl(t, 'subiect'), tplVars).map(s => s.text).join(''),
      adresare: fillDocTemplate(tpl(t, 'adresare'), tplVars).map(s => s.text).join(''),
      // corpul rămâne pe segmente: variabilele se randează bold
      corpLinii: tpl(t, 'corp').split('\n').map(l => ({ raw: l, segs: fillDocTemplate(l, tplVars) as Segment[] })),
    })

    const { titluDoc } = textePentru(tip)

    if (format === 'pdf') {
      const antetHtml = antetDoc?.file_data
        ? `<img src="${antetDoc.file_data}" style="max-width:100%;height:auto;max-height:117px;display:block;"/>`
        : `<div style="font-weight:bold;font-size:13pt;text-align:center;">S.C. SET SAIL ADVERTISING S.R.L.</div>`

      // Stampila apare doar daca cuStampila=true
      const stampilaHtml = !cuStampila
        ? ''
        : (stampilaDoc?.file_data
          ? `<img src="${stampilaDoc.file_data}" style="height:110px;width:auto;display:block;margin:0 auto;"/>`
          : `<div style="font-style:italic;color:#666;">Semnătură și ștampilă</div>`)

      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const segsHtml = (segs: Segment[]) => segs.map(s => {
        const t = esc(s.text)
        return s.bold ? `<strong>${t}</strong>` : s.italics ? `<em>${t}</em>` : t
      }).join('')

      // Construim paragrafele corpului
      const paragrafe = (linii: Array<{ raw: string; segs: Segment[] }>, align: DocAlign) => linii.map(l => {
        if (!l.raw.trim()) return `<p style="margin:6px 0;"></p>`
        if (l.raw.startsWith('-')) {
          return `<p style="margin:4px 0 4px 30px;">${segsHtml(l.segs)}</p>`
        }
        return `<p style="margin:6px 0;text-indent:40px;text-align:${align};">${segsHtml(l.segs)}</p>`
      }).join('')

      const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${body.toate === true ? (cuStampila ? 'Instiintari ANCOM (4)' : 'Instiintari ANCOM (4) fara stampila') : titluDoc}</title>
<style>
  @page { size: A4 portrait; margin: 4mm 20mm 20mm 20mm; }
  @media print {
    html { background: white !important; padding: 0 !important; }
    body {
      box-shadow: none !important;
      margin: 0 !important;
      padding: 0 !important;
      width: 100% !important;
      min-height: unset !important;
    }
    .no-print { display: none !important; }
  }
  html { background: #e0e0e0; padding: 20px; }
  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 11pt;
    line-height: 1.55;
    background: #fff;
    width: 170mm;
    min-height: 257mm;
    margin: 0 auto;
    padding: 4mm 20mm 20mm 20mm;
    box-shadow: 0 0 20px rgba(0,0,0,0.3);
    box-sizing: border-box;
  }
  .antet { margin-bottom: 10px; }
  .nr-data { text-align: right; margin: 10px 0 14px 0; font-size: 11pt; }
  .catre { margin: 0 0 14px 0; line-height: 1; }
  .catre p { margin: 2px 0; font-size: 11pt; line-height: 1; }
  .subiect { margin: 10px 0 18px 0; font-size: 11pt; line-height: 1.22; }
  .titlu-centrat { text-align: center; font-size: 13pt; font-weight: bold; margin: 22px 0 18px 0; }
  .corp { font-size: 11pt; }
  .semnatura-bloc {
    margin-top: 36px;
    display: flex;
    justify-content: flex-end;
  }
  .semnatura-dreapta {
    text-align: center;
    min-width: 200px;
  }
  .semnatura-dreapta .cu-stima { font-size: 11pt; margin-bottom: 2px; }
  .semnatura-dreapta .firma { font-weight: bold; font-size: 11pt; margin-bottom: 2px; }
  .semnatura-dreapta .director { font-size: 10.5pt; margin-bottom: 0; }
</style>
</head>
<body>

${tipuri.map((t, i) => {
  const txt = textePentru(t)
  const nrT = nrPentru(t)
  return `
  <div class="instiintare" style="${i < tipuri.length - 1 ? 'page-break-after:always;' : ''}">
  <!-- Antet -->
  <div class="antet">${antetHtml}</div>

  <!-- Nr si data -->
  <div class="nr-data"><strong>Nr. ${nrT.nr || '......'} / ${nrT.data}</strong></div>

  <!-- Catre -->
  <div class="catre">
    <p><strong>Către,</strong></p>
    <p>AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE</p>
    <p>ȘI REGLEMENTARE ÎN COMUNICAȚII</p>
  </div>

  <!-- Subiect -->
  <div class="subiect" style="text-align:${tplAlign(t, 'subiect')};">
    <span style="font-weight:bold;">Subiect: </span><em>${esc(txt.subiect)}</em>
  </div>

  <!-- Titlu -->
  <div class="titlu-centrat" style="text-align:${tplAlign(t, 'adresare')};">${esc(txt.adresare)}</div>

  <!-- Corp -->
  <div class="corp">${paragrafe(txt.corpLinii, tplAlign(t, 'corp'))}</div>

  <!-- Semnatura -->
  <div class="semnatura-bloc">
    <div class="semnatura-dreapta">
      <div class="cu-stima">Cu stimă,</div>
      <div class="firma">SC SET SAIL ADVERTISING SRL</div>
      <div class="director">director Cobianu Drugan Corina</div>
      ${stampilaHtml}
    </div>
  </div>
  </div>`
}).join('\n')}

</body>
</html>`

      return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      })
    }

    // ─── DOCX ──────────────────────────────────────────────────────────────
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType,
      convertMillimetersToTwip, ImageRun
    } = await import('docx')

    const bold = (t: string, sz = 22) => new TextRun({ text: t, bold: true, size: sz, font: 'Arial' })
    const reg  = (t: string, sz = 22) => new TextRun({ text: t, size: sz, font: 'Arial' })
    const boldItal = (t: string, sz = 22) => new TextRun({ text: t, bold: true, italics: true, size: sz, font: 'Arial' })
    const para = (ch: any[], align = AlignmentType.LEFT as any, sp = 120, indent?: number) =>
      new Paragraph({ alignment: align, spacing: { before: sp, after: sp }, indent: indent ? { firstLine: indent } : undefined, children: ch })

    // Antet
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

    // Stampila cu semnatura — DOAR daca cuStampila=true
    let stampilaImg: any[] = []
    if (cuStampila && stampilaDoc?.file_data) {
      try {
        const base64 = stampilaDoc.file_data.includes(',') ? stampilaDoc.file_data.split(',')[1] : stampilaDoc.file_data
        const buf = Buffer.from(base64, 'base64')
        const mt = stampilaDoc.file_data.includes('png') ? 'png' : 'jpg'
        stampilaImg = [new Paragraph({
          alignment: AlignmentType.RIGHT as any,
          spacing: { before: 120, after: 0 },
          children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 160, height: 110 } })]
        })]
      } catch(e) { console.error(e) }
    }

    const docxAlign = (a: DocAlign) =>
      a === 'center' ? AlignmentType.CENTER : a === 'right' ? AlignmentType.RIGHT
      : a === 'left' ? AlignmentType.LEFT : AlignmentType.JUSTIFIED
    const runs = (segs: Segment[], sz = 22) =>
      segs.map(s => new TextRun({ text: s.text, bold: s.bold, italics: s.italics, size: sz, font: 'Arial' }))

    // Corp paragraphs
    const corpParagrafe = (linii: Array<{ raw: string; segs: Segment[] }>, align: DocAlign) => {
    const corpParas: any[] = []
    for (const l of linii) {
      if (!l.raw.trim()) {
        corpParas.push(new Paragraph({ spacing: { before: 60, after: 60 }, children: [] }))
      } else if (l.raw.startsWith('-')) {
        corpParas.push(new Paragraph({
          alignment: docxAlign(align) as any,
          spacing: { before: 80, after: 80 },
          indent: { left: 720 },
          children: runs(l.segs)
        }))
      } else {
        corpParas.push(new Paragraph({
          alignment: docxAlign(align) as any,
          spacing: { before: 80, after: 80 },
          indent: (align === 'justify' || align === 'left') ? { firstLine: 720 } : undefined,
          children: runs(l.segs)
        }))
      }
    }
    return corpParas
    }

    // Conținutul unei înștiințări (o secțiune = o pagină nouă în Word)
    const paginaPentru = (t: string) => {
      const txt = textePentru(t)
      const nrT = nrPentru(t)
      return [
        ...headerImg,
        para([reg('Nr. ' + (nrT.nr || '......') + ' / ' + nrT.data)], AlignmentType.RIGHT as any, 200),
        new Paragraph({ spacing: { before: 200, after: 60 }, children: [bold('Către,')] }),
        new Paragraph({ spacing: { before: 0, after: 0 }, children: [reg('AUTORITATEA NAȚIONALĂ PENTRU ADMINISTRARE')] }),
        new Paragraph({ spacing: { before: 0, after: 200 }, children: [reg('ȘI REGLEMENTARE ÎN COMUNICAȚII')] }),
        new Paragraph({
          spacing: { before: 200, after: 200 },
          alignment: docxAlign(tplAlign(t, 'subiect')) as any,
          children: [bold('Subiect:   '), boldItal(txt.subiect)]
        }),
        para([bold(txt.adresare, 26)], docxAlign(tplAlign(t, 'adresare')) as any, 300),
        ...corpParagrafe(txt.corpLinii, tplAlign(t, 'corp')),
        new Paragraph({ spacing: { before: 600, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('Cu stimă,')] }),
        new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [bold('SC SET SAIL ADVERTISING SRL')] }),
        new Paragraph({ spacing: { before: 60, after: 0 }, alignment: AlignmentType.RIGHT as any, children: [reg('director Cobianu Drugan Corina')] }),
        ...stampilaImg,
        new Paragraph({ spacing: { before: 200, after: 0 }, children: [] }),
      ]
    }

    const pageProps = {
      page: {
        margin: {
          top: convertMillimetersToTwip(20),
          right: convertMillimetersToTwip(20),
          bottom: convertMillimetersToTwip(20),
          left: convertMillimetersToTwip(20),
        }
      }
    }
    const doc = new Document({
      sections: tipuri.map(t => ({ properties: pageProps, children: paginaPentru(t) })),
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${body.toate === true ? `Instiintari_ANCOM_toate_${dateStr}` : `Instiintare_ANCOM_${tip}_${dateStr}`}.docx"`
      }
    })

  } catch (err: any) {
    console.error('Instiintare ANCOM error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
