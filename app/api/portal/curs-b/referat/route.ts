import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { newDoc, docToBuffer, MARGIN } from '@/lib/cerere-radio-pdf'
import { CURS_B } from '@/lib/curs-b/continut'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Referatul cursantului de la cursul B/A — notele lui, puse în formatul lucrării
// lui Radu Diaconescu (copertă, cuprins, zile, subiecte).
//   POST { student_id, access_code } -> PDF

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

const ziRo = (d: Date) => `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`

export async function POST(req: NextRequest) {
  const sb = svc()
  const { student_id, access_code } = await req.json().catch(() => ({}))
  if (!student_id || !access_code) return NextResponse.json({ error: 'date lipsă' }, { status: 400 })

  const { data: st } = await sb.from('students')
    .select('id, full_name, sessions!session_id(access_code, session_date, class_caa)')
    .eq('id', student_id).maybeSingle()
  const sess: any = (st as any)?.sessions
  if (!st || !sess || String(sess.access_code).toUpperCase() !== String(access_code).toUpperCase())
    return NextResponse.json({ error: 'unauthorized' }, { status: 403 })

  const { data: noteRows } = await sb.from('curs_b_note').select('cheie, text').eq('student_id', student_id)
  const note: Record<string, string> = {}
  for (const n of (noteRows || []) as any[]) if (String(n.text || '').trim()) note[n.cheie] = n.text

  const nume = String((st as any).full_name || 'Cursant').trim()
  const azi = ziRo(new Date())
  const doc = newDoc()
  const cw = doc.page.width - MARGIN * 2
  const antet = (text: string) => {
    doc.font('R').fontSize(8).fillColor('#888')
      .text(text, MARGIN, MARGIN / 2, { width: cw, align: 'left' })
    doc.fillColor('#000')
  }

  // ── Copertă ──
  doc.moveDown(6)
  doc.font('B').fontSize(18).text('Conducere ambarcațiune de agrement', { align: 'center' })
  doc.font('B').fontSize(18).text('cu vele – obținere permis categoria B', { align: 'center' })
  doc.moveDown(2)
  doc.font('R').fontSize(13).text(`Cursant: ${nume}`, { align: 'center' })
  doc.font('R').fontSize(12).text(azi, { align: 'center' })
  doc.moveDown(3)
  doc.font('B').fontSize(16).text('Referat', { align: 'center' })
  doc.font('B').fontSize(16).text('Note Curs', { align: 'center' })

  // ── Cuprins ──
  doc.addPage()
  antet(`NOTE CURS B/A — ${nume}`)
  doc.font('B').fontSize(14).text('Cuprins', { align: 'left' })
  doc.moveDown(0.6)
  for (const zi of CURS_B) {
    doc.font('B').fontSize(10).fillColor('#000')
      .text(`Curs B Ziua ${zi.zi} – ${zi.instructor} – ${zi.titlu}${zi.data ? ` ${zi.data}` : ''}`, { lineGap: 2 })
    for (const s of zi.subiecte) {
      const are = !!note[s.cheie]
      doc.font('R').fontSize(9).fillColor(are ? '#000' : '#999')
        .text(`• ${s.titlu}${are ? '' : ' (fără notițe)'}`, { indent: 14, lineGap: 1 })
    }
    doc.moveDown(0.5)
  }
  doc.fillColor('#000')

  // ── Zilele, cu notițele cursantului ──
  for (const zi of CURS_B) {
    doc.addPage()
    antet(`NOTE CURS B/A — ${nume}`)
    doc.font('B').fontSize(13)
      .text(`Curs B Ziua ${zi.zi} – ${zi.instructor} – ${zi.titlu}${zi.data ? ` ${zi.data}` : ''}`, { lineGap: 3 })
    doc.moveDown(0.6)

    for (const s of zi.subiecte) {
      const text = note[s.cheie]
      if (!text) continue
      doc.font('B').fontSize(11).text(s.titlu, { lineGap: 2 })
      doc.font('R').fontSize(10).text(text, { align: 'left', lineGap: 2.5, indent: 10 })
      doc.moveDown(0.7)
    }

    if (!zi.subiecte.some(s => note[s.cheie])) {
      doc.font('R').fontSize(10).fillColor('#999').text('Fără notițe la această zi.', { lineGap: 2 })
      doc.fillColor('#000')
    }
  }

  const pdf = await docToBuffer(doc)
  const fisier = `Referat Curs B - ${nume}.pdf`
  const ascii = fisier.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '')
  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fisier)}`,
    },
  })
}
