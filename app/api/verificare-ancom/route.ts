import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import JSZip from 'jszip'
import { cererePdf, newDoc, docToBuffer, decodeDataUrl, MARGIN } from '@/lib/cerere-radio-pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'


// ── PDF copie CI (A4) – imaginea încadrată pe pagină ─────────────────────
async function ciPdf(s: any): Promise<Buffer | null> {
  const parts = decodeDataUrl(s.ci_image_data)
  if (!parts) return null
  // Dacă e deja PDF, îl returnăm ca atare
  if (parts.mime.includes('pdf')) return parts.buf
  // pdfkit acceptă doar JPEG/PNG
  if (!/jpe?g|png/.test(parts.mime)) return null

  const doc = newDoc()
  const cw = doc.page.width - MARGIN * 2
  doc.font('B').fontSize(11).fillColor('#000').text(`Copie act de identitate — ${String(s.full_name || '').trim()}`, { align: 'center' })
  doc.moveDown(0.8)
  const top = doc.y
  const ch = doc.page.height - MARGIN - top
  try {
    doc.image(parts.buf, MARGIN, top, { fit: [cw, ch], align: 'center', valign: 'top' })
  } catch {
    doc.end(); return null
  }
  return docToBuffer(doc)
}

const slug = (n: string) => (n || 'cursant').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { session_id } = body
    if (!session_id) return NextResponse.json({ error: 'session_id lipsă' }, { status: 400 })
    const idsFilter: string[] | null = Array.isArray(body.student_ids) && body.student_ids.length ? body.student_ids.map(String) : null

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: session } = await supabase.from('sessions').select('*').eq('id', session_id).single()
    if (!session) return NextResponse.json({ error: 'Sesiune negăsită' }, { status: 404 })

    let q = supabase.from('students').select('*')
      .eq('session_id', session_id).eq('only_sailing', false).eq('verificare_ancom', true)
      .order('order_in_session')
    const { data: allChecked } = await q
    let students = (allChecked || [])
    if (idsFilter) students = students.filter((s: any) => idsFilter.includes(String(s.id)))
    if (!students.length) return NextResponse.json({ error: 'Niciun cursant bifat pentru verificare ANCOM.' }, { status: 400 })

    const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const _cd = new Date(session.session_date); _cd.setDate(_cd.getDate() - 6)
    const cerereDate = _cd.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' })

    const zip = new JSZip()
    const missing: string[] = []

    for (const s of students as any[]) {
      const name = slug(s.full_name)
      const c = String(s.class_caa || '').toLowerCase()
      const isPrelungire = c.includes('prelungire')
      const grup = isPrelungire ? 'prelungire' : 'obtinere' // folder mare per tip

      const cerere = await cererePdf(s, { isPrelungire, sessionDate, cerereDate })
      zip.file(`${grup}/${name}/${name} - Cerere ${grup}.pdf`, cerere)

      const ci = await ciPdf(s)
      if (ci) zip.file(`${grup}/${name}/${name} - CI.pdf`, ci)
      else missing.push(s.full_name)
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' })
    const dateStr = String(session.session_date).replace(/-/g, '_')
    return new NextResponse(zipBuf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Verificare_ANCOM_${dateStr}.zip"`,
        'X-Missing-Ci': encodeURIComponent(missing.join(', ')),
      },
    })
  } catch (err: any) {
    console.error('verificare-ancom error:', err)
    return NextResponse.json({ error: err?.message || 'Eroare' }, { status: 500 })
  }
}
