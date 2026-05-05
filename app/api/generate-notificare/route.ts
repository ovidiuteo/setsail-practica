import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, ImageRun,
  AlignmentType, BorderStyle
} from 'docx'

export async function POST(req: NextRequest) {
  const { notification_id, cu_stampila } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: notif } = await supabase
    .from('notifications')
    .select('*, sessions(*, locations(*), boats(*))')
    .eq('id', notification_id)
    .single()

  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sess = notif.sessions as any
  const loc = sess?.locations

  const { data: infoRows } = await supabase.from('setsail_info').select('key, value')
  const info: Record<string, string> = {}
  infoRows?.forEach((r: any) => { info[r.key] = r.value || '' })

  const tipStampila = cu_stampila ? 'stampila_cu_semnatura' : 'stampila_fara_semnatura'
  const { data: docStampila } = await supabase
    .from('setsail_documents').select('file_data').eq('tip', tipStampila).single()

  // Date
  const dataNotif = new Date(notif.data_notificare)
  const dataSesiune = new Date(sess.session_date)
  const ziuaSesiune = dataSesiune.getDate()
  const lunaSesiune = dataSesiune.toLocaleDateString('ro-RO', { month: 'long' })
  const anulSesiune = dataSesiune.getFullYear()

  // Intervalul curs
  const courseStartDate = sess.course_start_date ? new Date(sess.course_start_date) : null
  const intervalCurs = courseStartDate
    ? `${courseStartDate.getDate()} - ${ziuaSesiune} ${lunaSesiune}`
    : `${ziuaSesiune} ${lunaSesiune}`

  const barci = (notif.barci_selectate || []).join(' și ')
  const clasaRaw: string = notif.clasa || sess.class_caa || ''
  const clasaParts = clasaRaw.split(',').map((c: string) => c.trim()).filter(Boolean)
  const clasa = clasaParts.length > 0
    ? clasaParts.join('/') + '/Manevra ambarcatiunii cu vele'
    : ''

  const locName2 = (loc?.name || '').toLowerCase()
  const adresaSetsail = info['adresa'] || 'str. Virgiliu nr. 15, etaj 3, Sector 1, București'
  const locatieCurs = notif.locatie_curs || (() => {
    if (locName2.includes('snagov')) return `${adresaSetsail}/Lacul Snagov`
    if (locName2.includes('limanu')) return `${adresaSetsail}/Marina Limanu`
    if (locName2.includes('mangalia')) return `${adresaSetsail}/Marina Mangalia`
    return `${adresaSetsail}/${loc?.name || ''}`
  })()
  const locatieExaminare = notif.locatie_examinare || (() => {
    if (locName2.includes('snagov')) return 'de pe Lacul Snagov'
    if (locName2.includes('limanu')) return 'din Marina Limanu'
    if (locName2.includes('mangalia')) return 'din Marina Mangalia'
    return `din ${loc?.name || ''}`
  })()

  const ora = notif.ora_examinare || '10:00'
  const nrNotif = notif.nr_notificare || ''
  const reprezentant = info['reprezentant_legal'] || 'Cobianu Drugan Corna Elena'
  const numeFirma = info['nume_firma'] || 'SC SET SAIL ADVERSTISING SRL'
  const locNameDisplay = loc?.name || 'locatie'

  // Formatare Times New Roman 12pt ca in PDF
  const FONT = 'Times New Roman'
  const SIZE = 24      // 12pt in half-points
  const SIZE_NR = 20   // 10pt pentru nr notificare
  const INDENT = 720   // ~1.27cm in twips pentru primul rand

  const para = (text: string, opts?: {
    indent?: boolean, bold?: boolean, size?: number,
    spacing_before?: number, spacing_after?: number,
    align?: typeof AlignmentType[keyof typeof AlignmentType]
  }) => new Paragraph({
    alignment: opts?.align ?? AlignmentType.JUSTIFIED,
    indent: opts?.indent ? { firstLine: INDENT } : undefined,
    spacing: {
      before: opts?.spacing_before ?? 0,
      after: opts?.spacing_after ?? 200,
      line: 276, // ~1.15 line spacing (240 = single)
    },
    children: [new TextRun({
      text,
      font: FONT,
      size: opts?.size ?? SIZE,
      bold: opts?.bold ?? false,
    })]
  })

  const children: any[] = [
    // Nr. notificare
    para(`Nr. ${nrNotif}`, { size: SIZE_NR, spacing_before: 0, spacing_after: 2400, align: AlignmentType.LEFT }),

    // Către
    para('Către: Autoritatea Navală Română', { spacing_before: 0, spacing_after: 2400, align: AlignmentType.LEFT }),

    // Paragraf 1 — corp
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: INDENT },
      spacing: { before: 0, after: 240, line: 276 },
      children: [new TextRun({
        text: `Subscrisa ${numeFirma}, în calitate de furnizor de educație, formare profesională și perfecționare pentru cursurile de pregătire în vederea obținerii certificatelor internaționale de conducător de ambarcațiune de agrement/Manevra ambarcațiunii cu vele, vă notific prin prezenta că în perioada ${intervalCurs} vom desfășura cursuri de pregătire teoretică/practică în vederea obținerii certificatelor internaționale de conducator ambarcațiune de agrement pentru clasele ${clasa} în locația aprobată din ${locatieCurs}.`,
        font: FONT, size: SIZE,
      })]
    }),

    // Paragraf 2 — corp
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      indent: { firstLine: INDENT },
      spacing: { before: 0, after: 2400, line: 276 },
      children: [new TextRun({
        text: `Solicităm totodată participarea unui reprezentant al Autorității Navale Române pentru examinarea practică de promovare a cursului pregătire în vederea obținerii certificatului internațional de conducător ambarcațiune de agrement pentru clasele ${clasaRaw.replace(',', '/')}, în locația aprobată ${locatieExaminare}, cu ambarcațiunile declarate ${barci} la data de ${ziuaSesiune} ${lunaSesiune}, începând cu ora ${ora}.`,
        font: FONT, size: SIZE,
      })]
    }),

    // Reprezentant
    para('Reprezentant,', { spacing_before: 0, spacing_after: 160, align: AlignmentType.LEFT }),
    para(reprezentant, { spacing_before: 0, spacing_after: 200, align: AlignmentType.LEFT }),
  ]

  // Stampila
  if (docStampila?.file_data) {
    try {
      const base64 = docStampila.file_data.split(',')[1] || docStampila.file_data
      const imgBuffer = Buffer.from(base64, 'base64')
      const mediaType = docStampila.file_data.includes('png') ? 'png' : 'jpg'
      children.push(new Paragraph({
        spacing: { before: 0, after: 0 },
        children: [new ImageRun({
          data: imgBuffer,
          type: mediaType as 'png' | 'jpg',
          transformation: { width: 120, height: 120 }
        })]
      }))
    } catch (e) { console.error('Stampila error:', e) }
  }

  const doc = new Document({
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE } }
      }
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: 1418,   // ~2.5cm
            right: 1134, // ~2cm
            bottom: 1134,
            left: 1701,  // ~3cm stanga
          }
        }
      },
      children
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `Notificare_${locNameDisplay}_${ziuaSesiune}_${lunaSesiune}_${anulSesiune}${cu_stampila ? '_semnat' : ''}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}
