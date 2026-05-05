import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, WidthType, BorderStyle
} from 'docx'

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}

export async function POST(req: NextRequest) {
  const { notification_id, cu_stampila } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Trage notificarea cu sesiunea si locatia
  const { data: notif } = await supabase
    .from('notifications')
    .select('*, sessions(*, locations(*), boats(*))')
    .eq('id', notification_id)
    .single()

  if (!notif) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sess = notif.sessions as any
  const loc = sess?.locations
  const locName = loc?.name || 'Locatie'

  // Trage info SetSail
  const { data: infoRows } = await supabase.from('setsail_info').select('key, value')
  const info: Record<string, string> = {}
  infoRows?.forEach((r: any) => { info[r.key] = r.value || '' })

  // Trage stampila (cu sau fara semnatura)
  const tipStampila = cu_stampila ? 'stampila_cu_semnatura' : 'stampila_fara_semnatura'
  const { data: docStampila } = await supabase
    .from('setsail_documents')
    .select('file_data')
    .eq('tip', tipStampila)
    .single()

  // Date notificare
  const dataNotif = new Date(notif.data_notificare)
  const dataFormatata = dataNotif.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const dataSesiune = new Date(sess.session_date)
  const ziuaSesiune = dataSesiune.getDate()
  const lunaSesiune = dataSesiune.toLocaleDateString('ro-RO', { month: 'long' })
  const anulSesiune = dataSesiune.getFullYear()

  // Intervalul curs: data_start - data_practica
  const courseStartDate = sess.course_start_date ? new Date(sess.course_start_date) : null
  const intervalCurs = courseStartDate
    ? `${courseStartDate.getDate()} - ${ziuaSesiune} ${lunaSesiune}`
    : `${ziuaSesiune} ${lunaSesiune}`

  const barci = (notif.barci_selectate || []).join(' și ')
  const clasaRaw: string = notif.clasa || sess.class_caa || ''
  // C,D  -> "C/D/Manevra ambarcatiunii cu vele"
  // B    -> "B/Manevra ambarcatiunii cu vele"
  const clasaParts = clasaRaw.split(',').map((c: string) => c.trim()).filter(Boolean)
  const clasa = clasaParts.length > 0
    ? clasaParts.join('/') + '/Manevra ambarcatiunii cu vele'
    : ''
  const ora = notif.ora_examinare || '10:00'
  const nrNotif = notif.nr_notificare || ''
  const adresaLoc = loc?.location_detail || `Marina ${locName}`
  const reprezentant = info['reprezentant_legal'] || 'Cobianu Drugan Corna Elena'
  const functie = info['functie_reprezentant'] || 'Reprezentant'
  const adresaSetsail = info['adresa'] || 'str. Virgiliu nr. 15, etaj 3, Sector 1, București'
  const numeFirma = info['nume_firma'] || 'SC SET SAIL ADVERSTISING SRL'

  // Construim paragrafele principale
  const children: any[] = []

  // Nr. notificare
  children.push(new Paragraph({
    spacing: { after: 400 },
    children: [new TextRun({ text: `Nr. ${nrNotif}`, size: 22, font: 'Arial' })]
  }))

  // Destinatar
  children.push(new Paragraph({
    spacing: { after: 600 },
    children: [new TextRun({ text: 'Către: Autoritatea Navală Română', size: 22, font: 'Arial' })]
  }))

  // Corp text - paragraful 1
  children.push(new Paragraph({
    spacing: { after: 240 },
    indent: { firstLine: 720 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({
      text: `Subscrisa ${numeFirma}, în calitate de furnizor de educație, formare profesională și perfecționare pentru cursurile de pregătire în vederea obținerii certificatelor internaționale de conducător de ambarcațiune de agrement/Manevra ambarcațiunii cu vele, vă notific prin prezenta că în perioada 4 - ${ziuaSesiune} ${lunaSesiune} vom desfășura cursuri de pregătire teoretică/practică în vederea obținerii certificatelor internaționale de conducator ambarcațiune de agrement pentru clasele ${clasa} în locația aprobată din ${adresaSetsail}/${adresaLoc}.`,
      size: 22, font: 'Arial'
    })]
  }))

  // Corp text - paragraful 2
  children.push(new Paragraph({
    spacing: { after: 800 },
    indent: { firstLine: 720 },
    alignment: AlignmentType.JUSTIFIED,
    children: [new TextRun({
      text: `Solicităm totodată participarea unui reprezentant al Autorității Navale Române pentru examinarea practică de promovare a cursului pregătire în vederea obținerii certificatului internațional de conducător ambarcațiune de agrement pentru clasele ${clasaRaw.replace(',', '/')}, în locația aprobată din ${adresaLoc}, cu ambarcațiunile declarate ${barci} la data de ${ziuaSesiune} ${lunaSesiune}, începând cu ora ${ora}.`,
      size: 22, font: 'Arial'
    })]
  }))

  // Semnatura
  children.push(new Paragraph({
    spacing: { after: 80 },
    children: [new TextRun({ text: 'Reprezentant,', size: 22, font: 'Arial' })]
  }))

  children.push(new Paragraph({
    spacing: { after: 160 },
    children: [new TextRun({ text: reprezentant, size: 22, font: 'Arial' })]
  }))

  // Stampila (daca exista)
  if (docStampila?.file_data) {
    try {
      const base64 = docStampila.file_data.split(',')[1] || docStampila.file_data
      const imgBuffer = Buffer.from(base64, 'base64')
      const mediaType = docStampila.file_data.includes('png') ? 'png' : 'jpg'
      children.push(new Paragraph({
        children: [new ImageRun({
          data: imgBuffer,
          type: mediaType as 'png' | 'jpg',
          transformation: { width: 120, height: 120 }
        })]
      }))
    } catch (e) {
      console.error('Stampila error:', e)
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } // ~2cm
        }
      },
      children
    }]
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `Notificare_${locName}_${ziuaSesiune}_${lunaSesiune}_${anulSesiune}${cu_stampila ? '_semnat' : ''}.docx`

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`
    }
  })
}