import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Transformă un email concret într-un template cu {{variabile}} (doar unde corespund catalogului).
export async function POST(req: NextRequest) {
  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY (doar pe Vercel).' }, { status: 500 })

  const { subject, body, variables, categories } = await req.json().catch(() => ({}))
  const cats: { value: string; label: string }[] = Array.isArray(categories) ? categories : []
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
    '- Dacă SUBIECTUL primit e gol, deduce-l din text: fie dintr-un rând de tip „Subiect:", fie propune unul scurt și potrivit.',
    ...(cats.length ? [
      `- Alege categoria potrivită din lista: ${cats.map(c => c.value).join(', ')}. Dacă niciuna nu se potrivește, folosește "general".`,
    ] : []),
    'Răspunde cu obiectul cerut: label, subject, body (și categorie, dacă e cazul).',
  ].join('\n')

  // Schema de răspuns — API-ul garantează astfel JSON valid, indiferent de lungimea textului
  const schema = {
    type: 'object',
    properties: {
      label: { type: 'string', description: 'Nume scurt pentru template (2-4 cuvinte)' },
      subject: { type: 'string', description: 'Subiectul, cu variabile acolo unde se potrivesc' },
      body: { type: 'string', description: 'Textul emailului, cu variabile acolo unde se potrivesc' },
      categorie: {
        type: 'string',
        description: cats.length ? `Una dintre: ${cats.map(c => c.value).join(', ')}` : 'Lasă gol',
      },
    },
    required: ['label', 'subject', 'body', 'categorie'],
    additionalProperties: false,
  }

  const user = `SUBIECT:\n${subject || ''}\n\nTEXT:\n${body || ''}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        // emailul se întoarce integral în răspuns — cu prea puține tokenuri ieșea trunchiat
        max_tokens: 16000,
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { format: { type: 'json_schema', schema } },
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })

    const textBlock = (data.content || []).find((c: any) => c?.type === 'text')
    let raw = String(textBlock?.text || '').trim()
    if (data.stop_reason === 'max_tokens')
      return NextResponse.json({ error: 'Emailul e prea lung pentru o singură analiză. Încearcă doar partea de text a emailului.' }, { status: 502 })

    // Schema garantează JSON valid; păstrăm curățarea ca plasă de siguranță
    let parsed: any
    try { parsed = JSON.parse(raw) } catch {
      raw = raw.replace(/```json/gi, '').replace(/```/g, '').trim()
      const a = raw.indexOf('{'); const b = raw.lastIndexOf('}')
      if (a >= 0 && b > a) raw = raw.slice(a, b + 1)
      try { parsed = JSON.parse(raw) } catch {
        return NextResponse.json({
          error: 'Răspuns AI neinterpretabil',
          raw: raw.slice(0, 300),
          stop_reason: data.stop_reason || null,
        }, { status: 502 })
      }
    }
    return NextResponse.json({
      label: String(parsed.label || '').trim(),
      subject: String(parsed.subject ?? subject ?? ''),
      body: String(parsed.body ?? body ?? ''),
      categorie: String(parsed.categorie || '').trim(),
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'eroare' }, { status: 500 })
  }
}
