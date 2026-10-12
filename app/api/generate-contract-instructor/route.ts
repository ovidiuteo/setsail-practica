import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { verifyToken, ADMIN_COOKIE_NAME } from '@/lib/admin-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Contractul de prestări servicii cu un instructor, după modelul SetSail.
//   GET ?id=<contract>            -> .docx
//   GET ?id=<contract>&format=html -> previzualizare în pagină

function svc() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { fetch: (input: any, init?: any) => fetch(input, { ...init, cache: 'no-store' }) } },
  )
}

const ziRo = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '...............'

const PRESTATOR =
  'S.C. SET SAIL ADVERTISING SRL, persoană juridică română, cu sediul în București, Str. Stirbei-Voda, nr. 152, ' +
  'bl. 26 B, sc. 4, et. 4, ap. 12, Sector 1, cod fiscal RO 16792276, nr. de înregistrare la Registrul Comerțului ' +
  'J40/15358/2004, cont bancar deschis la Banca Transilvania – București, nr. RO02BTRL04501202A79304XX, ' +
  'reprezentată prin Corina Cobianu Drugan, în calitate de furnizor (denumită în continuare „Prestator”),'

// Articolele fixe ale contractului. Primul rând al fiecărui articol e titlul.
function articole(tarifTeorie: number, tarifPractica: number, start: string, sfarsit: string) {
  return [
    ['Articolul 1 – Obiectul contractului',
      '1.1. Prestatorul se obligă să presteze servicii de instructor pentru cursurile teoretice și practice necesare obținerii certificatelor internaționale de conducător de ambarcațiuni de agrement, în conformitate cu reglementările Autorității Navale Române.',
      '1.2. Prestatorul va susține lecțiile, va coordona activitățile de practică și va asigura îndeplinirea cerințelor programei cursului.'],
    ['Articolul 2 – Durata contractului',
      `2.1. Prezentul contract se încheie pe perioada ${start} – ${sfarsit}.`],
    ['Articolul 3 – Remunerația',
      '3.1. Instructorul va fi remunerat pentru activitatea desfășurată conform următoarelor condiții:',
      `${tarifTeorie} lei/ora de teorie, pentru fiecare oră efectivă de curs teoretic desfășurat.`,
      `${tarifPractica} lei/zi de practică, pentru fiecare zi efectivă de curs practic desfășurat.`,
      '3.2. Plata se va face prin transfer bancar în termen de 15 zile de la prestarea serviciului, în contul bancar al Instructorului indicat de acesta.'],
    ['Articolul 4 – Obligațiile Prestatorului (Instructorului)',
      '4.1. Instructorul se obligă să presteze serviciile de instruire teoretică și practică conform unui program stabilit de comun acord cu Beneficiarul.',
      '4.2. Instructorul va asigura calitatea cursurilor, va respecta toate normele legale și reglementările Autorității Navale Române privind formarea conducătorilor de ambarcațiuni de agrement.',
      '4.3. Instructorul va furniza toate materialele necesare pentru cursuri și va sprijini participanții în procesul de învățare.'],
    ['Articolul 5 – Obligațiile Beneficiarului (S.C. SET SAIL ADVERTISING SRL)',
      '5.1. Beneficiarul se obligă să asigure condițiile necesare pentru desfășurarea cursurilor (locație, materiale didactice, ambarcațiuni pentru practica de pe apă etc.).',
      '5.2. Beneficiarul va plăti Prestatorului conform prevederilor articolului 3.'],
    ['Articolul 6 – Confidențialitatea',
      '6.1. Părțile se obligă să păstreze confidențialitatea tuturor informațiilor referitoare la activitatea desfășurată în cadrul acestui contract, inclusiv informațiile personale și comerciale.',
      '6.2. Prevederea privind confidențialitatea rămâne valabilă și după încetarea acestui contract.'],
    ['Articolul 7 – Forța majoră',
      '7.1. Părțile nu vor răspunde pentru neîndeplinirea obligațiilor asumate în cazul în care acest lucru se datorează unui eveniment de forță majoră, conform legii.',
      '7.2. Partea care invocă forța majoră va notifica cealaltă parte în termen de 1 zi de la producerea evenimentului de forță majoră.'],
    ['Articolul 8 – Rezilierea contractului',
      '8.1. Prezentul contract poate fi reziliat prin acordul părților sau prin denunțare unilaterală de oricare dintre părți, cu un preaviz de 30 zile.',
      '8.2. Preavizul se va comunica în scris, iar rezilierea va produce efecte la expirarea termenului de preaviz.'],
    ['Articolul 9 – Litigii',
      '9.1. Litigile ce decurg din interpretarea și executarea prezentului contract vor fi soluționate de părți pe cale amiabilă.',
      '9.2. Litigile de orice fel dintre părți, purtând asupra prezentului contract, sunt de competența instanțelor judecătorești, conform legislației în vigoare.'],
    ['Articolul 10 – Dispoziții finale',
      '10.1. Prezentul contract intră în vigoare la data semnării de către ambele părți.',
      '10.2. Oricare modificare a prezentului contract se va face în scris și va fi semnată de ambele părți.',
      '10.3. Acest contract este întocmit în două exemplare, câte unul pentru fiecare parte.'],
  ]
}

export async function GET(req: NextRequest) {
  if (!verifyToken(req.cookies.get(ADMIN_COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id') || ''
  const format = req.nextUrl.searchParams.get('format') || 'docx'
  if (!id) return NextResponse.json({ error: 'lipsește contractul' }, { status: 400 })

  const sb = svc()
  const { data: c } = await sb.from('contracte_instructor').select('*').eq('id', id).maybeSingle()
  if (!c) return NextResponse.json({ error: 'contractul nu există' }, { status: 404 })

  // „Ștampilă cu semnătură SSA" din configurator — semnătura Corinei peste ștampilă
  const { data: stampilaDoc } = await sb.from('setsail_documents')
    .select('file_data').eq('tip', 'stampila_cu_semnatura').maybeSingle()
  const stampila = String((stampilaDoc as any)?.file_data || '')

  const nume = String((c as any).nume || '').trim() || '...............'
  const domiciliu = String((c as any).domiciliu || '').trim() || '...............'
  const cnp = String((c as any).cnp || '').trim() || '...............'
  const dataC = ziRo((c as any).data_contract)
  const start = ziRo((c as any).perioada_start)
  const sfarsit = ziRo((c as any).perioada_sfarsit)
  const parti =
    `Dl./Dna. ${nume}, domiciliat/ă în ${domiciliu}, CNP ${cnp}, în calitate de instructor ` +
    '(denumit în continuare „Prestator” sau „Instructor”).'
  const intro =
    'Părțile încheie un contract de prestări servicii de instructaj in cadrul organizarii și desfășurarii cursurilor ' +
    'necesare obținerii certificatelor internaționale de conducător de ambarcațiuni de agrement, si convin următoarele:'
  const art = articole((c as any).tarif_teorie ?? 100, (c as any).tarif_practica ?? 500, start, sfarsit)

  if (format === 'html') {
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const corp = art.map(([titlu, ...randuri]) =>
      `<h3>${esc(titlu)}</h3>${randuri.map(r => `<p>${esc(r)}</p>`).join('')}`).join('')
    return new NextResponse(
      `<!DOCTYPE html><html lang="ro"><head><meta charset="utf-8"><title>Contract nr. ${(c as any).numar}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;line-height:1.5;max-width:18cm;margin:1.5cm auto;color:#111}
h1{text-align:center;font-size:15px;margin:0}h2{text-align:center;font-size:12px;font-weight:normal;margin:4px 0 18px}
h3{font-size:12px;margin:14px 0 4px}p{margin:4px 0}.semn{display:flex;justify-content:space-between;margin-top:40px}</style></head><body>
<h1>CONTRACT DE PRESTĂRI SERVICII</h1><h2>nr. ${(c as any).numar} din ${dataC}, încheiat între</h2>
<p>${esc(PRESTATOR)}</p><p>și</p><p>${esc(parti)}</p><p>${esc(intro)}</p>${corp}
<div class="semn"><div><b>Semnătura Beneficiar</b><br>S.C. SET SAIL ADVERTISING SRL<br>prin Corina Cobianu Drugan
${stampila ? `<br><img src="${stampila}" style="width:160px;margin-top:6px">` : ''}</div>
<div><b>Semnătura Prestator (Instructor)</b><br>${esc(nume)}</div></div></body></html>`,
      { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const { Document, Packer, Paragraph, TextRun, AlignmentType, ImageRun } = await import('docx')
  const reg = (t: string, bold = false) => new TextRun({ text: t, size: 22, font: 'Arial', bold })
  const p = (t: string, opts?: { bold?: boolean; align?: any; before?: number; after?: number }) =>
    new Paragraph({
      alignment: opts?.align ?? AlignmentType.JUSTIFIED,
      spacing: { before: opts?.before ?? 40, after: opts?.after ?? 40 },
      children: [reg(t, opts?.bold)],
    })

  // Ștampila cu semnătura Corinei, sub semnătura Beneficiarului
  let stampilaImg: any[] = []
  if (stampila) {
    try {
      const base64 = stampila.includes(',') ? stampila.split(',')[1] : stampila
      const buf = Buffer.from(base64, 'base64')
      const mt = stampila.includes('png') ? 'png' : 'jpg'
      stampilaImg = [new Paragraph({
        spacing: { before: 60 },
        children: [new ImageRun({ data: buf, type: mt as any, transformation: { width: 160, height: 110 } })],
      })]
    } catch (e) { console.error(e) }
  }

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1100 } } },
      children: [
        p('CONTRACT DE PRESTĂRI SERVICII', { bold: true, align: AlignmentType.CENTER, before: 0, after: 0 }),
        p(`nr. ${(c as any).numar} din ${dataC}, încheiat între`, { align: AlignmentType.CENTER, after: 200 }),
        p(PRESTATOR),
        p('și'),
        p(parti),
        p(intro, { after: 160 }),
        ...art.flatMap(([titlu, ...randuri]) => [
          p(titlu, { bold: true, before: 200 }),
          ...randuri.map(r => p(r)),
        ]),
        p('', { before: 400 }),
        p('Semnătura Beneficiar                                              Semnătura Prestator (Instructor)', { bold: true }),
        p(`S.C. SET SAIL ADVERTISING SRL                              ${nume}`),
        p('prin Corina Cobianu Drugan'),
        ...stampilaImg,
      ],
    }],
  })

  const buffer = await Packer.toBuffer(doc)
  const filename = `Contract instructor nr ${(c as any).numar} ${nume}.docx`
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      // antetele HTTP sunt latin-1: numele merge și curățat de diacritice
      'Content-Disposition': `attachment; filename="${filename.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^ -~]/g, '')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
