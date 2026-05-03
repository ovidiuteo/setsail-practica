import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const { session_id } = await req.json()

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: session } = await supabase
    .from('sessions').select('*, locations(*), boats(*), evaluators(*), instructors(*)')
    .eq('id', session_id).single()

  const { data: students } = await supabase
    .from('students').select('*').eq('session_id', session_id).order('order_in_session')

  if (!session || !students) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const sessionDate = new Date(session.session_date).toLocaleDateString('ro-RO', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  // Exact aceleasi texte ca in DOCX
  const evalRows = [
    {
      req: 'Verificarea iniţială a ambarcaţiunii înainte de plecare de la cheu, a situaţiei traficului din jurul ambarcaţiunii, a condiţiilor meteo.',
      apt: 'Verificare stare tehnică a echipamentelor din dotare şi a echipamentelor de siguranţă (colaci salvare, veste salvare, echipament comunicaţii, aparatura/echipamente ambarcaţiune, mod funcţionare motor/instalaţie guvernare, VHF, etc.)',
    },
    {
      req: 'Demonstrare cunostinţe de marinărie.',
      apt: 'Recunoaştere/folosire accesorii punte, parâme, recunoaştere/executare noduri marinăreşti, volte, etc.',
    },
    {
      req: 'Demonstrare cunostinţe de manevră a ambarcaţiunii.',
      apt: 'Operarea ambarcaţiunii (plecare de la cheu/acostare la cheu/ancorare, modul de molare a parâmelor, darea parâmelor şi mod de luare a voltelor), conduita la întâlnirea şi/sau depăşirea altei nave.',
    },
    {
      req: 'Demonstrare cunostinţe de salvare/prevenire poluare.',
      apt: 'Manevra de om la apă (recuperarea în siguranţă a unui colac de salvare aflat la apă), folosirea dispozitivelor şi a echipamentelor de salvare a vieţii, prevenirea şi combaterea incendiilor, evitarea poluării.',
    },
  ]

  function dot(val: string | null | undefined) {
    return val || '___________________________________'
  }

  function studentPage(s: any): string {
    const ciDoc = s.ci_series && s.ci_number
      ? `${s.ci_series} ${s.ci_number}`
      : (s.id_document || '___________________________')

    const sigHtml = s.signature_data
      ? `<img src="${s.signature_data}" style="height:55px;max-width:160px;display:block;margin-top:2px;" />`
      : `<div style="height:40px;"></div>`

    const evalRowsHtml = evalRows.map(r => `
      <tr>
        <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;vertical-align:top;font-weight:bold;width:33%;">${r.req}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;vertical-align:top;width:49%;">${r.apt}</td>
        <td style="border:1px solid #000;padding:5px 6px;font-size:10pt;vertical-align:top;width:18%;"></td>
      </tr>`).join('')

    return `<div style="
      width:210mm; height:297mm;
      padding:14mm 13mm 10mm 15mm;
      box-sizing:border-box;
      font-family:Arial,sans-serif;
      font-size:11pt;
      color:#000;
      page-break-after:always;
      overflow:hidden;
    ">

      <!-- TITLU -->
      <p style="font-size:15pt;font-weight:bold;margin:0 0 2px 0;">Fișă de verificare aptitudini</p>
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:12px;">
        <span style="font-size:15pt;font-weight:bold;">pentru conducerea și manevra ambarcațiunii de agrement</span>
        <span style="font-size:11pt;white-space:nowrap;padding-left:20px;">Anexa 10</span>
      </div>

      <!-- DATE CANDIDAT -->
      <p style="font-size:11pt;font-weight:bold;margin:0 0 5px 0;">Pentru obţinerea Certificatului Internaţional de Conducător de ambarcațiune de agrement</p>
      <p style="margin:0 0 4px 0;font-size:11pt;"><b>CLASA:</b> ${(s.class_caa || session.class_caa || '').replace(',', '+') || '___________'}</p>
      <p style="margin:0 0 4px 0;font-size:11pt;"><b>Perioada de desfăşurare curs:</b> ${sessionDate}</p>
      <p style="margin:0 0 6px 0;font-size:11pt;"><b>Numele şi prenumele candidatului:</b> ${s.full_name || '_______________________________________________'}</p>
      <p style="margin:0 0 4px 0;font-size:11pt;"><b>CNP:</b> ${dot(s.cnp)}</p>
      <p style="margin:0 0 10px 0;font-size:11pt;"><b>Document de identitate:</b> ${ciDoc}</p>

      <!-- TABEL VERIFICĂRI -->
      <p style="font-weight:bold;font-size:11pt;margin:0 0 4px 0;">Verificări:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:8px;">
        <thead>
          <tr>
            <th style="border:1px solid #000;padding:4px 6px;font-size:11pt;width:33%;text-align:center;">Cerinţe</th>
            <th style="border:1px solid #000;padding:4px 6px;font-size:11pt;width:49%;text-align:center;font-style:italic;">Aptitudini</th>
            <th style="border:1px solid #000;padding:4px 6px;font-size:11pt;width:18%;text-align:center;font-style:italic;">Observaţii (admis / respins)</th>
          </tr>
        </thead>
        <tbody>${evalRowsHtml}</tbody>
      </table>

      <!-- REZULTAT -->
      <p style="margin:8px 0 10px 0;font-size:11pt;">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Rezultat evaluare finală .......................................................................(admis/respins)</p>

      <!-- SEMNĂTURI -->
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:11pt;"><b>Data:</b> ${sessionDate}</span>
        <span style="font-size:11pt;">Intocmit,</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
        <span></span>
        <span style="font-size:11pt;">Nume şi prenume/semnătura</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-bottom:14px;">
        <span></span>
        <span style="font-size:11pt;font-weight:bold;">${session.evaluators?.full_name || '............................'}</span>
      </div>

      <!-- SEMNĂTURĂ CURSANT -->
      <p style="font-size:11pt;margin:0 0 2px 0;">Nume şi prenume/semnătura cursant</p>
      <p style="font-size:11pt;font-weight:bold;margin:0 0 4px 0;">${s.full_name || '............................'}</p>
      ${sigHtml}
      <p style="font-size:11pt;margin:4px 0 0 0;">............................ .............................</p>
    </div>`
  }

  const fullHtml = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { background:#fff; }
  @page { size:A4 portrait; margin:0; }
  @media print { body { margin:0; } }
</style>
</head>
<body>
${students.map((s: any) => studentPage(s)).join('\n')}
</body>
</html>`

  return new NextResponse(fullHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'X-Pdf-Fallback': 'true',
    }
  })
}