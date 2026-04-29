import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getHeaderImage } from '@/lib/antete'

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
    .order('order_in_session')

  if (!session || !students) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const headerImageBuffer = getHeaderImage(session.locations?.header_image || null)
  const headerB64 = headerImageBuffer ? headerImageBuffer.toString('base64') : null

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })
  const dateStr = session.session_date.replace(/-/g, '_')

  const evalRows = [
    {
      req: 'Verificarea inițială a ambarcațiunii înainte de plecare de la cheu, a situației traficului din jurul ambarcațiunii, a condițiilor meteo.',
      apt: 'Verificare stare tehnică a echipamentelor din dotare și a echipamentelor de siguranță (colaci salvare, veste salvare, echipament comunicații, VHF, etc.)',
    },
    {
      req: 'Demonstrare cunoștințe de marinărie.',
      apt: 'Recunoaștere/folosire accesorii punte, parâme, recunoaștere/executare noduri marinărești, volte, etc.',
    },
    {
      req: 'Demonstrare cunoștințe de manevră a ambarcațiunii.',
      apt: 'Operarea ambarcației (plecare de la cheu/acostare la cheu/ancorare, modul de molare a parâmelor, darea parâmelor și mod de luare a voltelor), conduita la întâlnirea și/sau depășirea altei nave.',
    },
    {
      req: 'Demonstrare cunoștințe de salvare/prevenire poluare.',
      apt: 'Manevra de om la apă (recuperarea în siguranță a unui colac de salvare aflat la apă), folosirea dispozitivelor și a echipamentelor de salvare a vieții, prevenirea și combaterea incendiilor, evitarea poluării.',
    },
  ]

  // Build HTML for all pages
  function studentPage(s: any, idx: number): string {
    const ciDoc = s.ci_series && s.ci_number
      ? `${s.ci_series} ${s.ci_number}`
      : (s.id_document || '')

    const domiciliu = [s.address, s.county].filter(Boolean).join(', ')

    const sigHtml = s.signature_data
      ? `<img src="${s.signature_data}" style="height:45px;max-width:160px;display:block;margin-top:4px;" />`
      : `<div style="border-bottom:1px solid #000;width:160px;height:45px;"></div>`

    const evalRowsHtml = evalRows.map(r => `
      <tr>
        <td style="border:1px solid #000;padding:5px 6px;font-size:12.8pt;vertical-align:top;">${r.req}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:12.8pt;vertical-align:top;">${r.apt}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:12.8pt;vertical-align:top;"></td>
      </tr>`).join('')

    const headerHtml = ''  // fara antet

    return `
    <div style="page-break-after:${idx < students.length - 1 ? 'always' : 'auto'};padding:14mm 14mm 10mm 14mm;font-family:Arial,sans-serif;font-size:13.5pt;color:#000;">

      ${headerHtml}

      <div style="font-weight:bold;font-size:16.5pt;margin-bottom:2px;">Fișă de verificare aptitudini</div>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
        <div style="font-weight:bold;font-size:15pt;">pentru conducerea și manevra ambarcațiunii de agrement</div>
        <div style="font-size:13.5pt;white-space:nowrap;padding-left:24px;">Anexa 10</div>
      </div>
      <div style="font-size:12.8pt;margin-bottom:8px;">Pentru obținerea Certificatului Internațional de Conducător de ambarcațiune de agrement</div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:6px;">
        <tr>
          <td style="padding:2px 0;width:50%;"><b>CLASA:</b> ${s.class_caa || session.class_caa}</td>
          <td style="padding:2px 0;"><b>Perioada:</b> ${sessionDate}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding:2px 0;"><b>Numele și prenumele:</b> ${s.full_name || ''}</td>
        </tr>
        <tr>
          <td style="padding:2px 0;"><b>CNP:</b> ${s.cnp || '.............................'}</td>
          <td style="padding:2px 0;"><b>Document identitate:</b> ${ciDoc || '...............'}</td>
        </tr>
        ${domiciliu ? `<tr><td colspan="2" style="padding:2px 0;"><b>Domiciliu:</b> ${domiciliu}</td></tr>` : ''}
        ${s.email || s.phone ? `<tr>
          <td style="padding:2px 0;">${s.email ? `<b>Email:</b> ${s.email}` : ''}</td>
          <td style="padding:2px 0;">${s.phone ? `<b>Tel:</b> ${s.phone}` : ''}</td>
        </tr>` : ''}
      </table>

      <div style="font-weight:bold;margin-bottom:4px;">Verificări:</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr style="background:#e0e0e0;">
            <th style="border:1px solid #000;padding:4px 6px;font-size:12.8pt;width:35%;text-align:center;">Cerințe</th>
            <th style="border:1px solid #000;padding:4px 6px;font-size:12.8pt;width:48%;text-align:center;">Aptitudini</th>
            <th style="border:1px solid #000;padding:4px 6px;font-size:12.8pt;width:17%;text-align:center;">Obs. (admis/respins)</th>
          </tr>
        </thead>
        <tbody>${evalRowsHtml}</tbody>
      </table>

      <div style="margin-bottom:10px;font-size:13.5pt;">
        Rezultat evaluare finală .............................................................................(admis/respins)
      </div>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="width:50%;padding:2px 0;font-size:13.5pt;"><b>Data:</b> ${sessionDate}</td>
          <td style="text-align:right;font-size:13.5pt;"><b>Întocmit,</b></td>
        </tr>
        <tr>
          <td style="padding-top:4px;">
            <div style="font-size:13.5pt;font-weight:bold;margin-bottom:2px;">Semnătura cursant: ${s.full_name || ''}</div>
            ${sigHtml}
          </td>
          <td style="vertical-align:bottom;text-align:right;padding-top:4px;">
            <div style="font-size:12.8pt;">Nume și prenume / semnătura evaluator</div>
            <div style="border-bottom:1px solid #000;width:160px;height:30px;display:inline-block;margin-top:4px;"></div>
          </td>
        </tr>
      </table>

      <div style="text-align:center;font-size:10.5pt;color:#666;margin-top:8px;">
        SetSail Advertising SRL — ${session.locations?.name || ''} — ${sessionDate} — ${idx + 1}/${students.length}
      </div>
    </div>`
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { background:#fff; }
  @media print { body { margin:0; } }
</style>
</head>
<body>
${students.map((s: any, i: number) => studentPage(s, i)).join('\n')}
</body>
</html>`

  // Return HTML optimizat pentru print / salvare ca PDF
  return new NextResponse(fullHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Pdf-Fallback': 'true',
    }
  })
}
