import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { tintSignatureToBlue } from '@/lib/sign-tint'
import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import JSZip from 'jszip'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fonturi cu suport diacritice românești (ș ț ă î â) – standardele PDF nu le au
const FONT_DIR = path.join(process.cwd(), 'app/api/verificare-ancom/fonts')
const FONT_REG = fs.readFileSync(path.join(FONT_DIR, 'DejaVuSans.ttf'))
const FONT_BOLD = fs.readFileSync(path.join(FONT_DIR, 'DejaVuSans-Bold.ttf'))

const MARGIN = 56.7 // 20mm în puncte
type Run = { t: string; b?: boolean }

function newDoc(): any {
  const doc = new PDFDocument({ size: 'A4', margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } })
  doc.registerFont('R', FONT_REG)
  doc.registerFont('B', FONT_BOLD)
  doc.font('R')
  return doc
}

function docToBuffer(doc: any): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
    doc.end()
  })
}

// Paragraf cu segmente inline (bold / normal), justified + indent la prima linie
function para(doc: any, runs: Run[], opts: { align?: string; indent?: number; size?: number; lineGap?: number } = {}) {
  const { align = 'justify', indent = 0, size = 11, lineGap = 3 } = opts
  doc.fontSize(size)
  runs.forEach((r, i) => {
    doc.font(r.b ? 'B' : 'R')
    doc.text(r.t, { continued: i < runs.length - 1, align, indent: i === 0 ? indent : 0, lineGap })
  })
}

function decodeDataUrl(dataUrl: string): { buf: Buffer; mime: string } | null {
  const m = /^data:([^;]+);base64,([\s\S]*)$/.exec(dataUrl || '')
  if (!m) return null
  return { mime: m[1].toLowerCase(), buf: Buffer.from(m[2], 'base64') }
}

// ── PDF cerere ANCOM (A4) ────────────────────────────────────────────────
async function cererePdf(s: any, opts: { isPrelungire: boolean; sessionDate: string; cerereDate: string }): Promise<Buffer> {
  const { isPrelungire, sessionDate, cerereDate } = opts
  const doc = newDoc()
  const cw = doc.page.width - MARGIN * 2

  doc.fontSize(8).fillColor('#666').text('Durata medie de completare: 4 minute', { align: 'left' })
  doc.moveDown(0.6).fillColor('#000')
  doc.font('B').fontSize(13).text(isPrelungire ? 'CERERE DE PRELUNGIRE A VALABILITĂȚII' : 'CERERE DE EXAMINARE OPERATORI RADIO', { align: 'center' })
  doc.moveDown(0.4)
  doc.font('B').fontSize(11).text('Domnule Președinte,', { align: 'center' })
  doc.moveDown(0.8)

  const F = (v: any) => String(v ?? '').trim() || '............'
  const body: Run[] = isPrelungire
    ? [
        { t: 'Subsemnatul/a ' }, { t: F(s.full_name), b: true }, { t: ', domiciliat/ă în ' },
        { t: F(s.city), b: true }, { t: ', adresa ' }, { t: F(s.address), b: true },
        { t: ', sectorul/județul ' }, { t: F(s.county), b: true }, { t: ', telefon ' }, { t: F(s.phone), b: true },
        { t: ', e-mail: ' }, { t: F(s.email), b: true }, { t: ', posesor al B.I./C.I. seria ' }, { t: F(s.ci_series), b: true },
        { t: ' nr. ' }, { t: F(s.ci_number), b: true }, { t: ', CNP ' }, { t: F(s.cnp), b: true },
        { t: ' vă rog a-mi aproba ' }, { t: 'prelungirea valabilității', b: true }, { t: ' certificatului ' },
        { t: 'GMDSS-LRC¹', b: true }, { t: ' de operator radiotelefonist în serviciul ' }, { t: 'SMMS²', b: true },
        { t: ', cu nr. ........ din data ............' },
      ]
    : [
        { t: 'Subsemnatul/a ' }, { t: F(s.full_name), b: true }, { t: ', domiciliat/ă în ' },
        { t: F(s.city), b: true }, { t: ', adresa ' }, { t: F(s.address), b: true },
        { t: ', sectorul/județul ' }, { t: F(s.county), b: true }, { t: ', telefon ' }, { t: F(s.phone), b: true },
        { t: ', e-mail: ' }, { t: F(s.email), b: true },
        { t: ', vă rog a-mi aproba susținerea examenului pentru obținerea certificatului ' },
        { t: 'GMDSS-LRC¹', b: true }, { t: ' de operator radio în serviciul ' }, { t: 'SMMS²', b: true },
        { t: ' în data de: ' }, { t: sessionDate, b: true },
        { t: ' la sediul ' }, { t: 'SC SETSAIL ADVERTISING SRL', b: true },
        { t: ' din localitatea ' }, { t: 'București', b: true }, { t: ', sectorul/județul ' }, { t: '1', b: true }, { t: '.' },
      ]
  para(doc, body, { indent: 24, size: 11, lineGap: 4 })
  doc.moveDown(0.6)
  para(doc, [{ t: 'Anexez la această cerere documentele prevăzute în Decizia Președintelui ANCOM nr. 543/2017 privind certificarea personalului operator al stațiilor de radiocomunicații.' }], { indent: 24, size: 11, lineGap: 4 })
  doc.moveDown(0.5)

  const GDPR = 'Autoritatea Națională pentru Administrare și Reglementare în Comunicații prelucrează datele dumneavoastră personale în conformitate cu dispozițiile Regulamentului (UE) 2016/679. Scopul prelucrarii îl constituie îndeplinirea obligațiilor legale privind aplicarea politicii naționale în domeniul comunicațiilor electronice, comunicațiilor audiovizuale și al serviciilor poștale, inclusiv prin reglementarea pieței și reglementarea tehnică în aceste domenii, respectând dispozițiile legale, normele și procedurile interne existente în acest sens. În situația în care ANCOM va prelucra ulterior datele cu caracter personal într-un alt scop decât cel pentru care acestea au fost colectate, veți fi informat despre acest lucru înainte de inițierea prelucrării, primind toate detaliile necesare. Datele pot fi dezvăluite de ANCOM unor terți doar în baza unui temei legal. Persoanele vizate de prelucrare își pot exercita toate drepturile prevăzute de Regulamentul 2016/679/UE printr-o cerere scrisă, semnată și datată, trimisă pe adresa autorității. Toate informațiile necesare privind protecția persoanelor fizice în ceea ce priveste prelucrarea datelor cu caracter personal și libera circulație a acestor date sunt disponibile pe pagina de internet http://www.ancom.org.ro/, la secțiunea "GDPR".'
  doc.font('R').fontSize(8.5).text(GDPR, { align: 'justify', lineGap: 1.5 })
  doc.moveDown(1)

  // Data (stânga) + Semnătura (dreapta)
  const yBlock = doc.y
  doc.font('B').fontSize(11).text(`Data ${cerereDate}`, MARGIN, yBlock, { align: 'left' })
  doc.font('R').fontSize(11).text('Semnătura,', MARGIN, yBlock, { align: 'right' })

  // Semnătura recolorată albastru, dacă există
  const sigSrc = s.signature_data || s.signature_random
  let sigY = doc.y + 4
  if (sigSrc) {
    try {
      const tinted = await tintSignatureToBlue(sigSrc)
      const sigBuf = tinted || Buffer.from(sigSrc.includes(',') ? sigSrc.split(',')[1] : sigSrc, 'base64')
      const sw = 150, sh = 50
      doc.image(sigBuf, doc.page.width - MARGIN - sw, sigY, { width: sw, height: sh })
      sigY += sh + 2
    } catch { /* fallback la linie */ }
  }
  doc.font('R').fontSize(11).text('..................................', MARGIN, sigY, { align: 'right' })

  // Linie + note de subsol
  doc.moveDown(1.2)
  const yHr = doc.y
  doc.moveTo(MARGIN, yHr).lineTo(MARGIN + cw, yHr).lineWidth(0.5).strokeColor('#aaaaaa').stroke()
  doc.moveDown(0.4).fillColor('#000')
  doc.font('R').fontSize(8).text('¹ Se va menționa tipul certificatului: general (GOC-AERO; GOC-GMDSS ; GMDSS-LRC ); restrâns (ROC-AERO; ROC-GMDSS); CNI (pe căile de navigație interioară) Radioelectronist clasa I/ a-II-a.', { lineGap: 1 })
  doc.moveDown(0.2)
  doc.font('R').fontSize(8).text('² Se va menționa tipul serviciului: Serviciul mobil aeronautic și mobil aeronautic prin satelit (SMAS) Serviciul mobil maritim și mobil maritim prin satelit (SMMS) Serviciul radiotelefonic pe căile de navigație interioară (SRCNI)', { lineGap: 1 })

  return docToBuffer(doc)
}

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

      const cerere = await cererePdf(s, { isPrelungire, sessionDate, cerereDate })
      zip.file(`${name}/${name} - Cerere ${isPrelungire ? 'prelungire' : 'obtinere'}.pdf`, cerere)

      const ci = await ciPdf(s)
      if (ci) zip.file(`${name}/${name} - CI.pdf`, ci)
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
