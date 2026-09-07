import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Găsește variabila potrivită pentru ce a scris utilizatorul.
// Primește catalogul cu valorile reale ale seriei curente, deci poate potrivi
// atât o valoare concretă („17 septembrie") cât și o descriere („numele instructorului").
export async function POST(req: NextRequest) {
  const { query, variables } = await req.json().catch(() => ({}))
  const vars: { key: string; label: string; value?: string }[] = Array.isArray(variables) ? variables : []
  const q = String(query || '').trim()
  if (!q) return NextResponse.json({ error: 'Scrie ce vrei să inserezi.' }, { status: 400 })
  if (!vars.length) return NextResponse.json({ error: 'Catalog de variabile gol.' }, { status: 400 })

  const KEY = process.env.ANTHROPIC_API_KEY
  if (!KEY) return NextResponse.json({ error: 'Lipsește ANTHROPIC_API_KEY (doar pe Vercel).' }, { status: 500 })

  const list = vars
    .map(v => `{{${v.key}}} = ${v.label}${String(v.value || '').trim() ? ` → acum: "${v.value}"` : ' → acum: (gol)'}`)
    .join('\n')

  const system = [
    'Ești un asistent care alege variabila potrivită pentru un template de email al unei școli de navigație.',
    'Ai lista completă de variabile, cu eticheta și valoarea lor pentru seria selectată acum:',
    '',
    list,
    '',
    'Utilizatorul scrie fie o valoare concretă (ex. „17 septembrie", „Snagov"), fie o descriere (ex. „numele instructorului").',
    'Alege cheia care se potrivește cel mai bine. Dacă valoarea scrisă coincide cu valoarea curentă a unei variabile, aceea e alegerea corectă.',
    'Dacă nimic nu se potrivește rezonabil, întoarce key gol.',
    'Poți propune și una-două alternative, în ordinea potrivirii.',
  ].join('\n')

  const schema = {
    type: 'object',
    properties: {
      key: { type: 'string', description: 'Cheia variabilei alese, fără acolade. Gol dacă nu se potrivește nimic.' },
      why: { type: 'string', description: 'O propoziție scurtă, în română, de ce se potrivește.' },
      alternatives: { type: 'array', items: { type: 'string' }, description: 'Alte chei posibile, fără acolade.' },
    },
    required: ['key', 'why', 'alternatives'],
    additionalProperties: false,
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system,
        messages: [{ role: 'user', content: q }],
        output_config: { format: { type: 'json_schema', schema } },
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data?.error?.message || 'Eroare API Claude' }, { status: 502 })

    const textBlock = (data.content || []).find((c: any) => c?.type === 'text')
    let parsed: any
    try { parsed = JSON.parse(String(textBlock?.text || '').trim()) } catch {
      return NextResponse.json({ error: 'Răspuns AI neinterpretabil' }, { status: 502 })
    }

    // Nu lăsăm să treacă chei inventate
    const known = new Set(vars.map(v => v.key))
    const key = known.has(parsed.key) ? parsed.key : ''
    const alternatives = (Array.isArray(parsed.alternatives) ? parsed.alternatives : [])
      .filter((k: any) => known.has(k) && k !== key).slice(0, 3)
    return NextResponse.json({ key, why: String(parsed.why || '').trim(), alternatives })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'eroare' }, { status: 500 })
  }
}
