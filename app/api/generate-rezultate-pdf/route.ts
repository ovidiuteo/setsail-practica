import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatDateRO(date: string | null | undefined): string {
  if (!date) return ''
  const d = new Date(date)
  if (isNaN(d.getTime())) return ''
  const months = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie',
                  'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie']
  const days = ['duminică', 'luni', 'marți', 'miercuri', 'joi', 'vineri', 'sâmbătă']
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const examId = body.exam_id
    if (!examId) {
      return NextResponse.json({ error: 'exam_id required' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { data: exam } = await supabase
      .from('radio_exams')
      .select('id, cod_generare, profesor_grila, profesor_engleza, session_id')
      .eq('id', examId)
      .single()
    if (!exam) {
      return NextResponse.json({ error: 'Exam not found' }, { status: 404 })
    }

    const { data: sess } = await supabase
      .from('sessions')
      .select('id, session_date, access_code, class_caa')
      .eq('id', exam.session_id)
      .single()

    const { data: questions } = await supabase
      .from('radio_exam_questions')
      .select('order_no, correct_option, pool_question_code')
      .eq('exam_id', examId)
      .order('order_no', { ascending: true })

    if (!questions || questions.length === 0) {
      return NextResponse.json({ error: 'No questions for this exam' }, { status: 404 })
    }

    const dateStr = formatDateRO(sess?.session_date)
    const codGen = exam.cod_generare || ''

    // Construim rândurile tabelului
    const rowsHtml = questions.map((q: any) => {
      const correct = q.correct_option as 'A' | 'B' | 'C' | 'D'
      const poolCode = q.pool_question_code || ''
      // Extragem doar numărul din "Q17" → "17"
      const poolNum = poolCode.replace(/[^0-9]/g, '')
      const cell = (letter: 'A' | 'B' | 'C' | 'D') =>
        letter === correct
          ? `<td class="cell"><div class="bar"></div></td>`
          : `<td class="cell"></td>`
      return `<tr>
        <td class="num">${q.order_no}</td>
        ${cell('A')}${cell('B')}${cell('C')}${cell('D')}
        <td class="num">${escapeHtml(poolNum)}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="ro">
<head>
<meta charset="utf-8" />
<title>Rezultate test ${escapeHtml(codGen)}</title>
<style>
  * { box-sizing: border-box; }
  body {
    font-family: Arial, sans-serif;
    margin: 0;
    padding: 24px;
    color: #000;
    background: #fff;
  }
  h1 {
    text-align: center;
    font-size: 22pt;
    font-weight: bold;
    margin: 8px 0 12px;
    letter-spacing: 0.5px;
  }
  .subtitle {
    text-align: center;
    font-size: 9pt;
    max-width: 90%;
    margin: 0 auto 8px;
    line-height: 1.35;
  }
  .blue-line {
    border: none;
    border-top: 2px solid #0033a0;
    margin: 8px auto 18px;
    width: 96%;
  }
  table.results {
    width: 92%;
    margin: 0 auto;
    border-collapse: collapse;
    table-layout: fixed;
  }
  table.results th {
    background: #fff;
    color: #000;
    font-weight: bold;
    text-align: center;
    padding: 6px 4px;
    border: 1px solid #000;
    font-size: 11pt;
  }
  table.results th.h-num { width: 60px; }
  table.results th.h-right { width: 50px; border-left: 1px solid #000; }
  table.results td {
    background: #000;
    border: 1px solid #000;
    height: 26px;
    vertical-align: middle;
  }
  table.results td.num {
    color: #fff;
    text-align: center;
    font-weight: bold;
    font-size: 11pt;
  }
  table.results td.cell {
    padding: 0 8px;
  }
  .bar {
    background: #fff;
    height: 12px;
    width: 100%;
  }
  .footer {
    margin-top: 20px;
    display: flex;
    justify-content: space-between;
    font-size: 9pt;
    font-style: italic;
    padding: 0 4%;
  }
  @page {
    size: A4;
    margin: 1cm;
  }
  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <h1>REZULTATE TEST</h1>
  <p class="subtitle">
    Probă de regulamente interne şi internaţionale pentru examenul de obţinere a Certificatului General de
    Operator radio pentru ambarcaţiuni de agrement în Serviciile Mobil Maritim şi Mobil Maritim prin Satelit
    emis în conformitate Rezoluţia 343 (WRC-97) şi Recomandarea CEPT ERC 31-05 E
  </p>
  <hr class="blue-line" />
  <table class="results">
    <thead>
      <tr>
        <th class="h-num">Nr. crt.</th>
        <th>A</th>
        <th>B</th>
        <th>C</th>
        <th>D</th>
        <th class="h-right">&nbsp;</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="footer">
    <span>${escapeHtml(dateStr)}</span>
    <span>Cod generare = ${escapeHtml(codGen)}</span>
    <span>Page 1 of 1</span>
  </div>
</body>
</html>`

    return new NextResponse(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || String(e) }, { status: 500 })
  }
}
