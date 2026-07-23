import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Transformă un email concret într-un template cu {{variabile}} (doar unde corespund catalogului).
export async function POST(req: NextRequest) {
  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY (doar pe Vercel).' }, { status: 500 })

  const { subject, body, variables } = await req.json().catch(() => ({}))
  const vars: { key: string; label: string; sample?: string }[] = Array.isArray(variables) ? variables : []
  if (!String(subject || '').trim() && !String(body || '').trim())
    return NextResponse.json({ error: 'Subiect și text goale.' }, { status: 400 })

  const varList = vars
    .map(v => `{{${v.key}}} = ${v.label}${v.sample ? ` (ex: ${v.sample})` : ''}`)
    .join('\n')

  const system = [
    'Ești un asistent care transformă un email concret într-un TEMPLATE reutilizabil pentru o școală de navigație (SetSail).',
    'Ai o listă de variabile disponibile, fiecare cu formula {{cheie}}, o etichetă și, uneori, un exemplu de valoare reală folosită în acest email:',
    '',
    varList || '(nicio variabilă)',
    '',
    'Sarcina ta:',
    '- Înlocuiește în SUBIECT și în TEXT valorile concrete cu {{cheie}} DOAR acolo unde valoarea corespunde clar unei variabile din listă (de obicei se potrivește cu exemplul dat).',
    '- NU inventa variabile care nu sunt în listă. Detaliile specifice care nu au variabilă rămân ca text.',
    '- Păstrează exact tonul, formatarea, liniile și diacriticele textului.',
    '- Propune un nume intern scurt (label) pentru template (2-4 cuvinte).',
    'Răspunde DOAR cu JSON valid, fără markdown, fără explicații:',
    '{"label":"...","subject":"...","body":"..."}',
  ].join('\n')

  const user = `SUBIECT:\n${subject || ''}\n\nTEXT:\n${body || ''}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2000,
        system,
        messages: [{ role: 'user', content: user }],
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })

    // Parsare defensivă: ia primul bloc text, curăță fences, izolează {...}
    const textBlock = (data.content || []).find((c: any) => c?.type === 'text')
    let raw = String(textBlock?.text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
    const a = raw.indexOf('{'); const b = raw.lastIndexOf('}')
    if (a >= 0 && b > a) raw = raw.slice(a, b + 1)
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      return NextResponse.json({ error: 'Răspuns AI neinterpretabil', raw: raw.slice(0, 300) }, { status: 502 })
    }
    return NextResponse.json({
      label: String(parsed.label || '').trim(),
      subject: String(parsed.subject ?? subject ?? ''),
      body: String(parsed.body ?? body ?? ''),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'eroare' }, { status: 500 })
  }
}
