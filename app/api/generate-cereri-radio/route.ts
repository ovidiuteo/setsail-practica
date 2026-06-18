import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tintSignatureToBlue, tintSignatureToBlueDataUrl } from '@/lib/sign-tint'

// Genereaza cereri oficiale ANCOM per cursant
// tip: 'obtinere' | 'prelungire'
// format: 'docx' | 'pdf'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { session_id } = body
    const tip = body.tip || 'obtinere'
    const format = body.format || 'pdf'
    const isPrelungire = tip === 'prelungire'

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: session } = await supabase
      .from('sessions').select('*, locations(*)').eq('id', session_id).single()

    const { data: allStudents } = await supabase
      .from('students').select('*')
      .eq('session_id', session_id).eq('only_sailing', false)
      .order('order_in_session')

    if (!session || !allStudents) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Filtrăm după clasa CAA:
    // - Prelungire (reconfirmare): doar "Prelungire LRC"
    // - Obținere:                  "Obtinere LRC" + "Radio"
    const students = allStudents.filter((s: any) => {
      const c = String(s.class_caa || '').toLowerCase().trim()
      return isPrelungire
        ? c.includes('prelungire')
        : (c.includes('obtinere') || c.includes('obținere') || c === 'radio')
    })

    const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    })
    // Data de pe cerere = data practicii minus 6 zile
    const _cd = new Date(session.session_date); _cd.setDate(_cd.getDate() - 6)
    const cerereDate = _cd.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const dateStr = session.session_date.replace(/-/g, '_')
    const lunaAn = new Date(session.session_date).toLocaleDateString('ro-RO', { month: 'long', year: 'numeric' })
    // Titlu doc = nume default la „Save as PDF" + numele tab-ului
    const docTitle = `Cereri ${isPrelungire ? 'prelungire' : 'obtinere'} LRC ${lunaAn} SetSail`
    const gdprText = 'Autoritatea Națională pentru Administrare și Reglementare în Comunicații prelucrează datele dumneavoastră personale în conformitate cu dispozițiile Regulamentului (UE) 2016/679. Scopul prelucrarii îl constituie îndeplinirea obligațiilor legale privind aplicarea politicii naționale în domeniul comunicațiilor electronice, comunicațiilor audiovizuale și al serviciilor poștale, inclusiv prin reglementarea pieței și reglementarea tehnică în aceste domenii, respectând dispozițiile legale, normele și procedurile interne existente în acest sens. În situația în care ANCOM va prelucra ulterior datele cu caracter personal într-un alt scop decât cel pentru care acestea au fost colectate, veți fi informat despre acest lucru înainte de inițierea prelucrării, primind toate detaliile necesare. Datele pot fi dezvăluite de ANCOM unor terți doar în baza unui temei legal. Persoanele vizate de prelucrare își pot exercita toate drepturile prevăzute de Regulamentul 2016/679/UE printr-o cerere scrisă, semnată și datată, trimisă pe adresa autorității. Toate informațiile necesare privind protecția persoanelor fizice în ceea ce priveste prelucrarea datelor cu caracter personal și libera circulație a acestor date sunt disponibile pe pagina de internet http://www.ancom.org.ro/, la secțiunea "GDPR".'

    const fn1 = '¹ Se va menționa tipul certificatului: general (GOC-AERO; GOC-GMDSS ; GMDSS-LRC ); restrâns (ROC-AERO; ROC-GMDSS); CNI (pe căile de navigație interioară) Radioelectronist clasa I/ a-II-a.'
    const fn2 = '² Se va menționa tipul serviciului: Serviciul mobil aeronautic și mobil aeronautic prin satelit (SMAS) Serviciul mobil maritim și mobil maritim prin satelit (SMMS) Serviciul radiotelefonic pe căile de navigație interioară (SRCNI)'

    // PDF
    if (format === 'pdf') {
      const pagesArr = await Promise.all(students.map(async s => {
        const F = (val: string | null | undefined, width = '120px', center = true) =>
          `<span style="border-bottom:1px solid #000;display:inline-block;min-width:${width};padding:0 2px;${center ? 'text-align:center;' : ''}">${val || ''}</span>`
        // semnatura recolorata albastru „de pix"
        const _sigRaw = s.signature_data || s.signature_random
        const sigBlue = _sigRaw ? await tintSignatureToBlueDataUrl(_sigRaw) : null

        const body = isPrelungire
          ? `Subsemnatul/a ${F(s.full_name, '160px')}, domiciliat/ă în
             ${F(s.city)}, adresa&nbsp;&nbsp; ${F(s.address, '70%', true)},
             sectorul/județul ${F(s.county)}, telefon ${F(s.phone)},
             e-mail: ${F(s.email, '160px')}, posesor al B.I./C.I. seria ${F(s.ci_series,'30px')} nr.
             ${F(s.ci_number,'60px')}, CNP ${F(s.cnp,'120px')}
             vă rog a-mi aproba <strong>prelungirea valabilității</strong> certificatului
             <strong>GMDSS-LRC</strong>¹ de operator radiotelefonist în serviciul
             <strong>SMMS</strong>², cu nr. ${F(null,'60px')} din data ${F(null,'80px')}.`
          : `Subsemnatul/a ${F(s.full_name, '160px')}, domiciliat/ă în
             ${F(s.city)}, adresa&nbsp;&nbsp; ${F(s.address, '70%', true)},
             sectorul/județul ${F(s.county)}, telefon ${F(s.phone)},
             e-mail: ${F(s.email, '160px')}, vă rog a-mi aproba susținerea examenului pentru
             obținerea certificatului <strong>GMDSS-LRC</strong>¹ de operator radio în serviciul
             <strong>SMMS</strong>² în data de: ${F(sessionDate,'80px')}
             la sediul ${F('SC SETSAIL ADVERTISING SRL','180px')} din
             localitatea ${F('București','80px')}, sectorul/județul ${F('1','20px')}.`

        return `<div class="page">
          <div style="font-size:8pt;color:#666;margin-bottom:10px;">Durata medie de completare: 4 minute</div>
          <h2>${isPrelungire ? 'CERERE DE PRELUNGIRE A VALABILITĂȚII' : 'CERERE DE EXAMINARE OPERATORI RADIO'}</h2>
          <h3>Domnule Președinte,</h3>
          <p class="body">${body}</p>
          <p class="body">Anexez la această cerere documentele prevăzute în Decizia Președintelui ANCOM nr. 543/2017 privind certificarea personalului operator al stațiilor de radiocomunicații.</p>
          <p class="gdpr">${gdprText}</p>
          <div class="footer-row">
            <div>Data ${F(cerereDate,'80px')}</div>
            <div class="semn">Semnătura,<br>${sigBlue ? `<img src="${sigBlue}" style="height:45px;max-width:160px;object-fit:contain;vertical-align:bottom;"/><br>` : '<br><br>'}${F(null,'140px')}</div>
          </div>
          <hr class="fn-line">
          <p class="fn">¹ ${fn1.substring(2)}</p>
          <p class="fn">² ${fn2.substring(2)}</p>
        </div>`
      }))
      const pagesHtml = pagesArr.join('<div class="page-break"></div>')

      const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>${docTitle}</title>
<style>
  @page { size: A4; margin: 20mm; }
  @media print { html,body{background:white!important;padding:0!important;} body{box-shadow:none!important;margin:0!important;padding:0!important;width:auto!important;} .page-break{page-break-after:always;} }
  html { background:#e0e0e0; padding:20px; }
  body { font-family:Tahoma,Arial,sans-serif; font-size:11pt; background:#fff; width:170mm; margin:0 auto; padding:15mm; box-shadow:0 0 20px rgba(0,0,0,0.3); }
  .page { margin-bottom:20mm; }
  .page-break { border:none; margin:30px 0; }
  h2 { text-align:center; font-size:13pt; text-transform:uppercase; margin:0 0 10px 0; }
  h3 { text-align:center; font-size:11pt; font-weight:bold; margin:0 0 20px 0; }
  .body { text-align:justify; line-height:1.8; margin:10px 0; text-indent:30px; }
  .gdpr { font-size:8.5pt; text-align:justify; line-height:1.4; margin:14px 0; }
  .footer-row { display:flex; justify-content:space-between; align-items:flex-end; margin-top:30px; }
  .semn { text-align:right; }
  .fn-line { border:none; border-top:1px solid #aaa; margin:20px 0 5px 0; }
  .fn { font-size:8pt; margin:2px 0; line-height:1.3; }
</style>
</head><body>${pagesHtml}</body></html>`

      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    // DOCX
    const {
      Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun,
      convertMillimetersToTwip, PageBreak, UnderlineType, TabStopType, TabStopPosition
    } = await import('docx')

    const T = (font = 'Tahoma', sz = 24) => ({ font, size: sz, lang: { ro: 'ro-RO' } } as any)
    const t = (text: string, bold = false, sz = 24) =>
      new TextRun({ text, bold, size: sz, font: 'Tahoma' })
    const tb = (text: string, sz = 24) => t(text, true, sz)
    const sp = (n = 1) => t('\u00A0'.repeat(n))
    const dots = (n = 20) => t('.'.repeat(n))
    const line = (n = 30) => t('.'.repeat(n))

    const GDPR = new Paragraph({
      alignment: AlignmentType.JUSTIFIED as any,
      spacing: { before: 160, after: 160 },
      children: [t(gdprText, false, 20)]
    })

    const FN1 = new Paragraph({ spacing: { before: 0, after: 40 }, children: [
      new TextRun({ text: '1', size: 18, font: 'Tahoma', superScript: true }),
      t(' Se va menționa tipul certificatului: general (GOC-AERO; GOC-GMDSS ; GMDSS-LRC ); restrâns (ROC-AERO; ROC-GMDSS); CNI (pe căile de navigație interioară) Radioelectronist clasa I/ a-II-a.', false, 18)
    ]})
    const FN2 = new Paragraph({ spacing: { before: 0, after: 0 }, children: [
      new TextRun({ text: '2', size: 18, font: 'Tahoma', superScript: true }),
      t(' Se va menționa tipul serviciului: Serviciul mobil aeronautic și mobil aeronautic prin satelit (SMAS) Serviciul mobil maritim și mobil maritim prin satelit (SMMS) Serviciul radiotelefonic pe căile de navigație interioară (SRCNI)', false, 18)
    ]})

    const HR = new Paragraph({
      spacing: { before: 240, after: 60 },
      border: { top: { style: 'single' as any, size: 4, color: 'AAAAAA', space: 1 } },
      children: []
    })

    const allChildren: any[] = []

    for (let idx = 0; idx < students.length; idx++) {
      const s = students[idx]
      if (idx > 0) allChildren.push(new Paragraph({ children: [new PageBreak()] }))

      const nome = s.full_name || '.....................................'
      const oras = s.city || '...................'
      const addr = s.address || '.'.repeat(70)
      const jud  = s.county || '...................'
      const tel  = s.phone || '...................'
      const mail = s.email || '.........................................'
      const ci_s = s.ci_series || '.....'
      const ci_n = s.ci_number || '.........'
      const cnp  = s.cnp || '...................'

      // Titlu
      allChildren.push(
        new Paragraph({ alignment: AlignmentType.CENTER as any, spacing: { before: 0, after: 80 }, children: [
          t('Durata medie de completare: 4 minute', false, 20)
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER as any, spacing: { before: 80, after: 80 }, children: [
          new TextRun({ text: isPrelungire ? 'CERERE DE PRELUNGIRE A VALABILITĂȚII' : 'CERERE DE EXAMINARE OPERATORI RADIO', bold: true, size: 28, font: 'Tahoma', allCaps: true })
        ]}),
        new Paragraph({ alignment: AlignmentType.CENTER as any, spacing: { before: 80, after: 200 }, children: [
          tb('Domnule Președinte,', 26)
        ]}),
      )

      // Corp principal
      if (isPrelungire) {
        allChildren.push(
          new Paragraph({ alignment: AlignmentType.JUSTIFIED as any, spacing: { before: 0, after: 120 }, indent: { firstLine: 720 }, children: [
            t('Subsemnatul/a '), tb(nome), t(', domiciliat/ă în '),
            tb(oras), t(', adresa '), tb(addr),
            t(', sectorul/județul '), tb(jud), t(', telefon '), tb(tel),
            t(', e-mail: '), tb(mail), t(', posesor al B.I./C.I. seria '), tb(ci_s),
            t(' nr. '), tb(ci_n), t(', CNP '), tb(cnp),
            t(' vă rog a-mi aproba '),
            tb('prelungirea valabilității'), t(' certificatului '),
            tb('GMDSS-LRC'),
            new TextRun({ text: '1', size: 20, font: 'Tahoma', superScript: true }),
            t(' de operator radiotelefonist în serviciul '),
            tb('SMMS'),
            new TextRun({ text: '2', size: 20, font: 'Tahoma', superScript: true }),
            t(', cu nr. '), dots(8), t(' din data '), dots(12), t('.'),
          ]}),
        )
      } else {
        allChildren.push(
          new Paragraph({ alignment: AlignmentType.JUSTIFIED as any, spacing: { before: 0, after: 120 }, indent: { firstLine: 720 }, children: [
            t('Subsemnatul/a '), tb(nome), t(', domiciliat/ă în '),
            tb(oras), t(', adresa '), tb(addr),
            t(', sectorul/județul '), tb(jud), t(', telefon '), tb(tel),
            t(', e-mail: '), tb(mail),
            t(', vă rog a-mi aproba susținerea examenului pentru obținerea certificatului '),
            tb('GMDSS-LRC'),
            new TextRun({ text: '1', size: 20, font: 'Tahoma', superScript: true }),
            t(' de operator radio în serviciul '),
            tb('SMMS'),
            new TextRun({ text: '2', size: 20, font: 'Tahoma', superScript: true }),
            t(' în data de: '), tb(sessionDate),
            t(' la sediul '), tb('SC SETSAIL ADVERTISING SRL'),
            t(' din localitatea '), tb('București'), t(', sectorul/județul '), tb('1'), t('.'),
          ]}),
        )
      }

      // Semnatura din platforma (pattern Anexa 10): imagine daca exista, altfel linie
      const sigSrc = s.signature_data || s.signature_random
      let sigPara: any = null
      if (sigSrc) {
        try {
          const tinted = await tintSignatureToBlue(sigSrc)
          const data = tinted || Buffer.from(sigSrc.includes(',') ? sigSrc.split(',')[1] : sigSrc, 'base64')
          sigPara = new Paragraph({ alignment: AlignmentType.RIGHT as any, spacing: { before: 120, after: 0 }, children: [
            new ImageRun({ data, type: 'png', transformation: { width: 150, height: 52 } })
          ]})
        } catch { /* fallback la linie */ }
      }
      if (!sigPara) sigPara = new Paragraph({ alignment: AlignmentType.RIGHT as any, spacing: { before: 120, after: 0 }, children: [t(' ')] })

      allChildren.push(
        new Paragraph({ alignment: AlignmentType.JUSTIFIED as any, spacing: { before: 80, after: 80 }, indent: { firstLine: 720 }, children: [
          t('Anexez la această cerere documentele prevăzute în Decizia Președintelui ANCOM nr. 543/2017 privind certificarea personalului operator al stațiilor de radiocomunicații.')
        ]}),
        GDPR,
        // Data si semnatura
        new Paragraph({ spacing: { before: 200, after: 0 }, indent: { firstLine: 720 }, children: [
          tb('Data '), tb(cerereDate)
        ]}),
        new Paragraph({ alignment: AlignmentType.RIGHT as any, spacing: { before: 0, after: 0 }, children: [t('Semnătura,')] }),
        sigPara,
        new Paragraph({ alignment: AlignmentType.RIGHT as any, spacing: { before: 0, after: 400 }, children: [t('..................................')] }),
        // Note subsol
        HR, FN1, FN2
      )
    }

    const doc = new Document({
      sections: [{
        properties: {
          page: {
            margin: {
              top: convertMillimetersToTwip(20), right: convertMillimetersToTwip(20),
              bottom: convertMillimetersToTwip(20), left: convertMillimetersToTwip(20),
            }
          }
        },
        children: allChildren
      }]
    })

    const buffer = await Packer.toBuffer(doc)
    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Cereri_${tip}_${dateStr}.docx"`
      }
    })

  } catch (err: any) {
    console.error('Cereri radio error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}